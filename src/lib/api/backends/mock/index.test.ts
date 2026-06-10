// src/lib/api/backends/mock/index.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBackend } from './index';
import { makePost, makeSource, makeUser, makeComment, resetIdCounter } from './fixtures';

describe('createMockBackend', () => {
  beforeEach(() => resetIdCounter());

  it('returns the configured capabilities', () => {
    const backend = createMockBackend({}, { canDownvote: false });
    expect(backend.capabilities.canDownvote).toBe(false);
  });

  it('lists a single all stak', () => {
    const backend = createMockBackend();
    expect(backend.listStaks()).toEqual([
      { sessionId: 'mock-session', id: 'all', label: 'All' },
    ]);
  });

  it('returns all fixture posts from getTimeline', async () => {
    const post = makePost({ title: 'Hello' });
    const backend = createMockBackend({ posts: [post] });
    const page = await backend.feed.getTimeline({ feedId: 'hot', stakId: 'all', cursor: null });
    expect(page.items).toEqual([post]);
    expect(page.nextCursor).toBeNull();
  });

  it('records votes', async () => {
    const post = makePost();
    const backend = createMockBackend({ posts: [post] });
    await backend.posts.vote(post.id, 1);
    expect(backend.state.votes[post.id]).toBe(1);
  });

  it('records saves', async () => {
    const post = makePost();
    const backend = createMockBackend({ posts: [post] });
    await backend.posts.save(post.id, true);
    expect(backend.state.saves[post.id]).toBe(true);
  });

  it('appends comments via create', async () => {
    const post = makePost();
    const backend = createMockBackend({ posts: [post], comments: { [post.id]: [] } });
    const c = await backend.comments.create({ postId: post.id, body: 'Hi' });
    const list = await backend.comments.list(post.id, { sortId: 'top' });
    expect(list).toContainEqual(c);
  });

  it('filters saved posts', async () => {
    const a = makePost({ id: 'a' });
    const b = makePost({ id: 'b' });
    const backend = createMockBackend({ posts: [a, b] });
    await backend.posts.save('a', true);
    const page = await backend.feed.getSavedPosts({ cursor: null });
    expect(page.items.map((p) => p.id)).toEqual(['a']);
  });

  it('returns user posts/comments by handle', async () => {
    const user = makeUser({ handle: 'alice@mock.test' });
    const post = makePost({ author: user });
    const comment = makeComment({ author: user, postId: post.id });
    const backend = createMockBackend({
      users: [user],
      posts: [post],
      comments: { [post.id]: [comment] },
    });
    expect((await backend.users.getPosts('alice@mock.test', { cursor: null })).items).toEqual([post]);
    expect((await backend.users.getComments('alice@mock.test', { cursor: null })).items).toEqual([comment]);
  });

  it('searches posts by title substring', async () => {
    const a = makePost({ title: 'apple pie' });
    const b = makePost({ title: 'cherry pie' });
    const backend = createMockBackend({ posts: [a, b] });
    const result = await backend.search.posts('apple', { cursor: null });
    expect(result.items).toEqual([a]);
  });

  it('marks notifications read and decrements unreadCount', async () => {
    const notif = { id: 'n1', kind: 'reply' as const, read: false, receivedAt: '2026-01-01T00:00:00Z',
      comment: makeComment(), post: { id: 'p1', title: 'p', permalink: 'https://x' } };
    const backend = createMockBackend({ notifications: [notif], unreadCount: 1 });
    await backend.notifications.markRead('n1');
    expect(await backend.notifications.unreadCount()).toBe(0);
    expect(backend.state.notifications[0].read).toBe(true);
  });
});
