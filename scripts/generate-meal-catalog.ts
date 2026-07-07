#!/usr/bin/env bun
/**
 * Generates docs/meals/catalog.html from the 24-recipe mock library.
 *
 * Usage:
 *   bun scripts/generate-meal-catalog.ts
 *
 * Then (optional, requires Chrome):
 *   bun scripts/generate-meal-catalog.ts --pdf
 */

import { mockRecipes } from '../apps/native/src/services/fixtures/recipes';
import type { EnergyTier, Recipe } from '@qook/shared';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const OUT_DIR = resolve(import.meta.dir, '../docs/meals');
const OUT_HTML = resolve(OUT_DIR, 'catalog.html');
const OUT_PDF = resolve(OUT_DIR, 'catalog.pdf');
const IMAGE_DIR_REL = '../../apps/native/assets/meals-seed/v2';

const TIER_ORDER: EnergyTier[] = [
  'brain-is-fried',
  'after-work',
  'got-energy',
  'weekend-project',
];

const TIER_LABEL: Record<EnergyTier, string> = {
  'brain-is-fried': '≤ 15 min — brain is fried',
  'after-work': '≤ 30 min — after work',
  'got-energy': '≤ 45 min — got energy',
  'weekend-project': '60+ min — weekend project',
};

const TIER_COLOR: Record<EnergyTier, string> = {
  'brain-is-fried': '#3D5469', // prussian
  'after-work': '#C36A48', // rust
  'got-energy': '#7A8568', // sage
  'weekend-project': '#2A3A26', // forest
};

function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function imageFor(recipe: Recipe): string {
  const key = recipe.localImageKey ?? 'miso-salmon';
  return `${IMAGE_DIR_REL}/${key}.png`;
}

