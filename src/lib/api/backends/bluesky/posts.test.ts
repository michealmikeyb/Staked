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

  it('save throws (Bluesky has no saved posts)', async () => {
    const svc = createPostService(() => ({}));
    await expect(svc.save('id', true)).rejects.toThrow();
  });

  it('create posts a composed text body and returns the created post', async () => {
    const post = vi.fn().mockResolvedValue({ uri: 'at://x/app.bsky.feed.post/new', cid: 'c' });
    const getPosts = vi.fn().mockResolvedValue({ data: { posts: [fakePost('at://x/app.bsky.feed.post/new')] } });
    const svc = createPostService(() => ({ post, getPosts }));
    const created = await svc.create({ sourceHandle: 'x', title: 'Hi', body: 'there', url: 'https://e.com' });
    expect(post).toHaveBeenCalledWith({ text: 'Hi\n\nthere\n\nhttps://e.com' });
    expect(getPosts).toHaveBeenCalledWith({ uris: ['at://x/app.bsky.feed.post/new'] });
    expect(created.id).toBe('at://x/app.bsky.feed.post/new|c');
  });

  it('delete calls deletePost with the record uri', async () => {
    const deletePost = vi.fn().mockResolvedValue(undefined);
    const svc = createPostService(() => ({ deletePost }));
    await svc.delete('at://x/app.bsky.feed.post/1|c');
    expect(deletePost).toHaveBeenCalledWith('at://x/app.bsky.feed.post/1');
  });

  it('report files a moderation report with a strongRef subject', async () => {
    const createReport = vi.fn().mockResolvedValue({});
    const svc = createPostService(() => ({ com: { atproto: { moderation: { createReport } } } }));
    await svc.report('at://x/app.bsky.feed.post/1|cid7', 'Spam — bot');
    expect(createReport).toHaveBeenCalledWith({
      reasonType: 'com.atproto.moderation.defs#reasonSpam',
      reason: 'Spam — bot',
      subject: { $type: 'com.atproto.repo.strongRef', uri: 'at://x/app.bsky.feed.post/1', cid: 'cid7' },
    });
  });
});
