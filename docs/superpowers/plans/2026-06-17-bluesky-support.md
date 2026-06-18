# Bluesky Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Bluesky backend so users can add a Bluesky account (app password) and run the core Stakswipe swipe loop against it — browse feeds, swipe-right to like, read the reply thread, open a post, and view a profile.

**Architecture:** A new adapter under `src/lib/api/backends/bluesky/` implements the existing neutral `Backend` interface against `@atproto/api`. Bluesky feeds (Following, Discover, pinned feeds) surface in the existing sort-dropdown via dynamic `capabilities.feedOptions`; each account is a single "Home" stak. Services take an injected `Agent` so they unit-test without network. A new `hasSources` capability hides the community chip for Bluesky. The rest of the `Backend` sub-services are stubbed for this version.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + jsdom + @testing-library/react, `@atproto/api`.

**Spec reference:** `docs/superpowers/specs/2026-06-17-bluesky-support-design.md`

## Global Constraints

- **Branch:** `decouple`. Never commit to `main`.
- **Type check:** `npx tsc --noEmit` must pass after every task.
- **Tests:** Vitest. Run a single file with `npm test -- <path>`; full suite with `npm test`.
- **Service endpoint:** Bluesky service is `https://bsky.social`.
- **Discover feed URI:** `at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot`.
- **Stable session id:** `bluesky:<handle>` with handle lowercased.
- **Post/Comment id encoding:** `<at-uri>|<cid>` via `encodeBlueskyId` / `parseBlueskyId`.
- **House style:** `as any` casts are acceptable for native↔neutral mapping, matching the existing Lemmy adapter (`(pv.counts as any)`).
- **Services receive an injected agent** (`getAgent: () => Agent`) so service tests pass a fake agent object and never mock the `@atproto/api` module. Only `agent.ts` and the backend-assembly test mock the module.

---

## File Structure

**Create:**
- `src/lib/api/backends/bluesky/mappers.ts` — id encoding + native→neutral mappers
- `src/lib/api/backends/bluesky/mappers.test.ts`
- `src/lib/api/backends/bluesky/session.ts` — session data type, stak list, feed-option derivation, `resolveFeeds`
- `src/lib/api/backends/bluesky/session.test.ts`
- `src/lib/api/backends/bluesky/capabilities.ts` — `buildBlueskyCapabilities(session)`
- `src/lib/api/backends/bluesky/capabilities.test.ts`
- `src/lib/api/backends/bluesky/agent.ts` — build/resume/login an `Agent`
- `src/lib/api/backends/bluesky/agent.test.ts`
- `src/lib/api/backends/bluesky/feed.ts` — FeedService
- `src/lib/api/backends/bluesky/feed.test.ts`
- `src/lib/api/backends/bluesky/posts.ts` — PostService
- `src/lib/api/backends/bluesky/posts.test.ts`
- `src/lib/api/backends/bluesky/comments.ts` — CommentService
- `src/lib/api/backends/bluesky/comments.test.ts`
- `src/lib/api/backends/bluesky/users.ts` — UserService
- `src/lib/api/backends/bluesky/users.test.ts`
- `src/lib/api/backends/bluesky/stubs.ts` — shared not-supported throwers/no-ops
- `src/lib/api/backends/bluesky/index.ts` — `createBlueskyBackend(session, opts)` + auth
- `src/lib/api/backends/bluesky/index.test.ts`

**Modify:**
- `src/lib/api/capabilities.ts` — add `hasSources: boolean`
- `src/lib/api/backends/lemmy/index.ts` — set `hasSources: true`
- `src/lib/api/backends/mock/index.ts` — set `hasSources: true` in `DEFAULT_CAPABILITIES`
- `src/lib/accounts.ts` — add `updateSessionData(sessionId, data)`
- `src/lib/accounts.test.ts` — test `updateSessionData`
- `src/components/PostCardShell.tsx` — author-only header when `!hasSources`
- `src/components/PostCardShell.test.tsx` — author-only assertion
- `src/components/FeedStack.tsx` — dynamic feedOptions pill row + `pickFeedId` fallback
- `src/components/FeedStack.test.tsx` — `pickFeedId` unit test
- `src/lib/api/backends/index.ts` — register `bluesky`
- `src/lib/api/backends/index.test.ts` — assert bluesky registered

---

## Task 1: Add `hasSources` capability flag

Adds a required boolean to `Capabilities` so the card can hide the community chip for backends without communities. Lemmy and mock set it `true`.

**Files:**
- Modify: `src/lib/api/capabilities.ts`
- Modify: `src/lib/api/backends/lemmy/index.ts:43` (after `sourceNoun: 'Community',`)
- Modify: `src/lib/api/backends/mock/index.ts:24` (after `sourceNoun: 'Source',`)
- Test: `src/lib/api/backends/lemmy/capabilities.test.ts`

