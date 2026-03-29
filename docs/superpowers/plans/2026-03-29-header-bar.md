# Header Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a header bar with a home logo, sort picker dropdown, and tile-grid menu drawer to the main feed view.

**Architecture:** Sort state lives in FeedStack alongside the other feed state. `HeaderBar` is a new self-contained component that owns the sort dropdown open/close state and calls `onSortChange` when a sort is selected. The menu drawer is rendered directly in FeedStack (alongside the card stack) and toggled via `onMenuOpen`. Both dropdown and drawer use `position: fixed` at `top: 48px` so they overlay correctly regardless of DOM hierarchy.

**Tech Stack:** React 18, TypeScript, inline styles (matches existing codebase pattern), Vitest + @testing-library/react

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/lemmy.ts` | Export `SortType`, add `sort` param to `fetchPosts` |
| Modify | `src/lib/lemmy.test.ts` | Update `fetchPosts` call signature in existing test |
| Create | `src/components/HeaderBar.tsx` | Logo, sort label + dropdown, hamburger button |
| Create | `src/components/HeaderBar.test.tsx` | Unit tests for HeaderBar |
| Modify | `src/components/FeedStack.tsx` | Sort/drawer state, `loadMore` sort param, render HeaderBar + drawer |
| Modify | `src/components/FeedStack.test.tsx` | Tests for sort reset and drawer toggle |

---

### Task 1: Export `SortType` and add `sort` param to `fetchPosts`

**Files:**
- Modify: `src/lib/lemmy.ts`
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/lemmy.test.ts`, update the `fetchPosts` describe block to verify `sort` is forwarded to the API client:

```ts
describe('fetchPosts', () => {
  it('returns an array of PostView', async () => {
    const posts = await fetchPosts('lemmy.world', 'tok', 1, 'Hot');
    expect(posts).toHaveLength(1);
    expect(posts[0].post.id).toBe(1);
  });

  it('passes the sort type to getPosts', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    const instance = vi.mocked(LemmyHttp).mock.results[0].value;
    await fetchPosts('lemmy.world', 'tok', 1, 'New');
    expect(instance.getPosts).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'New' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- lemmy.test
```

Expected: FAIL — `fetchPosts` currently ignores any sort argument.

- [ ] **Step 3: Update `fetchPosts` in `src/lib/lemmy.ts`**

Change the import line to add `SortType`, add it to the export, and update `fetchPosts`:

```ts
import { LemmyHttp, type PostView, type CommentView, type SortType } from 'lemmy-js-client';

export type { PostView, CommentView, SortType };
```

Replace the `fetchPosts` function body:

```ts
export async function fetchPosts(
  instance: string,
  token: string,
  page: number,
  sort: SortType = 'TopTwelveHour',
): Promise<PostView[]> {
  const res = await client(instance, token).getPosts({
    type_: 'All',
    sort,
    page,
    limit: 10,
  });
  return res.posts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- lemmy.test
```

Expected: all `fetchPosts` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add sort param to fetchPosts, export SortType"
```

---

### Task 2: Create `HeaderBar` component

**Files:**
- Create: `src/components/HeaderBar.tsx`
- Create: `src/components/HeaderBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/HeaderBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeaderBar from './HeaderBar';

