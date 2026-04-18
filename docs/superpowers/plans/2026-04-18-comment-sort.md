# Comment Sort Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-view comment sort pill bar (Hot/Top/New/Old/Controversial) to every comment-showing surface, controlled by two new settings: `commentSort` (default) and `showCommentSortBar` (toggle).

**Architecture:** `fetchComments` gains an optional `sort` param; `useCommentLoader` accepts and forwards it; `PostCard` and `PostDetailCard` own `activeSort` state and thread it through `useCommentLoader` and down to `PostCardShell`, which renders the pill bar and calls back on tap.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, lemmy-js-client (`CommentSortType`)

---

## File Map

| File | Change |
|---|---|
| `src/lib/lemmy.ts` | Add `sort` param to `fetchComments`; import + re-export `CommentSortType` |
| `src/hooks/useCommentLoader.ts` | Add `sort` param; pass to all three `fetchComments` tiers; add to `useEffect` deps |
| `src/hooks/useCommentLoader.test.ts` | Add test: re-fetches with new sort when sort changes |
| `src/lib/store.ts` | Add `commentSort: CommentSortType` and `showCommentSortBar: boolean` to `AppSettings` + `DEFAULT_SETTINGS` |
| `src/lib/store.test.ts` | Update full-object assertions to include new fields |
| `src/components/PostCardShell.tsx` | Add `activeSort` + `onSortChange` props; call `useSettings()`; render pill bar between footer and comments |
| `src/components/PostCardShell.test.tsx` | Add: sort bar renders by default, hides when setting off, pill click calls onSortChange |
| `src/components/PostCard.tsx` | Add `activeSort` state from `settings.commentSort`; pass to `useCommentLoader` and `PostCardShell` |
| `src/components/PostDetailCard.tsx` | Same as PostCard |
| `src/components/SettingsPage.tsx` | Add "Comment Sort Bar" On/Off card and "Default Comment Sort" pill picker card |
| `src/components/SettingsPage.test.tsx` | Add tests for both new cards |

---

## Task 1: Export `CommentSortType` and add `sort` param to `fetchComments`

**Files:**
- Modify: `src/lib/lemmy.ts`

- [ ] **Step 1: Update the import and re-export in lemmy.ts**

In `src/lib/lemmy.ts`, line 1, change:
```ts
import { LemmyHttp, type PostView, type CommentView, type SortType, type CommentReplyView, type PersonMentionView, type CommunityView } from 'lemmy-js-client';
export type { PostView, CommentView, SortType, CommentReplyView, PersonMentionView, CommunityView };
```
to:
```ts
import { LemmyHttp, type PostView, type CommentView, type SortType, type CommentSortType, type CommentReplyView, type PersonMentionView, type CommunityView } from 'lemmy-js-client';
export type { PostView, CommentView, SortType, CommentSortType, CommentReplyView, PersonMentionView, CommunityView };
```

- [ ] **Step 2: Add `sort` param to `fetchComments`**

In `src/lib/lemmy.ts`, change the `fetchComments` function (currently around line 106):
```ts
export async function fetchComments(
  instance: string,
  token: string,
  postId: number,
): Promise<CommentView[]> {
  const res = await client(instance, token).getComments({
    post_id: postId,
    sort: 'Top',
    limit: 50,
  });
  return res.comments;
}
```
to:
```ts
export async function fetchComments(
  instance: string,
  token: string,
  postId: number,
  sort: CommentSortType = 'Top',
): Promise<CommentView[]> {
  const res = await client(instance, token).getComments({
    post_id: postId,
    sort,
    limit: 50,
  });
  return res.comments;
}
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```
Expected: all existing tests pass (no callers pass sort yet so default keeps behaviour identical).

- [ ] **Step 4: Commit**

```bash
git add src/lib/lemmy.ts
git commit -m "feat: add sort param to fetchComments, export CommentSortType"
```

---

## Task 2: Thread `sort` through `useCommentLoader`

**Files:**
- Modify: `src/hooks/useCommentLoader.ts`
- Modify: `src/hooks/useCommentLoader.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/hooks/useCommentLoader.test.ts` (after the existing imports at the top, add `CommentSortType` to the lemmy import — but since the mock replaces the module, just add a type import; and add the test at the bottom of the `describe` block):

```ts
import { fetchComments } from '../lib/lemmy';
import type { CommentSortType } from '../lib/lemmy';
```

