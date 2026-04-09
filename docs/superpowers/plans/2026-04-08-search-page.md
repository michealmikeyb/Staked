# Search Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Search page to the menu drawer that lets users search for communities and posts via the Lemmy API.

**Architecture:** Two new API functions (`searchCommunities`, `searchPosts`) make parallel typed calls on submit. `SearchPage` shows results in two tabs with independent pagination. `PostViewPage` is a new authenticated post detail view reachable at `/view/:instance/:postId`, matching the share link URL structure.

**Tech Stack:** React 18, TypeScript, React Router v6, lemmy-js-client v0.19, Vitest + Testing Library

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/lemmy.ts` | Add `searchCommunities`, `searchPosts`; export `CommunityView` |
| Modify | `src/lib/lemmy.test.ts` | Add tests for the two new search functions |
| Create | `src/components/PostViewPage.tsx` | Authenticated post detail fetched from URL params |
| Create | `src/components/PostViewPage.test.tsx` | Tests for PostViewPage |
| Create | `src/components/SearchPage.tsx` | Search UI: input, tabs, community + post results |
| Create | `src/components/SearchPage.test.tsx` | Tests for SearchPage |
| Modify | `src/components/MenuDrawer.tsx` | Add Search button; change grid to 2×3 |
| Modify | `src/components/MenuDrawer.test.tsx` | Add tests for Search button |
| Modify | `src/App.tsx` | Add `/search` and `/view/:instance/:postId` routes |

---

## Task 1: Add search API functions to lemmy.ts

**Files:**
- Modify: `src/lib/lemmy.ts`
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Write failing tests**

Open `src/lib/lemmy.test.ts`. Add `search` to the `MockLemmyHttp` mock object (inside the existing `vi.mock('lemmy-js-client', ...)` block), and add two new test cases at the bottom of the file:

```ts
// Add inside MockLemmyHttp's returned object, alongside the other mocked methods:
search: vi.fn().mockResolvedValue({
  type_: 'All',
  communities: [
    {
      community: {
        id: 10,
        name: 'rust',
        actor_id: 'https://lemmy.world/c/rust',
        icon: undefined,
        description: 'The Rust programming language',
      },
      counts: { subscribers: 5000 },
    },
  ],
  posts: [
    { post: { id: 99, name: 'Rust is great', ap_id: 'https://lemmy.world/post/99' }, counts: { score: 50, comments: 10 } },
  ],
  comments: [],
  users: [],
}),
```

In `src/lib/lemmy.test.ts`, also add `searchCommunities, searchPosts` to the existing import at line 2:

```ts
// Change the existing import line to include the new functions, e.g.:
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments, likeComment, createComment, editComment, fetchPersonDetails, fetchPost, resolveCommunityId, createPost, uploadImage, searchCommunities, searchPosts } from './lemmy';
```

Then add these two describe blocks at the bottom of the file:

```ts
describe('searchCommunities', () => {
  it('calls search with Communities type and returns communities array', async () => {
    const result = await searchCommunities('lemmy.world', 'tok', 'rust', 1);
    expect(result).toHaveLength(1);
    expect(result[0].community.name).toBe('rust');
  });
});

