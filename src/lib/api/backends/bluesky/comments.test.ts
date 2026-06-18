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

  it('create/vote/edit/delete/report throw', async () => {
    const svc = createCommentService(() => ({}));
    await expect(svc.create({ postId: 'p', body: 'b' })).rejects.toThrow();
    await expect(svc.vote('c', 1)).rejects.toThrow();
    await expect(svc.edit('c', 'b')).rejects.toThrow();
    await expect(svc.delete('c')).rejects.toThrow();
    await expect(svc.report('c', 'r')).rejects.toThrow();
  });
});
