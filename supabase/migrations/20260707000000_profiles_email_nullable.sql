-- Anonymous sign-ins (pre-Phase-5 auth): anonymous users have no email,
-- and handle_new_user() inserts new.email into profiles — so email must be
-- nullable or every anonymous signup fails at the trigger. Phase 5 account
-- linking backfills email when the user upgrades to a real account.

alter table public.profiles alter column email drop not null;
