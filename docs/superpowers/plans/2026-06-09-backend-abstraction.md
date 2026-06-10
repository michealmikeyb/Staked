# Backend Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Branch:** `decouple` — all implementation work goes on this branch. Do not commit to `main`.

**Goal:** Decouple Stakswipe's UI from the Lemmy API by introducing a neutral `Backend` interface, a Lemmy adapter that fully implements it, and a mock adapter for tests. Migrate every UI component, hook, and test off direct `lib/lemmy` imports.

**Architecture:** New `src/lib/api/` module defines neutral domain types (`Post`, `Comment`, `User`, `Source`, `Session`, `Notification`), a `Backend` interface with sub-services, and a React `BackendProvider`. Two adapter packages live under `src/lib/api/backends/`: `lemmy/` implements the interface against `lemmy-js-client` (one file = one chokepoint), and `mock/` provides an in-memory implementation used by all component tests. Component migration is leaf-up in five rounds. `App.tsx` + `store.ts` migration is the final flip.

**Tech Stack:** TypeScript 5, React 18, Vite, Vitest + jsdom + Testing Library, `lemmy-js-client` 0.19.

**Spec reference:** `docs/superpowers/specs/2026-06-08-backend-abstraction-design.md`. The spec defines compact points labeled A through G that map onto task groups in this plan. Each compact point is a safe place to end a session and resume in a new one.

---

## Phase 1 — Foundations (Compact Point A)

### Task 1: Define neutral domain types

**Files:**
- Create: `src/lib/api/types.ts`

- [x] **Step 1: Create the types file**

```ts
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

export interface Notification {
  id: ID;
  kind: 'reply' | 'mention';
  read: boolean;
  receivedAt: string;
  comment: Comment;
  post: Pick<Post, 'id' | 'title' | 'permalink'>;
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
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [x] **Step 3: Commit**

```bash
git add src/lib/api/types.ts
git commit -m "feat(api): add neutral domain types"
```

### Task 2: Define Capabilities interface

**Files:**
- Create: `src/lib/api/capabilities.ts`

- [x] **Step 1: Create the capabilities file**

```ts
// src/lib/api/capabilities.ts
import type { SelectOption } from './types';

export interface Capabilities {
  canDownvote: boolean;
  canBrowseAnonymously: boolean;
  hasNsfwFlag: boolean;
  hasSavedPosts: boolean;
  feedOptions: SelectOption[];
  commentSortOptions: SelectOption[];
  sourceNoun: string;
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/lib/api/capabilities.ts
git commit -m "feat(api): add Capabilities interface"
```

### Task 3: Define Backend interface and sub-services

**Files:**
- Create: `src/lib/api/backend.ts`

- [x] **Step 1: Create the backend interface file**

```ts
// src/lib/api/backend.ts
import type {
  ID, Vote, Session, User, Source, Post, Comment, Notification, Page, Stak,
} from './types';
import type { Capabilities } from './capabilities';

export interface AuthService {
  login(credentials: Record<string, string>): Promise<Session>;
  logout(): Promise<void>;
}

export interface FeedService {
  getTimeline(opts: { feedId: string; stakId: string; cursor: string | null }): Promise<Page<Post>>;
  getSourceFeed(sourceHandle: string, opts: { feedId: string; cursor: string | null }): Promise<Page<Post>>;
  getSavedPosts(opts: { cursor: string | null }): Promise<Page<Post>>;
}

export interface PostService {
  get(postId: ID): Promise<Post>;
  getByPermalink(url: string): Promise<Post | null>;
  vote(postId: ID, vote: Vote): Promise<void>;
  save(postId: ID, saved: boolean): Promise<void>;
  report(postId: ID, reason: string): Promise<void>;
  delete(postId: ID): Promise<void>;
  create(input: { sourceHandle: string; title?: string; body?: string; url?: string; nsfw?: boolean }): Promise<Post>;
}

export interface CommentService {
  list(postId: ID, opts: { sortId: string }): Promise<Comment[]>;
  vote(commentId: ID, vote: Vote): Promise<void>;
  create(input: { postId: ID; parentId?: ID; body: string }): Promise<Comment>;
  edit(commentId: ID, body: string): Promise<Comment>;
  delete(commentId: ID): Promise<void>;
  report(commentId: ID, reason: string): Promise<void>;
}

export interface SourceService {
  get(handle: string): Promise<Source>;
  subscribe(sourceId: ID, subscribe: boolean): Promise<void>;
  block(sourceId: ID, block: boolean): Promise<void>;
}

export interface UserService {
  get(handle: string): Promise<User>;
  getPosts(handle: string, opts: { cursor: string | null }): Promise<Page<Post>>;
  getComments(handle: string, opts: { cursor: string | null }): Promise<Page<Comment>>;
  block(userId: ID, block: boolean): Promise<void>;
}

export interface NotificationService {
  unreadCount(): Promise<number>;
  list(opts: { unreadOnly: boolean; cursor: string | null }): Promise<Page<Notification>>;
  markRead(notificationId: ID): Promise<void>;
}

export interface SearchService {
  posts(query: string, opts: { cursor: string | null }): Promise<Page<Post>>;
  sources(query: string, opts: { cursor: string | null }): Promise<Page<Source>>;
}

export interface MediaService {
  uploadImage(file: File): Promise<{ url: string }>;
}

export interface Backend {
  readonly backendId: string;
  readonly capabilities: Capabilities;
  readonly session: Session | null;

  listStaks(): Stak[];

