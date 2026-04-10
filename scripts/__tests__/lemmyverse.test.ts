import { describe, it, expect } from 'vitest';
import { filterTopInstances } from '../lib/lemmyverse.js';

const makeInstance = (baseurl: string, month: number, isSuspicious = false) => ({
  baseurl,
  users: { month },
  isSuspicious,
});

describe('filterTopInstances', () => {
  it('returns top N instances sorted by monthly active users', () => {
    const raw = [
      makeInstance('c.example', 100),
      makeInstance('a.example', 5000),
      makeInstance('b.example', 2000),
    ];
    const result = filterTopInstances(raw, 2);
    expect(result).toEqual(['a.example', 'b.example']);
  });

  it('excludes suspicious instances', () => {
    const raw = [
      makeInstance('good.example', 9999),
      makeInstance('bad.example', 99999, true),
    ];
    const result = filterTopInstances(raw, 5);
    expect(result).toEqual(['good.example']);
  });

  it('excludes instances with 0 monthly active users', () => {
    const raw = [
      makeInstance('active.example', 500),
      makeInstance('dead.example', 0),
    ];
    const result = filterTopInstances(raw, 5);
    expect(result).toEqual(['active.example']);
  });

  it('caps result at N even if more instances are available', () => {
    const raw = Array.from({ length: 30 }, (_, i) =>
      makeInstance(`inst${i}.example`, 1000 - i)
    );
    expect(filterTopInstances(raw, 20)).toHaveLength(20);
  });
});
