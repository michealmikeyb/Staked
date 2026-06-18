import { describe, it, expect, vi } from 'vitest';
import { createUserService } from './users';

describe('bluesky UserService', () => {
  it('get maps a profile', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: { did: 'did:plc:a', handle: 'a.bsky.social', displayName: 'A', description: 'bio' } });
    const svc = createUserService(() => ({ getProfile }));
    const user = await svc.get('a.bsky.social');
    expect(getProfile).toHaveBeenCalledWith({ actor: 'a.bsky.social' });
    expect(user.handle).toBe('a.bsky.social');
    expect(user.bio).toBe('bio');
  });

  it('getPosts maps the author feed and passes the cursor', async () => {
    const getAuthorFeed = vi.fn().mockResolvedValue({ data: { feed: [{ post: { uri: 'at://x/app.bsky.feed.post/1', cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 't', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, replyCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} } }], cursor: 'nc' } });
    const svc = createUserService(() => ({ getAuthorFeed }));
    const page = await svc.getPosts('a.bsky.social', { cursor: 'cur' });
    expect(getAuthorFeed).toHaveBeenCalledWith({ actor: 'a.bsky.social', cursor: 'cur', limit: 30 });
    expect(page.items[0].id).toBe('at://x/app.bsky.feed.post/1|c');
    expect(page.nextCursor).toBe('nc');
  });

  it('getComments returns an empty page and block is a no-op', async () => {
    const svc = createUserService(() => ({}));
    expect((await svc.getComments('a.bsky.social', { cursor: null })).items).toEqual([]);
    await expect(svc.block('id', true)).resolves.toBeUndefined();
  });
});
