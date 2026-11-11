-- Swipe deck / two-phase generation (2026-07-10).
-- content_status distinguishes fast skeleton "proposals" (title + hook +
-- protein estimate, image firing) from fully-written "full" recipes. Existing
-- rows are all fully-written, so the column defaults to 'full' and the NOT NULL
-- default backfills them. hook carries the one-line proposal teaser. Skeleton
-- rows are user_id-null global-cache rows and read under the existing RLS
-- policy — no policy change needed.

alter table public.recipes
  add column content_status text not null default 'full'
    check (content_status in ('full', 'proposal')),
  add column hook text,
  add column generation_error text;

-- Phase-1 exact-title cache shortcut queries global 'full' rows by title.
create index if not exists recipes_title_global_idx
  on public.recipes (title)
  where user_id is null and content_status = 'full';