  auth: AuthService;
  feed: FeedService;
  posts: PostService;
  comments: CommentService;
  sources: SourceService;
  users: UserService;
  notifications: NotificationService;
  search: SearchService;
  media: MediaService;
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/lib/api/backend.ts
git commit -m "feat(api): add Backend interface with sub-services"
```

### Task 4: Add BackendProvider and useBackend hook

**Files:**
- Create: `src/lib/api/context.tsx`

- [x] **Step 1: Create the context module**

```tsx
// src/lib/api/context.tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { Backend } from './backend';

const BackendContext = createContext<Backend | null>(null);

export function BackendProvider({ value, children }: { value: Backend; children: ReactNode }) {
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  const backend = useContext(BackendContext);
  if (!backend) throw new Error('useBackend must be used within a BackendProvider');
  return backend;
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/lib/api/context.tsx
git commit -m "feat(api): add BackendProvider and useBackend hook"
```

### Task 5: Add backend registry

**Files:**
- Create: `src/lib/api/registry.ts`

- [x] **Step 1: Create the registry**

```ts
// src/lib/api/registry.ts
import type { Backend } from './backend';
import type { Session } from './types';

export type BackendFactory = (session: Session) => Backend;

const registry = new Map<string, BackendFactory>();

export function registerBackend(backendId: string, factory: BackendFactory): void {
  registry.set(backendId, factory);
}

export function createBackend(session: Session): Backend {
  const factory = registry.get(session.backendId);
  if (!factory) throw new Error(`Unknown backendId: ${session.backendId}`);
  return factory(session);
}

export function clearRegistry(): void {
  registry.clear();
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [x] **Step 3: Verify nothing has been wired up yet**

Run: `npm run build`
Expected: PASS — interfaces only, no behavior changes.

- [x] **Step 4: Commit**

```bash
git add src/lib/api/registry.ts
git commit -m "feat(api): add backend registry"
```

> ✅ **Compact point A reached.** Foundations laid; no behavior wired. Safe to compact session here.

---

## Phase 2 — Mock Backend (Compact Point B)

### Task 6: Mock backend state and fixtures

**Files:**
- Create: `src/lib/api/backends/mock/state.ts`
- Create: `src/lib/api/backends/mock/fixtures.ts`

- [x] **Step 1: Create the mutable state container**

```ts
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
```

- [x] **Step 2: Create the fixture builders**

```ts
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
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/lib/api/backends/mock/
git commit -m "feat(mock): add fixtures and state container"
```

### Task 7: Mock backend implementation

**Files:**
- Create: `src/lib/api/backends/mock/index.ts`

- [x] **Step 1: Create the mock backend factory**

```ts
// src/lib/api/backends/mock/index.ts
import type { Backend } from '../../backend';
import type { Capabilities } from '../../capabilities';
import type {
  ID, Vote, Session, User, Source, Post, Comment, Notification, Page, Stak,
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
};

export interface MockBackend extends Backend {
  state: MockState;
}

export function createMockBackend(
  fixtures: MockFixtures = {},
  capabilitiesOverride: Partial<Capabilities> = {},
): MockBackend {
  const state = createMockState();
  fixtures.users?.forEach((u) => state.users.set(u.handle, u));
  fixtures.sources?.forEach((s) => state.sources.set(s.handle, s));
  fixtures.posts?.forEach((p) => state.posts.set(p.id, p));
  if (fixtures.comments) {
    for (const [postId, comments] of Object.entries(fixtures.comments)) {
      state.comments.set(postId, comments);
    }
  }
  state.notifications = fixtures.notifications ?? [];
  state.unreadCount = fixtures.unreadCount ?? 0;

  const session: Session = {
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
      return [{ sessionId: session.id, id: 'all', label: 'All' }];
    },

    auth: {
      async login(_credentials) { return session; },
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
          author: session.viewer!,
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
      async list(postId, _opts) { return state.comments.get(postId) ?? []; },
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
          author: session.viewer!,
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
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/lib/api/backends/mock/index.ts
git commit -m "feat(mock): implement Backend interface"
```

### Task 8: Mock backend sanity test

**Files:**
- Create: `src/lib/api/backends/mock/index.test.ts`

- [x] **Step 1: Write the sanity test**

```ts
// src/lib/api/backends/mock/index.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockBackend } from './index';
import { makePost, makeSource, makeUser, makeComment, resetIdCounter } from './fixtures';

describe('createMockBackend', () => {
  beforeEach(() => resetIdCounter());

  it('returns the configured capabilities', () => {
    const backend = createMockBackend({}, { canDownvote: false });
    expect(backend.capabilities.canDownvote).toBe(false);
  });

  it('lists a single all stak', () => {
    const backend = createMockBackend();
    expect(backend.listStaks()).toEqual([
      { sessionId: 'mock-session', id: 'all', label: 'All' },
    ]);
  });

  it('returns all fixture posts from getTimeline', async () => {
    const post = makePost({ title: 'Hello' });
    const backend = createMockBackend({ posts: [post] });
    const page = await backend.feed.getTimeline({ feedId: 'hot', stakId: 'all', cursor: null });
    expect(page.items).toEqual([post]);
    expect(page.nextCursor).toBeNull();
  });

  it('records votes', async () => {
    const post = makePost();
    const backend = createMockBackend({ posts: [post] });
    await backend.posts.vote(post.id, 1);
    expect(backend.state.votes[post.id]).toBe(1);
  });

  it('records saves', async () => {
    const post = makePost();
    const backend = createMockBackend({ posts: [post] });
    await backend.posts.save(post.id, true);
    expect(backend.state.saves[post.id]).toBe(true);
  });

  it('appends comments via create', async () => {
    const post = makePost();
    const backend = createMockBackend({ posts: [post], comments: { [post.id]: [] } });
    const c = await backend.comments.create({ postId: post.id, body: 'Hi' });
    const list = await backend.comments.list(post.id, { sortId: 'top' });
    expect(list).toContainEqual(c);
  });

  it('filters saved posts', async () => {
    const a = makePost({ id: 'a' });
    const b = makePost({ id: 'b' });
    const backend = createMockBackend({ posts: [a, b] });
    await backend.posts.save('a', true);
    const page = await backend.feed.getSavedPosts({ cursor: null });
    expect(page.items.map((p) => p.id)).toEqual(['a']);
  });

  it('returns user posts/comments by handle', async () => {
    const user = makeUser({ handle: 'alice@mock.test' });
    const post = makePost({ author: user });
    const comment = makeComment({ author: user, postId: post.id });
    const backend = createMockBackend({
      users: [user],
      posts: [post],
      comments: { [post.id]: [comment] },
    });
    expect((await backend.users.getPosts('alice@mock.test', { cursor: null })).items).toEqual([post]);
    expect((await backend.users.getComments('alice@mock.test', { cursor: null })).items).toEqual([comment]);
  });

  it('searches posts by title substring', async () => {
    const a = makePost({ title: 'apple pie' });
    const b = makePost({ title: 'cherry pie' });
    const backend = createMockBackend({ posts: [a, b] });
    const result = await backend.search.posts('apple', { cursor: null });
    expect(result.items).toEqual([a]);
  });

  it('marks notifications read and decrements unreadCount', async () => {
    const notif = { id: 'n1', kind: 'reply' as const, read: false, receivedAt: '2026-01-01T00:00:00Z',
      comment: makeComment(), post: { id: 'p1', title: 'p', permalink: 'https://x' } };
    const backend = createMockBackend({ notifications: [notif], unreadCount: 1 });
    await backend.notifications.markRead('n1');
    expect(await backend.notifications.unreadCount()).toBe(0);
    expect(backend.state.notifications[0].read).toBe(true);
  });
});
```

- [x] **Step 2: Run the test**

Run: `npx vitest run src/lib/api/backends/mock/index.test.ts`
Expected: PASS, all assertions green.

- [x] **Step 3: Commit**

```bash
git add src/lib/api/backends/mock/index.test.ts
git commit -m "test(mock): add Backend interface sanity test"
```

> ✅ **Compact point B reached.** Mock backend works in isolation. Safe to compact.

---

## Phase 3 — Lemmy Adapter (Compact Point C)

### Task 9: Lemmy client and session shape

**Files:**
- Create: `src/lib/api/backends/lemmy/client.ts`
- Create: `src/lib/api/backends/lemmy/session.ts`

- [ ] **Step 1: Create the client factory**

```ts
// src/lib/api/backends/lemmy/client.ts
import { LemmyHttp } from 'lemmy-js-client';

export function makeLemmyClient(instance: string, token?: string | null): LemmyHttp {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return new LemmyHttp(`https://${instance}`, { headers });
}

export function instanceFromActorId(actorId: string): string {
  try { return new URL(actorId).host; } catch { return ''; }
}

export function sourceFromApId(apId: string): { instance: string; postId: number } | null {
  try {
    const u = new URL(apId);
    const m = u.pathname.match(/^\/post\/(\d+)/);
    if (!m) return null;
    return { instance: u.host, postId: parseInt(m[1], 10) };
  } catch { return null; }
}
```

- [ ] **Step 2: Create the session data type and stak list helper**

```ts
// src/lib/api/backends/lemmy/session.ts
import type { Session, Stak } from '../../types';

export interface LemmySessionData {
  instance: string;
  token: string | null;
}

export function getLemmySessionData(session: Session): LemmySessionData {
  return session.data as LemmySessionData;
}

export function listLemmyStaks(session: Session): Stak[] {
  const isLoggedIn = !!getLemmySessionData(session).token;
  const staks: Stak[] = [
    { sessionId: session.id, id: 'all', label: 'All' },
    { sessionId: session.id, id: 'local', label: 'Local' },
  ];
  if (isLoggedIn) {
    staks.push({ sessionId: session.id, id: 'subscribed', label: 'Subscribed' });
  }
  return staks;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/backends/lemmy/
git commit -m "feat(lemmy): add client factory, session shape, and stak list"
```

### Task 10: Lemmy mappers

**Files:**
- Create: `src/lib/api/backends/lemmy/mappers.ts`
- Create: `src/lib/api/backends/lemmy/mappers.test.ts`

- [ ] **Step 1: Write failing mapper tests**

```ts
// src/lib/api/backends/lemmy/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { mapPost, mapComment, mapUser, mapSource, parsePostId } from './mappers';
import type { PostView, CommentView, Person, CommunityView } from 'lemmy-js-client';

const samplePerson: Person = {
  id: 1, name: 'alice', display_name: 'Alice', avatar: 'https://lemmy.world/a.png',
  banned: false, published: '2026-01-01T00:00:00Z', actor_id: 'https://lemmy.world/u/alice',
  local: true, deleted: false, admin: false, bot_account: false, instance_id: 1,
} as Person;

const sampleCommunity: any = {
  community: {
    id: 10, name: 'news', title: 'News', actor_id: 'https://lemmy.world/c/news',
    local: true, deleted: false, removed: false, hidden: false, posting_restricted_to_mods: false,
    published: '2026-01-01T00:00:00Z', instance_id: 1, nsfw: false,
  },
  subscribed: 'NotSubscribed',
  blocked: false,
  counts: { id: 1, community_id: 10, subscribers: 5, posts: 3, comments: 7, published: '', users_active_day: 0, users_active_week: 0, users_active_month: 0, users_active_half_year: 0, hot_rank: 0 },
};

describe('mapPost', () => {
  it('maps a PostView to a neutral Post', () => {
    const pv: any = {
      post: {
        id: 42, name: 'hello', body: 'world', url: 'https://example.com/x',
        thumbnail_url: 'https://example.com/t.png', nsfw: false,
        ap_id: 'https://lemmy.world/post/42', published: '2026-02-01T00:00:00Z',
        creator_id: 1, community_id: 10, local: true, deleted: false, removed: false,
        locked: false, featured_community: false, featured_local: false, language_id: 0,
      },
      creator: samplePerson,
      community: sampleCommunity.community,
      creator_banned_from_community: false,
      creator_is_moderator: false,
      creator_is_admin: false,
      subscribed: 'NotSubscribed',
      saved: false,
      read: false,
      creator_blocked: false,
      counts: { id: 1, post_id: 42, comments: 3, score: 11, upvotes: 12, downvotes: 1,
        published: '', newest_comment_time_necro: '', newest_comment_time: '',
        featured_community: false, featured_local: false, hot_rank: 0, hot_rank_active: 0,
        controversy_rank: 0, scaled_rank: 0 },
      unread_comments: 0,
      my_vote: 1,
    };
    const post = mapPost(pv);
    expect(post.id).toBe('42|https://lemmy.world/post/42');
    expect(post.title).toBe('hello');
    expect(post.body).toBe('world');
    expect(post.externalUrl).toBe('https://example.com/x');
    expect(post.mediaUrl).toBe('https://example.com/t.png');
    expect(post.permalink).toBe('https://lemmy.world/post/42');
    expect(post.counts).toEqual({ score: 11, comments: 3 });
    expect(post.viewer?.vote).toBe(1);
    expect(post.viewer?.saved).toBe(false);
    expect(post.author.handle).toBe('alice@lemmy.world');
    expect(post.source.handle).toBe('news@lemmy.world');
  });
});

describe('parsePostId', () => {
  it('round-trips the encoded id', () => {
    const parsed = parsePostId('42|https://lemmy.world/post/42');
    expect(parsed).toEqual({ localId: 42, apId: 'https://lemmy.world/post/42' });
  });
});
```

- [ ] **Step 2: Run the test (expect fail — file doesn't exist)**

Run: `npx vitest run src/lib/api/backends/lemmy/mappers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mappers**

```ts
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
    bio: p.bio ?? undefined,
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

// Comment IDs use the same encoding as post IDs so cross-instance reply
// resolution (via resolveObject) works the same way.
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
  if (parts.length < 3) return null;  // path "0.id" → top-level
  return parseInt(parts[parts.length - 2], 10);
}

function depthFromPath(path: string): number {
  return Math.max(0, path.split('.').length - 2);
}

// Single-comment mapper. parentId is encoded with an empty apId placeholder;
// callers that fetch in batches should prefer mapComments() for accurate
// parent ap_id encoding.
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

// Batch mapper — used by CommentService.list. Builds a localId→apId map first
// so parentId encodings include the parent's apId.
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
```

- [ ] **Step 4: Run tests until they pass**

Run: `npx vitest run src/lib/api/backends/lemmy/mappers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/lemmy/mappers.ts src/lib/api/backends/lemmy/mappers.test.ts
git commit -m "feat(lemmy): add native↔neutral type mappers"
```

### Task 11: Lemmy FeedService

**Files:**
- Create: `src/lib/api/backends/lemmy/feed.ts`

The Lemmy adapter encodes Lemmy's `page: number` as a string cursor. Empty pages return `nextCursor: null`. Anonymous sessions route through the user-configured `anonInstance` if set, otherwise through `getAnonInstance(feedId)` from `src/lib/instanceRankings.ts`.

- [ ] **Step 1: Create the FeedService implementation**

```ts
// src/lib/api/backends/lemmy/feed.ts
import type { FeedService } from '../../backend';
import type { Page, Post, Session } from '../../types';
import type { SortType } from 'lemmy-js-client';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapPost } from './mappers';
import { getAnonInstance } from '../../../instanceRankings';

const PAGE_SIZE = 10;
const SAVED_PAGE_SIZE = 20;

function pageNumber(cursor: string | null): number {
  return cursor ? parseInt(cursor, 10) : 1;
}

function nextCursorOf(page: number, items: unknown[], size: number): string | null {
  return items.length < size ? null : String(page + 1);
}

function resolveInstance(session: Session, feedId: string, anonInstanceSetting: string | undefined): { instance: string; token: string | null } {
  const { instance, token } = getLemmySessionData(session);
  if (token) return { instance, token };
  const anon = anonInstanceSetting || getAnonInstance(feedId as SortType);
  return { instance: anon, token: null };
}

export function createFeedService(
  session: Session,
  getAnonInstanceSetting: () => string | undefined,
): FeedService {
  return {
    async getTimeline(opts): Promise<Page<Post>> {
      const { instance, token } = resolveInstance(session, opts.feedId, getAnonInstanceSetting());
      const stak = opts.stakId === 'subscribed' ? 'Subscribed'
                 : opts.stakId === 'local' ? 'Local'
                 : 'All';
      const page = pageNumber(opts.cursor);
      const res = await makeLemmyClient(instance, token).getPosts({
        type_: stak as any,
        sort: opts.feedId as SortType,
        page,
        limit: PAGE_SIZE,
      });
      const items = res.posts.map(mapPost);
      return { items, nextCursor: nextCursorOf(page, res.posts, PAGE_SIZE) };
    },

    async getSourceFeed(sourceHandle, opts): Promise<Page<Post>> {
      const { instance, token } = resolveInstance(session, opts.feedId, getAnonInstanceSetting());
      const page = pageNumber(opts.cursor);
      const res = await makeLemmyClient(instance, token).getPosts({
        community_name: sourceHandle,
        sort: opts.feedId as SortType,
        page,
        limit: PAGE_SIZE,
      });
      const items = res.posts.map(mapPost);
      return { items, nextCursor: nextCursorOf(page, res.posts, PAGE_SIZE) };
    },

    async getSavedPosts(opts): Promise<Page<Post>> {
      const { instance, token } = getLemmySessionData(session);
      if (!token) return { items: [], nextCursor: null };
      const page = pageNumber(opts.cursor);
      const res = await makeLemmyClient(instance, token).getPosts({
        saved_only: true,
        sort: 'New',
        page,
        limit: SAVED_PAGE_SIZE,
      });
      const items = res.posts.map(mapPost);
      return { items, nextCursor: nextCursorOf(page, res.posts, SAVED_PAGE_SIZE) };
    },
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/backends/lemmy/feed.ts
git commit -m "feat(lemmy): FeedService with cursor-page mapping and anon routing"
```

### Task 12: Lemmy PostService

**Files:**
- Create: `src/lib/api/backends/lemmy/posts.ts`

- [ ] **Step 1: Create the PostService implementation**

```ts
// src/lib/api/backends/lemmy/posts.ts
import type { PostService } from '../../backend';
import type { ID, Post, Session, Vote } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapPost, parsePostId, encodePostId } from './mappers';

export function createPostService(session: Session): PostService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async get(postId: ID): Promise<Post> {
      const { localId } = parsePostId(postId);
      const res = await client().getPost({ id: localId });
      return mapPost(res.post_view);
    },

    async getByPermalink(url: string): Promise<Post | null> {
      // Try parsing as a Lemmy post URL first.
      const lemmyMatch = url.match(/^https?:\/\/([^\/]+)\/post\/(\d+)/);
      if (lemmyMatch) {
        const [, host, idStr] = lemmyMatch;
        try {
          const res = await makeLemmyClient(host).getPost({ id: parseInt(idStr, 10) });
          return mapPost(res.post_view);
        } catch { return null; }
      }
      // Kbin/Mbin shape: /m/<magazine>/t/<id>/...
      const kbinMatch = url.match(/^https?:\/\/[^\/]+\/[^\/]+\/[^\/]+\/p\/(\d+)/);
      if (kbinMatch || !lemmyMatch) {
        try {
          const res = await client().resolveObject({ q: url });
          if (res.post) return mapPost(res.post);
        } catch { /* fall through */ }
      }
      return null;
    },

    async vote(postId: ID, vote: Vote): Promise<void> {
      if (!token) throw new Error('Vote requires login');
      const { localId } = parsePostId(postId);
      await client().likePost({ post_id: localId, score: vote });
    },

    async save(postId: ID, saved: boolean): Promise<void> {
      if (!token) throw new Error('Save requires login');
      const { localId } = parsePostId(postId);
      await client().savePost({ post_id: localId, save: saved });
    },

    async report(postId: ID, reason: string): Promise<void> {
      if (!token) throw new Error('Report requires login');
      const { localId } = parsePostId(postId);
      await client().createPostReport({ post_id: localId, reason });
    },

    async delete(postId: ID): Promise<void> {
      if (!token) throw new Error('Delete requires login');
      const { localId } = parsePostId(postId);
      await client().deletePost({ post_id: localId, deleted: true });
    },

    async create(input): Promise<Post> {
      if (!token) throw new Error('Create requires login');
      const community = await client().getCommunity({ name: input.sourceHandle });
      const res = await client().createPost({
        community_id: community.community_view.community.id,
        name: input.title ?? '',
        body: input.body,
        url: input.url,
        nsfw: input.nsfw,
      });
      return mapPost(res.post_view);
    },
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/backends/lemmy/posts.ts
git commit -m "feat(lemmy): PostService"
```

### Task 13: Lemmy CommentService with federation fallback

**Files:**
- Create: `src/lib/api/backends/lemmy/comments.ts`

The 3-tier fallback and cross-stitching algorithm is ported verbatim from `src/hooks/useCommentLoader.ts` lines 27–99 of the original file. The encoding round-trip means `comments.list(postId)` receives `"localId|apId"` and unpacks both.

- [ ] **Step 1: Create the CommentService implementation**

```ts
// src/lib/api/backends/lemmy/comments.ts
import type { CommentService } from '../../backend';
import type { Comment, Session, Vote, ID } from '../../types';
import type { CommentView, CommentSortType } from 'lemmy-js-client';
import { makeLemmyClient, sourceFromApId, instanceFromActorId } from './client';
import { getLemmySessionData } from './session';
import { mapComment, mapComments, parsePostId, parseCommentId } from './mappers';

async function resolvePostIdOn(instance: string, apId: string): Promise<number | null> {
  try {
    const res = await makeLemmyClient(instance).resolveObject({ q: apId });
    return res.post?.post.id ?? null;
  } catch { return null; }
}

async function fetchRaw(instance: string, token: string, postId: number, sort: CommentSortType): Promise<CommentView[]> {
  try {
    const res = await makeLemmyClient(instance, token || undefined).getComments({
      post_id: postId, sort, limit: 50,
    });
    return res.comments;
  } catch { return []; }
}

function pathParts(c: CommentView): string[] { return c.comment.path.split('.'); }

function crossStitch(source: CommentView[], home: CommentView[]): CommentView[] {
  if (home.length === 0) return source;
  const sourceApIds = new Set(source.map((c) => c.comment.ap_id));
  const novel = home.filter((c) => !sourceApIds.has(c.comment.ap_id));
  if (novel.length === 0) return source;
  const homeIdToApId = new Map(home.map((c) => [c.comment.id, c.comment.ap_id]));
  const sourceApIdToComment = new Map(source.map((c) => [c.comment.ap_id, c]));
  const result = [...source];
  for (const nc of novel) {
    const parts = pathParts(nc);
    const parentLocalId = parts.length > 2 ? parseInt(parts[parts.length - 2], 10) : null;
    const parentApId = parentLocalId != null ? homeIdToApId.get(parentLocalId) : null;
    const parentInSource = parentApId ? sourceApIdToComment.get(parentApId) : null;
    if (parentInSource) {
      const sourcePath = parentInSource.comment.path + '.' + nc.comment.id;
      const remapped: CommentView = { ...nc, comment: { ...nc.comment, path: sourcePath } };
      const parentPath = parentInSource.comment.path;
      const parentIdx = result.findIndex((c) => c.comment.ap_id === parentApId);
      let insertIdx = parentIdx + 1;
      while (insertIdx < result.length && result[insertIdx].comment.path.startsWith(parentPath + '.')) {
        insertIdx++;
      }
      result.splice(insertIdx, 0, remapped);
    } else {
      result.push(nc);
    }
  }
  return result;
}

export function createCommentService(session: Session): CommentService {
  const { instance: homeInstance, token } = getLemmySessionData(session);
  const homeClient = () => makeLemmyClient(homeInstance, token ?? undefined);

  return {
    async list(postId: ID, opts): Promise<Comment[]> {
      const sort = opts.sortId as CommentSortType;
      const { localId, apId } = parsePostId(postId);
      const source = sourceFromApId(apId);

      let loaded: CommentView[] = [];
      let cachedHome: CommentView[] | null = null;

      // Tier 1 — source instance
      if (source) {
        const srcToken = source.instance === homeInstance ? (token ?? '') : '';
        loaded = await fetchRaw(source.instance, srcToken, source.postId, sort);
      }

      // Tier 2 — community instance (if different)
      if (loaded.length === 0) {
        const communityInstance = source?.instance; // for top-level community fetch we need the community actor_id;
        // The community instance is encoded via the source instance in cross-posts; for this adapter
        // we fall through to Tier 3 if Tier 1 returned nothing. The existing useCommentLoader logic
        // performed community resolution using the community's actor_id which is available on the
        // PostView at fetch time but not at list time. The post object available via .get(postId)
        // would have it. For now we skip Tier 2 in this implementation — the home-instance fallback
        // covers the same recovery in practice.
      }

      // Tier 3 — home instance, authenticated then anonymous
      if (token && source?.instance !== homeInstance && loaded.length === 0) {
        cachedHome = await fetchRaw(homeInstance, token, localId, sort);
        if (cachedHome.length === 0) {
          cachedHome = await fetchRaw(homeInstance, '', localId, sort);
        }
        loaded = cachedHome;
      }

      // Cross-stitch novel home comments into source tree
      if (token && source && source.instance !== homeInstance) {
        const home = cachedHome ?? await fetchRaw(homeInstance, token, localId, sort);
        loaded = crossStitch(loaded, home);
      }

      return mapComments(loaded);
    },

    async vote(commentId: ID, vote: Vote): Promise<void> {
      if (!token) throw new Error('Vote requires login');
      const { localId } = parseCommentId(commentId);
      await homeClient().likeComment({ comment_id: localId, score: vote });
    },

    async create(input): Promise<Comment> {
      if (!token) throw new Error('Comment requires login');
      const { localId: postLocalId } = parsePostId(input.postId);
      let parent_id: number | undefined;
      if (input.parentId) {
        const { localId: parentLocal, apId: parentApId } = parseCommentId(input.parentId);
        // If the parent was loaded from a non-home instance, its localId is the
        // source-instance id — resolve to the home-instance id when possible.
        if (parentApId) {
          try {
            const r = await homeClient().resolveObject({ q: parentApId });
            parent_id = r.comment?.comment.id ?? parentLocal;
          } catch { parent_id = parentLocal; }
        } else {
          parent_id = parentLocal;
        }
      }
      const res = await homeClient().createComment({
        post_id: postLocalId, content: input.body, parent_id,
      });
      return mapComment(res.comment_view);
    },

    async edit(commentId, body): Promise<Comment> {
      if (!token) throw new Error('Edit requires login');
      const { localId } = parseCommentId(commentId);
      const res = await homeClient().editComment({ comment_id: localId, content: body });
      return mapComment(res.comment_view);
    },

    async delete(commentId): Promise<void> {
      if (!token) throw new Error('Delete requires login');
      const { localId } = parseCommentId(commentId);
      await homeClient().deleteComment({ comment_id: localId, deleted: true });
    },

    async report(commentId, reason): Promise<void> {
      if (!token) throw new Error('Report requires login');
      const { localId } = parseCommentId(commentId);
      await homeClient().createCommentReport({ comment_id: localId, reason });
    },
  };
}
```

> **Note on Tier 2 omission:** The original `useCommentLoader` had a Tier 2 community-instance fallback that required the `community.actor_id` at fetch time. In the adapter, comment listing is decoupled from the post object — only `postId` is available. The Tier 3 home-instance fallback handles the same recovery cases for the vast majority of federation gaps. If gaps appear in testing, encode the community actor_id into the `postId` opaque string as a third segment (`"localId|apId|communityActorId"`) and reintroduce Tier 2 here.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/backends/lemmy/comments.ts
git commit -m "feat(lemmy): CommentService with federation fallback"
```

### Task 14: Lemmy SourceService, UserService, NotificationService, SearchService, MediaService

**Files:**
- Create: `src/lib/api/backends/lemmy/sources.ts`
- Create: `src/lib/api/backends/lemmy/users.ts`
- Create: `src/lib/api/backends/lemmy/notifs.ts`
- Create: `src/lib/api/backends/lemmy/search.ts`
- Create: `src/lib/api/backends/lemmy/media.ts`

- [ ] **Step 1: Create SourceService**

```ts
// src/lib/api/backends/lemmy/sources.ts
import type { SourceService } from '../../backend';
import type { Source, Session } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapSource } from './mappers';

export function createSourceService(session: Session): SourceService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async get(handle): Promise<Source> {
      const res = await client().getCommunity({ name: handle });
      return mapSource(res.community_view.community, res.community_view.counts as any, res.community_view.subscribed);
    },
    async subscribe(sourceId, sub): Promise<void> {
      if (!token) throw new Error('Subscribe requires login');
      await client().followCommunity({ community_id: parseInt(sourceId, 10), follow: sub });
    },
    async block(sourceId, block): Promise<void> {
      if (!token) throw new Error('Block requires login');
      await client().blockCommunity({ community_id: parseInt(sourceId, 10), block });
    },
  };
}
```

- [ ] **Step 2: Create UserService**

```ts
// src/lib/api/backends/lemmy/users.ts
import type { UserService } from '../../backend';
import type { User, Post, Comment, Page, Session } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapUser, mapPost, mapComment } from './mappers';

