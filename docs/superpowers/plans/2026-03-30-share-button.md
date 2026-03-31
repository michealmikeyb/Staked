# Share Button & Shared Post View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a share button to post cards that copies/shares a `stakswipe.com/#/post/{instance}/{postId}` URL, and create a public (no-login) page at that route that fetches and displays the post.

**Architecture:** A `getShareUrl` helper builds share URLs from a configurable `VITE_BASE_URL`. A new `fetchPost` function fetches posts anonymously. `SharedPostPage` reads instance+postId from URL params, fetches the post, and renders `PostDetailCard` with a synthetic anonymous auth object. The `App` component is restructured so `/post/:instance/:postId` resolves before the auth gate.

**Tech Stack:** React 18, TypeScript, React Router v6 (HashRouter), Vite, lemmy-js-client, Vitest + Testing Library

---

## File Map

| File | Change |
|------|--------|
| `src/lib/urlUtils.ts` | Add `getShareUrl(instance, postId)` |
| `src/lib/lemmy.ts` | Add `fetchPost(instance, postId)` |
| `src/components/PostDetailCard.tsx` | Make `auth` optional; hide ReplySheet when absent |
| `src/components/PostCard.tsx` | Add share button to footer; add Toast for clipboard fallback |
| `src/components/SharedPostPage.tsx` | **New** — unauthenticated post view |
| `src/App.tsx` | Move `/post/:instance/:postId` route outside auth gate |
| `.env.example` | Document `VITE_BASE_URL` |

---

## Task 1: Add `getShareUrl` to `urlUtils.ts`

**Files:**
- Modify: `src/lib/urlUtils.ts`
- Test: `src/lib/urlUtils.test.ts` *(create if absent)*

- [ ] **Step 1: Write the failing test**

Add to `src/lib/urlUtils.test.ts` (create the file if it doesn't exist):

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getShareUrl } from './urlUtils';

