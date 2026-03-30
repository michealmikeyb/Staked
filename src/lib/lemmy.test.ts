import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments, likeComment, createComment } from './lemmy';

// Mock the entire lemmy-js-client module
vi.mock('lemmy-js-client', () => {
  const MockLemmyHttp = vi.fn().mockImplementation(() => ({
    login: vi.fn().mockResolvedValue({ jwt: 'mock-token' }),
    getPosts: vi.fn().mockResolvedValue({ posts: [{ post: { id: 1, name: 'Test Post' } }] }),
    likePost: vi.fn().mockResolvedValue({}),
    savePost: vi.fn().mockResolvedValue({}),
    getComments: vi.fn().mockResolvedValue({ comments: [{ comment: { id: 1, content: 'Hello' } }] }),
    likeComment: vi.fn().mockResolvedValue({}),
    createComment: vi.fn().mockResolvedValue({
      comment_view: {
        comment: { id: 99, content: 'A reply', path: '0.1.99' },
        creator: { name: 'bob' },
        counts: { score: 1 },
      },
    }),
    getUnreadCount: vi.fn().mockResolvedValue({ replies: 3, mentions: 1, private_messages: 0 }),
    getReplies: vi.fn().mockResolvedValue({
      replies: [
        {
          comment_reply: { id: 10, read: false, published: '2026-03-29T10:00:00Z' },
          comment: { id: 5, content: 'Nice post!', path: '0.5' },
          post: { id: 1, name: 'Best programming languages for 2025?' },
          community: { id: 1, name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
          creator: { id: 2, name: 'alice', actor_id: 'https://lemmy.world/u/alice' },
          counts: { score: 1 },
        },
      ],
    }),
    getPersonMentions: vi.fn().mockResolvedValue({
      mentions: [
        {
          person_mention: { id: 20, read: false, published: '2026-03-29T09:00:00Z' },
          comment: { id: 6, content: 'Hey @me', path: '0.6' },
          post: { id: 2, name: 'Ask Lemmy: tips for Rust?' },
          community: { id: 2, name: 'rust', actor_id: 'https://lemmy.world/c/rust' },
          creator: { id: 3, name: 'bob', actor_id: 'https://lemmy.world/u/bob' },
          counts: { score: 2 },
        },
      ],
    }),
    markCommentReplyAsRead: vi.fn().mockResolvedValue({}),
    markPersonMentionAsRead: vi.fn().mockResolvedValue({}),
  }));
  return { LemmyHttp: MockLemmyHttp };
});

beforeEach(() => { vi.clearAllMocks(); });

describe('login', () => {
  it('returns the JWT on success', async () => {
    const token = await login('lemmy.world', 'alice', 'secret');
    expect(token).toBe('mock-token');
  });

  it('throws if jwt is absent from response', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    vi.mocked(LemmyHttp).mockImplementationOnce(() => ({
      login: vi.fn().mockResolvedValue({}),
    } as never));
    await expect(login('lemmy.world', 'alice', 'wrong')).rejects.toThrow('Login failed');
  });
});

describe('fetchPosts', () => {
  it('returns an array of PostView', async () => {
    const posts = await fetchPosts('lemmy.world', 'tok', 1, 'Hot');
    expect(posts).toHaveLength(1);
    expect(posts[0].post.id).toBe(1);
  });

  it('passes the sort type to getPosts', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await fetchPosts('lemmy.world', 'tok', 1, 'New');
    const mockInstance = vi.mocked(LemmyHttp).mock.results[0].value;
    expect(mockInstance.getPosts).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'New' }),
    );
  });
});

describe('upvotePost / downvotePost', () => {
  it('resolves without throwing', async () => {
    await expect(upvotePost('lemmy.world', 'tok', 1)).resolves.toBeUndefined();
    await expect(downvotePost('lemmy.world', 'tok', 1)).resolves.toBeUndefined();
  });
});

describe('savePost', () => {
  it('resolves without throwing', async () => {
    await expect(savePost('lemmy.world', 'tok', 1)).resolves.toBeUndefined();
  });
});

describe('fetchComments', () => {
  it('returns an array of CommentView', async () => {
    const comments = await fetchComments('lemmy.world', 'tok', 1);
    expect(comments).toHaveLength(1);
    expect(comments[0].comment.id).toBe(1);
  });
});

