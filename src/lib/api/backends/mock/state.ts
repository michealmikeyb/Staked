// src/lib/api/backends/mock/state.ts
import type { Post, Comment, User, Source, Notification, Vote } from '../../types';

export interface MockState {
  users: Map<string, User>;            // keyed by handle
  sources: Map<string, Source>;        // keyed by handle
  posts: Map<string, Post>;            // keyed by id
  comments: Map<string, Comment[]>;    // keyed by postId
  notifications: Notification[];
  votes: Record<string, Vote>;         // postId or commentId → vote
  saves: Record<string, boolean>;      // postId → saved
  subs: Record<string, boolean>;       // sourceId → subscribed
  blockedUsers: Set<string>;
  blockedSources: Set<string>;
  unreadCount: number;
}

export function createMockState(): MockState {
  return {
    users: new Map(),
    sources: new Map(),
    posts: new Map(),
    comments: new Map(),
    notifications: [],
    votes: {},
    saves: {},
    subs: {},
    blockedUsers: new Set(),
    blockedSources: new Set(),
    unreadCount: 0,
  };
}
