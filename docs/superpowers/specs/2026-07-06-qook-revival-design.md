# Qook revival — design spec

**Written:** 2026-07-06
**Goal:** TestFlight with live AI generation, in the approved "Menu" visual system.
**Approved by:** Zach, 2026-07-06 (design exploration artifacts Nº1–3; Garden palette confirmed; Tonight tweaks applied: larger vignette, smaller protein square).

This spec has two halves: the visual system (§1–3, approved via mockups) and the backend that makes the app real (§4–7, the current priority). §8 sequences the work.

---

## 0. Context

The frontend is ~85% built and runs in mock mode on 24 fixture recipes. The stall points: all six Edge Function directories are empty, auth is a stub, three recipe-modal buttons are dead UI, and the watercolor art — full-bleed on every card — made the app feel visually suffocating. Diagnosis and direction were validated in three artifact explorations (2026-07-06): design directions → five-screen Menu system → image model bake-off.

Two external facts discovered during exploration that change the old plan:

1. **Seedream 4.5 is no longer on OpenRouter.** `section-ai.md`'s image model must be replaced (§5).
2. **The 24 existing illustrations predate the April palette-directive tuning** — they have the heavy wash zones the current prompt forbids. Regenerating the library is cheap (~$1.60) and fixes the visual-noise problem at the source.

## 1. Visual system — "The Menu"

One metaphor everywhere: **the app is a dinner menu.** Stats, groceries, and weekdays all render as menu lines.

### 1.1 Tokens (Garden palette — confirmed, unchanged)

| Token | Value | Role |
|---|---|---|
| cream | `#FBF7EE` | ground, every screen |
| well | `#F1E9D9` | "alive right now": today's card, selected proposal, shop dock. Never decoration. |
| forest | `#2A3A26` | ink, primary buttons |
| rust | `#C36A48` | accent: kickers, italic accents, brushstroke, chip fill |
| prussian | `#3D5469` | rare utility only |

Type stays Fraunces Bold (display) / Fraunces Italic (asides) / DM Sans (body) / JetBrains Mono (kickers, values). Menu stat rows are 15px body with mono values.

### 1.2 Components and their one-job rules

- **Dot-leader row** (`MenuRow`): label · dotted leader · mono value. Used for recipe stats, ingredients, grocery items, week summary values. The system's workhorse.
- **Vignette** (`Vignette`): circular crop of the meal painting. Tonight hero ~114px, list rows 44–58px. This is how art appears on every surface except the recipe page.
- **Painted square** (`ProteinSquare`): hand-drawn tilted square, protein grams only. Sizes: default (recipe page), small (Tonight hero), mini (Week today-card). Max one per screen.
- **Brushstroke** (`BrushstrokeUnderline`, exists): under the screen title only. Never under body text, never a divider.
- **Beige well**: `well` background, radius 16–18. Marks the live thing on each screen.
- **Chunky chip** (`EnergyChip`): pressed-shadow tactile chip (number + tier word). **Exists only on the energy picker.** Nowhere else — this is the app's single toy.
- **Italic aside**: one per screen max, rust-toned Fraunces italic ("you said 30 minutes — everything here fits").

### 1.3 Per-screen rules (approved mockups are the source of truth)

Art budget, globally: **at most one full-bleed painting per screen** — and only the recipe page uses one.

- **Tonight**: masthead (`qook` + date), kicker, title + brushstroke, 114px vignette with small ProteinSquare tucked under-left, stat MenuRows (Active time / Serves / Cuisine), bordered CTA, italic aside, "Also on the menu" rows with 52px vignettes + dot leaders.
- **Week**: days as menu lines. Cooked = name + sage ✓; skipped = italic shrug; today = beige-well card (52px vignette, title, mini square); tagged = filled mini chip; empty = ghost chips 15/30/45. CTA names the next action ("Draft Thursday's dinner →") — fixes the audit's "now what?" gap. Long-press a populated day → clear (audit bug).
- **Shop**: category kickers (rule2 style), grocery MenuRows with hand-drawn checkboxes (checked = filled + strikethrough), Instacart dock in beige well with copy "Your list, ready to check out."
- **Find dinner (eat flow)**: kicker, "How much energy?" title, chunky chips, "The kitchen proposes" — 3 proposal rows with 58px vignettes; selected sits in beige well; CTA names the pick ("Cook the noodles →"); aside "swaps are free — try another."
- **Recipe page**: full-bleed painting top (the payoff), kicker (tier · cuisine), title + brushstroke + default ProteinSquare beside it, stat MenuRows, INGREDIENTS as MenuRows, THE MOVES with Fraunces numerals, "Add all to list →" CTA.

