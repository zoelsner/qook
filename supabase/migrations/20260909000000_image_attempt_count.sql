-- Bound future paid image retries without changing recipe access or auth.
-- Historical attempt totals were not recorded. Existing non-pending rows get
-- a baseline of one, NOT an assertion that only one historical call occurred.
-- Existing failed rows therefore have at most two additional recorded claims.
alter table public.recipes
  add column image_attempt_count integer not null default 0
  check (image_attempt_count >= 0);

update public.recipes
set image_attempt_count = 1
where image_status in ('ready', 'generating', 'failed');
