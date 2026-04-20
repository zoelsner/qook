# Qook Fresh — Backend Architecture

**Author:** backend-architect
**Stack:** Supabase (Postgres + RLS + Edge Functions + Storage + Auth)
**Target ship:** 2026-05-24 TestFlight
**Repo root:** `~/Projects/qook/` (fresh repo, NOT inside sashafood monorepo)

---

## 0. Guiding principles

- **Postgres-first.** Model everything as relational tables with FKs and proper constraints. The old Convex schema's `v.any()` escape hatches get hardened into `jsonb` columns with CHECK constraints where feasible.
- **RLS is the security model.** No "service role" reads in client code — every client-facing query must pass RLS. Edge Functions hold the service role key for admin ops.
- **Edge Functions for AI, Postgres for state.** Every OpenRouter call goes through an Edge Function. Client never holds the OpenRouter key.
- **Signature-dedup cache.** Generated recipes are content-addressed by a stable hash so we never pay twice for the same recipe.
- **Cohort decks as static JSON in Storage.** Weekly cohort decks are written by a cron function to public Storage. Clients read directly from CDN — zero DB hit, infinite scale.

---

## 1. Supabase project setup

### 1.1 Project creation

One-time via Supabase Dashboard:

1. Org: `zach-personal` (existing)
2. Project name: `qook-prod`
3. Region: `us-east-1`
4. Postgres version: 15+
5. Compute tier: start on **Free**, upgrade to **Pro ($25/mo)** before TestFlight launch.

Also create `qook-staging` on Free tier for preview builds.

### 1.2 Local dev via Supabase CLI

```bash
brew install supabase/tap/supabase
cd ~/Projects/qook
supabase init
supabase link --project-ref <prod-ref>
supabase start  # runs full local stack in Docker: postgres, auth, storage, edge runtime
```

File layout:

```
~/Projects/qook/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260421000000_init_schema.sql
│   │   ├── 20260421000001_rls_policies.sql
│   │   ├── 20260421000002_auth_triggers.sql
│   │   ├── 20260421000003_storage_buckets.sql
│   │   └── 20260421000004_cron.sql
│   ├── seed.sql
│   └── functions/
│       ├── _shared/
│       │   ├── openrouter.ts
│       │   ├── supabase.ts
│       │   └── prompts.ts
│       ├── generate-recipe/index.ts
│       ├── generate-deck-batch/index.ts
│       ├── generate-image/index.ts
│       └── warm-start-import/index.ts
├── apps/native/                 # Expo app
├── packages/shared-types/       # generated TS + hand-written domain types
└── .env.local                   # gitignored
```

### 1.3 TypeScript type generation

```bash
supabase gen types typescript --local > packages/shared-types/src/database.ts
# prod (CI)
supabase gen types typescript --project-id <prod-ref> > packages/shared-types/src/database.ts
```

Wire into `package.json` as `bun run db:types`. Run automatically after any `supabase db push`.

### 1.4 Migration workflow

```bash
supabase migration new add_user_preferences_column   # create
supabase db reset                                    # replay all locally
supabase db push                                     # push pending to prod
```

Never ALTER via dashboard — always via migration file. CI blocks merges where `supabase/migrations/` changes without corresponding regen of `database.ts`.

### 1.5 Env vars

`.env.local` (gitignored):

```bash
# Public — safe for client
EXPO_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only — set via `supabase secrets set`
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_TEXT_MODEL=anthropic/claude-haiku-4.5
OPENROUTER_POLISH_MODEL=anthropic/claude-sonnet-4.6
OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # auto-provisioned in edge runtime
```

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
supabase secrets set OPENROUTER_TEXT_MODEL=anthropic/claude-haiku-4.5
supabase secrets set OPENROUTER_POLISH_MODEL=anthropic/claude-sonnet-4.6
supabase secrets set OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5
```

Anon key is safe to ship — security is enforced by RLS, not key secrecy.

---

## 2. Database schema

File: `supabase/migrations/20260421000000_init_schema.sql`

### 2.1 Extensions and enums

```sql
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "citext";

