import type { Recipe } from '@qook/shared';

function metaLine(recipe: Recipe): string {
  const segments = [
    recipe.cuisine,
    recipe.timeMinutes ? `${recipe.timeMinutes} min` : null,
    recipe.servings ? `serves ${recipe.servings}` : null,
  ].filter((segment): segment is string => Boolean(segment));
  return segments.join(' · ');
}

function ingredientsBlock(recipe: Recipe): string | null {
  const groups = recipe.ingredients ?? [];
  const showGroupTitles = groups.length > 1;
  const lines: string[] = [];

  for (const group of groups) {
    const itemLines = (group.items ?? [])
      .filter((ingredient) => ingredient.item?.trim())
      .map((ingredient) => {
        const quantity = ingredient.quantity?.trim();
        const item = ingredient.item.trim();
        return `- ${quantity ? `${quantity} ${item}` : item}`;
      });

    if (itemLines.length === 0) continue;

    if (showGroupTitles && group.title?.trim()) {
      lines.push(group.title.trim().toUpperCase());
    }
    lines.push(...itemLines);
  }

  if (lines.length === 0) return null;
  return ['INGREDIENTS', ...lines].join('\n');
}

function stepsBlock(recipe: Recipe): string | null {
  const sections = recipe.steps ?? [];
  const showSectionTitles = sections.length > 1;
  const lines: string[] = [];
  let stepNumber = 1;

  for (const section of sections) {
    const steps = section.steps ?? [];
    if (steps.length === 0) continue;

    if (showSectionTitles && section.title?.trim()) {
      lines.push(section.title.trim().toUpperCase());
    }
    for (const step of steps) {
      lines.push(`${stepNumber}. ${step.instruction.trim()}`);
      stepNumber += 1;
    }
  }

  if (lines.length === 0) return null;
  return ['THE PLAN', ...lines].join('\n');
}

export function recipeShareText(recipe: Recipe): string {
  const header = [recipe.title.trim()];

  const meta = metaLine(recipe);
  if (meta) header.push(meta);

  if (recipe.hook?.trim()) header.push(recipe.hook.trim());

  const blocks: string[] = [header.join('\n')];

  const ingredients = ingredientsBlock(recipe);
  if (ingredients) blocks.push(ingredients);

  const steps = stepsBlock(recipe);
  if (steps) blocks.push(steps);

  blocks.push('— made with Qook');

  return blocks.join('\n\n');
}
