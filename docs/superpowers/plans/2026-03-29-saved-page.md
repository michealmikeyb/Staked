# Saved Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Saved Posts page with infinite scroll, a shared hamburger `MenuDrawer`, a shared `PostDetailCard`, and a `SavedPostDetailPage` with full reply support.

**Architecture:** Extract the duplicated drawer and post-detail card layout into shared components first, then wire the new Saved route on top. Each task is independently testable and committable.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + @testing-library/react, lemmy-js-client, react-router-dom v6, PostCard.module.css (shared CSS).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/components/MenuDrawer.tsx` | HeaderBar wrapper + hamburger drawer; owns open/close state |
| Create | `src/components/MenuDrawer.test.tsx` | Tests for MenuDrawer |
| Create | `src/components/PostDetailCard.tsx` | Shared scrollable card body (meta, image, comments, reply sheet) |
| Create | `src/components/PostDetailCard.test.tsx` | Tests for PostDetailCard |
| Create | `src/components/SavedPage.tsx` | `/saved` route — infinite-scroll list of saved posts |
| Create | `src/components/SavedPage.test.tsx` | Tests for SavedPage |
| Create | `src/components/SavedPostDetailPage.tsx` | `/saved/:postId` — full card view with reply support |
| Create | `src/components/SavedPostDetailPage.test.tsx` | Tests for SavedPostDetailPage |
| Modify | `src/lib/lemmy.ts` | Add `fetchSavedPosts` |
| Modify | `src/lib/lemmy.test.ts` | Test `fetchSavedPosts` |
| Modify | `src/components/FeedStack.tsx` | Swap inline drawer for `<MenuDrawer>` |
| Modify | `src/components/FeedStack.test.tsx` | Update drawer tests to navigate to `/saved` |
| Modify | `src/components/InboxPage.tsx` | Swap inline drawer for `<MenuDrawer>` |
| Modify | `src/components/InboxPage.test.tsx` | No changes needed (drawer tests not present) |
| Modify | `src/components/PostDetailPage.tsx` | Swap drawer + extract card body into `<PostDetailCard>` |
| Modify | `src/App.tsx` | Add `/saved` and `/saved/:postId` routes |

---

## Task 1: Add `fetchSavedPosts` to lemmy.ts

**Files:**
- Modify: `src/lib/lemmy.ts`
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/lib/lemmy.test.ts` and add at the end:

```ts
describe('fetchSavedPosts', () => {
  it('calls getPosts with type_ Saved and returns posts', async () => {
    const mockPost = {
      post: { id: 1, name: 'Saved Post', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null },
      community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
      creator: { name: 'alice', display_name: null },
      counts: { score: 10, comments: 2, child_count: 2 },
    };
    const mockClient = {
      getPosts: vi.fn().mockResolvedValue({ posts: [mockPost] }),
    };
    vi.spyOn(LemmyHttp.prototype, 'getPosts').mockImplementation(mockClient.getPosts);

    const { fetchSavedPosts } = await import('./lemmy');
    const result = await fetchSavedPosts('lemmy.world', 'mytoken', 1);

    expect(mockClient.getPosts).toHaveBeenCalledWith({
      type_: 'Saved',
      sort: 'New',
      page: 1,
      limit: 20,
    });
    expect(result).toEqual([mockPost]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: FAIL — `fetchSavedPosts is not a function`

- [ ] **Step 3: Add `fetchSavedPosts` to `src/lib/lemmy.ts`**

Add after the `savePost` function (around line 57):

```ts
export async function fetchSavedPosts(
  instance: string,
  token: string,
  page: number,
): Promise<PostView[]> {
  const res = await client(instance, token).getPosts({
    type_: 'Saved',
    sort: 'New',
    page,
    limit: 20,
  });
  return res.posts;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add fetchSavedPosts to lemmy API client"
```

---

## Task 2: Create `MenuDrawer` component

**Files:**
- Create: `src/components/MenuDrawer.tsx`
- Create: `src/components/MenuDrawer.test.tsx`

`MenuDrawer` wraps `HeaderBar`, owns open/close state, renders the overlay + 3-button grid. It replaces the duplicated inline drawer in FeedStack, InboxPage, and PostDetailPage.

- [ ] **Step 1: Write the failing tests**

Create `src/components/MenuDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuDrawer from './MenuDrawer';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => { vi.clearAllMocks(); });

