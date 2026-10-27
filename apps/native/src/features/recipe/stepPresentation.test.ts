import { describe, expect, test } from 'bun:test';
import { splitStepInstruction, stepAccessibilityLabel } from './stepPresentation';

describe('step presentation preserves cooking instructions', () => {
  const examples = [
    'Add 1.5 tbsp oil. Heat until shimmering.',
    'Cook to 165°F. Rest for 3 minutes before serving.',
    'Pierce the yolks and whites. Cover loosely; open away from your face.',
    'Add ½ cup water, then stir until smooth.',
    'Microwave in 20-second bursts! Stop when the whites are fully set.',
    'Stir in 2 tsp. Olive oil goes in next.',
    'Keep stirring until the sauce coats the spoon and the chicken is fully cooked without letting anything burn because the pan may be unusually hot on this stove. Check again.',
  ];
  for (const text of examples) test(text.slice(0, 45), () => {
    const { lead, rest } = splitStepInstruction(text);
    expect(lead + rest).toBe(text);
  });
  test('decimal quantities and abbreviated units do not become partial instructions', () => {
    expect(splitStepInstruction(examples[0]).lead).toBe('Add 1.5 tbsp oil.');
    expect(splitStepInstruction(examples[5]).lead).toBe('');
  });
  test('accessibility reads step, duration and complete safety instruction together', () => {
    expect(stepAccessibilityLabel(3, examples[2], 1)).toBe(`Step 3, about 1 minute. ${examples[2]}`);
    expect(stepAccessibilityLabel(4, 'Serve.', 2)).toBe('Step 4, about 2 minutes. Serve.');
    expect(stepAccessibilityLabel(5, 'Serve.')).toBe('Step 5. Serve.');
  });
});
