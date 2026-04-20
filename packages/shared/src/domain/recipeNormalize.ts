// Ported from sashafood/packages/convex/convex/lib/recipeNormalize.ts.
// Input shape matches the current LLM prompt contract (ingredientGroups,
// workflowSections, totalTime string, serves); output is NormalizedRecipe
// which the server-side code hydrates into a full Recipe (id/slug/signature).

import type {
  IngredientGroup,
  RecipeSection,
  RecipeStep,
  RecipeTimelineItem,
  Ingredient,
} from '../types/recipe';
import type {
  EnergyTier,
  IngredientRole,
  RecipeDifficulty,
} from '../types/primitives';
import { deriveEnergyTier } from './energyTier';
import {
  listUnavailableToolsMentioned,
  normalizeDifficulty,
} from './recipeTaxonomy';

export interface NormalizedRecipe {
  title: string;
  cuisine: string;
  servings: number;
  timeMinutes: number;
  totalTimeLabel: string;
  difficulty: RecipeDifficulty;
  tier: EnergyTier;
  ingredients: IngredientGroup[];
  steps: RecipeSection[];
  timeline: RecipeTimelineItem[];
  notes?: string;
  source: 'ai' | 'fallback';
}

interface NormalizeOptions {
  enforceDinnerComposition?: boolean;
}

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeDishTitle(
  raw: unknown,
  cuisine: string,
  proteinFallback?: string
) {
  const text = cleanString(raw);
  const withoutPrefixes = text.replace(
    /^(bold|comfort|restaurant|quick|standard|elevated)\s+/i,
    ''
  );
  if (withoutPrefixes) return withoutPrefixes;
  const protein = cleanString(proteinFallback) || 'protein';
  return `${cuisine} ${protein} Dinner`;
}

function normalizeDishBlurb(raw: unknown, title: string, cuisine: string) {
  const text = cleanString(raw);
  const lower = text.toLowerCase();
  const looksLikeTip =
    lower.includes('tip') ||
    lower.includes('pro tip') ||
    lower.startsWith('use ') ||
    lower.startsWith('make sure') ||
    lower.startsWith('remember');
  if (text && !looksLikeTip) return text;
  return `${title} is a ${cuisine} dish built for bold flavor and a satisfying finish.`;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function parseIngredientGroups(value: unknown): IngredientGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((group, groupIndex) => {
      if (!group || typeof group !== 'object') return null;
      const current = group as Record<string, unknown>;
      const title = cleanString(current.title) || `Component ${groupIndex + 1}`;
      const roleText = cleanString(current.role).toLowerCase();
      const role: IngredientRole =
        roleText === 'main' ||
        roleText === 'side' ||
        roleText === 'sauce' ||
        roleText === 'garnish' ||
        roleText === 'other'
          ? roleText
          : 'other';
      const itemsRaw = Array.isArray(current.items) ? current.items : [];
      const items: Ingredient[] = itemsRaw
        .map((item): Ingredient | null => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          const itemText = cleanString(record.item);
          if (!itemText) return null;
          return {
            item: itemText,
            quantity: cleanString(record.quantity) || undefined,
            notes: cleanString(record.notes) || undefined,
          };
        })
        .filter((item): item is Ingredient => Boolean(item));
      if (!items.length) return null;
      return { title, role, items } satisfies IngredientGroup;
    })
    .filter((group): group is IngredientGroup => Boolean(group));
}

function parseWorkflowSections(value: unknown): RecipeSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((section, sectionIndex) => {
      if (!section || typeof section !== 'object') return null;
      const current = section as Record<string, unknown>;
      const title = cleanString(current.title) || `Section ${sectionIndex + 1}`;
      const objective =
        cleanString(current.objective) || `Complete ${title.toLowerCase()}.`;
      const stepsRaw = Array.isArray(current.steps) ? current.steps : [];
      const steps: RecipeStep[] = stepsRaw
        .map((step): RecipeStep | null => {
          if (!step || typeof step !== 'object') return null;
          const record = step as Record<string, unknown>;
          const instruction = cleanString(record.instruction);
          if (!instruction) return null;
          const parsedDuration = Number(record.durationMin);
          const durationMin =
            Number.isFinite(parsedDuration) && parsedDuration > 0
              ? Math.floor(parsedDuration)
              : 5;
          const requires = asStringArray(record.requires);
          const produces = asStringArray(record.produces);
          return {
            instruction,
            durationMin,
            requires: requires.length ? requires : undefined,
            produces: produces.length ? produces : undefined,
          };
        })
        .filter((step): step is RecipeStep => Boolean(step));
      if (!steps.length) return null;
      return { title, objective, steps } satisfies RecipeSection;
    })
    .filter((section): section is RecipeSection => Boolean(section));
}

function parseTimeline(value: unknown): RecipeTimelineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): RecipeTimelineItem | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const instruction = cleanString(record.instruction);
      const sectionTitle = cleanString(record.sectionTitle) || 'Steps';
      const atMin = Number(record.atMin);
      if (!instruction || !Number.isFinite(atMin) || atMin < 0) return null;
      return { atMin: Math.floor(atMin), instruction, sectionTitle };
    })
    .filter((item): item is RecipeTimelineItem => Boolean(item));
}

