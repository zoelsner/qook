export const TIER_RULES = {
  "brain-is-fried": {
    label: "Brain is fried",
    maxMinutes: 15,
    sectionsMax: 2,
    stepsPerSectionMax: 3,
    directive:
      "15 minutes OR LESS. One pan or zero pans. Max 6 ingredients. No prep that needs a knife for more than 30 seconds. Think: microwave, toaster, kettle. This is for a human who just got off a bad shift.",
  },
  "after-work": {
    label: "After work",
    maxMinutes: 30,
    sectionsMax: 3,
    stepsPerSectionMax: 4,
    directive:
      "30 minutes total, active hands-on time only. 2 vessels max. Allows a skillet plus a pot of rice, sheet pan plus salad, stir-fry plus quick grain. Satisfying but not a project.",
  },
  "got-energy": {
    label: "Got energy",
    maxMinutes: 45,
    sectionsMax: 4,
    stepsPerSectionMax: 5,
    directive:
      "45 minutes active time. Up to 3 components (main + side + vegetable). Can include one technique that needs attention (braising, searing with pan sauce, roasting with a glaze). Cook is engaged but not sprinting.",
  },
  "weekend-project": {
    label: "Weekend project",
    maxMinutes: 180,
    sectionsMax: 6,
    stepsPerSectionMax: 6,
    directive:
      "60+ minutes total, often with passive time. Multiple components, advanced techniques welcome: homemade sauce, dough, slow braise, butchery, confit. The cook WANTS to be in the kitchen.",
  },
} as const;

export type TierKey = keyof typeof TIER_RULES;

export function tierFromActiveMinutes(m: number): TierKey {
  if (m <= 15) return "brain-is-fried";
  if (m <= 30) return "after-work";
  if (m <= 45) return "got-energy";
  return "weekend-project";
}