const defaultProps = {
  sortType: 'TopTwelveHour' as const,
  onSortChange: vi.fn(),
  onMenuOpen: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('HeaderBar', () => {
  it('renders the current sort label', () => {
    render(<HeaderBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /top 12h/i })).toBeInTheDocument();
  });

  it('shows all sort options when sort button is clicked', () => {
    render(<HeaderBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    expect(screen.getByRole('button', { name: /^active$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^hot$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^new$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /top 6h/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /top day/i })).toBeInTheDocument();
  });

  it('calls onSortChange with the selected SortType', () => {
    const onSortChange = vi.fn();
    render(<HeaderBar {...defaultProps} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(onSortChange).toHaveBeenCalledWith('Hot');
  });

  it('hides the dropdown after selecting a sort', () => {
    render(<HeaderBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(screen.queryByRole('button', { name: /^active$/i })).not.toBeInTheDocument();
  });

  it('calls onMenuOpen when the menu button is clicked', () => {
    const onMenuOpen = vi.fn();
    render(<HeaderBar {...defaultProps} onMenuOpen={onMenuOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });

  it('marks the active sort with a checkmark', () => {
    render(<HeaderBar {...defaultProps} sortType="Hot" />);
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    // The Hot option button should contain the checkmark character
    expect(screen.getByRole('button', { name: /^hot$/i })).toHaveTextContent('✓');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- HeaderBar.test
```

Expected: FAIL — `HeaderBar` does not exist yet.

- [ ] **Step 3: Create `src/components/HeaderBar.tsx`**

```tsx
import React, { useState } from 'react';
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
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  onMenuOpen: () => void;
}

export default function HeaderBar({ sortType, onSortChange, onMenuOpen }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const currentLabel = SORT_OPTIONS.find((o) => o.sort === sortType)?.label ?? sortType;

  function handleSortSelect(sort: SortType) {
    setShowDropdown(false);
    onSortChange(sort);
  }

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', height: 48, flexShrink: 0,
        background: '#1a1d24', borderBottom: '1px solid #2a2d35',
      }}>
        <div style={{
          width: 32, height: 32, background: '#ff6b35', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 16, color: '#fff', flexShrink: 0,
        }}>
          S
        </div>
        <button
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
        <div style={{ flex: 1 }} />
        <button
          onClick={onMenuOpen}
          aria-label="Menu"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 20, height: 2, background: '#f5f5f5', borderRadius: 1 }} />
          ))}
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
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid #1e2128', textAlign: 'left',
                  color: sort === sortType ? '#ff6b35' : '#f5f5f5',
                  fontWeight: sort === sortType ? 600 : 400, fontSize: 14,
                }}
              >
                <span style={{ width: 16, fontSize: 13 }}>
                  {sort === sortType ? '✓' : ''}
                </span>
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- HeaderBar.test
```

Expected: all 6 HeaderBar tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/HeaderBar.tsx src/components/HeaderBar.test.tsx
git commit -m "feat: add HeaderBar component with sort dropdown"
```

---