create type energy_tier as enum (
  'brain-is-fried',   -- ≤15m, no cook
  'after-work',       -- ≤30m, one pan
  'got-energy',       -- ≤45m, proper cooking
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
```

### 2.2 `profiles`

```sql
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
```

### 2.3 `user_preferences`

```sql
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
```

### 2.4 `recipes`

Single table for both user-saved recipes and cached AI recipes. `user_id` NULL = globally-cached; NOT NULL = user-owned. The `generatedRecipes` cache from the old Convex schema is merged in here.

[CROSS-REF: domain-architect] — confirm payload shape aligns with the normalize lib.

```sql
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
```

### 2.5 `user_saved_recipes` — many-to-many save relation

```sql
create table public.user_saved_recipes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index user_saved_recipes_user_idx on public.user_saved_recipes (user_id, saved_at desc);

-- Unified "my saved" view
create view public.my_saved_recipes as
  select sr.user_id, sr.saved_at, r.*
  from public.user_saved_recipes sr
  join public.recipes r on r.id = sr.recipe_id
  union all
  select r.user_id, r.created_at as saved_at, r.*
  from public.recipes r
  where r.user_id is not null;
```

### 2.6 `weekly_decks`

```sql
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
```

### 2.7 `deck_items`

```sql
create table public.deck_items (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.weekly_decks(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  slot_index smallint not null check (slot_index >= 0),
  liked boolean,                           -- null=unswiped
  swiped_at timestamptz,
  day_label smallint check (day_label between 0 and 6),
  shopping_selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (deck_id, slot_index)
);
create index deck_items_deck_idx on public.deck_items (deck_id, slot_index);
create index deck_items_deck_liked_idx on public.deck_items (deck_id) where liked = true;
```

### 2.8 `cohort_decks`

```sql
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
```

### 2.9 `generation_sessions` + `generation_items`

```sql
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
```

### 2.10 `grocery_items`

```sql
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
```

### 2.11 Shared `updated_at` trigger

```sql
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
```

---

## 3. Row-Level Security

File: `supabase/migrations/20260421000001_rls_policies.sql`

### 3.1 Enable RLS everywhere

```sql
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.recipes enable row level security;
alter table public.user_saved_recipes enable row level security;
alter table public.weekly_decks enable row level security;
alter table public.deck_items enable row level security;
alter table public.cohort_decks enable row level security;
alter table public.generation_sessions enable row level security;
alter table public.generation_items enable row level security;
alter table public.grocery_items enable row level security;
```

### 3.2 `profiles`

```sql
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
-- No insert policy — auth trigger is SECURITY DEFINER
```

### 3.3 `user_preferences`

```sql
create policy "read own prefs" on public.user_preferences for select using (auth.uid() = user_id);
create policy "upsert own prefs" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "update own prefs" on public.user_preferences for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 3.4 `recipes` — dual ownership

```sql
create policy "read own or global recipes" on public.recipes for select
  using ((user_id is null and auth.role() = 'authenticated') or user_id = auth.uid());
create policy "insert own recipes" on public.recipes for insert
  with check (user_id = auth.uid());
create policy "update own recipes" on public.recipes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own recipes" on public.recipes for delete using (user_id = auth.uid());
-- Service role (edge funcs) bypasses RLS — used for inserting global cached recipes.
```

### 3.5 `user_saved_recipes`

```sql
create policy "read own saves" on public.user_saved_recipes for select using (auth.uid() = user_id);
create policy "insert own saves" on public.user_saved_recipes for insert with check (auth.uid() = user_id);
create policy "delete own saves" on public.user_saved_recipes for delete using (auth.uid() = user_id);
```

### 3.6 `weekly_decks` + `deck_items`

```sql
create policy "read own decks" on public.weekly_decks for select using (auth.uid() = user_id);
create policy "insert own decks" on public.weekly_decks for insert with check (auth.uid() = user_id);
create policy "update own decks" on public.weekly_decks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own decks" on public.weekly_decks for delete using (auth.uid() = user_id);

create policy "read items in own decks" on public.deck_items for select using (
  exists (select 1 from public.weekly_decks d where d.id = deck_items.deck_id and d.user_id = auth.uid())
);
create policy "insert items in own decks" on public.deck_items for insert with check (
  exists (select 1 from public.weekly_decks d where d.id = deck_items.deck_id and d.user_id = auth.uid())
);
create policy "update items in own decks" on public.deck_items for update
  using (exists (select 1 from public.weekly_decks d where d.id = deck_items.deck_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.weekly_decks d where d.id = deck_items.deck_id and d.user_id = auth.uid()));
create policy "delete items in own decks" on public.deck_items for delete using (
  exists (select 1 from public.weekly_decks d where d.id = deck_items.deck_id and d.user_id = auth.uid())
);
```

### 3.7 `cohort_decks` — authenticated world-read

```sql
create policy "read cohort decks" on public.cohort_decks for select
  using (auth.role() = 'authenticated');
-- Inserts only via service role (cron)
```

### 3.8 `generation_sessions` + `generation_items`

```sql
create policy "read own sessions" on public.generation_sessions for select using (auth.uid() = user_id);
create policy "insert own sessions" on public.generation_sessions for insert with check (auth.uid() = user_id);
-- Updates are server-side only

create policy "read items in own sessions" on public.generation_items for select using (
  exists (select 1 from public.generation_sessions s where s.id = generation_items.session_id and s.user_id = auth.uid())
);
```

### 3.9 `grocery_items`

```sql
create policy "read own grocery" on public.grocery_items for select using (auth.uid() = user_id);
create policy "insert own grocery" on public.grocery_items for insert with check (auth.uid() = user_id);
create policy "update own grocery" on public.grocery_items for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own grocery" on public.grocery_items for delete using (auth.uid() = user_id);
```

---

## 4. Auth config

### 4.1 Providers enabled

- Email + password
- Sign in with Apple (required for App Store 4.8)

Disable email confirmations for TestFlight (faster onboarding); re-enable pre-public launch.

### 4.2 Apple Sign In setup

1. Apple Developer: App ID with SIWA capability; Services ID `com.qook.signin`; Sign in with Apple .p8 key (note Key ID).
2. Supabase Dashboard → Auth → Providers → Apple:
   - Client ID: Services ID
   - Team ID + Key ID + .p8
   - Allowed redirect URLs:
     - `qook://login-callback`
     - `https://<prod-ref>.supabase.co/auth/v1/callback`
3. Expo client:

```ts
// apps/native/src/lib/auth.ts
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

export async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('No identity token');
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  return data;
}
```

### 4.3 Email templates

Dashboard → Auth → Email Templates:

- **Confirm signup** → `qook://confirm-email?token={{ .TokenHash }}`
- **Magic link** — disabled v1
- **Reset password** → `qook://reset-password?token={{ .TokenHash }}`
- **Invite user** — disabled v1

### 4.4 Auto-create profile on signup

File: `supabase/migrations/20260421000002_auth_triggers.sql`

```sql
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
```

### 4.5 JWT custom claims

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare claims jsonb; onboarded boolean;
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
```

Enable in Dashboard → Auth → Hooks → Custom Access Token Hook.

### 4.6 Session refresh on mobile

```ts
// apps/native/src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@qook/shared-types';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

import { AppState } from 'react-native';
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

[CROSS-REF: frontend-architect] — provider wiring + `useSession` hook.

---

## 5. Storage buckets

File: `supabase/migrations/20260421000003_storage_buckets.sql`

### 5.1 `meal-images` — public CDN

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-images', 'meal-images', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp']);

