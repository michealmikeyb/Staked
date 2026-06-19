import { describe, it, expect, vi } from 'vitest';
import { createSearchService } from './search';

function postView(uri: string) {
  return { uri, cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 't', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, replyCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} };
}

describe('bluesky SearchService', () => {
  it('posts searches and maps results with the cursor', async () => {
    const searchPosts = vi.fn().mockResolvedValue({ data: { posts: [postView('at://x/app.bsky.feed.post/1')], cursor: 'nc' } });
    const svc = createSearchService(() => ({ app: { bsky: { feed: { searchPosts } } } }));
    const page = await svc.posts('cats', { cursor: null });
    expect(searchPosts).toHaveBeenCalledWith({ q: 'cats', cursor: undefined, limit: 25 });
    expect(page.items[0].id).toBe('at://x/app.bsky.feed.post/1|c');
    expect(page.nextCursor).toBe('nc');
  });

  it('posts forwards the pagination cursor', async () => {
    const searchPosts = vi.fn().mockResolvedValue({ data: { posts: [], cursor: null } });
    const svc = createSearchService(() => ({ app: { bsky: { feed: { searchPosts } } } }));
    await svc.posts('cats', { cursor: 'page2' });
    expect(searchPosts).toHaveBeenCalledWith({ q: 'cats', cursor: 'page2', limit: 25 });
  });

  it('sources returns empty (Bluesky has no communities)', async () => {
    const svc = createSearchService(() => ({}));
    expect(await svc.sources('x', { cursor: null })).toEqual({ items: [], nextCursor: null });
  });
});
