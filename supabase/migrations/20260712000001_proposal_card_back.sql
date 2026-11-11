-- Flippable info back on the swipe-deck card (2026-07-12).
-- proposal_ingredients / proposal_steps carry the phase-1 card-back teaser
-- written alongside the skeleton row (title + hook + protein estimate) by
-- generate-proposals: main ingredient names (no amounts) and a high-level
-- step outline. They are the card-back content while content_status is
-- 'proposal'. Filling the recipe (fill-recipe, phase-2) writes the real
-- ingredient_groups/workflow_sections columns but does NOT overwrite these —
-- they stay as the original teaser for provenance/fallback, superseded in
-- the UI by the real data once it exists.

alter table public.recipes
  add column proposal_ingredients text[],
  add column proposal_steps text[];