create policy "public read meal-images" on storage.objects for select
  using (bucket_id = 'meal-images');
-- Only service role writes
```

Path: `meal-images/{recipe_id}.webp`
URL: `https://<prod-ref>.supabase.co/storage/v1/object/public/meal-images/{recipe_id}.webp`

### 5.2 `cohort-decks` — public JSON

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cohort-decks', 'cohort-decks', true, 1048576, array['application/json']);

create policy "public read cohort-decks" on storage.objects for select
  using (bucket_id = 'cohort-decks');
```

Path: `cohort-decks/{week_start_date}/{energy_tier}.json`
Example: `cohort-decks/2026-04-26/brain-is-fried.json`

### 5.3 `user-uploads` — private, per-user folders

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-uploads', 'user-uploads', false, 10485760,
  array['image/png', 'image/jpeg', 'image/heic', 'image/webp']);

create policy "users upload own folder" on storage.objects for insert
  with check (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own folder" on storage.objects for select
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own folder" on storage.objects for delete
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
```

Signed URL (1h):

```ts
const { data } = await supabase.storage
  .from('user-uploads')
  .createSignedUrl(`${userId}/${fileId}.webp`, 3600);
```

---

## 6. Edge Functions

### 6.1 `_shared/openrouter.ts`

```ts
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_IMAGE_ENDPOINT = 'https://openrouter.ai/api/v1/images/generations';

export const getTextModel = () => Deno.env.get('OPENROUTER_TEXT_MODEL') ?? 'anthropic/claude-haiku-4.5';
export const getPolishModel = () => Deno.env.get('OPENROUTER_POLISH_MODEL') ?? 'anthropic/claude-sonnet-4.6';
export const getImageModel = () => Deno.env.get('OPENROUTER_IMAGE_MODEL') ?? 'bytedance-seed/seedream-4.5';

export function headers() {
  return {
    Authorization: `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://qook.app',
    'X-Title': 'Qook',
  };
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chat(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' };
}): Promise<Response> {
  return fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: opts.model, messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      stream: opts.stream ?? false,
      response_format: opts.response_format,
    }),
  });
}