export function buildTimelineFromSections(
  sections: RecipeSection[]
): RecipeTimelineItem[] {
  let atMin = 0;
  const timeline: RecipeTimelineItem[] = [];
  for (const section of sections) {
    for (const step of section.steps) {
      timeline.push({
        atMin,
        instruction: step.instruction,
        sectionTitle: section.title,
      });
      atMin += step.durationMin;
    }
  }
  return timeline;
}

function estimateActiveMinutes(sections: RecipeSection[]) {
  let total = 0;
  for (const section of sections) {
    for (const step of section.steps) {
      total += step.durationMin;
    }
  }
  return Math.max(1, Math.floor(total));
}

function formatActiveTime(minutes: number) {
  if (minutes < 60) return `${minutes} min active`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hr active`;
  return `${hours} hr ${remaining} min active`;
}

function normalizeActiveTime(raw: unknown) {
  const text = cleanString(raw);
  if (!text) return undefined;
  const lower = text.toLowerCase();
  const hasUnits = /(\d+\s*(min|mins|minute|minutes|hr|hrs|hour|hours))/i.test(
    lower
  );
  if (!hasUnits) return undefined;
  if (lower.includes('active')) return text;
  return `${text} active`;
}

function estimateDifficultyFromSections(
  sections: RecipeSection[],
  activeMinutes: number
): RecipeDifficulty {
  const stepCount = sections.reduce(
    (sum, section) => sum + section.steps.length,
    0
  );
  const hasLongStep = sections.some((section) =>
    section.steps.some((step) => step.durationMin >= 20)
  );
  const hasCoordinationSignals = sections.some((section) =>
    section.steps.some((step) =>
      /while|meanwhile|at the same time|simultaneously/i.test(step.instruction)
    )
  );

  if (
    activeMinutes >= 55 ||
    stepCount >= 11 ||
    (hasCoordinationSignals && hasLongStep)
  ) {
    return 'Advanced';
  }
  if (activeMinutes >= 30 || stepCount >= 7 || hasCoordinationSignals) {
    return 'Medium';
  }
  return 'Easy';
}

const VEGETABLE_KEYWORDS = [
  'broccoli',
  'cauliflower',
  'asparagus',
  'zucchini',
  'squash',
  'carrot',
  'green bean',
  'snap pea',
  'pea',
  'spinach',
  'kale',
  'cabbage',
  'brussels',
  'bok choy',
  'bell pepper',
  'pepper',
  'onion',
  'tomato',
  'eggplant',
  'mushroom',
  'corn',
  'cucumber',
  'salad',
  'slaw',
  'vegetable',
  'veggie',
];

function containsVegetableSignal(text: string) {
  return VEGETABLE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasDinnerComposition(
  ingredients: IngredientGroup[],
  steps: RecipeSection[]
) {
  const hasMainGroup = ingredients.some((group) => group.role === 'main');
  const hasSideGroup = ingredients.some((group) => group.role === 'side');

  const groupText = ingredients
    .map(
      (group) =>
        `${group.title} ${group.items.map((item) => item.item).join(' ')}`.toLowerCase()
    )
    .join(' ');
  const stepText = steps
    .map(
      (section) =>
        `${section.title} ${section.objective} ${section.steps.map((step) => step.instruction).join(' ')}`.toLowerCase()
    )
    .join(' ');
  const hasVegetableComponent =
    containsVegetableSignal(groupText) || containsVegetableSignal(stepText);

  return hasMainGroup && hasSideGroup && hasVegetableComponent;
}

export function normalizeRecipeOption(
  recipe: Record<string, unknown>,
  source: 'ai' | 'fallback',
  selectedTools: string[],
  options?: NormalizeOptions
): NormalizedRecipe | null {
  const cuisine = cleanString(recipe.cuisine);
  const title = normalizeDishTitle(
    recipe.title,
    cuisine,
    recipe.protein as string | undefined
  );
  if (!title || !cuisine) return null;

  const ingredients = parseIngredientGroups(recipe.ingredientGroups);
  const steps = parseWorkflowSections(recipe.workflowSections);
  if (!ingredients.length || !steps.length) return null;
  if (
    options?.enforceDinnerComposition &&
    !hasDinnerComposition(ingredients, steps)
  ) {
    return null;
  }

  const fullText = JSON.stringify({ ingredients, steps }).toLowerCase();
  if (listUnavailableToolsMentioned(fullText, selectedTools).length > 0) {
    return null;
  }

  const rawTimeline = parseTimeline(recipe.timeline);
  const notes = normalizeDishBlurb(recipe.notes, title, cuisine);
  const activeMinutes = estimateActiveMinutes(steps);
  const totalTimeLabel =
    normalizeActiveTime(recipe.totalTime) ?? formatActiveTime(activeMinutes);
  const requestedDifficulty = cleanString(recipe.difficulty);
  const difficulty = requestedDifficulty
    ? normalizeDifficulty(requestedDifficulty)
    : estimateDifficultyFromSections(steps, activeMinutes);
  const tier = deriveEnergyTier(activeMinutes);
  const timeline = rawTimeline.length
    ? rawTimeline
    : buildTimelineFromSections(steps);

  return {
    title,
    cuisine,
    servings: Math.max(1, Math.floor(Number(recipe.serves) || 1)),
    timeMinutes: activeMinutes,
    totalTimeLabel,
    difficulty,
    tier,
    ingredients,
    steps,
    timeline,
    notes,
    source,
  };
}
