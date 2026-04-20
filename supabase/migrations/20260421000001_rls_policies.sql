-- ============================================================
-- Qook RLS policies
-- Source: docs/plan/section-backend.md §3
-- Principle: every client query scoped by auth.uid(); service role bypasses.
-- ============================================================

-- 3.1 Enable RLS everywhere

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

-- 3.2 profiles

create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- 3.3 user_preferences

create policy "read own prefs" on public.user_preferences for select using (auth.uid() = user_id);
create policy "upsert own prefs" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "update own prefs" on public.user_preferences for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3.4 recipes (dual ownership: user_id IS NULL = globally cached)

create policy "read own or global recipes" on public.recipes for select
  using ((user_id is null and auth.role() = 'authenticated') or user_id = auth.uid());
create policy "insert own recipes" on public.recipes for insert
  with check (user_id = auth.uid());
create policy "update own recipes" on public.recipes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own recipes" on public.recipes for delete using (user_id = auth.uid());

-- 3.5 user_saved_recipes

create policy "read own saves" on public.user_saved_recipes for select using (auth.uid() = user_id);
create policy "insert own saves" on public.user_saved_recipes for insert with check (auth.uid() = user_id);
create policy "delete own saves" on public.user_saved_recipes for delete using (auth.uid() = user_id);

-- 3.6 weekly_decks + deck_items

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

-- 3.7 cohort_decks (authenticated world-read; service-role-only writes)

create policy "read cohort decks" on public.cohort_decks for select
  using (auth.role() = 'authenticated');

-- 3.8 generation_sessions + generation_items

create policy "read own sessions" on public.generation_sessions for select using (auth.uid() = user_id);
create policy "insert own sessions" on public.generation_sessions for insert with check (auth.uid() = user_id);

create policy "read items in own sessions" on public.generation_items for select using (
  exists (select 1 from public.generation_sessions s where s.id = generation_items.session_id and s.user_id = auth.uid())
);

-- 3.9 grocery_items

create policy "read own grocery" on public.grocery_items for select using (auth.uid() = user_id);
create policy "insert own grocery" on public.grocery_items for insert with check (auth.uid() = user_id);
create policy "update own grocery" on public.grocery_items for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own grocery" on public.grocery_items for delete using (auth.uid() = user_id);
