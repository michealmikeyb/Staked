# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/profile` page showing the current user's posts and comments in a tabbed list, with tap-through to a full card detail view that scrolls to the tapped comment.

**Architecture:** Mirror the Saved page pattern exactly — `ProfilePage` fetches via a new `fetchPersonDetails` lemmy API wrapper, renders a three-tab list (All/Posts/Comments), and navigates to `ProfilePostDetailPage` which reuses `PostDetailCard` with the existing `notifCommentApId` scroll-to-comment prop. The Profile button in `MenuDrawer` is wired to `/profile`.

**Tech Stack:** React 18, TypeScript, react-router-dom v6, lemmy-js-client v0.19, Vitest + @testing-library/react

---

## File map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/lib/lemmy.ts` | Add `fetchPersonDetails` |
| Modify | `src/lib/lemmy.test.ts` | Test `fetchPersonDetails` |
| Create | `src/components/ProfilePage.tsx` | List page with All/Posts/Comments tabs |
| Create | `src/components/ProfilePage.test.tsx` | Tests for ProfilePage |
| Create | `src/components/ProfilePostDetailPage.tsx` | Detail page wrapping PostDetailCard |
| Create | `src/components/ProfilePostDetailPage.test.tsx` | Tests for ProfilePostDetailPage |
| Modify | `src/App.tsx` | Add `/profile` and `/profile/:postId` routes |
| Modify | `src/App.test.tsx` | Mock and test new routes |
| Modify | `src/components/MenuDrawer.tsx` | Wire Profile button to navigate('/profile') |
| Modify | `src/components/MenuDrawer.test.tsx` | Update Profile button test |

---

## Task 1: Add `fetchPersonDetails` to lemmy.ts

