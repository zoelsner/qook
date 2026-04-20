-- ============================================================
-- Qook auth triggers + JWT custom claims
-- Source: docs/plan/section-backend.md §4.4, §4.5
-- ============================================================

-- 4.4 Auto-create profile + preferences on auth.users insert

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, given_name, family_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             new.email),
    new.raw_user_meta_data ->> 'given_name',
    new.raw_user_meta_data ->> 'family_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.5 JWT custom claims hook (adds app_metadata.onboarded to access token)
-- Enable in Dashboard -> Auth -> Hooks -> Custom Access Token Hook.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb;
  onboarded boolean;
begin
  select has_completed_onboarding into onboarded
  from public.profiles where id = (event ->> 'user_id')::uuid;
  claims := event -> 'claims';
  claims := jsonb_set(claims, '{app_metadata,onboarded}', to_jsonb(coalesce(onboarded, false)));
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
