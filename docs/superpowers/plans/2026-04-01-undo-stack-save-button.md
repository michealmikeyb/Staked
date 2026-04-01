# Undo Stack, Save Button & Header Stats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pull-down-to-save gesture with a session undo stack that restores dismissed cards one-by-one with a slide-in-from-top animation; add an explicit Save button to the card footer; move score/comment stats to the meta header.

**Architecture:** `FeedStack` gains `undoStack: PostView[]` and `returningPostId: number | null`. `PostCard` gets two new props (`onUndo` for pull-down, `onSave` for the footer button), a restructured footer (Save · Share · Comment), stats moved to the meta header, an `isReturning` entrance animation, and a sky-blue undo overlay.

**Tech Stack:** React 18, TypeScript, Framer Motion (`motion.div`, `initial`/`animate`), `@use-gesture/react`, Vitest + @testing-library/react

---

### Task 1: Rename pull-down prop, add save prop, restructure PostCard

Rename the pull-down callback from `onSave` → `onUndo`. Add a separate `onSave` prop for the footer button. Move score/comments to the meta header. Replace the footer with three evenly-spaced action buttons.

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.module.css`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1.1: Write failing tests**

Add/replace these tests in `src/components/PostCard.test.tsx`.

First, update every existing `render(<PostCard ... onSave={vi.fn()} />)` call to pass **both** `onUndo={vi.fn()}` and `onSave={vi.fn()}` (the old `onSave` becomes `onUndo`; the new `onSave` is the button).

Then add the following new/replacement tests in the existing `PostCard gestures` describe:

```tsx
// Replace "calls onSave when scroll content is pulled down 80px from the top"
it('calls onUndo when scroll content is pulled down 80px from the top', () => {
  const onUndo = vi.fn();
  const { getByTestId } = render(
    <PostCard
      post={MOCK_POST}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onUndo={onUndo}
      onSave={vi.fn()}
    />
  );
  const scrollContent = getByTestId('scroll-content');
  fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(scrollContent, { touches: [{ clientY: 90 }] });
  fireEvent.touchEnd(scrollContent);
  expect(onUndo).toHaveBeenCalledTimes(1);
});

