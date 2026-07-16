import type { EnergyTier } from '@qook/shared';

// Rotating shortcut chips for the context step. Four chips per visit, one
// from each of four categories; the date seeds which line each category
// shows, so the set changes daily but stays stable within a session. The
// energy tier picks WHICH categories appear and leads with the fitting one
// (fried night → low-effort first; weekend → ambition first).

export const SHORTCUT_POOLS = {
  reality: [
    'Zero chopping tonight',
    'One pot, minimal dishes',
    'Fifteen minutes of effort, max',
    'Too hot to turn on the oven',
    'Pantry only — no store run',
    'Something I can make half-asleep',
  ],
  pantry: [
    'Use up leftover rice',
    'Rescue the wilting greens',
    'Eggs for dinner, done right',
    'Clean out the crisper drawer',
    'That can of chickpeas, finally',
    'Finish the tortillas',
  ],
  mood: [
    'Warm and comforting tonight',
    'Bright, fresh, and crunchy',
    'Big cozy bowl energy',
    'Light — lunch was huge',
    'Spicy enough to notice',
    'Comfort food, lighter somehow',
  ],
  food: [
    'Something easy with chicken',
    'Lean and high-protein',
    'Noodles of any nationality',
    'Weeknight taco energy',
    'Fish, but foolproof',
    'Meatless and not sad about it',
  ],
  project: [
    'A project worth the mess',
    'Something to impress somebody',
    'A sauce made from scratch',
    'The long way, on purpose',
    'Cook once, eat twice this week',
    'Finally use the dutch oven',
  ],
} as const;

type Pool = keyof typeof SHORTCUT_POOLS;

const CATEGORY_ORDER: Record<EnergyTier | 'default', Pool[]> = {
  'brain-is-fried': ['reality', 'pantry', 'mood', 'food'],
  'after-work': ['reality', 'food', 'pantry', 'mood'],
  'got-energy': ['food', 'mood', 'pantry', 'project'],
  'weekend-project': ['project', 'food', 'mood', 'pantry'],
  default: ['food', 'pantry', 'mood', 'reality'],
};

// Small deterministic hash — no Math.random so the chips don't reshuffle
// on every re-render or between the two screens of one session.
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function contextShortcuts(
  dateIso: string,
  tier: EnergyTier | null,
): string[] {
  const order = CATEGORY_ORDER[tier ?? 'default'] ?? CATEGORY_ORDER.default;
  const seed = hashString(dateIso);
  return order.map((pool, i) => {
    const lines = SHORTCUT_POOLS[pool];
    return lines[(seed + i * 7) % lines.length];
  });
}
