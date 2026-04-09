import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments, likeComment, createComment, editComment, fetchPersonDetails, fetchPost, resolveCommunityId, createPost, uploadImage, searchCommunities, searchPosts } from './lemmy';

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
    editComment: vi.fn().mockResolvedValue({
      comment_view: {
        comment: { id: 7, content: 'Edited content', path: '0.7', ap_id: 'https://lemmy.world/comment/7' },
        creator: { name: 'alice' },
        counts: { score: 3 },
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
    getPersonDetails: vi.fn().mockResolvedValue({
      person_view: {},
      posts: [{ post: { id: 1, name: 'Test Post' }, community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' }, creator: { name: 'alice', display_name: null }, counts: { score: 10, comments: 2 } }],
      comments: [{ comment: { id: 5, content: 'Great post!', ap_id: 'https://lemmy.world/comment/5', path: '0.5', published: '2026-03-29T10:00:00Z' }, post: { id: 1, name: 'Test Post', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null }, community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' }, creator: { name: 'alice', display_name: null }, counts: { score: 3 } }],
    }),
    getPost: vi.fn().mockResolvedValue({
      post_view: {
        post: { id: 5, name: 'Shared Post', ap_id: 'https://lemmy.world/post/5', url: null, body: null, thumbnail_url: null },
        community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
        creator: { name: 'carol', display_name: null },
        counts: { score: 55, comments: 3 },
      },
    }),
    getCommunity: vi.fn().mockResolvedValue({
      community_view: { community: { id: 42 } },
    }),
    createPost: vi.fn().mockResolvedValue({ post_view: { post: { id: 99 } } }),
    search: vi.fn().mockResolvedValue({
      type_: 'All',
      communities: [
        {
          community: {
            id: 10,
            name: 'rust',
            actor_id: 'https://lemmy.world/c/rust',
            icon: undefined,
            description: 'The Rust programming language',
          },
          counts: { subscribers: 5000 },
        },
      ],
      posts: [
        { post: { id: 99, name: 'Rust is great', ap_id: 'https://lemmy.world/post/99' }, counts: { score: 50, comments: 10 } },
      ],
      comments: [],
      users: [],
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

    const { LemmyHttp } = await import('lemmy-js-client');
    vi.mocked(LemmyHttp).mockImplementationOnce(() => ({
      getPosts: vi.fn().mockResolvedValue({ posts: [mockPost] }),
    } as never));

    const { fetchSavedPosts } = await import('./lemmy');
    const result = await fetchSavedPosts('lemmy.world', 'mytoken', 1);

    expect(result).toEqual([mockPost]);
    expect(result[0].post.ap_id).toBe('https://lemmy.world/post/1');
    expect(result[0].community.name).toBe('tech');
  });
});

describe('fetchPersonDetails', () => {
  it('returns posts and comments for the user', async () => {
    const result = await fetchPersonDetails('lemmy.world', 'tok', 'alice', 1);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].post.name).toBe('Test Post');
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].comment.content).toBe('Great post!');
  });

  it('calls getPersonDetails with correct params', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await fetchPersonDetails('lemmy.world', 'tok', 'alice', 2);
    const instance = vi.mocked(LemmyHttp).mock.results[0].value;
    expect(instance.getPersonDetails).toHaveBeenCalledWith({
      username: 'alice',
      sort: 'New',
      page: 2,
      limit: 20,
    });
  });
});

describe('fetchPost', () => {
  it('returns the post_view from getPost', async () => {
    const result = await fetchPost('lemmy.world', 5);
    expect(result.post.name).toBe('Shared Post');
    expect(result.post.id).toBe(5);
  });
});

describe('fetchCommunityPosts', () => {
  it('calls getPosts with the community_name ref', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    const { fetchCommunityPosts } = await import('./lemmy');
    await fetchCommunityPosts('lemmy.world', 'tok', 'asklemmy@lemmy.world', 1, 'New');
    const mockInstance = vi.mocked(LemmyHttp).mock.results[0].value;
    expect(mockInstance.getPosts).toHaveBeenCalledWith(
      expect.objectContaining({ community_name: 'asklemmy@lemmy.world', sort: 'New', page: 1 }),
    );
  });

  it('returns the posts array', async () => {
    const { fetchCommunityPosts } = await import('./lemmy');
    const posts = await fetchCommunityPosts('lemmy.world', 'tok', 'asklemmy@lemmy.world', 1, 'Active');
    expect(posts).toHaveLength(1);
    expect(posts[0].post.id).toBe(1);
  });
});

describe('editComment', () => {
  it('returns the updated comment_view', async () => {
    const cv = await editComment('lemmy.world', 'tok', 7, 'Edited content');
    expect(cv.comment.id).toBe(7);
    expect(cv.comment.content).toBe('Edited content');
  });

  it('calls client.editComment with comment_id and content', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await editComment('lemmy.world', 'tok', 7, 'Edited content');
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.editComment).toHaveBeenCalledWith({
      comment_id: 7,
      content: 'Edited content',
    });
  });
});

describe('resolveCommunityId', () => {
  it('returns the community id', async () => {
    const id = await resolveCommunityId('lemmy.world', 'tok', 'programming@lemmy.world');
    expect(id).toBe(42);
  });

  it('calls getCommunity with the community ref', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await resolveCommunityId('lemmy.world', 'tok', 'programming@lemmy.world');
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.getCommunity).toHaveBeenCalledWith({ name: 'programming@lemmy.world' });
  });
});

describe('createPost', () => {
  it('calls LemmyHttp.createPost with the right params', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await createPost('lemmy.world', 'tok', { name: 'Test post', community_id: 42, url: 'https://example.com' });
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.createPost).toHaveBeenCalledWith({
      name: 'Test post',
      community_id: 42,
      url: 'https://example.com',
    });
  });

  it('resolves without throwing', async () => {
    await expect(
      createPost('lemmy.world', 'tok', { name: 'Hello', community_id: 1 }),
    ).resolves.toBeUndefined();
  });
});

describe('uploadImage', () => {
  it('returns the full image url on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: [{ file: 'abc123.jpg' }] }),
    } as unknown as Response));
    const url = await uploadImage('lemmy.world', 'tok', new File([''], 'test.jpg'));
    expect(url).toBe('https://lemmy.world/pictrs/image/abc123.jpg');
  });

  it('sends Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: [{ file: 'x.png' }] }),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    await uploadImage('lemmy.world', 'tok', new File([''], 'test.png'));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://lemmy.world/pictrs/image',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 413 } as unknown as Response));
    await expect(uploadImage('lemmy.world', 'tok', new File([''], 'big.jpg')))
      .rejects.toThrow('Upload failed: 413');
  });

  it('throws when files array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    } as unknown as Response));
    await expect(uploadImage('lemmy.world', 'tok', new File([''], 'test.jpg')))
      .rejects.toThrow('Upload failed: no file returned');
  });
});

describe('searchCommunities', () => {
  it('calls search with Communities type and returns communities array', async () => {
    const result = await searchCommunities('lemmy.world', 'tok', 'rust', 1);
    expect(result).toHaveLength(1);
    expect(result[0].community.name).toBe('rust');
  });
});

describe('searchPosts', () => {
  it('calls search with Posts type and returns posts array', async () => {
    const result = await searchPosts('lemmy.world', 'tok', 'rust', 1);
    expect(result).toHaveLength(1);
    expect(result[0].post.name).toBe('Rust is great');
  });
});
