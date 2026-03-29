# Mobile UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three mobile issues: card bottom overflow, add pull-down/ArrowDown to save posts, and fix the reply composer being hidden by the soft keyboard.

**Architecture:** (1) CSS-only height fix using `100dvh`; (2) touch event handler on the scroll container plus a `keydown` handler in FeedStack for save; (3) lift `replyTarget`/`localReplies`/`handleSubmit` from `CommentList` up to `PostCard`, render `ReplySheet` at the card root level, and apply a `visualViewport` resize listener to shift the sheet above the keyboard.

**Tech Stack:** React 18, TypeScript, framer-motion, @use-gesture/react, Vitest + @testing-library/react

---

## Notes Before You Start

- `savePost` already exists in `src/lib/lemmy.ts` — do not add it again.
- `100dvh` is the dynamic viewport height unit; it shrinks when the browser address bar hides. `100vh` does not.
- `window.visualViewport` is undefined in jsdom — mock it in any test that exercises the keyboard offset.
- The card has `overflow: hidden` and `border-radius: 20px`. ReplySheet rendered outside `.scrollContent` but inside the card root will be clipped to the rounded corners automatically.
- Tests run with `npm test`.

---

## File Map

| File | What changes |
|---|---|
| `src/components/PostCard.module.css` | Height → `100dvh`, add `.saveOverlay` |
| `src/components/PostCard.tsx` | Add `onSave` prop, pull-down gesture, save overlay, lifted reply state, ReplySheet at card root, keyboard offset |
| `src/components/FeedStack.tsx` | `100dvh`, import `savePost`, wire `onSave`, add `ArrowDown` |
| `src/components/CommentList.tsx` | Remove owned state, accept `localReplies`/`replyTarget`/`onSetReplyTarget` props |
| `src/components/ReplySheet.module.css` | `position: relative` (positioning handled by PostCard wrapper div) |
| `src/components/PostCard.test.tsx` | Add `onSave` to all renders, add pull-down test, add keyboard offset test |
| `src/components/FeedStack.test.tsx` | Add `savePost` to mock, add ArrowDown test |
| `src/components/CommentList.test.tsx` | Rewrite to pass new props via a state-holding wrapper |

---

## Task 1: Fix card height with `100dvh`

**Files:**
- Modify: `src/components/PostCard.module.css:5`
- Modify: `src/components/FeedStack.tsx:13,120`

No unit test — this is a pure CSS/layout fix. Verify visually on device.

- [ ] **Step 1: Update PostCard height**

In `src/components/PostCard.module.css`, change line 5:

```css
.card {
  position: absolute;
  width: 92vw;
  max-width: 440px;
  height: calc(100dvh - 48px);
  border-radius: 20px;
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 2: Update FeedStack container heights**

In `src/components/FeedStack.tsx`, update the two `100vh` occurrences to `100dvh`:

Line 13 (the `screenStyle` constant):
```tsx
const screenStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16 };
```

Line 120 (the main feed container):
```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PostCard.module.css src/components/FeedStack.tsx
git commit -m "fix: use 100dvh so card bottom clears the mobile browser chrome"
```

---

## Task 2: Wire `onSave` prop and `ArrowDown` shortcut

**Files:**
- Modify: `src/components/PostCard.tsx:12-19` (Props interface)
- Modify: `src/components/FeedStack.tsx` (import, keydown handler, PostCard render)
- Modify: `src/components/FeedStack.test.tsx` (add savePost mock, add test)

- [ ] **Step 1: Write the failing test**

Add to `src/components/FeedStack.test.tsx`. First, add `savePost` to the existing `vi.mock` block:

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
}));
```

Then add a new `describe` block at the bottom of the file:

```ts
describe('FeedStack keyboard shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('calls savePost and dismisses the top post when ArrowDown is pressed', async () => {
    const { savePost } = await import('../lib/lemmy');

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await screen.findByText('Test Post Title');

    fireEvent.keyDown(window, { key: 'ArrowDown' });

    expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1);
    await waitFor(() => {
      expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose FeedStack
```