describe('getShareUrl', () => {
  const originalEnv = import.meta.env.VITE_BASE_URL;

  afterEach(() => {
    import.meta.env.VITE_BASE_URL = originalEnv;
  });

  it('uses VITE_BASE_URL when set', () => {
    import.meta.env.VITE_BASE_URL = 'https://stakswipe.com';
    expect(getShareUrl('lemmy.world', 42)).toBe('https://stakswipe.com/#/post/lemmy.world/42');
  });

  it('falls back to https://stakswipe.com when VITE_BASE_URL is undefined', () => {
    import.meta.env.VITE_BASE_URL = undefined;
    expect(getShareUrl('beehaw.org', 7)).toBe('https://stakswipe.com/#/post/beehaw.org/7');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- urlUtils
```

Expected: FAIL — `getShareUrl is not exported`

- [ ] **Step 3: Add `getShareUrl` to `src/lib/urlUtils.ts`**

Append after the existing exports:

```ts
export function getShareUrl(instance: string, postId: number): string {
  const base = import.meta.env.VITE_BASE_URL ?? 'https://stakswipe.com';
  return `${base}/#/post/${instance}/${postId}`;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- urlUtils
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/urlUtils.ts src/lib/urlUtils.test.ts
git commit -m "feat: add getShareUrl utility"
```

---

## Task 2: Add `fetchPost` to `lemmy.ts`

**Files:**
- Modify: `src/lib/lemmy.ts`
- Test: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/lemmy.test.ts`, add `fetchPost` to the mock's `getPost` method and the import, then add the test. First, add `getPost` to the mock object inside `vi.mock('lemmy-js-client', ...)`:

```ts
getPost: vi.fn().mockResolvedValue({
  post_view: {
    post: { id: 5, name: 'Shared Post', ap_id: 'https://lemmy.world/post/5', url: null, body: null, thumbnail_url: null },
    community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
    creator: { name: 'carol', display_name: null },
    counts: { score: 55, comments: 3 },
  },
}),
```

Then add the import at the top (update the existing import line):

```ts
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments, likeComment, createComment, fetchPersonDetails, fetchPost } from './lemmy';
```

Then add the test:

```ts
describe('fetchPost', () => {
  it('returns the post_view from getPost', async () => {
    const result = await fetchPost('lemmy.world', 5);
    expect(result.post.name).toBe('Shared Post');
    expect(result.post.id).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- lemmy.test
```

Expected: FAIL — `fetchPost is not exported`

- [ ] **Step 3: Add `fetchPost` to `src/lib/lemmy.ts`**

Add after `fetchSavedPosts`:

```ts
export async function fetchPost(instance: string, postId: number): Promise<PostView> {
  const res = await client(instance).getPost({ id: postId });
  return res.post_view;
}
```

Also add `fetchPost` to the export line at the top of the file if needed — `PostView` is already exported.

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- lemmy.test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add fetchPost API function"
```

---

## Task 3: Make `auth` optional in `PostDetailCard`

**Files:**
- Modify: `src/components/PostDetailCard.tsx`
- Test: `src/components/PostDetailCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Open `src/components/PostDetailCard.test.tsx`. Add mocks at the top (or ensure these are already present — follow the same pattern as `PostCard.test.tsx`):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: () => ({ comments: [], commentsLoaded: true, resolvedInstanceRef: { current: '' }, resolvedTokenRef: { current: '' } }),
}));

import PostDetailCard from './PostDetailCard';

const POST = { id: 1, name: 'A shared post', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null };
const COMMUNITY = { name: 'linux', actor_id: 'https://lemmy.world/c/linux' };
const CREATOR = { name: 'alice', display_name: null };
const COUNTS = { score: 10, comments: 2 };
const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

describe('PostDetailCard', () => {
  it('renders without auth (anonymous mode)', () => {
    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />);
    expect(screen.getByText('A shared post')).toBeInTheDocument();
  });

  it('does not render ReplySheet when auth is absent', () => {
    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />);
    expect(screen.queryByTestId('reply-wrapper')).not.toBeInTheDocument();
  });

  it('renders with auth (authenticated mode)', () => {
    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} auth={AUTH} />);
    expect(screen.getByText('A shared post')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- PostDetailCard.test
```

Expected: FAIL — TypeScript error on missing `auth` prop

- [ ] **Step 3: Update `PostDetailCard.tsx`**

Change the `Props` interface and component to make `auth` optional:

```tsx
interface Props {
  post: Post;
  community: Community;
  creator: Creator;
  counts: Counts;
  auth?: AuthState;
  notifCommentApId?: string;
}
```

Replace the `useCommentLoader` call:

```tsx
const anonAuth: AuthState = {
  instance: instanceFromActorId(community.actor_id),
  token: '',
  username: '',
};
const { comments, commentsLoaded } = useCommentLoader(
  { ap_id: post.ap_id, id: post.id },
  { actor_id: community.actor_id },
  auth ?? anonAuth,
);
```

Wrap the `ReplySheet` block so it only renders with auth. Replace:

```tsx
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardOffset }}>
        <ReplySheet
          target={replyTarget}
          onSubmit={handleReplySubmit}
          onClose={() => setReplyTarget(null)}
        />
      </div>
```

With:

```tsx
      {auth && (
        <div data-testid="reply-wrapper" style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardOffset }}>
          <ReplySheet
            target={replyTarget}
            onSubmit={handleReplySubmit}
            onClose={() => setReplyTarget(null)}
          />
        </div>
      )}