Add this test inside the existing `describe('useCommentLoader', ...)` block:

```ts
it('re-fetches with new sort when sort param changes', async () => {
  const { rerender } = renderHook(
    ({ sort }: { sort: CommentSortType }) =>
      useCommentLoader(mockPost, mockCommunity, mockAuth, sort),
    { initialProps: { sort: 'Top' as CommentSortType } },
  );
  await waitFor(() => expect(vi.mocked(fetchComments)).toHaveBeenCalledWith(
    'lemmy.world', 'tok', 42, 'Top',
  ));
  vi.clearAllMocks();
  rerender({ sort: 'New' });
  await waitFor(() => expect(vi.mocked(fetchComments)).toHaveBeenCalledWith(
    'lemmy.world', 'tok', 42, 'New',
  ));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- useCommentLoader --reporter=verbose 2>&1 | tail -20
```
Expected: FAIL — `useCommentLoader` doesn't accept a sort param yet.

- [ ] **Step 3: Update `useCommentLoader` to accept and use `sort`**

In `src/hooks/useCommentLoader.ts`, update the imports:
```ts
import { fetchComments, resolvePostId, type CommentView, type CommentSortType } from '../lib/lemmy';
```

Change the function signature (add `sort` param with default):
```ts
export function useCommentLoader(
  post: { ap_id: string; id: number },
  community: { actor_id: string },
  auth: AuthState | null,
  sort: CommentSortType = 'Top',
): Result {
```

Add `sort` to the `useEffect` dependency array (line ~105):
```ts
  }, [auth, post.ap_id, post.id, community.actor_id, sort]);
```

Pass `sort` to every `fetchComments` call inside the `load` function. There are three tiers; update all of them:

Tier 1 (source instance, ~line 33):
```ts
loaded = await fetchComments(source.instance, sourceToken, source.postId, sort).catch(() => []);
```

Tier 2 (community instance, ~line 44):
```ts
loaded = await fetchComments(communityInstance, communityToken, localId, sort).catch(() => []);
```

Tier 3a (home instance authenticated, ~line 58):
```ts
cachedHomeComments = await fetchComments(auth.instance, auth.token, post.id, sort).catch(() => null) ?? [];
```

Tier 3b (home instance anonymous, ~line 60):
```ts
: await fetchComments(auth.instance, '', post.id, sort).catch(() => []);
```

The home-comments merge fetch (~line 68) also needs `sort`:
```ts
const homeComments = cachedHomeComments ?? await fetchComments(auth.instance, auth.token, post.id, sort).catch(() => []);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- useCommentLoader --reporter=verbose 2>&1 | tail -20
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCommentLoader.ts src/hooks/useCommentLoader.test.ts
git commit -m "feat: add sort param to useCommentLoader, re-fetches on sort change"
```

---

## Task 3: Add new settings fields to store

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/store.test.ts`, the existing `'returns defaults when nothing is stored'` test checks the full object. Update it and add a new test inside the `describe('loadSettings', ...)` block:

Replace the `'returns defaults when nothing is stored'` test body with:
```ts
it('returns defaults when nothing is stored', () => {
  expect(loadSettings()).toEqual({
    nonUpvoteSwipeAction: 'downvote',
    swapGestures: false,
    blurNsfw: true,
    defaultSort: 'TopTwelveHour',
    activeStak: 'All',
    anonInstance: '',
    commentSort: 'Top',
    showCommentSortBar: true,
  });
});
```

Replace the `'returns defaults when stored value is invalid JSON'` test body with:
```ts
it('returns defaults when stored value is invalid JSON', () => {
  localStorage.setItem('stakswipe_settings', 'not-json');
  expect(loadSettings()).toEqual({
    nonUpvoteSwipeAction: 'downvote',
    swapGestures: false,
    blurNsfw: true,
    defaultSort: 'TopTwelveHour',
    activeStak: 'All',
    anonInstance: '',
    commentSort: 'Top',
    showCommentSortBar: true,
  });
});
```

Update the `AppSettings` object literal in the `'round-trips settings through localStorage'` test:
```ts
it('round-trips settings through localStorage', () => {
  const s: AppSettings = {
    nonUpvoteSwipeAction: 'dismiss',
    swapGestures: true,
    blurNsfw: false,
    defaultSort: 'Hot',
    activeStak: 'Local',
    anonInstance: '',
    commentSort: 'New',
    showCommentSortBar: false,
  };
  saveSettings(s);
  expect(loadSettings()).toEqual(s);
});
```

Add two new tests at the bottom of `describe('loadSettings', ...)`:
```ts
it('returns commentSort: Top by default', () => {
  expect(loadSettings().commentSort).toBe('Top');
});