const PAGE_SIZE = 20;
const pageNumber = (cursor: string | null): number => cursor ? parseInt(cursor, 10) : 1;
const nextCursor = (page: number, n: number): string | null => n < PAGE_SIZE ? null : String(page + 1);

export function createUserService(session: Session): UserService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async get(handle): Promise<User> {
      const res = await client().getPersonDetails({ username: handle, sort: 'New', page: 1, limit: 1 });
      return mapUser(res.person_view.person);
    },
    async getPosts(handle, opts): Promise<Page<Post>> {
      const page = pageNumber(opts.cursor);
      const res = await client().getPersonDetails({ username: handle, sort: 'New', page, limit: PAGE_SIZE });
      return { items: res.posts.map(mapPost), nextCursor: nextCursor(page, res.posts.length) };
    },
    async getComments(handle, opts): Promise<Page<Comment>> {
      const page = pageNumber(opts.cursor);
      const res = await client().getPersonDetails({ username: handle, sort: 'New', page, limit: PAGE_SIZE });
      return { items: res.comments.map(mapComment), nextCursor: nextCursor(page, res.comments.length) };
    },
    async block(userId, block): Promise<void> {
      if (!token) throw new Error('Block requires login');
      await client().blockPerson({ person_id: parseInt(userId, 10), block });
    },
  };
}
```

- [ ] **Step 3: Create NotificationService**

```ts
// src/lib/api/backends/lemmy/notifs.ts
import type { NotificationService } from '../../backend';
import type { Notification, Page, Session } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapReply, mapMention } from './mappers';