// Replace "does not call onSave when pull delta is below 80px"
it('does not call onUndo when pull delta is below 80px', () => {
  const onUndo = vi.fn();
  const { getByTestId } = render(
    <PostCard
      post={MOCK_POST}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onUndo={onUndo}
      onSave={vi.fn()}
    />
  );
  const scrollContent = getByTestId('scroll-content');
  fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(scrollContent, { touches: [{ clientY: 50 }] });
  fireEvent.touchEnd(scrollContent);
  expect(onUndo).not.toHaveBeenCalled();
});
```

Add these new tests in a new `PostCard save button` describe block:

```tsx
describe('PostCard save button', () => {
  it('renders a Save button in the footer', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('calls onSave when the save button is tapped', () => {
    const onSave = vi.fn();
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId('save-button'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows Saved toast after save button is tapped', async () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });
});
```

Add these new tests in a new `PostCard header stats` describe block:

```tsx
describe('PostCard header stats', () => {
  it('renders score in the meta header', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('meta-score')).toHaveTextContent('▲ 200');
  });

  it('renders comment count in the meta header', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('meta-comments')).toHaveTextContent('💬 15');
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
npm test -- --run PostCard
```

Expected: new tests fail (props/elements not yet renamed/added).

- [ ] **Step 1.3: Update `PostCard.tsx`**

Replace the `Props` interface:

```tsx
interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onUndo: () => void;
  onSave: () => void;
}
```

Update the function signature:

```tsx
export default function PostCard({ post, auth, zIndex, scale, onSwipeRight, onSwipeLeft, onUndo, onSave }: Props) {
```

Add save toast state (alongside existing state declarations):

```tsx
const [saveToastVisible, setSaveToastVisible] = useState(false);
```

Update the pull-down `onTouchEnd` handler (the only place `onSave` was called):

```tsx
onTouchEnd={() => {
  if (pullDelta >= 80) onUndo();
  setPullDelta(0);
}}
```

Replace the `.meta` div to include stats on the right:

```tsx
<div className={styles.meta}>
  <div className={styles.communityIcon}>{community.name.charAt(0).toUpperCase()}</div>
  <div>
    <div
      className={styles.communityName}
      style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/community/${instance}/${community.name}`)}
    >
      c/{community.name}
    </div>
    <div className={styles.instanceName}>{instance}</div>
    <button
      className={styles.creatorLink}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/user/${instanceFromActorId(creator.actor_id)}/${creator.name}`);
      }}
    >
      <CreatorAvatar name={creator.name} avatar={creator.avatar} size={16} />
      {creator.display_name ?? creator.name}
    </button>
  </div>
  <div className={styles.metaStats}>
    <span data-testid="meta-score">▲ {counts.score}</span>
    <span data-testid="meta-comments">💬 {counts.comments}</span>
  </div>
</div>
```

Replace the `.footer` div:

```tsx
<div className={styles.footer}>
  <button
    data-testid="save-button"
    className={styles.footerAction}
    onClick={(e) => { e.stopPropagation(); onSave(); setSaveToastVisible(true); }}
  >
    🔖 Save
  </button>
  <button
    data-testid="share-button"
    className={styles.footerAction}
    onClick={handleShare}
  >
    Share ↗
  </button>
  <button
    data-testid="comment-button"
    className={styles.footerAction}
    onClick={(e) => { e.stopPropagation(); setSheetState({ mode: 'new' }); }}
  >
    💬 Comment
  </button>
</div>
```

Add the save toast alongside the existing share toast (just before the closing `</motion.div>`):

```tsx
<Toast message="Saved" visible={saveToastVisible} onHide={() => setSaveToastVisible(false)} />
```

- [ ] **Step 1.4: Update `PostCard.module.css`**

Add after the `.meta` rule:

```css
.metaStats {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  font-size: 0.8rem;
  color: var(--accent);
  flex-shrink: 0;
}
```

Replace the `.footer` rule:

```css
.footer {
  padding: 10px 16px 16px;
  display: flex;
  border-bottom: 1px solid var(--border);
}
```

Add new `.footerAction` rule:

```css
.footerAction {
  flex: 1;
  text-align: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 1.5: Update `FeedStack.tsx` to use `onUndo`/`onSave`**

In the `PostCard` render inside `FeedStack`, change the props:

```tsx
onUndo={isTop ? () => {} : () => {}}  // placeholder — real handler added in Task 3
onSave={isTop ? () => {
  savePost(auth.instance, auth.token, post.post.id).catch(() => {});
} : () => {}}
```

Also remove the old `onSave` prop from the render (it is now `onUndo`).

> Note: `onUndo` is temporarily a no-op here. Task 3 wires up the real undo stack.

- [ ] **Step 1.6: Run tests to verify they pass**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 1.7: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.module.css src/components/PostCard.test.tsx src/components/FeedStack.tsx
git commit -m "feat: rename pull-down to onUndo, add save button, move stats to header"
```

---

### Task 2: Update pull-down undo overlay

Change the pull-down overlay from green ("save") to sky blue with a ↩ icon ("undo").

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.module.css`

- [ ] **Step 2.1: Rename `.saveOverlay` → `.undoOverlay` in CSS**

In `PostCard.module.css`, replace the `.saveOverlay` rule:

```css
.undoOverlay {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  pointer-events: none;
  z-index: 2;
  background: rgba(14, 165, 233, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2.2: Update the overlay JSX in `PostCard.tsx`**

Replace the `saveOverlay` motion div:

```tsx
<motion.div
  className={styles.undoOverlay}
  style={{ opacity: Math.min(pullDelta / 80, 1) }}
>
  <span style={{ fontSize: '3rem' }}>↩</span>
</motion.div>
```

- [ ] **Step 2.3: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass (overlay is visual-only; no test covers color or icon).

- [ ] **Step 2.4: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.module.css
git commit -m "feat: update pull-down overlay to sky-blue undo indicator"
```

---

### Task 3: Undo stack in FeedStack

Add `undoStack`, wire `handleUndo`, update keyboard shortcut, pass real props to PostCard.

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 3.1: Write failing tests**

In `FeedStack.test.tsx`, replace the existing `FeedStack keyboard shortcuts` describe block entirely:

```tsx
describe('FeedStack keyboard shortcuts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('ArrowDown with empty undo stack does nothing', async () => {
    const { fetchPosts, savePost } = await import('../lib/lemmy');
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

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post Title');

    fireEvent.keyDown(window, { key: 'ArrowDown' });

    expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    expect(savePost).not.toHaveBeenCalled();
  });

  it('ArrowDown restores the last dismissed post', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          post: { id: 1, name: 'First Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 10, comments: 0 },
        },
        {
          post: { id: 2, name: 'Second Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/2' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 5, comments: 0 },
        },
      ])
      .mockResolvedValue([]);

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('First Post');

    // Dismiss first post via right arrow (upvote + dismiss)
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('First Post')).not.toBeInTheDocument());

    // Undo — first post should return
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByText('First Post')).toBeInTheDocument());
  });

  it('ArrowDown can undo multiple times', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          post: { id: 1, name: 'First Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 10, comments: 0 },
        },
        {
          post: { id: 2, name: 'Second Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/2' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 5, comments: 0 },
        },
        {
          post: { id: 3, name: 'Third Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/3' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 3, comments: 0 },
        },
      ])
      .mockResolvedValue([]);

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('First Post');

    // Dismiss first two posts
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('First Post')).not.toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('Second Post')).not.toBeInTheDocument());

    // Undo twice — second post returns first, then first post
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByText('Second Post')).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByText('First Post')).toBeInTheDocument());
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
npm test -- --run FeedStack
```

Expected: new undo tests fail.

- [ ] **Step 3.3: Update `FeedStack.tsx`**

Add `undoStack` state alongside existing state declarations:

```tsx
const [undoStack, setUndoStack] = useState<PostView[]>([]);
```

Update `dismissTop` to push to the stack before slicing:

```tsx
function dismissTop(postId: number) {
  setPosts((prev) => {
    if (prev.length > 0) {
      setUndoStack((stack) => [...stack, prev[0]]);
    }
    return prev.slice(1);
  });
  if (!community) addSeen(postId);
  seenRef.current.add(postId);
}
```

Add `handleUndo` after `dismissTop`:

```tsx
function handleUndo() {
  setUndoStack((stack) => {
    if (stack.length === 0) return stack;
    const post = stack[stack.length - 1];
    setPosts((prev) => [post, ...prev]);
    return stack.slice(0, -1);
  });
}
```

Update the keyboard shortcut handler — replace the `ArrowDown` case:

```tsx
} else if (e.key === 'ArrowDown') {
  handleUndo();
}
```

Update the `PostCard` render to pass `onUndo`:

```tsx
onUndo={isTop ? handleUndo : () => {}}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: add undo stack — pull-down and ArrowDown restore last dismissed card"
```

---

### Task 4: Card entrance animation

When a card is restored via undo, it slides in from above the viewport.

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 4.1: Write failing test**

Add to `FeedStack.test.tsx`, inside the `FeedStack keyboard shortcuts` describe:

```tsx
it('restored card is marked isReturning (rendered with entrance animation props)', async () => {
  // We verify this indirectly: after undo the card is visible.
  // The entrance animation is visual-only and cannot be asserted in jsdom —
  // this test guards that the undo render completes without error.
  const { fetchPosts } = await import('../lib/lemmy');
  (fetchPosts as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce([
      {
        post: { id: 1, name: 'Animated Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
        community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
      {
        post: { id: 2, name: 'Second Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/2' },
        community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
        creator: { name: 'alice' },
        counts: { score: 5, comments: 0 },
      },
    ])
    .mockResolvedValue([]);

  render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
  await screen.findByText('Animated Post');
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  await waitFor(() => expect(screen.queryByText('Animated Post')).not.toBeInTheDocument());
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  await waitFor(() => expect(screen.getByText('Animated Post')).toBeInTheDocument());
  // No error thrown — animation props accepted by framer-motion without crashing.
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
npm test -- --run FeedStack
```

Expected: the new test may pass already (it's a smoke test), but the animation props don't exist yet — run to confirm baseline.

- [ ] **Step 4.3: Add `isReturning` and `onReturnAnimationComplete` props to `PostCard.tsx`**

Update the `Props` interface:

```tsx
interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onUndo: () => void;
  onSave: () => void;
  isReturning?: boolean;
  onReturnAnimationComplete?: () => void;
}
```

Update the function signature:

```tsx
export default function PostCard({
  post, auth, zIndex, scale,
  onSwipeRight, onSwipeLeft, onUndo, onSave,
  isReturning = false,
  onReturnAnimationComplete,
}: Props) {
```

Add the returning motion props just before the `return` statement:

```tsx
const returningMotionProps = isReturning
  ? {
      initial: { y: '-110vh' },
      animate: { y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
      onAnimationComplete: onReturnAnimationComplete,
    }
  : {};
```

Apply them to the root `motion.div`:

```tsx
<motion.div
  className={styles.card}
  style={{ zIndex, x, rotate, scale }}
  {...returningMotionProps}
  {...(bind() as object)}
>
```

- [ ] **Step 4.4: Add `returningPostId` to `FeedStack.tsx`**

Add state alongside existing state declarations:

```tsx
const [returningPostId, setReturningPostId] = useState<number | null>(null);
```

Update `handleUndo` to set `returningPostId`:

```tsx
function handleUndo() {
  setUndoStack((stack) => {
    if (stack.length === 0) return stack;
    const post = stack[stack.length - 1];
    setPosts((prev) => [post, ...prev]);
    setReturningPostId(post.post.id);
    return stack.slice(0, -1);
  });
}
```

Update the `PostCard` render to pass the animation props:

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
  onUndo={isTop ? handleUndo : () => {}}
  onSave={isTop ? () => {
    savePost(auth.instance, auth.token, post.post.id).catch(() => {});
  } : () => {}}
  isReturning={isTop && post.post.id === returningPostId}
  onReturnAnimationComplete={
    isTop && post.post.id === returningPostId
      ? () => setReturningPostId(null)
      : undefined
  }
/>
```

- [ ] **Step 4.5: Run all tests**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 4.6: Commit**

```bash
git add src/components/PostCard.tsx src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: slide-in-from-top animation for restored cards"
```