export async function generateImage(prompt: string, size = '1024x1024'): Promise<Uint8Array> {
  const res = await fetch(OPENROUTER_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ model: getImageModel(), prompt, size, response_format: 'b64_json' }),
  });
  if (!res.ok) throw new Error(`Image gen failed: ${await res.text()}`);
  const json = await res.json();
  return Uint8Array.from(atob(json.data[0].b64_json), (c) => c.charCodeAt(0));
}
```

### 6.2 `_shared/supabase.ts`

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from '../../../packages/shared-types/src/database.ts';

export function serviceClient() {
  return createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

export function userClient(authHeader: string) {
  return createClient<Database>(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
}

export async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new Response('Unauthorized', { status: 401 });
  const client = userClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Response('Unauthorized', { status: 401 });
  return { user: data.user, client };
}
```

### 6.3 `generate-recipe` — live AI endpoint

File: `supabase/functions/generate-recipe/index.ts`

```ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { chat, getTextModel, getPolishModel } from '../_shared/openrouter.ts';
import { serviceClient, requireUser } from '../_shared/supabase.ts';
import { buildDraftPrompt, buildPolishPrompt, computeSignature,
         normalizeRecipe, planSlots, needsPolish } from '../_shared/prompts.ts';

type Body = {
  flavor_mode: 'comfort' | 'bold' | 'restaurant';
  effort_mode: 'quick' | 'standard' | 'elevated';
  energy_tier?: 'brain-is-fried' | 'after-work' | 'got-energy' | 'weekend-project';
  recipe_count: number;
  voice_context?: string;
  pinned_proteins?: string[];
};

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const { user } = await requireUser(req);
    const body: Body = await req.json();
    const service = serviceClient();

    const { data: session, error } = await service.from('generation_sessions').insert({
      user_id: user.id,
      flavor_mode: body.flavor_mode,
      effort_mode: body.effort_mode,
      energy_tier: body.energy_tier,
      recipe_count: body.recipe_count,
      voice_context: body.voice_context,
      status: 'generating',
    }).select().single();
    if (error) throw error;

    const { data: prefs } = await service.from('user_preferences')
      .select('*').eq('user_id', user.id).single();

    const slots = planSlots({
      count: body.recipe_count, prefs,
      flavorMode: body.flavor_mode, effortMode: body.effort_mode,
      energyTier: body.energy_tier, pinnedProteins: body.pinned_proteins,
    });

    await service.from('generation_items').insert(
      slots.map((slot, i) => ({
        session_id: session.id, slot_index: i, status: 'pending', prompt_meta: slot,
      }))
    );

    // Fan out — edge runtime allows up to 150s wall-clock background work
    EdgeRuntime.waitUntil(
      Promise.all(slots.map((slot, i) => generateSlot(service, session.id, i, slot, body)))
    );

    return Response.json({ session_id: session.id });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(String(e), { status: 500 });
  }
});

async function generateSlot(service, sessionId, slotIndex, slot, body: Body) {
  await service.from('generation_items')
    .update({ status: 'generating' })
    .eq('session_id', sessionId).eq('slot_index', slotIndex);

  try {
    const draftRes = await chat({
      model: getTextModel(),
      messages: buildDraftPrompt(slot, body),
      response_format: { type: 'json_object' },
    });
    if (!draftRes.ok) throw new Error(`Draft failed: ${await draftRes.text()}`);
    let recipe = JSON.parse((await draftRes.json()).choices[0].message.content);

    if (needsPolish(recipe)) {
      const polishRes = await chat({
        model: getPolishModel(),
        messages: buildPolishPrompt(recipe, slot),
        response_format: { type: 'json_object' },
      });
      if (polishRes.ok) {
        recipe = JSON.parse((await polishRes.json()).choices[0].message.content);
      }
    }

    recipe = normalizeRecipe(recipe);
    const signature = await computeSignature(recipe);

    const { data: existing } = await service.from('recipes')
      .select('id').eq('signature', signature).is('user_id', null).maybeSingle();

    let recipeId: string;
    if (existing) {
      recipeId = existing.id;
      await service.rpc('increment_use_count', { recipe_id: recipeId });
    } else {
      const { data: inserted } = await service.from('recipes').insert({
        user_id: null, signature, ...recipe, source: 'ai', image_status: 'pending',
      }).select('id').single();
      recipeId = inserted!.id;
      EdgeRuntime.waitUntil(kickImage(recipeId, recipe));
    }

    await service.from('generation_items').update({
      status: 'ready', recipe_id: recipeId, signature,
    }).eq('session_id', sessionId).eq('slot_index', slotIndex);
  } catch (e) {
    await service.from('generation_items').update({
      status: 'failed', error: String(e),
    }).eq('session_id', sessionId).eq('slot_index', slotIndex);
  }

  // Finalize session when last item lands
  const { count } = await service.from('generation_items')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .in('status', ['pending', 'generating']);
  if ((count ?? 0) === 0) {
    await service.from('generation_sessions').update({ status: 'ready' }).eq('id', sessionId);
  }
}

async function kickImage(recipeId: string, recipe: any) {
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ recipe_id: recipeId, recipe }),
  });
}
```