**Interfaces:**
- Produces: `Capabilities.hasSources: boolean`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/api/backends/lemmy/capabilities.test.ts` inside the existing `describe('lemmy capabilities', ...)` block:

```ts
  it('declares that lemmy has sources (communities)', () => {
    const caps = createLemmyBackend(ANON).capabilities;
    expect(caps.hasSources).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/lemmy/capabilities.test.ts`
Expected: FAIL — `hasSources` is `undefined`.

- [ ] **Step 3: Add the field to the type**

In `src/lib/api/capabilities.ts`, add to the `Capabilities` interface after `hasSavedPosts: boolean;`:

```ts
  hasSources: boolean;
```

- [ ] **Step 4: Set the flag on Lemmy and mock**

In `src/lib/api/backends/lemmy/index.ts`, in `LEMMY_CAPABILITIES`, add after `sourceNoun: 'Community',`:

```ts
  hasSources: true,
```

In `src/lib/api/backends/mock/index.ts`, in `DEFAULT_CAPABILITIES`, add after `sourceNoun: 'Source',`:

```ts
  hasSources: true,
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/lib/api/backends/lemmy/capabilities.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS (the two full capability literals now satisfy the type; partial overrides in `renderWithBackend` are unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/capabilities.ts src/lib/api/backends/lemmy/index.ts src/lib/api/backends/mock/index.ts src/lib/api/backends/lemmy/capabilities.test.ts
git commit -m "feat(api): add hasSources capability flag"
```

---

## Task 2: Author-only card header when `!hasSources`

`PostCardShell` shows a community avatar + `c/<name>` row from `post.source`. When the active backend has no sources, render the author as the primary identity and skip the community row.

**Files:**
- Modify: `src/components/PostCardShell.tsx:197-228` (the `.meta` block)
- Test: `src/components/PostCardShell.test.tsx`

**Interfaces:**
- Consumes: `Capabilities.hasSources` (Task 1); `useBackend()` already in scope at `PostCardShell.tsx:66`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/PostCardShell.test.tsx` a new `describe` (keep existing tests). Reuse the file's existing `renderShell(props, opts)` helper (it supplies required `comments`/`commentsLoaded` props and wraps in `SettingsProvider`) and the `makePost`/`makeUser`/`makeSource` fixtures already imported at the top of the file:

```tsx
describe('PostCardShell community chip', () => {
  it('hides the community row when hasSources is false', () => {
    const post = makePost({
      author: makeUser({ handle: 'alice.bsky.social', displayName: 'Alice' }),
      source: makeSource({ handle: 'alice.bsky.social', name: 'alice.bsky.social' }),
      title: 'hello',
    });
    renderShell({ post }, { capabilities: { hasSources: false } });
    expect(screen.queryByText(/^c\//)).not.toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows the community row when hasSources is true', () => {
    const post = makePost({
      source: makeSource({ handle: 'news@lemmy.world', name: 'news' }),
      title: 'hello',
    });
    renderShell({ post }, { capabilities: { hasSources: true } });
    expect(screen.getByText('c/news')).toBeInTheDocument();
  });
});
```

Note: `renderShell` already imports `screen`, `makePost`, `makeUser`, `makeSource`, and `RenderWithBackendOptions`. No new imports needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/PostCardShell.test.tsx`
Expected: FAIL — `c/...` still rendered when `hasSources` is false.

- [ ] **Step 3: Read `hasSources` and branch the header**

In `src/components/PostCardShell.tsx`, just after `const backend = useBackend();` (line ~66) add:

```ts
  const hasSources = backend.capabilities.hasSources;
```

Replace the `.meta` block (`<div className={styles.meta}> … </div>`, lines ~197-228) with:

```tsx
        <div className={styles.meta}>
          {hasSources ? (
            <>
              <CommunityAvatar name={srcName} icon={post.source.icon} size={32} />
              <div>
                <div
                  className={styles.communityName}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/community/${srcInstance}/${srcName}`)}
                >
                  c/{srcName}
                </div>
                <div className={styles.instanceName}>{srcInstance}</div>
                {authorInstance ? (
                  <button
                    className={styles.creatorLink}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/user/${authorInstance}/${authorName}`);
                    }}
                  >
                    <CreatorAvatar name={authorName} avatar={post.author.avatar} size={16} />
                    {post.author.displayName ?? authorName}
                  </button>
                ) : (
                  <div className={styles.instanceName}>{post.author.displayName ?? post.author.handle}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <CreatorAvatar name={authorName} avatar={post.author.avatar} size={32} />
              <div>
                <div className={styles.communityName}>{post.author.displayName ?? authorName}</div>
                <div className={styles.instanceName}>@{post.author.handle}</div>
              </div>
            </>
          )}
          <div className={styles.metaStats}>
            <span data-testid="meta-score">▲ {post.counts.score}</span>
            <span data-testid="meta-comments">💬 {post.counts.comments}</span>
            <span data-testid="meta-age">{timeAgo(post.publishedAt)}</span>
          </div>
        </div>
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/PostCardShell.test.tsx`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx
git commit -m "feat(card): author-only header for backends without sources"
```

---

## Task 3: `updateSessionData` accounts helper

Bluesky refresh tokens rotate; the backend must persist refreshed tokens into the stored account.

**Files:**
- Modify: `src/lib/accounts.ts`
- Test: `src/lib/accounts.test.ts`

**Interfaces:**
- Produces: `updateSessionData(sessionId: string, data: Partial<Session['data']>): void`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/accounts.test.ts` (import `updateSessionData` in the existing import from `./accounts`):

```ts
  it('updateSessionData merges fields into the stored account session data', () => {
    saveAccounts([{ session: session('bluesky:a', 'a'), addedAt: 1 }]);
    updateSessionData('bluesky:a', { accessJwt: 'NEW', refreshJwt: 'NEWR' } as any);
    const stored = loadAccounts()[0].session.data as Record<string, unknown>;
    expect(stored.accessJwt).toBe('NEW');
    expect(stored.refreshJwt).toBe('NEWR');
  });

  it('updateSessionData is a no-op for an unknown session id', () => {
    saveAccounts([{ session: session('bluesky:a', 'a'), addedAt: 1 }]);
    updateSessionData('bluesky:missing', { accessJwt: 'X' } as any);
    expect((loadAccounts()[0].session.data as Record<string, unknown>).accessJwt).toBeUndefined();
  });
```

If the test file's `session()` helper sets `data: { instance: 'x', token: 't' }`, that is fine — these tests only assert merged keys.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/accounts.test.ts`
Expected: FAIL — `updateSessionData` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/lib/accounts.ts`, add after `saveAccounts`:

```ts
export function updateSessionData(sessionId: string, data: Partial<Session['data']>): void {
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.session.id === sessionId);
  if (idx < 0) return;
  accounts[idx] = {
    ...accounts[idx],
    session: {
      ...accounts[idx].session,
      data: { ...accounts[idx].session.data, ...data },
    },
  };
  saveAccounts(accounts);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/accounts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/accounts.ts src/lib/accounts.test.ts
git commit -m "feat(accounts): updateSessionData for token rotation"
```

---

## Task 4: Add `@atproto/api` dependency

All Bluesky files import types/classes from `@atproto/api`. Install it before writing them.

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the package**

Run: `npm install @atproto/api`
Expected: adds `@atproto/api` to `dependencies`.

- [ ] **Step 2: Verify it resolves and the project still builds**

Run: `npm ls @atproto/api` (prints a version, no "missing") then `npx tsc --noEmit`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @atproto/api dependency"
```

---

## Task 5: Bluesky mappers + id encoding

Pure native→neutral mapping. Type-only imports from `@atproto/api` (erased at compile), so no module mock.

**Files:**
- Create: `src/lib/api/backends/bluesky/mappers.ts`
- Test: `src/lib/api/backends/bluesky/mappers.test.ts`

**Interfaces:**
- Consumes: neutral `Post`, `Comment`, `User`, `Source` from `../../types`.
- Produces:
  - `encodeBlueskyId(uri: string, cid: string): string`
  - `parseBlueskyId(id: string): { uri: string; cid: string }`
  - `mapUser(profile: any): User`
  - `mapPost(post: any): Post` (accepts an AT `PostView`)
  - `placeholderSource(author: User): Source`
  - `rkeyOf(uri: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/mappers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encodeBlueskyId, parseBlueskyId, mapUser, mapPost, rkeyOf } from './mappers';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/mappers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mappers**

Create `src/lib/api/backends/bluesky/mappers.ts`:

```ts
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
```

- [ ] **Step 4: Run tests until they pass**

Run: `npm test -- src/lib/api/backends/bluesky/mappers.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/bluesky/mappers.ts src/lib/api/backends/bluesky/mappers.test.ts
git commit -m "feat(bluesky): native↔neutral mappers and id encoding"
```

---

## Task 6: Bluesky session module

Session data type, single "Home" stak, feed-option derivation, and `resolveFeeds` (the only network helper here — tested with a fake agent).

**Files:**
- Create: `src/lib/api/backends/bluesky/session.ts`
- Test: `src/lib/api/backends/bluesky/session.test.ts`

**Interfaces:**
- Consumes: neutral `Session`, `Stak` from `../../types`.
- Produces:
  - `interface BlueskyFeed { id: string; label: string }`
  - `interface BlueskySessionData { service: string; did: string; handle: string; accessJwt: string; refreshJwt: string; feeds: BlueskyFeed[] }`
  - `getBlueskySessionData(session: Session): BlueskySessionData`
  - `listBlueskyStaks(session: Session): Stak[]` → single `{ sessionId, id: 'home', label: 'Home' }`
  - `feedOptionsFromSession(session: Session): { id: string; label: string }[]`
  - `resolveFeeds(agent: any): Promise<BlueskyFeed[]>`
  - `DISCOVER_FEED_URI: string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { listBlueskyStaks, feedOptionsFromSession, resolveFeeds, DISCOVER_FEED_URI } from './session';
