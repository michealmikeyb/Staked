// src/lib/api/backends/mock/index.ts
import type { Backend } from '../../backend';
import type { Capabilities } from '../../capabilities';
import type {
  Session, Post, Comment, Page, Stak,
} from '../../types';
import { createMockState, type MockState } from './state';
import type { MockFixtures } from './fixtures';

const DEFAULT_CAPABILITIES: Capabilities = {
  canDownvote: true,
  canBrowseAnonymously: true,
  hasNsfwFlag: true,
  hasSavedPosts: true,
  feedOptions: [
    { id: 'hot', label: 'Hot' },
    { id: 'new', label: 'New' },
    { id: 'top', label: 'Top' },
  ],
  commentSortOptions: [
    { id: 'top', label: 'Top' },
    { id: 'new', label: 'New' },
  ],
  sourceNoun: 'Source',
  displayName: 'Mock',
  icon: '🧪',
  loginFields: [
    { key: 'instance', label: 'Instance', type: 'instance', required: true },
    { key: 'usernameOrEmail', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
};

export interface MockBackend extends Backend {
  state: MockState;
}

export function createMockBackend(
  fixtures: MockFixtures = {},
  capabilitiesOverride: Partial<Capabilities> = {},
  anonymous = false,
): MockBackend {
  const state = createMockState();
  fixtures.users?.forEach((u) => state.users.set(u.handle, u));
  fixtures.sources?.forEach((s) => state.sources.set(s.handle, s));
  fixtures.posts?.forEach((p) => state.posts.set(p.id, p));
  fixtures.savedPosts?.forEach((p) => { state.posts.set(p.id, p); state.saves[p.id] = true; });
  if (fixtures.comments) {
    for (const [postId, comments] of Object.entries(fixtures.comments)) {
      state.comments.set(postId, comments);
    }
  }
  state.notifications = fixtures.notifications ?? [];
  state.unreadCount = fixtures.unreadCount ?? 0;

  const session: Session | null = anonymous ? null : {
    id: 'mock-session',
    backendId: 'mock',
    viewer: { id: 'viewer', handle: 'viewer@mock.test', profileUrl: 'https://mock.test/u/viewer' },
    data: {},
  };

  const capabilities: Capabilities = { ...DEFAULT_CAPABILITIES, ...capabilitiesOverride };

  const pageOf = <T>(items: T[]): Page<T> => ({ items, nextCursor: null });

  const backend: MockBackend = {
    backendId: 'mock',
    capabilities,
    session,
    state,

    listStaks(): Stak[] {
      const sid = session?.id ?? '';
      const base: Stak[] = [
        { sessionId: sid, id: 'all', label: 'All' },
        { sessionId: sid, id: 'local', label: 'Local' },
      ];
      if (session) base.push({ sessionId: sid, id: 'subscribed', label: 'Subscribed' });
      return base;
    },

    auth: {
      async login(_credentials) { return session!; },
      async logout() {},
    },

    feed: {
      async getTimeline(_opts) { return pageOf([...state.posts.values()]); },
      async getSourceFeed(handle, _opts) {
        return pageOf([...state.posts.values()].filter((p) => p.source.handle === handle));
      },
      async getSavedPosts(_opts) {
        return pageOf([...state.posts.values()].filter((p) => state.saves[p.id]));
      },
    },

    posts: {
      async get(postId) {
        const p = state.posts.get(postId);
        if (!p) throw new Error(`Mock: no post ${postId}`);
        return p;
      },
      async getByPermalink(url) {
        return [...state.posts.values()].find((p) => p.permalink === url) ?? null;
      },
      async vote(postId, vote) { state.votes[postId] = vote; },
      async save(postId, saved) { state.saves[postId] = saved; },
      async report(_postId, _reason) {},
      async delete(postId) { state.posts.delete(postId); },
      async create(input) {
        const id = `mock-post-${state.posts.size + 1}`;
        const source = state.sources.get(input.sourceHandle);
        if (!source) throw new Error(`Mock: no source ${input.sourceHandle}`);
        const post: Post = {
          id,
          source,
          author: session?.viewer ?? { id: 'anon', handle: 'anon@mock.test', profileUrl: 'https://mock.test/u/anon' },
          title: input.title,
          body: input.body,
          externalUrl: input.url,
          nsfw: input.nsfw ?? false,
          publishedAt: new Date().toISOString(),
          permalink: `https://mock.test/p/${id}`,
          counts: { score: 1, comments: 0 },
          viewer: { vote: 1, saved: false },
        };
        state.posts.set(id, post);
        return post;
      },
    },

    comments: {
      async list(postId, _opts) { return pageOf(state.comments.get(postId) ?? []); },
      async vote(commentId, vote) { state.votes[commentId] = vote; },
      async create(input) {
        const id = `mock-comment-${Date.now()}`;
        const parent = input.parentId
          ? (state.comments.get(input.postId) ?? []).find((c) => c.id === input.parentId)
          : null;
        const comment: Comment = {
          id,
          postId: input.postId,
          parentId: input.parentId ?? null,
          depth: parent ? parent.depth + 1 : 0,
          author: session?.viewer ?? { id: 'anon', handle: 'anon@mock.test', profileUrl: 'https://mock.test/u/anon' },
          body: input.body,
          publishedAt: new Date().toISOString(),
          permalink: `https://mock.test/c/${id}`,
          counts: { score: 1 },
          viewer: { vote: 1 },
        };
        const list = state.comments.get(input.postId) ?? [];
        state.comments.set(input.postId, [...list, comment]);
        return comment;
      },
      async edit(commentId, body) {
        for (const [postId, list] of state.comments) {
          const idx = list.findIndex((c) => c.id === commentId);
          if (idx >= 0) {
            const updated = { ...list[idx], body };
            state.comments.set(postId, [...list.slice(0, idx), updated, ...list.slice(idx + 1)]);
            return updated;
          }
        }
        throw new Error(`Mock: no comment ${commentId}`);
      },
      async delete(commentId) {
        for (const [postId, list] of state.comments) {
          state.comments.set(postId, list.filter((c) => c.id !== commentId));
        }
      },
      async report(_commentId, _reason) {},
    },

    sources: {
      async get(handle) {
        const s = state.sources.get(handle);
        if (!s) throw new Error(`Mock: no source ${handle}`);
        return s;
      },
      async subscribe(sourceId, sub) { state.subs[sourceId] = sub; },
      async block(sourceId, block) {
        if (block) state.blockedSources.add(sourceId);
        else state.blockedSources.delete(sourceId);
      },
    },

    users: {
      async get(handle) {
        const u = state.users.get(handle);
        if (!u) throw new Error(`Mock: no user ${handle}`);
        return u;
      },
      async getPosts(handle, _opts) {
        return pageOf([...state.posts.values()].filter((p) => p.author.handle === handle));
      },
      async getComments(handle, _opts) {
        const out: Comment[] = [];
        for (const list of state.comments.values()) {
          for (const c of list) if (c.author.handle === handle) out.push(c);
        }
        return pageOf(out);
      },
      async block(userId, block) {
        if (block) state.blockedUsers.add(userId);
        else state.blockedUsers.delete(userId);
      },
    },

    notifications: {
      async unreadCount() { return state.unreadCount; },
      async list(opts) {
        const items = opts.unreadOnly ? state.notifications.filter((n) => !n.read) : state.notifications;
        return pageOf(items);
      },
      async markRead(notificationId) {
        const idx = state.notifications.findIndex((n) => n.id === notificationId);
        if (idx >= 0) {
          state.notifications[idx] = { ...state.notifications[idx], read: true };
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      },
    },

    search: {
      async posts(query, _opts) {
        const q = query.toLowerCase();
        return pageOf([...state.posts.values()].filter((p) => (p.title ?? '').toLowerCase().includes(q)));
      },
      async sources(query, _opts) {
        const q = query.toLowerCase();
        return pageOf([...state.sources.values()].filter((s) => s.name.toLowerCase().includes(q)));
      },
    },

    media: {
      async uploadImage(_file) { return { url: 'https://mock.test/img/uploaded.png' }; },
    },
  };

  return backend;
}
