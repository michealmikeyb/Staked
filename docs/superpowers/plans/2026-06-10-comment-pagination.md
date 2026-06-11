# Comment Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scroll-based comment pagination so posts with >50 comments load additional pages as the user scrolls down.

**Architecture:** Change `CommentService.list()` to return `Page<Comment>` with a cursor; add a `page` param to `fetchRaw`; update `PostDetailCard` to accumulate pages via state + `useEffect`, triggering loads via an `IntersectionObserver` sentinel passed through `PostCardShell`. Non-paginating callers (`PostCard`, `CommentsPanel`) just extract `.items`.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, lemmy-js-client

---

### Task 1: Update `CommentService` interface

**Files:**
- Modify: `src/lib/api/backend.ts:28-35`

No test needed — interface-only change, compile errors catch misuse.

- [ ] **Step 1: Update `list()` signature**

In `src/lib/api/backend.ts`, replace the `CommentService` interface's `list` line:

```ts
export interface CommentService {
  list(postId: ID, opts: { sortId: string; sourceHandle?: string; targetCommentApId?: string; cursor?: string | null }): Promise<Page<Comment>>;
  vote(commentId: ID, vote: Vote): Promise<void>;
  create(input: { postId: ID; parentId?: ID; body: string }): Promise<Comment>;
  edit(commentId: ID, body: string): Promise<Comment>;
  delete(commentId: ID): Promise<void>;
  report(commentId: ID, reason: string): Promise<void>;
}
```

(`Page` is already imported via `import type { ID, Vote, Session, User, Source, Post, Comment, Notification, Page, Stak } from './types';`)

- [ ] **Step 2: Run tsc to see all call sites that now fail**

```bash
cd /home/mikey/Development/Staked && npx tsc --noEmit 2>&1 | grep "comments.list\|list(" | head -30
```

Expected: errors in `PostCard.tsx`, `PostDetailCard.tsx`, `CommentsPanel.tsx`, `mock/index.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/backend.ts
git commit -m "refactor(comments): list() returns Page<Comment> with cursor support"
```

---

### Task 2: Update mock backend

**Files:**
- Modify: `src/lib/api/backends/mock/index.ts:127`
- Modify: `src/lib/api/backends/mock/index.test.ts:57-58`

- [ ] **Step 1: Write the failing test**

In `src/lib/api/backends/mock/index.test.ts`, update the `'appends comments via create'` test (around line 53) to expect `Page<Comment>`:

```ts
it('appends comments via create', async () => {
  const post = makePost();
  const backend = createMockBackend({ posts: [post], comments: { [post.id]: [] } });
  const c = await backend.comments.create({ postId: post.id, body: 'Hi' });
  const page = await backend.comments.list(post.id, { sortId: 'top' });
  expect(page.items).toContainEqual(c);
  expect(page.nextCursor).toBeNull();
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/lib/api/backends/mock/index.test.ts 2>&1 | tail -20
```

Expected: FAIL — `page.items` is undefined (list still returns array)

- [ ] **Step 3: Update mock `list()` to return `Page<Comment>`**

In `src/lib/api/backends/mock/index.ts`, line 127, change:

```ts
async list(postId, _opts) { return state.comments.get(postId) ?? []; },
```

to:

```ts
async list(postId, _opts) { return pageOf(state.comments.get(postId) ?? []); },
```

