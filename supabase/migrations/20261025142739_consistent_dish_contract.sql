-- Public culinary identity only; private context/preferences remain on the
-- session-owned generation item. Null keeps existing recipes compatible.
alter table public.recipes
  add column dish_contract jsonb;

alter table public.recipes
  add constraint recipes_dish_contract_version_check
  check (
    dish_contract is null or coalesce(
      jsonb_typeof(dish_contract) = 'object'
      and dish_contract -> 'version' = '1'::jsonb,
      false
    )
  );

comment on column public.recipes.dish_contract is
  'Versioned public dish components and plating, fixed at proposal time and shared by recipe fill and image generation. No private dinner brief.';

-- Existing recipes RLS is unchanged. After applying locally, regenerate
-- packages/shared/src/database.ts to confirm its additive dish_contract fields.
