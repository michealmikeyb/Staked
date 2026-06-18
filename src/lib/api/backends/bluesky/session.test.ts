import { describe, it, expect } from 'vitest';
import { listBlueskyStaks, feedOptionsFromSession, resolveFeeds, DISCOVER_FEED_URI } from './session';
import type { Session } from '../../types';

function sessionWith(feeds: { id: string; label: string }[]): Session {
  return {
    id: 'bluesky:alice.bsky.social',
    backendId: 'bluesky',
    viewer: { id: 'did:plc:alice', handle: 'alice.bsky.social', profileUrl: 'https://bsky.app/profile/alice.bsky.social' },
    data: { service: 'https://bsky.social', did: 'did:plc:alice', handle: 'alice.bsky.social', accessJwt: 'a', refreshJwt: 'r', feeds } as any,
  };
}

describe('listBlueskyStaks', () => {
  it('returns a single Home stak', () => {
    expect(listBlueskyStaks(sessionWith([]))).toEqual([
      { sessionId: 'bluesky:alice.bsky.social', id: 'home', label: 'Home' },
    ]);
  });
});

describe('feedOptionsFromSession', () => {
  it('maps stored feeds to feed options', () => {
    const opts = feedOptionsFromSession(sessionWith([
      { id: 'following', label: 'Following' },
      { id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' },
    ]));
    expect(opts).toEqual([
      { id: 'following', label: 'Following' },
      { id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' },
    ]);
  });

  it('falls back to Following when no feeds are stored', () => {
    expect(feedOptionsFromSession(sessionWith([]))).toEqual([{ id: 'following', label: 'Following' }]);
  });
});

describe('resolveFeeds', () => {
  it('prepends Following and resolves pinned feed names', async () => {
    const agent = {
      app: { bsky: {
        actor: { getPreferences: async () => ({ data: { preferences: [
          { $type: 'app.bsky.actor.defs#savedFeedsPrefV2', items: [
            { type: 'timeline', value: 'following', pinned: true },
            { type: 'feed', value: 'at://x/app.bsky.feed.generator/sci', pinned: true },
            { type: 'feed', value: 'at://x/app.bsky.feed.generator/unpinned', pinned: false },
          ] },
        ] } }) },
        feed: { getFeedGenerators: async ({ feeds }: { feeds: string[] }) => ({ data: { feeds:
          feeds.map((uri) => ({ uri, displayName: 'Science' })) } }) },
      } },
    };
    const feeds = await resolveFeeds(agent);
    expect(feeds[0]).toEqual({ id: 'following', label: 'Following' });
    expect(feeds).toContainEqual({ id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' });
    expect(feeds.map((f) => f.id)).not.toContain('at://x/app.bsky.feed.generator/unpinned');
  });

  it('returns Following + Discover when preferences fail', async () => {
    const agent = { app: { bsky: { actor: { getPreferences: async () => { throw new Error('nope'); } } } } };
    const feeds = await resolveFeeds(agent);
    expect(feeds).toEqual([
      { id: 'following', label: 'Following' },
      { id: DISCOVER_FEED_URI, label: 'Discover' },
    ]);
  });
});
