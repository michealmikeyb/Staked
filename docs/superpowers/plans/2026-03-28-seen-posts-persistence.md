# Seen Posts Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the set of swiped post IDs in localStorage so already-seen posts are filtered out on reload, with a reset button when the feed runs out.

**Architecture:** Add three functions (`loadSeen`, `addSeen`, `clearSeen`) to the existing `store.ts` localStorage module. `FeedStack` reads the seen set into a ref on mount, filters fetched posts against it, and writes to it on every dismiss. When the feed is exhausted, an empty-state screen offers a reset button.

**Tech Stack:** TypeScript, localStorage, React `useRef`, Vitest + jsdom

---

## File Map

- Modify: `src/lib/store.ts` — add `loadSeen`, `addSeen`, `clearSeen`
- Modify: `src/lib/store.test.ts` — add tests for the three new functions
- Modify: `src/components/FeedStack.tsx` — seen ref, filter on load, mark on dismiss, empty state
- Modify: `src/components/FeedStack.test.tsx` — test filtering and empty state

---

## Task 1: Seen store functions

**Files:**
- Modify: `src/lib/store.test.ts`
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Write failing tests for `loadSeen`**

Add to `src/lib/store.test.ts` (after the existing `clearAuth` block):

```ts
describe('loadSeen', () => {
  it('returns an empty Set when nothing is stored', () => {
    expect(loadSeen()).toEqual(new Set());
  });

  it('returns stored IDs as a Set', () => {
    localStorage.setItem('stakswipe_seen', JSON.stringify([1, 2, 3]));
    expect(loadSeen()).toEqual(new Set([1, 2, 3]));
  });

  it('returns an empty Set when stored value is invalid JSON', () => {
    localStorage.setItem('stakswipe_seen', 'not-json');
    expect(loadSeen()).toEqual(new Set());
  });
});
```

Also update the import line at the top of `src/lib/store.test.ts`:

```ts
import { saveAuth, loadAuth, clearAuth, loadSeen, addSeen, clearSeen, type AuthState } from './store';
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- store.test
```

Expected: FAIL — `loadSeen is not a function` (or similar import error)

- [ ] **Step 3: Write failing tests for `addSeen`**

Add to `src/lib/store.test.ts` (after the `loadSeen` block):

```ts
describe('addSeen', () => {
  it('stores a single ID', () => {
    addSeen(42);
    expect(loadSeen()).toEqual(new Set([42]));
  });

  it('accumulates multiple IDs', () => {
    addSeen(1);
    addSeen(2);
    addSeen(3);
    expect(loadSeen()).toEqual(new Set([1, 2, 3]));
  });

  it('does not duplicate an already-stored ID', () => {
    addSeen(5);
    addSeen(5);
    const arr = JSON.parse(localStorage.getItem('stakswipe_seen')!);
    expect(arr).toEqual([5]);
  });

  it('caps the stored list at 200 entries, dropping oldest', () => {
    for (let i = 0; i < 201; i++) addSeen(i);
    const arr = JSON.parse(localStorage.getItem('stakswipe_seen')!) as number[];
    expect(arr.length).toBe(200);
    expect(arr[0]).toBe(1);   // ID 0 was dropped
    expect(arr[199]).toBe(200);
  });
});
```

- [ ] **Step 4: Write failing tests for `clearSeen`**

Add to `src/lib/store.test.ts` (after the `addSeen` block):

```ts
describe('clearSeen', () => {
  it('removes all stored seen IDs', () => {
    addSeen(10);
    addSeen(20);
    clearSeen();
    expect(loadSeen()).toEqual(new Set());
  });
});
```

- [ ] **Step 5: Run tests to verify they all fail**

```bash
npm test -- store.test
```

Expected: multiple failures — `loadSeen`, `addSeen`, `clearSeen` not exported

- [ ] **Step 6: Implement `loadSeen`, `addSeen`, `clearSeen` in `src/lib/store.ts`**

Add after the existing `clearAuth` function:

```ts
const SEEN_KEY = 'stakswipe_seen';
const MAX_SEEN = 200;

export function loadSeen(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

export function addSeen(id: number): void {
  let arr: number[] = [];
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) arr = JSON.parse(raw) as number[];
  } catch {
    // start fresh if corrupted
  }
  if (!arr.includes(id)) {
    arr.push(id);
  }
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr.slice(-MAX_SEEN)));
}

export function clearSeen(): void {
  localStorage.removeItem(SEEN_KEY);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test -- store.test
```

