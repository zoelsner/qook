// Presentation only: never rewrite quantities, doneness cues or safety text.
// A sentence boundary ends the emphasized lead; concatenation restores
// the exact original instruction (including its whitespace).
export function splitStepInstruction(instruction: string): { lead: string; rest: string } {
  const boundary = /[.!?]\s+(?=[A-Z])/.exec(instruction);
  if (!boundary || boundary.index > 150) return { lead: '', rest: instruction };
  const end = boundary.index + 1;
  // Avoid treating common abbreviated units/examples as sentence endings.
  if (/\b(?:tsp|tbsp|oz|lb|min|approx|e\.g|i\.e)\.$/i.test(instruction.slice(0, end))) {
    return { lead: '', rest: instruction };
  }
  return { lead: instruction.slice(0, end), rest: instruction.slice(end) };
}

export function stepAccessibilityLabel(number: number, instruction: string, durationMin?: number): string {
  return `Step ${number}${durationMin ? `, about ${durationMin} ${durationMin === 1 ? 'minute' : 'minutes'}` : ''}. ${instruction}`;
}
