-- Persist model-emitted tags and nutrition instead of dropping them
-- (Zach 2026-07-07: "as much data as we can track in an organized fashion").
-- tags: free-text model tags (client derives dietaryTags from the closed
-- union client-side). nutrition: the model's estimate object verbatim
-- ({calories, proteinG, carbG, fatG}, integers or null).

alter table public.recipes
  add column tags text[] not null default '{}',
  add column nutrition jsonb;
