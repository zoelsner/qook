// Unit tests for the buffered-SSE fallback parser used by paid recipe
// generation. Pure logic only — run with `bun test` (see the header of
// streamEventRouter.ts for why this module is kept free of RN imports).

import { describe, expect, test } from 'bun:test';

import { parseBufferedSse } from './streamEventRouter';

const RECIPES = [
  { title: 'Miso Salmon', minutes: 25 },
  { title: 'Chickpea Curry', minutes: 30 },
];

describe('parseBufferedSse', () => {
  test('parses a normal event stream ending in a final payload', () => {
    const body =
      'event: title\ndata: {"index":0,"title":"Miso Salmon"}\n\n' +
      'event: title\ndata: {"index":1,"title":"Chickpea Curry"}\n\n' +
      `event: final\ndata: ${JSON.stringify({ recipes: RECIPES })}\n\n`;

    const result = parseBufferedSse(body);
    expect(result.finalRecipes).toEqual(RECIPES);
    expect(result.error).toBeUndefined();
  });

  test('final payload without a recipes field yields an empty array', () => {
    const result = parseBufferedSse('event: final\ndata: {}\n\n');
    expect(result.finalRecipes).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  test('last final event wins when several are present', () => {
    const body =
      'event: final\ndata: {"recipes":[{"title":"stale"}]}\n\n' +
      `event: final\ndata: ${JSON.stringify({ recipes: RECIPES })}\n\n`;
    expect(parseBufferedSse(body).finalRecipes).toEqual(RECIPES);
  });

  test('parses a typed error frame', () => {
    const body =
      'event: error\ndata: {"code":"insufficient_credits","message":"You are out of credits."}\n\n';
    const result = parseBufferedSse(body);
    expect(result.error).toEqual({
      code: 'insufficient_credits',
      message: 'You are out of credits.',
    });
    expect(result.finalRecipes).toBeUndefined();
  });

  test('error frame missing fields falls back to defaults', () => {
    const result = parseBufferedSse('event: error\ndata: {}\n\n');
    expect(result.error).toEqual({
      code: 'generation_failed',
      message: 'Something went wrong.',
    });
  });

  test('malformed error frame does not throw and is ignored', () => {
    const result = parseBufferedSse('event: error\ndata: {not json!!\n\n');
    expect(result.error).toBeUndefined();
    expect(result.finalRecipes).toBeUndefined();
  });

  test('empty input returns neither recipes nor error', () => {
    const result = parseBufferedSse('');
    expect(result.finalRecipes).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  test('partial and truncated frames are skipped without throwing', () => {
    const body =
      // event line with no data line
      'event: final\n\n' +
      // data line with no event line
      'data: {"recipes":[]}\n\n' +
      // final frame truncated mid-JSON
      'event: final\ndata: {"recipes":[{"title":"cut off\n\n' +
      // non-final/error events are ignored
      'event: title\ndata: {"index":0,"title":"ok"}\n\n';
    const result = parseBufferedSse(body);
    expect(result.finalRecipes).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  test('a valid final after malformed frames still parses', () => {
    const body =
      'event: final\ndata: {broken\n\n' +
      `event: final\ndata: ${JSON.stringify({ recipes: RECIPES })}\n\n`;
    expect(parseBufferedSse(body).finalRecipes).toEqual(RECIPES);
  });
});
