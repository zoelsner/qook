-- ============================================================
-- Qook init schema
-- Source: docs/plan/section-backend.md §2
-- Note: cohort_decks is defined BEFORE weekly_decks because
-- weekly_decks.source_cohort_id → cohort_decks(id).
-- ============================================================

-- 2.1 Extensions + enums

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "citext";

create type energy_tier as enum (
  'brain-is-fried',   -- <=15m, no cook
  'after-work',       -- <=30m, one pan
  'got-energy',       -- <=45m, proper cooking
  'weekend-project'   -- >45m, ambitious
);
create type recipe_difficulty as enum ('Easy', 'Medium', 'Advanced');
create type flavor_mode as enum ('comfort', 'bold', 'restaurant');
create type effort_mode as enum ('quick', 'standard', 'elevated');
create type preference_state as enum ('like', 'love', 'exclude');
create type recipe_source as enum ('ai', 'fallback', 'seed', 'imported');
create type image_status as enum ('pending', 'generating', 'ready', 'failed');
create type generation_status as enum ('pending', 'generating', 'ready', 'failed');
create type generation_item_status as enum ('pending', 'generating', 'ready', 'failed', 'skipped');
create type grocery_category as enum ('Produce', 'Dairy', 'Pantry', 'Protein', 'Frozen', 'Bakery', 'Other');
create type grocery_source as enum ('manual', 'recipe_import');
create type unit_system as enum ('imperial', 'metric');

-- 2.2 profiles

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null,
  display_name text,
  given_name text,
  family_name text,
  avatar_url text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  has_completed_onboarding boolean not null default false,
  first_deck_generated_at timestamptz,
  ai_data_consent_at timestamptz
);
create index profiles_email_idx on public.profiles (email);

-- 2.3 user_preferences

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  household_size smallint check (household_size between 1 and 12),
  unit_system unit_system default 'imperial',
  cuisine_preferences jsonb not null default '[]'::jsonb,
  protein_preferences jsonb not null default '[]'::jsonb,
  avoid_ingredients text[] not null default '{}',
  cooking_tools text[] not null default '{}',
  generation_day smallint not null default 0 check (generation_day between 0 and 6),
  weekly_deck_flavor_mode flavor_mode,
  weekly_deck_effort_mode effort_mode,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences add constraint cuisine_prefs_is_array
  check (jsonb_typeof(cuisine_preferences) = 'array');
alter table public.user_preferences add constraint protein_prefs_is_array
  check (jsonb_typeof(protein_preferences) = 'array');

-- 2.4 recipes

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  signature text,
  title text not null,
  cuisine text not null,
  serves smallint not null check (serves between 1 and 16),
  total_time_min smallint check (total_time_min between 0 and 720),
  difficulty recipe_difficulty not null default 'Medium',
  energy_tier energy_tier not null,
  ingredient_groups jsonb not null default '[]'::jsonb,
  workflow_sections jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  notes text,
  source recipe_source not null default 'ai',
  image_status image_status not null default 'pending',
  image_storage_path text,
  image_error text,
  image_updated_at timestamptz,
  last_image_prompt text,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index recipes_signature_global_idx
  on public.recipes (signature)
  where user_id is null and signature is not null;

create index recipes_user_idx on public.recipes (user_id, created_at desc)
  where user_id is not null;
create index recipes_user_energy_idx on public.recipes (user_id, energy_tier)
  where user_id is not null;
create index recipes_title_trgm_idx on public.recipes using gin (title gin_trgm_ops);

alter table public.recipes add constraint ingredient_groups_is_array
  check (jsonb_typeof(ingredient_groups) = 'array');
alter table public.recipes add constraint workflow_sections_is_array
  check (jsonb_typeof(workflow_sections) = 'array');
alter table public.recipes add constraint timeline_is_array
  check (jsonb_typeof(timeline) = 'array');

-- 2.5 user_saved_recipes

create table public.user_saved_recipes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index user_saved_recipes_user_idx on public.user_saved_recipes (user_id, saved_at desc);

create view public.my_saved_recipes as
  select sr.user_id, sr.saved_at, r.*
  from public.user_saved_recipes sr
  join public.recipes r on r.id = sr.recipe_id
  union all
  select r.user_id, r.created_at as saved_at, r.*
  from public.recipes r
  where r.user_id is not null;

-- 2.8 cohort_decks (created BEFORE weekly_decks for FK order)

create table public.cohort_decks (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  energy_tier energy_tier not null,
  recipe_ids uuid[] not null,
  storage_path text not null,
  generation_session_id uuid,
  created_at timestamptz not null default now(),
  unique (week_start_date, energy_tier)
);
create index cohort_decks_week_idx on public.cohort_decks (week_start_date, energy_tier);

-- 2.6 weekly_decks

create table public.weekly_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start_date date not null,
  status generation_status not null default 'pending',
  flavor_mode flavor_mode not null,
  effort_mode effort_mode not null,
  voice_context text,
  source_cohort_id uuid references public.cohort_decks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);
create index weekly_decks_user_idx on public.weekly_decks (user_id, week_start_date desc);

-- 2.7 deck_items

create table public.deck_items (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.weekly_decks(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  slot_index smallint not null check (slot_index >= 0),
  liked boolean,
  swiped_at timestamptz,
  day_label smallint check (day_label between 0 and 6),
  shopping_selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (deck_id, slot_index)
);
create index deck_items_deck_idx on public.deck_items (deck_id, slot_index);
create index deck_items_deck_liked_idx on public.deck_items (deck_id) where liked = true;

-- 2.9 generation_sessions + generation_items

create table public.generation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  flavor_mode flavor_mode not null,
  effort_mode effort_mode not null,
  energy_tier energy_tier,
  meal_type text,
  recipe_count smallint not null check (recipe_count between 1 and 20),
  voice_context text,
  status generation_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gen_sessions_user_idx on public.generation_sessions (user_id, created_at desc);
create index gen_sessions_pending_idx on public.generation_sessions (status)
  where status in ('pending', 'generating');

create table public.generation_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.generation_sessions(id) on delete cascade,
  slot_index smallint not null,
  status generation_item_status not null default 'pending',
  recipe_id uuid references public.recipes(id) on delete set null,
  signature text,
  error text,
  prompt_meta jsonb,
  remix_nonce integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, slot_index)
);
create index gen_items_session_idx on public.generation_items (session_id, slot_index);

-- 2.10 grocery_items

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  canonical_key text not null,
  name text not null,
  quantity_amount numeric,
  quantity_unit text,
  quantity_text text,
  category grocery_category not null default 'Other',
  checked boolean not null default false,
  source grocery_source not null default 'manual',
  source_recipe_titles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, canonical_key)
);
create index grocery_items_user_idx on public.grocery_items (user_id, category, checked);

-- 2.11 Shared updated_at trigger

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.weekly_decks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.generation_sessions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.generation_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.grocery_items
  for each row execute function public.set_updated_at();

-- Supporting RPC: atomic use_count increment for signature-dedup cache.
-- Referenced by supabase/functions/generate-recipe.
create or replace function public.increment_use_count(recipe_id uuid)
returns void language sql as $$
  update public.recipes set use_count = use_count + 1 where id = recipe_id;
$$;
