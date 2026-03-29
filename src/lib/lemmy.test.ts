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
    const posts = await fetchPosts('lemmy.world', 'tok', 1);
    expect(posts).toHaveLength(1);
    expect(posts[0].post.id).toBe(1);
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
