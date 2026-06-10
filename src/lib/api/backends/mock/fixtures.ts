// src/lib/api/backends/mock/fixtures.ts
import type { Post, Comment, User, Source, Notification, ID } from '../../types';

let idCounter = 1;
function nextId(): string {
  return String(idCounter++);
}

export function resetIdCounter(): void {
  idCounter = 1;
}

export function makeUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? nextId();
  const handle = overrides.handle ?? `user${id}@mock.test`;
  return {
    id,
    handle,
    displayName: overrides.displayName,
    avatar: overrides.avatar,
    profileUrl: overrides.profileUrl ?? `https://mock.test/u/${handle}`,
    bio: overrides.bio,
  };
}

export function makeSource(overrides: Partial<Source> = {}): Source {
  const id = overrides.id ?? nextId();
  const handle = overrides.handle ?? `src${id}@mock.test`;
  const name = overrides.name ?? `src${id}`;
  return {
    id,
    handle,
    name,
    icon: overrides.icon,
    banner: overrides.banner,
    description: overrides.description,
    counts: overrides.counts ?? { members: 0, posts: 0 },
    viewer: overrides.viewer,
  };
}

export function makePost(overrides: Partial<Post> = {}): Post {
  const id = overrides.id ?? nextId();
  return {
    id,
    source: overrides.source ?? makeSource(),
    author: overrides.author ?? makeUser(),
    title: overrides.title ?? `Post ${id}`,
    body: overrides.body,
    mediaUrl: overrides.mediaUrl,
    externalUrl: overrides.externalUrl,
    nsfw: overrides.nsfw ?? false,
    publishedAt: overrides.publishedAt ?? new Date().toISOString(),
    permalink: overrides.permalink ?? `https://mock.test/p/${id}`,
    counts: overrides.counts ?? { score: 0, comments: 0 },
    viewer: overrides.viewer,
  };
}

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  const id = overrides.id ?? nextId();
  return {
    id,
    postId: overrides.postId ?? '1',
    parentId: overrides.parentId ?? null,
    depth: overrides.depth ?? 0,
    author: overrides.author ?? makeUser(),
    body: overrides.body ?? `Comment ${id}`,
    publishedAt: overrides.publishedAt ?? new Date().toISOString(),
    permalink: overrides.permalink ?? `https://mock.test/c/${id}`,
    counts: overrides.counts ?? { score: 0 },
    viewer: overrides.viewer,
    deleted: overrides.deleted,
    removed: overrides.removed,
  };
}

export function makeNotification(overrides: Partial<Notification> = {}): Notification {
  const id = overrides.id ?? nextId();
  return {
    id,
    kind: overrides.kind ?? 'reply',
    read: overrides.read ?? false,
    receivedAt: overrides.receivedAt ?? new Date().toISOString(),
    comment: overrides.comment ?? makeComment(),
    post: overrides.post ?? { id: '1', title: 'Post 1', permalink: 'https://mock.test/p/1' },
  };
}

export interface MockFixtures {
  users?: User[];
  sources?: Source[];
  posts?: Post[];
  comments?: Record<ID, Comment[]>;
  notifications?: Notification[];
  unreadCount?: number;
}
