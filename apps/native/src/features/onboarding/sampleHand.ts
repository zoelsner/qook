import type { Recipe } from '@qook/shared';
import { mockRecipes } from '../../services/fixtures/recipes';

// The signed-out sample hand: bundled recipes with bundled art, so showing it
// never touches the network. Picked to differ from the onboarding taste grid,
// span energy tiers, include two vegetarian dishes, and skip pork/shellfish.
const SAMPLE_IDS = ['rec_024', 'rec_019', 'rec_015', 'rec_003', 'rec_002'];

export const SAMPLE_HAND: Recipe[] = SAMPLE_IDS.map((id) => {
  const recipe = mockRecipes.find((r) => r.id === id);
  if (!recipe) throw new Error(`sample recipe ${id} missing from fixtures`);
  return recipe;
});
