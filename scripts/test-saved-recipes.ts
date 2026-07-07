// Throwaway assertion: toggleSavedRecipe adds then removes an id.
// Run: bun run scripts/test-saved-recipes.ts
import { useWeekPlan } from '../apps/native/src/stores/weekPlan';

// AsyncStorage is a no-op target under bun; persist writes reject with
// "window is not defined" after assertions pass. Ignore that noise so the
// exit code reflects the assertions only.
process.on('unhandledRejection', () => {});

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const { toggleSavedRecipe } = useWeekPlan.getState();

assert(useWeekPlan.getState().savedRecipeIds.length === 0, 'starts empty');

toggleSavedRecipe('recipe-abc');
assert(
  useWeekPlan.getState().savedRecipeIds.includes('recipe-abc'),
  'adds id on first toggle',
);

toggleSavedRecipe('recipe-abc');
assert(
  !useWeekPlan.getState().savedRecipeIds.includes('recipe-abc'),
  'removes id on second toggle',
);

console.log('PASS: saved-recipes toggle');
process.exit(0);
