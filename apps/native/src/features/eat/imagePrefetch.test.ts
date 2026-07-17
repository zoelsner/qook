import { describe, expect, test } from 'bun:test';
import { artIndicesToRequest, urlsToPrefetch } from './imagePrefetch';

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

describe('urlsToPrefetch', () => {
  test('skips proposals before position', () => {
    const proposals = [{ heroImageUrl: 'a' }, { heroImageUrl: 'b' }, { heroImageUrl: 'c' }];
    expect(urlsToPrefetch(1, proposals, new Set())).toEqual(['b', 'c']);
  });
  test('skips missing/empty urls', () => {
    const proposals = [{ heroImageUrl: '' }, {}, { heroImageUrl: 'c' }];
    expect(urlsToPrefetch(0, proposals, new Set())).toEqual(['c']);
  });
  test('skips already-prefetched', () => {
    const proposals = [{ heroImageUrl: 'a' }, { heroImageUrl: 'b' }];
    expect(urlsToPrefetch(0, proposals, new Set(['a']))).toEqual(['b']);
  });
  test('dedups repeated urls', () => {
    const proposals = [{ heroImageUrl: 'a' }, { heroImageUrl: 'a' }, { heroImageUrl: 'b' }];
    expect(urlsToPrefetch(0, proposals, new Set())).toEqual(['a', 'b']);
  });
  test('returns [] when nothing qualifies', () => {
    const proposals = [{ heroImageUrl: 'a' }, { heroImageUrl: 'b' }];
    expect(urlsToPrefetch(0, proposals, new Set(['a', 'b']))).toEqual([]);
    expect(urlsToPrefetch(2, proposals, new Set())).toEqual([]);
  });
});
