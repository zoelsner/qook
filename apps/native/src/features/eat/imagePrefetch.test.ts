import { describe, expect, test } from 'bun:test';
import { artIndicesToRequest } from './imagePrefetch';

describe('artIndicesToRequest', () => {
  test('deal time requests the first three', () => {
    expect(artIndicesToRequest(0, 5, [])).toEqual([0, 1, 2]);
  });
  test('stays two ahead as cards reveal', () => {
    expect(artIndicesToRequest(1, 5, [0, 1, 2])).toEqual([3]);
    expect(artIndicesToRequest(2, 5, [0, 1, 2, 3])).toEqual([4]);
  });
  test('nothing left to request at the end', () => {
    expect(artIndicesToRequest(3, 5, [0, 1, 2, 3, 4])).toEqual([]);
  });
  test('clamps to a short hand', () => {
    expect(artIndicesToRequest(0, 2, [])).toEqual([0, 1]);
  });
});