### Task 3: Wire HeaderBar and sort state into FeedStack

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/components/FeedStack.test.tsx`:

```tsx
describe('FeedStack header and sort', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 847, comments: 0 },
        },
      ])
      .mockResolvedValue([]);
  });

  it('renders the header bar', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await screen.findByText('Test Post Title');
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('calls fetchPosts with default sort TopTwelveHour', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await screen.findByText('Test Post Title');
    expect(fetchPosts).toHaveBeenCalledWith('lemmy.world', 'tok', 1, 'TopTwelveHour');
  });

  it('resets the feed and re-fetches when sort changes', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        post: { id: 2, name: 'Hot Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/2' },
        community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
        creator: { name: 'bob' },
        counts: { score: 10, comments: 0 },
      },
    ]);

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await screen.findByText('Test Post Title');

    // Open dropdown and pick Hot
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));

    await waitFor(() => {
      expect(fetchPosts).toHaveBeenCalledWith('lemmy.world', 'tok', 1, 'Hot');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- FeedStack.test
```

Expected: new tests FAIL — header not yet rendered, sort not wired.

- [ ] **Step 3: Update `src/components/FeedStack.tsx`**

At the top, update imports:

```ts
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPosts, upvotePost, downvotePost, savePost, type PostView, type SortType } from '../lib/lemmy';
import { type AuthState, loadSeen, addSeen, clearSeen } from '../lib/store';
import PostCard from './PostCard';
import SwipeHint from './SwipeHint';
import HeaderBar from './HeaderBar';
```

Add sort state inside the component, after the existing state declarations:

```ts
const [sortType, setSortType] = useState<SortType>('TopTwelveHour');
```

Update `loadMore` to accept a `sort` parameter (replace the existing `loadMore`):

```ts
const loadMore = useCallback(async (nextPage: number, sort: SortType) => {
  try {
    const newPosts = await fetchPosts(auth.instance, auth.token, nextPage, sort);
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
}, [auth]);
```

Update the initial load effect:

```ts
useEffect(() => {
  loadMore(1, 'TopTwelveHour');
}, [loadMore]);
```

Update the pagination effect:

```ts
useEffect(() => {
  if (posts.length <= 3 && !loading && canLoadMore) {
    const nextPage = page + 1;
    setPage(nextPage);
    loadMore(nextPage, sortType);
  }
}, [posts.length, loading, page, loadMore, canLoadMore, sortType]);
```

Add the sort change handler after the `dismissTop` function:

```ts
function handleSortChange(newSort: SortType) {
  setSortType(newSort);
  setPosts([]);
  setPage(1);
  setCanLoadMore(true);
  setLoading(true);
  loadMore(1, newSort);
}
```

Update the main `return` statement (the one that renders the card stack) — replace it entirely:

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
    <HeaderBar sortType={sortType} onSortChange={handleSortChange} onMenuOpen={() => {}} />
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- FeedStack.test
```

Expected: all tests PASS including the new header/sort tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: wire HeaderBar and sort state into FeedStack"
```

---

### Task 4: Add menu drawer to FeedStack

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/components/FeedStack.test.tsx`:

```tsx
describe('FeedStack menu drawer', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 847, comments: 0 },
        },
      ])
      .mockResolvedValue([]);
  });

  it('opens the drawer when menu button is clicked', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inbox/i })).toBeInTheDocument();
  });

  it('closes the drawer when a tile is clicked', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /saved/i }));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('closes the drawer when the hamburger is clicked again', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- FeedStack.test
```

Expected: new drawer tests FAIL — no drawer rendered yet.

- [ ] **Step 3: Add drawer state and render to `src/components/FeedStack.tsx`**

Add drawer state alongside the other new state:

```ts
const [showDrawer, setShowDrawer] = useState(false);
```

Update the `onMenuOpen` prop passed to HeaderBar (in the main return):

```tsx
<HeaderBar
  sortType={sortType}
  onSortChange={handleSortChange}
  onMenuOpen={() => setShowDrawer((v) => !v)}
/>
```

Add the drawer just before the closing `</div>` of the outer container in the main return:

```tsx
{showDrawer && (
  <>
    <div
      onClick={() => setShowDrawer(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
    />
    <div style={{
      position: 'fixed', top: 48, left: 0, right: 0,
      background: '#1a1d24', borderBottom: '1px solid #2a2d35',
      zIndex: 40, padding: 16,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { icon: '🔖', label: 'Saved' },
          { icon: '👤', label: 'Profile' },
          { icon: '📬', label: 'Inbox' },
        ].map(({ icon, label }) => (
          <button
            key={label}
            onClick={() => setShowDrawer(false)}
            style={{
              background: '#2a2d35', border: 'none', borderRadius: 12,
              cursor: 'pointer', padding: '14px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              color: '#f5f5f5', fontSize: 12, fontWeight: 500,
            }}
          >
            <span style={{ fontSize: 22 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  </>
)}
```

The final shape of the main return in FeedStack should be:

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
    <HeaderBar sortType={sortType} onSortChange={handleSortChange} onMenuOpen={() => setShowDrawer((v) => !v)} />
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* ...PostCard map + SwipeHint unchanged... */}
    </div>
    {showDrawer && (
      <>
        <div onClick={() => setShowDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }} />
        <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '1px solid #2a2d35', zIndex: 40, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: '🔖', label: 'Saved' },
              { icon: '👤', label: 'Profile' },
              { icon: '📬', label: 'Inbox' },
            ].map(({ icon, label }) => (
              <button key={label} onClick={() => setShowDrawer(false)} style={{ background: '#2a2d35', border: 'none', borderRadius: 12, cursor: 'pointer', padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#f5f5f5', fontSize: 12, fontWeight: 500 }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </>
    )}
  </div>
);
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: add menu drawer with Saved, Profile, Inbox tiles"
```