Supporting SQL RPC for atomic increment:

```sql
create or replace function public.increment_use_count(recipe_id uuid)
returns void language sql as $$
  update public.recipes set use_count = use_count + 1 where id = recipe_id;
$$;
```

### 6.4 `generate-image` — Seedream call

File: `supabase/functions/generate-image/index.ts`

```ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { generateImage } from '../_shared/openrouter.ts';
import { serviceClient } from '../_shared/supabase.ts';

type Body = { recipe_id: string; recipe?: any };

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)
    return new Response('Unauthorized', { status: 401 });

  const { recipe_id, recipe }: Body = await req.json();
  const service = serviceClient();

  try {
    await service.from('recipes').update({ image_status: 'generating' }).eq('id', recipe_id);

    const prompt = buildImagePrompt(recipe);
    const bytes = await generateImage(prompt, '1024x1024');

    const path = `${recipe_id}.webp`;
    const { error: upErr } = await service.storage.from('meal-images')
      .upload(path, bytes, { contentType: 'image/webp', upsert: true });
    if (upErr) throw upErr;

    await service.from('recipes').update({
      image_status: 'ready',
      image_storage_path: path,
      image_updated_at: new Date().toISOString(),
      last_image_prompt: prompt,
    }).eq('id', recipe_id);

    return Response.json({ ok: true, path });
  } catch (e) {
    await service.from('recipes').update({
      image_status: 'failed', image_error: String(e),
    }).eq('id', recipe_id);
    return new Response(String(e), { status: 500 });
  }
});

function buildImagePrompt(recipe: any): string {
  // [CROSS-REF: ai-architect] — shared prompt template
  return [
    `Watercolor illustration of ${recipe.title}.`,
    `${recipe.cuisine} cuisine, plated on a ceramic dish, top-down view.`,
    `Warm palette, cream background (#FAF5EC), soft painterly brush strokes.`,
    `Rich color, appetizing, professional food illustration style.`,
  ].join(' ');
}
```

### 6.5 `generate-deck-batch` — weekly cron

File: `supabase/functions/generate-deck-batch/index.ts`

Cron migration `20260421000004_cron.sql`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Saturday 22:00 UTC (≈ Saturday 5pm ET) so user sees Sunday morning
select cron.schedule(
  'weekly-cohort-batch',
  '0 22 * * 6',
  $$
    select net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/generate-deck-batch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('week_start', (date_trunc('week', now() + interval '1 day'))::date)
    );
  $$
);
```

Function:

```ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { chat, getTextModel } from '../_shared/openrouter.ts';
import { buildDraftPrompt, computeSignature, normalizeRecipe, planCohortSlots } from '../_shared/prompts.ts';

const TIERS = ['brain-is-fried', 'after-work', 'got-energy', 'weekend-project'] as const;
const RECIPES_PER_TIER = 12;

serve(async (req) => {
  const { week_start }: { week_start: string } = await req.json();
  const service = serviceClient();
  const results = await Promise.all(TIERS.map((tier) => generateCohort(service, week_start, tier)));
  return Response.json({ week_start, cohorts: results });
});

async function generateCohort(service, weekStart: string, tier: typeof TIERS[number]) {
  const slots = planCohortSlots(tier, RECIPES_PER_TIER);
  const recipeIds: string[] = [];

  // Serial to stay under OpenRouter rate limits
  for (const slot of slots) {
    try {
      const draftRes = await chat({
        model: getTextModel(),
        messages: buildDraftPrompt(slot, { energy_tier: tier, recipe_count: 1 }),
        response_format: { type: 'json_object' },
      });
      const recipe = normalizeRecipe(JSON.parse((await draftRes.json()).choices[0].message.content));
      const signature = await computeSignature(recipe);

      const { data: existing } = await service.from('recipes')
        .select('id').eq('signature', signature).is('user_id', null).maybeSingle();

      let recipeId: string;
      if (existing) recipeId = existing.id;
      else {
        const { data: inserted } = await service.from('recipes').insert({
          user_id: null, signature, ...recipe, source: 'ai',
        }).select('id').single();
        recipeId = inserted!.id;
        await kickImage(recipeId, recipe);
      }
      recipeIds.push(recipeId);
    } catch (e) { console.error(`Slot failed in ${tier}:`, e); }
  }

  const { data: fullRecipes } = await service.from('recipes')
    .select('*').in('id', recipeIds);

  const storagePath = `${weekStart}/${tier}.json`;
  await service.storage.from('cohort-decks').upload(
    storagePath,
    JSON.stringify({ week_start: weekStart, tier, recipes: fullRecipes }, null, 2),
    { contentType: 'application/json', upsert: true }
  );

  await service.from('cohort_decks').upsert({
    week_start_date: weekStart, energy_tier: tier, recipe_ids: recipeIds, storage_path: storagePath,
  }, { onConflict: 'week_start_date,energy_tier' });

  return { tier, count: recipeIds.length };
}

async function kickImage(recipeId: string, recipe: any) {
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ recipe_id: recipeId, recipe }),
  });
}
```

### 6.6 `warm-start-import` — one-shot seed importer

File: `supabase/functions/warm-start-import/index.ts`

Run **once** manually (`supabase functions invoke warm-start-import`) after initial deploy.

```ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { serviceClient } from '../_shared/supabase.ts';
import SEED_RECIPES from './seed-recipes.json' with { type: 'json' };

type SeedRecipe = {
  slug: string;
  title: string;
  cuisine: string;
  energy_tier: 'brain-is-fried' | 'after-work' | 'got-energy' | 'weekend-project';
  serves: number;
  total_time_min: number;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  ingredient_groups: any;
  workflow_sections: any;
  timeline: any;
  notes?: string;
};

serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)
    return new Response('Unauthorized', { status: 401 });

  const service = serviceClient();
  const results: any[] = [];
  for (const seed of SEED_RECIPES as SeedRecipe[]) {
    try {
      const { data: inserted } = await service.from('recipes').insert({
        user_id: null,
        title: seed.title, cuisine: seed.cuisine,
        serves: seed.serves, total_time_min: seed.total_time_min,
        difficulty: seed.difficulty, energy_tier: seed.energy_tier,
        ingredient_groups: seed.ingredient_groups,
        workflow_sections: seed.workflow_sections,
        timeline: seed.timeline,
        notes: seed.notes,
        source: 'seed',
        image_status: 'ready',
        image_storage_path: `${seed.slug}.webp`,
        image_updated_at: new Date().toISOString(),
      }).select('id').single();
      results.push({ slug: seed.slug, id: inserted?.id });
    } catch (e) { results.push({ slug: seed.slug, error: String(e) }); }
  }
  return Response.json({ imported: results.length, results });
});
```

Complementary local script to upload the 24 PNGs (not an edge function):

```ts
// scripts/warm-start-upload-images.ts — run with `bun run warm-images`
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SEED_DIR = '/Users/zach/Projects/sashafood/apps/native/assets/meals-seed/v2';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const files = (await readdir(SEED_DIR)).filter((f) => f.endsWith('.png'));
  for (const file of files) {
    const slug = file.replace(/\.png$/, '');
    const png = await readFile(join(SEED_DIR, file));
    const webp = await sharp(png)
      .resize(1024, 1024, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
    const { error } = await supabase.storage.from('meal-images').upload(`${slug}.webp`, webp, {
      contentType: 'image/webp', upsert: true,
    });
    if (error) console.error(slug, error);
    else console.log(`uploaded ${slug}.webp`);
  }
}
main();
```

The 24 seed slugs (matching filenames in `meals-seed/v2/`): `adana-kebab`, `beef-broccoli-stirfry`, `black-bean-quesadilla`, `chicken-tikka`, `egg-fried-rice`, `fattoush-grilled-chicken`, `garlic-butter-spaghetti`, `gochujang-pork`, `greek-chicken-bowl`, `greek-lemon-chicken-orzo`, `lamb-chops-bulgur`, `menemen-sucuk`, `miso-salmon`, `mushroom-risotto`, `peanut-noodles`, `salmon-poke-bowl`, `shakshuka-merguez`, `sheet-pan-chicken`, `shrimp-tacos`, `steak-eggs-bowl`, `tuna-melt`, `turkey-chili`, `turkey-meatballs`, `white-bean-tuna-salad`.

