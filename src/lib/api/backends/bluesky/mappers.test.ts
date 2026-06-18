import { describe, it, expect } from 'vitest';
import { encodeBlueskyId, parseBlueskyId, mapUser, mapPost, rkeyOf, mapThreadPost } from './mappers';

const author = {
  did: 'did:plc:alice',
  handle: 'alice.bsky.social',
  displayName: 'Alice',
  avatar: 'https://cdn/av.png',
  description: 'hi there',
};

const postView = {
  uri: 'at://did:plc:alice/app.bsky.feed.post/abc123',
  cid: 'bafycid',
  author,
  record: { text: 'hello world', createdAt: '2026-02-01T00:00:00Z' },
  replyCount: 3,
  likeCount: 11,
  indexedAt: '2026-02-01T00:01:00Z',
  viewer: { like: 'at://did:plc:alice/app.bsky.feed.like/likerkey' },
  embed: {
    $type: 'app.bsky.embed.images#view',
    images: [{ thumb: 'https://cdn/thumb.jpg', fullsize: 'https://cdn/full.jpg', alt: '' }],
  },
};

describe('id encoding', () => {
  it('round-trips uri and cid', () => {
    const id = encodeBlueskyId('at://x/app.bsky.feed.post/r', 'cid1');
    expect(id).toBe('at://x/app.bsky.feed.post/r|cid1');
    expect(parseBlueskyId(id)).toEqual({ uri: 'at://x/app.bsky.feed.post/r', cid: 'cid1' });
  });
});

describe('rkeyOf', () => {
  it('returns the last path segment', () => {
    expect(rkeyOf('at://did:plc:alice/app.bsky.feed.post/abc123')).toBe('abc123');
  });
});

describe('mapUser', () => {
  it('maps a profile to a neutral user', () => {
    const u = mapUser(author);
    expect(u).toEqual({
      id: 'did:plc:alice',
      handle: 'alice.bsky.social',
      displayName: 'Alice',
      avatar: 'https://cdn/av.png',
      profileUrl: 'https://bsky.app/profile/alice.bsky.social',
      bio: 'hi there',
    });
  });
});

describe('mapPost', () => {
  it('maps a PostView to a neutral post', () => {
    const post = mapPost(postView);
    expect(post.id).toBe('at://did:plc:alice/app.bsky.feed.post/abc123|bafycid');
    expect(post.title).toBeUndefined();
    expect(post.body).toBe('hello world');
    expect(post.mediaUrl).toBe('https://cdn/thumb.jpg');
    expect(post.permalink).toBe('https://bsky.app/profile/alice.bsky.social/post/abc123');
    expect(post.counts).toEqual({ score: 11, comments: 3 });
    expect(post.viewer?.vote).toBe(1);
    expect(post.author.handle).toBe('alice.bsky.social');
    // source is a benign placeholder derived from the author
    expect(post.source.handle).toBe('alice.bsky.social');
  });

  it('extracts an external link embed', () => {
    const post = mapPost({
      ...postView,
      embed: { $type: 'app.bsky.embed.external#view', external: { uri: 'https://example.com', title: 't', description: 'd' } },
    });
    expect(post.externalUrl).toBe('https://example.com');
    expect(post.mediaUrl).toBeUndefined();
  });

  it('marks vote 0 when not liked', () => {
    const post = mapPost({ ...postView, viewer: {} });
    expect(post.viewer?.vote).toBe(0);
  });
});

describe('mapThreadPost', () => {
  const threadPostView = {
    uri: 'at://did:plc:alice/app.bsky.feed.post/abc123',
    cid: 'bafycid',
    author,
    record: { text: 'a thread reply', createdAt: '2026-02-01T00:00:00Z' },
    likeCount: 5,
    indexedAt: '2026-02-01T00:01:00Z',
    viewer: { like: 'at://did:plc:alice/app.bsky.feed.like/likerkey' },
  };

  it('maps a root node with parentId null and depth 0', () => {
    const comment = mapThreadPost(threadPostView, null, 0, 'at://root|c');
    expect(comment.parentId).toBeNull();
    expect(comment.depth).toBe(0);
    expect(comment.postId).toBe('at://root|c');
    expect(comment.id).toBe('at://did:plc:alice/app.bsky.feed.post/abc123|bafycid');
    expect(comment.body).toBe('a thread reply');
    expect(comment.counts.score).toBe(5);
    expect(comment.viewer?.vote).toBe(1);
  });

  it('maps vote 0 when viewer.like is absent', () => {
    const comment = mapThreadPost({ ...threadPostView, viewer: {} }, null, 0, 'at://root|c');
    expect(comment.viewer?.vote).toBe(0);
  });

  it('maps a child node with parentId and depth set', () => {
    const comment = mapThreadPost(threadPostView, 'at://parent|c', 1, 'at://root|c');
    expect(comment.parentId).toBe('at://parent|c');
    expect(comment.depth).toBe(1);
  });
});
