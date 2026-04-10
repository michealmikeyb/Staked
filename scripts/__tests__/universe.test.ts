import { describe, it, expect } from 'vitest';
import { buildUniverse } from '../lib/universe.js';
import type { InstanceRawData } from '../lib/types.js';

const makeRaw = (instance: string, apIds: string[]): InstanceRawData => ({
  instance,
  sortType: 'Active',
  posts: apIds.map((ap_id, i) => ({ id: i + 1, ap_id, upvotes: 10, downvotes: 2 })),
  comments: [],
  misses: [],
});

describe('buildUniverse', () => {
  it('returns the union of all ap_ids across instances', () => {
    const data = [
      makeRaw('a.example', ['post1', 'post2']),
      makeRaw('b.example', ['post2', 'post3']),
    ];
    const universe = buildUniverse(data);
    expect(universe).toEqual(new Set(['post1', 'post2', 'post3']));
  });

  it('returns empty set when no posts', () => {
    const data = [makeRaw('a.example', [])];
    expect(buildUniverse(data)).toEqual(new Set());
  });

  it('deduplicates ap_ids that appear across all instances', () => {
    const data = [
      makeRaw('a.example', ['post1', 'post1']),
      makeRaw('b.example', ['post1']),
    ];
    expect(buildUniverse(data).size).toBe(1);
  });
});