describe('likeComment', () => {
  it('resolves without throwing for score 1', async () => {
    await expect(likeComment('lemmy.world', 'tok', 42, 1)).resolves.toBeUndefined();
  });

  it('resolves without throwing for score 0 (undo)', async () => {
    await expect(likeComment('lemmy.world', 'tok', 42, 0)).resolves.toBeUndefined();
  });
});

describe('createComment', () => {
  it('returns the comment_view from the response', async () => {
    const cv = await createComment('lemmy.world', 'tok', 1, 'A reply', 10);
    expect(cv.comment.id).toBe(99);
    expect(cv.comment.content).toBe('A reply');
  });

  it('works without parentId (top-level)', async () => {
    const cv = await createComment('lemmy.world', 'tok', 1, 'Top level');
    expect(cv.comment.id).toBe(99);
  });
});

describe('fetchUnreadCount', () => {
  it('returns replies + mentions total', async () => {
    const { fetchUnreadCount } = await import('./lemmy');
    const count = await fetchUnreadCount('lemmy.world', 'tok');
    expect(count).toBe(4); // 3 replies + 1 mention
  });
});

describe('fetchReplies', () => {
  it('returns array of CommentReplyView', async () => {
    const { fetchReplies } = await import('./lemmy');
    const replies = await fetchReplies('lemmy.world', 'tok', true);
    expect(replies).toHaveLength(1);
    expect(replies[0].comment_reply.id).toBe(10);
  });

  it('passes unread_only flag', async () => {
    const { fetchReplies } = await import('./lemmy');
    const { LemmyHttp } = await import('lemmy-js-client');
    await fetchReplies('lemmy.world', 'tok', false);
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.getReplies).toHaveBeenCalledWith(
      expect.objectContaining({ unread_only: false }),
    );
  });
});

describe('fetchMentions', () => {
  it('returns array of PersonMentionView', async () => {
    const { fetchMentions } = await import('./lemmy');
    const mentions = await fetchMentions('lemmy.world', 'tok', true);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].person_mention.id).toBe(20);
  });

  it('passes unread_only flag', async () => {
    const { fetchMentions } = await import('./lemmy');
    const { LemmyHttp } = await import('lemmy-js-client');
    await fetchMentions('lemmy.world', 'tok', false);
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.getPersonMentions).toHaveBeenCalledWith(
      expect.objectContaining({ unread_only: false }),
    );
  });
});

describe('markReplyAsRead', () => {
  it('resolves without throwing', async () => {
    const { markReplyAsRead } = await import('./lemmy');
    await expect(markReplyAsRead('lemmy.world', 'tok', 10)).resolves.toBeUndefined();
  });

  it('calls markCommentReplyAsRead with read: true', async () => {
    const { markReplyAsRead } = await import('./lemmy');
    const { LemmyHttp } = await import('lemmy-js-client');
    await markReplyAsRead('lemmy.world', 'tok', 10);
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.markCommentReplyAsRead).toHaveBeenCalledWith({ comment_reply_id: 10, read: true });
  });
});

describe('markMentionAsRead', () => {
  it('resolves without throwing', async () => {
    const { markMentionAsRead } = await import('./lemmy');
    await expect(markMentionAsRead('lemmy.world', 'tok', 20)).resolves.toBeUndefined();
  });

  it('calls markPersonMentionAsRead with read: true', async () => {
    const { markMentionAsRead } = await import('./lemmy');
    const { LemmyHttp } = await import('lemmy-js-client');
    await markMentionAsRead('lemmy.world', 'tok', 20);
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.markPersonMentionAsRead).toHaveBeenCalledWith({ person_mention_id: 20, read: true });
  });
});

describe('fetchSavedPosts', () => {
  it('calls getPosts with type_ Saved and returns posts', async () => {
    const mockPost = {
      post: { id: 1, name: 'Saved Post', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null },
      community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
      creator: { name: 'alice', display_name: null },
      counts: { score: 10, comments: 2, child_count: 2 },
    };
    const { fetchSavedPosts } = await import('./lemmy');
    const result = await fetchSavedPosts('lemmy.world', 'mytoken', 1);

    const { LemmyHttp } = await import('lemmy-js-client');
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.getPosts).toHaveBeenCalledWith({
      type_: 'Saved',
      sort: 'New',
      page: 1,
      limit: 20,
    });
    expect(result).toHaveLength(1);
    expect(result[0].post.id).toBe(1);
  });
});
