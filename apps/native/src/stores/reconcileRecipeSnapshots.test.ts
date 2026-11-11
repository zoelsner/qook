import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import { reconcileRecipeSnapshots } from './reconcileRecipeSnapshots';
import { aggregateIngredients } from '../features/shop/aggregateIngredients';
import { recipeForServings } from '../lib/scaleQuantity';

const TODAY = '2026-09-09';
const proposal = { id: 'proposal', title: 'Turkey tostadas', ingredients: [] } as unknown as Recipe;
const full = {
  ...proposal,
  contentStatus: 'full',
  ingredients: [{ title: 'main', items: [{ item: 'ground turkey', quantity: '8 oz' }] }],
} as Recipe;

describe('late recipe fill reconciliation', () => {
  test('a cache redirect keeps the latest staged portions once after clearing the plan', () => {
    const target = { ...full, id: 'cached-full', servings: 2 };
    const state = {
      plan: { [TODAY]: { recipes: [proposal], pickIndex: 0 } },
      shopStaging: [
        { recipe: proposal, stagedAt: TODAY, servings: 3 },
        { recipe: target, stagedAt: TODAY, servings: 4 },
      ],
    };
    const updated = reconcileRecipeSnapshots(state, proposal.id, target);
    expect(updated.shopStaging).toEqual([{ recipe: target, stagedAt: TODAY, servings: 4 }]);
    const staged = updated.shopStaging.map((entry) => recipeForServings(entry.recipe, entry.servings));
    const groceries = aggregateIngredients({}, TODAY, staged);
    expect(groceries[0].recipeCount).toBe(1);
    expect(groceries[0].quantities).toEqual(['16 oz']);
  });
  test('a refetch preserves staged servings and scales the refreshed base once', () => {
    const base = { ...full, servings: 2 };
    const state = {
      plan: { [TODAY]: { recipes: [base], pickIndex: 0 } },
      shopStaging: [{ recipe: base, stagedAt: TODAY, servings: 3 }],
    };
    const refreshed = { ...base, title: 'Fresh turkey tostadas' };
    const updated = reconcileRecipeSnapshots(state, base.id, refreshed);
    expect(updated.shopStaging[0].servings).toBe(3);
    const restored = JSON.parse(JSON.stringify(updated.shopStaging[0]));
    const scaled = recipeForServings(restored.recipe, restored.servings);
    expect(aggregateIngredients(updated.plan, TODAY, [scaled])[0].quantities).toEqual(['12 oz']);
    expect(updated.shopStaging[0].recipe.ingredients[0].items[0].quantity).toBe('8 oz');
  });
  test('sequential cache redirects preserve the latest staging order and portions', () => {
    const secondProposal = { ...proposal, id: 'second-proposal' };
    const target = { ...full, id: 'cached-full', servings: 2 };
    const state = {
      plan: {},
      shopStaging: [
        { recipe: proposal, stagedAt: TODAY, servings: 3 },
        { recipe: secondProposal, stagedAt: TODAY, servings: 4 },
        { recipe: target, stagedAt: TODAY, servings: 6 },
      ],
    };
    const first = reconcileRecipeSnapshots(state, proposal.id, target);
    expect(first.shopStaging.map((entry) => entry.recipe.id)).toEqual(['second-proposal', 'cached-full']);
    const second = reconcileRecipeSnapshots(first, secondProposal.id, target);
    expect(second.shopStaging).toEqual([{ recipe: target, stagedAt: TODAY, servings: 6 }]);
  });
  test('a fill after placement populates Shop without reselecting the meal', () => {
    const state = { plan: { [TODAY]: { recipes: [proposal], pickIndex: 0, selectedAt: 'earlier' } }, shopStaging: [] };
    expect(aggregateIngredients(state.plan, TODAY).length).toBe(0);
    const updated = reconcileRecipeSnapshots(state, proposal.id, full);
    expect(aggregateIngredients(updated.plan, TODAY)[0].name).toBe('ground turkey');
    expect(updated.plan[TODAY].selectedAt).toBe('earlier');
    expect(updated.plan[TODAY].pickIndex).toBe(0);
  });

  test('cache-hit redirects update staged and planned snapshots without stealing a different pick', () => {
    const other = { ...full, id: 'other' };
    const state = {
      plan: { [TODAY]: { recipes: [proposal, other], pickIndex: 1, cookedAt: 'earlier' } },
      shopStaging: [{ recipe: proposal, stagedAt: TODAY }],
    };
    const redirected = { ...full, id: 'cached-full' };
    const updated = reconcileRecipeSnapshots(state, proposal.id, redirected);
    expect(updated.plan[TODAY].recipes[0].id).toBe('cached-full');
    expect(updated.plan[TODAY].recipes[1]).toBe(other);
    expect(updated.plan[TODAY].pickIndex).toBe(1);
    expect(updated.plan[TODAY].cookedAt).toBe('earlier');
    expect(updated.shopStaging[0].recipe).toBe(redirected);
    expect(updated.shopStaging[0].stagedAt).toBe(TODAY);
  });

  test('reading an unrelated or already-current recipe is a no-op', () => {
    const state = { plan: { [TODAY]: { recipes: [full] } }, shopStaging: [] };
    expect(reconcileRecipeSnapshots(state, full.id, full)).toBe(state);
    expect(reconcileRecipeSnapshots(state, 'unrelated', { ...full, id: 'unrelated' })).toBe(state);
  });
});
