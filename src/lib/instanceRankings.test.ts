import { describe, it, expect } from 'vitest';
import { getAnonInstance } from './instanceRankings';

describe('getAnonInstance', () => {
  it('returns reddthat.com for Active', () => {
    expect(getAnonInstance('Active')).toBe('reddthat.com');
  });

  it('returns lemmy.blahaj.zone for Hot', () => {
    expect(getAnonInstance('Hot')).toBe('lemmy.blahaj.zone');
  });

  it('returns a non-empty string for every SortType', () => {
    const sorts = ['Active', 'Hot', 'New', 'TopSixHour', 'TopTwelveHour', 'TopDay'] as const;
    for (const sort of sorts) {
      expect(getAnonInstance(sort).length).toBeGreaterThan(0);
    }
  });

  it('falls back to lemmy.world for an unmapped SortType', () => {
    expect(getAnonInstance('Controversial')).toBe('lemmy.world');
  });
});
