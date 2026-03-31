# User Profile Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users tap any username (on a post or comment) to view that person's public profile page showing their posts and comments.

**Architecture:** Parameterize the existing `ProfilePage` with an optional `target` prop so it can display any user's profile. Add a `/user/:instance/:username` route backed by a thin wrapper component. Make creator names tappable in `PostCard` and `CommentItem`, each rendering a small circular avatar alongside the name.

**Tech Stack:** React 18, TypeScript, React Router v6 (HashRouter), Vitest + @testing-library/react, CSS Modules

---

## File Map

| File | Change |
|------|--------|
| `src/lib/lemmy.ts` | Change `token: string` → `token: string \| undefined` in `fetchPersonDetails` |
| `src/components/ProfilePage.tsx` | Add optional `target` prop; derive fetch params from it |
| `src/components/ProfilePage.test.tsx` | Add tests for `target` prop behaviour |
| `src/App.tsx` | Add `UserProfileRoute` + `/user/:instance/:username` route |
| `src/App.test.tsx` | Add route smoke test |
| `src/components/PostCard.tsx` | Replace plain creator name with avatar + tappable link |
| `src/components/PostCard.module.css` | Add `.creatorLink`, `.creatorAvatar`, `.creatorAvatarFallback` |
| `src/components/PostCard.test.tsx` | Add `actor_id` to creator mock; add navigation test |
| `src/components/CommentItem.tsx` | Add `useNavigate`; replace author span with avatar + tappable link |
| `src/components/CommentItem.module.css` | Add `.creatorName`, `.creatorAvatar`, `.creatorAvatarFallback` |
| `src/components/CommentItem.test.tsx` | Mock `useNavigate`; add `actor_id` to mock; add navigation test |

---

### Task 1: Allow `fetchPersonDetails` to be called without a token

Public profiles don't require auth. The existing signature forces a token string.

**Files:**
- Modify: `src/lib/lemmy.ts`

- [ ] **Step 1: Update the function signature**

In `src/lib/lemmy.ts`, change line 182–194 from:

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

to:

```ts
export async function fetchPersonDetails(
  instance: string,
  token: string | undefined,
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

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors (the `client` function already accepts `token?: string`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/lemmy.ts
git commit -m "fix: allow fetchPersonDetails to be called without token for public profiles"
```

---

### Task 2: Parameterize ProfilePage with optional `target` prop

**Files:**
- Modify: `src/components/ProfilePage.tsx`
- Modify: `src/components/ProfilePage.test.tsx`

- [ ] **Step 1: Write failing tests for `target` prop**

Add these tests at the end of the `describe('ProfilePage', ...)` block in `src/components/ProfilePage.test.tsx`:

```ts
describe('ProfilePage with target prop', () => {
  it('fetches from target instance with no token when target is provided', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ posts: [], comments: [] });
    render(
      <MemoryRouter initialEntries={['/user/beehaw.org/bob']}>
        <ProfilePage auth={mockAuth} target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(fetchPersonDetails).toHaveBeenCalledWith('beehaw.org', undefined, 'bob', 1);
  });

  it('shows target username and instance in header', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ posts: [], comments: [] });
    render(
      <MemoryRouter initialEntries={['/user/beehaw.org/bob']}>
        <ProfilePage auth={mockAuth} target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.getByText('u/bob')).toBeInTheDocument();
    expect(screen.getByText('beehaw.org')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- ProfilePage 2>&1 | tail -20
```

