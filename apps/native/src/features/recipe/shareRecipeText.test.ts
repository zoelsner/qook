import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';

import { recipeShareText } from './shareRecipeText';

const FULL_RECIPE = {
  title: 'Harissa Salmon with Blistered Peppers',
  cuisine: 'Middle Eastern',
  timeMinutes: 30,
  servings: 2,
  hook: 'Weeknight-fast, weekend-fancy.',
  ingredients: [
    {
      title: 'For the salmon',
      role: 'main',
      items: [
        { item: 'salmon fillets', quantity: '2' },
        { item: 'bell peppers, sliced', quantity: '2' },
      ],
    },
    {
      title: 'For the sauce',
      role: 'sauce',
      items: [{ item: 'harissa paste', quantity: '2 tbsp' }],
    },
  ],
  steps: [
    {
      title: 'Prep',
      objective: '',
      steps: [{ instruction: 'Slice the peppers.', durationMin: 5 }],
    },
    {
      title: 'Cook',
      objective: '',
      steps: [
        { instruction: 'Sear the salmon.', durationMin: 6 },
        { instruction: 'Blister the peppers.', durationMin: 8 },
      ],
    },
  ],
} as unknown as Recipe;

const PROPOSAL_RECIPE = {
  title: 'Mystery Noodles',
  cuisine: 'Japanese',
  timeMinutes: 20,
  servings: 4,
  ingredients: [],
  steps: [],
} as unknown as Recipe;

describe('recipeShareText', () => {
  test('renders a full recipe with title, meta, quantified ingredient, numbered steps, footer', () => {
    const text = recipeShareText(FULL_RECIPE);

    expect(text.includes('Harissa Salmon with Blistered Peppers')).toBe(true);
    expect(text.includes('Middle Eastern · 30 min · serves 2')).toBe(true);
    expect(text.includes('- 2 salmon fillets')).toBe(true);
    expect(text.includes('1. Slice the peppers.')).toBe(true);
    expect(text.includes('3. Blister the peppers.')).toBe(true);
    expect(text.includes('— made with Qook')).toBe(true);
  });

  test('proposal skeleton renders only title/meta/footer, no INGREDIENTS or THE PLAN', () => {
    const text = recipeShareText(PROPOSAL_RECIPE);

    expect(text.includes('Mystery Noodles')).toBe(true);
    expect(text.includes('Japanese · 20 min · serves 4')).toBe(true);
    expect(text.includes('— made with Qook')).toBe(true);
    expect(text.includes('INGREDIENTS')).toBe(false);
    expect(text.includes('THE PLAN')).toBe(false);
  });

  test('multi-group ingredient titles appear uppercased', () => {
    const text = recipeShareText(FULL_RECIPE);

    expect(text.includes('FOR THE SALMON')).toBe(true);
    expect(text.includes('FOR THE SAUCE')).toBe(true);
  });
});
