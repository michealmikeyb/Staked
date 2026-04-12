import { describe, it, expect, afterEach } from 'vitest';
import { getShareUrl, parsePostUrl } from './urlUtils';

describe('getShareUrl', () => {
  const originalEnv = import.meta.env.VITE_BASE_URL;

  afterEach(() => {
    import.meta.env.VITE_BASE_URL = originalEnv;
  });

  it('uses VITE_BASE_URL when set', () => {
    import.meta.env.VITE_BASE_URL = 'https://stakswipe.com';
    expect(getShareUrl('lemmy.world', 42)).toBe('https://stakswipe.com/#/post/lemmy.world/42');
  });

  it('falls back to https://stakswipe.com when VITE_BASE_URL is undefined', () => {
    delete (import.meta.env as any).VITE_BASE_URL;
    expect(getShareUrl('beehaw.org', 7)).toBe('https://stakswipe.com/#/post/beehaw.org/7');
  });
});

describe('parsePostUrl', () => {
  it('parses a full Lemmy URL with protocol', () => {
    expect(parsePostUrl('https://lemmy.world/post/2395953')).toEqual({
      instance: 'lemmy.world',
      postId: 2395953,
    });
  });

  it('parses a Lemmy URL without protocol', () => {
    expect(parsePostUrl('lemmy.world/post/42')).toEqual({
      instance: 'lemmy.world',
      postId: 42,
    });
  });

  it('parses a Stakswipe share URL', () => {
    expect(parsePostUrl('https://stakswipe.com/#/post/lemmy.world/2395953')).toEqual({
      instance: 'lemmy.world',
      postId: 2395953,
    });
  });

  it('returns null for a plain search query', () => {
    expect(parsePostUrl('rust programming')).toBeNull();
  });

  it('returns null for a community URL', () => {
    expect(parsePostUrl('https://lemmy.world/c/rust')).toBeNull();
  });

  it('returns null for a Lemmy URL with non-numeric post ID', () => {
    expect(parsePostUrl('https://lemmy.world/post/abc')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parsePostUrl('')).toBeNull();
  });
});
