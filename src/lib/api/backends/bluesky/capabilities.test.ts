import { describe, it, expect } from 'vitest';
import { buildBlueskyCapabilities } from './capabilities';
import type { Session } from '../../types';

const ANON: Session = { id: 'anon:bluesky', backendId: 'bluesky', viewer: null, data: {} as any };

function loggedIn(feeds: { id: string; label: string }[]): Session {
  return { id: 'bluesky:alice.bsky.social', backendId: 'bluesky', viewer: null,
    data: { feeds } as any };
}

describe('bluesky capabilities', () => {
  it('declares display name, icon, and no sources / no downvote', () => {
    const caps = buildBlueskyCapabilities(ANON);
    expect(caps.displayName).toBe('Bluesky');
    expect(caps.icon).toBe('🦋');
    expect(caps.hasSources).toBe(false);
    expect(caps.canDownvote).toBe(false);
    expect(caps.hasSavedPosts).toBe(false);
    expect(caps.commentSortOptions).toEqual([]);
  });

  it('declares the login fields the add-account form needs', () => {
    const keys = buildBlueskyCapabilities(ANON).loginFields.map((f) => f.key);
    expect(keys).toEqual(['identifier', 'appPassword']);
    const pw = buildBlueskyCapabilities(ANON).loginFields.find((f) => f.key === 'appPassword')!;
    expect(pw.type).toBe('password');
  });

  it('derives feedOptions from the session feeds', () => {
    const caps = buildBlueskyCapabilities(loggedIn([
      { id: 'following', label: 'Following' },
      { id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' },
    ]));
    expect(caps.feedOptions).toEqual([
      { id: 'following', label: 'Following' },
      { id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' },
    ]);
  });

  it('falls back to a single Following option before login', () => {
    expect(buildBlueskyCapabilities(ANON).feedOptions).toEqual([{ id: 'following', label: 'Following' }]);
  });
});