```

Also guard the `handleReplySubmit` and `keyboardOffset` effect to avoid errors when auth is absent. Replace the keyboard effect:

```tsx
  useEffect(() => {
    if (!replyTarget || !auth || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
    vv.addEventListener('resize', handler);
    handler();
    return () => { vv.removeEventListener('resize', handler); setKeyboardOffset(0); };
  }, [replyTarget, auth]);
```

Replace `handleReplySubmit`:

```tsx
  const handleReplySubmit = async (content: string) => {
    if (!auth) return;
    const parentApId = replyTarget!.comment.ap_id;
    const parentId =
      await resolveCommentId(auth.instance, auth.token, parentApId).catch(() => null)
      ?? replyTarget!.comment.id;
    const newComment = await createComment(
      auth.instance, auth.token, post.id, content, parentId,
    );
    const remapped = {
      ...newComment,
      comment: { ...newComment.comment, path: replyTarget!.comment.path + '.' + newComment.comment.id },
    };
    setLocalReplies((prev) => [...prev, remapped]);
    setReplyTarget(null);
  };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- PostDetailCard.test
```

Expected: PASS

- [ ] **Step 5: Run full test suite to check nothing broke**

```bash
npm test
```

Expected: all existing tests pass (callers that pass `auth` explicitly still work fine)

- [ ] **Step 6: Commit**

```bash
git add src/components/PostDetailCard.tsx src/components/PostDetailCard.test.tsx
git commit -m "feat: make PostDetailCard auth optional for anonymous shared post view"
```

---

## Task 4: Add share button to `PostCard` and `PostDetailCard`

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostDetailCard.tsx`
- Modify: `src/components/PostCard.module.css`
- Test: `src/components/PostCard.test.tsx`
- Test: `src/components/PostDetailCard.test.tsx`

- [ ] **Step 1: Write failing tests for `PostCard`**

In `src/components/PostCard.test.tsx`, add mocks for `navigator.share` and `getShareUrl`, then add the test. Add after the existing `vi.mock` blocks:

```ts
vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return { ...actual, getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1') };
});
```

Add this test inside `describe('PostCard', ...)`:

```ts
  it('calls navigator.share when share button is tapped and share API available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, writable: true, configurable: true });

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

    fireEvent.click(screen.getByTestId('share-button'));
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Rust post',
      url: 'https://stakswipe.com/#/post/lemmy.world/1',
    });
  });

  it('copies to clipboard when share API unavailable', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, writable: true, configurable: true });

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

    fireEvent.click(screen.getByTestId('share-button'));
    expect(writeTextMock).toHaveBeenCalledWith('https://stakswipe.com/#/post/lemmy.world/1');
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- PostCard.test
```

Expected: FAIL — no element with `data-testid="share-button"`

- [ ] **Step 3: Add share button to `PostCard.tsx`**

Add the import at the top:

```ts
import { instanceFromActorId, isImageUrl, getShareUrl } from '../lib/urlUtils';
import Toast from './Toast';
```

Add state for toast at the top of the component body (after the existing `useState` declarations):

```ts
const [toastVisible, setToastVisible] = useState(false);
```

Add the share handler before the `return`:

```ts
  const handleShare = () => {
    const url = getShareUrl(auth.instance, p.id);
    if (navigator.share) {
      navigator.share({ title: p.name, url });
    } else {
      navigator.clipboard.writeText(url);
      setToastVisible(true);
    }
  };
```

In the `footer` div, add the share button after the existing spans:

```tsx
        <div className={styles.footer}>
          <span>▲ {counts.score}</span>
          <span>💬 {counts.comments}</span>
          <button
            data-testid="share-button"
            className={styles.shareButton}
            onClick={handleShare}
          >
            Share ↗
          </button>
        </div>
```

After the closing `</div>` of `reply-wrapper`, add the toast (just before the closing `</motion.div>`):

```tsx
      <Toast message="Link copied" visible={toastVisible} onHide={() => setToastVisible(false)} />
```

- [ ] **Step 4: Add CSS for the share button to `PostCard.module.css`**

Append to the file:

```css
.shareButton {
  margin-left: auto;
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

- [ ] **Step 5: Add share button to `PostDetailCard.tsx`**

Add imports (update the existing urlUtils import):

```ts
import { instanceFromActorId, isImageUrl, getShareUrl } from '../lib/urlUtils';
import Toast from './Toast';
```

Add toast state in the component body:

```ts
const [toastVisible, setToastVisible] = useState(false);
```

Add share handler before the return:

```ts
  const handleShare = () => {
    if (!auth) return;
    const url = getShareUrl(auth.instance, post.id);
    if (navigator.share) {
      navigator.share({ title: post.name, url });
    } else {
      navigator.clipboard.writeText(url);
      setToastVisible(true);
    }
  };
```

In the `footer` div (inside the scrollable content), add the share button. Replace the footer:

```tsx
        <div className={styles.footer}>
          <span>▲ {counts.score}</span>
          <span>💬 {counts.comments} replies</span>
          {auth && (
            <button
              data-testid="share-button"
              className={styles.shareButton}
              onClick={handleShare}
            >
              Share ↗
            </button>
          )}
        </div>
```

Add the toast before the closing `</div>` of the outer container:

```tsx
      <Toast message="Link copied" visible={toastVisible} onHide={() => setToastVisible(false)} />
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test -- PostCard.test PostDetailCard.test
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostDetailCard.tsx src/components/PostCard.module.css src/components/PostCard.test.tsx src/components/PostDetailCard.test.tsx
git commit -m "feat: add share button to PostCard and PostDetailCard"
```

---

## Task 5: Create `SharedPostPage`

**Files:**
- Create: `src/components/SharedPostPage.tsx`
- Create: `src/components/SharedPostPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/SharedPostPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/lemmy', () => ({
  fetchPost: vi.fn().mockResolvedValue({
    post: { id: 42, name: 'Hello from Lemmy', ap_id: 'https://lemmy.world/post/42', url: null, body: 'Post body text', thumbnail_url: null },
    community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
    creator: { name: 'carol', display_name: null },
    counts: { score: 77, comments: 5 },
  }),
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: () => ({ comments: [], commentsLoaded: true, resolvedInstanceRef: { current: '' }, resolvedTokenRef: { current: '' } }),
}));

