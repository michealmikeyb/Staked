// src/lib/api/backends/lemmy/mappers.ts
import type {
  PostView, CommentView, Person, Community, CommunityView, CommentReplyView, PersonMentionView,
} from 'lemmy-js-client';
import type { Post, Comment, User, Source, Notification, Vote } from '../../types';
import { instanceFromActorId } from './client';

export function mapUser(p: Person): User {
  return {
    id: String(p.id),
    handle: `${p.name}@${instanceFromActorId(p.actor_id)}`,
    displayName: p.display_name ?? undefined,
    avatar: p.avatar ?? undefined,
    profileUrl: p.actor_id,
    bio: (p as any).bio ?? undefined,
  };
}

export function mapSource(c: Community, counts?: { subscribers: number; posts: number; comments: number }, subscribed?: string): Source {
  return {
    id: String(c.id),
    handle: `${c.name}@${instanceFromActorId(c.actor_id)}`,
    name: c.title || c.name,
    icon: c.icon ?? undefined,
    banner: c.banner ?? undefined,
    description: c.description ?? undefined,
    counts: { members: counts?.subscribers ?? 0, posts: counts?.posts ?? 0 },
    viewer: subscribed
      ? { subscribed: subscribed === 'Subscribed' ? 'yes' : subscribed === 'Pending' ? 'pending' : 'no' }
      : undefined,
  };
}

export function mapSourceFromView(cv: CommunityView): Source {
  return mapSource(cv.community, cv.counts as any, cv.subscribed);
}

export function encodePostId(localId: number, apId: string): string {
  return `${localId}|${apId}`;
}

export function parsePostId(encoded: string): { localId: number; apId: string } {
  const i = encoded.indexOf('|');
  if (i < 0) throw new Error(`Malformed postId: ${encoded}`);
  return { localId: parseInt(encoded.slice(0, i), 10), apId: encoded.slice(i + 1) };
}

export function encodeCommentId(localId: number, apId: string): string {
  return `${localId}|${apId}`;
}

export function parseCommentId(encoded: string): { localId: number; apId: string } {
  const i = encoded.indexOf('|');
  if (i < 0) return { localId: parseInt(encoded, 10), apId: '' };
  return { localId: parseInt(encoded.slice(0, i), 10), apId: encoded.slice(i + 1) };
}

export function mapPost(pv: PostView): Post {
  const p = pv.post;
  const community = pv.community;
  return {
    id: encodePostId(p.id, p.ap_id),
    source: mapSource(community, pv.counts as any, pv.subscribed),
    author: mapUser(pv.creator),
    title: p.name,
    body: p.body ?? undefined,
    mediaUrl: p.thumbnail_url ?? undefined,
    externalUrl: p.url ?? undefined,
    nsfw: !!p.nsfw,
    publishedAt: p.published,
    permalink: p.ap_id,
    counts: { score: (pv.counts as any)?.score ?? 0, comments: (pv.counts as any)?.comments ?? 0 },
    viewer: { vote: ((pv as any).my_vote ?? 0) as Vote, saved: !!pv.saved },
  };
}

function parentLocalIdFromPath(path: string): number | null {
  const parts = path.split('.');
  if (parts.length < 3) return null;
  return parseInt(parts[parts.length - 2], 10);
}

function depthFromPath(path: string): number {
  return Math.max(0, path.split('.').length - 2);
}

export function mapComment(cv: CommentView): Comment {
  const c = cv.comment;
  const parentLocalId = parentLocalIdFromPath(c.path);
  return {
    id: encodeCommentId(c.id, c.ap_id),
    postId: encodePostId(cv.post.id, cv.post.ap_id),
    parentId: parentLocalId != null ? encodeCommentId(parentLocalId, '') : null,
    depth: depthFromPath(c.path),
    author: mapUser(cv.creator),
    body: c.content,
    publishedAt: c.published,
    permalink: c.ap_id,
    counts: { score: (cv.counts as any)?.score ?? 0 },
    viewer: { vote: ((cv as any).my_vote ?? 0) as Vote },
    deleted: c.deleted || undefined,
    removed: c.removed || undefined,
  };
}

export function mapComments(views: CommentView[]): Comment[] {
  const localIdToApId = new Map<number, string>();
  for (const cv of views) localIdToApId.set(cv.comment.id, cv.comment.ap_id);
  return views.map((cv) => {
    const c = cv.comment;
    const parentLocalId = parentLocalIdFromPath(c.path);
    const parentApId = parentLocalId != null ? (localIdToApId.get(parentLocalId) ?? '') : '';
    return {
      id: encodeCommentId(c.id, c.ap_id),
      postId: encodePostId(cv.post.id, cv.post.ap_id),
      parentId: parentLocalId != null ? encodeCommentId(parentLocalId, parentApId) : null,
      depth: depthFromPath(c.path),
      author: mapUser(cv.creator),
      body: c.content,
      publishedAt: c.published,
      permalink: c.ap_id,
      counts: { score: (cv.counts as any)?.score ?? 0 },
      viewer: { vote: ((cv as any).my_vote ?? 0) as Vote },
      deleted: c.deleted || undefined,
      removed: c.removed || undefined,
    };
  });
}

export function mapReply(rv: CommentReplyView): Notification {
  return {
    id: `reply-${rv.comment_reply.id}`,
    kind: 'reply',
    read: rv.comment_reply.read,
    receivedAt: rv.comment.published,
    comment: mapComment(rv as any),
    post: {
      id: encodePostId(rv.post.id, rv.post.ap_id),
      title: rv.post.name,
      permalink: rv.post.ap_id,
    },
  };
}

export function mapMention(mv: PersonMentionView): Notification {
  return {
    id: `mention-${mv.person_mention.id}`,
    kind: 'mention',
    read: mv.person_mention.read,
    receivedAt: mv.comment.published,
    comment: mapComment(mv as any),
    post: {
      id: encodePostId(mv.post.id, mv.post.ap_id),
      title: mv.post.name,
      permalink: mv.post.ap_id,
    },
  };
}
