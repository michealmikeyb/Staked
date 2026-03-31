# Community Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a community feed that shows posts from a single Lemmy community in the same swipe UI as the main feed, accessible by tapping the community name on any post card.

**Architecture:** Extend `FeedStack` with an optional `community` prop; when set it swaps the fetch call to `fetchCommunityPosts`, uses an empty in-memory seen set, and renders a `CommunityHeader` bar instead of `MenuDrawer`. `PostCard` gains a tappable community name that navigates to `/community/:instance/:name`. A thin `CommunityFeedRoute` helper in `App.tsx` extracts URL params and passes them to `FeedStack`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, @testing-library/react, react-router-dom v6, lemmy-js-client v0.19

---

## File Map

| File | Change |
|------|--------|
| `src/lib/lemmy.ts` | Add `fetchCommunityPosts` |
| `src/lib/lemmy.test.ts` | Add `fetchCommunityPosts` tests |
| `src/components/CommunityHeader.tsx` | Create — compact header bar for community feed |
| `src/components/CommunityHeader.test.tsx` | Create — tests for CommunityHeader |
| `src/components/FeedStack.tsx` | Add optional `community` prop, swap fetch/seen/header |
| `src/components/FeedStack.test.tsx` | Add community mode tests |
| `src/components/PostCard.tsx` | Make community name tappable, add `useNavigate` |
| `src/components/PostCard.test.tsx` | Add community name click test |
| `src/App.tsx` | Add `/community/:instance/:name` route |

---

### Task 1: `fetchCommunityPosts` in lemmy.ts

**Files:**
- Modify: `src/lib/lemmy.ts` (after `fetchPosts`, ~line 37)
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Write the failing test**

Add this `describe` block at the bottom of `src/lib/lemmy.test.ts` (after the `fetchPost` describe block):