(`pageOf` is already defined at line 58 as `const pageOf = <T>(items: T[]): Page<T> => ({ items, nextCursor: null });`)

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/lib/api/backends/mock/index.test.ts 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/mock/index.ts src/lib/api/backends/mock/index.test.ts
git commit -m "fix(mock): comments.list returns Page<Comment>"
```

---

### Task 3: Update Lemmy `fetchRaw` and `list()`

**Files:**
- Modify: `src/lib/api/backends/lemmy/comments.ts:16-23` (fetchRaw)
- Modify: `src/lib/api/backends/lemmy/comments.ts:62-129` (list)

No new test file for the Lemmy backend (no test infrastructure for network calls). Correctness is verified by the UI in Task 6.

- [ ] **Step 1: Add `page` param to `fetchRaw`**

Replace the `fetchRaw` function (lines 16-23):

```ts
async function fetchRaw(instance: string, token: string, postId: number, sort: CommentSortType, page = 1): Promise<CommentView[]> {
  try {
    const res = await makeLemmyClient(instance, token || undefined).getComments({
      post_id: postId, sort, limit: 50, page,
    });
    return res.comments;
  } catch { return []; }
}
```

- [ ] **Step 2: Update `list()` to parse cursor and return `Page<Comment>`**

Replace the `list` method signature and the part before the tiers (lines 62-68):

```ts
async list(postId: ID, opts): Promise<import('../../backend').Page<Comment>> {
  const sort = opts.sortId as CommentSortType;
  const { localId, apId } = parsePostId(postId);
  const source = sourceFromApId(apId);
  const page = opts.cursor ? parseInt(opts.cursor, 10) : 1;
  const isFirstPage = page === 1;

  let loaded: CommentView[] = [];
  let cachedHome: CommentView[] | null = null;
```

- [ ] **Step 3: Pass `page` into Tier 1 fetch and add nextCursor**

In the Tier 1 block (currently lines 70-74), pass `page`:

```ts
// Tier 1 — source instance
if (source) {
  const srcToken = source.instance === homeInstance ? (token ?? '') : '';
  loaded = await fetchRaw(source.instance, srcToken, source.postId, sort, page);
}
```

Wrap the cross-stitch and supplemental fetch in `if (isFirstPage)`:

```ts
// Cross-stitch novel home comments into source tree (first page only)
if (isFirstPage && token && source && source.instance !== homeInstance) {
  const home = cachedHome ?? await fetchRaw(homeInstance, token, localId, sort);
  loaded = crossStitch(loaded, home);
}

// Supplemental fetch (first page only)
if (isFirstPage && opts.targetCommentApId && source) {
```

At the end of `list()`, replace `return mapComments(loaded);` with:

```ts
const nextCursor = loaded.length === 50 ? String(page + 1) : null;
return { items: mapComments(loaded), nextCursor };
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd /home/mikey/Development/Staked && npx tsc --noEmit 2>&1 | grep "comments" | head -20
```

Expected: only errors in the UI files not yet updated (`PostCard`, `PostDetailCard`, `CommentsPanel`)

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/lemmy/comments.ts
git commit -m "feat(lemmy): paginate comments via page param, return Page<Comment>"
```

---

### Task 4: Update `PostCard` and `CommentsPanel` callers

**Files:**
- Modify: `src/components/PostCard.tsx:39-44`
- Modify: `src/components/CommentsPanel.tsx:21-28`

These components don't need scroll pagination — just extract `.items`.

- [ ] **Step 1: Update `PostCard.tsx`**

At line 39-44, change:

```ts
const { data: commentsData, loading: commentsLoading } = useAsync(
  () => backend.comments.list(post.id, { sortId: activeSort, sourceHandle: post.source.handle }),
  [post.id, activeSort],
);
const comments = commentsData ?? [];
```

to:

```ts
const { data: commentsData, loading: commentsLoading } = useAsync(
  () => backend.comments.list(post.id, { sortId: activeSort, sourceHandle: post.source.handle }),
  [post.id, activeSort],
);
const comments = commentsData?.items ?? [];
```

- [ ] **Step 2: Update `CommentsPanel.tsx`**

At line 23-25, change:

```ts
backend.comments.list(post.id, { sortId: 'Top', sourceHandle: post.source.handle })
  .then((c) => { if (!cancelled) setComments(c); })
```

to:

```ts
backend.comments.list(post.id, { sortId: 'Top', sourceHandle: post.source.handle })
  .then((page) => { if (!cancelled) setComments(page.items); })
```

- [ ] **Step 3: Check TypeScript compiles (only PostDetailCard errors remain)**

```bash
cd /home/mikey/Development/Staked && npx tsc --noEmit 2>&1 | grep -v "PostDetailCard" | head -20
```

Expected: no errors outside PostDetailCard

- [ ] **Step 4: Run existing tests to confirm no regressions**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/CommentsPanel.test.tsx 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/components/PostCard.tsx src/components/CommentsPanel.tsx
git commit -m "fix: extract .items from Page<Comment> in PostCard and CommentsPanel"
```

---

### Task 5: Add `onLoadMore` sentinel to `PostCardShell`

**Files:**
- Modify: `src/components/PostCardShell.tsx:30-42` (Props interface)
- Modify: `src/components/PostCardShell.tsx:326-347` (commentsSection render)
- Modify: `src/components/PostCardShell.test.tsx` (new test)

- [ ] **Step 1: Write failing test**

Add to `src/components/PostCardShell.test.tsx`, inside the existing `describe` block:

```ts
it('calls onLoadMore when sentinel scrolls into view', async () => {
  const onLoadMore = vi.fn();
  // jsdom IntersectionObserver mock
  let observeCallback: IntersectionObserverCallback = () => {};
  const mockObserver = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal('IntersectionObserver', vi.fn((cb: IntersectionObserverCallback) => {
    observeCallback = cb;
    return mockObserver;
  }));

  renderShell({ onLoadMore, loadingMore: false });

  // Simulate sentinel entering viewport
  await act(async () => {
    observeCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });

  expect(onLoadMore).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});
```

Add `act` to the import: `import { screen, fireEvent, waitFor, act } from '@testing-library/react';`

- [ ] **Step 2: Run to confirm it fails**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/PostCardShell.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `onLoadMore` not called (sentinel doesn't exist yet)

- [ ] **Step 3: Add props to `PostCardShell` interface**

In `src/components/PostCardShell.tsx`, add to the `Props` interface (after `onSortChange?`):

```ts
onLoadMore?: () => void;
loadingMore?: boolean;
```

- [ ] **Step 4: Wire up sentinel in `PostCardShell`**

Add `sentinelRef` and `IntersectionObserver` effect. In the component body, after the existing refs:

```ts
const sentinelRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!onLoadMore || !sentinelRef.current) return;
  const obs = new IntersectionObserver(
    (entries) => { if (entries[0].isIntersecting) onLoadMore(); },
    { threshold: 0 },
  );
  obs.observe(sentinelRef.current);
  return () => obs.disconnect();
}, [onLoadMore]);
```

Add destructuring of `onLoadMore` and `loadingMore` to the component params:

```ts
export default function PostCardShell({
  post,
  comments, commentsLoaded, highlightCommentId,
  scrollRef: scrollRefProp, onTouchStart, onTouchMove, onTouchEnd,
  blurNsfw = true,
  activeSort = 'Top',
  onSortChange = noop,
  onLoadMore,
  loadingMore = false,
}: Props) {
```

After the `<CommentList ... />` closing tag and before `</div>` of `commentsSection`, add:

```tsx
{onLoadMore && (
  <div ref={sentinelRef} style={{ height: 1, margin: '4px 0' }}>
    {loadingMore && (
      <div style={{ textAlign: 'center', padding: '8px 0', color: '#666', fontSize: 13 }}>
        Loading more…
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/PostCardShell.test.tsx 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx
git commit -m "feat(PostCardShell): add onLoadMore sentinel via IntersectionObserver"
```

---

### Task 6: Update `PostDetailCard` with scroll pagination

**Files:**
- Modify: `src/components/PostDetailCard.tsx:1-117`
- Modify: `src/components/PostDetailCard.test.tsx` (new test)

- [ ] **Step 1: Write failing test**

Add this import at the top of `src/components/PostDetailCard.test.tsx`:

```ts
import { makeComment } from '../lib/api/backends/mock/fixtures';
```

Update the existing `@testing-library/react` import to include `waitFor`:

```ts
import { screen, fireEvent, waitFor } from '@testing-library/react';
```

Add inside the existing `describe` block:

```ts
it('renders comments from initial load', async () => {
  // neutralPost.id is composed as `${post.id}|${post.ap_id}` = '1|https://lemmy.world/post/1'
  const POST_KEY = `${mockPost.id}|${mockPost.ap_id}`;
  const comments = [
    makeComment({ id: 'c1', body: 'First comment' }),
    makeComment({ id: 'c2', body: 'Second comment' }),
  ];
  renderWithBackend(
    <SettingsProvider>
      <PostDetailCard post={mockPost} community={mockCommunity} creator={mockCreator} counts={mockCounts} auth={AUTH} />
    </SettingsProvider>,
    { fixtures: { comments: { [POST_KEY]: comments } } },
  );
  await waitFor(() => expect(screen.getByText('First comment')).toBeInTheDocument());
  expect(screen.getByText('Second comment')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/PostDetailCard.test.tsx 2>&1 | tail -20
```

Expected: FAIL — TypeScript error or `comments.list` no longer returns array

- [ ] **Step 3: Rewrite `PostDetailCard.tsx`**

Replace the full file content with:

```tsx
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useBackend } from '../lib/api/context';
import { instanceFromActorId } from '../lib/urlUtils';
import type { AuthState } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';
import type { Post as NeutralPost, Comment } from '../lib/api/types';
import PostCardShell from './PostCardShell';

interface Post {
  id: number;
  name: string;
  ap_id: string;
  url?: string | null;
  body?: string | null;
  thumbnail_url?: string | null;
  nsfw?: boolean;
  published?: string;
}

interface Community {
  name: string;
  actor_id: string;
}

interface Creator {
  name: string;
  display_name?: string | null;
  actor_id?: string;
}

interface Counts {
  score: number;
  comments: number;
}

interface Props {
  post: Post;
  community: Community;
  creator: Creator;
  counts: Counts;
  auth?: AuthState;
  notifCommentApId?: string;
}

export default function PostDetailCard({
  post, community, creator, counts, auth, notifCommentApId,
}: Props) {
  const backend = useBackend();
  const { settings } = useSettings();
  const [activeSort, setActiveSort] = useState<string>(() => settings.defaultCommentSortId);

  const neutralPost = useMemo<NeutralPost>(() => {
    const srcInstance = instanceFromActorId(community.actor_id);
    const authorInstance = creator.actor_id ? instanceFromActorId(creator.actor_id) : '';
    return {
      id: post.ap_id ? `${post.id}|${post.ap_id}` : String(post.id),
      source: {
        id: community.actor_id,
        handle: `${community.name}@${srcInstance}`,
        name: community.name,
        icon: undefined,
        counts: { members: 0, posts: 0 },
      },
      author: {
        id: creator.actor_id ?? creator.name,
        handle: authorInstance ? `${creator.name}@${authorInstance}` : creator.name,
        displayName: creator.display_name ?? undefined,
        avatar: undefined,
        profileUrl: creator.actor_id ?? '',
      },
      title: post.name,
      body: post.body ?? undefined,
      externalUrl: post.url ?? undefined,
      mediaUrl: post.thumbnail_url ?? undefined,
      nsfw: post.nsfw ?? false,
      publishedAt: post.published ?? new Date().toISOString(),
      permalink: post.ap_id,
      counts: { score: counts.score, comments: counts.comments },
      viewer: undefined,
    };
  }, [post, community, creator, counts]);

  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAllComments([]);
    setNextCursor(null);
    setCommentsLoaded(false);
    backend.comments.list(neutralPost.id, {
      sortId: activeSort,
      sourceHandle: neutralPost.source.handle,
      targetCommentApId: notifCommentApId,
      cursor: null,
    }).then((page) => {
      if (!cancelled) {
        setAllComments(page.items);
        setNextCursor(page.nextCursor);
        setCommentsLoaded(true);
      }
    });
    return () => { cancelled = true; };
  // notifCommentApId intentionally omitted — only used on initial mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neutralPost.id, activeSort]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    backend.comments.list(neutralPost.id, {
      sortId: activeSort,
      sourceHandle: neutralPost.source.handle,
      cursor: nextCursor,
    }).then((page) => {
      setAllComments((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        return [...prev, ...page.items.filter((c) => !existing.has(c.id))];
      });
      setNextCursor(page.nextCursor);
      setLoadingMore(false);
    });
  }, [nextCursor, loadingMore, neutralPost.id, activeSort, backend]);

  const highlightCommentId = useMemo(() => {
    if (!commentsLoaded || !notifCommentApId) return undefined;
    return allComments.find((c) => c.permalink === notifCommentApId)?.id;
  }, [allComments, commentsLoaded, notifCommentApId]);

  // Suppress unused auth warning — kept in props for caller backward compat
  void auth;

  return (
    <div style={{
      position: 'relative', width: '92vw', maxWidth: 440,
      height: 'calc(100dvh - 72px)',
      borderRadius: 20, background: 'var(--card-bg, #1e2128)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', margin: '12px 0',
      display: 'flex', flexDirection: 'column',
    }}>
      <PostCardShell
        post={neutralPost}
        comments={allComments}
        commentsLoaded={commentsLoaded}
        highlightCommentId={highlightCommentId}
        activeSort={activeSort}
        onSortChange={setActiveSort}
        onLoadMore={nextCursor ? handleLoadMore : undefined}
        loadingMore={loadingMore}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run all tests**

```bash
cd /home/mikey/Development/Staked && npm test 2>&1 | tail -30
```

Expected: all pass

- [ ] **Step 5: Check TypeScript**

```bash
cd /home/mikey/Development/Staked && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/PostDetailCard.tsx src/components/PostDetailCard.test.tsx
git commit -m "feat(PostDetailCard): scroll-based comment pagination"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /home/mikey/Development/Staked && npm test 2>&1 | tail -20
```

Expected: all tests pass, 0 failures

- [ ] **Step 2: Check TypeScript clean**

```bash
cd /home/mikey/Development/Staked && npx tsc --noEmit
```

Expected: no output (no errors)

- [ ] **Step 3: Run dev server and smoke-test**

```bash
npm run dev
```

Open a post with many comments. Scroll to the bottom — a second page of comments should load. Verify the "Loading more…" indicator appears briefly.

- [ ] **Step 4: Commit if any fixups needed, else done**