Expected: FAIL — `savePost` not yet imported or called in FeedStack.

- [ ] **Step 3: Add `onSave` prop to PostCard**

In `src/components/PostCard.tsx`, update the Props interface:

```tsx
interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSave: () => void;
}
```

Update the function signature to destructure `onSave`:

```tsx
export default function PostCard({ post, auth, zIndex, scale, onSwipeRight, onSwipeLeft, onSave }: Props) {
```

- [ ] **Step 4: Wire `onSave` and `ArrowDown` in FeedStack**

In `src/components/FeedStack.tsx`, add `savePost` to the import:

```tsx
import { fetchPosts, upvotePost, downvotePost, savePost, type PostView } from '../lib/lemmy';
```

In the `handleKey` function (the `keydown` handler inside `useEffect`), add the `ArrowDown` case:

```tsx
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
```

In the `PostCard` render inside `visible.map(...)`, wire `onSave` for the top card:

```tsx
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
```

- [ ] **Step 5: Update PostCard test renders to pass `onSave`**

In `src/components/PostCard.test.tsx`, add `onSave={vi.fn()}` to every `<PostCard ... />` render. There are 4 renders in the file (2 in the first describe, 2 in the gestures describe).

Example (all four need this added):
```tsx
<PostCard
  post={MOCK_POST}
  auth={AUTH}
  zIndex={1}
  scale={1}
  onSwipeRight={vi.fn()}
  onSwipeLeft={vi.fn()}
  onSave={vi.fn()}
/>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose FeedStack PostCard
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/PostCard.tsx src/components/FeedStack.tsx src/components/FeedStack.test.tsx src/components/PostCard.test.tsx
git commit -m "feat: add ArrowDown shortcut and onSave prop to save/bookmark posts"
```

---

## Task 3: Pull-down-to-save gesture in PostCard

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.module.css`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/PostCard.test.tsx` inside the existing `describe('PostCard gestures', ...)` block. Also add `savePost` to the lemmy mock at the top (update the existing mock):

```ts
vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  savePost: vi.fn().mockResolvedValue(undefined),
}));
```

Then add the test:

```ts
it('calls onSave when scroll content is pulled down 80px from the top', () => {
  const onSave = vi.fn();
  const { getByTestId } = render(
    <PostCard
      post={MOCK_POST}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onSave={onSave}
    />
  );

  const scrollContent = getByTestId('scroll-content');
  fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(scrollContent, { touches: [{ clientY: 90 }] });
  fireEvent.touchEnd(scrollContent);

  expect(onSave).toHaveBeenCalledTimes(1);
});

it('does not call onSave when pull delta is below 80px', () => {
  const onSave = vi.fn();
  const { getByTestId } = render(
    <PostCard
      post={MOCK_POST}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onSave={onSave}
    />
  );

  const scrollContent = getByTestId('scroll-content');
  fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(scrollContent, { touches: [{ clientY: 50 }] });
  fireEvent.touchEnd(scrollContent);

  expect(onSave).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose PostCard
```

Expected: FAIL — `getByTestId('scroll-content')` not found.

- [ ] **Step 3: Add pull-down gesture to PostCard**

In `src/components/PostCard.tsx`, add the following imports at the top (after existing imports):

```tsx
import { useMemo, useEffect, useState, useRef } from 'react';
```

(`useRef` is already imported — no change needed.)

Add these state/ref declarations inside the `PostCard` component, after the existing `x` motion value:

```tsx
const scrollRef = useRef<HTMLDivElement>(null);
const touchStartY = useRef(0);
const [pullDelta, setPullDelta] = useState(0);
```

In the JSX, replace the existing `<div className={styles.scrollContent}>` opening tag with:

