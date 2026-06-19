import { describe, it, expect, vi } from 'vitest';
import { createCommentService } from './comments';

function node(uri: string, text: string, replies: any[] = []) {
  return {
    post: { uri, cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text, createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} },
    replies,
  };
}

describe('bluesky CommentService', () => {
  it('flattens a reply thread depth-first with parent ids and depth', async () => {
    const thread = node('at://root', 'root', [
      node('at://r1', 'first', [node('at://r1a', 'nested')]),
      node('at://r2', 'second'),
    ]);
    const getPostThread = vi.fn().mockResolvedValue({ data: { thread } });
    const svc = createCommentService(() => ({ getPostThread }));
    const page = await svc.list('at://root|c', { sortId: 'top' });
    expect(getPostThread).toHaveBeenCalledWith({ uri: 'at://root', depth: 6 });
    expect(page.items.map((c) => [c.body, c.depth, c.parentId])).toEqual([
      ['first', 0, null],
      ['nested', 1, 'at://r1|c'],
      ['second', 0, null],
    ]);
    expect(page.items.every((c) => c.postId === 'at://root|c')).toBe(true);
    expect(page.nextCursor).toBeNull();
  });

  it('returns an empty page for a blocked/not-found thread', async () => {
    const getPostThread = vi.fn().mockResolvedValue({ data: { thread: { $type: 'app.bsky.feed.defs#notFoundPost' } } });
    const svc = createCommentService(() => ({ getPostThread }));
    expect((await svc.list('at://x|c', { sortId: 'top' })).items).toEqual([]);
  });

  it('vote(1) likes the comment record', async () => {
    const like = vi.fn().mockResolvedValue({ uri: 'at://like' });
    const svc = createCommentService(() => ({ like }));
    await svc.vote('at://r1/app.bsky.feed.post/x|cid3', 1);
    expect(like).toHaveBeenCalledWith('at://r1/app.bsky.feed.post/x', 'cid3');
  });

  it('create posts a reply with root and parent strong refs', async () => {
    const post = vi.fn().mockResolvedValue({ uri: 'at://reply/new', cid: 'rc' });
    const getPosts = vi.fn().mockResolvedValue({
      data: { posts: [{ uri: 'at://reply/new', cid: 'rc', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 'hi', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} }] },
    });
    const svc = createCommentService(() => ({ post, getPosts }));
    const c = await svc.create({ postId: 'at://root|rcid', parentId: 'at://parent|pcid', body: 'hi' });
    expect(post).toHaveBeenCalledWith({
      text: 'hi',
      reply: {
        root: { uri: 'at://root', cid: 'rcid' },
        parent: { uri: 'at://parent', cid: 'pcid' },
      },
    });
    expect(c.parentId).toBe('at://parent|pcid');
    expect(c.postId).toBe('at://root|rcid');
    expect(c.body).toBe('hi');
  });

  it('create replies to the post itself when no parent is given', async () => {
    const post = vi.fn().mockResolvedValue({ uri: 'at://reply/new', cid: 'rc' });
    const getPosts = vi.fn().mockResolvedValue({
      data: { posts: [{ uri: 'at://reply/new', cid: 'rc', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 'hi', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} }] },
    });
    const svc = createCommentService(() => ({ post, getPosts }));
    const c = await svc.create({ postId: 'at://root|rcid', body: 'hi' });
    expect(post.mock.calls[0][0].reply.parent).toEqual({ uri: 'at://root', cid: 'rcid' });
    expect(c.parentId).toBeNull();
  });

  it('delete calls deletePost with the comment uri', async () => {
    const deletePost = vi.fn().mockResolvedValue(undefined);
    const svc = createCommentService(() => ({ deletePost }));
    await svc.delete('at://r1/app.bsky.feed.post/x|c');
    expect(deletePost).toHaveBeenCalledWith('at://r1/app.bsky.feed.post/x');
  });

  it('report files a moderation report for the comment', async () => {
    const createReport = vi.fn().mockResolvedValue({});
    const svc = createCommentService(() => ({ com: { atproto: { moderation: { createReport } } } }));
    await svc.report('at://r1/app.bsky.feed.post/x|cid', 'Harassment');
    expect(createReport).toHaveBeenCalledWith(expect.objectContaining({
      reasonType: 'com.atproto.moderation.defs#reasonRude',
      subject: { $type: 'com.atproto.repo.strongRef', uri: 'at://r1/app.bsky.feed.post/x', cid: 'cid' },
    }));
  });

  it('edit throws (Bluesky has no edit)', async () => {
    const svc = createCommentService(() => ({}));
    await expect(svc.edit('c', 'b')).rejects.toThrow();
  });
});