function renderDrawer(props: Partial<React.ComponentProps<typeof MenuDrawer>> = {}) {
  return render(
    <MemoryRouter>
      <MenuDrawer onNavigate={mockNavigate} {...props} />
    </MemoryRouter>,
  );
}

describe('MenuDrawer', () => {
  it('renders the HeaderBar', () => {
    renderDrawer();
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('drawer is closed by default', () => {
    renderDrawer();
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('opens drawer when menu button is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inbox/i })).toBeInTheDocument();
  });

  it('closes drawer when menu button is clicked again', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('closes drawer when overlay is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByTestId('drawer-overlay'));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('calls onNavigate with /saved and closes drawer when Saved is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /saved/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/saved');
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('calls onNavigate with /inbox and closes drawer when Inbox is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /inbox/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/inbox');
    expect(screen.queryByRole('button', { name: /inbox/i })).not.toBeInTheDocument();
  });

  it('closes drawer when Profile is clicked (no-op nav)', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /profile/i }));
    expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows unread badge on Inbox button when unreadCount > 0', () => {
    renderDrawer({ unreadCount: 3 });
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByTestId('inbox-badge')).toBeInTheDocument();
  });

  it('hides inbox badge when unreadCount is 0', () => {
    renderDrawer({ unreadCount: 0 });
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByTestId('inbox-badge')).not.toBeInTheDocument();
  });

  it('renders centerContent via HeaderBar', () => {
    renderDrawer({ centerContent: <span>Custom Center</span> });
    expect(screen.getByText('Custom Center')).toBeInTheDocument();
  });

  it('calls onLogoClick when logo is clicked', () => {
    const spy = vi.fn();
    renderDrawer({ onLogoClick: spy });
    fireEvent.click(screen.getByText('S'));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/MenuDrawer.test.tsx
```

Expected: FAIL — `Cannot find module './MenuDrawer'`

- [ ] **Step 3: Create `src/components/MenuDrawer.tsx`**

```tsx
import { useState } from 'react';
import { type SortType } from '../lib/lemmy';
import HeaderBar from './HeaderBar';

interface Props {
  onNavigate: (route: string) => void;
  centerContent?: React.ReactNode;
  onLogoClick?: () => void;
  leftContent?: React.ReactNode;
  sortType?: SortType;
  onSortChange?: (sort: SortType) => void;
  unreadCount?: number;
}

export default function MenuDrawer({
  onNavigate,
  centerContent,
  onLogoClick,
  leftContent,
  sortType,
  onSortChange,
  unreadCount = 0,
}: Props) {
  const [showDrawer, setShowDrawer] = useState(false);

  function handleNavigate(route: string) {
    setShowDrawer(false);
    onNavigate(route);
  }

  const drawerButtonStyle: React.CSSProperties = {
    background: '#2a2d35', border: 'none', borderRadius: 12,
    cursor: 'pointer', padding: '14px 8px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    color: '#f5f5f5', fontSize: 12, fontWeight: 500,
    position: 'relative',
  };

  return (
    <>
      <HeaderBar
        sortType={sortType}
        onSortChange={onSortChange}
        onMenuOpen={() => setShowDrawer((v) => !v)}
        onLogoClick={onLogoClick}
        centerContent={centerContent}
        leftContent={leftContent}
      />
      {showDrawer && (
        <>
          <div
            data-testid="drawer-overlay"
            onClick={() => setShowDrawer(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '1px solid #2a2d35',
            zIndex: 40, padding: 16,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <button
                onClick={() => handleNavigate('/saved')}
                style={drawerButtonStyle}
              >
                <span style={{ fontSize: 22 }}>🔖</span>
                Saved
              </button>
              <button
                onClick={() => setShowDrawer(false)}
                style={drawerButtonStyle}
              >
                <span style={{ fontSize: 22 }}>👤</span>
                Profile
              </button>
              <button
                onClick={() => handleNavigate('/inbox')}
                style={drawerButtonStyle}
              >
                {unreadCount > 0 && (
                  <span
                    data-testid="inbox-badge"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: '#ff6b35', color: '#fff',
                      borderRadius: '50%', minWidth: 18, height: 18,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
                <span style={{ fontSize: 22 }}>📬</span>
                Inbox
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/MenuDrawer.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MenuDrawer.tsx src/components/MenuDrawer.test.tsx
git commit -m "feat: add MenuDrawer shared component"
```

---

## Task 3: Refactor `FeedStack` to use `MenuDrawer`

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 1: Update FeedStack.tsx**

In `src/components/FeedStack.tsx`:

1. Add the import:
```ts
import MenuDrawer from './MenuDrawer';
```

2. Remove the `DRAWER_ITEMS` constant at the top.

3. Remove `const [showDrawer, setShowDrawer] = useState(false);` from the component body.

4. In the `return` JSX, replace:
```tsx
<HeaderBar sortType={sortType} onSortChange={handleSortChange} onMenuOpen={() => setShowDrawer((v) => !v)} onLogoClick={() => navigate('/')} />
```
with:
```tsx
<MenuDrawer
  sortType={sortType}
  onSortChange={handleSortChange}
  onNavigate={navigate}
  onLogoClick={() => navigate('/')}
  unreadCount={unreadCount}
/>
```

5. Remove the entire `{showDrawer && (...)}` block (the overlay div + the drawer panel with all the buttons) from the return JSX — this is now inside MenuDrawer.

6. Remove the `HeaderBar` import (it's now only used inside MenuDrawer):
```ts
// remove: import HeaderBar from './HeaderBar';
```

- [ ] **Step 2: Update FeedStack.test.tsx — add Saved navigation test**

In `src/components/FeedStack.test.tsx`, find the `'drawer navigation'` describe block and add a test after the existing inbox navigation test:

```ts
it('navigates to /saved when Saved button is clicked', async () => {
  render(
    <FeedStack auth={AUTH} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />,
  );
  await screen.findByText('Test Post Title');
  fireEvent.click(screen.getByLabelText('Menu'));
  fireEvent.click(screen.getByText('Saved'));
  expect(mockNavigate).toHaveBeenCalledWith('/saved');
});
```

- [ ] **Step 3: Run all FeedStack tests**

```bash
npm test -- --reporter=verbose src/components/FeedStack.test.tsx
```

Expected: all tests PASS (the existing drawer/badge tests still pass because MenuDrawer provides identical DOM structure)

- [ ] **Step 4: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "refactor: use MenuDrawer in FeedStack"
```

---

## Task 4: Refactor `InboxPage` to use `MenuDrawer`

**Files:**
- Modify: `src/components/InboxPage.tsx`

- [ ] **Step 1: Update InboxPage.tsx**

1. Add the import:
```ts
import MenuDrawer from './MenuDrawer';
```

2. Remove `const [showDrawer, setShowDrawer] = useState(false);` from the component body.

3. In the `return` JSX, replace:
```tsx
<HeaderBar onMenuOpen={() => setShowDrawer((v) => !v)} onLogoClick={() => navigate('/')} centerContent={filterToggle} />
```
with:
```tsx
<MenuDrawer
  onNavigate={navigate}
  onLogoClick={() => navigate('/')}
  centerContent={filterToggle}
/>
```

4. Remove the entire `{showDrawer && (...)}` block from the return JSX.

5. Remove the `HeaderBar` import.

- [ ] **Step 2: Run all InboxPage tests**

```bash
npm test -- --reporter=verbose src/components/InboxPage.test.tsx
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/InboxPage.tsx
git commit -m "refactor: use MenuDrawer in InboxPage"
```

---

## Task 5: Create `PostDetailCard` component

**Files:**
- Create: `src/components/PostDetailCard.tsx`
- Create: `src/components/PostDetailCard.test.tsx`

`PostDetailCard` renders the full scrollable card body: community meta, title, image/link banner, post body, score footer, comments, and reply sheet.

- [ ] **Step 1: Write the failing tests**

Create `src/components/PostDetailCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PostDetailCard from './PostDetailCard';

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'reply', ap_id: 'https://lemmy.world/comment/99', path: '0.99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 0 },
  }),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: vi.fn().mockReturnValue({
    comments: [],
    commentsLoaded: true,
    resolvedInstanceRef: { current: 'lemmy.world' },
    resolvedTokenRef: { current: 'tok' },
  }),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockPost = {
  id: 1,
  name: 'Test Post Title',
  ap_id: 'https://lemmy.world/post/1',
  url: null,
  body: 'Post body text',
  thumbnail_url: null,
};

const mockCommunity = {
  name: 'technology',
  actor_id: 'https://lemmy.world/c/technology',
};

const mockCreator = { name: 'alice', display_name: null };
const mockCounts = { score: 42, child_count: 7 };

function renderCard(overrides = {}) {
  return render(
    <MemoryRouter>
      <PostDetailCard
        post={mockPost}
        community={mockCommunity}
        creator={mockCreator}
        counts={mockCounts}
        auth={mockAuth}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PostDetailCard', () => {
  it('renders post title', () => {
    renderCard();
    expect(screen.getByText('Test Post Title')).toBeInTheDocument();
  });

  it('renders community name', () => {
    renderCard();
    expect(screen.getByText('c/technology')).toBeInTheDocument();
  });

  it('renders post body', () => {
    renderCard();
    expect(screen.getByText('Post body text')).toBeInTheDocument();
  });

  it('renders score and comment count', () => {
    renderCard();
    expect(screen.getByText(/▲ 42/)).toBeInTheDocument();
    expect(screen.getByText(/💬 7/)).toBeInTheDocument();
  });

  it('renders image when post.url is an image', () => {
    renderCard({ post: { ...mockPost, url: 'https://example.com/photo.jpg' } });
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders link banner when post.url is not an image', () => {
    renderCard({ post: { ...mockPost, url: 'https://example.com/article' } });
    expect(screen.getByText('Tap to open link')).toBeInTheDocument();
  });

  it('does not render link banner or image when no url', () => {
    renderCard();
    expect(screen.queryByText('Tap to open link')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/PostDetailCard.test.tsx
```

Expected: FAIL — `Cannot find module './PostDetailCard'`

- [ ] **Step 3: Create `src/components/PostDetailCard.tsx`**

Extract the card body JSX from PostDetailPage into a new component. The `handleReplySubmit` logic moves here since it needs `resolvedInstanceRef` / `resolvedTokenRef` from `useCommentLoader`:

```tsx
import { useState, useEffect, useRef } from 'react';
import {
  resolveCommentId, createComment, type CommentView,
} from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId, isImageUrl } from '../lib/urlUtils';
import { useCommentLoader } from '../hooks/useCommentLoader';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import styles from './PostCard.module.css';

interface Post {
  id: number;
  name: string;
  ap_id: string;
  url?: string | null;
  body?: string | null;
  thumbnail_url?: string | null;
}

interface Community {
  name: string;
  actor_id: string;
}

interface Creator {
  name: string;
  display_name?: string | null;
}

interface Counts {
  score: number;
  child_count: number;
}

interface Props {
  post: Post;
  community: Community;
  creator: Creator;
  counts: Counts;
  auth: AuthState;
  highlightCommentId?: number;
}

export default function PostDetailCard({
  post, community, creator, counts, auth, highlightCommentId,
}: Props) {
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isLinkBannerPressed, setIsLinkBannerPressed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { comments, commentsLoaded, resolvedInstanceRef, resolvedTokenRef } = useCommentLoader(
    { ap_id: post.ap_id, id: post.id },
    { actor_id: community.actor_id },
    auth,
  );

  // Scroll highlighted comment into view once loaded
  useEffect(() => {
    if (highlightCommentId == null) return;
    const timeout = setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-comment-id="${highlightCommentId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timeout);
  }, [highlightCommentId]);

  // Keyboard offset for reply sheet
  useEffect(() => {
    if (!replyTarget || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
    vv.addEventListener('resize', handler);
    handler();
    return () => { vv.removeEventListener('resize', handler); setKeyboardOffset(0); };
  }, [replyTarget]);

  const handleReplySubmit = async (content: string) => {
    const parentApId = replyTarget!.comment.ap_id;
    const parentId =
      await resolveCommentId(resolvedInstanceRef.current, resolvedTokenRef.current, parentApId).catch(() => null)
      ?? replyTarget!.comment.id;
    const newComment = await createComment(
      resolvedInstanceRef.current, resolvedTokenRef.current, post.id, content, parentId,
    );
    const remapped = {
      ...newComment,
      comment: { ...newComment.comment, path: replyTarget!.comment.path + '.' + newComment.comment.id },
    };
    setLocalReplies((prev) => [...prev, remapped]);
    setReplyTarget(null);
  };

  const isImage = !!post.url && isImageUrl(post.url);
  const imageSrc = isImage ? post.url : post.thumbnail_url;
  const showLinkBanner = !!post.url && !isImage;

  const communityInstance = instanceFromActorId(community.actor_id);
  const communityInitial = community.name.charAt(0).toUpperCase();

  return (
    <div style={{
      position: 'relative', width: '92vw', maxWidth: 440,
      height: 'calc(100dvh - 72px)',
      borderRadius: 20, background: 'var(--card-bg, #1e2128)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', margin: '12px 0',
      display: 'flex', flexDirection: 'column',
    }}>
      <div ref={scrollRef} className={styles.scrollContent}>
        <div className={styles.meta}>
          <div className={styles.communityIcon}>{communityInitial}</div>
          <div>
            <div className={styles.communityName}>c/{community.name}</div>
            <div className={styles.instanceName}>
              {communityInstance} • {creator.display_name ?? creator.name}
            </div>
          </div>
        </div>

        <div className={styles.title}>{post.name}</div>

        {showLinkBanner && (
          <div
            className={isLinkBannerPressed ? `${styles.linkBanner} ${styles.linkBannerPressed}` : styles.linkBanner}
            onPointerDown={() => setIsLinkBannerPressed(true)}
            onPointerUp={() => setIsLinkBannerPressed(false)}
            onPointerLeave={() => setIsLinkBannerPressed(false)}
            onClick={() => window.open(post.url!, '_blank', 'noopener,noreferrer')}
          >
            <span className={styles.linkBannerIcon}>🔗</span>
            <div className={styles.linkBannerContent}>
              <div className={styles.linkBannerDomain}>{instanceFromActorId(post.url!)}</div>
              <div className={styles.linkBannerHint}>Tap to open link</div>
            </div>
            <span className={styles.linkBannerArrow}>↗</span>
          </div>
        )}

        {imageSrc && <img className={styles.image} src={imageSrc} alt="" loading="lazy" />}

        {post.body && <div className={styles.excerpt}>{post.body}</div>}

        <div className={styles.footer}>
          <span>▲ {counts.score}</span>
          <span>💬 {counts.child_count} replies</span>
        </div>

        <div className={styles.commentsSection}>
          {commentsLoaded && comments.length === 0 && counts.child_count > 0 && (
            <a
              className={styles.commentsFallback}
              href={post.ap_id}
              target="_blank"
              rel="noopener noreferrer"
            >
              {counts.child_count} replies — view on {instanceFromActorId(post.ap_id)}
            </a>
          )}
          <CommentList
            comments={comments}
            localReplies={localReplies}
            auth={auth}
            onSetReplyTarget={setReplyTarget}
            highlightCommentId={highlightCommentId}
          />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardOffset }}>
        <ReplySheet
          target={replyTarget}
          onSubmit={handleReplySubmit}
          onClose={() => setReplyTarget(null)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/PostDetailCard.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PostDetailCard.tsx src/components/PostDetailCard.test.tsx
git commit -m "feat: add PostDetailCard shared component"
```

---

## Task 6: Refactor `PostDetailPage` to use `MenuDrawer` and `PostDetailCard`

**Files:**
- Modify: `src/components/PostDetailPage.tsx`

- [ ] **Step 1: Rewrite PostDetailPage.tsx**

Replace the file contents with the following. This removes the inline drawer and card body, and delegates to `MenuDrawer` + `PostDetailCard`. The mark-as-read logic, highlight comment resolution, and reply comment mapping stay here since they are notification-specific:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  markReplyAsRead, markMentionAsRead,
  type CommentView, type NotifItem,
} from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { useCommentLoader } from '../hooks/useCommentLoader';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth: AuthState;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

export default function PostDetailPage({ auth, setUnreadCount }: Props) {
  useParams<{ notifId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const notification = state?.notification as NotifItem | undefined;

  const markedReadRef = useRef(false);

  const { comments, commentsLoaded } = useCommentLoader(
    notification?.data.post ?? { ap_id: '', id: 0 },
    notification?.data.community ?? { actor_id: '' },
    auth,
  );

  // Match the notification comment by ap_id to get the source-instance local ID
  const notifCommentApId = notification?.data.comment.ap_id;
  const highlightCommentId = commentsLoaded
    ? comments.find((c) => c.comment.ap_id === notifCommentApId)?.comment.id
    : undefined;

  // Mark as read on mount (once)
  useEffect(() => {
    if (!notification) return;
    if (markedReadRef.current) return;
    markedReadRef.current = true;

    const doMark = async () => {
      if (notification.type === 'reply') {
        await markReplyAsRead(auth.instance, auth.token, notification.data.comment_reply.id);
      } else {
        await markMentionAsRead(auth.instance, auth.token, notification.data.person_mention.id);
      }
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };
    doMark().catch(() => {});
  }, [auth, notification, setUnreadCount]);

  if (!notification) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
        <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Navigate to Inbox to view this notification.
        </div>
      </div>
    );
  }

  const post = notification.data.post;
  const community = notification.data.community;
  const creator = notification.data.creator;
  const counts = notification.data.counts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer
        onNavigate={navigate}
        onLogoClick={() => navigate('/')}
        leftContent={
          isIOS ? (
            <button
              onClick={() => navigate('/inbox')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Inbox
            </button>
          ) : undefined
        }
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <PostDetailCard
          post={post}
          community={community}
          creator={creator}
          counts={counts}
          auth={auth}
          highlightCommentId={highlightCommentId}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run all PostDetailPage tests**

```bash
npm test -- --reporter=verbose src/components/PostDetailPage.test.tsx
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/PostDetailPage.tsx
git commit -m "refactor: use MenuDrawer and PostDetailCard in PostDetailPage"
```

---

## Task 7: Create `SavedPage`

**Files:**
- Create: `src/components/SavedPage.tsx`
- Create: `src/components/SavedPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/SavedPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SavedPage from './SavedPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockPost = {
  post: {
    id: 1,
    name: 'A Saved Post',
    ap_id: 'https://lemmy.world/post/1',
    url: null,
    thumbnail_url: null,
    body: null,
  },
  community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 100, comments: 5, child_count: 5 },
};

vi.mock('../lib/lemmy', () => ({
  fetchSavedPosts: vi.fn().mockResolvedValue([mockPost]),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/saved']}>
      <SavedPage auth={mockAuth} />
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SavedPage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders saved post title after loading', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('A Saved Post')).toBeInTheDocument(),
    );
  });

  it('renders community name', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('c/technology')).toBeInTheDocument(),
    );
  });

  it('renders score and comment count', async () => {
    renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    expect(screen.getByText(/▲ 100/)).toBeInTheDocument();
    expect(screen.getByText(/💬 5/)).toBeInTheDocument();
  });

  it('shows empty state when no saved posts', async () => {
    const { fetchSavedPosts } = await import('../lib/lemmy');
    (fetchSavedPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('No saved posts')).toBeInTheDocument(),
    );
  });

  it('navigates to saved post detail on click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    fireEvent.click(screen.getByText('A Saved Post'));
    expect(mockNavigate).toHaveBeenCalledWith('/saved/1', { state: { post: mockPost } });
  });

  it('shows error message when fetch fails', async () => {
    const { fetchSavedPosts } = await import('../lib/lemmy');
    (fetchSavedPosts as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Network error')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/SavedPage.test.tsx
```

Expected: FAIL — `Cannot find module './SavedPage'`

- [ ] **Step 3: Create `src/components/SavedPage.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSavedPosts, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { isImageUrl } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';

interface Props {
  auth: AuthState;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// Deterministic muted colour for posts with no image
function placeholderColor(name: string): string {
  const colors = ['#1a2a3a', '#2a1a3a', '#1a3a2a', '#3a2a1a', '#2a3a1a', '#3a1a2a'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export default function SavedPage({ auth }: Props) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await fetchSavedPosts(auth.instance, auth.token, pageNum);
      if (result.length === 0) {
        setCanLoadMore(false);
      } else {
        setPosts((prev) => [...prev, ...result]);
      }
    } catch (err) {
      if (pageNum === 1) {
        setError(err instanceof Error ? err.message : 'Failed to load saved posts');
      } else {
        setCanLoadMore(false);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [auth]);

  // Initial load
  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!canLoadMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingRef.current && canLoadMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        loadPage(nextPage);
      }
    }, { threshold: 0.1 });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, page, loadPage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading…</div>
        )}
        {!loading && error && (
          <div style={{ textAlign: 'center', color: '#ff4444', padding: 32 }}>{error}</div>
        )}
        {!loading && !error && posts.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No saved posts</div>
        )}
        {posts.map((pv) => {
          const { post, community, counts } = pv;
          const isImage = !!post.url && isImageUrl(post.url);
          const bannerSrc = isImage ? post.url : post.thumbnail_url;

          return (
            <div
              key={post.id}
              onClick={() => navigate(`/saved/${post.id}`, { state: { post: pv } })}
              style={{
                margin: '6px 12px',
                background: '#1e2128',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              {/* Banner */}
              {bannerSrc ? (
                <img
                  src={bannerSrc}
                  alt=""
                  style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: 120,
                  background: placeholderColor(post.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, color: 'rgba(255,255,255,0.15)',
                }}>
                  🔖
                </div>
              )}
              {/* Body */}
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600, marginBottom: 5 }}>
                  c/{community.name}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35,
                  marginBottom: 8,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {post.name}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                  <span>▲ {counts.score}</span>
                  <span>💬 {counts.child_count}</span>
                </div>
              </div>
            </div>
          );
        })}
        {/* Sentinel for infinite scroll */}
        {canLoadMore && !error && <div ref={sentinelRef} style={{ height: 1 }} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/SavedPage.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SavedPage.tsx src/components/SavedPage.test.tsx
git commit -m "feat: add SavedPage with infinite scroll"
```

---

## Task 8: Create `SavedPostDetailPage`

**Files:**
- Create: `src/components/SavedPostDetailPage.tsx`
- Create: `src/components/SavedPostDetailPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/SavedPostDetailPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SavedPostDetailPage from './SavedPostDetailPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn(),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: vi.fn().mockReturnValue({
    comments: [],
    commentsLoaded: true,
    resolvedInstanceRef: { current: 'lemmy.world' },
    resolvedTokenRef: { current: 'tok' },
  }),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockPostView = {
  post: {
    id: 1,
    name: 'Saved Post Title',
    ap_id: 'https://lemmy.world/post/1',
    url: null,
    body: 'Some body text',
    thumbnail_url: null,
  },
  community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 55, child_count: 3 },
};

function renderPage(withState = true) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/saved/1', state: withState ? { post: mockPostView } : undefined }]}>
      <Routes>
        <Route path="/saved/:postId" element={<SavedPostDetailPage auth={mockAuth} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SavedPostDetailPage', () => {
  it('renders post title when state is present', () => {
    renderPage();
    expect(screen.getByText('Saved Post Title')).toBeInTheDocument();
  });

  it('renders community name', () => {
    renderPage();
    expect(screen.getByText('c/technology')).toBeInTheDocument();
  });

  it('shows fallback when no route state', () => {
    renderPage(false);
    expect(screen.getByText('Navigate to Saved to view this post.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/SavedPostDetailPage.test.tsx
```

Expected: FAIL — `Cannot find module './SavedPostDetailPage'`

- [ ] **Step 3: Create `src/components/SavedPostDetailPage.tsx`**

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth: AuthState;
}

export default function SavedPostDetailPage({ auth }: Props) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const postView = state?.post as PostView | undefined;

  if (!postView) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
        <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Navigate to Saved to view this post.
        </div>
      </div>
    );
  }

  const { post, community, creator, counts } = postView;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer
        onNavigate={navigate}
        onLogoClick={() => navigate('/')}
        leftContent={
          isIOS ? (
            <button
              onClick={() => navigate('/saved')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Saved
            </button>
          ) : undefined
        }
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <PostDetailCard
          post={post}
          community={community}
          creator={creator}
          counts={counts}
          auth={auth}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/SavedPostDetailPage.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SavedPostDetailPage.tsx src/components/SavedPostDetailPage.test.tsx
git commit -m "feat: add SavedPostDetailPage"
```

---

## Task 9: Wire routes in App.tsx and run full test suite

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports and routes to App.tsx**

Add imports at the top of `src/App.tsx`:
```ts
import SavedPage from './components/SavedPage';
import SavedPostDetailPage from './components/SavedPostDetailPage';
```

Inside `<Routes>`, after the existing `/inbox/:notifId` route, add:
```tsx
<Route
  path="/saved"
  element={<SavedPage auth={auth} />}
/>
<Route
  path="/saved/:postId"
  element={<SavedPostDetailPage auth={auth} />}
/>
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire /saved and /saved/:postId routes in App"
```

---

## Self-Review Notes

- **Spec coverage:** All spec items covered — `fetchSavedPosts`, `MenuDrawer` (with `centerContent`, `unreadCount`, `onNavigate`), `PostDetailCard`, `SavedPage` (infinite scroll via IntersectionObserver, Style B banner), `SavedPostDetailPage` (fallback, iOS back button, reply support), routes in App.tsx, refactored FeedStack/InboxPage/PostDetailPage.
- **No placeholders:** All steps contain complete code.
- **Type consistency:** `Post`, `Community`, `Creator`, `Counts` types are defined inline in `PostDetailCard.tsx` as minimal interfaces — compatible with both `PostView` (from SavedPage) and the notification view fields (from PostDetailPage). `PostView` is imported from `lemmy.ts` directly in `SavedPage` and `SavedPostDetailPage`.
- **`counts.child_count` vs `counts.comments`:** PostDetailPage uses `counts.child_count` for the comment count label and fallback link; this plan keeps that same field in `PostDetailCard` and `SavedPage`.