function renderMatrix(recipes: Recipe[]): string {
  // Rows = cuisines (sorted), Cols = tiers
  const cuisines = Array.from(new Set(recipes.map((r) => r.cuisine))).sort();

  const cell = (tier: EnergyTier, cuisine: string): string => {
    const matches = recipes.filter(
      (r) => r.tier === tier && r.cuisine === cuisine,
    );
    if (matches.length === 0) return '<td class="matrix-cell empty"></td>';
    const titles = matches
      .map((m) => `<div class="matrix-title">${escape(m.title)}</div>`)
      .join('');
    return `<td class="matrix-cell filled">${titles}</td>`;
  };

  const rows = cuisines
    .map(
      (cuisine) =>
        `<tr><th class="matrix-cuisine">${escape(cuisine)}</th>${TIER_ORDER.map((t) => cell(t, cuisine)).join('')}</tr>`,
    )
    .join('');

  const headerCols = TIER_ORDER.map(
    (t) =>
      `<th class="matrix-tier" style="--tier-color: ${TIER_COLOR[t]}"><div class="matrix-tier-dot"></div>${escape(TIER_LABEL[t])}</th>`,
  ).join('');

  return `
    <section class="matrix-section">
      <h2>Tier × cuisine matrix</h2>
      <p class="subcopy">Where every recipe lives in the grid. Gaps are gaps — "got-energy Turkish" is a blank we could fill later.</p>
      <div class="matrix-wrap">
        <table class="matrix">
          <thead>
            <tr><th></th>${headerCols}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRecipe(recipe: Recipe): string {
  const mainIngredients = recipe.ingredients
    .map(
      (group) =>
        `<div class="ingr-group">
           <div class="ingr-group-title">${escape(group.title)}</div>
           <ul class="ingr-list">
             ${group.items
               .map(
                 (i) =>
                   `<li><span class="ingr-item">${escape(i.item)}</span>${i.quantity ? `<span class="ingr-qty">${escape(i.quantity)}</span>` : ''}</li>`,
               )
               .join('')}
           </ul>
         </div>`,
    )
    .join('');

  const stepTitles = recipe.steps
    .map(
      (s, idx) =>
        `<li><span class="step-num">${idx + 1}.</span> <span class="step-title">${escape(s.title)}</span> <span class="step-obj">${escape(s.objective)}</span></li>`,
    )
    .join('');

  const tags = (recipe.tags ?? [])
    .concat(recipe.dietaryTags ?? [])
    .map((t) => `<span class="tag">${escape(t)}</span>`)
    .join('');

  const proteinHint = recipe.nutritionalEstimate?.proteinG
    ? `<span class="meta-chip"><strong>${recipe.nutritionalEstimate.proteinG}g</strong> protein</span>`
    : '';

  return `
    <article class="recipe" data-tier="${recipe.tier}" data-cuisine="${escape(recipe.cuisine)}">
      <div class="recipe-media">
        <img src="${imageFor(recipe)}" alt="${escape(recipe.title)}" loading="lazy" />
      </div>
      <div class="recipe-body">
        <div class="recipe-kicker">
          <span class="tier-dot" style="background: ${TIER_COLOR[recipe.tier]}"></span>
          <span class="kicker-text">${escape(TIER_LABEL[recipe.tier])}</span>
        </div>
        <h3 class="recipe-title">${escape(recipe.title)}</h3>
        <div class="recipe-meta">
          <span class="meta-chip">${escape(recipe.cuisine)}</span>
          <span class="meta-chip"><strong>${recipe.timeMinutes}</strong> min</span>
          <span class="meta-chip">serves <strong>${recipe.servings}</strong></span>
          <span class="meta-chip">${escape(recipe.difficulty)}</span>
          ${proteinHint}
        </div>
        ${recipe.notes ? `<p class="recipe-notes">${escape(recipe.notes)}</p>` : ''}
        <div class="recipe-ingredients">
          ${mainIngredients}
        </div>
        <div class="recipe-steps">
          <div class="steps-title">Flow</div>
          <ol class="steps-list">${stepTitles}</ol>
        </div>
        ${tags ? `<div class="recipe-tags">${tags}</div>` : ''}
      </div>
    </article>
  `;
}

function renderTierSection(tier: EnergyTier, recipes: Recipe[]): string {
  const inTier = recipes.filter((r) => r.tier === tier);
  if (inTier.length === 0) return '';
  const cuisines = Array.from(new Set(inTier.map((r) => r.cuisine))).sort();
  return `
    <section class="tier-section" id="tier-${tier}">
      <header class="tier-header" style="--tier-color: ${TIER_COLOR[tier]}">
        <h2>${escape(TIER_LABEL[tier])}</h2>
        <div class="tier-meta">
          <span>${inTier.length} recipes</span>
          <span>${cuisines.length} cuisines</span>
        </div>
      </header>
      <div class="tier-grid">
        ${inTier.map(renderRecipe).join('')}
      </div>
    </section>
  `;
}

function renderHtml(recipes: Recipe[]): string {
  const totalCuisines = new Set(recipes.map((r) => r.cuisine)).size;
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Qook meal catalog — ${recipes.length} recipes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root {
    --cream: #FCF9F1;
    --surface: #FEFBF3;
    --ink: #26241C;
    --text: #26241C;
    --text-sec: #5A5846;
    --text-ter: #8A8875;
    --forest: #2A3A26;
    --rust: #C36A48;
    --prussian: #3D5469;
    --halo: rgba(42, 58, 38, 0.08);
    --border: rgba(42, 58, 38, 0.12);
    --paper: rgba(42, 58, 38, 0.04);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--cream);
    color: var(--text);
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 48px 32px 96px;
  }
  header.top {
    border-bottom: 1px solid var(--border);
    padding-bottom: 32px;
    margin-bottom: 48px;
  }
  .top-kicker {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.14em;
    color: var(--rust);
    text-transform: uppercase;
  }
  .top-title {
    font-family: 'Fraunces', serif;
    font-weight: 700;
    font-size: 64px;
    letter-spacing: -0.02em;
    line-height: 1.02;
    margin: 8px 0 4px;
    color: var(--forest);
  }
  .top-title em {
    font-style: italic;
    font-weight: 500;
    color: var(--rust);
  }
  .top-sub {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    font-size: 18px;
    color: var(--text-sec);
    margin: 8px 0 24px;
  }
  .top-stats {
    display: flex;
    gap: 32px;
    flex-wrap: wrap;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--text-sec);
    text-transform: uppercase;
  }
  .top-stats strong {
    font-family: 'Fraunces', serif;
    font-weight: 700;
    font-size: 24px;
    color: var(--forest);
    display: block;
    margin-bottom: 2px;
    letter-spacing: -0.01em;
  }
  h2 {
    font-family: 'Fraunces', serif;
    font-weight: 700;
    font-size: 32px;
    letter-spacing: -0.015em;
    color: var(--forest);
    margin: 0 0 8px;
  }
  .subcopy {
    color: var(--text-sec);
    margin: 0 0 24px;
    font-size: 14px;
  }

  /* Matrix */
  .matrix-section { margin-bottom: 64px; }
  .matrix-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px;
    overflow-x: auto;
  }
  .matrix {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .matrix th, .matrix td {
    text-align: left;
    padding: 12px 10px;
    vertical-align: top;
  }
  .matrix-tier {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--text);
    text-transform: uppercase;
    border-bottom: 2px solid var(--tier-color, var(--forest));
    white-space: nowrap;
  }
  .matrix-tier-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--tier-color);
    margin-right: 6px;
    vertical-align: middle;
  }
  .matrix-cuisine {
    font-family: 'Fraunces', serif;
    font-weight: 700;
    font-size: 14px;
    color: var(--forest);
    border-right: 1px solid var(--border);
    white-space: nowrap;
    padding-right: 16px;
  }
  .matrix-cell {
    border-top: 1px solid var(--border);
    border-left: 1px solid var(--border);
    min-width: 160px;
  }
  .matrix-cell.empty {
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 6px,
      rgba(42, 58, 38, 0.03) 6px,
      rgba(42, 58, 38, 0.03) 7px
    );
  }
  .matrix-title {
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    font-size: 12px;
    line-height: 1.35;
    color: var(--text);
    padding: 2px 0;
  }

  /* Tier section */
  .tier-section { margin-bottom: 64px; }
  .tier-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 2px solid var(--tier-color);
    padding-bottom: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .tier-meta {
    display: flex;
    gap: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--text-sec);
    text-transform: uppercase;
  }
  .tier-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 32px;
  }

  /* Recipe card */
  .recipe {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    break-inside: avoid;
  }
  .recipe-media {
    background: var(--paper);
    aspect-ratio: 4 / 3;
    overflow: hidden;
  }
  .recipe-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .recipe-body { padding: 20px 20px 24px; }
  .recipe-kicker {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--text-sec);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .tier-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .recipe-title {
    font-family: 'Fraunces', serif;
    font-weight: 700;
    font-size: 24px;
    letter-spacing: -0.015em;
    line-height: 1.1;
    margin: 0 0 10px;
    color: var(--forest);
  }
  .recipe-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }
  .meta-chip {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--paper);
    color: var(--text-sec);
    border: 1px solid var(--border);
  }
  .meta-chip strong {
    color: var(--forest);
    font-weight: 600;
  }
  .recipe-notes {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-sec);
    margin: 0 0 16px;
    padding-left: 10px;
    border-left: 2px solid var(--rust);
  }
  .recipe-ingredients {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
  }
  .ingr-group-title {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 9px;
    letter-spacing: 0.14em;
    color: var(--rust);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .ingr-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 3px;
  }
  .ingr-list li {
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
    border-bottom: 1px dotted var(--halo);
  }
  .ingr-item { color: var(--text); }
  .ingr-qty {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-ter);
    white-space: nowrap;
  }
  .recipe-steps { margin-bottom: 12px; }
  .steps-title {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 9px;
    letter-spacing: 0.14em;
    color: var(--rust);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .steps-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 4px;
    counter-reset: step;
  }
  .steps-list li {
    font-size: 12px;
    line-height: 1.35;
    color: var(--text);
  }
  .step-num {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    color: var(--rust);
  }
  .step-title {
    font-weight: 600;
  }
  .step-obj {
    color: var(--text-sec);
    font-style: italic;
  }
  .recipe-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--halo);
  }
  .tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.08em;
    color: var(--text-ter);
    text-transform: uppercase;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 3px;
  }

  footer {
    margin-top: 64px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-ter);
    text-transform: uppercase;
  }

  @media print {
    body { background: white; }
    .page { padding: 24px; max-width: none; }
    .tier-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
    .recipe { box-shadow: none; break-inside: avoid; }
    .matrix-wrap { overflow-x: visible; }
    .top-title { font-size: 48px; }
  }
</style>
</head>
<body>
<div class="page">
  <header class="top">
    <div class="top-kicker">Qook · mock library · v1</div>
    <h1 class="top-title">Tonight's <em>rotation</em></h1>
    <p class="top-sub">All ${recipes.length} recipes the mock mode cycles through, grouped by tier and cuisine. Compiled ${dateStr}.</p>
    <div class="top-stats">
      <span><strong>${recipes.length}</strong>recipes</span>
      <span><strong>${totalCuisines}</strong>cuisines</span>
      <span><strong>${TIER_ORDER.length}</strong>energy tiers</span>
      <span><strong>${recipes.reduce((a, r) => a + r.ingredients.reduce((b, g) => b + g.items.length, 0), 0)}</strong>total ingredient lines</span>
    </div>
  </header>

  ${renderMatrix(recipes)}
  ${TIER_ORDER.map((t) => renderTierSection(t, recipes)).join('')}

  <footer>
    Generated from <code>apps/native/src/services/fixtures/recipes.ts</code> · regenerate with <code>bun scripts/generate-meal-catalog.ts</code>
  </footer>
</div>
</body>
</html>`;
}

