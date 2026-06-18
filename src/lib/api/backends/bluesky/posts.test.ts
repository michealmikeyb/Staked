import { describe, it, expect, vi } from 'vitest';
import { createPostService } from './posts';

function fakePost(uri: string, viewer: any = {}) {
  return { uri, cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 't', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 1, replyCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer };
}

describe('bluesky PostService', () => {
  it('get resolves a post by its encoded id', async () => {
    const getPosts = vi.fn().mockResolvedValue({ data: { posts: [fakePost('at://x/app.bsky.feed.post/1')] } });
    const svc = createPostService(() => ({ getPosts }));
    const post = await svc.get('at://x/app.bsky.feed.post/1|c');
    expect(getPosts).toHaveBeenCalledWith({ uris: ['at://x/app.bsky.feed.post/1'] });
    expect(post.id).toBe('at://x/app.bsky.feed.post/1|c');
  });

  it('vote(1) likes the post', async () => {
    const like = vi.fn().mockResolvedValue({ uri: 'at://like' });
    const svc = createPostService(() => ({ like }));
    await svc.vote('at://x/app.bsky.feed.post/1|cid9', 1);
    expect(like).toHaveBeenCalledWith('at://x/app.bsky.feed.post/1', 'cid9');
  });

  it('vote(0) unlikes when a like record exists', async () => {
    const getPosts = vi.fn().mockResolvedValue({ data: { posts: [fakePost('at://x/app.bsky.feed.post/1', { like: 'at://likeuri' })] } });
    const deleteLike = vi.fn().mockResolvedValue(undefined);
    const svc = createPostService(() => ({ getPosts, deleteLike }));
    await svc.vote('at://x/app.bsky.feed.post/1|c', 0);
    expect(deleteLike).toHaveBeenCalledWith('at://likeuri');
  });

  it('vote(-1) is a no-op when there is no like to remove', async () => {
    const getPosts = vi.fn().mockResolvedValue({ data: { posts: [fakePost('at://x/app.bsky.feed.post/1', {})] } });
    const deleteLike = vi.fn();
    const svc = createPostService(() => ({ getPosts, deleteLike }));
    await svc.vote('at://x/app.bsky.feed.post/1|c', -1);
    expect(deleteLike).not.toHaveBeenCalled();
  });

  it('create/save/report/delete throw', async () => {
    const svc = createPostService(() => ({}));
    await expect(svc.create({ sourceHandle: 'x' })).rejects.toThrow();
    await expect(svc.save('id', true)).rejects.toThrow();
    await expect(svc.report('id', 'r')).rejects.toThrow();
    await expect(svc.delete('id')).rejects.toThrow();
  });
});
