# Phase 3b — Tonight-screen mockup details (from the approved Menu artifact)

Source of truth: Zach's artifact "Qook — The Menu System" (claude.ai/code/artifact/513f6a74-6276-451e-b7f1-accc880936d5).
These notes transcribe the Tonight mockup Zach re-confirmed on 2026-07-08 ("Like this view and stuff") so implementers
don't depend on session screenshots. Where these conflict with the plan's Task 7, THESE govern — they come from the mockup.

## Tonight screen, top to bottom

- **Masthead**: `qook` lowercase, bold serif (Fraunces), forest, left-aligned. Right side: `WED · JULY 8`
  in mono uppercase, letterspaced, muted. Thin hairline rule under the full masthead row.
- **Kicker**: `TONIGHT'S TABLE` — rust, mono, uppercase, letterspaced.
- **Title**: Fraunces Bold, forest, very large, wraps over two lines (`Miso-glazed`), with the final word
  (`salmon`) on its own line in **rust Fraunces Italic**. Brushstroke underline (rust) beneath the title block,
  roughly the width of the longest line.
- **Vignette**: large circular crop of the meal painting, top-right beside the title (~40% content width).
  **ProteinSquare badge overlaps the vignette's lower-left edge**: rounded-square, cream fill, rust border,
  slight tilt; `38g` in serif bold + `PROTEIN` beneath in tiny rust mono.
- **Stat rows** (MenuRow): label in body face + dotted leader + value in mono:
  `Active time …… 25 min` / `Serves …… 2` / `Cuisine …… Japanese`. Values right-aligned.
- **CTA**: `Cook tonight →` — **outlined** pill (forest border + forest text on cream), NOT a filled button.
- **Italic aside** (one per screen): rust Fraunces Italic, centered, below the CTA:
  `you said 30 minutes — everything here fits`.
- **Section divider**: `ALSO ON THE MENU` centered mono kicker with hairline rules on both sides.
- **Menu rows**: one per alternate recipe — circular vignette (~72px), recipe title in Fraunces Bold,
  dotted leader, `15 min` mono value. No cards, no borders — menu lines on the cream ground.
- **Tab bar**: **text-only**, mono uppercase `TONIGHT  WEEK  SHOP  MORE` — no icons. Active tab is
  darker/forest with a small rust dot centered above the label; inactive tabs muted. (Current app uses
  icon tabs — the restyle replaces them.)

## Global cues visible in the artifact

- Beige `well` #F1E9D9 marks "what's alive right now": today's card, the selected pick, the Instacart dock.
  Cream stays the ground everywhere else.
- Protein badge appears ONCE per screen max.
- Status-bar/clock area sits directly on cream — no header bar chrome.
