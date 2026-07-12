import { describe, expect, test } from 'bun:test';
import type { Recipe } from '@qook/shared';
import {
  dealFreshHand,
  focusedRecipe,
  initDeck,
  isExhausted,
  keepAt,
  passAt,
  reconcileKept,
  sessionExcludeTitles,
  stageNextHand,
  swipeSummary,
} from './deckState';

function r(id: string): Recipe {
  return { id, title: `Dish ${id}` } as Recipe;
}
const HAND = [r('a'), r('b'), r('c'), r('d'), r('e')];

function rc(id: string, cuisine: string): Recipe {
  return { id, title: `Dish ${id}`, cuisine } as Recipe;
}

describe('deckState', () => {
  test('keepAt records the focused recipe and advances', () => {
    const s = keepAt(initDeck(HAND));
    expect(s.position).toBe(1);
    expect(s.kept.map((x) => x.id)).toEqual(['a']);
  });

  test('keepAt dedupes by id', () => {
    let s = initDeck(HAND);
    s = keepAt(s);
    s = { ...s, position: 0 };
    s = keepAt(s);
    expect(s.kept.map((x) => x.id)).toEqual(['a']);
  });

  test('passAt advances without keeping', () => {
    const s = passAt(initDeck(HAND));
    expect(s.position).toBe(1);
    expect(s.kept).toEqual([]);
  });

  test('isExhausted true once past the last card', () => {
    let s = initDeck(HAND);
    for (let i = 0; i < 5; i++) s = passAt(s);
    expect(isExhausted(s)).toBe(true);
    expect(focusedRecipe(s)).toBe(null);
  });

  test('dealFreshHand preserves kept and resets position', () => {
    let s = keepAt(initDeck(HAND));
    const next = [r('f'), r('g'), r('h'), r('i'), r('j')];
    s = dealFreshHand(s, next);
    expect(s.position).toBe(0);
    expect(s.kept.map((x) => x.id)).toEqual(['a']);
    expect(s.proposals.map((x) => x.id)).toEqual(['f', 'g', 'h', 'i', 'j']);
  });

  test('reconcileKept swaps a kept id after a cache-hit fill', () => {
    let s = keepAt(initDeck(HAND));
    s = reconcileKept(s, 'a', r('full-a'));
    expect(s.kept.map((x) => x.id)).toEqual(['full-a']);
  });
});

describe('deckState session tracking', () => {
  test('passAt records the passed recipe', () => {
    const s = passAt(initDeck(HAND));
    expect(s.passed.map((x) => x.id)).toEqual(['a']);
  });

  test('initDeck seeds the dealt set from the hand', () => {
    const s = initDeck([rc('a', 'Thai'), rc('b', 'Italian')]);
    expect(s.dealt.map((d) => d.id)).toEqual(['a', 'b']);
  });

  test('dealFreshHand appends the new hand to the dealt set', () => {
    let s = initDeck([rc('a', 'Thai')]);
    s = dealFreshHand(s, [rc('b', 'Italian')]);
    expect(s.dealt.map((d) => d.id)).toEqual(['a', 'b']);
  });

  test('swipeSummary reports kept + passed cuisines', () => {
    let s = initDeck([rc('a', 'Thai'), rc('b', 'Italian')]);
    s = keepAt(s); // keep a (Thai)
    s = passAt(s); // pass b (Italian)
    const sum = swipeSummary(s);
    expect(sum.keptCuisines).toEqual(['Thai']);
    expect(sum.passedCuisines).toEqual(['Italian']);
  });

  test('sessionExcludeTitles lists every dealt title', () => {
    const s = initDeck([rc('a', 'Thai'), rc('b', 'Italian')]);
    expect(sessionExcludeTitles(s)).toEqual(['Dish a', 'Dish b']);
  });

  test('stageNextHand stashes the prefetched hand', () => {
    const s = stageNextHand(initDeck(HAND), [rc('z', 'Thai')]);
    expect(s.nextHand?.map((x) => x.id)).toEqual(['z']);
  });

  test('dealFreshHand clears any staged next hand', () => {
    let s = stageNextHand(initDeck(HAND), [rc('z', 'Thai')]);
    s = dealFreshHand(s, [rc('z', 'Thai')]);
    expect(s.nextHand).toBe(null);
  });
});