import SharedPostPage from './SharedPostPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SharedPostPage', () => {
  it('renders post title after loading', async () => {
    renderAt('/post/lemmy.world/42');
    await waitFor(() => expect(screen.getByText('Hello from Lemmy')).toBeInTheDocument());
  });

  it('shows loading state initially', () => {
    renderAt('/post/lemmy.world/42');
    expect(screen.getByTestId('shared-post-loading')).toBeInTheDocument();
  });

  it('shows error when fetchPost rejects', async () => {
    const { fetchPost } = await import('../lib/lemmy');
    (fetchPost as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not found'));
    renderAt('/post/lemmy.world/99');
    await waitFor(() => expect(screen.getByTestId('shared-post-error')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- SharedPostPage
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/components/SharedPostPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPost, type PostView } from '../lib/lemmy';
import Logo from './Logo';
import PostDetailCard from './PostDetailCard';

export default function SharedPostPage() {
  const { instance, postId } = useParams<{ instance: string; postId: string }>();
  const [postView, setPostView] = useState<PostView | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!instance || !postId) { setError(true); return; }
    const id = parseInt(postId, 10);
    if (isNaN(id)) { setError(true); return; }
    fetchPost(instance, id)
      .then(setPostView)
      .catch(() => setError(true));
  }, [instance, postId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#13151a' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 16px', borderBottom: '1px solid #1e2128',
      }}>
        <a href="/#/" style={{ textDecoration: 'none' }}>
          <Logo variant="full" size={28} />
        </a>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '0 0 32px' }}>
        {!postView && !error && (
          <div data-testid="shared-post-loading" style={{ marginTop: 80, color: '#888', fontSize: '0.9rem' }}>
            Loading…
          </div>
        )}

        {error && (
          <div data-testid="shared-post-error" style={{ marginTop: 80, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: '1rem', marginBottom: 12 }}>Post not found</div>
            <a href="/#/" style={{ color: '#ff6b35', fontSize: '0.85rem' }}>Open Stakswipe</a>
          </div>
        )}

        {postView && (
          <>
            <PostDetailCard
              post={postView.post}
              community={postView.community}
              creator={postView.creator}
              counts={{ score: postView.counts.score, comments: postView.counts.comments }}
            />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <a href="/#/" style={{ color: '#ff6b35', fontSize: '0.85rem', textDecoration: 'none' }}>
                Log in to interact →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- SharedPostPage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SharedPostPage.tsx src/components/SharedPostPage.test.tsx
git commit -m "feat: add SharedPostPage for unauthenticated post view"
```

---

## Task 6: Restructure `App.tsx` routing

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing test**

Open `src/App.test.tsx`. Add a test that confirms the shared post route is accessible without auth. Add `fetchPost` to the lemmy mock and add this test:

First, ensure `fetchPost` is in the lemmy mock in `App.test.tsx`. Find the `vi.mock('../lib/lemmy', ...)` block and add:

```ts
fetchPost: vi.fn().mockResolvedValue({
  post: { id: 5, name: 'Shared Post', ap_id: 'https://lemmy.world/post/5', url: null, body: null, thumbnail_url: null },
  community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
  creator: { name: 'carol', display_name: null },
  counts: { score: 10, comments: 0 },
}),
```

Then add the test (look at the existing test structure in `App.test.tsx` to find the right `describe` block):

```ts
  it('renders SharedPostPage at /post/:instance/:postId without auth', async () => {
    // Clear any saved auth so the app would normally show LoginPage
    localStorage.clear();

    render(
      <MemoryRouter initialEntries={['/#/post/lemmy.world/5']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Shared Post')).toBeInTheDocument());
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- App.test
```

Expected: FAIL — shared post route either shows LoginPage or 404

- [ ] **Step 3: Update `src/App.tsx`**

Replace the entire file with:

```tsx
import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { loadAuth, clearAuth, type AuthState } from './lib/store';
import LoginPage from './components/LoginPage';
import FeedStack from './components/FeedStack';
import InboxPage from './components/InboxPage';
import PostDetailPage from './components/PostDetailPage';
import SavedPage from './components/SavedPage';
import SavedPostDetailPage from './components/SavedPostDetailPage';
import ProfilePage from './components/ProfilePage';
import ProfilePostDetailPage from './components/ProfilePostDetailPage';
import SharedPostPage from './components/SharedPostPage';

function AuthenticatedApp({ auth, onLogout }: { auth: AuthState; onLogout: () => void }) {
  const [unreadCount, setUnreadCount] = useState(0);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <FeedStack
            auth={auth}
            onLogout={onLogout}
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
          />
        }
      />
      <Route
        path="/inbox"
        element={<InboxPage auth={auth} setUnreadCount={setUnreadCount} unreadCount={unreadCount} />}
      />
      <Route
        path="/inbox/:notifId"
        element={<PostDetailPage auth={auth} setUnreadCount={setUnreadCount} unreadCount={unreadCount} />}
      />
      <Route path="/saved" element={<SavedPage auth={auth} />} />
      <Route path="/saved/:postId" element={<SavedPostDetailPage auth={auth} />} />
      <Route path="/profile" element={<ProfilePage auth={auth} />} />
      <Route path="/profile/:postId" element={<ProfilePostDetailPage auth={auth} />} />
    </Routes>
  );
}

function AuthGate({ auth, onLogin, onLogout }: {
  auth: AuthState | null;
  onLogin: (a: AuthState) => void;
  onLogout: () => void;
}) {
  if (!auth) return <LoginPage onLogin={onLogin} />;
  return <AuthenticatedApp auth={auth} onLogout={onLogout} />;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());

  function handleLogin(newAuth: AuthState) {
    setAuth(newAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
        <Route
          path="/*"
          element={<AuthGate auth={auth} onLogin={handleLogin} onLogout={handleLogout} />}
        />
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- App.test
```

Expected: PASS

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add shared post route outside auth gate"
```

---

## Task 7: Document `VITE_BASE_URL` and final cleanup

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create `.env.example`**

```bash
# Base URL for share links (no trailing slash)
# Used by getShareUrl() in src/lib/urlUtils.ts
# Defaults to https://stakswipe.com if not set
VITE_BASE_URL=https://stakswipe.com
```

- [ ] **Step 2: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: document VITE_BASE_URL env var for share links"
```

---

## Self-Review

**Spec coverage:**
- ✅ Share button in PostCard footer
- ✅ Share button in PostDetailCard footer
- ✅ Web Share API with clipboard fallback + toast
- ✅ `VITE_BASE_URL` configurable, default `https://stakswipe.com`
- ✅ URL format `/#/post/{instance}/{postId}`
- ✅ `SharedPostPage` — anonymous fetch, read-only PostDetailCard
- ✅ Loading state (`shared-post-loading`)
- ✅ Error state (`shared-post-error`)
- ✅ "Log in to interact" nudge
- ✅ Auth gate bypassed for `/post/:instance/:postId`
- ✅ `auth` optional in PostDetailCard; ReplySheet hidden when absent
- ✅ Logo header on SharedPostPage

**Placeholder scan:** None found.

**Type consistency:**
- `getShareUrl(instance: string, postId: number): string` — used identically in Task 1, 4
- `fetchPost(instance: string, postId: number): Promise<PostView>` — used identically in Task 2, 5
- `PostDetailCard` props: `auth?: AuthState` — optional in Task 3, called without auth in Task 5, called with auth in Task 4 (PostDetailCard share button)
- `anonAuth: AuthState` shape `{ instance, token: '', username: '' }` — matches `AuthState` interface exactly
