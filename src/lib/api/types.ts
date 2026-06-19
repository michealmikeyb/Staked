// src/lib/api/types.ts

export type ID = string;
export type Vote = 1 | 0 | -1;

export interface User {
  id: ID;
  handle: string;
  displayName?: string;
  avatar?: string;
  profileUrl: string;
  bio?: string;
}

export interface Source {
  id: ID;
  handle: string;
  name: string;
  icon?: string;
  banner?: string;
  description?: string;
  counts: { members: number; posts: number };
  viewer?: { subscribed: 'yes' | 'no' | 'pending' };
}

export interface Post {
  id: ID;
  source: Source;
  author: User;
  title?: string;
  body?: string;
  mediaUrl?: string;
  externalUrl?: string;
  nsfw: boolean;
  publishedAt: string;
  permalink: string;
  counts: { score: number; comments: number };
  viewer?: { vote: Vote; saved: boolean };
}

export interface Comment {
  id: ID;
  postId: ID;
  parentId: ID | null;
  depth: number;
  author: User;
  body: string;
  publishedAt: string;
  permalink: string;
  counts: { score: number };
  viewer?: { vote: Vote };
  deleted?: boolean;
  removed?: boolean;
}

export type NotificationKind = 'reply' | 'mention' | 'like' | 'repost' | 'follow';

export interface Notification {
  id: ID;
  kind: NotificationKind;
  read: boolean;
  receivedAt: string;
  actor: User;                                       // who triggered it
  comment?: Comment;                                 // reply/mention only
  post?: Pick<Post, 'id' | 'title' | 'permalink'>;   // absent for follows
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Session {
  id: string;
  backendId: string;
  viewer: User | null;
  data: Record<string, unknown>;
}

export interface Stak {
  sessionId: string;
  id: string;
  label: string;
  icon?: string;
}

export interface SelectOption {
  id: string;
  label: string;
}

export interface ActiveStakRef {
  sessionId: string;
  stakId: string;
}
