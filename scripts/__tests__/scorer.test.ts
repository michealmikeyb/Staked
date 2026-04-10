import { describe, it, expect } from 'vitest';
import { scoreInstances } from '../lib/scorer.js';
import type { InstanceRawData } from '../lib/types.js';

const makeRaw = (
  instance: string,
  posts: Array<{ ap_id: string; upvotes: number; downvotes: number }>,
  commentVotes: number[],
): InstanceRawData => ({
  instance,
  sortType: 'Active',
  posts,
  comments: commentVotes.map((v) => ({ postApId: 'x', upvotes: v, downvotes: 0 })),
  misses: [],
});

describe('scoreInstances', () => {
  it('gives score 1.0 to the best instance across all metrics', () => {
    const universe = new Set(['p1', 'p2', 'p3']);
    const data = [
      makeRaw('best', [
        { ap_id: 'p1', upvotes: 100, downvotes: 10 },
        { ap_id: 'p2', upvotes: 100, downvotes: 10 },
        { ap_id: 'p3', upvotes: 100, downvotes: 10 },
      ], [50, 50]),
      makeRaw('worse', [
        { ap_id: 'p1', upvotes: 10, downvotes: 1 },
      ], [5]),
    ];
    const scores = scoreInstances(data, universe);
    const best = scores.find((s) => s.instance === 'best')!;
    expect(best.score).toBeCloseTo(1.0);
  });

  it('applies weights: posts 40%, comments 35%, postVotes 15%, commentVotes 10%', () => {
    const universe = new Set(['p1']);
    const a = makeRaw('a', [{ ap_id: 'p1', upvotes: 0, downvotes: 0 }], []);
    const b = makeRaw('b', [], [100]);
    // a: postsVisible=1 (max), all others 0
    // b: postsVisible=0, commentVotes=100 (max)
    // a.score = 0.40*1 + 0.35*0 + 0.15*0 + 0.10*0 = 0.40
    // b.score = 0.40*0 + 0.35*0 + 0.15*0 + 0.10*1 = 0.10
    const scores = scoreInstances([a, b], universe);
    const aScore = scores.find((s) => s.instance === 'a')!.score;
    const bScore = scores.find((s) => s.instance === 'b')!.score;
    expect(aScore).toBeCloseTo(0.40);
    expect(bScore).toBeCloseTo(0.10);
  });

  it('returns instances sorted descending by score', () => {
    const universe = new Set(['p1', 'p2']);
    const data = [
      makeRaw('low', [{ ap_id: 'p1', upvotes: 1, downvotes: 0 }], []),
      makeRaw('high', [
        { ap_id: 'p1', upvotes: 100, downvotes: 10 },
        { ap_id: 'p2', upvotes: 100, downvotes: 10 },
      ], [50]),
    ];
    const scores = scoreInstances(data, universe);
    expect(scores[0].instance).toBe('high');
    expect(scores[1].instance).toBe('low');
  });

  it('handles all-zero metrics without dividing by zero', () => {
    const universe = new Set<string>();
    const data = [makeRaw('a', [], [])];
    const scores = scoreInstances(data, universe);
    expect(scores[0].score).toBe(0);
  });
});
