import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { getShareUrl, parsePostUrl, buildShareUrl } from './urlUtils';

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

describe('buildShareUrl', () => {
  beforeEach(() => { import.meta.env.VITE_BASE_URL = 'https://stakswipe.com'; });
  afterEach(() => { delete (import.meta.env as any).VITE_BASE_URL; });

  const POST = { id: 1, ap_id: 'https://lemmy.world/post/1' };
  const KBIN_POST = { id: 99, ap_id: 'https://kbin.social/m/mag/p/123/some-slug' };
  const AUTH = { instance: 'beehaw.org' };
  const COMMUNITY_ACTOR_ID = 'https://lemmy.world/c/linux';

  it('stakswipe + auth: uses auth.instance and post.id', () => {
    expect(buildShareUrl('stakswipe', POST, AUTH, COMMUNITY_ACTOR_ID))
      .toBe('https://stakswipe.com/#/post/beehaw.org/1');
  });

  it('stakswipe + no auth: uses source instance parsed from ap_id', () => {
    expect(buildShareUrl('stakswipe', POST, null, COMMUNITY_ACTOR_ID))
      .toBe('https://stakswipe.com/#/post/lemmy.world/1');
  });

  it('stakswipe + no auth + Kbin ap_id: falls back to community instance', () => {
    expect(buildShareUrl('stakswipe', KBIN_POST, null, COMMUNITY_ACTOR_ID))
      .toBe('https://stakswipe.com/#/post/lemmy.world/99');
  });

  it('source: returns native Lemmy URL on source instance', () => {
    expect(buildShareUrl('source', POST, AUTH, COMMUNITY_ACTOR_ID))
      .toBe('https://lemmy.world/post/1');
  });

  it('source + Kbin ap_id: falls back to raw ap_id string', () => {
    expect(buildShareUrl('source', KBIN_POST, AUTH, COMMUNITY_ACTOR_ID))
      .toBe('https://kbin.social/m/mag/p/123/some-slug');
  });

  it('home + auth: returns home instance URL', () => {
    expect(buildShareUrl('home', POST, AUTH, COMMUNITY_ACTOR_ID))
      .toBe('https://beehaw.org/post/1');
  });

  it('home + no auth: falls back to source URL', () => {
    expect(buildShareUrl('home', POST, null, COMMUNITY_ACTOR_ID))
      .toBe('https://lemmy.world/post/1');
  });
});