const PAGE_SIZE = 50;

function splitCursor(cursor: string | null): { rep: number; men: number } {
  if (!cursor) return { rep: 1, men: 1 };
  const [r, m] = cursor.split('|');
  return { rep: parseInt(r, 10) || 1, men: parseInt(m, 10) || 1 };
}

export function createNotificationService(session: Session): NotificationService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async unreadCount(): Promise<number> {
      if (!token) return 0;
      const res = await client().getUnreadCount();
      return res.replies + res.mentions;
    },
    async list(opts): Promise<Page<Notification>> {
      if (!token) return { items: [], nextCursor: null };
      const { rep, men } = splitCursor(opts.cursor);
      const [repliesRes, mentionsRes] = await Promise.all([
        client().getReplies({ sort: 'New', unread_only: opts.unreadOnly, page: rep, limit: PAGE_SIZE }),
        client().getPersonMentions({ sort: 'New', unread_only: opts.unreadOnly, page: men, limit: PAGE_SIZE }),
      ]);
      const replies = repliesRes.replies.map(mapReply);
      const mentions = mentionsRes.mentions.map(mapMention);
      const items = [...replies, ...mentions].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      const repNext = replies.length < PAGE_SIZE ? null : rep + 1;
      const menNext = mentions.length < PAGE_SIZE ? null : men + 1;
      const nextCursor = repNext == null && menNext == null
        ? null
        : `${repNext ?? rep}|${menNext ?? men}`;
      return { items, nextCursor };
    },
    async markRead(notificationId): Promise<void> {
      if (!token) throw new Error('Mark-read requires login');
      const [kind, idStr] = notificationId.split('-');
      const id = parseInt(idStr, 10);
      if (kind === 'reply') {
        await client().markCommentReplyAsRead({ comment_reply_id: id, read: true });
      } else if (kind === 'mention') {
        await client().markPersonMentionAsRead({ person_mention_id: id, read: true });
      }
    },
  };
}
```

- [ ] **Step 4: Create SearchService**

```ts
// src/lib/api/backends/lemmy/search.ts
import type { SearchService } from '../../backend';
import type { Post, Source, Page, Session } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapPost, mapSourceFromView } from './mappers';

const PAGE_SIZE = 20;
const pageNumber = (cursor: string | null): number => cursor ? parseInt(cursor, 10) : 1;
const nextCursor = (page: number, n: number): string | null => n < PAGE_SIZE ? null : String(page + 1);

export function createSearchService(session: Session): SearchService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async posts(query, opts): Promise<Page<Post>> {
      const page = pageNumber(opts.cursor);
      const res = await client().search({ q: query, type_: 'Posts', sort: 'TopAll', page, limit: PAGE_SIZE });
      return { items: res.posts.map(mapPost), nextCursor: nextCursor(page, res.posts.length) };
    },
    async sources(query, opts): Promise<Page<Source>> {
      const page = pageNumber(opts.cursor);
      const res = await client().search({ q: query, type_: 'Communities', sort: 'TopAll', page, limit: PAGE_SIZE });
      return { items: res.communities.map(mapSourceFromView), nextCursor: nextCursor(page, res.communities.length) };
    },
  };
}
```

- [ ] **Step 5: Create MediaService**

```ts
// src/lib/api/backends/lemmy/media.ts
import type { MediaService } from '../../backend';
import type { Session } from '../../types';
import { getLemmySessionData } from './session';