### 1.4 Deletions confirmed by this direction

`PaintedButton` (replace remaining uses with PolishedButton/bordered CTA), `PaintedCheckbox` (replaced by the small hand-drawn square checkbox above), painted `Icon.tsx` named exports, `WashBackground`. `swipe-night/` archive stays per prior design decision.

## 2. Trust fixes (from AUDIT-2026-04-23, unchanged prescriptions)

1. RecipeDetailModal **Save** → persist `savedRecipeIds` in `weekPlan` store.
2. **Share** → RN `Share` API (title + placeholder URL).
3. **"Add all to list"** → fork recipe into a temp day so Shop aggregates it.
4. Shop dock: disable visually at zero unchecked items (verify `PolishedButton` disabled styling).
5. Week: long-press populated day → "Clear this day."

## 3. Image pipeline — the canon loop

**Single model everywhere: `google/gemini-3.1-flash-image`** ($0.068/img, 7–17s). Zach ruled out GPT-5.4 Image 2 on price ($0.23); it survives only as a possible "studio repaint" premium perk later, never the pipeline. (Seedream 4.5's OpenRouter endpoints are confirmed dead; Seedream 5.0 Lite exists on fal.ai at $0.035 with multi-reference support — a future option if we ever accept a second provider.)

Consistency mechanism, validated by experiment (exploration Nº4, 2026-07-06):

1. **Prompt tweaks** (all three verified effective): (a) composition adds "a single plate, one serving, dish centered"; (b) "the outer 15% of the canvas stays clean cream paper on all sides"; (c) "at most two small watercolor accents outside the plate."
2. **Canon anchor**: generate ~6 candidates of one dish with the tweaked prompt; **Zach hand-picks the canon image** (note: the anchor's surface — wood vs plain cream — is inherited by everything, so pick deliberately). The canon ships as an asset the Edge Function attaches to every generation as a style-reference image with the directive "match this artist's hand; do not copy subject or composition."
3. **Regenerate all 24 fixture illustrations** with tweaked prompt + canon reference (~$1.70). Replaces the pre-tuning wash-heavy set in `assets/meals-seed/v2/` (keep old set in `v2-archive/` until sim-walk sign-off).
4. Every live `generate-image` call uses the identical canon + prompt. The style is locked once and never drifts.

**Image timing and tiers** (architecture is tier-ready, one flag): v1/TestFlight paints on commit ("Cook tonight") — one image per cooked dinner. The premium behavior (paint all 3 proposals at choose-time, ~$0.20/session) is the same Edge Function fired earlier, gated by a `tier` claim on the user row; it turns on with RevenueCat in v1.1. Proposals without paintings show the cream-circle letter vignette (§6).

## 4. Backend — live mode (the priority)

Architecture is unchanged from `section-backend.md`/`section-ai.md` (Supabase Edge Functions, single OpenRouter key in Supabase secrets, RLS as the security model, SHA-256 recipe signature dedup). What was never built gets built:

### 4.1 `_shared/` (pure TS, no network)
- `openrouter.ts` — fetch wrapper: retries, timeout, SSE support, `response_format` json_schema, cost logging (port from section-ai.md §3.1).
- `schema.ts` — Zod Recipe schema **extended with structured ingredients** per AUDIT §4: each ingredient carries `parsed { canonical_name, canonical_key, category, amount, unit }`. Categorization happens at generation time; the existing runtime regex (`categorizeIngredient.ts`) stays as the safety net.
- `tiers.ts` — `TIER_RULES` constant.
- `prompts/live.ts` — live generation prompt (3 recipes, tier rules, structured-ingredient directive from AUDIT §4).

### 4.2 Functions
- `generate-recipe` — receives `{tier, context}`, streams 3 recipes via SSE, validates with Zod, persists to `recipes`, returns array. Rate limits per README: 10/user/day, 30/user/month.
- `generate-image` — commit-gated (fires on "Cook tonight," not on draft; tier flag can move it to proposal-time later, §3). Calls Gemini 3.1 Flash Image with the §3 canon reference + tweaked prompt, stores PNG to Supabase Storage, writes URL to recipe row.
- `shopping-share` — Instacart **Create Shopping List** (`POST /idp/v1/products/products_link`, free self-serve IDP key — NOT the heavyweight Connect Platform). Maps items using `parsed` quantities. Errors: empty list → 422 + client toast; Instacart down → fall back to existing search-URL path. AmazonFresh dropped from the primary dock.
- `delete-account` — minimal: delete auth user + cascade via RLS-owned rows (App Review requires it).
- `generate-deck-batch` + pg_cron — **deferred to post-TestFlight** (live generation covers testers).

### 4.3 Models (verified on OpenRouter 2026-07-06)
| Job | Model | Price |
|---|---|---|
| Recipe draft (SSE) | `anthropic/claude-haiku-4.5` | $1/$5 per M — unchanged from plan |
| Polish fallback | `anthropic/claude-sonnet-5` | $2/$10 per M — **upgraded from sonnet-4.6 ($3/$15): newer and cheaper** |
| Ingredient structure | inline in the Haiku call (AUDIT §5.2 "one-call" option) | marginal tokens |
| Images | per §3 | — |

### 4.4 Client flip
`app.json.extra.apiMode: 'live'` behind local testing; `services/api.ts` already branches on it. Loading screen upgrades from spinner to streaming recipe titles as SSE events land.

## 5. Auth

**Sign in with Apple via Supabase native flow** (the sign-in screen stub already sketches it). Rationale: iOS-only app, one-tap, App Review-proof, and the auth-trigger migrations already exist. Email magic-link deferred; no other social logins (avoids Apple's "must offer Sign in with Apple" rule becoming a burden — it's the only option). Onboarding → sign-in → Tonight.

## 6. Error handling

- Edge Fns: every function returns typed errors `{code, message}`; client maps to friendly toasts ("The kitchen is busy — try again in a minute").
- SSE drop mid-stream: client keeps any fully-validated recipes already received; offers "Try again" for the remainder.
- OpenRouter outage: circuit breaker (Postgres flag per section-ai.md); client falls back to fixture pool with an honest italic aside ("offline picks — the kitchen improvises").
- Image failure: recipe ships without art; vignette slot shows a cream circle with the dish's first letter in Fraunces; retry on next open.

## 7. Testing

- `scripts/test-shopping-share.ts` — assertions for the 7 Instacart edge cases from NEXT-SESSION §1.
- `scripts/test-schema.ts` — Zod round-trip on recorded Haiku outputs (3 tiers).
- Live smoke test with cost checkpoints: 1 real text call, then full Tonight flow, then 1 real image call — each gated on eyeballing the previous.
- Sim-walk per phase (typecheck + lint green is the existing bar; keep it).

## 8. Sequencing

- **Phase 0 — protect the work**: commit the ~30 uncommitted files on `main` (they're the prefs system, categorizer, ProteinChip, docs). Install bun on this machine. Push.
- **Phase 1 — trust fixes** (§2): one session, no AI cost.
- **Phase 2 — backend live mode** (§4): `_shared` → `generate-recipe` → secrets → smoke test → `shopping-share` → `generate-image`. Needs: OpenRouter credit (key already in `.env.local` → move to Supabase secrets), Instacart IDP key (self-serve signup).
- **Phase 3 — Menu restyle** (§1): tokens/components first, then Tonight → Week → Shop → Find dinner → Recipe, matching the approved mockups.
- **Phase 4 — image regen** (§3): tweak prompt, regenerate 24 fixtures, swap assets.
- **Phase 5 — auth + ship** (§5): Sign in with Apple, delete-account, EAS build, TestFlight per `section-testflight.md`.

Backend before restyle is deliberate (Zach's priority); the restyle touches the same screens the backend feeds, so live data lands first and the restyle styles real content.

## 9. Out of scope (unchanged deferrals)

Instacart Connect Platform API, cohort deck cron (post-TestFlight), paywall/RevenueCat, Android, iPad.

## 10. Costs

~$20–35/mo text+images at 100 testers (Haiku drafts + save-gated Gemini images), ~$45/mo more if/when GPT-5.4 cohort decks turn on. One-time: ~$1.60 library regen. Matches the budget section-ai.md already approved.