Expected: all store tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: add loadSeen/addSeen/clearSeen to store"
```

---

## Task 2: Filter seen posts in FeedStack

**Files:**
- Modify: `src/components/FeedStack.test.tsx`
- Modify: `src/components/FeedStack.tsx`

- [ ] **Step 1: Write failing test for seen-post filtering**

Add to `src/components/FeedStack.test.tsx` (inside `describe('FeedStack')`):

```ts
  it('does not render a post whose id is in the seen list', async () => {
    localStorage.setItem('stakswipe_seen', JSON.stringify([1]));
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument();
    });
  });
```

Also add `beforeEach(() => { localStorage.clear(); });` at the top of the `describe` block (after `beforeEach(() => { vi.clearAllMocks(); })`):

```ts
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- FeedStack.test
```

Expected: FAIL — `Test Post Title` is found (filtering not yet implemented)

- [ ] **Step 3: Implement seen ref and filtering in `src/components/FeedStack.tsx`**

Add the import for `useRef` (it's already imported as part of the `react` import — add `useRef` if not present):

```ts
import { useState, useEffect, useCallback, useRef } from 'react';
```

Add store imports after the existing store import:

```ts
import { type AuthState, loadSeen, addSeen, clearSeen } from '../lib/store';
```

Add the seen ref at the top of the component body (after the state declarations):

```ts
  const seenRef = useRef<Set<number>>(loadSeen());
```

In `loadMore`, replace the `else` branch that appends new posts:

```ts
      } else {
        const unseen = newPosts.filter((p) => !seenRef.current.has(p.post.id));
        setPosts((prev) => [...prev, ...unseen]);
      }
```

In `dismissTop`, update the function to record the dismissed post:

```ts
  function dismissTop(postId: number) {
    addSeen(postId);
    seenRef.current.add(postId);
    setPosts((prev) => prev.slice(1));
  }
```

Update all three call sites of `dismissTop` to pass the post ID:

In the `handleKey` keyboard handler:
```ts
      if (e.key === 'ArrowRight') {
        upvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowLeft') {
        downvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        dismissTop(topPost.post.id);
      }
```

In the JSX `onSwipeRight` and `onSwipeLeft`:
```ts
            onSwipeRight={isTop ? async () => {
              await upvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
              dismissTop(post.post.id);
            } : () => {}}
            onSwipeLeft={isTop ? async () => {
              await downvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
              dismissTop(post.post.id);
            } : () => {}}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- FeedStack.test
```

Expected: all FeedStack tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: filter seen posts from feed and persist on dismiss"
```

---

## Task 3: Empty-feed state with reset button

**Files:**
- Modify: `src/components/FeedStack.test.tsx`
- Modify: `src/components/FeedStack.tsx`

- [ ] **Step 1: Write failing test for empty-feed state**

Add this import at the top of `src/components/FeedStack.test.tsx`:

```ts
import { fireEvent } from '@testing-library/react';
```

Add a new `describe` block for empty state at the bottom of the file (outside the existing `describe('FeedStack')` block):

```ts
describe('FeedStack empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows reset and logout buttons when feed is exhausted', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset seen history/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });
  });

  it('calls clearSeen and reloads when reset button is clicked', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const reloadMock = vi.fn();
    vi.stubGlobal('location', { reload: reloadMock });
    localStorage.setItem('stakswipe_seen', JSON.stringify([99]));

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    const btn = await screen.findByRole('button', { name: /reset seen history/i });
    fireEvent.click(btn);

    expect(localStorage.getItem('stakswipe_seen')).toBeNull();
    expect(reloadMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- FeedStack.test
```

Expected: FAIL — reset/logout buttons not found

- [ ] **Step 3: Add empty-feed state to `src/components/FeedStack.tsx`**

After the existing error guard (around line 88) and before the `const visible = ...` line, add:

```ts
  if (posts.length === 0 && !loading && !canLoadMore) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
        <div style={{ color: 'var(--text-secondary)' }}>You've seen everything!</div>
        <button
          onClick={() => { clearSeen(); window.location.reload(); }}
          style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
        >
          Reset seen history
        </button>
        <button
          onClick={onLogout}
          style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--text-secondary)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
        >
          Log out
        </button>
      </div>
    );
  }
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: show empty-state with reset and logout when feed exhausted"
```
