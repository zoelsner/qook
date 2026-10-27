-- Per-recipe atomic claim and attempt cap for the paid phase-2 fill.
-- A fresh claim blocks concurrent fills of the same card for 3 minutes; a
-- failed fill clears the claim so a retry can proceed, up to 3 attempts.
alter table public.recipes
  add column fill_attempt_count integer not null default 0 check (fill_attempt_count >= 0),
  add column fill_claimed_at timestamptz;

create function public.claim_fill_attempt(p_recipe_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recipe public.recipes%rowtype;
begin
  if p_recipe_id is null then
    raise exception 'Recipe is required';
  end if;
  select * into recipe from public.recipes where id = p_recipe_id for update;
  if not found then return 'not_found'; end if;
  if recipe.content_status <> 'proposal' then return 'done'; end if;
  if recipe.fill_claimed_at is not null
     and recipe.fill_claimed_at > now() - interval '3 minutes' then
    return 'busy';
  end if;
  if recipe.fill_attempt_count >= 3 then return 'exhausted'; end if;

  update public.recipes
    set fill_claimed_at = clock_timestamp(), fill_attempt_count = fill_attempt_count + 1
    where id = p_recipe_id;
  return 'claimed';
end;
$$;
-- Only the authenticated Edge Function may claim. No client RPC.
revoke all on function public.claim_fill_attempt(uuid) from public, anon, authenticated;
grant execute on function public.claim_fill_attempt(uuid) to service_role;
