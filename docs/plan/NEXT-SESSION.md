# Next session plan — backend, Instacart, protein UI, cleanup

**Written:** 2026-04-23
**Context:** 24-recipe mock library + Paper-faithful Tonight shipped. CLAUDE.md refreshed. Two commits on main (`8083ca8`, `1691034`). Now stepping back for the next coherent push.

This captures what's next as one tight plan instead of eight separate threads. Each section has a deliverable, a checkpoint, and an explicit order.

---

## 1. Instacart pressure test + better handoff

**State today (verified by audit 2026-04-23):**
- `apps/native/src/lib/shoppingShare.ts` → `openInstacart()` is a public-URL search link: `https://www.instacart.com/store/s?k={comma-joined-items}`. No real cart prefill.
- Comment in the file: "Real cart prefill needs the Connect Platform API (v1.1 gate)."
- Shop screen's `ShopDock` (`ShopScreen.tsx:340`) renders "Shop with Instacart" alongside Copy / Share / AmazonFresh.
- No API key, no token, no cart ID — all client-side URL encoding.

**Edge cases to pressure-test (in priority order):**

1. **Empty cart** — no unchecked items. Button should either (a) be disabled or (b) open a generic search. Today: `openInstacart([])` opens `?k=` which may misbehave.
2. **Long ingredient list** — 40+ items. Instacart URL length limit is ~2KB. Truncate intelligently; never silently drop.
3. **Special-character items** — parentheses in quantity ("2 cans (15 oz)"), ampersands, em-dashes. URL-encode correctly. Audit `encodeURIComponent` coverage.
4. **Duplicate items across recipes** — "garlic" appears in 8 recipes. Pass to Instacart once with aggregated quantity, not 8 times. `aggregateIngredients` already dedupes, but `openInstacart` takes the aggregated list — verify the integration.
5. **Ambiguous items** — "olive oil" vs "extra-virgin olive oil". Today we pass verbatim. Acceptable; Instacart search handles it.
6. **Quantity semantics** — Instacart search ignores quantity in the `k=` query. We lose "2 lb chicken" and just search "chicken". Document as known limitation; real fix is Connect Platform API.
7. **Device failure modes** — user has no Instacart app; link falls back to Safari. Test that fallback gracefully.

**Actions:**
- [ ] Write `shoppingShare.test.ts` covering the 7 edge cases above (no real test framework yet — use a throwaway `scripts/test-shopping-share.ts` that asserts expected URLs)
- [ ] Fix any bugs the tests surface
- [ ] Add a `items.length === 0` guard → button disabled state
- [ ] Enforce 2KB URL length; on overflow, truncate to first N items and show a toast "Opening first N — too long for Instacart search"
- [ ] Update `shoppingShare.ts` top-comment to enumerate these limitations for future maintainers

**Explicitly deferred to v1.1:**
- Real Instacart Connect Platform integration (requires partner approval, OAuth, cart creation API). Cost: ~$0 but 2+ weeks partner lead-time.
- Apple Pay / Instacart Express upsell in-app.

---

## 2. Shop categorization fix

**Bug:** `aggregateIngredients.ts:47` — `category: GroceryCategory = ingredient.parsed?.category ?? 'Other'`. The 24 mock recipes don't populate `parsed`, so **every item lands in "Other"**. Shop screen shows one big undifferentiated list instead of Produce / Protein / Dairy / Pantry / Frozen / Bakery sections.

**Fix (runtime categorizer):**
Build `packages/shared/src/domain/categorizeIngredient.ts` — takes a raw ingredient name, returns `GroceryCategory`. Keyword-match heuristic:

```ts
const PATTERNS: Record<GroceryCategory, RegExp> = {
  Produce: /\b(lemon|lime|onion|garlic|ginger|cilantro|parsley|mint|basil|dill|tomato|cucumber|pepper|avocado|cabbage|lettuce|romaine|spinach|scallion|radish|shallot|potato|jalapeno|mushroom|broccoli)\b/i,
  Protein: /\b(chicken|beef|pork|lamb|turkey|salmon|tuna|shrimp|fish|egg|sucuk|merguez|sausage|bean)\b/i,
  Dairy: /\b(milk|butter|cheese|yogurt|feta|parmesan|cheddar|cream|monterey jack|mayo)\b/i,
  Bakery: /\b(bread|pita|tortilla|lavash|naan|sourdough|rye)\b/i,
  Frozen: /\b(frozen|edamame)\b/i,
  Pantry: /\b(rice|noodle|pasta|spaghetti|orzo|bulgur|panko|soy sauce|vinegar|oil|sugar|salt|spice|cumin|paprika|oregano|honey|broth|stock|tomato paste|miso|gochujang|kimchi|nori|sesame|flour|canned|harissa)\b/i,
  Other: /.*/,
};

export function categorizeIngredient(name: string): GroceryCategory {
  for (const [cat, pattern] of Object.entries(PATTERNS)) {
    if (cat === 'Other') continue;
    if (pattern.test(name)) return cat as GroceryCategory;
  }
  return 'Other';
}
```

Then in `aggregateIngredients.ts`:
```ts
const category: GroceryCategory =
  ingredient.parsed?.category ?? categorizeIngredient(rawName);
```

**Test:** eyeball the Shop screen after fixing — should see Produce, Protein, Dairy, Pantry sections populated.

---

## 3. Protein chip on recipe cards

**User ask:** "I want to have protein amount more prevalent when we're looking at meals, actually, kind of like the hand-drawn squares for now; yeah, that's enough."

**Today:** Recipe meta reads `{cuisine} · {timeMinutes} min · serves {servings}` — no protein/calories. The `NutritionalEstimate` type exists on Recipe (`proteinG?: number`) but fixtures don't populate it.

**Actions:**
1. **Add rough `nutritionalEstimate` to all 24 fixtures.** Not exact, just ballpark — "eyeballed by a cook." Format:
   ```ts
   nutritionalEstimate: {
     proteinG: 36,
     calories: 520,
     source: 'ai-estimate',
   },
   ```
   - Rough per-tier protein targets: brain-is-fried 15-30g, after-work 30-45g, got-energy 35-50g, weekend-project 40-60g.
2. **Build `PaintedSquareChip` primitive** (or extend existing `GlassChip`) — rendered as a hand-drawn square with a single number + unit. Reuse the brushstroke aesthetic that's already in `BrushstrokeUnderline`. Size: ~44px wide.
3. **Wire into three surfaces:**
   - Tonight hero (below title, right of `{cuisine} · {time} · serves {servings}`)
   - Week DayRow populated state (compact version in the pickArea)
   - Recipe Modal (prominent, above ingredients)
4. **Format:** `{proteinG}g PROTEIN` in Mono kicker underneath the number (bold Fraunces). Same square can hold calories as a secondary chip if easy.

**Scope control:** keep it to protein for v1. Calories/carb chips can follow if it feels thin.

---

## 4. HTML catalog + PDF of all 24 meals

**User ask:** "Make an HTML file of all the different meals we have. Make that into an easily accessible PDF that I can look through. I want to understand how they're related, how they're not."

**Output (this session):**
- `docs/meals/catalog.html` — one page, all 24 recipes. Sortable/filterable by tier (default sort by tier then cuisine).
- `docs/meals/catalog.pdf` — generated from the HTML via headless Chrome.
- Each recipe card shows: image (PNG from `apps/native/assets/meals-seed/v2/`), title, tier, cuisine, time, servings, protein (when populated), ingredient list (grouped), step titles (one line each), notes.
- Top matrix: tiers across, cuisines down. Fills cells with meal titles. Makes the "how they're related" pattern pop at a glance.
- Color: cream background, Fraunces display, DM Sans body — reflects the app aesthetic.

**Lives in `docs/meals/`** (new directory); not in `apps/` because it's a static reference artifact, not app code.

---

## 5. Codebase cleanup — DEFERRED

