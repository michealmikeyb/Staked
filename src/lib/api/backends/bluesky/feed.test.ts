import { describe, it, expect, vi } from 'vitest';
import { createFeedService } from './feed';

function fakePost(uri: string) {
  return { uri, cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 't', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, replyCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} };
}

describe('bluesky FeedService', () => {
  it('routes the following feed to getTimeline', async () => {
    const getTimeline = vi.fn().mockResolvedValue({ data: { feed: [{ post: fakePost('at://x/app.bsky.feed.post/1') }], cursor: 'next' } });
    const agent = { getTimeline, app: { bsky: { feed: { getFeed: vi.fn() } } } };
    const svc = createFeedService(() => agent);
    const page = await svc.getTimeline({ feedId: 'following', stakId: 'home', cursor: null });
    expect(getTimeline).toHaveBeenCalledWith({ cursor: undefined, limit: 30 });
    expect(page.items[0].id).toBe('at://x/app.bsky.feed.post/1|c');
    expect(page.nextCursor).toBe('next');
  });

  it('routes a feed uri to getFeed and passes the cursor', async () => {
    const getFeed = vi.fn().mockResolvedValue({ data: { feed: [{ post: fakePost('at://x/app.bsky.feed.post/2') }], cursor: undefined } });
    const agent = { getTimeline: vi.fn(), app: { bsky: { feed: { getFeed } } } };
    const svc = createFeedService(() => agent);
    const page = await svc.getTimeline({ feedId: 'at://x/app.bsky.feed.generator/sci', stakId: 'home', cursor: 'cur' });
    expect(getFeed).toHaveBeenCalledWith({ feed: 'at://x/app.bsky.feed.generator/sci', cursor: 'cur', limit: 30 });
    expect(page.nextCursor).toBeNull();
  });

  it('getSavedPosts returns an empty page', async () => {
    const svc = createFeedService(() => ({}));
    expect(await svc.getSavedPosts({ cursor: null })).toEqual({ items: [], nextCursor: null });
  });

  it('getSourceFeed throws (no communities)', async () => {
    const svc = createFeedService(() => ({}));
    await expect(svc.getSourceFeed('x', { feedId: 'f', cursor: null })).rejects.toThrow();
  });
});