describe('searchPosts', () => {
  it('calls search with Posts type and returns posts array', async () => {
    const result = await searchPosts('lemmy.world', 'tok', 'rust', 1);
    expect(result).toHaveLength(1);
    expect(result[0].post.name).toBe('Rust is great');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/lib/lemmy.test.ts
```

Expected: FAIL — `searchCommunities` and `searchPosts` are not exported.

- [ ] **Step 3: Add the functions and export CommunityView**

In `src/lib/lemmy.ts`, change the top export line from:
```ts
export type { PostView, CommentView, SortType, CommentReplyView, PersonMentionView };
```
to:
```ts
import { LemmyHttp, type PostView, type CommentView, type SortType, type CommentReplyView, type PersonMentionView, type CommunityView } from 'lemmy-js-client';

export type { PostView, CommentView, SortType, CommentReplyView, PersonMentionView, CommunityView };
```

Then add these two functions at the bottom of `src/lib/lemmy.ts`:

```ts
export async function searchCommunities(
  instance: string,
  token: string,
  query: string,
  page: number,
): Promise<CommunityView[]> {
  const res = await client(instance, token).search({
    q: query,
    type_: 'Communities',
    sort: 'TopAll',
    page,
    limit: 20,
  });
  return res.communities;
}

export async function searchPosts(
  instance: string,
  token: string,
  query: string,
  page: number,
): Promise<PostView[]> {
  const res = await client(instance, token).search({
    q: query,
    type_: 'Posts',
    sort: 'TopAll',
    page,
    limit: 20,
  });
  return res.posts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/lib/lemmy.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add searchCommunities and searchPosts API functions"
```

---

## Task 2: PostViewPage

**Files:**
- Create: `src/components/PostViewPage.tsx`
- Create: `src/components/PostViewPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/PostViewPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostViewPage from './PostViewPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  fetchPost: vi.fn(),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockPostView = {
  post: {
    id: 1,
    name: 'A Great Post',
    ap_id: 'https://lemmy.world/post/1',
    url: null,
    thumbnail_url: null,
    body: 'Post body content',
    nsfw: false,
  },
  community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
  creator: { name: 'alice', display_name: null, actor_id: 'https://lemmy.world/u/alice' },
  counts: { score: 42, comments: 3, child_count: 3 },
};

function renderPage(instance = 'lemmy.world', postId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/view/${instance}/${postId}`]}>
      <Routes>
        <Route path="/view/:instance/:postId" element={<PostViewPage auth={mockAuth} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { fetchPost } = await import('../lib/lemmy');
  (fetchPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPostView);
});

describe('PostViewPage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders post title after loading', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('A Great Post')).toBeInTheDocument(),
    );
  });

  it('shows error state when fetch fails', async () => {
    const { fetchPost } = await import('../lib/lemmy');
    (fetchPost as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Not found'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Post not found')).toBeInTheDocument(),
    );
  });

  it('shows error state for non-numeric postId', async () => {
    renderPage('lemmy.world', 'not-a-number');
    await waitFor(() =>
      expect(screen.getByText('Post not found')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/PostViewPage.test.tsx
```

Expected: FAIL — `PostViewPage` does not exist.

- [ ] **Step 3: Create PostViewPage.tsx**

Create `src/components/PostViewPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPost, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth: AuthState;
}

export default function PostViewPage({ auth }: Props) {
  const { instance, postId } = useParams<{ instance: string; postId: string }>();
  const navigate = useNavigate();
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer
        onNavigate={navigate}
        onLogoClick={() => navigate('/')}
        leftContent={
          isIOS ? (
            <button
              onClick={() => navigate('/search')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Search
            </button>
          ) : undefined
        }
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        {!postView && !error && (
          <div style={{ marginTop: 80, color: '#888' }}>Loading…</div>
        )}
        {error && (
          <div style={{ marginTop: 80, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: '1rem' }}>Post not found</div>
          </div>
        )}
        {postView && (
          <PostDetailCard
            post={postView.post}
            community={postView.community}
            creator={postView.creator}
            counts={{ score: postView.counts.score, comments: postView.counts.comments }}
            auth={auth}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/PostViewPage.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PostViewPage.tsx src/components/PostViewPage.test.tsx
git commit -m "feat: add PostViewPage for authenticated post detail at /view/:instance/:postId"
```

---

## Task 3: SearchPage

**Files:**
- Create: `src/components/SearchPage.tsx`
- Create: `src/components/SearchPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/SearchPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchPage from './SearchPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  searchCommunities: vi.fn(),
  searchPosts: vi.fn(),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockCommunity = {
  community: {
    id: 10,
    name: 'rust',
    actor_id: 'https://lemmy.world/c/rust',
    icon: undefined,
    description: 'The Rust programming language',
  },
  counts: { subscribers: 5000 },
  subscribed: 'NotSubscribed',
  blocked: false,
  banned_from_community: false,
};

const mockPost = {
  post: {
    id: 99,
    name: 'Rust is great',
    ap_id: 'https://lemmy.world/post/99',
    url: null,
    thumbnail_url: null,
    body: null,
  },
  community: { name: 'rust', actor_id: 'https://lemmy.world/c/rust' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 50, comments: 10, child_count: 10 },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <SearchPage auth={mockAuth} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { searchCommunities, searchPosts } = await import('../lib/lemmy');
  (searchCommunities as ReturnType<typeof vi.fn>).mockResolvedValue([mockCommunity]);
  (searchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([mockPost]);
});

describe('SearchPage', () => {
  it('shows initial prompt before any search', () => {
    renderPage();
    expect(screen.getByText('Search communities and posts')).toBeInTheDocument();
  });

  it('shows loading state while searching', async () => {
    const { searchCommunities } = await import('../lib/lemmy');
    (searchCommunities as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders community results after searching', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() =>
      expect(screen.getByText('c/rust')).toBeInTheDocument(),
    );
    expect(screen.getByText('5,000 subscribers')).toBeInTheDocument();
  });

  it('switches to Posts tab and shows post results', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('Communities'));
    fireEvent.click(screen.getByRole('button', { name: /posts/i }));
    expect(screen.getByText('Rust is great')).toBeInTheDocument();
  });

  it('shows empty state when no community results', async () => {
    const { searchCommunities } = await import('../lib/lemmy');
    (searchCommunities as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyzzy' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() =>
      expect(screen.getByText(/No results for/)).toBeInTheDocument(),
    );
  });

  it('shows error state when search fails', async () => {
    const { searchCommunities } = await import('../lib/lemmy');
    (searchCommunities as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() =>
      expect(screen.getByText('Network error')).toBeInTheDocument(),
    );
  });

  it('navigates to community when community result is clicked', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('c/rust'));
    fireEvent.click(screen.getByText('c/rust'));
    expect(mockNavigate).toHaveBeenCalledWith('/community/lemmy.world/rust');
  });

  it('navigates to /view/:instance/:postId when post result is clicked', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('Communities'));
    fireEvent.click(screen.getByRole('button', { name: /posts/i }));
    fireEvent.click(screen.getByText('Rust is great'));
    expect(mockNavigate).toHaveBeenCalledWith('/view/lemmy.world/99');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/SearchPage.test.tsx
```

Expected: FAIL — `SearchPage` does not exist.

- [ ] **Step 3: Create SearchPage.tsx**

Create `src/components/SearchPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCommunities, searchPosts, type CommunityView, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId, sourceFromApId, isImageUrl, placeholderColor } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';
import CommunityAvatar from './CommunityAvatar';

type Tab = 'communities' | 'posts';

interface Props {
  auth: AuthState;
}

export default function SearchPage({ auth }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('communities');
  const [communities, setCommunities] = useState<CommunityView[]>([]);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [communityPage, setCommunityPage] = useState(1);
  const [postPage, setPostPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMoreCommunities, setCanLoadMoreCommunities] = useState(false);
  const [canLoadMorePosts, setCanLoadMorePosts] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setCommunities([]);
    setPosts([]);
    setCommunityPage(1);
    setPostPage(1);
    const q = query.trim();
    setLastQuery(q);
    try {
      const [comms, ps] = await Promise.all([
        searchCommunities(auth.instance, auth.token, q, 1),
        searchPosts(auth.instance, auth.token, q, 1),
      ]);
      setCommunities(comms);
      setPosts(ps);
      setCanLoadMoreCommunities(comms.length === 20);
      setCanLoadMorePosts(ps.length === 20);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      if (activeTab === 'communities') {
        const nextPage = communityPage + 1;
        const more = await searchCommunities(auth.instance, auth.token, lastQuery, nextPage);
        setCommunities((prev) => [...prev, ...more]);
        setCommunityPage(nextPage);
        setCanLoadMoreCommunities(more.length === 20);
      } else {
        const nextPage = postPage + 1;
        const more = await searchPosts(auth.instance, auth.token, lastQuery, nextPage);
        setPosts((prev) => [...prev, ...more]);
        setPostPage(nextPage);
        setCanLoadMorePosts(more.length === 20);
      }
    } catch {
      // silently fail on load more
    } finally {
      setLoadingMore(false);
    }
  }

  const canLoadMore = activeTab === 'communities' ? canLoadMoreCommunities : canLoadMorePosts;

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    flex: 1, padding: '10px 0', background: 'none', border: 'none',
    cursor: 'pointer', color: activeTab === tab ? '#ff6b35' : '#888',
    fontWeight: activeTab === tab ? 700 : 400, fontSize: 14,
    borderBottom: activeTab === tab ? '2px solid #ff6b35' : '2px solid transparent',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, padding: '12px 12px 0' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities and posts…"
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: '1px solid #2a2d35', background: '#1e2128',
              color: '#f5f5f5', fontSize: 14, outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: '#ff6b35', color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            Search
          </button>
        </form>

        {searched && (
          <div style={{ display: 'flex', borderBottom: '1px solid #2a2d35', margin: '12px 0 0' }}>
            <button style={tabStyle('communities')} onClick={() => setActiveTab('communities')}>
              Communities
            </button>
            <button style={tabStyle('posts')} onClick={() => setActiveTab('posts')}>
              Posts
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading…</div>
        )}
        {!loading && error && (
          <div style={{ textAlign: 'center', color: '#ff4444', padding: 32 }}>{error}</div>
        )}
        {!loading && !error && !searched && (
          <div style={{ textAlign: 'center', color: '#555', padding: 32 }}>Search communities and posts</div>
        )}

        {!loading && !error && searched && activeTab === 'communities' && (
          communities.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No results for "{lastQuery}"</div>
          ) : (
            communities.map((cv) => {
              const { community, counts } = cv;
              const instance = instanceFromActorId(community.actor_id);
              return (
                <div
                  key={community.id}
                  onClick={() => navigate(`/community/${instance}/${community.name}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    margin: '6px 12px', padding: 12,
                    background: '#1e2128', borderRadius: 12, cursor: 'pointer',
                  }}
                >
                  <CommunityAvatar name={community.name} icon={community.icon} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#ff6b35' }}>c/{community.name}</div>
                    <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                      {counts.subscribers.toLocaleString()} subscribers
                    </div>
                    {community.description && (
                      <div style={{
                        fontSize: 12, color: '#aaa', marginTop: 4, lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {community.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}

        {!loading && !error && searched && activeTab === 'posts' && (
          posts.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No results for "{lastQuery}"</div>
          ) : (
            posts.map((pv) => {
              const { post, community, counts } = pv;
              const source = sourceFromApId(post.ap_id);
              const isImage = !!post.url && isImageUrl(post.url);
              const bannerSrc = isImage ? post.url : post.thumbnail_url;
              return (
                <div
                  key={post.id}
                  onClick={() => {
                    if (source) navigate(`/view/${source.instance}/${source.postId}`);
                  }}
                  style={{
                    margin: '6px 12px', background: '#1e2128',
                    borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                  }}
                >
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
                      🔍
                    </div>
                  )}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600, marginBottom: 5 }}>
                      c/{community.name}
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35, marginBottom: 8,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {post.name}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                      <span>▲ {counts.score}</span>
                      <span>💬 {counts.comments}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}

        {!loading && searched && canLoadMore && (
          <div style={{ padding: '8px 12px 16px', textAlign: 'center' }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: '#1e2128', color: '#aaa',
                cursor: loadingMore ? 'not-allowed' : 'pointer', fontSize: 13,
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/SearchPage.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchPage.tsx src/components/SearchPage.test.tsx
git commit -m "feat: add SearchPage with community and post tabs"
```

---

## Task 4: Update MenuDrawer

**Files:**
- Modify: `src/components/MenuDrawer.tsx`
- Modify: `src/components/MenuDrawer.test.tsx`

- [ ] **Step 1: Write failing tests**

Add these two tests to the end of the `describe('MenuDrawer', ...)` block in `src/components/MenuDrawer.test.tsx`:

```ts
it('renders Search button when drawer is open', () => {
  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
});

it('calls onNavigate with /search and closes drawer when Search is clicked', () => {
  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  fireEvent.click(screen.getByRole('button', { name: /search/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/search');
  expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/MenuDrawer.test.tsx
```

Expected: FAIL — Search button does not exist in drawer.

- [ ] **Step 3: Update MenuDrawer.tsx**

In `src/components/MenuDrawer.tsx`, make two changes:

1. Change the grid column from 5 to 3:
```tsx
// Change this line:
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
// To:
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
```

2. Add the Search button after the existing Post button (inside the grid div):
```tsx
<button
  onClick={() => handleNavigate('/search')}
  aria-label="Search"
  style={drawerButtonStyle}
>
  <span style={iconStyle}>🔍</span>
  Search
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/MenuDrawer.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MenuDrawer.tsx src/components/MenuDrawer.test.tsx
git commit -m "feat: add Search button to menu drawer, change grid to 2x3"
```

---

## Task 5: Wire routes in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports and routes**

In `src/App.tsx`, add the two new imports alongside the existing ones:

```tsx
import SearchPage from './components/SearchPage';
import PostViewPage from './components/PostViewPage';
```

Then add two new `<Route>` entries inside `AuthenticatedApp`'s `<Routes>`, alongside the existing routes:

```tsx
<Route path="/search" element={<SearchPage auth={auth} />} />
<Route
  path="/view/:instance/:postId"
  element={<PostViewPage auth={auth} />}
/>
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Build to verify TypeScript**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire /search and /view/:instance/:postId routes"
```
