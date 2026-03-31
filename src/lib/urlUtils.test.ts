import { describe, it, expect, afterEach } from 'vitest';
import { getShareUrl } from './urlUtils';

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
