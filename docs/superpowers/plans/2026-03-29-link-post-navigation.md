# Link Post Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a tappable link banner on PostCard for link posts (non-image `post.url`), opening the URL in a new tab.

**Architecture:** Two files change — `PostCard.tsx` adds a conditional banner element with local `isPressed` state, and `PostCard.module.css` adds the banner styles. No new components.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest + @testing-library/react

---

## File Map

- Modify: `src/components/PostCard.tsx` — add `isPressed` state + conditional banner render
- Modify: `src/components/PostCard.module.css` — add `.linkBanner`, `.linkBannerPressed`, `.linkBannerDomain`, `.linkBannerHint`
- Modify: `src/components/PostCard.test.tsx` — add banner tests

---

### Task 1: Write failing tests for the link banner

**Files:**
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Append a new describe block to `PostCard.test.tsx`**

Add this after the existing `describe` blocks (before the final closing of the file):

```ts
describe('PostCard link banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const LINK_POST = {
    post: { id: 2, name: 'Link post', body: null, url: 'https://techcrunch.com/article', thumbnail_url: null },
    community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
    creator: { name: 'carol' },
    counts: { score: 50, comments: 5 },
  } as unknown as PostView;

  const IMAGE_POST = {
    post: { id: 3, name: 'Image post', body: null, url: 'https://example.com/photo.jpg', thumbnail_url: null },
    community: { name: 'pics', actor_id: 'https://lemmy.world/c/pics' },
    creator: { name: 'dave' },
    counts: { score: 10, comments: 0 },
  } as unknown as PostView;

  const TEXT_POST = {
    post: { id: 4, name: 'Text post', body: 'Hello world', url: null, thumbnail_url: null },
    community: { name: 'general', actor_id: 'https://lemmy.world/c/general' },
    creator: { name: 'eve' },
    counts: { score: 3, comments: 1 },
  } as unknown as PostView;

  it('renders the link banner for a link post', () => {
    render(
      <PostCard post={LINK_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByTestId('link-banner')).toBeInTheDocument();
  });

  it('shows the extracted domain in the banner', () => {
    render(
      <PostCard post={LINK_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.getByText('techcrunch.com')).toBeInTheDocument();
  });

  it('does not render the banner for an image URL post', () => {
    render(
      <PostCard post={IMAGE_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.queryByTestId('link-banner')).not.toBeInTheDocument();
  });

  it('does not render the banner for a text post', () => {
    render(
      <PostCard post={TEXT_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onSave={vi.fn()} />
    );
    expect(screen.queryByTestId('link-banner')).not.toBeInTheDocument();
  });

  it('opens the link in a new tab when the banner is clicked', () => {
    render(
      <PostCard post={LINK_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onSave={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('link-banner'));
    expect(window.open).toHaveBeenCalledWith(
      'https://techcrunch.com/article',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- --reporter=verbose PostCard
```

Expected: 5 new tests fail with errors like `Unable to find an element by: [data-testid="link-banner"]`.

---

### Task 2: Add CSS for the link banner

**Files:**
- Modify: `src/components/PostCard.module.css`

- [ ] **Step 1: Append banner styles to `PostCard.module.css`**

Add at the end of the file:

```css
.linkBanner {
  margin: 0 16px 10px;
  background: #252525;
  border: 1px solid #333;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.linkBannerPressed {
  background: rgba(255, 107, 53, 0.12);
  border-color: rgba(255, 107, 53, 0.4);
}

.linkBannerPressed .linkBannerDomain {
  color: var(--accent);
}

.linkBannerIcon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.linkBannerDomain {
  flex: 1;
  font-size: 0.75rem;
  color: #ccc;
  font-weight: 500;
}

.linkBannerHint {
  font-size: 0.65rem;
  color: #555;
  margin-top: 2px;
}

.linkBannerArrow {
  font-size: 0.8rem;
  color: var(--accent);
}
```

No tests needed for pure CSS. Move on.

---

### Task 3: Implement the link banner in PostCard.tsx

**Files:**
- Modify: `src/components/PostCard.tsx`

- [ ] **Step 1: Add `isLinkBannerPressed` state**

After the existing `useState` declarations (around line 52), add:

```ts
const [isLinkBannerPressed, setIsLinkBannerPressed] = useState(false);
```

- [ ] **Step 2: Compute whether to show the banner**

After the `imageSrc` line (line 190), add:

```ts
const showLinkBanner = !!p.url && !isImageUrl(p.url);
```

- [ ] **Step 3: Insert the banner element in the JSX**

In the JSX, after `<div className={styles.title}>{p.name}</div>` (line 243) and before the `{imageSrc && ...}` line, add:

```tsx
{showLinkBanner && (
  <div
    data-testid="link-banner"
    className={`${styles.linkBanner}${isLinkBannerPressed ? ` ${styles.linkBannerPressed}` : ''}`}
    onPointerDown={() => setIsLinkBannerPressed(true)}
    onPointerUp={() => setIsLinkBannerPressed(false)}
    onPointerLeave={() => setIsLinkBannerPressed(false)}
    onClick={() => window.open(p.url!, '_blank', 'noopener,noreferrer')}
  >
    <span className={styles.linkBannerIcon}>🔗</span>
    <div>
      <div className={styles.linkBannerDomain}>{new URL(p.url!).hostname}</div>
      <div className={styles.linkBannerHint}>Tap to open link</div>
    </div>
    <span className={styles.linkBannerArrow}>↗</span>
  </div>
)}
```

---

### Task 4: Verify tests pass and commit

**Files:** none new

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass, including the 5 new banner tests.

- [ ] **Step 2: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.module.css src/components/PostCard.test.tsx
git commit -m "feat: add link banner to PostCard for link posts"
```