import type { Session } from '../../types';

function sessionWith(feeds: { id: string; label: string }[]): Session {
  return {
    id: 'bluesky:alice.bsky.social',
    backendId: 'bluesky',
    viewer: { id: 'did:plc:alice', handle: 'alice.bsky.social', profileUrl: 'https://bsky.app/profile/alice.bsky.social' },
    data: { service: 'https://bsky.social', did: 'did:plc:alice', handle: 'alice.bsky.social', accessJwt: 'a', refreshJwt: 'r', feeds } as any,
  };
}

describe('listBlueskyStaks', () => {
  it('returns a single Home stak', () => {
    expect(listBlueskyStaks(sessionWith([]))).toEqual([
      { sessionId: 'bluesky:alice.bsky.social', id: 'home', label: 'Home' },
    ]);
  });
});

describe('feedOptionsFromSession', () => {
  it('maps stored feeds to feed options', () => {
    const opts = feedOptionsFromSession(sessionWith([
      { id: 'following', label: 'Following' },
      { id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' },
    ]));
    expect(opts).toEqual([
      { id: 'following', label: 'Following' },
      { id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' },
    ]);
  });

  it('falls back to Following when no feeds are stored', () => {
    expect(feedOptionsFromSession(sessionWith([]))).toEqual([{ id: 'following', label: 'Following' }]);
  });
});

describe('resolveFeeds', () => {
  it('prepends Following and resolves pinned feed names', async () => {
    const agent = {
      app: { bsky: {
        actor: { getPreferences: async () => ({ data: { preferences: [
          { $type: 'app.bsky.actor.defs#savedFeedsPrefV2', items: [
            { type: 'timeline', value: 'following', pinned: true },
            { type: 'feed', value: 'at://x/app.bsky.feed.generator/sci', pinned: true },
            { type: 'feed', value: 'at://x/app.bsky.feed.generator/unpinned', pinned: false },
          ] },
        ] } }) },
        feed: { getFeedGenerators: async ({ feeds }: { feeds: string[] }) => ({ data: { feeds:
          feeds.map((uri) => ({ uri, displayName: 'Science' })) } }) },
      } },
    };
    const feeds = await resolveFeeds(agent);
    expect(feeds[0]).toEqual({ id: 'following', label: 'Following' });
    expect(feeds).toContainEqual({ id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' });
    expect(feeds.map((f) => f.id)).not.toContain('at://x/app.bsky.feed.generator/unpinned');
  });

  it('returns Following + Discover when preferences fail', async () => {
    const agent = { app: { bsky: { actor: { getPreferences: async () => { throw new Error('nope'); } } } } };
    const feeds = await resolveFeeds(agent);
    expect(feeds).toEqual([
      { id: 'following', label: 'Following' },
      { id: DISCOVER_FEED_URI, label: 'Discover' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the session module**

Create `src/lib/api/backends/bluesky/session.ts`:

```ts
// src/lib/api/backends/bluesky/session.ts
import type { Session, Stak } from '../../types';
import { rkeyOf } from './mappers';

export const DISCOVER_FEED_URI =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';

export interface BlueskyFeed {
  id: string;    // 'following' | feed at-uri
  label: string;
}

export interface BlueskySessionData {
  service: string;
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  feeds: BlueskyFeed[];
}

export function getBlueskySessionData(session: Session): BlueskySessionData {
  return session.data as unknown as BlueskySessionData;
}

export function listBlueskyStaks(session: Session): Stak[] {
  return [{ sessionId: session.id, id: 'home', label: 'Home' }];
}

export function feedOptionsFromSession(session: Session): { id: string; label: string }[] {
  const feeds = getBlueskySessionData(session)?.feeds;
  if (feeds && feeds.length) return feeds.map((f) => ({ id: f.id, label: f.label }));
  return [{ id: 'following', label: 'Following' }];
}

export async function resolveFeeds(agent: any): Promise<BlueskyFeed[]> {
  const feeds: BlueskyFeed[] = [{ id: 'following', label: 'Following' }];
  try {
    const prefs = await agent.app.bsky.actor.getPreferences();
    const saved = (prefs.data.preferences as any[]).find(
      (p) => p.$type === 'app.bsky.actor.defs#savedFeedsPrefV2');
    const pinnedUris: string[] = (saved?.items ?? [])
      .filter((it: any) => it.pinned && it.type === 'feed')
      .map((it: any) => it.value as string);
    if (pinnedUris.length) {
      const gens = await agent.app.bsky.feed.getFeedGenerators({ feeds: pinnedUris });
      const nameByUri = new Map<string, string>(
        (gens.data.feeds as any[]).map((g) => [g.uri, g.displayName as string]));
      for (const uri of pinnedUris) {
        feeds.push({ id: uri, label: nameByUri.get(uri) ?? rkeyOf(uri) });
      }
    }
  } catch {
    feeds.push({ id: DISCOVER_FEED_URI, label: 'Discover' });
    return feeds;
  }
  if (!feeds.some((f) => f.id.includes('/app.bsky.feed.generator/'))) {
    feeds.push({ id: DISCOVER_FEED_URI, label: 'Discover' });
  }
  return feeds;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/bluesky/session.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/bluesky/session.ts src/lib/api/backends/bluesky/session.test.ts
git commit -m "feat(bluesky): session data, home stak, feed resolution"
```

---

## Task 7: Bluesky capabilities

Per-session capabilities with dynamic `feedOptions` from `session.data.feeds`.

**Files:**
- Create: `src/lib/api/backends/bluesky/capabilities.ts`
- Test: `src/lib/api/backends/bluesky/capabilities.test.ts`

**Interfaces:**
- Consumes: `Capabilities` (incl. `hasSources` from Task 1), `feedOptionsFromSession` (Task 6).
- Produces: `buildBlueskyCapabilities(session: Session): Capabilities`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildBlueskyCapabilities } from './capabilities';
import type { Session } from '../../types';

const ANON: Session = { id: 'anon:bluesky', backendId: 'bluesky', viewer: null, data: {} as any };

function loggedIn(feeds: { id: string; label: string }[]): Session {
  return { id: 'bluesky:alice.bsky.social', backendId: 'bluesky', viewer: null,
    data: { feeds } as any };
}

describe('bluesky capabilities', () => {
  it('declares display name, icon, and no sources / no downvote', () => {
    const caps = buildBlueskyCapabilities(ANON);
    expect(caps.displayName).toBe('Bluesky');
    expect(caps.icon).toBe('🦋');
    expect(caps.hasSources).toBe(false);
    expect(caps.canDownvote).toBe(false);
    expect(caps.hasSavedPosts).toBe(false);
    expect(caps.commentSortOptions).toEqual([]);
  });

  it('declares the login fields the add-account form needs', () => {
    const keys = buildBlueskyCapabilities(ANON).loginFields.map((f) => f.key);
    expect(keys).toEqual(['identifier', 'appPassword']);
    const pw = buildBlueskyCapabilities(ANON).loginFields.find((f) => f.key === 'appPassword')!;
    expect(pw.type).toBe('password');
  });

  it('derives feedOptions from the session feeds', () => {
    const caps = buildBlueskyCapabilities(loggedIn([
      { id: 'following', label: 'Following' },
      { id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' },
    ]));
    expect(caps.feedOptions).toEqual([
      { id: 'following', label: 'Following' },
      { id: 'at://x/app.bsky.feed.generator/sci', label: 'Science' },
    ]);
  });

  it('falls back to a single Following option before login', () => {
    expect(buildBlueskyCapabilities(ANON).feedOptions).toEqual([{ id: 'following', label: 'Following' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/capabilities.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the capabilities builder**

Create `src/lib/api/backends/bluesky/capabilities.ts`:

```ts
// src/lib/api/backends/bluesky/capabilities.ts
import type { Capabilities } from '../../capabilities';
import type { Session } from '../../types';
import { feedOptionsFromSession } from './session';

export function buildBlueskyCapabilities(session: Session): Capabilities {
  return {
    canDownvote: false,
    canBrowseAnonymously: false,
    hasNsfwFlag: false,
    hasSavedPosts: false,
    hasSources: false,
    feedOptions: feedOptionsFromSession(session),
    commentSortOptions: [],
    sourceNoun: '',
    displayName: 'Bluesky',
    icon: '🦋',
    loginFields: [
      { key: 'identifier', label: 'Handle or email', type: 'text', required: true,
        placeholder: 'you.bsky.social', autoCapitalize: false },
      { key: 'appPassword', label: 'App password', type: 'password', required: true,
        placeholder: 'xxxx-xxxx-xxxx-xxxx' },
    ],
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/bluesky/capabilities.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/bluesky/capabilities.ts src/lib/api/backends/bluesky/capabilities.test.ts
git commit -m "feat(bluesky): per-session capabilities with dynamic feedOptions"
```

---

## Task 8: Agent build / resume / login

Wraps `@atproto/api` session management. This is the one module whose test mocks `@atproto/api`.

**Files:**
- Create: `src/lib/api/backends/bluesky/agent.ts`
- Test: `src/lib/api/backends/bluesky/agent.test.ts`

**Interfaces:**
- Consumes: `BlueskySessionData` (Task 6), `Session` from `../../types`.
- Produces:
  - `buildAgent(session: Session, persist?: (data: Partial<BlueskySessionData>) => void): any` — resumes when tokens present, else an unauthenticated agent.
  - `loginWithAppPassword(service: string, identifier: string, appPassword: string): Promise<{ agent: any; data: { service: string; did: string; handle: string; accessJwt: string; refreshJwt: string } }>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/agent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const resumeSession = vi.fn();
const login = vi.fn();

vi.mock('@atproto/api', () => {
  class CredentialSession {
    did?: string; handle?: string;
    constructor(public service: URL, public _fetch?: unknown, public persist?: any) {}
    resumeSession = resumeSession;
    login = login;
  }
  class Agent { constructor(public session: unknown) {} }
  return { CredentialSession, Agent };
});

import { buildAgent, loginWithAppPassword } from './agent';
import type { Session } from '../../types';

beforeEach(() => { resumeSession.mockReset(); login.mockReset(); });

const session = (data: any): Session => ({ id: 'bluesky:a', backendId: 'bluesky', viewer: null, data });

describe('buildAgent', () => {
  it('resumes a stored session when tokens are present', () => {
    buildAgent(session({ service: 'https://bsky.social', did: 'did:plc:a', handle: 'a.bsky.social', accessJwt: 'acc', refreshJwt: 'ref', feeds: [] }));
    expect(resumeSession).toHaveBeenCalledWith(expect.objectContaining({
      did: 'did:plc:a', handle: 'a.bsky.social', accessJwt: 'acc', refreshJwt: 'ref', active: true,
    }));
  });

  it('does not resume when there is no token', () => {
    buildAgent(session({}));
    expect(resumeSession).not.toHaveBeenCalled();
  });
});

describe('loginWithAppPassword', () => {
  it('logs in and returns session data', async () => {
    login.mockImplementation(function (this: any) {
      this.did = 'did:plc:a'; this.handle = 'a.bsky.social';
      this.accessJwt = 'acc'; this.refreshJwt = 'ref';
      return Promise.resolve();
    });
    const { data } = await loginWithAppPassword('https://bsky.social', 'a.bsky.social', 'pw');
    expect(login).toHaveBeenCalledWith({ identifier: 'a.bsky.social', password: 'pw' });
    expect(data).toMatchObject({ did: 'did:plc:a', handle: 'a.bsky.social', accessJwt: 'acc', refreshJwt: 'ref', service: 'https://bsky.social' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/agent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the agent module**

Create `src/lib/api/backends/bluesky/agent.ts`:

```ts
// src/lib/api/backends/bluesky/agent.ts
import { Agent, CredentialSession } from '@atproto/api';
import type { Session } from '../../types';
import { getBlueskySessionData, type BlueskySessionData } from './session';

export function buildAgent(
  session: Session,
  persist?: (data: Partial<BlueskySessionData>) => void,
): Agent {
  const data = getBlueskySessionData(session);
  const service = data?.service || 'https://bsky.social';
  const credSession = new CredentialSession(
    new URL(service),
    undefined,
    persist
      ? (_evt: string, s?: any) => {
          if (s) persist({ accessJwt: s.accessJwt, refreshJwt: s.refreshJwt, handle: s.handle, did: s.did });
        }
      : undefined,
  );
  if (data?.accessJwt && data?.did) {
    credSession.resumeSession({
      did: data.did,
      handle: data.handle,
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt,
      active: true,
    } as any);
  }
  return new Agent(credSession);
}

export async function loginWithAppPassword(
  service: string,
  identifier: string,
  appPassword: string,
): Promise<{ agent: Agent; data: Omit<BlueskySessionData, 'feeds'> }> {
  const credSession = new CredentialSession(new URL(service));
  await credSession.login({ identifier, password: appPassword });
  const s = credSession as any;
  return {
    agent: new Agent(credSession),
    data: {
      service,
      did: s.did,
      handle: s.handle,
      accessJwt: s.accessJwt,
      refreshJwt: s.refreshJwt,
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/bluesky/agent.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/bluesky/agent.ts src/lib/api/backends/bluesky/agent.test.ts
git commit -m "feat(bluesky): agent build/resume/login helpers"
```

---

## Task 9: FeedService

Routes `following` → `getTimeline`, other feed ids → `getFeed`. Agent is injected.

**Files:**
- Create: `src/lib/api/backends/bluesky/feed.ts`
- Test: `src/lib/api/backends/bluesky/feed.test.ts`

**Interfaces:**
- Consumes: `FeedService` from `../../backend`, `mapPost` (Task 5).
- Produces: `createFeedService(getAgent: () => any): FeedService`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/feed.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createFeedService } from './feed';

function fakePost(uri: string) {
  return { uri, cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 't', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, replyCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} };
}

describe('bluesky FeedService', () => {
  it('routes the following feed to getTimeline', async () => {
    const getTimeline = vi.fn().mockResolvedValue({ data: { feed: [{ post: fakePost('at://x/app.bsky.feed.post/1') }], cursor: 'next' } });
    const agent = { getTimeline, app: { bsky: { feed: { getFeed: vi.fn() } } } };
    const svc = createFeedService(() => agent);
    const page = await svc.getTimeline({ feedId: 'following', stakId: 'home', cursor: null });
    expect(getTimeline).toHaveBeenCalledWith({ cursor: undefined, limit: 30 });
    expect(page.items[0].id).toBe('at://x/app.bsky.feed.post/1|c');
    expect(page.nextCursor).toBe('next');
  });

  it('routes a feed uri to getFeed and passes the cursor', async () => {
    const getFeed = vi.fn().mockResolvedValue({ data: { feed: [{ post: fakePost('at://x/app.bsky.feed.post/2') }], cursor: undefined } });
    const agent = { getTimeline: vi.fn(), app: { bsky: { feed: { getFeed } } } };
    const svc = createFeedService(() => agent);
    const page = await svc.getTimeline({ feedId: 'at://x/app.bsky.feed.generator/sci', stakId: 'home', cursor: 'cur' });
    expect(getFeed).toHaveBeenCalledWith({ feed: 'at://x/app.bsky.feed.generator/sci', cursor: 'cur', limit: 30 });
    expect(page.nextCursor).toBeNull();
  });

  it('getSavedPosts returns an empty page', async () => {
    const svc = createFeedService(() => ({}));
    expect(await svc.getSavedPosts({ cursor: null })).toEqual({ items: [], nextCursor: null });
  });

  it('getSourceFeed throws (no communities)', async () => {
    const svc = createFeedService(() => ({}));
    await expect(svc.getSourceFeed('x', { feedId: 'f', cursor: null })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/feed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the FeedService**

Create `src/lib/api/backends/bluesky/feed.ts`:

```ts
// src/lib/api/backends/bluesky/feed.ts
import type { FeedService } from '../../backend';
import type { Page, Post } from '../../types';
import { mapPost } from './mappers';

const PAGE_SIZE = 30;

export function createFeedService(getAgent: () => any): FeedService {
  return {
    async getTimeline(opts): Promise<Page<Post>> {
      const agent = getAgent();
      const cursor = opts.cursor ?? undefined;
      const res = opts.feedId === 'following'
        ? await agent.getTimeline({ cursor, limit: PAGE_SIZE })
        : await agent.app.bsky.feed.getFeed({ feed: opts.feedId, cursor, limit: PAGE_SIZE });
      const items = (res.data.feed as any[]).map((fv) => mapPost(fv.post));
      return { items, nextCursor: res.data.cursor ?? null };
    },

    async getSourceFeed(): Promise<Page<Post>> {
      throw new Error('Bluesky has no community feeds');
    },

    async getSavedPosts(): Promise<Page<Post>> {
      return { items: [], nextCursor: null };
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/bluesky/feed.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/bluesky/feed.ts src/lib/api/backends/bluesky/feed.test.ts
git commit -m "feat(bluesky): FeedService with following/getFeed routing"
```

---

## Task 10: PostService

`get`, `getByPermalink`, `vote` (like / unlike). Other methods stubbed.

**Files:**
- Create: `src/lib/api/backends/bluesky/posts.ts`
- Test: `src/lib/api/backends/bluesky/posts.test.ts`

**Interfaces:**
- Consumes: `PostService` from `../../backend`, `mapPost`, `parseBlueskyId`, `rkeyOf` (Task 5).
- Produces: `createPostService(getAgent: () => any): PostService`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/posts.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createPostService } from './posts';

function fakePost(uri: string, viewer: any = {}) {
  return { uri, cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 't', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 1, replyCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer };
}

describe('bluesky PostService', () => {
  it('get resolves a post by its encoded id', async () => {
    const getPosts = vi.fn().mockResolvedValue({ data: { posts: [fakePost('at://x/app.bsky.feed.post/1')] } });
    const svc = createPostService(() => ({ getPosts }));
    const post = await svc.get('at://x/app.bsky.feed.post/1|c');
    expect(getPosts).toHaveBeenCalledWith({ uris: ['at://x/app.bsky.feed.post/1'] });
    expect(post.id).toBe('at://x/app.bsky.feed.post/1|c');
  });

  it('vote(1) likes the post', async () => {
    const like = vi.fn().mockResolvedValue({ uri: 'at://like' });
    const svc = createPostService(() => ({ like }));
    await svc.vote('at://x/app.bsky.feed.post/1|cid9', 1);
    expect(like).toHaveBeenCalledWith('at://x/app.bsky.feed.post/1', 'cid9');
  });

  it('vote(0) unlikes when a like record exists', async () => {
    const getPosts = vi.fn().mockResolvedValue({ data: { posts: [fakePost('at://x/app.bsky.feed.post/1', { like: 'at://likeuri' })] } });
    const deleteLike = vi.fn().mockResolvedValue(undefined);
    const svc = createPostService(() => ({ getPosts, deleteLike }));
    await svc.vote('at://x/app.bsky.feed.post/1|c', 0);
    expect(deleteLike).toHaveBeenCalledWith('at://likeuri');
  });

  it('vote(-1) is a no-op when there is no like to remove', async () => {
    const getPosts = vi.fn().mockResolvedValue({ data: { posts: [fakePost('at://x/app.bsky.feed.post/1', {})] } });
    const deleteLike = vi.fn();
    const svc = createPostService(() => ({ getPosts, deleteLike }));
    await svc.vote('at://x/app.bsky.feed.post/1|c', -1);
    expect(deleteLike).not.toHaveBeenCalled();
  });

  it('create/save/report/delete throw', async () => {
    const svc = createPostService(() => ({}));
    await expect(svc.create({ sourceHandle: 'x' })).rejects.toThrow();
    await expect(svc.save('id', true)).rejects.toThrow();
    await expect(svc.report('id', 'r')).rejects.toThrow();
    await expect(svc.delete('id')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/posts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the PostService**

Create `src/lib/api/backends/bluesky/posts.ts`:

```ts
// src/lib/api/backends/bluesky/posts.ts
import type { PostService } from '../../backend';
import type { ID, Post, Vote } from '../../types';
import { mapPost, parseBlueskyId } from './mappers';
import { notSupported } from './stubs';

async function fetchPostView(agent: any, uri: string): Promise<any | null> {
  const res = await agent.getPosts({ uris: [uri] });
  return res.data.posts?.[0] ?? null;
}

export function createPostService(getAgent: () => any): PostService {
  return {
    async get(postId: ID): Promise<Post> {
      const { uri } = parseBlueskyId(postId);
      const view = await fetchPostView(getAgent(), uri);
      if (!view) throw new Error(`Bluesky: post not found: ${uri}`);
      return mapPost(view);
    },

    async getByPermalink(url: string): Promise<Post | null> {
      const m = url.match(/\/profile\/([^/]+)\/post\/([^/?#]+)/);
      if (!m) return null;
      const [, handle, rkey] = m;
      const uri = `at://${handle}/app.bsky.feed.post/${rkey}`;
      try {
        const view = await fetchPostView(getAgent(), uri);
        return view ? mapPost(view) : null;
      } catch {
        return null;
      }
    },

    async vote(postId: ID, vote: Vote): Promise<void> {
      const agent = getAgent();
      const { uri, cid } = parseBlueskyId(postId);
      if (vote > 0) {
        await agent.like(uri, cid);
        return;
      }
      // unlike: resolve the like record uri from the post's viewer state
      const view = await fetchPostView(agent, uri);
      const likeUri = view?.viewer?.like;
      if (likeUri) await agent.deleteLike(likeUri);
    },

    async save() { return notSupported('save posts'); },
    async report() { return notSupported('report posts'); },
    async delete() { return notSupported('delete posts'); },
    async create() { return notSupported('create posts'); },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/bluesky/posts.test.ts`
Expected: PASS (depends on `stubs.ts` from Task 12 — see note). Then `npx tsc --noEmit`.

> If executing strictly in order, create the minimal `stubs.ts` now (it is fully specified in Task 12). The import is `import { notSupported } from './stubs';`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/bluesky/posts.ts src/lib/api/backends/bluesky/posts.test.ts
git commit -m "feat(bluesky): PostService get/vote with like/unlike"
```

---

## Task 11: CommentService

`list` fetches the post thread and flattens replies. Other methods stubbed. Returns `Page<Comment>`.

**Files:**
- Create: `src/lib/api/backends/bluesky/comments.ts`
- Test: `src/lib/api/backends/bluesky/comments.test.ts`

**Interfaces:**
- Consumes: `CommentService` from `../../backend`, `mapThreadPost`, `parseBlueskyId` (Task 5), `notSupported` (Task 12).
- Produces: `createCommentService(getAgent: () => any): CommentService`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/comments.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createCommentService } from './comments';

function node(uri: string, text: string, replies: any[] = []) {
  return {
    post: { uri, cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text, createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} },
    replies,
  };
}

describe('bluesky CommentService', () => {
  it('flattens a reply thread depth-first with parent ids and depth', async () => {
    const thread = node('at://root', 'root', [
      node('at://r1', 'first', [node('at://r1a', 'nested')]),
      node('at://r2', 'second'),
    ]);
    const getPostThread = vi.fn().mockResolvedValue({ data: { thread } });
    const svc = createCommentService(() => ({ getPostThread }));
    const page = await svc.list('at://root|c', { sortId: 'top' });
    expect(getPostThread).toHaveBeenCalledWith({ uri: 'at://root', depth: 6 });
    expect(page.items.map((c) => [c.body, c.depth, c.parentId])).toEqual([
      ['first', 0, null],
      ['nested', 1, 'at://r1|c'],
      ['second', 0, null],
    ]);
    expect(page.items.every((c) => c.postId === 'at://root|c')).toBe(true);
    expect(page.nextCursor).toBeNull();
  });

  it('returns an empty page for a blocked/not-found thread', async () => {
    const getPostThread = vi.fn().mockResolvedValue({ data: { thread: { $type: 'app.bsky.feed.defs#notFoundPost' } } });
    const svc = createCommentService(() => ({ getPostThread }));
    expect((await svc.list('at://x|c', { sortId: 'top' })).items).toEqual([]);
  });

  it('create/vote/edit/delete/report throw', async () => {
    const svc = createCommentService(() => ({}));
    await expect(svc.create({ postId: 'p', body: 'b' })).rejects.toThrow();
    await expect(svc.vote('c', 1)).rejects.toThrow();
    await expect(svc.edit('c', 'b')).rejects.toThrow();
    await expect(svc.delete('c')).rejects.toThrow();
    await expect(svc.report('c', 'r')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/comments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the CommentService**

Create `src/lib/api/backends/bluesky/comments.ts`:

```ts
// src/lib/api/backends/bluesky/comments.ts
import type { CommentService } from '../../backend';
import type { Comment, Page } from '../../types';
import { mapThreadPost, parseBlueskyId } from './mappers';
import { notSupported } from './stubs';

const THREAD_DEPTH = 6;

function flatten(replies: any[], parentId: string | null, depth: number, rootPostId: string, out: Comment[]): void {
  for (const node of replies ?? []) {
    if (!node?.post?.uri) continue; // skip blocked / not-found nodes
    const comment = mapThreadPost(node.post, parentId, depth, rootPostId);
    out.push(comment);
    if (Array.isArray(node.replies) && node.replies.length) {
      flatten(node.replies, comment.id, depth + 1, rootPostId, out);
    }
  }
}

export function createCommentService(getAgent: () => any): CommentService {
  return {
    async list(postId, _opts): Promise<Page<Comment>> {
      const { uri } = parseBlueskyId(postId);
      const res = await getAgent().getPostThread({ uri, depth: THREAD_DEPTH });
      const thread = res.data.thread;
      const out: Comment[] = [];
      if (thread?.post?.uri) flatten(thread.replies ?? [], null, 0, postId, out);
      return { items: out, nextCursor: null };
    },

    async vote() { return notSupported('vote on comments'); },
    async create() { return notSupported('reply to posts'); },
    async edit() { return notSupported('edit comments'); },
    async delete() { return notSupported('delete comments'); },
    async report() { return notSupported('report comments'); },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/bluesky/comments.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/bluesky/comments.ts src/lib/api/backends/bluesky/comments.test.ts
git commit -m "feat(bluesky): CommentService thread flattening"
```

---

## Task 12: Shared stubs + UserService

`stubs.ts` provides the not-supported helpers and whole-service stubs; `users.ts` implements `get`/`getPosts`.

**Files:**
- Create: `src/lib/api/backends/bluesky/stubs.ts`
- Create: `src/lib/api/backends/bluesky/users.ts`
- Test: `src/lib/api/backends/bluesky/users.test.ts`

**Interfaces:**
- Produces:
  - `notSupported(action: string): never`
  - `createStubSourceService(): SourceService`
  - `createStubNotificationService(): NotificationService` (`unreadCount → 0`, `list → empty page`, `markRead → no-op`)
  - `createStubSearchService(): SearchService` (`posts`/`sources → empty page`)
  - `createStubMediaService(): MediaService` (`uploadImage` throws)
  - `createUserService(getAgent: () => any): UserService`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/users.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createUserService } from './users';

describe('bluesky UserService', () => {
  it('get maps a profile', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: { did: 'did:plc:a', handle: 'a.bsky.social', displayName: 'A', description: 'bio' } });
    const svc = createUserService(() => ({ getProfile }));
    const user = await svc.get('a.bsky.social');
    expect(getProfile).toHaveBeenCalledWith({ actor: 'a.bsky.social' });
    expect(user.handle).toBe('a.bsky.social');
    expect(user.bio).toBe('bio');
  });

  it('getPosts maps the author feed and passes the cursor', async () => {
    const getAuthorFeed = vi.fn().mockResolvedValue({ data: { feed: [{ post: { uri: 'at://x/app.bsky.feed.post/1', cid: 'c', author: { did: 'd', handle: 'a.bsky.social' }, record: { text: 't', createdAt: '2026-01-01T00:00:00Z' }, likeCount: 0, replyCount: 0, indexedAt: '2026-01-01T00:00:00Z', viewer: {} } }], cursor: 'nc' } });
    const svc = createUserService(() => ({ getAuthorFeed }));
    const page = await svc.getPosts('a.bsky.social', { cursor: 'cur' });
    expect(getAuthorFeed).toHaveBeenCalledWith({ actor: 'a.bsky.social', cursor: 'cur', limit: 30 });
    expect(page.items[0].id).toBe('at://x/app.bsky.feed.post/1|c');
    expect(page.nextCursor).toBe('nc');
  });

  it('getComments returns an empty page and block is a no-op', async () => {
    const svc = createUserService(() => ({}));
    expect((await svc.getComments('a.bsky.social', { cursor: null })).items).toEqual([]);
    await expect(svc.block('id', true)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/users.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement stubs**

Create `src/lib/api/backends/bluesky/stubs.ts`:

```ts
// src/lib/api/backends/bluesky/stubs.ts
import type { SourceService, NotificationService, SearchService, MediaService } from '../../backend';

export function notSupported(action: string): never {
  throw new Error(`Not supported on Bluesky yet: ${action}`);
}

export function createStubSourceService(): SourceService {
  return {
    async get() { return notSupported('communities'); },
    async subscribe() { /* no-op */ },
    async block() { /* no-op */ },
  };
}

export function createStubNotificationService(): NotificationService {
  return {
    async unreadCount() { return 0; },
    async list() { return { items: [], nextCursor: null }; },
    async markRead() { /* no-op */ },
  };
}

export function createStubSearchService(): SearchService {
  return {
    async posts() { return { items: [], nextCursor: null }; },
    async sources() { return { items: [], nextCursor: null }; },
  };
}

export function createStubMediaService(): MediaService {
  return {
    async uploadImage() { return notSupported('image upload'); },
  };
}
```

- [ ] **Step 4: Implement the UserService**

Create `src/lib/api/backends/bluesky/users.ts`:

```ts
// src/lib/api/backends/bluesky/users.ts
import type { UserService } from '../../backend';
import type { Comment, Page, Post, User } from '../../types';
import { mapPost, mapUser } from './mappers';

const PAGE_SIZE = 30;

export function createUserService(getAgent: () => any): UserService {
  return {
    async get(handle: string): Promise<User> {
      const res = await getAgent().getProfile({ actor: handle });
      return mapUser(res.data);
    },

    async getPosts(handle, opts): Promise<Page<Post>> {
      const res = await getAgent().getAuthorFeed({ actor: handle, cursor: opts.cursor ?? undefined, limit: PAGE_SIZE });
      const items = (res.data.feed as any[]).map((fv) => mapPost(fv.post));
      return { items, nextCursor: res.data.cursor ?? null };
    },

    async getComments(): Promise<Page<Comment>> {
      return { items: [], nextCursor: null };
    },

    async block() { /* no-op */ },
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/lib/api/backends/bluesky/users.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/backends/bluesky/stubs.ts src/lib/api/backends/bluesky/users.ts src/lib/api/backends/bluesky/users.test.ts
git commit -m "feat(bluesky): UserService + shared service stubs"
```

---

## Task 13: Backend assembly + auth

Wire all services and auth into `createBlueskyBackend`. The test mocks `@atproto/api` to drive the login path end-to-end.

**Files:**
- Create: `src/lib/api/backends/bluesky/index.ts`
- Test: `src/lib/api/backends/bluesky/index.test.ts`

**Interfaces:**
- Consumes: every `create*Service` above, `buildAgent`/`loginWithAppPassword` (Task 8), `resolveFeeds`/`listBlueskyStaks`/`getBlueskySessionData` (Task 6), `buildBlueskyCapabilities` (Task 7), `mapUser` (Task 5).
- Produces:
  - `interface BlueskyBackendOptions { persistSession?: (data: Partial<BlueskySessionData>) => void }`
  - `createBlueskyBackend(session: Session, opts?: BlueskyBackendOptions): Backend`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/bluesky/index.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const login = vi.fn();
const resumeSession = vi.fn();

vi.mock('@atproto/api', () => {
  class CredentialSession {
    did?: string; handle?: string; accessJwt?: string; refreshJwt?: string;
    constructor(public service: URL, public _f?: unknown, public persist?: any) {}
    resumeSession = resumeSession;
    login = login;
  }
  class Agent {
    constructor(public session: any) {}
    getProfile = vi.fn().mockResolvedValue({ data: { did: 'did:plc:a', handle: 'alice.bsky.social', displayName: 'Alice' } });
    app = { bsky: {
      actor: { getPreferences: vi.fn().mockResolvedValue({ data: { preferences: [] } }) },
      feed: { getFeedGenerators: vi.fn() },
    } };
  }
  return { CredentialSession, Agent };
});

import { createBlueskyBackend } from './index';
import type { Session } from '../../types';

const anon: Session = { id: 'anon:bluesky', backendId: 'bluesky', viewer: null, data: {} as any };

beforeEach(() => {
  login.mockReset(); resumeSession.mockReset();
  login.mockImplementation(function (this: any) {
    this.did = 'did:plc:a'; this.handle = 'alice.bsky.social';
    this.accessJwt = 'acc'; this.refreshJwt = 'ref';
    return Promise.resolve();
  });
});

describe('createBlueskyBackend', () => {
  it('exposes capabilities, a single Home stak, and the expected backendId', () => {
    const backend = createBlueskyBackend(anon);
    expect(backend.backendId).toBe('bluesky');
    expect(backend.capabilities.displayName).toBe('Bluesky');
    expect(backend.listStaks()).toEqual([{ sessionId: 'anon:bluesky', id: 'home', label: 'Home' }]);
  });

  it('logs in, maps the viewer, resolves feeds, and returns a stable session id', async () => {
    const backend = createBlueskyBackend(anon);
    const session = await backend.auth.login({ identifier: 'alice.bsky.social', appPassword: 'pw' });
    expect(login).toHaveBeenCalledWith({ identifier: 'alice.bsky.social', password: 'pw' });
    expect(session.id).toBe('bluesky:alice.bsky.social');
    expect(session.viewer?.handle).toBe('alice.bsky.social');
    const data = session.data as any;
    expect(data.accessJwt).toBe('acc');
    expect(data.feeds[0]).toEqual({ id: 'following', label: 'Following' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/bluesky/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the backend assembly**

Create `src/lib/api/backends/bluesky/index.ts`:

```ts
// src/lib/api/backends/bluesky/index.ts
import type { Backend, AuthService } from '../../backend';
import type { Session, Stak } from '../../types';
import { buildBlueskyCapabilities } from './capabilities';
import { buildAgent, loginWithAppPassword } from './agent';
import { listBlueskyStaks, resolveFeeds, type BlueskySessionData } from './session';
import { mapUser } from './mappers';
import { createFeedService } from './feed';
import { createPostService } from './posts';
import { createCommentService } from './comments';
import { createUserService } from './users';
import {
  createStubSourceService, createStubNotificationService,
  createStubSearchService, createStubMediaService,
} from './stubs';

const SERVICE = 'https://bsky.social';

export interface BlueskyBackendOptions {
  persistSession?: (data: Partial<BlueskySessionData>) => void;
}

function createAuthService(session: Session): AuthService {
  return {
    async login(credentials): Promise<Session> {
      const { identifier, appPassword } = credentials as { identifier: string; appPassword: string };
      const { agent, data } = await loginWithAppPassword(SERVICE, identifier, appPassword);
      const profile = await agent.getProfile({ actor: data.did });
      const viewer = mapUser(profile.data);
      const feeds = await resolveFeeds(agent);
      const sessionData: BlueskySessionData = { ...data, feeds };
      return {
        ...session,
        id: `bluesky:${data.handle.toLowerCase()}`,
        backendId: 'bluesky',
        viewer,
        data: sessionData as unknown as Session['data'],
      };
    },
    async logout(): Promise<void> {},
  };
}

export function createBlueskyBackend(session: Session, opts: BlueskyBackendOptions = {}): Backend {
  const agent = buildAgent(session, opts.persistSession);
  const getAgent = () => agent;
  return {
    backendId: 'bluesky',
    capabilities: buildBlueskyCapabilities(session),
    session,
    listStaks(): Stak[] { return listBlueskyStaks(session); },
    auth: createAuthService(session),
    feed: createFeedService(getAgent),
    posts: createPostService(getAgent),
    comments: createCommentService(getAgent),
    sources: createStubSourceService(),
    users: createUserService(getAgent),
    notifications: createStubNotificationService(),
    search: createStubSearchService(),
    media: createStubMediaService(),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/bluesky/index.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/bluesky/index.ts src/lib/api/backends/bluesky/index.test.ts
git commit -m "feat(bluesky): assemble backend with auth and services"
```

---

## Task 14: Register the Bluesky backend

Add `bluesky` to `registerBackends()` and wire token persistence.

**Files:**
- Modify: `src/lib/api/backends/index.ts`
- Test: `src/lib/api/backends/index.test.ts`

**Interfaces:**
- Consumes: `createBlueskyBackend` (Task 13), `updateSessionData` (Task 3).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/api/backends/index.test.ts` inside the existing `describe('registerBackends', ...)`:

```ts
  it('registers the bluesky backend', () => {
    registerBackends();
    expect(hasBackend('bluesky')).toBe(true);
    expect(listBackendIds()).toContain('bluesky');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/index.test.ts`
Expected: FAIL — `hasBackend('bluesky')` is false.

- [ ] **Step 3: Register the backend**

In `src/lib/api/backends/index.ts`, add the import and registration:

```ts
import { createBlueskyBackend } from './bluesky';
import { updateSessionData } from '../../accounts';
```

Inside `registerBackends()`, after the lemmy block:

```ts
  if (!hasBackend('bluesky')) {
    registerBackend('bluesky', (session) =>
      createBlueskyBackend(session, {
        persistSession: (data) => updateSessionData(session.id, data as Record<string, unknown>),
      }),
    );
  }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/index.test.ts`
Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/index.ts src/lib/api/backends/index.test.ts
git commit -m "feat(bluesky): register backend with token persistence"
```

---

## Task 15: FeedStack — dynamic feed options + feed fallback

Replace the hardcoded `SORT_OPTIONS` pill row with the backend's `feedOptions`, and pick a valid initial/active feed when the stored default isn't valid for the active backend (e.g. switching to Bluesky).

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Test: `src/components/FeedStack.test.tsx`

**Interfaces:**
- Produces: `pickFeedId(feedOptions: { id: string }[], desired: string, isCommunity: boolean): string` (exported from `FeedStack.tsx`).

- [ ] **Step 1: Write the failing test**

Add to `src/components/FeedStack.test.tsx` (import `pickFeedId` from `./FeedStack`):

```ts
import { pickFeedId } from './FeedStack';

describe('pickFeedId', () => {
  const opts = [{ id: 'following' }, { id: 'at://x/app.bsky.feed.generator/sci' }];

  it('keeps the desired feed when it is a valid option', () => {
    expect(pickFeedId(opts, 'following', false)).toBe('following');
  });

  it('falls back to the first option when the desired feed is invalid', () => {
    expect(pickFeedId(opts, 'Active', false)).toBe('following');
  });

  it('returns Active for community feeds regardless of options', () => {
    expect(pickFeedId(opts, 'following', true)).toBe('Active');
  });

  it('returns the desired value when there are no options', () => {
    expect(pickFeedId([], 'Active', false)).toBe('Active');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/FeedStack.test.tsx`
Expected: FAIL — `pickFeedId` not exported.

- [ ] **Step 3: Add `pickFeedId` and use it**

In `src/components/FeedStack.tsx`:

(a) Remove the `SORT_OPTIONS` import (the `import { SORT_OPTIONS } from './HeaderBar';` line).

(b) Add this exported helper above the `FeedStack` component:

```ts
export function pickFeedId(feedOptions: { id: string }[], desired: string, isCommunity: boolean): string {
  if (isCommunity) return 'Active';
  const ids = feedOptions.map((o) => o.id);
  return ids.includes(desired) ? desired : (ids[0] ?? desired);
}
```

(c) Change the initial `sortType` state (line ~46) to:

```ts
  const [sortType, setSortType] = useState<string>(
    pickFeedId(backend.capabilities.feedOptions, community ? 'Active' : settings.defaultFeedId, !!community),
  );
```

(d) In the home reset effect (the `useEffect(... [backend, stak])` at line ~107-114), compute the effective feed so a backend switch lands on a valid feed:

```ts
  useEffect(() => {
    if (community) return; // community feed loads via its own effect below
    const effective = pickFeedId(backend.capabilities.feedOptions, sortType, false);
    if (effective !== sortType) setSortType(effective);
    setPosts([]);
    setCursor(null);
    setCanLoadMore(true);
    loadMore(effective, stak, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, stak]);
```

(e) Replace the `SORT_OPTIONS.map(...)` pill row in the "you've seen everything" screen (lines ~270-276) with `backend.capabilities.feedOptions`:

```tsx
            <div style={sectionLabel}>Switch sort</div>
            <div style={pillRow}>
              {backend.capabilities.feedOptions.map(({ id, label }) => (
                <button key={id} onClick={() => handleSortChange(id)} style={id === sortType ? pillActive : pillInactive}>
                  {label}
                </button>
              ))}
            </div>
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/FeedStack.test.tsx`
Expected: PASS. Then `npm test` (full suite) — PASS. Then `npx tsc --noEmit` — PASS.

> If any existing FeedStack test referenced `SORT_OPTIONS`, update it to read from `backend.capabilities.feedOptions`. Search the test file for `SORT_OPTIONS`.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat(feed): drive sort pills from capabilities + feed fallback"
```

---

## Task 16: Full verification

Confirm the whole suite and a production build pass with Bluesky registered.

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all files green, including every new `bluesky/*.test.ts`.

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: PASS (tsc + vite build), no type errors, no unresolved imports.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run: `npm run dev`, open the app, use the account selector → **Add account** → **Bluesky**, log in with a real handle + app password, confirm the feed loads, the sort dropdown lists your feeds (Following / Discover / pinned), swipe-right likes a post, and opening a card shows the reply thread. Note: the community chip should be absent on Bluesky cards.

- [ ] **Step 4: Commit (if the smoke test surfaced any doc-worthy notes)**

No code commit expected here. If you adjusted anything, commit with a descriptive message.

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** auth/app-password (Tasks 8, 13), token rotation (Tasks 3, 14), feeds→sort-dropdown (Tasks 6, 7, 15), feed routing (Task 9), like/unlike (Task 10), comments via thread (Task 11), profile (Task 12), no-communities card (Tasks 1, 2), capabilities (Task 7), stubs (Task 12), registration (Task 14). All spec sections map to a task.
- **`stubs.ts` ordering:** `posts.ts` (Task 10) and `comments.ts` (Task 11) import `notSupported` from `stubs.ts`, which is formally created in Task 12. When executing strictly in order, create `stubs.ts` during Task 10 (it is fully specified in Task 12, Step 3). The dependency is noted inline in Task 10, Step 4.
- **Type consistency:** services are `create<Name>Service(getAgent: () => any)`; `comments.list` and `feed.getTimeline` return `Page<...>`; ids use `encodeBlueskyId`/`parseBlueskyId` everywhere; `hasSources` is the single flag added to `Capabilities`.
