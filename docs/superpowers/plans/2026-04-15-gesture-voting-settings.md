# Gesture Voting Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add side-aware comment double-tap voting (right = upvote, left = downvote) and a unified `swapGestures` setting that flips both post-swipe directions and comment tap sides.

**Architecture:** Rename `leftSwipe` → `nonUpvoteSwipeAction` in the store (with silent migration from old localStorage values), add `swapGestures: boolean`, thread both settings through `FeedStack` swipe callbacks and `CommentItem` tap handler. `CommentItem` reads `useSettings()` directly and uses `getBoundingClientRect` + `clientX` to determine which half was tapped.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react, localStorage

---

## File map

| File | Change |
|---|---|
| `src/lib/store.ts` | Rename `leftSwipe` → `nonUpvoteSwipeAction` in interface + defaults; add `swapGestures`; add migration in `loadSettings` |
| `src/lib/store.test.ts` | Update all `leftSwipe` references; add migration test + `swapGestures` default test |
| `src/lib/SettingsContext.test.tsx` | Update `TestConsumer` and all assertions to use `nonUpvoteSwipeAction` |
| `src/App.test.tsx` | Update inline DEFAULT_SETTINGS constant |
| `src/components/FeedStack.tsx` | Replace two `settings.leftSwipe` checks with `swapGestures`-aware logic |
| `src/components/FeedStack.test.tsx` | Update settings JSON in all tests; rename describe; add `swapGestures` tests |
| `src/components/PostCard.test.tsx` | Update one settings JSON |
| `src/components/CommentItem.module.css` | Add `.scoreDownvoted` class |
| `src/components/CommentItem.tsx` | Add `useSettings`; replace `liked: boolean` with `vote: 1\|0\|-1`; add side detection |
| `src/components/CommentItem.test.tsx` | Wrap renders in `SettingsProvider`; add `mockCommentGeometry` helper; rewrite/extend all double-tap tests |
| `src/components/SettingsPage.tsx` | Add Swap Gestures card; rename/relabel non-upvote swipe card |
| `src/components/SettingsPage.test.tsx` | Update label/key assertions; add swap-gestures tests |

---

## Task 1: Store — rename field, add swapGestures, add migration

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.ts`

- [ ] **Step 1: Write failing tests for new store shape**

Replace the entire content of `src/lib/store.test.ts` starting at the `describe('loadSettings'` block (keep everything before line 105 unchanged). Update the five existing `loadSettings` tests and add two new ones:

```ts
describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual({
      nonUpvoteSwipeAction: 'downvote',
      swapGestures: false,
      blurNsfw: true,
      defaultSort: 'TopTwelveHour',
      activeStak: 'All',
      anonInstance: '',
    });
  });

  it('round-trips settings through localStorage', () => {
    const s: AppSettings = {
      nonUpvoteSwipeAction: 'dismiss',
      swapGestures: true,
      blurNsfw: false,
      defaultSort: 'Hot',
      activeStak: 'Local',
      anonInstance: '',
    };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it('merges stored partial object with defaults (handles missing keys)', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ blurNsfw: false }));
    const s = loadSettings();
    expect(s.blurNsfw).toBe(false);
    expect(s.nonUpvoteSwipeAction).toBe('downvote');
    expect(s.swapGestures).toBe(false);
    expect(s.defaultSort).toBe('TopTwelveHour');
    expect(s.activeStak).toBe('All');
  });

  it('returns defaults when stored value is invalid JSON', () => {
    localStorage.setItem('stakswipe_settings', 'not-json');
    expect(loadSettings()).toEqual({
      nonUpvoteSwipeAction: 'downvote',
      swapGestures: false,
      blurNsfw: true,
      defaultSort: 'TopTwelveHour',
      activeStak: 'All',
      anonInstance: '',
    });
  });

  it('persists and reloads activeStak: Subscribed', () => {
    saveSettings({
      nonUpvoteSwipeAction: 'downvote',
      swapGestures: false,
      blurNsfw: true,
      defaultSort: 'TopTwelveHour',
      activeStak: 'Subscribed',
      anonInstance: '',
    });
    expect(loadSettings().activeStak).toBe('Subscribed');
  });

  it('loadSettings returns anonInstance empty string by default', () => {
    localStorage.clear();
    const settings = loadSettings();
    expect(settings.anonInstance).toBe('');
  });

  it('loadSettings merges anonInstance from stored JSON', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ anonInstance: 'lemmy.ml' }));
    const settings = loadSettings();
    expect(settings.anonInstance).toBe('lemmy.ml');
  });

  it('loadSettings fills missing anonInstance from defaults when not in stored JSON', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ nonUpvoteSwipeAction: 'dismiss' }));
    const settings = loadSettings();
    expect(settings.anonInstance).toBe('');
  });

  it('migrates old leftSwipe value to nonUpvoteSwipeAction', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ leftSwipe: 'dismiss' }));
    const s = loadSettings();
    expect(s.nonUpvoteSwipeAction).toBe('dismiss');
    expect(s.swapGestures).toBe(false);
  });

  it('does not overwrite nonUpvoteSwipeAction if already present alongside leftSwipe', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      leftSwipe: 'dismiss',
      nonUpvoteSwipeAction: 'downvote',
    }));
    expect(loadSettings().nonUpvoteSwipeAction).toBe('downvote');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- store.test