---

## 7. Realtime subscriptions

```sql
alter publication supabase_realtime add table public.generation_sessions;
alter publication supabase_realtime add table public.generation_items;
alter publication supabase_realtime add table public.recipes;
```

**Why:**
- `generation_sessions` — client watches `status` flip `generating → ready`
- `generation_items` — per-slot updates → "3 of 5 recipes ready" UX
- `recipes` — watch `image_status` flip `pending → ready` to pop images in live

Client pattern:

```ts
const channel = supabase
  .channel(`session:${sessionId}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'generation_items', filter: `session_id=eq.${sessionId}` },
    (payload) => { /* update slot */ }
  )
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'generation_sessions', filter: `id=eq.${sessionId}` },
    (payload) => { /* update session */ }
  )
  .subscribe();
```

**Do NOT enable realtime on:** `weekly_decks`, `deck_items`, `grocery_items`, `cohort_decks` — too chatty, mutations are user-initiated so optimistic updates cover the UX.

---

## 8. Cost model

### 8.1 Tiers

**Free:** 500MB DB, 1GB egress, 2GB storage, 500K edge invocations, 2M realtime msgs. Pauses after 1 week idle.
**Pro ($25/mo):** 8GB DB, 250GB egress, 100GB storage, 2M edge invocations, 5M realtime, daily backups.

**Decision:** Free for dev, upgrade to Pro before TestFlight (May 20).

### 8.2 Projected monthly volumes (v1, ~100 testers)

| Workload | Volume | Edge | Storage | Notes |
|---|---|---|---|---|
| Cohort cron | 48 × 4wk × 4 tiers = 768 generations | ~800 | 48 × ~60KB JSON = 3MB | 1 cron trigger → internal loop |
| Live recipe gen | 100u × 2 decks × 12 rec = 2400 | ~2400 | — | |
| Image gen | ~2600 unique/mo | ~2600 | ~390MB WebP | Dedup catches most |
| Realtime msgs | 2400 sessions × ~15 msgs | — | — | ~36K msgs/mo |
| JSON deck reads | CDN-hit | 0 | — | |
| Meal image reads | ~50K loads | 0 | ~100GB egress | |

**Monthly cost @ 100 users:**
- Pro base: $25
- Storage: well under cap
- Egress: ~100GB under 250GB cap
- Edge: ~8K/mo well under 2M
- OpenRouter (separate): 2600 × ($0.01 text + $0.04 image) ≈ **$130/mo**

**Total: ~$155/mo.** At 1K users: ~$1300/mo (mostly OpenRouter).

**Cost levers:**
- Signature dedup reduces unique gens
- Swap Seedream → cheaper model post-launch
- Move to Cloudflare R2 if egress balloons

### 8.3 Per-user rate limits

In `generate-recipe`:

```ts
const { count } = await service.from('generation_sessions')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());
if ((count ?? 0) > 30) throw new Response('Monthly limit reached', { status: 429 });
```

[CROSS-REF: testflight-architect] — surface as paywall upsell.

---

## 9. Ordered build plan

### Week 1 (Apr 21 – Apr 27) — Foundation

- Day 1–2: Supabase CLI init, fresh repo at `~/Projects/qook/`, `supabase start` running
- Day 1–2: `20260421000000_init_schema.sql` — tables, enums, indexes
- Day 2–3: `20260421000001_rls_policies.sql` — all RLS
- Day 3: `20260421000002_auth_triggers.sql` — profile auto-create
- Day 3: `20260421000003_storage_buckets.sql`
- Day 3–4: Apple Sign In dev keys, Expo `supabase.ts` wiring
- Day 4: Type gen pipeline `supabase gen types typescript`
- Day 4–5: Run `warm-start-upload-images.ts` — 24 images into `meal-images`
- Day 5: Seed 24 recipe rows via `warm-start-import`
- Day 5–7: CI/CD — GH Actions `supabase db push` + `supabase functions deploy` on main

**Exit:** Sign in, see empty grocery list, see 24 seed recipes with CDN images.

### Week 2 (Apr 28 – May 4) — AI pipeline

- Day 1–2: `_shared/openrouter.ts` + `_shared/supabase.ts` + `_shared/prompts.ts`
- Day 2–4: `generate-recipe` — plan slots, draft, polish, normalize, dedup
- Day 3–4: `generate-image` + PNG→WebP
- Day 4–5: Realtime wiring
- Day 5–6: `generate-deck-batch` + `pg_cron` schedule
- Day 6–7: End-to-end test — fresh user → deck gen → 12 recipes + images <90s

**Exit:** Full cohort deck generation runs end-to-end.

### Week 3 (May 5 – May 11) — App integration + polish

- Day 1–2: Grocery CRUD + recipe ingredient import
- Day 2–3: Weekly deck ingest — swipes update `liked`
- Day 3–4: Cookbook: `user_saved_recipes`, filter by energy tier / cuisine
- Day 4: User prefs screen writes
- Day 5–6: Rate limits + quota errors surfaced
- Day 6–7: Load test — 20 concurrent generations

**Exit:** Every screen reads/writes Supabase. Zero mock data left.

### Week 4 (May 12 – May 18) — TestFlight prep

- Day 1: Upgrade to Pro, verify backups
- Day 1–2: Sentry in edge funcs + Expo
- Day 2–3: Monitoring / `/health` function
- Day 3: Email templates, Apple prod keys
- Day 4–5: Synthetic load test — 100 concurrent
- Day 5–6: [CROSS-REF: testflight-architect] — TestFlight submit
- Day 7: buffer

### Week 5 (May 19 – May 24) — Ship

- Day 1–2: Monitor, hotfix loop
- Day 3–5: Migration fixes, RLS tightening
- Day 6: Public TestFlight

---

## 10. Open questions / risks

### Dependencies

- **[CROSS-REF: domain-architect]** — Lock recipe payload shape. Schema assumes `ingredient_groups` / `workflow_sections` / `timeline` jsonb shapes from `recipeNormalize.ts`.
- **[CROSS-REF: ai-architect]** — Prompt templates + signature hash algorithm. The `signature` unique constraint requires deterministic hashing.
- **[CROSS-REF: ai-architect]** — `planSlots` + `planCohortSlots` planner. Lives in a shared package since both edge funcs use it.
- **[CROSS-REF: frontend-architect]** — `@supabase/supabase-js` version + React Native integration (reanimated can conflict with realtime).
- **[CROSS-REF: testflight-architect]** — Paywall integration on quota error. RevenueCat vs server-validated receipt.

### Risks

1. **Edge Function cold starts** (~300ms). Negligible for `generate-recipe`, adds up in `generate-image` chains. Mitigation: warmer ping every 5min if latency becomes an issue.
2. **`pg_cron` + `pg_net` on Free tier.** Spotty. Wait for Pro upgrade.
3. **Realtime message cap.** 2M/mo on Free — 30K msgs/mo fits comfortably but monitor.
4. **Service role bypass of RLS.** Every edge function MUST call `requireUser` and scope queries by authed user_id explicitly, even with service role.
5. **Apple Sign In rejection.** Must surface name + email on first SIWA exactly per App Store rules; rehearse pre-submission.
6. **Jsonb shape drift.** Losing Convex's `v.any()` flexibility. Mitigation: every AI output passes through `normalizeRecipe` before insert; CHECK constraints are loose (array/object only) to avoid migration pain on tweaks.
7. **Storage CDN costs at scale.** Fine at 100 users, risky at 10K. Escape hatch: Cloudflare R2.
8. **`pg_cron` timezone.** `0 22 * * 6` = Saturday 22:00 UTC = Saturday 5pm ET → user sees deck Sunday morning.
9. **Migration rollback story.** Forward-only. Destructive migrations gated by full backup.
10. **OpenRouter rate limits.** Cohort batch uses serial slot generation (not parallel) to stay under ceiling.

---

## Summary (3 sentences)

- Consolidated the existing Convex schema into a stricter Postgres model with a single `recipes` table that serves both user-owned and globally-cached-by-signature rows, RLS policies scoped to `auth.uid()` per table, and Edge Functions as the only path to OpenRouter.
- AI pipeline is split: `generate-recipe` streams per-slot via Realtime for live personalized decks, `generate-deck-batch` cron writes 48 cohort recipes/week to both DB rows and CDN-fronted public Storage JSON, and `generate-image` writes WebP to the public `meal-images` bucket keyed by `recipe_id`.
- Build is 3 weeks on Supabase Free → 1 week TestFlight prep on Pro ($25/mo + ~$130/mo OpenRouter at 100-user scale), with the 24 existing Seedream PNGs imported once via a bundled `warm-start-import` function + local Sharp upload script.