// --- run ---

mkdirSync(OUT_DIR, { recursive: true });

const sorted = [...mockRecipes].sort((a, b) => {
  const ta = TIER_ORDER.indexOf(a.tier);
  const tb = TIER_ORDER.indexOf(b.tier);
  if (ta !== tb) return ta - tb;
  return a.cuisine.localeCompare(b.cuisine);
});

const html = renderHtml(sorted);
writeFileSync(OUT_HTML, html, 'utf-8');
console.log(`✓ wrote ${OUT_HTML} (${(html.length / 1024).toFixed(1)}KB, ${sorted.length} recipes)`);

if (process.argv.includes('--pdf')) {
  console.log('Generating PDF via Chrome headless...');
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  const chrome = chromePaths.find((p) => {
    try {
      const r = spawnSync(p, ['--version']);
      return r.status === 0;
    } catch {
      return false;
    }
  });
  if (!chrome) {
    console.error('! No Chrome-like browser found; skipping PDF. HTML is still at', OUT_HTML);
    process.exit(0);
  }
  const result = spawnSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--print-to-pdf=' + OUT_PDF,
      '--print-to-pdf-no-header',
      'file://' + OUT_HTML,
    ],
    { stdio: 'inherit' },
  );
  if (result.status === 0) {
    console.log(`✓ wrote ${OUT_PDF}`);
  } else {
    console.error('! PDF generation failed (exit', result.status, ')');
  }
}