```tsx
<div
  ref={scrollRef}
  data-testid="scroll-content"
  className={styles.scrollContent}
  onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
  onTouchMove={(e) => {
    const delta = e.touches[0].clientY - touchStartY.current;
    if (scrollRef.current && scrollRef.current.scrollTop === 0 && delta > 0) {
      setPullDelta(delta);
    } else {
      setPullDelta(0);
    }
  }}
  onTouchEnd={() => {
    if (pullDelta >= 80) onSave();
    setPullDelta(0);
  }}
>
```

Add the save overlay just after the existing vote overlay (after `<motion.div className={styles.overlay} .../>`):

```tsx
<motion.div
  className={styles.saveOverlay}
  style={{ opacity: Math.min(pullDelta / 80, 1) }}
/>
```

- [ ] **Step 4: Add save overlay CSS**

In `src/components/PostCard.module.css`, add after the `.overlay` block:

```css
.saveOverlay {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  pointer-events: none;
  z-index: 2;
  background: rgba(34, 197, 94, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose PostCard
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.module.css src/components/PostCard.test.tsx
git commit -m "feat: pull-down-to-save gesture with green overlay indicator"
```

---

## Task 4: Lift reply state to PostCard, move ReplySheet out of scroll container

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/CommentList.tsx`
- Modify: `src/components/ReplySheet.module.css`
- Modify: `src/components/CommentList.test.tsx`
- Modify: `src/components/PostCard.test.tsx`

The goal: `ReplySheet` renders as a direct child of the card root (not inside `.scrollContent`), so it can be positioned above the keyboard. `CommentList` loses its owned state and becomes a controlled component.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/components/CommentList.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, useState } from '@testing-library/react';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import { type CommentView } from '../lib/lemmy';

vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'My reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me' },
    counts: { score: 1 },
  }),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockComments = [
  {
    comment: { id: 1, content: 'First comment', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
    creator: { name: 'alice' },
    counts: { score: 5 },
  },
  {
    comment: { id: 2, content: 'Second comment', path: '0.2', ap_id: 'https://lemmy.world/comment/2' },
    creator: { name: 'bob' },
    counts: { score: 3 },
  },
] as unknown as CommentView[];

// Wraps CommentList + ReplySheet together, holding the lifted state — mirrors what PostCard does.
function Wrapper({ onSubmit = vi.fn() }: { onSubmit?: (content: string) => Promise<void> }) {
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [localReplies] = useState<CommentView[]>([]);
  return (
    <>
      <CommentList
        comments={mockComments}
        localReplies={localReplies}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
        replyTarget={replyTarget}
        onSetReplyTarget={setReplyTarget}
      />
      <ReplySheet
        target={replyTarget}
        onSubmit={onSubmit}
        onClose={() => setReplyTarget(null)}
      />
    </>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('CommentList', () => {
  it('renders all comments', () => {
    render(<Wrapper />);
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });

  it('opens reply sheet when Reply is clicked on a comment', () => {
    render(<Wrapper />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('calls onSubmit and closes sheet on send', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<Wrapper onSubmit={onSubmit} />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onSubmit).toHaveBeenCalledWith('My reply');
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('closes the reply sheet when Cancel is clicked', () => {
    render(<Wrapper />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose CommentList
```

Expected: FAIL — `CommentList` doesn't accept `localReplies`, `replyTarget`, `onSetReplyTarget` props yet.

- [ ] **Step 3: Rewrite CommentList as a controlled component**

Replace `src/components/CommentList.tsx` entirely:

```tsx
import { useMemo } from 'react';
import { type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentItem from './CommentItem';

interface Props {
  comments: CommentView[];
  localReplies: CommentView[];
  auth: AuthState;
  postId: number;
  instance: string;
  token: string;
  replyTarget: CommentView | null;
  onSetReplyTarget: (cv: CommentView | null) => void;
}

export default function CommentList({ comments, localReplies, auth, postId: _postId, instance: _instance, token: _token, replyTarget: _replyTarget, onSetReplyTarget }: Props) {
  const items = useMemo(() => {
    const allItems = [...comments, ...localReplies];
    const childMap = new Map<string, CommentView[]>();
    const roots: CommentView[] = [];
    for (const cv of allItems) {
      const parts = cv.comment.path.split('.');
      if (parts.length === 2) {
        roots.push(cv);
      } else {
        const parentId = parts[parts.length - 2];
        if (!childMap.has(parentId)) childMap.set(parentId, []);
        childMap.get(parentId)!.push(cv);
      }
    }
    const result: CommentView[] = [];
    function collect(cv: CommentView) {
      result.push(cv);
      for (const child of childMap.get(String(cv.comment.id)) ?? []) collect(child);
    }
    for (const root of roots) collect(root);
    return result;
  }, [comments, localReplies]);

  return (
    <>
      {items.map((cv) => {
        const depth = cv.comment.path.split('.').length - 1;
        return (
          <CommentItem
            key={cv.comment.id}
            cv={cv}
            auth={auth}
            depth={depth}
            onReply={onSetReplyTarget}
          />
        );
      })}
    </>
  );
}
```

Note: `_postId`, `_instance`, `_token`, `_replyTarget` are prefixed with `_` because they are passed in the Props type for forward compatibility (PostCard passes them) but not used inside CommentList itself after this refactor. Remove the prefix if your linter flags unused params differently.

- [ ] **Step 4: Add lifted state and ReplySheet to PostCard**

In `src/components/PostCard.tsx`:

Add these imports (some already exist — only add what's missing):

```tsx
import { resolveCommentId, createComment, fetchComments, resolvePostId, type PostView, type CommentView } from '../lib/lemmy';
import ReplySheet from './ReplySheet';
```

Add these state declarations inside the `PostCard` component, after `commentsLoaded`:

```tsx
const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
```

Add the submit handler inside the `PostCard` component, before the `return`:

```tsx
const handleReplySubmit = async (content: string) => {
  const parentApId = replyTarget!.comment.ap_id;
  const parentId = await resolveCommentId(resolvedInstanceRef.current, resolvedTokenRef.current, parentApId).catch(() => null)
    ?? replyTarget!.comment.id;
  const newComment = await createComment(resolvedInstanceRef.current, resolvedTokenRef.current, p.id, content, parentId);
  const remapped = {
    ...newComment,
    comment: { ...newComment.comment, path: replyTarget!.comment.path + '.' + newComment.comment.id },
  };
  setLocalReplies((prev) => [...prev, remapped]);
  setReplyTarget(null);
};
```

Update the `<CommentList>` call to pass the new props:

```tsx
<CommentList
  comments={comments}
  localReplies={localReplies}
  auth={auth}
  postId={p.id}
  instance={auth.instance}
  token={auth.token}
  replyTarget={replyTarget}
  onSetReplyTarget={setReplyTarget}
/>
```

Add `<ReplySheet>` as a sibling to `.scrollContent` inside the card root `motion.div`, after the closing `</div>` of `.scrollContent`:

```tsx
<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
  <ReplySheet
    target={replyTarget}
    onSubmit={handleReplySubmit}
    onClose={() => setReplyTarget(null)}
  />
</div>
```

- [ ] **Step 5: Update ReplySheet positioning**

In `src/components/ReplySheet.module.css`, replace the `.sheet` rule:

```css
.sheet {
  position: relative;
  background: var(--card-bg);
  border-top: 2px solid var(--accent);
  border-radius: 12px 12px 0 0;
  padding: 12px 16px;
  transform: translateY(100%);
  transition: transform 0.25s ease;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose CommentList PostCard
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/PostCard.tsx src/components/CommentList.tsx src/components/ReplySheet.module.css src/components/CommentList.test.tsx src/components/PostCard.test.tsx
git commit -m "refactor: lift reply state to PostCard so ReplySheet renders outside scroll container"
```

---

## Task 5: Keyboard offset — shift ReplySheet above the soft keyboard

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/PostCard.test.tsx`:

```ts
describe('PostCard reply keyboard offset', () => {
  beforeEach(() => {
    // Mock visualViewport — jsdom doesn't implement it
    const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
    const vv = {
      height: 800,
      offsetTop: 0,
      addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners[type] = listeners[type] ?? [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners[type] = (listeners[type] ?? []).filter(f => f !== fn);
      },
      _fire: (type: string) => {
        for (const fn of listeners[type] ?? []) {
          if (typeof fn === 'function') fn(new Event(type));
          else fn.handleEvent(new Event(type));
        }
      },
    };
    vi.stubGlobal('innerHeight', 812);
    vi.stubGlobal('visualViewport', vv);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shifts the ReplySheet wrapper bottom up when keyboard appears', async () => {
    const { getByTestId, getAllByRole } = render(
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

    // Simulate a comment to reply to by directly triggering reply (no real comments in mock)
    // This test verifies the wrapper div responds to visualViewport resize.
    // We access the reply wrapper div by test id.
    const replyWrapper = getByTestId('reply-wrapper');
    expect(replyWrapper).toHaveStyle('bottom: 0px');

    // Simulate keyboard appearing: viewport shrinks from 812 to 412 (400px keyboard)
    (window.visualViewport as any).height = 412;
    (window.visualViewport as any)._fire('resize');

    await waitFor(() => {
      expect(replyWrapper).toHaveStyle('bottom: 400px');
    });
  });
});
```

Add `import { waitFor } from '@testing-library/react';` to the imports at the top if not already present (it's already imported via `render, screen, fireEvent`).

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose PostCard
```

Expected: FAIL — `getByTestId('reply-wrapper')` not found.

- [ ] **Step 3: Add keyboard offset logic to PostCard**

In `src/components/PostCard.tsx`, add this state after the existing `localReplies` state:

```tsx
const [keyboardOffset, setKeyboardOffset] = useState(0);
```

Add this `useEffect` after the comment-loading `useEffect`:

```tsx
useEffect(() => {
  if (!replyTarget || !window.visualViewport) return;
  const vv = window.visualViewport;
  const handler = () => {
    setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
  };
  vv.addEventListener('resize', handler);
  handler();
  return () => {
    vv.removeEventListener('resize', handler);
    setKeyboardOffset(0);
  };
}, [replyTarget]);
```

Update the ReplySheet wrapper div to use `keyboardOffset` and add the test id:

```tsx
<div
  data-testid="reply-wrapper"
  style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardOffset }}
>
  <ReplySheet
    target={replyTarget}
    onSubmit={handleReplySubmit}
    onClose={() => setReplyTarget(null)}
  />
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose PostCard
```

Expected: all pass.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.test.tsx
git commit -m "feat: shift reply sheet above soft keyboard using visualViewport resize"
```

---

## Self-Review

**Spec coverage:**
- Card bottom overflow (dvh) → Task 1 ✓
- Pull-down gesture (80px threshold, save overlay) → Task 3 ✓
- ArrowDown keyboard shortcut → Task 2 ✓
- `savePost` API → already exists in `lemmy.ts`, no task needed ✓
- Lift replyTarget/localReplies/handleSubmit to PostCard → Task 4 ✓
- ReplySheet outside scrollContent, position: absolute → Task 4 ✓
- visualViewport resize listener for keyboard offset → Task 5 ✓

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:**
- `onSave: () => void` defined in Task 2, used in Task 3 test and Task 5 test renders ✓
- `localReplies: CommentView[]` defined in Task 4 CommentList Props, passed from PostCard ✓
- `replyTarget: CommentView | null` consistent across PostCard state and CommentList Props ✓
- `onSetReplyTarget: (cv: CommentView | null) => void` consistent ✓
- `handleReplySubmit` defined in Task 4, passed as `onSubmit` to ReplySheet ✓
- `data-testid="scroll-content"` added in Task 3, used in Task 3 tests ✓
- `data-testid="reply-wrapper"` added in Task 5, used in Task 5 tests ✓
- `savePost` imported in `FeedStack` in Task 2; already exists in `lemmy.ts` ✓