export function createMediaService(session: Session): MediaService {
  const { instance, token } = getLemmySessionData(session);

  return {
    async uploadImage(file): Promise<{ url: string }> {
      if (!token) throw new Error('Upload requires login');
      const formData = new FormData();
      formData.append('images[]', file);
      const res = await fetch(`https://${instance}/pictrs/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json() as { files?: { file: string }[] };
      if (!data.files?.[0]?.file) throw new Error('Upload failed: no file returned');
      return { url: `https://${instance}/pictrs/image/${data.files[0].file}` };
    },
  };
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/backends/lemmy/
git commit -m "feat(lemmy): SourceService, UserService, NotificationService, SearchService, MediaService"
```

### Task 15: Lemmy AuthService and backend assembly

**Files:**
- Create: `src/lib/api/backends/lemmy/index.ts`

- [ ] **Step 1: Create the backend factory and AuthService**

```ts
// src/lib/api/backends/lemmy/index.ts
import type { Backend, AuthService } from '../../backend';
import type { Capabilities } from '../../capabilities';
import type { Session, Stak } from '../../types';
import { makeLemmyClient } from './client';
import { listLemmyStaks, getLemmySessionData, type LemmySessionData } from './session';
import { mapUser } from './mappers';
import { createFeedService } from './feed';
import { createPostService } from './posts';
import { createCommentService } from './comments';
import { createSourceService } from './sources';
import { createUserService } from './users';
import { createNotificationService } from './notifs';
import { createSearchService } from './search';
import { createMediaService } from './media';

const LEMMY_CAPABILITIES: Capabilities = {
  canDownvote: true,
  canBrowseAnonymously: true,
  hasNsfwFlag: true,
  hasSavedPosts: true,
  feedOptions: [
    { id: 'Active', label: 'Active' },
    { id: 'Hot', label: 'Hot' },
    { id: 'New', label: 'New' },
    { id: 'TopHour', label: 'Top — Hour' },
    { id: 'TopSixHour', label: 'Top — 6h' },
    { id: 'TopTwelveHour', label: 'Top — 12h' },
    { id: 'TopDay', label: 'Top — Day' },
    { id: 'TopWeek', label: 'Top — Week' },
    { id: 'TopMonth', label: 'Top — Month' },
    { id: 'TopYear', label: 'Top — Year' },
    { id: 'TopAll', label: 'Top — All' },
    { id: 'MostComments', label: 'Most Comments' },
    { id: 'NewComments', label: 'New Comments' },
  ],
  commentSortOptions: [
    { id: 'Top', label: 'Top' },
    { id: 'Hot', label: 'Hot' },
    { id: 'New', label: 'New' },
    { id: 'Old', label: 'Old' },
  ],
  sourceNoun: 'Community',
};

function createAuthService(session: Session): AuthService {
  return {
    async login(credentials): Promise<Session> {
      const { instance, usernameOrEmail, password } = credentials as {
        instance: string; usernameOrEmail: string; password: string;
      };
      const res = await makeLemmyClient(instance).login({ username_or_email: usernameOrEmail, password });
      if (!res.jwt) throw new Error('Login failed: no token returned');
      const persRes = await makeLemmyClient(instance, res.jwt).getSite();
      const viewer = persRes.my_user?.local_user_view?.person
        ? mapUser(persRes.my_user.local_user_view.person)
        : null;
      const data: LemmySessionData = { instance, token: res.jwt };
      return { ...session, viewer, data };
    },
    async logout(): Promise<void> {},
  };
}

export interface LemmyBackendOptions {
  anonInstanceSetting?: () => string | undefined;
}

export function createLemmyBackend(session: Session, opts: LemmyBackendOptions = {}): Backend {
  const getAnon = opts.anonInstanceSetting ?? (() => undefined);
  return {
    backendId: 'lemmy',
    capabilities: LEMMY_CAPABILITIES,
    session,
    listStaks(): Stak[] { return listLemmyStaks(session); },
    auth: createAuthService(session),
    feed: createFeedService(session, getAnon),
    posts: createPostService(session),
    comments: createCommentService(session),
    sources: createSourceService(session),
    users: createUserService(session),
    notifications: createNotificationService(session),
    search: createSearchService(session),
    media: createMediaService(session),
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles and full build succeeds**

Run: `npm run build`
Expected: PASS — full build succeeds. `src/lib/lemmy.ts` is still in place and used by the app.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/backends/lemmy/index.ts
git commit -m "feat(lemmy): assemble Backend factory and AuthService"
```

> ✅ **Compact point C reached.** Lemmy adapter complete; app still runs against legacy `lib/lemmy.ts`. Safe to compact.

---

## Phase 4 — Test Helper (Compact Point D)

### Task 16: renderWithBackend helper

**Files:**
- Create: `src/test-utils.tsx`

- [ ] **Step 1: Create the helper**

```tsx
// src/test-utils.tsx
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BackendProvider } from './lib/api/context';
import { createMockBackend, type MockBackend } from './lib/api/backends/mock';
import type { MockFixtures } from './lib/api/backends/mock/fixtures';
import type { Capabilities } from './lib/api/capabilities';

export interface RenderWithBackendOptions {
  fixtures?: MockFixtures;
  capabilities?: Partial<Capabilities>;
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
}

export function renderWithBackend(ui: ReactElement, opts: RenderWithBackendOptions = {}) {
  const backend: MockBackend = createMockBackend(opts.fixtures, opts.capabilities);
  const result = render(ui, {
    ...opts.renderOptions,
    wrapper: ({ children }) => <BackendProvider value={backend}>{children}</BackendProvider>,
  });
  return { ...result, backend };
}

export * from './lib/api/backends/mock/fixtures';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm test -- --run`
Expected: All existing tests still pass; no new test failures from the helper.

- [ ] **Step 3: Commit**

```bash
git add src/test-utils.tsx
git commit -m "test: add renderWithBackend helper"
```

> ✅ **Compact point D reached.** Helper ready. Component migrations begin next.

---

## Phase 5 — Component migration

> **Per-round protocol.** Each migration follows the same pattern: rewrite the component's `import` from `lib/lemmy` to use `useBackend()` and neutral types from `lib/api/types`; update the test to use `renderWithBackend`; run that file's tests; commit.

### Task 17: Round 1 — CommentItem

**Files:**
- Modify: `src/components/CommentItem.tsx`
- Modify: `src/components/CommentItem.test.tsx`

- [ ] **Step 1: Update CommentItem.tsx**

Read the current `src/components/CommentItem.tsx`. Then make these edits:

- Replace `import { likeComment, resolveCommentId, type CommentView } from '../lib/lemmy';` with `import { useBackend } from '../lib/api/context';` and `import type { Comment } from '../lib/api/types';`.
- Change every prop or local type referencing `CommentView` to `Comment`.
- Field access changes: `commentView.comment.content` → `comment.body`; `commentView.comment.id` → `comment.id`; `commentView.creator.*` → `comment.author.*`; `commentView.counts.score` → `comment.counts.score`; `commentView.my_vote` → `comment.viewer?.vote`; `commentView.comment.ap_id` → `comment.permalink`; `commentView.comment.path` → use `comment.depth` for indentation and `comment.parentId` for reply targets.
- Replace direct `likeComment(auth.instance, auth.token, ...)` calls with `backend.comments.vote(comment.id, score)` from the `useBackend()` hook.
- Drop the `resolveCommentId` resolution dance — the adapter handles it.
- Update the parent-reply target type from `CommentView` to `Comment` in props/callbacks.

- [ ] **Step 2: Update CommentItem.test.tsx**

- Replace `vi.mock('../lib/lemmy', ...)` with `import { renderWithBackend, makeComment } from '../test-utils';`.
- Replace `render(...)` calls with `renderWithBackend(...)`.
- Replace `CommentView` fixture builders with `makeComment({ ... })`.
- For vote assertions, read `backend.state.votes[commentId]` instead of asserting on the mock fn.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/CommentItem.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CommentItem.tsx src/components/CommentItem.test.tsx
git commit -m "refactor(CommentItem): migrate to Backend abstraction"
```

### Task 18: Round 1 — CommentList

**Files:**
- Modify: `src/components/CommentList.tsx`
- Modify: `src/components/CommentList.test.tsx`

- [ ] **Step 1: Update CommentList.tsx**

- Replace `import { type CommentView } from '../lib/lemmy';` with `import type { Comment } from '../lib/api/types';`.
- Tree building changes: today uses `comment.path` to detect parent/child. Replace with `comment.parentId` + `comment.depth`. The tree builder becomes: for each comment, group by `parentId`; render children indented by `comment.depth * INDENT_PX`.
- All prop types referencing `CommentView` → `Comment`.

- [ ] **Step 2: Update CommentList.test.tsx**

- Use `renderWithBackend` + `makeComment` fixtures.
- Build threaded fixtures with `parentId` instead of `path` strings.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/CommentList.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CommentList.tsx src/components/CommentList.test.tsx
git commit -m "refactor(CommentList): migrate to neutral Comment + parentId tree"
```

> ✅ **Compact point E1 reached.** Run `npm test -- --run` to confirm full suite still passes. Safe to compact.

### Task 19: Round 2 — useCommentLoader collapsed into useAsync

**Files:**
- Delete: `src/hooks/useCommentLoader.ts`
- Delete: `src/hooks/useCommentLoader.test.ts`
- Create: `src/hooks/useAsync.ts`
- Create: `src/hooks/useAsync.test.ts`

- [ ] **Step 1: Write a failing test for useAsync**

```ts
// src/hooks/useAsync.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  it('returns data on success', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []));
    await waitFor(() => expect(result.current.data).toBe(42));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns error on failure', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('nope')), []));
    await waitFor(() => expect(result.current.error?.message).toBe('nope'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Implement useAsync**

```ts
// src/hooks/useAsync.ts
import { useEffect, useState, type DependencyList } from 'react';

export interface AsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncResult<T> {
  const [state, setState] = useState<AsyncResult<T>>({ data: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fn().then(
      (data) => { if (!cancelled) setState({ data, loading: false, error: null }); },
      (err: Error) => { if (!cancelled) setState({ data: null, loading: false, error: err }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
```

- [ ] **Step 3: Delete the old hook and its test**

```bash
rm src/hooks/useCommentLoader.ts src/hooks/useCommentLoader.test.ts
```

- [ ] **Step 4: Run useAsync tests**

Run: `npx vitest run src/hooks/useAsync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAsync.ts src/hooks/useAsync.test.ts
git rm src/hooks/useCommentLoader.ts src/hooks/useCommentLoader.test.ts
git commit -m "refactor: replace useCommentLoader with generic useAsync (logic moved to Lemmy adapter)"
```

### Task 20: Round 2 — PostCardShell

**Files:**
- Modify: `src/components/PostCardShell.tsx`
- Modify: `src/components/PostCardShell.test.tsx`

- [ ] **Step 1: Update PostCardShell.tsx**

- Replace the hand-rolled `Post`/`Community`/`Creator`/`Counts` interfaces with `import type { Post, Comment } from '../lib/api/types';`.
- Replace the destructured `post, community, creator, counts` props with a single `post: Post` prop (community = `post.source`, creator = `post.author`, counts = `post.counts`).
- Field renames inside the component: `post.name` → `post.title`; `post.ap_id` → `post.permalink`; `community.actor_id` → `post.source.handle` (split on `@` if you need just the instance for display); `community.name` → `post.source.name` (or `post.source.handle.split('@')[0]` for the slug); `creator.name`/`creator.display_name`/`creator.avatar`/`creator.actor_id` → `post.author.handle`/`post.author.displayName`/`post.author.avatar`/`post.author.profileUrl`; `post.thumbnail_url` → `post.mediaUrl`; `post.url` → `post.externalUrl`.
- Replace `savePost(auth.instance, auth.token, post.id, newSaved)` with `backend.posts.save(post.id, newSaved)` via `useBackend()`.
- Replace `resolveCommentId` + `createComment` calls with `backend.comments.create({ postId: post.id, parentId: parentComment?.id, body: content })`.
- Replace `editComment` similarly with `backend.comments.edit(target.id, content)`.
- `localReplies: CommentView[]` → `localReplies: Comment[]`.
- The instance pill (currently `instanceFromActorId(community.actor_id)`) becomes `post.source.handle.split('@')[1] ?? ''`.

- [ ] **Step 2: Update PostCardShell.test.tsx**

- Use `renderWithBackend(...)` and `makePost`/`makeComment` fixtures.
- Save-button assertions: `expect(backend.state.saves[post.id]).toBe(true)`.
- Replace the `vi.mock('../lib/lemmy')` block entirely.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/PostCardShell.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx
git commit -m "refactor(PostCardShell): migrate to neutral Post type"
```

### Task 21: Round 2 — PostCard

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Update PostCard.tsx**

- Replace `import { type PostView, type CommentSortType } from '../lib/lemmy';` with `import type { Post } from '../lib/api/types';`.
- Change `post: PostView` to `post: Post`.
- Remove the `const { post: p, community, creator, counts } = post;` destructuring; pass `post` straight through to `PostCardShell`.
- Replace `useCommentLoader(p, community, auth, activeSort)` with:
  ```ts
  const { data: comments, loading } = useAsync(
    () => backend.comments.list(post.id, { sortId: activeSort }),
    [post.id, activeSort, backend],
  );
  const commentsLoaded = !loading;
  ```
- The `activeSort` type changes from `CommentSortType` to `string` (opaque feed/sort id).

- [ ] **Step 2: Update PostCard.test.tsx**

- Use `renderWithBackend` + `makePost` fixtures.
- Drop the `vi.mock` block.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/PostCard.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.test.tsx
git commit -m "refactor(PostCard): migrate to Backend abstraction"
```

> ✅ **Compact point E2 reached.** Run `npm test -- --run`. Safe to compact.

### Task 22: Round 3 — HeaderBar

**Files:**
- Modify: `src/components/HeaderBar.tsx`
- Modify: `src/components/HeaderBar.test.tsx`

- [ ] **Step 1: Update HeaderBar.tsx**

- Replace `import { type SortType, type StakType, type CommentSortType } from '../lib/lemmy';` with `import { useBackend } from '../lib/api/context';`.
- Delete the `SORT_OPTIONS` and `STAKS` constants. Replace their consumers with `const { capabilities } = useBackend(); const feedOptions = capabilities.feedOptions;`. Export shape stays similar but the values come from capabilities.
- For sort dropdown, render `capabilities.feedOptions.map(o => <option>{o.label}</option>)`.
- All `SortType`/`StakType`/`CommentSortType` references in props become `string`.

- [ ] **Step 2: Update HeaderBar.test.tsx**

- Use `renderWithBackend(<HeaderBar ... />, { capabilities: { feedOptions: [{id:'Hot', label:'Hot'}] } })` to control the dropdown.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/HeaderBar.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/HeaderBar.tsx src/components/HeaderBar.test.tsx
git commit -m "refactor(HeaderBar): drop SORT_OPTIONS/STAKS constants; read from capabilities"
```

### Task 23: Round 3 — MenuDrawer + useStaks hook

**Files:**
- Modify: `src/components/MenuDrawer.tsx`
- Modify: `src/components/MenuDrawer.test.tsx`
- Create: `src/hooks/useStaks.ts`

- [ ] **Step 1: Create useStaks hook**

```ts
// src/hooks/useStaks.ts
import { useBackend } from '../lib/api/context';
import type { Stak } from '../lib/api/types';

export function useStaks(): Stak[] {
  const backend = useBackend();
  return backend.listStaks();
}
```

- [ ] **Step 2: Update MenuDrawer.tsx**

- Replace `import { type SortType, type StakType } from '../lib/lemmy';` with `import { useStaks } from '../hooks/useStaks';` and `import { useBackend } from '../lib/api/context';`.
- The active stak comes from props (passed by `App`/`FeedStack`); the list of available staks comes from `useStaks()`.
- Feed (sort) options from `useBackend().capabilities.feedOptions`.

- [ ] **Step 3: Update MenuDrawer.test.tsx**

- Use `renderWithBackend`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/MenuDrawer.test.tsx src/hooks/useStaks.test.ts` (no test for useStaks — covered indirectly)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MenuDrawer.tsx src/components/MenuDrawer.test.tsx src/hooks/useStaks.ts
git commit -m "refactor(MenuDrawer): drive stak list and sort options from backend"
```

### Task 24: Round 3 — FeedStack

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 1: Update FeedStack.tsx**

- Replace `import { fetchPosts, fetchCommunityPosts, fetchUnreadCount, upvotePost, downvotePost, fetchCommunityInfo, followCommunity, blockCommunity, type PostView, type SortType, type StakType, type CommunityInfo } from '../lib/lemmy';` with `import { useBackend } from '../lib/api/context';` and `import type { Post, Source } from '../lib/api/types';`.
- State changes:
  - `posts: PostView[]` → `posts: Post[]`.
  - `undoStack: PostView[]` → `undoStack: Post[]`.
  - `page: number` → `cursor: string | null` (initialised `null`).
  - `sortType: SortType` → `feedId: string` (initial: `community ? 'Active' : settings.defaultFeedId`).
  - `stak: StakType` → `stakId: string` (initial: `auth === null ? 'all' : settings.activeStakId`).
  - `communityInfo: CommunityInfo | null` → `communityInfo: Source | null`.
- Fetch calls:
  - `fetchPosts(...)` → `backend.feed.getTimeline({ feedId, stakId, cursor })`.
  - `fetchCommunityPosts(...)` → `backend.feed.getSourceFeed(\`${community.name}@${community.instance}\`, { feedId, cursor })`.
  - `fetchUnreadCount(...)` → `backend.notifications.unreadCount()`.
  - `fetchCommunityInfo(...)` → `backend.sources.get(\`${community.name}@${community.instance}\`)`.
  - `followCommunity(...)` → `backend.sources.subscribe(communityInfo.id, follow)`.
  - `blockCommunity(...)` → `backend.sources.block(communityInfo.id, true)`.
  - `upvotePost(...)` → `backend.posts.vote(post.id, 1)`.
  - `downvotePost(...)` → `backend.posts.vote(post.id, -1)`.
- Pagination logic: after a fetch, set `cursor` to `page.nextCursor`; `canLoadMore = cursor !== null` (but be careful — initial load has cursor=null too, so use a separate `exhausted` flag set when a fetch returns `nextCursor === null && items.length === 0`).
- Replace `post.post.id` everywhere with `post.id`.
- Replace `community.actor_id`/`community.name`/`community.subscribed` with the equivalents on `Source` (`source.handle`, `source.name`, `source.viewer?.subscribed`).

- [ ] **Step 2: Update FeedStack.test.tsx**

- Use `renderWithBackend` with `{ posts: [makePost({...})] }` fixtures.
- For vote assertions, check `backend.state.votes[post.id]`.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/FeedStack.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "refactor(FeedStack): migrate to Backend; replace page:number with opaque cursor"
```

> ✅ **Compact point E3 reached.** Run `npm test -- --run` and `npm run build`. Safe to compact.

### Task 25: Round 4 — LoginPage

**Files:**
- Modify: `src/components/LoginPage.tsx`
- Modify: `src/components/LoginPage.test.tsx`

- [ ] **Step 1: Update LoginPage.tsx**

- Replace `import { login } from '../lib/lemmy';` with `import { useBackend } from '../lib/api/context';`.
- Form fields stay the same (instance + user + pass).
- On submit: `await backend.auth.login({ instance, usernameOrEmail: username, password })` and the returned `Session` is persisted by the calling code (via a prop callback or context store).

- [ ] **Step 2: Update LoginPage.test.tsx**

- Use `renderWithBackend`.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/LoginPage.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/LoginPage.tsx src/components/LoginPage.test.tsx
git commit -m "refactor(LoginPage): call backend.auth.login"
```

### Task 26: Round 4 — SettingsPage and SettingsContext

**Files:**
- Modify: `src/lib/store.ts` (settings shape only — session migration in Task 33)
- Modify: `src/lib/SettingsContext.tsx`
- Modify: `src/lib/SettingsContext.test.tsx`
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/components/SettingsPage.test.tsx`

- [ ] **Step 1: Update `AppSettings` shape in store.ts**

In `store.ts`, change the `AppSettings` interface:

```ts
export interface AppSettings {
  nonUpvoteSwipeAction: 'downvote' | 'dismiss';
  swapGestures: boolean;
  blurNsfw: boolean;
  defaultFeedId: string;          // renamed from defaultSort
  activeStakId: string;            // renamed from activeStak
  defaultCommentSortId: string;    // renamed from commentSort
  showCommentSortBar: boolean;
  shareLinkFormat: 'stakswipe' | 'source' | 'home';
  lemmy: { anonInstance: string }; // moved
}
```

Update `DEFAULT_SETTINGS` similarly. In `loadSettings`, add migration for the rename:

```ts
if ('defaultSort' in parsed && !('defaultFeedId' in parsed)) parsed.defaultFeedId = parsed.defaultSort;
if ('activeStak' in parsed && !('activeStakId' in parsed)) {
  const v = parsed.activeStak as string;
  parsed.activeStakId = v === 'Anonymous' ? 'all' : String(v).toLowerCase();
}
if ('commentSort' in parsed && !('defaultCommentSortId' in parsed)) parsed.defaultCommentSortId = parsed.commentSort;
if ('anonInstance' in parsed && !parsed.lemmy) parsed.lemmy = { anonInstance: parsed.anonInstance };
```

Drop the import of Lemmy types from `lemmy.ts` (the file currently does `import { type SortType, type StakType, type CommentSortType } from './lemmy';` — delete this).

- [ ] **Step 2: Update SettingsContext.tsx**

Field renames mirror `AppSettings`.

- [ ] **Step 3: Update SettingsPage.tsx**

- Sort dropdown reads `useBackend().capabilities.feedOptions`.
- Stak section reads `useStaks()`.
- Comment sort dropdown reads `useBackend().capabilities.commentSortOptions`.
- Anon instance lives at `settings.lemmy.anonInstance`.

- [ ] **Step 4: Update tests**

- Use `renderWithBackend`.

- [ ] **Step 5: Run all settings-related tests**

Run: `npx vitest run src/lib/SettingsContext.test.tsx src/components/SettingsPage.test.tsx src/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.ts src/lib/SettingsContext.tsx src/lib/SettingsContext.test.tsx src/components/SettingsPage.tsx src/components/SettingsPage.test.tsx
git commit -m "refactor(settings): rename sort→feedId, stak→stakId; lemmy.anonInstance subobject"
```

### Task 27: Round 4 — InboxPage

**Files:**
- Modify: `src/components/InboxPage.tsx`
- Modify: `src/components/InboxPage.test.tsx`

- [ ] **Step 1: Update InboxPage.tsx**

- Replace Lemmy imports with `import { useBackend } from '../lib/api/context';` and `import type { Notification } from '../lib/api/types';`.
- Drop the local `NotifItem` union — use `Notification`.
- Fetch replaces `fetchReplies` / `fetchMentions` with `backend.notifications.list({ unreadOnly, cursor: null })`. Filter the resulting array by `n.kind === 'reply'` or `n.kind === 'mention'` for the two tabs.
- `markReplyAsRead` / `markMentionAsRead` → `backend.notifications.markRead(notification.id)`.
- `fetchUnreadCount` → `backend.notifications.unreadCount()`.

- [ ] **Step 2: Update InboxPage.test.tsx**

- Use `renderWithBackend` with notification fixtures.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/InboxPage.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/InboxPage.tsx src/components/InboxPage.test.tsx
git commit -m "refactor(InboxPage): unify replies+mentions via Notification"
```

### Task 28: Round 4 — ProfilePage

**Files:**
- Modify: `src/components/ProfilePage.tsx`
- Modify: `src/components/ProfilePage.test.tsx`
- Modify: `src/components/ProfilePostDetailPage.tsx`
- Modify: `src/components/ProfilePostDetailPage.test.tsx`

- [ ] **Step 1: Update ProfilePage.tsx**

- Replace `fetchPersonDetails(...)` with three calls (or a `Promise.all` of two — get + getPosts; comments fetched lazily on tab switch):
  ```ts
  const { data } = useAsync(async () => {
    const [user, posts, comments] = await Promise.all([
      backend.users.get(handle),
      backend.users.getPosts(handle, { cursor: null }),
      backend.users.getComments(handle, { cursor: null }),
    ]);
    return { user, posts: posts.items, comments: comments.items };
  }, [handle, backend]);
  ```
- `blockPerson(...)` → `backend.users.block(user.id, true)`.
- `deletePost(...)` → `backend.posts.delete(post.id)`.
- `deleteComment(...)` → `backend.comments.delete(comment.id)`.
- Type swaps: `PostView` → `Post`, `CommentView` → `Comment`.

- [ ] **Step 2: Update ProfilePostDetailPage.tsx**

Same pattern — replace `fetchPost` with `backend.posts.get(postId)`. (`postId` from the URL must be the neutral encoded id; routes still pass the legacy numeric id, which the adapter will encode in Task 32 below.)

- [ ] **Step 3: Update tests**

- Use `renderWithBackend` with `users`, `posts`, `comments` fixtures.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/ProfilePage.test.tsx src/components/ProfilePostDetailPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfilePage.tsx src/components/ProfilePage.test.tsx src/components/ProfilePostDetailPage.tsx src/components/ProfilePostDetailPage.test.tsx
git commit -m "refactor(Profile): split fetchPersonDetails into users.get + getPosts + getComments"
```

### Task 29: Round 4 — SavedPage, SearchPage, CreatePostPage

**Files:**
- Modify: `src/components/SavedPage.tsx` + test
- Modify: `src/components/SavedPostDetailPage.tsx` + test
- Modify: `src/components/SearchPage.tsx` + test
- Modify: `src/components/CreatePostPage.tsx` + test

- [ ] **Step 1: SavedPage**

- `fetchSavedPosts(...)` → `backend.feed.getSavedPosts({ cursor })`.
- `savePost(...)` → `backend.posts.save(post.id, saved)`.
- `PostView` → `Post`.

- [ ] **Step 2: SavedPostDetailPage**

- Type swap only (it currently imports `type PostView`).

- [ ] **Step 3: SearchPage**

- `searchCommunities(...)` → `backend.search.sources(query, { cursor })`.
- `searchPosts(...)` → `backend.search.posts(query, { cursor })`.
- `CommunityView` → `Source`; `PostView` → `Post`.

- [ ] **Step 4: CreatePostPage**

- `resolveCommunityId` + `createPost` → `backend.posts.create({ sourceHandle: \`${community}@${instance}\`, title, body, url, nsfw })`.
- `uploadImage(...)` → `backend.media.uploadImage(file)`.

- [ ] **Step 5: Update each component's test**

- Use `renderWithBackend` with appropriate fixtures.

- [ ] **Step 6: Run tests**

Run:
```bash
npx vitest run src/components/SavedPage.test.tsx \
  src/components/SavedPostDetailPage.test.tsx \
  src/components/SearchPage.test.tsx \
  src/components/CreatePostPage.test.tsx
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/SavedPage.tsx src/components/SavedPage.test.tsx src/components/SavedPostDetailPage.tsx src/components/SavedPostDetailPage.test.tsx src/components/SearchPage.tsx src/components/SearchPage.test.tsx src/components/CreatePostPage.tsx src/components/CreatePostPage.test.tsx
git commit -m "refactor: migrate Saved/Search/CreatePost to Backend"
```

### Task 30: Round 4 — PostDetailPage, PostViewPage, SharedPostPage, PostDetailCard

**Files:**
- Modify: `src/components/PostDetailPage.tsx` + test
- Modify: `src/components/PostViewPage.tsx` + test
- Modify: `src/components/SharedPostPage.tsx` + test
- Modify: `src/components/PostDetailCard.tsx` + test

- [ ] **Step 1: Migrate type usages and API calls**

- `fetchPost(...)` → `backend.posts.get(postId)` where `postId` is the neutral encoded id. For routes that still pass a numeric Lemmy id in the URL (today's `/post/:id`), construct the encoded id by calling `backend.posts.getByPermalink(...)` from a URL OR temporarily accept a numeric id and treat it as a legacy local id (encode as `"${id}|"` and let the Lemmy adapter handle the missing apId — the adapter's `parsePostId` should treat empty apId as "no source instance available").

  **Adapter touchup needed:** Modify `parsePostId` in `mappers.ts` to allow `"42|"` (empty apId means "unknown source"). The Lemmy `posts.get` already only uses `localId` so this works. Update the existing test to confirm.

- `PostView` → `Post`; `CommentView` → `Comment`; `CommentSortType` → `string`.
- For `SharedPostPage`, use `backend.posts.getByPermalink(url)`.

- [ ] **Step 2: Update tests**

- Use `renderWithBackend` with post fixtures.

- [ ] **Step 3: Run tests**

Run:
```bash
npx vitest run src/components/PostDetailPage.test.tsx \
  src/components/PostViewPage.test.tsx \
  src/components/SharedPostPage.test.tsx \
  src/components/PostDetailCard.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PostDetailPage.tsx src/components/PostDetailPage.test.tsx src/components/PostViewPage.tsx src/components/PostViewPage.test.tsx src/components/SharedPostPage.tsx src/components/SharedPostPage.test.tsx src/components/PostDetailCard.tsx src/components/PostDetailCard.test.tsx src/lib/api/backends/lemmy/mappers.ts src/lib/api/backends/lemmy/mappers.test.ts
git commit -m "refactor: migrate post-detail pages to Backend; allow empty apId in postId encoding"
```

### Task 31: Round 4 — CommunityAboutPage, CommunityHeader

**Files:**
- Modify: `src/components/CommunityAboutPage.tsx` + test
- Modify: `src/components/CommunityHeader.tsx` + test

- [ ] **Step 1: CommunityAboutPage**

- `fetchCommunityInfo(...)` → `backend.sources.get(\`${name}@${instance}\`)`.
- `CommunityInfo` → `Source`.

- [ ] **Step 2: CommunityHeader**

- Replace `import { type SortType, type CommunityInfo } from '../lib/lemmy';` with `import { useBackend } from '../lib/api/context';` and `import type { Source } from '../lib/api/types';`.
- Sort dropdown reads `useBackend().capabilities.feedOptions`.

- [ ] **Step 3: Update tests and run**

Run: `npx vitest run src/components/CommunityAboutPage.test.tsx src/components/CommunityHeader.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CommunityAboutPage.tsx src/components/CommunityAboutPage.test.tsx src/components/CommunityHeader.tsx src/components/CommunityHeader.test.tsx
git commit -m "refactor: migrate community pages to Backend"
```

> ✅ **Compact point E4 reached.** Run `npm test -- --run` and `npm run build`. Safe to compact.

### Task 32: Round 5 — ReportSheet, ReplySheet, useNotificationPolling, useShare/urlUtils

**Files:**
- Modify: `src/components/ReportSheet.tsx` + test
- Modify: `src/components/ReplySheet.tsx` + test (type swap only)
- Modify: `src/hooks/useNotificationPolling.ts` + test
- Modify: `src/lib/urlUtils.ts` + test
- Modify: `src/hooks/useShare.ts` (if needed)

- [ ] **Step 1: ReportSheet**

- `reportPost(...)` → `backend.posts.report(postId, reason)`.
- `reportComment(...)` → `backend.comments.report(commentId, reason)`.
- Drop `resolveCommentId` — adapter handles.

- [ ] **Step 2: ReplySheet**

- Replace `CommentView` with `Comment` in props.

- [ ] **Step 3: useNotificationPolling**

- `fetchUnreadCount(auth.instance, auth.token)` → `backend.notifications.unreadCount()` (called via `useBackend()`).

- [ ] **Step 4: urlUtils + useShare**

- `buildShareUrl(format, post, auth, communityActorId)` becomes `buildShareUrl(format, post: Post, viewer: User | null)` where the function reads `post.permalink`, `post.source.handle`, etc.
- Existing tests for `buildShareUrl` update to pass neutral `Post` fixtures.

- [ ] **Step 5: Update all related tests and run**

Run:
```bash
npx vitest run src/components/ReportSheet.test.tsx \
  src/components/ReplySheet.test.tsx \
  src/hooks/useNotificationPolling.test.ts \
  src/lib/urlUtils.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/ReportSheet.tsx src/components/ReportSheet.test.tsx src/components/ReplySheet.tsx src/components/ReplySheet.test.tsx src/hooks/useNotificationPolling.ts src/hooks/useNotificationPolling.test.ts src/lib/urlUtils.ts src/lib/urlUtils.test.ts src/hooks/useShare.ts
git commit -m "refactor: migrate sheets, polling, and share helpers to Backend"
```

> ✅ **Compact point E5 reached.** Run `npm test -- --run` and `npm run build`. Every component should now be off `lib/lemmy.ts`. Run `grep -rn "from '../lib/lemmy'" src/` — only `App.tsx` and `store.ts` (used by upcoming wire-up) and `lib/lemmy.ts` itself should remain. Safe to compact.

---

## Phase 6 — Wire-up (Compact Point F)

### Task 33: Session schema and migration in store.ts

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.ts`

- [ ] **Step 1: Write failing migration tests**

Add these tests to `src/lib/store.test.ts`:

```ts
import { loadSessionsWithMigration, saveSessions, saveActiveStak } from './store';

describe('loadSessionsWithMigration', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty when nothing is stored', () => {
    expect(loadSessionsWithMigration()).toEqual({ sessions: [], activeStak: null });
  });

  it('migrates legacy token/instance/username into a Session', () => {
    localStorage.setItem('stakswipe_token', 'jwt');
    localStorage.setItem('stakswipe_instance', 'lemmy.world');
    localStorage.setItem('stakswipe_username', 'alice');
    const { sessions, activeStak } = loadSessionsWithMigration();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].backendId).toBe('lemmy');
    expect(sessions[0].viewer?.handle).toBe('alice@lemmy.world');
    expect(sessions[0].data).toEqual({ instance: 'lemmy.world', token: 'jwt' });
    expect(activeStak?.sessionId).toBe(sessions[0].id);
    expect(activeStak?.stakId).toBe('all');
  });

  it('maps legacy Anonymous stak to "all"', () => {
    localStorage.setItem('stakswipe_token', 'jwt');
    localStorage.setItem('stakswipe_instance', 'lemmy.world');
    localStorage.setItem('stakswipe_username', 'alice');
    localStorage.setItem('stakswipe_settings', JSON.stringify({ activeStak: 'Anonymous' }));
    const { activeStak } = loadSessionsWithMigration();
    expect(activeStak?.stakId).toBe('all');
  });

  it('returns stored sessions if present', () => {
    saveSessions([{ id: 's1', backendId: 'lemmy', viewer: null, data: {} }]);
    saveActiveStak({ sessionId: 's1', stakId: 'all' });
    const { sessions } = loadSessionsWithMigration();
    expect(sessions[0].id).toBe('s1');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL — function not defined.

- [ ] **Step 3: Implement migration in store.ts**

Add:

```ts
import type { Session, User, ActiveStakRef } from './api/types';

const SESSIONS_KEY = 'stakswipe_sessions';
const ACTIVE_STAK_KEY = 'stakswipe_active_stak';

export function saveSessions(sessions: Session[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadSessions(): Session[] {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Session[]; } catch { return []; }
}

export function saveActiveStak(ref: ActiveStakRef): void {
  localStorage.setItem(ACTIVE_STAK_KEY, JSON.stringify(ref));
}

export function loadActiveStak(): ActiveStakRef | null {
  const raw = localStorage.getItem(ACTIVE_STAK_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as ActiveStakRef; } catch { return null; }
}

function synthesizeUserFromLegacy(username: string, instance: string): User {
  return {
    id: `legacy-${username}`,
    handle: `${username}@${instance}`,
    profileUrl: `https://${instance}/u/${username}`,
  };
}

export function loadSessionsWithMigration(): { sessions: Session[]; activeStak: ActiveStakRef | null } {
  const stored = loadSessions();
  if (stored.length > 0) return { sessions: stored, activeStak: loadActiveStak() };

  const token = localStorage.getItem('stakswipe_token');
  const instance = localStorage.getItem('stakswipe_instance');
  const username = localStorage.getItem('stakswipe_username');
  if (!token || !instance || !username) return { sessions: [], activeStak: null };

  const session: Session = {
    id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `legacy-${Date.now()}`,
    backendId: 'lemmy',
    viewer: synthesizeUserFromLegacy(username, instance),
    data: { instance, token },
  };
  saveSessions([session]);

  let stakId = 'all';
  try {
    const settings = JSON.parse(localStorage.getItem('stakswipe_settings') ?? '{}');
    const legacy = settings.activeStak ?? settings.activeStakId ?? 'All';
    stakId = legacy === 'Anonymous' ? 'all' : String(legacy).toLowerCase();
  } catch {}
  const activeStak = { sessionId: session.id, stakId };
  saveActiveStak(activeStak);

  // Legacy keys preserved for rollback safety.
  return { sessions: [session], activeStak };
}
```

Keep the existing `loadAuth` / `saveAuth` / `clearAuth` exports in place for one release — they're no longer called from the migrated app, but legacy localStorage keys are still readable.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat(store): Session[] schema with legacy migration"
```

### Task 34: Wire backend + sessions in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Register the Lemmy backend at module top**

In `src/App.tsx`, add at top:

```ts
import { registerBackend, createBackend } from './lib/api/registry';
import { BackendProvider } from './lib/api/context';
import { createLemmyBackend } from './lib/api/backends/lemmy';
import { loadSessionsWithMigration, saveSessions, saveActiveStak, loadActiveStak } from './lib/store';
import { loadSettings } from './lib/store';

registerBackend('lemmy', (session) => createLemmyBackend(session, {
  anonInstanceSetting: () => loadSettings().lemmy.anonInstance || undefined,
}));
```

- [ ] **Step 2: Replace `useState<AuthState>` with sessions + active stak state**

In the `App` component body:

- Replace the existing auth state with:
  ```ts
  const [{ sessions, activeStak }, setSessionsState] = useState(() => {
    const initial = loadSessionsWithMigration();
    // If user has no real session, create an in-memory anonymous Lemmy session for browsing.
    if (initial.sessions.length === 0) {
      const anonInstance = loadSettings().lemmy.anonInstance || '';
      const anon: Session = {
        id: 'anon-lemmy',
        backendId: 'lemmy',
        viewer: null,
        data: { instance: anonInstance, token: null },
      };
      return { sessions: [anon], activeStak: { sessionId: 'anon-lemmy', stakId: 'all' } };
    }
    return initial;
  });
  ```
- The active session is the one matching `activeStak.sessionId`. Construct the backend from it: `const backend = useMemo(() => createBackend(activeSession), [activeSession.id]);`.
- Wrap the router tree in `<BackendProvider value={backend}>`.

- [ ] **Step 3: Wire login + logout flows**

- Login: after `LoginPage` calls `backend.auth.login(...)` and returns a `Session`, App.tsx persists it via `saveSessions([...sessions.filter(s => s.viewer), newSession])` and switches active stak to the new session's `all` stak.
- Logout: remove the logged-in session, fall back to the anonymous session.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- Open `http://localhost:5173`.
- Verify: existing logged-in user (if you have local creds) still sees their feed.
- Verify: anonymous browsing works.
- Verify: stak switching works.
- Verify: voting, commenting, replying, saving still works.

- [ ] **Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire BackendProvider; load sessions from store with migration"
```

> ✅ **Compact point F reached.** Live wiring done. Safe to compact.

---

## Phase 7 — Cleanup (Compact Point G)

### Task 35: Delete lib/lemmy.ts and verify

**Files:**
- Delete: `src/lib/lemmy.ts`
- Delete: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Audit remaining references**

Run: `grep -rn "from '\.\./lib/lemmy'" src/ && grep -rn "from '\./lemmy'" src/lib/ && grep -rn "vi.mock.*lib/lemmy" src/`
Expected: Empty output — no remaining references.

If output is non-empty, fix each remaining reference (it indicates a missed migration; revisit the relevant component).

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/lemmy.ts src/lib/lemmy.test.ts
```

- [ ] **Step 3: Verify build and tests**

Run: `npm run build && npm test -- --run`
Expected: Both PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove legacy lib/lemmy.ts; all consumers migrated"
```

> ✅ **Compact point G reached.** Refactor complete. Legacy localStorage keys remain for one release.

---

## Self-Review Checklist (for the plan author)

- [x] Every public symbol in `Backend` has an implementation task for both Lemmy and Mock.
- [x] All ~30 component files identified in the spec's component-migration table have a task.
- [x] Compact points A–G correspond 1-to-1 with the spec's compact points.
- [x] Each task has bite-sized steps with exact code or exact commands.
- [x] No placeholder text ("TBD", "TODO", "implement appropriate") remains.
- [x] Type names used in later tasks match those defined in earlier tasks (`Post`, `Comment`, `Source`, `User`, `Notification`, `Session`, `Stak`, `SelectOption`, `ActiveStakRef`, `Capabilities`, `Backend`, sub-services).
- [x] `parsePostId` is referenced in Task 30 with the note that it must accept empty `apId` — Task 30 Step 1 explicitly modifies the mapper to support this.
- [x] `loadSessionsWithMigration` defined in Task 33; used in Task 34.
- [x] `registerBackend` defined in Task 5; used in Task 34.
- [x] `useStaks` defined in Task 23; used in Task 26.
- [x] `useAsync` defined in Task 19; used in Tasks 21 and 28.
- [x] `renderWithBackend` defined in Task 16; used in every component task that follows.
- [x] Spec coverage: Background, Architecture, Types, Backend interface, Lemmy adapter, Mock, Component migration table, Persistence migration, Testing strategy, Rollout — every one has at least one task.