```ts
describe('fetchCommunityPosts', () => {
  it('calls getPosts with the community_name ref', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    const { fetchCommunityPosts } = await import('./lemmy');
    await fetchCommunityPosts('lemmy.world', 'tok', 'asklemmy@lemmy.world', 1, 'New');
    const mockInstance = vi.mocked(LemmyHttp).mock.results[0].value;
    expect(mockInstance.getPosts).toHaveBeenCalledWith(
      expect.objectContaining({ community_name: 'asklemmy@lemmy.world', sort: 'New', page: 1 }),
    );
  });

  it('returns the posts array', async () => {
    const { fetchCommunityPosts } = await import('./lemmy');
    const posts = await fetchCommunityPosts('lemmy.world', 'tok', 'asklemmy@lemmy.world', 1, 'Active');
    expect(posts).toHaveLength(1);
    expect(posts[0].post.id).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: FAIL — `fetchCommunityPosts is not a function`

- [ ] **Step 3: Implement `fetchCommunityPosts` in `src/lib/lemmy.ts`**

Add this function directly after `fetchPosts` (after line 37):

```ts
export async function fetchCommunityPosts(
  instance: string,
  token: string,
  communityRef: string,
  page: number,
  sort: SortType = 'Active',
): Promise<PostView[]> {
  const res = await client(instance, token).getPosts({
    community_name: communityRef,
    sort,
    page,
    limit: 10,
  });
  return res.posts;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add fetchCommunityPosts to lemmy client"
```

---

### Task 2: CommunityHeader component

**Files:**
- Create: `src/components/CommunityHeader.tsx`
- Create: `src/components/CommunityHeader.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/CommunityHeader.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommunityHeader from './CommunityHeader';

describe('CommunityHeader', () => {
  it('renders the community name', () => {
    render(
      <CommunityHeader
        name="asklemmy"
        sortType="Active"
        onSortChange={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText('c/asklemmy')).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(
      <CommunityHeader
        name="asklemmy"
        sortType="Active"
        onSortChange={vi.fn()}
        onBack={onBack}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens sort dropdown and calls onSortChange when an option is selected', () => {
    const onSortChange = vi.fn();
    render(
      <CommunityHeader
        name="asklemmy"
        sortType="Active"
        onSortChange={onSortChange}
        onBack={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /active/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(onSortChange).toHaveBeenCalledWith('Hot');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/CommunityHeader.test.tsx
```

Expected: FAIL — `Cannot find module './CommunityHeader'`

- [ ] **Step 3: Implement `CommunityHeader`**

Create `src/components/CommunityHeader.tsx`:

```tsx
import { useState } from 'react';
import { type SortType } from '../lib/lemmy';

const SORT_OPTIONS: { sort: SortType; label: string }[] = [
  { sort: 'Active', label: 'Active' },
  { sort: 'Hot', label: 'Hot' },
  { sort: 'New', label: 'New' },
  { sort: 'TopSixHour', label: 'Top 6h' },
  { sort: 'TopTwelveHour', label: 'Top 12h' },
  { sort: 'TopDay', label: 'Top Day' },
];

interface Props {
  name: string;
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  onBack: () => void;
}

export default function CommunityHeader({ name, sortType, onSortChange, onBack }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const currentLabel = SORT_OPTIONS.find((o) => o.sort === sortType)?.label ?? sortType;

  function handleSortSelect(sort: SortType) {
    setShowDropdown(false);
    onSortChange(sort);
  }

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 16px', height: 48, flexShrink: 0,
        background: '#1a1d24', borderBottom: '1px solid #2a2d35',
      }}>
        <button
          aria-label="Back"
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#f5f5f5', fontSize: 20, padding: '0 8px 0 0', lineHeight: 1,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', color: '#f5f5f5', fontWeight: 600, fontSize: 15 }}>
          c/{name}
        </div>
        <button
          aria-label={`${currentLabel} ▾`}
          onClick={() => setShowDropdown((v) => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: '#f5f5f5', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {currentLabel}
          <span style={{ color: '#888', fontSize: 11 }}>▾</span>
        </button>
      </div>

      {showDropdown && (
        <>
          <div
            onClick={() => setShowDropdown(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30,
          }}>
            {SORT_OPTIONS.map(({ sort, label }) => (
              <button
                key={sort}
                onClick={() => handleSortSelect(sort)}
                aria-label={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid #1e2128', textAlign: 'left',
                  color: sort === sortType ? '#ff6b35' : '#f5f5f5',
                  fontWeight: sort === sortType ? 600 : 400, fontSize: 14,
                }}
              >
                <span style={{ width: 16, fontSize: 13 }}>{sort === sortType ? '✓' : ''}</span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/CommunityHeader.test.tsx
```

Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CommunityHeader.tsx src/components/CommunityHeader.test.tsx
git commit -m "feat: add CommunityHeader component"
```

---

### Task 3: FeedStack community mode

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add `fetchCommunityPosts` to the existing `vi.mock('../lib/lemmy', ...)` call at the top of `src/components/FeedStack.test.tsx`. The mock object currently ends with `fetchUnreadCount`. Add `fetchCommunityPosts` to it:

```ts
vi.mock('../lib/lemmy', () => ({
  fetchPosts: vi.fn().mockResolvedValue([
    {
      post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null },
      community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
      creator: { name: 'alice' },
      counts: { score: 847, comments: 42 },
    },
  ]),
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  upvotePost: vi.fn().mockResolvedValue(undefined),
  downvotePost: vi.fn().mockResolvedValue(undefined),
  savePost: vi.fn().mockResolvedValue(undefined),
  fetchUnreadCount: vi.fn().mockResolvedValue(3),
  fetchCommunityPosts: vi.fn().mockResolvedValue([
    {
      post: { id: 2, name: 'Community Post', body: null, url: null, thumbnail_url: null },
      community: { name: 'rust', actor_id: 'https://lemmy.world/c/rust' },
      creator: { name: 'bob' },
      counts: { score: 10, comments: 2 },
    },
  ]),
}));
```

Then add this new describe block at the bottom of `src/components/FeedStack.test.tsx`:

```tsx
describe('FeedStack community mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders CommunityHeader instead of MenuDrawer when community prop is set', async () => {
    render(
      <FeedStack
        auth={AUTH}
        onLogout={vi.fn()}
        unreadCount={0}
        setUnreadCount={vi.fn()}
        community={{ name: 'rust', instance: 'lemmy.world' }}
      />
    );
    await screen.findByText('Community Post');
    expect(screen.getByText('c/rust')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
  });

  it('calls fetchCommunityPosts with the correct communityRef', async () => {
    const { fetchCommunityPosts } = await import('../lib/lemmy');
    render(
      <FeedStack
        auth={AUTH}
        onLogout={vi.fn()}
        unreadCount={0}
        setUnreadCount={vi.fn()}
        community={{ name: 'rust', instance: 'lemmy.world' }}
      />
    );
    await screen.findByText('Community Post');
    expect(fetchCommunityPosts).toHaveBeenCalledWith(
      'lemmy.world', 'tok', 'rust@lemmy.world', 1, 'Active',
    );
  });

  it('shows a post that is in the seen list (independent seen tracking)', async () => {
    addSeen(2); // post id 2 is the community post
    render(
      <FeedStack
        auth={AUTH}
        onLogout={vi.fn()}
        unreadCount={0}
        setUnreadCount={vi.fn()}
        community={{ name: 'rust', instance: 'lemmy.world' }}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Community Post')).toBeInTheDocument();
    });
  });

  it('shows empty state without reset button when community feed is exhausted', async () => {
    const { fetchCommunityPosts } = await import('../lib/lemmy');
    (fetchCommunityPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(
      <FeedStack
        auth={AUTH}
        onLogout={vi.fn()}
        unreadCount={0}
        setUnreadCount={vi.fn()}
        community={{ name: 'rust', instance: 'lemmy.world' }}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/you've seen everything/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reset seen history/i })).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/FeedStack.test.tsx
```

Expected: the 4 new tests FAIL (community prop not yet accepted)

- [ ] **Step 3: Implement community mode in FeedStack**

Replace `src/components/FeedStack.tsx` with the following (full file):

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPosts, fetchCommunityPosts, fetchUnreadCount, upvotePost, downvotePost, savePost, type PostView, type SortType } from '../lib/lemmy';
import { type AuthState, loadSeen, addSeen, clearSeen } from '../lib/store';
import PostCard from './PostCard';
import SwipeHint from './SwipeHint';
import MenuDrawer from './MenuDrawer';
import CommunityHeader from './CommunityHeader';

interface Props {
  auth: AuthState;
  onLogout: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  community?: { name: string; instance: string };
}

const STACK_VISIBLE = 3;
const screenStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16 };

export default function FeedStack({ auth, onLogout, unreadCount, setUnreadCount, community }: Props) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [page, setPage] = useState(1);
  const seenRef = useRef<Set<number>>(community ? new Set() : loadSeen());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [sortType, setSortType] = useState<SortType>(community ? 'Active' : 'TopTwelveHour');

  useEffect(() => {
    if (community) return;
    fetchUnreadCount(auth.instance, auth.token)
      .then(setUnreadCount)
      .catch(() => {});
  }, [auth, setUnreadCount, community]);

  const loadMore = useCallback(async (nextPage: number, sort: SortType) => {
    setLoading(true);
    try {
      const newPosts = community
        ? await fetchCommunityPosts(auth.instance, auth.token, `${community.name}@${community.instance}`, nextPage, sort)
        : await fetchPosts(auth.instance, auth.token, nextPage, sort);
      if (newPosts.length === 0) {
        setCanLoadMore(false);
      } else {
        const unseen = newPosts.filter((p) => !seenRef.current.has(p.post.id));
        setPosts((prev) => [...prev, ...unseen]);
      }
    } catch (err) {
      setCanLoadMore(false);
      if (nextPage === 1) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      }
    } finally {
      setLoading(false);
    }
  // Use primitive values (not the community object) as deps to avoid re-creating
  // loadMore every render when the parent passes `community={{ ... }}` inline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, community?.name, community?.instance]);

  useEffect(() => {
    loadMore(1, sortType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMore]);

  useEffect(() => {
    if (posts.length <= 3 && !loading && canLoadMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMore(nextPage, sortType);
    }
  }, [posts.length, loading, page, loadMore, canLoadMore, sortType]);

  function handleSortChange(newSort: SortType) {
    setSortType(newSort);
    setPosts([]);
    setPage(1);
    setCanLoadMore(true);
    setLoading(true);
    loadMore(1, newSort);
  }

  function dismissTop(postId: number) {
    addSeen(postId);
    seenRef.current.add(postId);
    setPosts((prev) => prev.slice(1));
  }

  useEffect(() => {
    const topPost = posts[0];
    if (!topPost) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        upvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowLeft') {
        downvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowDown') {
        savePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        dismissTop(topPost.post.id);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [posts, auth]);

  if (loading && posts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={screenStyle}>
        <div style={{ color: '#ff4444' }}>{error}</div>
        <button onClick={onLogout} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
          Log out
        </button>
      </div>
    );
  }

  if (posts.length === 0 && !loading && !canLoadMore) {
    return (
      <div style={screenStyle}>
        <div style={{ color: 'var(--text-secondary)' }}>You've seen everything!</div>
        {!community && (
          <button
            onClick={() => { clearSeen(); window.location.reload(); }}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
          >
            Reset seen history
          </button>
        )}
        <button
          onClick={onLogout}
          style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--text-secondary)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
        >
          Log out
        </button>
      </div>
    );
  }

  const visible = posts.slice(0, STACK_VISIBLE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {community ? (
        <CommunityHeader
          name={community.name}
          sortType={sortType}
          onSortChange={handleSortChange}
          onBack={() => navigate(-1)}
        />
      ) : (
        <MenuDrawer
          sortType={sortType}
          onSortChange={handleSortChange}
          onNavigate={navigate}
          onLogoClick={() => navigate('/')}
          unreadCount={unreadCount}
        />
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {visible.map((post, i) => {
          const isTop = i === 0;
          const scale = 1 - i * 0.04;
          const zIndex = STACK_VISIBLE - i;
          return (
            <PostCard
              key={post.post.id}
              post={post}
              auth={auth}
              zIndex={zIndex}
              scale={isTop ? 1 : scale}
              onSwipeRight={isTop ? async () => {
                await upvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
                dismissTop(post.post.id);
              } : () => {}}
              onSwipeLeft={isTop ? async () => {
                await downvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
                dismissTop(post.post.id);
              } : () => {}}
              onSave={isTop ? () => {
                savePost(auth.instance, auth.token, post.post.id).catch(() => {});
                dismissTop(post.post.id);
              } : () => {}}
            />
          );
        })}
        <SwipeHint />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/FeedStack.test.tsx
```

Expected: all tests PASS (including the 4 new community mode tests and all existing tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: add community mode to FeedStack"
```

---

### Task 4: Tappable community name in PostCard

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a `react-router-dom` mock near the top of `src/components/PostCard.test.tsx`, after the existing `vi.mock('../lib/urlUtils', ...)` block:

```ts
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));
```

Then add this test inside the existing `describe('PostCard', ...)` block, after the "renders community name" test:

```ts
it('navigates to community feed when community name is clicked', () => {
  render(
    <PostCard
      post={MOCK_POST}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onSave={vi.fn()}
    />
  );
  fireEvent.click(screen.getByText('c/programming'));
  expect(mockNavigate).toHaveBeenCalledWith('/community/lemmy.world/programming');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --reporter=verbose src/components/PostCard.test.tsx
```

Expected: the new test FAILS — clicking community name does nothing yet

- [ ] **Step 3: Implement the community name click in PostCard**

In `src/components/PostCard.tsx`, add `useNavigate` to the React Router import and add the navigate call. The file currently imports nothing from `react-router-dom`. Add the import at the top (after the existing imports):

```ts
import { useNavigate } from 'react-router-dom';
```

Inside the `PostCard` component body, add `useNavigate` after the existing hooks (after the `useShare` line):

```ts
const navigate = useNavigate();
```

Find the community meta `div` in the JSX (around line 133–138):

```tsx
<div className={styles.meta}>
  <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
  <div>
    <div className={styles.communityName}>c/{community.name}</div>
    <div className={styles.instanceName}>{instance} • {creator.display_name ?? creator.name}</div>
  </div>
</div>
```

Replace it with:

```tsx
<div className={styles.meta}>
  <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
  <div>
    <div
      className={styles.communityName}
      style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/community/${instance}/${community.name}`)}
    >
      c/{community.name}
    </div>
    <div className={styles.instanceName}>{instance} • {creator.display_name ?? creator.name}</div>
  </div>
</div>
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/PostCard.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.test.tsx
git commit -m "feat: make community name tappable in PostCard"
```

---

### Task 5: Wire up the route in App.tsx

**Files:**
- Modify: `src/App.tsx`

No new tests for this task — the logic is in FeedStack (already tested). The route just passes URL params to FeedStack.

- [ ] **Step 1: Add the import and route**

In `src/App.tsx`, add `useParams` to the react-router-dom import:

```ts
import { HashRouter, Routes, Route, useParams } from 'react-router-dom';
```

Add a `CommunityFeedRoute` helper function inside `App.tsx`, before `AuthenticatedApp`:

```tsx
function CommunityFeedRoute({ auth, onLogout, unreadCount, setUnreadCount }: {
  auth: AuthState;
  onLogout: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { instance, name } = useParams<{ instance: string; name: string }>();
  return (
    <FeedStack
      auth={auth}
      onLogout={onLogout}
      unreadCount={unreadCount}
      setUnreadCount={setUnreadCount}
      community={{ name: name!, instance: instance! }}
    />
  );
}
```

Add the route inside `AuthenticatedApp`'s `<Routes>`, after the `profile/:postId` route:

```tsx
<Route
  path="/community/:instance/:name"
  element={
    <CommunityFeedRoute
      auth={auth}
      onLogout={onLogout}
      unreadCount={unreadCount}
      setUnreadCount={setUnreadCount}
    />
  }
/>
```

- [ ] **Step 2: Run all tests to verify nothing is broken**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /community/:instance/:name route"
```
