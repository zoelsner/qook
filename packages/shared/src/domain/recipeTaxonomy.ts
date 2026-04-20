// Ported from sashafood/packages/convex/convex/lib/recipeTaxonomy.ts
// Types moved to ../types/primitives for cross-package reuse.

import type { RecipeDifficulty } from '../types/primitives';

export const DIFFICULTY_VALUES = ['Easy', 'Medium', 'Advanced'] as const;

export type FlavorMode = 'comfort' | 'bold' | 'restaurant';
export type EffortMode = 'quick' | 'standard' | 'elevated';

export const COMMON_KITCHEN_BASELINE = [
  'knife',
  'cutting board',
  'pot',
  'pan',
  'oven',
  'stovetop',
] as const;

export const CUISINE_TO_PROTEINS: Record<string, string[]> = {
  American: ['Chicken', 'Beef', 'Pork', 'Turkey', 'Shrimp'],
  'Southern / Soul Food': ['Chicken', 'Pork', 'Turkey', 'Shrimp'],
  BBQ: ['Beef', 'Pork', 'Chicken'],
  'Cajun / Creole': ['Shrimp', 'Chicken', 'Sausage'],
  Hawaiian: ['Chicken', 'Pork', 'Shrimp'],
  Mexican: ['Chicken', 'Beef', 'Pork', 'Shrimp'],
  'Tex-Mex': ['Chicken', 'Beef', 'Pork'],
  Cuban: ['Pork', 'Chicken', 'Beef'],
  Brazilian: ['Beef', 'Chicken', 'Pork'],
  Argentinian: ['Beef', 'Chicken', 'Pork'],
  Caribbean: ['Chicken', 'Shrimp', 'Pork', 'Fish'],
  Italian: ['Chicken', 'Beef', 'Pork', 'Shrimp'],
  'Italian-American': ['Chicken', 'Beef', 'Pork', 'Shrimp'],
  French: ['Chicken', 'Beef', 'Pork', 'Fish'],
  Spanish: ['Chicken', 'Pork', 'Shrimp', 'Fish'],
  Greek: ['Chicken', 'Lamb', 'Fish', 'Shrimp'],
  German: ['Pork', 'Beef', 'Chicken'],
  'Eastern European': ['Pork', 'Beef', 'Chicken'],
  Chinese: ['Chicken', 'Pork', 'Beef', 'Shrimp', 'Tofu'],
  'Chinese-American': ['Chicken', 'Pork', 'Beef', 'Shrimp', 'Tofu'],
  Japanese: ['Fish', 'Shrimp', 'Chicken', 'Tofu'],
  Korean: ['Beef', 'Pork', 'Chicken', 'Tofu'],
  Thai: ['Chicken', 'Shrimp', 'Pork', 'Tofu'],
  Vietnamese: ['Chicken', 'Beef', 'Shrimp', 'Tofu'],
  Filipino: ['Chicken', 'Pork', 'Shrimp', 'Beef'],
  Indian: ['Chicken', 'Lamb', 'Shrimp', 'Paneer', 'Tofu'],
  Mediterranean: ['Chicken', 'Fish', 'Shrimp', 'Lamb'],
  'Middle Eastern': ['Chicken', 'Lamb', 'Beef', 'Fish'],
  Turkish: ['Lamb', 'Chicken', 'Beef', 'Fish'],
  Lebanese: ['Chicken', 'Lamb', 'Beef', 'Fish'],
  Israeli: ['Chicken', 'Fish', 'Lamb', 'Tofu'],
};

export const CUISINE_TO_TOP_LEVEL_GROUP: Record<string, string> = {
  American: 'American & Regional',
  'Southern / Soul Food': 'American & Regional',
  BBQ: 'American & Regional',
  'Cajun / Creole': 'American & Regional',
  Hawaiian: 'American & Regional',
  Mexican: 'Latin & Mexican',
  'Tex-Mex': 'Latin & Mexican',
  Cuban: 'Latin & Mexican',
  Brazilian: 'Latin & Mexican',
  Argentinian: 'Latin & Mexican',
  Caribbean: 'Latin & Mexican',
  Italian: 'European',
  'Italian-American': 'European',
  French: 'European',
  Spanish: 'European',
  Greek: 'European',
  German: 'European',
  'Eastern European': 'European',
  Chinese: 'Asian',
  'Chinese-American': 'Asian',
  Japanese: 'Asian',
  Korean: 'Asian',
  Thai: 'Asian',
  Vietnamese: 'Asian',
  Filipino: 'Asian',
  Indian: 'Asian',
  Mediterranean: 'Mediterranean & Middle Eastern',
  'Middle Eastern': 'Mediterranean & Middle Eastern',
  Turkish: 'Mediterranean & Middle Eastern',
  Lebanese: 'Mediterranean & Middle Eastern',
  Israeli: 'Mediterranean & Middle Eastern',
};

const CUISINE_REQUIRED_TOOLS: Record<string, string[]> = {
  BBQ: ['Grill', 'Smoker'],
};

const TOOL_ALIASES: Record<string, string[]> = {
  grill: ['grill'],
  smoker: ['smoker'],
  wok: ['wok'],
  'air fryer': ['air fryer'],
  'deep fryer': ['deep fryer'],
  'rice cooker': ['rice cooker'],
  'slow cooker': ['slow cooker'],
  'instant pot': ['instant pot'],
  'sous vide': ['sous vide'],
  blender: ['blender', 'immersion blender'],
  'food processor': ['food processor'],
  'pizza oven': ['pizza oven'],
  steamer: ['steamer'],
  'dutch oven': ['dutch oven'],
};

export function normalizeDifficulty(input: unknown): RecipeDifficulty {
  const text = String(input ?? '').trim().toLowerCase();
  if (text === 'easy') return 'Easy';
  if (text === 'medium') return 'Medium';
  if (text === 'advanced' || text === 'hard') return 'Advanced';
  return 'Medium';
}

export function cuisineRequiresAvailableTools(
  cuisine: string,
  selectedTools: string[]
) {
  const required = CUISINE_REQUIRED_TOOLS[cuisine] ?? [];
  if (!required.length || selectedTools.length === 0) return true;
  const lower = new Set(selectedTools.map((tool) => tool.toLowerCase()));
  return required.some((tool) => lower.has(tool.toLowerCase()));
}

export function listUnavailableToolsMentioned(
  text: string,
  selectedTools: string[]
) {
  if (!selectedTools.length) return [];
  const selected = new Set(selectedTools.map((tool) => tool.toLowerCase()));
  const lowerText = text.toLowerCase();
  const blocked: string[] = [];
  for (const [canonical, aliases] of Object.entries(TOOL_ALIASES)) {
    if (
      aliases.some((alias) => lowerText.includes(alias)) &&
      !selected.has(canonical)
    ) {
      blocked.push(canonical);
    }
  }
  return blocked;
}

export function normalizeProteinName(value: string) {
  const text = value.trim();
  if (!text) return text;
  return text
    .split(/\s+/)
    .map(
      (segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    )
    .join(' ');
}
