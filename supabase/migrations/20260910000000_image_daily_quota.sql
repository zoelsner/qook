-- Count image workflow claims, including failures, over a rolling 24 hours.
-- Historical attempts are unknown; accounting starts when this migration lands.
create table public.image_generation_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default clock_timestamp()
);
create index image_generation_attempts_user_time_idx
  on public.image_generation_attempts (user_id, created_at desc);
alter table public.image_generation_attempts enable row level security;
revoke all on public.image_generation_attempts from public, anon, authenticated;
grant all on public.image_generation_attempts to service_role;
grant usage, select on sequence public.image_generation_attempts_id_seq to service_role;

create function public.claim_image_attempt(p_user_id uuid, p_recipe_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recipe public.recipes%rowtype;
  claimed_at timestamptz;
  daily_count bigint;
begin
  if p_user_id is null or p_recipe_id is null then
    raise exception 'User and recipe are required';
  end if;
  -- Serialize different recipe claims by this user as well as shared-row claims.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 51050));
  select * into recipe from public.recipes
    where id = p_recipe_id and (user_id is null or user_id = p_user_id)
    for update;
  if not found then return 'not_found'; end if;
  if recipe.image_status not in ('pending', 'failed') then return 'skip'; end if;
  if recipe.image_attempt_count >= 3 then return 'exhausted'; end if;

  claimed_at := clock_timestamp();
  select count(*) into daily_count from public.image_generation_attempts
    where user_id = p_user_id and created_at >= claimed_at - interval '24 hours';
  if daily_count >= 50 then return 'daily_limit'; end if;

  insert into public.image_generation_attempts(user_id, recipe_id, created_at)
    values (p_user_id, p_recipe_id, claimed_at);
  update public.recipes
    set image_status = 'generating', image_attempt_count = image_attempt_count + 1
    where id = p_recipe_id;
  return 'claimed';
end;
$$;
-- Only the authenticated Edge Function may choose the user ID. No client RPC.
revoke all on function public.claim_image_attempt(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_image_attempt(uuid, uuid) to service_role;