it('returns showCommentSortBar: true by default', () => {
  expect(loadSettings().showCommentSortBar).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- store.test --reporter=verbose 2>&1 | tail -20
```
Expected: several tests fail — `commentSort` and `showCommentSortBar` are not in `AppSettings` yet.

- [ ] **Step 3: Update `AppSettings` and `DEFAULT_SETTINGS` in store.ts**

In `src/lib/store.ts`, update the import at line 1:
```ts
import { type SortType, type StakType, type CommentSortType } from './lemmy';
```

Update the `AppSettings` interface:
```ts
export interface AppSettings {
  nonUpvoteSwipeAction: 'downvote' | 'dismiss';
  swapGestures: boolean;
  blurNsfw: boolean;
  defaultSort: SortType;
  activeStak: StakType;
  anonInstance: string;
  commentSort: CommentSortType;
  showCommentSortBar: boolean;
}
```

Update `DEFAULT_SETTINGS`:
```ts
export const DEFAULT_SETTINGS: AppSettings = {
  nonUpvoteSwipeAction: 'downvote',
  swapGestures: false,
  blurNsfw: true,
  defaultSort: 'TopTwelveHour',
  activeStak: 'All',
  anonInstance: '',
  commentSort: 'Top',
  showCommentSortBar: true,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- store.test --reporter=verbose 2>&1 | tail -20
```
Expected: all store tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: add commentSort and showCommentSortBar to AppSettings"
```

---

## Task 4: Render sort bar in PostCardShell

**Files:**
- Modify: `src/components/PostCardShell.tsx`
- Modify: `src/components/PostCardShell.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/PostCardShell.test.tsx`, add `SettingsProvider` to the render helper and add sort bar tests.

First, add the import at the top of the file (after existing imports):
```ts
import { SettingsProvider } from '../lib/SettingsContext';
import type { CommentSortType } from '../lib/lemmy';
```

Update the `renderShell` helper to wrap with `SettingsProvider` and accept `activeSort`/`onSortChange`:
```ts
function renderShell(overrides: Record<string, unknown> = {}) {
  const { activeSort = 'Top', onSortChange = vi.fn(), ...rest } = overrides;
  return render(
    <SettingsProvider>
      <PostCardShell
        post={POST}
        community={COMMUNITY}
        creator={CREATOR}
        counts={COUNTS}
        comments={[]}
        commentsLoaded={true}
        auth={AUTH}
        activeSort={activeSort as CommentSortType}
        onSortChange={onSortChange as (s: CommentSortType) => void}
        {...rest}
      />
    </SettingsProvider>,
  );
}
```

Add these tests inside the existing `describe('PostCardShell', ...)` block:
```ts
describe('sort bar', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders sort pills when showCommentSortBar is true (default)', () => {
    renderShell();
    expect(screen.getByRole('button', { name: /^top$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^new$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^hot$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^old$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^controversial$/i })).toBeInTheDocument();
  });

  it('hides sort pills when showCommentSortBar is false', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ showCommentSortBar: false }));
    renderShell();
    expect(screen.queryByRole('button', { name: /^top$/i })).not.toBeInTheDocument();
  });

  it('active sort pill has orange background', () => {
    renderShell({ activeSort: 'New' });
    expect(screen.getByRole('button', { name: /^new$/i })).toHaveStyle({ background: '#ff6b35' });
  });

  it('clicking a pill calls onSortChange with that sort', () => {
    const onSortChange = vi.fn();
    renderShell({ onSortChange });
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(onSortChange).toHaveBeenCalledWith('Hot');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- PostCardShell --reporter=verbose 2>&1 | tail -30
```
Expected: the four new sort bar tests fail (pills don't exist yet). Existing tests may also fail if TypeScript rejects the new props — that's expected.

- [ ] **Step 3: Update PostCardShell.tsx**

Add `useSettings` import and `CommentSortType` to the imports in `src/components/PostCardShell.tsx`:
```ts
import { useSettings } from '../lib/SettingsContext';
import { type CommentSortType } from '../lib/lemmy';
```

Add new props to the `Props` interface:
```ts
interface Props {
  post: Post;
  community: Community;
  creator: Creator;
  counts: Counts;
  auth?: AuthState;
  comments: CommentView[];
  commentsLoaded: boolean;
  highlightCommentId?: number;
  scrollRef?: React.RefObject<HTMLDivElement>;
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchMove?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
  blurNsfw?: boolean;
  activeSort?: CommentSortType;
  onSortChange?: (sort: CommentSortType) => void;
}
```

Add the sort options constant just above the component function:
```ts
const COMMENT_SORT_OPTIONS: { sort: CommentSortType; label: string }[] = [
  { sort: 'Hot', label: 'Hot' },
  { sort: 'Top', label: 'Top' },
  { sort: 'New', label: 'New' },
  { sort: 'Old', label: 'Old' },
  { sort: 'Controversial', label: 'Controversial' },
];
```

Destructure the new props in the function signature:
```ts
export default function PostCardShell({
  post, community, creator, counts, auth,
  comments, commentsLoaded, highlightCommentId,
  scrollRef: scrollRefProp, onTouchStart, onTouchMove, onTouchEnd,
  blurNsfw = true,
  activeSort = 'Top',
  onSortChange = () => {},
}: Props) {
```

Add `useSettings` call at the top of the function body (after existing `const navigate = useNavigate();`):
```ts
const { settings } = useSettings();
```

Add the sort bar between the `.footer` div and the `.commentsSection` div. Find the closing `</div>` of the footer and add the bar after it:
```tsx
        </div>

        {settings.showCommentSortBar && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px', borderBottom: '1px solid #2a2d35', flexWrap: 'wrap' }}>
            {COMMENT_SORT_OPTIONS.map(({ sort, label }) => (
              <button
                key={sort}
                onClick={() => onSortChange(sort)}
                style={{
                  border: 'none', borderRadius: 8, padding: '4px 10px',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: activeSort === sort ? '#ff6b35' : '#2a2d35',
                  color: activeSort === sort ? '#fff' : '#888',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.commentsSection}>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- PostCardShell --reporter=verbose 2>&1 | tail -30
```
Expected: all tests pass including the four new sort bar tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx
git commit -m "feat: render comment sort pill bar in PostCardShell"
```

---

## Task 5: Wire `activeSort` state into PostCard

**Files:**
- Modify: `src/components/PostCard.tsx`

- [ ] **Step 1: Update PostCard.tsx**

Add `CommentSortType` to the lemmy import (PostCard currently imports `type PostView`):
```ts
import { type PostView, type CommentSortType } from '../lib/lemmy';
```

Add `useState` to the React import (it's not currently imported in PostCard — check line 1 and add if missing):
```ts
import { useRef, useState } from 'react';
```

Add `activeSort` state after `const { settings } = useSettings();`:
```ts
const [activeSort, setActiveSort] = useState<CommentSortType>(() => settings.commentSort);
```

Pass `activeSort` to `useCommentLoader` (currently line 34):
```ts
const { comments, commentsLoaded } = useCommentLoader(p, community, auth, activeSort);
```

Pass `activeSort` and `onSortChange` to `PostCardShell` (in the JSX, around line 101):
```tsx
<PostCardShell
  post={p}
  community={community}
  creator={creator}
  counts={counts}
  auth={auth ?? undefined}
  comments={comments}
  commentsLoaded={commentsLoaded}
  scrollRef={scrollRef}
  blurNsfw={settings.blurNsfw}
  activeSort={activeSort}
  onSortChange={setActiveSort}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
/>
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --reporter=verbose 2>&1 | tail -30
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/PostCard.tsx
git commit -m "feat: wire activeSort state into PostCard"
```

---

## Task 6: Wire `activeSort` state into PostDetailCard

**Files:**
- Modify: `src/components/PostDetailCard.tsx`

- [ ] **Step 1: Update PostDetailCard.tsx**

Add imports at the top:
```ts
import { useState } from 'react';
import { type CommentSortType } from '../lib/lemmy';
import { useSettings } from '../lib/SettingsContext';
```

Add `useSettings` and `activeSort` state inside the component function, after the `anonAuth` memo:
```ts
const { settings } = useSettings();
const [activeSort, setActiveSort] = useState<CommentSortType>(() => settings.commentSort);
```

Pass `activeSort` to `useCommentLoader`:
```ts
const { comments, commentsLoaded } = useCommentLoader(
  { ap_id: post.ap_id, id: post.id },
  { actor_id: community.actor_id },
  auth ?? anonAuth,
  activeSort,
);
```

Pass `activeSort` and `onSortChange` to `PostCardShell`:
```tsx
<PostCardShell
  post={post}
  community={community}
  creator={creator}
  counts={counts}
  auth={auth}
  comments={comments}
  commentsLoaded={commentsLoaded}
  highlightCommentId={highlightCommentId}
  activeSort={activeSort}
  onSortChange={setActiveSort}
/>
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --reporter=verbose 2>&1 | tail -30
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/PostDetailCard.tsx
git commit -m "feat: wire activeSort state into PostDetailCard"
```

---

## Task 7: Add settings UI for comment sort

**Files:**
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/components/SettingsPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add these tests inside the existing `describe('SettingsPage', ...)` block in `src/components/SettingsPage.test.tsx`:

```ts
describe('Comment Sort Bar card', () => {
  it('renders the Comment Sort Bar section', () => {
    renderPage();
    expect(screen.getByText('Comment Sort Bar')).toBeInTheDocument();
  });

  it('Off pill updates showCommentSortBar to false', () => {
    renderPage();
    const card = screen.getByTestId('comment-sort-bar-card');
    fireEvent.click(within(card).getByRole('button', { name: /^off$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.showCommentSortBar).toBe(false);
  });

  it('On pill updates showCommentSortBar to true', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ showCommentSortBar: false }));
    renderPage();
    const card = screen.getByTestId('comment-sort-bar-card');
    fireEvent.click(within(card).getByRole('button', { name: /^on$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.showCommentSortBar).toBe(true);
  });
});

describe('Default Comment Sort card', () => {
  it('renders the Default Comment Sort section', () => {
    renderPage();
    expect(screen.getByText('Default Comment Sort')).toBeInTheDocument();
  });

  it('New pill updates commentSort to New', () => {
    renderPage();
    const card = screen.getByTestId('comment-sort-card');
    fireEvent.click(within(card).getByRole('button', { name: /^new$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.commentSort).toBe('New');
  });

  it('active commentSort pill has orange background', () => {
    renderPage();
    const card = screen.getByTestId('comment-sort-card');
    expect(within(card).getByRole('button', { name: /^top$/i })).toHaveStyle({ background: '#ff6b35' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- SettingsPage --reporter=verbose 2>&1 | tail -30
```
Expected: the 6 new tests fail (sections don't exist yet).

- [ ] **Step 3: Add the two new cards to SettingsPage.tsx**

Add `CommentSortType` to the import at the top of `src/components/SettingsPage.tsx` (the file imports `SORT_OPTIONS` from HeaderBar; add a lemmy import for the type):
```ts
import type { CommentSortType } from '../lib/lemmy';
```

Add a constant for comment sort options just inside or just above the component function:
```ts
const COMMENT_SORT_OPTIONS: { sort: CommentSortType; label: string }[] = [
  { sort: 'Hot', label: 'Hot' },
  { sort: 'Top', label: 'Top' },
  { sort: 'New', label: 'New' },
  { sort: 'Old', label: 'Old' },
  { sort: 'Controversial', label: 'Controversial' },
];
```

Insert both cards after the existing "Default Sort" card (around line 132, after the closing `</div>` of that card):

```tsx
        <div data-testid="comment-sort-bar-card" style={card}>
          <div style={sectionLabel}>Comment Sort Bar</div>
          <div style={descText}>Show sort pills (Hot · Top · New · …) above comments</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.showCommentSortBar ? active : inactive}
              onClick={() => updateSetting('showCommentSortBar', true)}
            >
              On
            </button>
            <button
              style={!settings.showCommentSortBar ? active : inactive}
              onClick={() => updateSetting('showCommentSortBar', false)}
            >
              Off
            </button>
          </div>
        </div>

        <div data-testid="comment-sort-card" style={card}>
          <div style={sectionLabel}>Default Comment Sort</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COMMENT_SORT_OPTIONS.map(({ sort, label }) => (
              <button
                key={sort}
                style={settings.commentSort === sort ? active : inactive}
                onClick={() => updateSetting('commentSort', sort)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
```

- [ ] **Step 4: Run the full test suite**

```bash
npm test -- --reporter=verbose 2>&1 | tail -30
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsPage.tsx src/components/SettingsPage.test.tsx
git commit -m "feat: add Comment Sort Bar and Default Comment Sort settings"
```