Expected: 2 new tests fail (FAIL or type error since `target` prop doesn't exist yet).

- [ ] **Step 3: Update ProfilePage to accept and use `target`**

Replace the `Props` interface and the top of `ProfilePage` in `src/components/ProfilePage.tsx`:

```tsx
interface Props {
  auth: AuthState;
  target?: { username: string; instance: string };
}

export default function ProfilePage({ auth, target }: Props) {
  const navigate = useNavigate();
  const effectiveUsername = target?.username ?? auth.username;
  const effectiveInstance = target?.instance ?? auth.instance;
  const effectiveToken = target ? undefined : auth.token;

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
      const result = await fetchPersonDetails(effectiveInstance, effectiveToken, effectiveUsername, pageNum);
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
  }, [effectiveInstance, effectiveToken, effectiveUsername]);
```

Then update the header section (the `<div style={{ padding: '14px 14px 10px', ... }}>` block) to use the effective values:

```tsx
<div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #2a2d35' }}>
  <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 2 }}>
    u/{effectiveUsername}
  </div>
  <div style={{ fontSize: 11, color: '#666' }}>{effectiveInstance}</div>
</div>
```

- [ ] **Step 4: Run tests**

```bash
npm test -- ProfilePage 2>&1 | tail -20
```

Expected: all tests pass including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfilePage.tsx src/components/ProfilePage.test.tsx
git commit -m "feat: add optional target prop to ProfilePage for viewing other users"
```

---

### Task 3: Add `/user/:instance/:username` route

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing route test**

Add this test to `src/App.test.tsx` inside `describe('App routing', ...)`:

```ts
it('renders ProfilePage at /user/:instance/:username when authenticated', async () => {
  const { loadAuth } = await import('./lib/store');
  vi.mocked(loadAuth).mockReturnValue({
    token: 'tok',
    instance: 'lemmy.world',
    username: 'alice',
  });
  window.location.hash = '#/user/beehaw.org/bob';
  render(<App />);
  await waitFor(() => expect(screen.getByText('ProfilePage')).toBeInTheDocument());
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- App.test 2>&1 | tail -20
```

Expected: the new test fails (route not found, renders nothing at that path).

- [ ] **Step 3: Add `UserProfileRoute` and route to `App.tsx`**

After the `CommunityFeedRoute` function definition in `src/App.tsx`, add:

```tsx
function UserProfileRoute({ auth }: { auth: AuthState }) {
  const { instance, username } = useParams<{ instance: string; username: string }>();
  return <ProfilePage auth={auth} target={{ instance: instance!, username: username! }} />;
}
```

Inside `AuthenticatedApp`'s `<Routes>`, add the new route after the `/profile/:postId` route:

```tsx
<Route path="/user/:instance/:username" element={<UserProfileRoute auth={auth} />} />
```

- [ ] **Step 4: Run tests**

```bash
npm test -- App.test 2>&1 | tail -20
```

Expected: all App tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add /user/:instance/:username route for other user profiles"
```

---

### Task 4: Add creator avatar and tappable username to PostCard

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.module.css`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Write failing test**

In `src/components/PostCard.test.tsx`, update `MOCK_POST` to include `actor_id` on creator (needed for navigation):

```ts
const MOCK_POST = {
  post: { id: 1, name: 'Rust post', body: null, url: 'https://example.com', thumbnail_url: null },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'bob', actor_id: 'https://lemmy.world/u/bob', avatar: undefined },
  counts: { score: 200, comments: 15 },
} as unknown as PostView;
```

Then add this test inside `describe('PostCard', ...)`:

```ts
it('navigates to user profile when creator name is tapped', () => {
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
  fireEvent.click(screen.getByText('bob'));
  expect(mockNavigate).toHaveBeenCalledWith('/user/lemmy.world/bob');
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- PostCard.test 2>&1 | tail -20
```

Expected: new test fails (creator name is not a button/link, click doesn't navigate).

- [ ] **Step 3: Add CSS classes to `PostCard.module.css`**

Append to the end of `src/components/PostCard.module.css`:

```css
.creatorLink {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--accent);
  font-size: 0.7rem;
  background: none;
  border: none;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.creatorAvatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.creatorAvatarFallback {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Update the meta section in `PostCard.tsx`**

`PostCard.tsx` already imports `instanceFromActorId` and `placeholderColor` from `../lib/urlUtils`.

Replace the `instanceName` div (currently `<div className={styles.instanceName}>{instance} • {creator.display_name ?? creator.name}</div>`) with:

```tsx
<div className={styles.instanceName}>{instance}</div>
<button
  className={styles.creatorLink}
  onClick={(e) => {
    e.stopPropagation();
    navigate(`/user/${instanceFromActorId(creator.actor_id)}/${creator.name}`);
  }}
>
  {creator.avatar ? (
    <img src={creator.avatar} alt="" className={styles.creatorAvatar} />
  ) : (
    <span
      className={styles.creatorAvatarFallback}
      style={{ background: placeholderColor(creator.name) }}
    >
      {creator.name.charAt(0).toUpperCase()}
    </span>
  )}
  {creator.display_name ?? creator.name}
</button>
```

- [ ] **Step 5: Run tests**

```bash
npm test -- PostCard.test 2>&1 | tail -20
```

Expected: all tests pass including the new navigation test.

- [ ] **Step 6: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.module.css src/components/PostCard.test.tsx
git commit -m "feat: add creator avatar and tappable username to PostCard"
```

---

### Task 5: Add creator avatar and tappable username to CommentItem

**Files:**
- Modify: `src/components/CommentItem.tsx`
- Modify: `src/components/CommentItem.module.css`
- Modify: `src/components/CommentItem.test.tsx`

- [ ] **Step 1: Write failing tests**

In `src/components/CommentItem.test.tsx`:

Add `useNavigate` mock at the top (after the existing `vi.mock('../lib/lemmy', ...)` block):

```ts
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});
```

Update `mockCv` to include `actor_id` on creator:

```ts
const mockCv = {
  comment: { id: 7, content: '**Bold** and ![img](https://example.com/img.png)', path: '0.7', ap_id: 'https://lemmy.world/comment/7' },
  creator: { name: 'alice', actor_id: 'https://beehaw.org/u/alice', avatar: undefined },
  counts: { score: 10 },
};
```

Add `mockNavigate` to `beforeEach` clear:

```ts
beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });
```

Add these two tests inside `describe('CommentItem', ...)`:

```ts
it('tapping the author name navigates to user profile', () => {
  render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
  fireEvent.click(screen.getByText(/@alice/));
  expect(mockNavigate).toHaveBeenCalledWith('/user/beehaw.org/alice');
});

it('tapping the author name does not trigger the double-tap like', async () => {
  const { likeComment } = await import('../lib/lemmy');
  render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
  // Two rapid clicks on the author name — stopPropagation prevents them reaching the comment div
  await act(async () => {
    fireEvent.click(screen.getByText(/@alice/));
    fireEvent.click(screen.getByText(/@alice/));
  });
  expect(likeComment).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- CommentItem.test 2>&1 | tail -20
```

Expected: 2 new tests fail.

- [ ] **Step 3: Add CSS classes to `CommentItem.module.css`**

Append to the end of `src/components/CommentItem.module.css`:

```css
.creatorName {
  cursor: pointer;
}

.creatorAvatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.creatorAvatarFallback {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Update `CommentItem.tsx`**

Add `useNavigate` import and `instanceFromActorId`, `placeholderColor` imports. Replace:

```tsx
import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { likeComment, resolveCommentId, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import styles from './CommentItem.module.css';
```

with:

```tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { likeComment, resolveCommentId, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId, placeholderColor } from '../lib/urlUtils';
import styles from './CommentItem.module.css';
```

Add `useNavigate` at the top of the component function (after the existing hooks):

```tsx
export default function CommentItem({ cv, auth, depth, onReply, isHighlighted }: Props) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  // ... rest of existing hooks unchanged
```

Replace the `authorRow` div content. The current content is:

```tsx
<div className={styles.authorRow}>
  <span>@{cv.creator.display_name ?? cv.creator.name}</span>
  <span className={liked ? styles.scoreLiked : styles.score}>▲ {score}</span>
  {flash.key > 0 && (
    <span key={flash.key} className={styles.scoreFlash}>
      {flash.delta > 0 ? '+1' : '-1'}
    </span>
  )}
</div>
```

Replace with:

```tsx
<div className={styles.authorRow}>
  {cv.creator.avatar ? (
    <img src={cv.creator.avatar} alt="" className={styles.creatorAvatar} />
  ) : (
    <span
      className={styles.creatorAvatarFallback}
      style={{ background: placeholderColor(cv.creator.name) }}
    >
      {cv.creator.name.charAt(0).toUpperCase()}
    </span>
  )}
  <span
    className={styles.creatorName}
    onClick={(e) => {
      e.stopPropagation();
      navigate(`/user/${instanceFromActorId(cv.creator.actor_id)}/${cv.creator.name}`);
    }}
  >
    @{cv.creator.display_name ?? cv.creator.name}
  </span>
  <span className={liked ? styles.scoreLiked : styles.score}>▲ {score}</span>
  {flash.key > 0 && (
    <span key={flash.key} className={styles.scoreFlash}>
      {flash.delta > 0 ? '+1' : '-1'}
    </span>
  )}
</div>
```

- [ ] **Step 5: Run tests**

```bash
npm test -- CommentItem.test 2>&1 | tail -20
```

Expected: all tests pass including the 2 new ones.

- [ ] **Step 6: Run all tests to confirm nothing is broken**

```bash
npm test 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/CommentItem.tsx src/components/CommentItem.module.css src/components/CommentItem.test.tsx
git commit -m "feat: add creator avatar and tappable username to CommentItem"
```