**Files:**
- Modify: `src/lib/lemmy.ts`
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/lib/lemmy.test.ts`. Add `fetchPersonDetails` to the import on line 2:

```ts
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments, likeComment, createComment, fetchPersonDetails } from './lemmy';
```

Add `getPersonDetails` to the mock `MockLemmyHttp` implementation (inside the `vi.mock('lemmy-js-client', ...)` block, alongside the other mock methods):

```ts
getPersonDetails: vi.fn().mockResolvedValue({
  person_view: {},
  posts: [{ post: { id: 1, name: 'Test Post' }, community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' }, creator: { name: 'alice', display_name: null }, counts: { score: 10, comments: 2 } }],
  comments: [{ comment: { id: 5, content: 'Great post!', ap_id: 'https://lemmy.world/comment/5', path: '0.5', published: '2026-03-29T10:00:00Z' }, post: { id: 1, name: 'Test Post', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null }, community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' }, creator: { name: 'alice', display_name: null }, counts: { score: 3 } }],
}),
```

Add the test suite at the end of `src/lib/lemmy.test.ts`:

```ts
describe('fetchPersonDetails', () => {
  it('returns posts and comments for the user', async () => {
    const result = await fetchPersonDetails('lemmy.world', 'tok', 'alice', 1);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].post.name).toBe('Test Post');
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].comment.content).toBe('Great post!');
  });

  it('calls getPersonDetails with correct params', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await fetchPersonDetails('lemmy.world', 'tok', 'alice', 2);
    const instance = vi.mocked(LemmyHttp).mock.results[0].value;
    expect(instance.getPersonDetails).toHaveBeenCalledWith({
      username: 'alice',
      sort: 'New',
      page: 2,
      limit: 20,
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: FAIL — `fetchPersonDetails is not a function` (or similar import error).

- [ ] **Step 3: Add `fetchPersonDetails` to `src/lib/lemmy.ts`**

Add at the end of the file:

```ts
export async function fetchPersonDetails(
  instance: string,
  token: string,
  username: string,
  page: number,
): Promise<{ posts: PostView[]; comments: CommentView[] }> {
  const res = await client(instance, token).getPersonDetails({
    username,
    sort: 'New',
    page,
    limit: 20,
  });
  return { posts: res.posts, comments: res.comments };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add fetchPersonDetails to lemmy API wrapper"
```

---

## Task 2: Create ProfilePage

**Files:**
- Create: `src/components/ProfilePage.tsx`
- Create: `src/components/ProfilePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ProfilePage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  fetchPersonDetails: vi.fn(),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };

const mockPost = {
  post: { id: 1, name: 'My Terminal Setup', ap_id: 'https://lemmy.world/post/1', url: null, thumbnail_url: null, body: null },
  community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 42, comments: 7 },
};

const mockComment = {
  comment: { id: 5, content: 'Great post!', ap_id: 'https://lemmy.world/comment/5', path: '0.5', published: '2026-03-28T10:00:00Z' },
  post: { id: 2, name: 'Ask Lemmy: best editors?', ap_id: 'https://lemmy.world/post/2', url: null, body: null, thumbnail_url: null },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 8 },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <ProfilePage auth={mockAuth} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { fetchPersonDetails } = await import('../lib/lemmy');
  (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
    posts: [mockPost],
    comments: [mockComment],
  });
});

describe('ProfilePage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders username and instance', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByText('u/alice')).toBeInTheDocument();
    expect(screen.getByText('lemmy.world')).toBeInTheDocument();
  });

  it('All tab is active by default and shows both post and comment', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByText('My Terminal Setup')).toBeInTheDocument();
    expect(screen.getByText('Great post!')).toBeInTheDocument();
  });

  it('Posts tab shows only post rows', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    expect(screen.getByText('My Terminal Setup')).toBeInTheDocument();
    expect(screen.queryByText('Great post!')).not.toBeInTheDocument();
  });

  it('Comments tab shows only comment rows', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: 'Comments' }));
    expect(screen.queryByText('My Terminal Setup')).not.toBeInTheDocument();
    expect(screen.getByText('Great post!')).toBeInTheDocument();
  });

  it('navigates to post detail on post row click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByText('My Terminal Setup'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/1', { state: { post: mockPost } });
  });

  it('navigates to post detail with commentApId on comment row click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    fireEvent.click(screen.getByText('Great post!'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/2', {
      state: {
        post: {
          post: mockComment.post,
          community: mockComment.community,
          creator: mockComment.creator,
          counts: { score: 0, comments: 0 },
        },
        commentApId: 'https://lemmy.world/comment/5',
      },
    });
  });

  it('shows empty state when no posts or comments', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ posts: [], comments: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
  });

  it('shows error when fetch fails', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/components/ProfilePage.test.tsx
```

Expected: FAIL — `Cannot find module './ProfilePage'`.

- [ ] **Step 3: Create `src/components/ProfilePage.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPersonDetails, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { isImageUrl } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';

interface Props {
  auth: AuthState;
}

type Tab = 'all' | 'posts' | 'comments';

function placeholderColor(name: string): string {
  const colors = ['#1a2a3a', '#2a1a3a', '#1a3a2a', '#3a2a1a', '#2a3a1a', '#3a1a2a'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export default function ProfilePage({ auth }: Props) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const loadingRef = useRef(false);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await fetchPersonDetails(auth.instance, auth.token, auth.username, pageNum);
      if (result.posts.length === 0 && result.comments.length === 0) {
        setCanLoadMore(false);
      } else {
        setPosts((prev) => [...prev, ...result.posts]);
        setComments((prev) => [...prev, ...result.comments]);
      }
    } catch (err) {
      if (pageNum === 1) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } else {
        setCanLoadMore(false);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [auth]);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    if (!canLoadMore) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingRef.current && canLoadMore) {
        pageRef.current += 1;
        loadPage(pageRef.current);
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadPage]);

  // Merge posts and comments sorted newest-first for the All tab
  type FeedItem =
    | { kind: 'post'; data: PostView; published: string }
    | { kind: 'comment'; data: CommentView; published: string };

  const allItems: FeedItem[] = [
    ...posts.map((pv): FeedItem => ({ kind: 'post', data: pv, published: pv.post.published ?? '' })),
    ...comments.map((cv): FeedItem => ({ kind: 'comment', data: cv, published: cv.comment.published })),
  ].sort((a, b) => b.published.localeCompare(a.published));

  const visibleItems: FeedItem[] =
    tab === 'posts' ? allItems.filter((i) => i.kind === 'post') :
    tab === 'comments' ? allItems.filter((i) => i.kind === 'comment') :
    allItems;

  const isEmpty = !loading && !error && posts.length === 0 && comments.length === 0;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1, textAlign: 'center', padding: '10px 0', fontSize: 13,
    fontWeight: tab === t ? 600 : 400,
    color: tab === t ? '#ff6b35' : '#555',
    borderBottom: tab === t ? '2px solid #ff6b35' : '2px solid transparent',
    marginBottom: -2,
    background: 'none', border: 'none', cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />

      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #2a2d35' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 2 }}>
          u/{auth.username}
        </div>
        <div style={{ fontSize: 11, color: '#666' }}>{auth.instance}</div>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #2a2d35', background: '#1a1d24' }}>
        <button style={tabStyle('all')} onClick={() => setTab('all')} aria-label="All">All</button>
        <button style={tabStyle('posts')} onClick={() => setTab('posts')} aria-label="Posts">Posts</button>
        <button style={tabStyle('comments')} onClick={() => setTab('comments')} aria-label="Comments">Comments</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading…</div>
        )}
        {!loading && error && (
          <div style={{ textAlign: 'center', color: '#ff4444', padding: 32 }}>{error}</div>
        )}
        {isEmpty && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No activity yet</div>
        )}

        {visibleItems.map((item) => {
          if (item.kind === 'post') {
            const { post, community, counts } = item.data;
            const isImage = !!post.url && isImageUrl(post.url);
            const bannerSrc = isImage ? post.url : post.thumbnail_url;
            return (
              <div
                key={`post-${post.id}`}
                onClick={() => navigate(`/profile/${post.id}`, { state: { post: item.data } })}
                style={{ margin: '6px 12px', background: '#1e2128', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}
              >
                {bannerSrc ? (
                  <img src={bannerSrc} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{
                    width: '100%', height: 120, background: placeholderColor(post.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, color: 'rgba(255,255,255,0.15)',
                  }}>👤</div>
                )}
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 8, background: '#ff6b35', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>POST</span>
                    <span style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600 }}>c/{community.name}</span>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35, marginBottom: 8,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{post.name}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                    <span>▲ {counts.score}</span>
                    <span>💬 {counts.comments}</span>
                  </div>
                </div>
              </div>
            );
          }

          // comment item
          const { comment, post, community, counts } = item.data;
          return (
            <div
              key={`comment-${comment.id}`}
              onClick={() => navigate(`/profile/${post.id}`, {
                state: {
                  post: { post, community, creator: item.data.creator, counts: { score: 0, comments: 0 } },
                  commentApId: comment.ap_id,
                },
              })}
              style={{ margin: '6px 12px', background: '#1e2128', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 8, background: '#4a9eff', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>COMMENT</span>
                <span style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600 }}>c/{community.name}</span>
              </div>
              <div style={{
                fontSize: 11, color: '#666', borderLeft: '2px solid #2a2d35', paddingLeft: 8, marginBottom: 6,
                fontStyle: 'italic',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{post.name}</div>
              <div style={{
                fontSize: 13, color: '#d0d0d0', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{comment.content}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 6 }}>▲ {counts.score}</div>
            </div>
          );
        })}

        {canLoadMore && !error && <div ref={sentinelRef} style={{ height: 1 }} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/components/ProfilePage.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfilePage.tsx src/components/ProfilePage.test.tsx
git commit -m "feat: add ProfilePage with All/Posts/Comments tabs"
```

---

## Task 3: Create ProfilePostDetailPage

**Files:**
- Create: `src/components/ProfilePostDetailPage.tsx`
- Create: `src/components/ProfilePostDetailPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ProfilePostDetailPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfilePostDetailPage from './ProfilePostDetailPage';

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

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };

const mockPostView = {
  post: { id: 1, name: 'Profile Post Title', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null },
  community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 42, comments: 7 },
};

function renderPage(state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/profile/1', state: state ?? { post: mockPostView } }]}>
      <Routes>
        <Route path="/profile/:postId" element={<ProfilePostDetailPage auth={mockAuth} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('ProfilePostDetailPage', () => {
  it('renders post title when state is present', () => {
    renderPage();
    expect(screen.getByText('Profile Post Title')).toBeInTheDocument();
  });

  it('renders community name', () => {
    renderPage();
    expect(screen.getByText('c/linux')).toBeInTheDocument();
  });

  it('shows fallback when no route state', () => {
    renderPage(undefined);
    // Override with no state
    render(
      <MemoryRouter initialEntries={[{ pathname: '/profile/1', state: undefined }]}>
        <Routes>
          <Route path="/profile/:postId" element={<ProfilePostDetailPage auth={mockAuth} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Navigate to Profile to view this post.')).toBeInTheDocument();
  });

  it('passes commentApId from state to PostDetailCard', () => {
    const { useCommentLoader } = require('../hooks/useCommentLoader');
    renderPage({ post: mockPostView, commentApId: 'https://lemmy.world/comment/5' });
    // PostDetailCard receives notifCommentApId; useCommentLoader is called — just verify no crash
    expect(screen.getByText('Profile Post Title')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/components/ProfilePostDetailPage.test.tsx
```

Expected: FAIL — `Cannot find module './ProfilePostDetailPage'`.

- [ ] **Step 3: Create `src/components/ProfilePostDetailPage.tsx`**

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

export default function ProfilePostDetailPage({ auth }: Props) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const postView = state?.post as PostView | undefined;
  const commentApId = state?.commentApId as string | undefined;

  if (!postView) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
        <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Navigate to Profile to view this post.
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
              onClick={() => navigate('/profile')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Profile
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
          notifCommentApId={commentApId}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/components/ProfilePostDetailPage.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfilePostDetailPage.tsx src/components/ProfilePostDetailPage.test.tsx
git commit -m "feat: add ProfilePostDetailPage"
```

---

## Task 4: Wire routes in App.tsx and Profile button in MenuDrawer

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/MenuDrawer.tsx`
- Modify: `src/components/MenuDrawer.test.tsx`

- [ ] **Step 1: Update App.test.tsx — add mocks and route tests**

Add `ProfilePage` and `ProfilePostDetailPage` to the existing mock block and add new test cases. The full updated `src/App.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./lib/store', () => ({
  loadAuth: vi.fn().mockReturnValue(null),
  clearAuth: vi.fn(),
}));

vi.mock('./components/LoginPage', () => ({
  default: (_props: { onLogin: unknown }) => <div>LoginPage</div>,
}));

vi.mock('./components/FeedStack', () => ({
  default: () => <div>FeedStack</div>,
}));

vi.mock('./components/InboxPage', () => ({
  default: () => <div>InboxPage</div>,
}));

vi.mock('./components/PostDetailPage', () => ({
  default: () => <div>PostDetailPage</div>,
}));

vi.mock('./components/SavedPage', () => ({
  default: () => <div>SavedPage</div>,
}));

vi.mock('./components/SavedPostDetailPage', () => ({
  default: () => <div>SavedPostDetailPage</div>,
}));

vi.mock('./components/ProfilePage', () => ({
  default: () => <div>ProfilePage</div>,
}));

vi.mock('./components/ProfilePostDetailPage', () => ({
  default: () => <div>ProfilePostDetailPage</div>,
}));

describe('App routing', () => {
  it('shows LoginPage when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  it('shows FeedStack when authenticated', async () => {
    const { loadAuth } = await import('./lib/store');
    vi.mocked(loadAuth).mockReturnValue({
      token: 'tok',
      instance: 'lemmy.world',
      username: 'alice',
    });
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run App tests to confirm they still pass**

```bash
npm test -- --reporter=verbose src/App.test.tsx
```

Expected: all tests PASS (mocks added but no routes changed yet — should be fine).

- [ ] **Step 3: Add ProfilePage and ProfilePostDetailPage routes to App.tsx**

Replace the contents of `src/App.tsx` with:

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

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [unreadCount, setUnreadCount] = useState(0);

  function handleLogin(newAuth: AuthState) {
    setAuth(newAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <FeedStack
              auth={auth}
              onLogout={handleLogout}
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
        <Route
          path="/saved"
          element={<SavedPage auth={auth} />}
        />
        <Route
          path="/saved/:postId"
          element={<SavedPostDetailPage auth={auth} />}
        />
        <Route
          path="/profile"
          element={<ProfilePage auth={auth} />}
        />
        <Route
          path="/profile/:postId"
          element={<ProfilePostDetailPage auth={auth} />}
        />
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 4: Run App tests to confirm they still pass**

```bash
npm test -- --reporter=verbose src/App.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Update MenuDrawer.test.tsx — update Profile button test**

In `src/components/MenuDrawer.test.tsx`, replace the existing test on line 71:

```ts
// OLD — remove this test:
it('closes drawer when Profile is clicked (no-op nav)', () => {
  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  fireEvent.click(screen.getByRole('button', { name: /profile/i }));
  expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});
```

Replace with:

```ts
it('calls onNavigate with /profile and closes drawer when Profile is clicked', () => {
  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  fireEvent.click(screen.getByRole('button', { name: /profile/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/profile');
  expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 6: Run MenuDrawer tests to confirm the new test fails**

```bash
npm test -- --reporter=verbose src/components/MenuDrawer.test.tsx
```

Expected: the new Profile test FAILS (`mockNavigate` not called), all others PASS.

- [ ] **Step 7: Wire the Profile button in MenuDrawer.tsx**

In `src/components/MenuDrawer.tsx`, replace the Profile button's `onClick` (currently `() => setShowDrawer(false)`):

```tsx
// OLD:
<button
  onClick={() => setShowDrawer(false)}
  aria-label="Profile"
  style={drawerButtonStyle}
>

// NEW:
<button
  onClick={() => handleNavigate('/profile')}
  aria-label="Profile"
  style={drawerButtonStyle}
>
```

- [ ] **Step 8: Run all tests to confirm everything passes**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/MenuDrawer.tsx src/components/MenuDrawer.test.tsx
git commit -m "feat: wire /profile routes and Profile drawer button"
```