```

Expected: failures on `leftSwipe` not found in type, `swapGestures` undefined, etc. (TypeScript compile errors count as failures here.)

- [ ] **Step 3: Update store.ts**

Replace the `AppSettings` interface, `DEFAULT_SETTINGS`, and `loadSettings` in `src/lib/store.ts`:

```ts
export interface AppSettings {
  nonUpvoteSwipeAction: 'downvote' | 'dismiss';
  swapGestures: boolean;
  blurNsfw: boolean;
  defaultSort: SortType;
  activeStak: StakType;
  anonInstance: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  nonUpvoteSwipeAction: 'downvote',
  swapGestures: false,
  blurNsfw: true,
  defaultSort: 'TopTwelveHour',
  activeStak: 'All',
  anonInstance: '',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Migrate: old leftSwipe key → nonUpvoteSwipeAction
    if ('leftSwipe' in parsed && !('nonUpvoteSwipeAction' in parsed)) {
      parsed.nonUpvoteSwipeAction = parsed.leftSwipe;
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
```

(`saveSettings` is unchanged.)

- [ ] **Step 4: Run store tests to confirm they pass**

```bash
npm test -- store.test
```

Expected: all tests in `store.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: rename leftSwipe→nonUpvoteSwipeAction, add swapGestures with migration"
```

---

## Task 2: Fix all other leftSwipe references

**Files:**
- Modify: `src/lib/SettingsContext.test.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/FeedStack.test.tsx`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Update SettingsContext.test.tsx**

Replace the `TestConsumer` component and all assertions. The full updated file:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

beforeEach(() => { localStorage.clear(); });

function TestConsumer() {
  const { settings, updateSetting } = useSettings();
  return (
    <div>
      <span data-testid="non-upvote-swipe-action">{settings.nonUpvoteSwipeAction}</span>
      <span data-testid="swap-gestures">{String(settings.swapGestures)}</span>
      <span data-testid="blur-nsfw">{String(settings.blurNsfw)}</span>
      <span data-testid="default-sort">{settings.defaultSort}</span>
      <button onClick={() => updateSetting('nonUpvoteSwipeAction', 'dismiss')}>set-dismiss</button>
      <button onClick={() => updateSetting('swapGestures', true)}>set-swap</button>
      <button onClick={() => updateSetting('blurNsfw', false)}>set-no-blur</button>
      <button onClick={() => updateSetting('defaultSort', 'Hot')}>set-hot</button>
    </div>
  );
}

describe('SettingsContext', () => {
  it('provides default settings', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    expect(screen.getByTestId('non-upvote-swipe-action').textContent).toBe('downvote');
    expect(screen.getByTestId('swap-gestures').textContent).toBe('false');
    expect(screen.getByTestId('blur-nsfw').textContent).toBe('true');
    expect(screen.getByTestId('default-sort').textContent).toBe('TopTwelveHour');
  });

  it('updateSetting updates nonUpvoteSwipeAction in context', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-dismiss'));
    expect(screen.getByTestId('non-upvote-swipe-action').textContent).toBe('dismiss');
  });

  it('updateSetting updates swapGestures in context', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-swap'));
    expect(screen.getByTestId('swap-gestures').textContent).toBe('true');
  });

  it('updateSetting persists to localStorage', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-hot'));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.defaultSort).toBe('Hot');
  });

  it('initialises from localStorage on mount', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      nonUpvoteSwipeAction: 'dismiss', swapGestures: true, blurNsfw: false, defaultSort: 'New',
    }));
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    expect(screen.getByTestId('non-upvote-swipe-action').textContent).toBe('dismiss');
    expect(screen.getByTestId('swap-gestures').textContent).toBe('true');
    expect(screen.getByTestId('blur-nsfw').textContent).toBe('false');
    expect(screen.getByTestId('default-sort').textContent).toBe('New');
  });

  it('useSettings returns default context value when used outside a provider', () => {
    render(<TestConsumer />);
    expect(screen.getByTestId('non-upvote-swipe-action').textContent).toBe('downvote');
  });
});
```

- [ ] **Step 2: Update App.test.tsx**

Find line 6 and replace the DEFAULT_SETTINGS constant:

```ts
const DEFAULT_SETTINGS = { nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: true, defaultSort: 'TopTwelveHour', activeStak: 'All', anonInstance: '' };
```

- [ ] **Step 3: Update FeedStack.test.tsx — settings JSON objects**

There are six places in `FeedStack.test.tsx` that set `leftSwipe` in JSON. Do a find-and-replace for the JSON fragment:

Replace every occurrence of:
```
leftSwipe: 'downvote', blurNsfw: true, defaultSort: 'Hot'
```
with:
```
nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: true, defaultSort: 'Hot'
```

Replace every occurrence of:
```
leftSwipe: 'downvote', blurNsfw: true, defaultSort: 'TopTwelveHour'
```
with:
```
nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: true, defaultSort: 'TopTwelveHour'
```

Replace:
```
leftSwipe: 'dismiss', blurNsfw: true, defaultSort: 'TopTwelveHour'
```
with:
```
nonUpvoteSwipeAction: 'dismiss', swapGestures: false, blurNsfw: true, defaultSort: 'TopTwelveHour'
```

Replace:
```
leftSwipe: 'downvote', blurNsfw: true, defaultSort: 'TopTwelveHour', activeStak: 'Local'
```
with:
```
nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: true, defaultSort: 'TopTwelveHour', activeStak: 'Local'
```

Replace:
```
leftSwipe: 'downvote', blurNsfw: true, defaultSort: 'TopTwelveHour', activeStak: 'Subscribed'
```
with:
```
nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: true, defaultSort: 'TopTwelveHour', activeStak: 'Subscribed'
```

Also rename the describe block on line 433:
```ts
describe('FeedStack settings — gestures', () => {
```

And rename the two `it` descriptions in that block:
```ts
it('calls downvotePost on ArrowLeft when nonUpvoteSwipeAction is downvote (default)', ...
it('does not call downvotePost on ArrowLeft when nonUpvoteSwipeAction is dismiss', ...
```

- [ ] **Step 4: Update PostCard.test.tsx**

Find the settings JSON on line 704–706 and replace:
```ts
localStorage.setItem('stakswipe_settings', JSON.stringify({
  nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: false, defaultSort: 'TopTwelveHour',
}));
```

- [ ] **Step 5: Run all tests to confirm only FeedStack impl failures remain**

```bash
npm test
```

Expected: `SettingsContext.test.tsx`, `App.test.tsx`, `PostCard.test.tsx` all pass. `FeedStack.test.tsx` fails only on the `settings.leftSwipe` type errors in the component itself.

- [ ] **Step 6: Commit**

```bash
git add src/lib/SettingsContext.test.tsx src/App.test.tsx src/components/FeedStack.test.tsx src/components/PostCard.test.tsx
git commit -m "test: update leftSwipe→nonUpvoteSwipeAction across all test files"
```

---

## Task 3: FeedStack — add swapGestures swipe logic and new tests

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 1: Add swapGestures tests to FeedStack.test.tsx**

Add the following tests inside the `describe('FeedStack settings — gestures'` block, after the two existing tests:

```ts
it('calls upvotePost on ArrowLeft when swapGestures is true', async () => {
  localStorage.setItem('stakswipe_settings', JSON.stringify({
    nonUpvoteSwipeAction: 'downvote', swapGestures: true, blurNsfw: true, defaultSort: 'TopTwelveHour',
  }));
  const { fetchPosts, upvotePost } = await import('../lib/lemmy');
  (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    {
      post: { id: 1, name: 'Test Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
      community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
      creator: { name: 'alice' },
      counts: { score: 10, comments: 0 },
    },
  ]).mockResolvedValue([]);
  render(<SettingsProvider><FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} /></SettingsProvider>);
  await screen.findByText('Test Post');
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(upvotePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1);
});

it('calls downvotePost on ArrowRight when swapGestures is true and nonUpvoteSwipeAction is downvote', async () => {
  localStorage.setItem('stakswipe_settings', JSON.stringify({
    nonUpvoteSwipeAction: 'downvote', swapGestures: true, blurNsfw: true, defaultSort: 'TopTwelveHour',
  }));
  const { fetchPosts, downvotePost } = await import('../lib/lemmy');
  (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    {
      post: { id: 1, name: 'Test Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
      community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
      creator: { name: 'alice' },
      counts: { score: 10, comments: 0 },
    },
  ]).mockResolvedValue([]);
  render(<SettingsProvider><FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} /></SettingsProvider>);
  await screen.findByText('Test Post');
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(downvotePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1);
});

it('does not call downvotePost on ArrowRight when swapGestures is true and nonUpvoteSwipeAction is dismiss', async () => {
  localStorage.setItem('stakswipe_settings', JSON.stringify({
    nonUpvoteSwipeAction: 'dismiss', swapGestures: true, blurNsfw: true, defaultSort: 'TopTwelveHour',
  }));
  const { fetchPosts, downvotePost } = await import('../lib/lemmy');
  (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    {
      post: { id: 1, name: 'Test Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
      community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
      creator: { name: 'alice' },
      counts: { score: 10, comments: 0 },
    },
  ]).mockResolvedValue([]);
  render(<SettingsProvider><FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} /></SettingsProvider>);
  await screen.findByText('Test Post');
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(downvotePost).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run new FeedStack tests to confirm they fail**

```bash
npm test -- FeedStack.test
```

Expected: new swapGestures tests fail; existing tests fail due to `settings.leftSwipe` type error in the component.

- [ ] **Step 3: Update FeedStack.tsx — keyboard handler**

Replace lines 155–168 (the `handleKey` function body):

```ts
function handleKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') {
    if (!isAnonymousMode) {
      if (!settings.swapGestures) {
        upvotePost(auth!.instance, auth!.token, topPost.post.id).catch(() => {});
      } else if (settings.nonUpvoteSwipeAction === 'downvote') {
        downvotePost(auth!.instance, auth!.token, topPost.post.id).catch(() => {});
      }
    }
    dismissTop(topPost.post.id);
  } else if (e.key === 'ArrowLeft') {
    if (!isAnonymousMode) {
      if (settings.swapGestures) {
        upvotePost(auth!.instance, auth!.token, topPost.post.id).catch(() => {});
      } else if (settings.nonUpvoteSwipeAction === 'downvote') {
        downvotePost(auth!.instance, auth!.token, topPost.post.id).catch(() => {});
      }
    }
    dismissTop(topPost.post.id);
  } else if (e.key === 'ArrowDown') {
    handleUndo();
  }
}
```

- [ ] **Step 4: Update FeedStack.tsx — swipe callbacks**

Replace the `onSwipeRight` and `onSwipeLeft` props in the `PostCard` render (lines 264–275):

```tsx
onSwipeRight={isTop ? async () => {
  if (!isAnonymousMode) {
    if (!settings.swapGestures) {
      await upvotePost(auth!.instance, auth!.token, post.post.id).catch(() => {});
    } else if (settings.nonUpvoteSwipeAction === 'downvote') {
      await downvotePost(auth!.instance, auth!.token, post.post.id).catch(() => {});
    }
  }
  dismissTop(post.post.id);
} : () => {}}
onSwipeLeft={isTop ? async () => {
  if (!isAnonymousMode) {
    if (settings.swapGestures) {
      await upvotePost(auth!.instance, auth!.token, post.post.id).catch(() => {});
    } else if (settings.nonUpvoteSwipeAction === 'downvote') {
      await downvotePost(auth!.instance, auth!.token, post.post.id).catch(() => {});
    }
  }
  dismissTop(post.post.id);
} : () => {}}
```

- [ ] **Step 5: Run all FeedStack tests to confirm they pass**

```bash
npm test -- FeedStack.test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: apply swapGestures to post swipe and keyboard directions"
```

---

## Task 4: CommentItem — side-aware voting with swapGestures

**Files:**
- Modify: `src/components/CommentItem.module.css`
- Modify: `src/components/CommentItem.test.tsx`
- Modify: `src/components/CommentItem.tsx`

- [ ] **Step 1: Add scoreDownvoted CSS class**

Append to `src/components/CommentItem.module.css`:

```css
.scoreDownvoted {
  color: #5c9aff;
  font-weight: 700;
  transition: color 0.2s;
}
```

- [ ] **Step 2: Write updated CommentItem tests**

Replace the entire content of `src/components/CommentItem.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommentItem from './CommentItem';
import { SettingsProvider } from '../lib/SettingsContext';

vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockCv = {
  comment: { id: 7, content: '**Bold** and ![img](https://example.com/img.png)', path: '0.7', ap_id: 'https://lemmy.world/comment/7' },
  creator: { name: 'alice', actor_id: 'https://beehaw.org/u/alice', avatar: undefined },
  counts: { score: 10 },
};

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); localStorage.clear(); });

function renderItem(props: Partial<React.ComponentProps<typeof CommentItem>> = {}) {
  return render(
    <SettingsProvider>
      <CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} {...props} />
    </SettingsProvider>
  );
}

/** Give the element a known width so clientX comparisons work in jsdom */
function mockCommentGeometry(el: HTMLElement) {
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0, width: 200, top: 0, right: 200, bottom: 100, height: 100, x: 0, y: 0,
    toJSON: () => {},
  });
}

describe('CommentItem', () => {
  it('renders the author and score', () => {
    renderItem();
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    renderItem();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.png');
    expect(screen.getByText('Bold')).toBeInTheDocument();
  });

  it('right-half double-tap calls likeComment with score 1 and increments score', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 }); // right half
      fireEvent.click(comment, { clientX: 150 });
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 1);
    expect(screen.getByText(/11/)).toBeInTheDocument();
  });

  it('left-half double-tap calls likeComment with score -1 and decrements score', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 }); // left half
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, -1);
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });

  it('second right-half double-tap removes upvote (score 0)', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    expect(likeComment).toHaveBeenLastCalledWith('lemmy.world', 'tok', 7, 0);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('second left-half double-tap removes downvote (score 0)', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(likeComment).toHaveBeenLastCalledWith('lemmy.world', 'tok', 7, 0);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('right-half then left-half double-tap switches directly to downvote', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(likeComment).toHaveBeenLastCalledWith('lemmy.world', 'tok', 7, -1);
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });

  it('swapGestures: true — left-half double-tap upvotes', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ swapGestures: true }));
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 }); // left half → upvote when swapped
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 1);
  });

  it('swapGestures: true — right-half double-tap downvotes', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ swapGestures: true }));
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 }); // right half → downvote when swapped
      fireEvent.click(comment, { clientX: 150 });
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, -1);
  });

  it('score indicator shows ▼ when downvoted', async () => {
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(screen.getByText(/▼/)).toBeInTheDocument();
  });

  it('single tap does not call likeComment', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    fireEvent.click(comment, { clientX: 150 });
    await act(async () => {});
    expect(likeComment).not.toHaveBeenCalled();
  });

  it('reverts vote state when likeComment rejects', async () => {
    const { likeComment } = await import('../lib/lemmy');
    vi.mocked(likeComment).mockRejectedValueOnce(new Error('Network error'));
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    await act(async () => {});
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('reply button calls onReply with the comment view', () => {
    const onReply = vi.fn();
    renderItem({ onReply });
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    expect(onReply).toHaveBeenCalledWith(mockCv);
  });

  it('applies left padding proportional to depth', () => {
    render(
      <SettingsProvider>
        <CommentItem cv={mockCv as never} auth={mockAuth} depth={3} onReply={vi.fn()} />
      </SettingsProvider>
    );
    // depth 3 → 16 + (3-1)*14 = 44px
    expect(screen.getByTestId('comment-item')).toHaveStyle('padding-left: 44px');
  });

  it('applies orange border when isHighlighted is true', () => {
    renderItem({ isHighlighted: true });
    expect(screen.getByTestId('comment-item')).toHaveStyle({ border: '2px solid #ff6b35' });
  });

  it('has data-comment-id attribute matching comment id', () => {
    renderItem();
    expect(screen.getByTestId('comment-item')).toHaveAttribute('data-comment-id', '7');
  });

  it('tapping the author name navigates to user profile', () => {
    renderItem();
    fireEvent.click(screen.getByText(/@alice/));
    expect(mockNavigate).toHaveBeenCalledWith('/user/beehaw.org/alice');
  });

  it('tapping the author name does not trigger the double-tap vote', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    await act(async () => {
      fireEvent.click(screen.getByText(/@alice/));
      fireEvent.click(screen.getByText(/@alice/));
    });
    expect(likeComment).not.toHaveBeenCalled();
  });

  it('shows edit button for own comments', () => {
    const ownCv = {
      ...mockCv,
      creator: { name: 'me', actor_id: 'https://lemmy.world/u/me', avatar: undefined },
    };
    render(
      <SettingsProvider>
        <CommentItem cv={ownCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} onEdit={vi.fn()} />
      </SettingsProvider>
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('hides edit button for other users comments', () => {
    renderItem({ onEdit: vi.fn() });
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('clicking edit button calls onEdit with the comment view', () => {
    const onEdit = vi.fn();
    const ownCv = {
      ...mockCv,
      creator: { name: 'me', actor_id: 'https://lemmy.world/u/me', avatar: undefined },
    };
    render(
      <SettingsProvider>
        <CommentItem cv={ownCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} onEdit={onEdit} />
      </SettingsProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(ownCv);
  });

  it('displays overrideContent instead of original comment content', () => {
    renderItem({ overrideContent: 'Updated text' });
    expect(screen.getByText('Updated text')).toBeInTheDocument();
    expect(screen.queryByText(/Bold/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run CommentItem tests to confirm they fail**

```bash
npm test -- CommentItem.test
```

Expected: FAIL — new vote tests fail because `CommentItem` doesn't yet use `useSettings` or side detection.

- [ ] **Step 4: Update CommentItem.tsx**

Replace the entire file:

```tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from './MarkdownRenderer';
import { likeComment, resolveCommentId, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';
import { instanceFromActorId } from '../lib/urlUtils';
import CreatorAvatar from './CreatorAvatar';
import styles from './CommentItem.module.css';

interface Props {
  cv: CommentView;
  auth: AuthState;
  depth: number;
  onReply: (cv: CommentView) => void;
  onEdit?: (cv: CommentView) => void;
  overrideContent?: string;
  isHighlighted?: boolean;
}

export default function CommentItem({ cv, auth, depth, onReply, onEdit, overrideContent, isHighlighted }: Props) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [vote, setVote] = useState<1 | 0 | -1>(0);
  const [score, setScore] = useState(cv.counts.score);
  const [flash, setFlash] = useState<{ key: number; delta: 1 | -1 }>({ key: 0, delta: 1 });
  const lastTapRef = useRef<number>(0);
  const resolvedIdRef = useRef<number | null>(null);

  const isOwnComment =
    cv.creator.name === auth.username &&
    instanceFromActorId(cv.creator.actor_id ?? '') === auth.instance;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const tappedRight = e.clientX >= mid;
      const isUpvoteSide = settings.swapGestures ? !tappedRight : tappedRight;
      const targetVote: 1 | -1 = isUpvoteSide ? 1 : -1;
      const newVote: 1 | 0 | -1 = vote === targetVote ? 0 : targetVote;
      const delta = newVote - vote;
      const prevVote = vote;
      setVote(newVote);
      setScore((s) => s + delta);
      setFlash((f) => ({ key: f.key + 1, delta: delta > 0 ? 1 : -1 }));
      const doLike = async () => {
        if (resolvedIdRef.current === null) {
          const resolved = await resolveCommentId(auth.instance, auth.token, cv.comment.ap_id).catch(() => null);
          resolvedIdRef.current = resolved ?? cv.comment.id;
        }
        await likeComment(auth.instance, auth.token, resolvedIdRef.current, newVote);
      };
      doLike().catch(() => {
        setVote(prevVote);
        setScore((s) => s - delta);
      });
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div
      data-testid="comment-item"
      data-comment-id={cv.comment.id}
      className={styles.comment}
      style={{
        paddingLeft: `${16 + (depth - 1) * 14}px`,
        ...(isHighlighted ? { border: '2px solid #ff6b35', borderRadius: 8 } : {}),
      }}
      onClick={handleClick}
    >
      <div className={styles.authorRow}>
        <button
          className={styles.creatorName}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/user/${instanceFromActorId(cv.creator.actor_id)}/${cv.creator.name}`);
          }}
        >
          <CreatorAvatar name={cv.creator.name} avatar={cv.creator.avatar} size={20} />
          @{cv.creator.display_name ?? cv.creator.name}
        </button>
        <span className={vote === 1 ? styles.scoreLiked : vote === -1 ? styles.scoreDownvoted : styles.score}>
          {vote === -1 ? '▼' : '▲'} {score}
        </span>
        {flash.key > 0 && (
          <span key={flash.key} className={styles.scoreFlash}>
            {flash.delta > 0 ? '+1' : '-1'}
          </span>
        )}
      </div>
      <MarkdownRenderer
        content={overrideContent ?? cv.comment.content}
        className={styles.body}
      />
      <div className={styles.commentActions}>
        <button
          className={styles.replyButton}
          onClick={(e) => { e.stopPropagation(); onReply(cv); }}
        >
          ↩ Reply
        </button>
        {isOwnComment && onEdit && (
          <button
            className={styles.editButton}
            onClick={(e) => { e.stopPropagation(); onEdit(cv); }}
          >
            ✏ Edit
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run CommentItem tests to confirm they pass**

```bash
npm test -- CommentItem.test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CommentItem.module.css src/components/CommentItem.tsx src/components/CommentItem.test.tsx
git commit -m "feat: side-aware comment double-tap voting with swapGestures support"
```

---

## Task 5: SettingsPage — Swap Gestures card + relabel non-upvote card

**Files:**
- Modify: `src/components/SettingsPage.test.tsx`
- Modify: `src/components/SettingsPage.tsx`

- [ ] **Step 1: Write updated and new SettingsPage tests**

Replace the entire content of `src/components/SettingsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../lib/SettingsContext';
import SettingsPage from './SettingsPage';
import type React from 'react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function renderPage(props: Partial<React.ComponentProps<typeof SettingsPage>> = {}) {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <SettingsPage isAuthenticated={true} {...props} />
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  it('renders all setting sections', () => {
    renderPage();
    expect(screen.getByText('Swap Gestures')).toBeInTheDocument();
    expect(screen.getByText('Left Swipe Action')).toBeInTheDocument();
    expect(screen.getByText('Blur NSFW')).toBeInTheDocument();
    expect(screen.getByText('Default Sort')).toBeInTheDocument();
  });

  it('back button navigates to /', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('Swap Gestures On pill updates swapGestures setting', () => {
    renderPage();
    // Find On button within the Swap Gestures card (first card), not Blur NSFW
    const swapCard = screen.getByTestId('swap-gestures-card');
    fireEvent.click(within(swapCard).getByRole('button', { name: /^on$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.swapGestures).toBe(true);
  });

  it('non-upvote swipe card label is "Left Swipe Action" by default', () => {
    renderPage();
    expect(screen.getByText('Left Swipe Action')).toBeInTheDocument();
  });

  it('non-upvote swipe card label changes to "Right Swipe Action" when swapGestures is on', () => {
    renderPage();
    const swapCard = screen.getByTestId('swap-gestures-card');
    fireEvent.click(within(swapCard).getByRole('button', { name: /^on$/i }));
    expect(screen.getByText('Right Swipe Action')).toBeInTheDocument();
  });

  it('Dismiss pill updates nonUpvoteSwipeAction setting', () => {
    renderPage();
    const swipeCard = screen.getByTestId('non-upvote-swipe-card');
    fireEvent.click(within(swipeCard).getByRole('button', { name: /dismiss/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.nonUpvoteSwipeAction).toBe('dismiss');
  });

  it('Off pill in Blur NSFW card updates blurNsfw setting', () => {
    renderPage();
    const blurCard = screen.getByTestId('blur-nsfw-card');
    fireEvent.click(within(blurCard).getByRole('button', { name: /^off$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.blurNsfw).toBe(false);
  });

  it('sort pill updates defaultSort setting', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.defaultSort).toBe('Hot');
  });

  it('active sort pill has distinct styling (orange background)', () => {
    renderPage();
    const topBtn = screen.getByRole('button', { name: /top 12h/i });
    expect(topBtn).toHaveStyle({ background: '#ff6b35' });
  });

  it('renders the Anonymous Feed section', () => {
    renderPage();
    expect(screen.getByText('Anonymous Feed')).toBeInTheDocument();
  });

  it('anon instance input is empty by default', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Auto (top-ranked per sort)')).toHaveValue('');
  });

  it('typing in anon instance input persists to settings', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Auto (top-ranked per sort)');
    fireEvent.change(input, { target: { value: 'lemmy.ml' } });
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.anonInstance).toBe('lemmy.ml');
  });

  describe('Notifications section', () => {
    it('shows Enable button when permission is default', () => {
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
        writable: true, configurable: true,
      });
      renderPage();
      expect(screen.getByRole('button', { name: /enable notifications/i })).toBeInTheDocument();
    });

    it('shows On state when permission is granted', () => {
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'granted', requestPermission: vi.fn() },
        writable: true, configurable: true,
      });
      renderPage();
      expect(screen.getByText(/notifications on/i)).toBeInTheDocument();
    });

    it('shows Blocked message when permission is denied', () => {
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'denied', requestPermission: vi.fn() },
        writable: true, configurable: true,
      });
      renderPage();
      expect(screen.getByText(/blocked in browser settings/i)).toBeInTheDocument();
    });

    it('shows Log in message when not authenticated', () => {
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'default', requestPermission: vi.fn() },
        writable: true, configurable: true,
      });
      renderPage({ isAuthenticated: false });
      expect(screen.getByText(/log in to enable notifications/i)).toBeInTheDocument();
    });

    it('calls requestPermission when Enable is clicked', async () => {
      const requestPermission = vi.fn().mockResolvedValue('granted');
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'default', requestPermission },
        writable: true, configurable: true,
      });
      renderPage();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: /enable notifications/i }));
      });
      expect(requestPermission).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run SettingsPage tests to confirm they fail**

```bash
npm test -- SettingsPage.test
```

Expected: FAIL — `swap-gestures-card` and `non-upvote-swipe-card` testids don't exist yet; `Left Swipe Action` text not found.

- [ ] **Step 3: Update SettingsPage.tsx**

Replace the entire file:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../lib/SettingsContext';
import { SORT_OPTIONS } from './HeaderBar';
import InstanceInput from './InstanceInput';

interface Props {
  isAuthenticated: boolean;
  onPermissionChange?: (permission: NotificationPermission) => void;
}

export default function SettingsPage({ isAuthenticated, onPermissionChange }: Props) {
  const navigate = useNavigate();
  const { settings, updateSetting } = useSettings();

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });

  async function handleEnableNotifications() {
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    onPermissionChange?.(result);
  }

  const pillBase: React.CSSProperties = {
    border: 'none', borderRadius: 8, padding: '8px 12px',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
  };
  const active: React.CSSProperties = { ...pillBase, background: '#ff6b35', color: '#fff' };
  const inactive: React.CSSProperties = { ...pillBase, background: '#2a2d35', color: '#888' };
  const card: React.CSSProperties = {
    background: '#2a2d35', borderRadius: 12, padding: 16, marginBottom: 12,
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 10,
  };
  const descText: React.CSSProperties = { fontSize: 12, color: '#888', marginBottom: 10 };

  const swipeActionLabel = settings.swapGestures ? 'Right Swipe Action' : 'Left Swipe Action';
  const gestureDesc = settings.swapGestures
    ? 'Left swipe upvotes · Left tap upvotes'
    : 'Right swipe upvotes · Right tap upvotes';

  return (
    <div style={{ background: '#1a1d24', minHeight: '100dvh', color: '#f5f5f5' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid #2a2d35',
      }}>
        <button
          aria-label="Back"
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: 0 }}
        >
          ←
        </button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Settings</span>
      </div>

      <div style={{ padding: 16 }}>
        <div data-testid="swap-gestures-card" style={card}>
          <div style={sectionLabel}>Swap Gestures</div>
          <div style={descText}>{gestureDesc}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.swapGestures ? active : inactive}
              onClick={() => updateSetting('swapGestures', true)}
            >
              On
            </button>
            <button
              style={!settings.swapGestures ? active : inactive}
              onClick={() => updateSetting('swapGestures', false)}
            >
              Off
            </button>
          </div>
        </div>

        <div data-testid="non-upvote-swipe-card" style={card}>
          <div style={sectionLabel}>{swipeActionLabel}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.nonUpvoteSwipeAction === 'downvote' ? active : inactive}
              onClick={() => updateSetting('nonUpvoteSwipeAction', 'downvote')}
            >
              Downvote
            </button>
            <button
              style={settings.nonUpvoteSwipeAction === 'dismiss' ? active : inactive}
              onClick={() => updateSetting('nonUpvoteSwipeAction', 'dismiss')}
            >
              Dismiss
            </button>
          </div>
        </div>

        <div data-testid="blur-nsfw-card" style={card}>
          <div style={sectionLabel}>Blur NSFW</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.blurNsfw ? active : inactive}
              onClick={() => updateSetting('blurNsfw', true)}
            >
              On
            </button>
            <button
              style={!settings.blurNsfw ? active : inactive}
              onClick={() => updateSetting('blurNsfw', false)}
            >
              Off
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={sectionLabel}>Default Sort</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SORT_OPTIONS.map(({ sort, label }) => (
              <button
                key={sort}
                style={settings.defaultSort === sort ? active : inactive}
                onClick={() => updateSetting('defaultSort', sort)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={sectionLabel}>Anonymous Feed</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Instance to use for anonymous browsing. Leave empty to use the top-ranked instance per sort.
          </div>
          <InstanceInput
            placeholder="Auto (top-ranked per sort)"
            value={settings.anonInstance}
            onChange={(v) => updateSetting('anonInstance', v)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#1a1d24', border: '1px solid #3a3d45',
              borderRadius: 8, padding: '10px 12px',
              color: '#f5f5f5', fontSize: 14, fontFamily: 'inherit',
            }}
          />
        </div>

        {notifPermission !== 'unsupported' && (
          <div style={card}>
            <div style={sectionLabel}>Notifications</div>
            {!isAuthenticated ? (
              <div style={{ fontSize: 12, color: '#888' }}>Log in to enable notifications</div>
            ) : notifPermission === 'granted' ? (
              <div style={{ fontSize: 13, color: '#4caf50', fontWeight: 600 }}>Notifications on</div>
            ) : notifPermission === 'denied' ? (
              <div style={{ fontSize: 12, color: '#888' }}>Blocked in browser settings</div>
            ) : (
              <button style={inactive} onClick={handleEnableNotifications}>
                Enable notifications
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run SettingsPage tests to confirm they pass**

```bash
npm test -- SettingsPage.test
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests PASS. Zero failures.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPage.tsx src/components/SettingsPage.test.tsx
git commit -m "feat: add Swap Gestures setting, relabel non-upvote swipe card dynamically"
```
