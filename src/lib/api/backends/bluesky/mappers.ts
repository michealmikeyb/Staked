// src/lib/api/backends/bluesky/mappers.ts
import type { Post, Comment, User, Source, Vote } from '../../types';

export function encodeBlueskyId(uri: string, cid: string): string {
  return `${uri}|${cid}`;
}

export function parseBlueskyId(id: string): { uri: string; cid: string } {
  const i = id.lastIndexOf('|');
  if (i < 0) return { uri: id, cid: '' };
  return { uri: id.slice(0, i), cid: id.slice(i + 1) };
}

export function rkeyOf(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

export function mapUser(p: any): User {
  return {
    id: p.did,
    handle: p.handle,
    displayName: p.displayName || undefined,
    avatar: p.avatar || undefined,
    profileUrl: `https://bsky.app/profile/${p.handle}`,
    bio: p.description || undefined,
  };
}

export function placeholderSource(author: User): Source {
  return {
    id: author.id,
    handle: author.handle,
    name: author.handle,
    counts: { members: 0, posts: 0 },
  };
}

function imageThumbFromEmbed(embed: any): string | undefined {
  const type = embed?.$type as string | undefined;
  if (type === 'app.bsky.embed.images#view') return embed.images?.[0]?.thumb || undefined;
  if (type === 'app.bsky.embed.video#view') return embed.thumbnail || undefined;
  if (type === 'app.bsky.embed.external#view') return embed.external?.thumb || undefined;
  if (type === 'app.bsky.embed.recordWithMedia#view') return imageThumbFromEmbed(embed.media);
  return undefined;
}

function externalUriFromEmbed(embed: any): string | undefined {
  const type = embed?.$type as string | undefined;
  if (type === 'app.bsky.embed.external#view') return embed.external?.uri || undefined;
  if (type === 'app.bsky.embed.recordWithMedia#view') return externalUriFromEmbed(embed.media);
  return undefined;
}

export function mapPost(post: any): Post {
  const record = post.record ?? {};
  const author = mapUser(post.author);
  return {
    id: encodeBlueskyId(post.uri, post.cid),
    source: placeholderSource(author),
    author,
    title: undefined,
    body: record.text || undefined,
    mediaUrl: imageThumbFromEmbed(post.embed),
    externalUrl: externalUriFromEmbed(post.embed),
    nsfw: false,
    publishedAt: record.createdAt ?? post.indexedAt,
    permalink: `https://bsky.app/profile/${post.author.handle}/post/${rkeyOf(post.uri)}`,
    counts: { score: post.likeCount ?? 0, comments: post.replyCount ?? 0 },
    viewer: { vote: (post.viewer?.like ? 1 : 0) as Vote, saved: false },
  };
}

// Maps a single thread post node (ThreadViewPost) to a neutral comment.
// parentId/depth are supplied by the flattening walk in comments.ts.
export function mapThreadPost(post: any, parentId: string | null, depth: number, rootPostId: string): Comment {
  const record = post.record ?? {};
  return {
    id: encodeBlueskyId(post.uri, post.cid),
    postId: rootPostId,
    parentId,
    depth,
    author: mapUser(post.author),
    body: record.text ?? '',
    publishedAt: record.createdAt ?? post.indexedAt,
    permalink: `https://bsky.app/profile/${post.author.handle}/post/${rkeyOf(post.uri)}`,
    counts: { score: post.likeCount ?? 0 },
    viewer: { vote: (post.viewer?.like ? 1 : 0) as Vote },
  };
}