**Status (2026-04-23):** scrapped for now. Archival-vs-dead-code audit showed
`swipe-night/` + `swipeDeck.ts` are deliberately preserved per
`docs/plan/qook-mvp-design-decisions.md:216-217` ("Don't delete. If we revisit
passive discovery later, the code is there."). `PaintedButton` is still
referenced by the archive, so it stays too.

The truly-dead targets (`SavedScreen.tsx`, `WashBackground.tsx`, unused
painted `Icon.tsx` named exports) are low-risk but equally low-value right
now. Revisit in a dedicated cleanup pass after Shop categorization + protein
chip + backend wiring land — cleaning up is easier when we know what's
actually being used in the new flows.

---

## 6. Backend — what's actually required for live mode

**State today:**
- 4 migrations landed (schema, RLS, auth triggers, storage buckets). Audited at `supabase/migrations/20260421*`.
- **All 6 Edge Function directories are empty.** No index.ts, no env reads — just folder stubs.
- `OPENROUTER_API_KEY` not set anywhere; `app.json.extra.apiMode` is `'mock'`.

**To reach live mock-toggleable parity for `apiMode: 'live'`, we need:**

| Step | File | Scope |
|---|---|---|
| 1 | `supabase/functions/_shared/openrouter.ts` | Port from `section-ai.md` §3.1 — fetch wrapper with retries, JSON schema, cost logging |
| 2 | `supabase/functions/_shared/schema.ts` | Zod schemas for Recipe + JSON schema for OpenRouter `response_format` |
| 3 | `supabase/functions/_shared/tiers.ts` | `TIER_RULES` constant |
| 4 | `supabase/functions/_shared/prompts/live.ts` | Live-generation prompt (Haiku, 3 recipes) |
| 5 | `supabase/functions/generate-recipe/index.ts` | Receives `{ tier, context }`, streams 3 Recipes via SSE, persists to `recipes` table, returns array |
| 6 | Supabase secrets | `supabase secrets set OPENROUTER_API_KEY=...` |
| 7 | Smoke test | Flip `apiMode: 'live'` locally, run full Tonight flow, verify text recipes stream and persist |
| 8 | Live image gate | Wire `generate-image` to fire on "Cook tonight" tap (not on recipe-draft) |
| 9 | Cohort batch | `generate-deck-batch` + pg_cron — deferred to after TestFlight if timeline slips |

**Cost reality check:** per `section-ai.md` §6, ~$20/mo text-only for 100 testers. Save-gated images ~$65/mo. Affordable.

**Proposed sequence for the backend push:**
- Days 1-2: Steps 1-4 (`_shared/*`). Pure TS, no external call yet.
- Day 3: Step 5 + 6 + 7 (first live recipe end-to-end). **Cost checkpoint: one real OpenRouter call.**
- Day 4: Step 8 (save-gated image). **Cost checkpoint: one real Seedream call.**
- Day 5+: Cohort batch if time permits.

**Gate before starting:** confirm OpenRouter account has credit + Seedream 4.5 model access in the dashboard.

---

## 7. Order of operations for the NEXT session

Roughly a full day of focused work, no AI calls required for 1-4:

1. **Shop categorization fix** (Section 2) — add `categorizeIngredient`. Verify Shop shows Produce/Protein/etc. **20 min.** One commit.
2. **Instacart pressure test + expectation reset** (Section 1) — add empty-cart guard + 2KB URL truncation; rename button to "Search Instacart" to set honest expectations. Real Connect Platform API deferred to v1.1. **30 min.** One commit.
3. **Protein chip UI** (Section 3) — add `nutritionalEstimate` to fixtures, build chip primitive, wire into Tonight/Week/Modal. **90 min.** One commit.
4. **HTML catalog + PDF** (Section 4) — generate static artifact. **30 min.** One commit.

**Estimated total:** ~3 hours of focused work = one session. All concrete, no AI cost.

**Backend work (Section 6) is a separate session** — needs OpenRouter confirmation + dedicated 2-day block.

---

## Out of scope (explicitly deferred)

- Instacart Connect Platform API (v1.1)
- Cohort batch cron (post-TestFlight)
- PaintedCheckbox replacement (cosmetic, not blocking)
- TestFlight submission mechanics (separate plan in `section-testflight.md`)
- Paywall / RevenueCat (v1.1)
