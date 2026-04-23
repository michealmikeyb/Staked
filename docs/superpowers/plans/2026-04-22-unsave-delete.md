# Unsave Post + Delete Own Post/Comment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add save toggle on post cards, unsave from SavedPage, and delete own posts/comments from ProfilePage with inline confirmation.

**Architecture:** API layer gains `save` boolean param on `savePost` plus new `deletePost`/`deleteComment` functions. PostCardShell tracks save state locally with optimistic toggle. ProfilePage detects own-profile and renders inline delete confirmation strips on post/comment cards.

**Tech Stack:** React 18 + TypeScript, lemmy-js-client v0.19, Vitest + Testing Library

---

### Task 1: Extend the API layer

**Files:**
- Modify: `src/lib/lemmy.ts`

- [ ] **Step 1: Write the failing tests**

Add to a new temporary test block at the bottom of `src/lib/lemmy.ts` — actually, the API functions are integration-tested through the component tests. The key verification here is type-level: the function signature. Skip a standalone unit test for these thin wrappers; component tests in Tasks 2–4 will exercise them. Move straight to implementation.

- [ ] **Step 2: Update `savePost` to accept a `save` boolean**

In `src/lib/lemmy.ts`, change:
```ts
export async function savePost(
  instance: string,
  token: string,
  postId: number,
): Promise<void> {
  await client(instance, token).savePost({ post_id: postId, save: true });
}
```
to:
```ts
export async function savePost(
  instance: string,
  token: string,
  postId: number,
  save: boolean,
): Promise<void> {
  await client(instance, token).savePost({ post_id: postId, save });
}
```

- [ ] **Step 3: Add `deletePost`**

After `savePost` in `src/lib/lemmy.ts`, add:
```ts
export async function deletePost(
  instance: string,
  token: string,
  postId: number,
): Promise<void> {
  await client(instance, token).deletePost({ post_id: postId, deleted: true });
}
```

- [ ] **Step 4: Add `deleteComment`**

After `deletePost`, add:
```ts
export async function deleteComment(
  instance: string,
  token: string,
  commentId: number,
): Promise<void> {
  await client(instance, token).deleteComment({ comment_id: commentId, deleted: true });
}
```

- [ ] **Step 5: Update the export line at the top of `lemmy.ts`**

The file doesn't use a barrel export — functions are exported inline. No change needed here.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lemmy.ts
git commit -m "feat: add save boolean to savePost, add deletePost and deleteComment"
```

---

### Task 2: Save toggle in PostCardShell

**Files:**
- Modify: `src/components/PostCardShell.tsx`
- Modify: `src/components/PostCardShell.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/PostCardShell.test.tsx`:

1. Update the existing mock to include `save: boolean` — the mock signature doesn't need to change since it's `vi.fn()`, but do add `deletePost` to the mock object so it doesn't break later tasks:
```ts
vi.mock('../lib/lemmy', () => ({
  savePost: vi.fn().mockResolvedValue(undefined),
  deletePost: vi.fn().mockResolvedValue(undefined),
  deleteComment: vi.fn().mockResolvedValue(undefined),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
  editComment: vi.fn().mockResolvedValue({
    comment: { id: 1, content: 'Edited', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
    creator: { name: 'alice', display_name: null },
    counts: { score: 1 },
  }),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));
```

2. Update the existing failing test (it will break once `savePost` requires 4 args — fix it now):
```ts
it('clicking Save calls savePost with save=true', async () => {
  renderShell();
  fireEvent.click(screen.getByTestId('save-button'));
  await waitFor(() => expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1, true));
});
```

3. Add new tests after the existing save tests:
```ts
it('save button shows "🔖 Save" when post.saved is false', () => {
  renderShell({ post: { ...POST, saved: false } });
  expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Save');
});

it('save button shows "🔖 Saved" when post.saved is true', () => {
  renderShell({ post: { ...POST, saved: true } });
  expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Saved');
});

it('clicking Saved button calls savePost with save=false', async () => {
  renderShell({ post: { ...POST, saved: true } });
  fireEvent.click(screen.getByTestId('save-button'));
  await waitFor(() => expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1, false));
});

it('save button toggles to Saved optimistically after clicking Save', async () => {
  renderShell({ post: { ...POST, saved: false } });
  fireEvent.click(screen.getByTestId('save-button'));
  await waitFor(() => expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Saved'));
});

it('save button reverts to Save when savePost throws', async () => {
  const { savePost: mockSave } = await import('../lib/lemmy');
  (mockSave as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
  renderShell({ post: { ...POST, saved: false } });
  fireEvent.click(screen.getByTestId('save-button'));
  await waitFor(() => expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Save'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- PostCardShell
```
Expected: several failures — `save-button` text content mismatches and `savePost` call arg count.

- [ ] **Step 3: Update `PostCardShell.tsx` — Post interface**

In `src/components/PostCardShell.tsx`, add `saved?: boolean` to the `Post` interface:
```ts
interface Post {
  id: number;
  name: string;
  ap_id: string;
  url?: string | null;
  body?: string | null;
  thumbnail_url?: string | null;
  nsfw?: boolean;
  published: string;
  saved?: boolean;
}
```

- [ ] **Step 4: Update `PostCardShell.tsx` — save state and handler**

Add `localSaved` state and rewrite `handleSave`. In the component body, replace:
```ts
const [saveToastVisible, setSaveToastVisible] = useState(false);
```
with:
```ts
const [localSaved, setLocalSaved] = useState(post.saved ?? false);
const [saveToastVisible, setSaveToastVisible] = useState(false);
```

Replace `handleSave`:
```ts
const handleSave = async () => {
  if (!auth) return;
  const newSaved = !localSaved;
  setLocalSaved(newSaved);
  try {
    await savePost(auth.instance, auth.token, post.id, newSaved);
    if (newSaved) setSaveToastVisible(true);
  } catch {
    setLocalSaved(!newSaved);
  }
};
```

- [ ] **Step 5: Update `PostCardShell.tsx` — save button JSX**

Replace the save button:
```tsx
{auth && (
  <button
    data-testid="save-button"
    className={styles.footerAction}
    style={localSaved ? { color: '#ff6b35' } : undefined}
    onClick={(e) => { e.stopPropagation(); handleSave(); }}
  >
    {localSaved ? '🔖 Saved' : '🔖 Save'}
  </button>
)}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- PostCardShell
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx
git commit -m "feat: toggle save state on post card with optimistic update"
```

---

### Task 3: Unsave button on SavedPage

**Files:**
- Modify: `src/components/SavedPage.tsx`
- Modify: `src/components/SavedPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/SavedPage.test.tsx`, update the mock to include `savePost`:
```ts
vi.mock('../lib/lemmy', () => ({
  fetchSavedPosts: vi.fn(),
  savePost: vi.fn().mockResolvedValue(undefined),
}));
```

Add these tests at the bottom of the `describe('SavedPage')` block:
```ts
it('renders an Unsave button on each post card', async () => {
  renderPage();
  await waitFor(() => screen.getByText('A Saved Post'));
  expect(screen.getByRole('button', { name: /unsave/i })).toBeInTheDocument();
});

it('clicking Unsave calls savePost with save=false', async () => {
  const { savePost } = await import('../lib/lemmy');
  renderPage();
  await waitFor(() => screen.getByText('A Saved Post'));
  fireEvent.click(screen.getByRole('button', { name: /unsave/i }));
  await waitFor(() =>
    expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1, false),
  );
});

it('clicking Unsave removes the post from the list', async () => {
  renderPage();
  await waitFor(() => screen.getByText('A Saved Post'));
  fireEvent.click(screen.getByRole('button', { name: /unsave/i }));
  await waitFor(() =>
    expect(screen.queryByText('A Saved Post')).not.toBeInTheDocument(),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- SavedPage
```
Expected: FAIL — `unsave` button not found.

- [ ] **Step 3: Update `SavedPage.tsx` — add savePost import**

Add `savePost` to the import from `../lib/lemmy`:
```ts
import { fetchSavedPosts, savePost, type PostView } from '../lib/lemmy';
```

- [ ] **Step 4: Update `SavedPage.tsx` — add unsave handler**

After the `loadPage` callback, add:
```ts
const handleUnsave = async (postId: number) => {
  try {
    await savePost(auth.instance, auth.token, postId, false);
    setPosts((prev) => prev.filter((pv) => pv.post.id !== postId));
  } catch {
    // suppress silently
  }
};
```

- [ ] **Step 5: Update `SavedPage.tsx` — add Unsave button to each card**

Inside the card's `<div style={{ padding: '10px 12px 12px' }}>`, add the unsave button after the stats row. Replace:
```tsx
<div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
  <span>▲ {counts.score}</span>
  <span>💬 {counts.comments}</span>
</div>
```
with:
```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
    <span>▲ {counts.score}</span>
    <span>💬 {counts.comments}</span>
  </div>
  <button
    aria-label="Unsave"
    onClick={(e) => { e.stopPropagation(); handleUnsave(post.id); }}
    style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 12, color: '#888', padding: '2px 6px',
    }}
  >
    🔖 Unsave
  </button>
</div>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- SavedPage
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/SavedPage.tsx src/components/SavedPage.test.tsx
git commit -m "feat: add Unsave button to SavedPage cards"
```

---

### Task 4: Delete own posts and comments from ProfilePage

**Files:**
- Modify: `src/components/ProfilePage.tsx`
- Modify: `src/components/ProfilePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `src/components/ProfilePage.test.tsx`, add `deletePost` and `deleteComment` to the mock:
```ts
vi.mock('../lib/lemmy', () => ({
  fetchPersonDetails: vi.fn(),
  blockPerson: vi.fn().mockResolvedValue(undefined),
  deletePost: vi.fn().mockResolvedValue(undefined),
  deleteComment: vi.fn().mockResolvedValue(undefined),
}));
```

Add a new describe block at the bottom of the file:
```ts
describe('ProfilePage delete (own profile)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [mockPost],
      comments: [mockComment],
      personId: null,
    });
  });

  it('shows delete button on post card when viewing own profile', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByRole('button', { name: /delete post/i })).toBeInTheDocument();
  });

  it('does not show delete button when viewing another user profile', async () => {
    render(
      <MemoryRouter initialEntries={['/user/beehaw.org/bob']}>
        <ProfilePage auth={mockAuth} target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.queryByRole('button', { name: /delete post/i })).not.toBeInTheDocument();
  });

  it('clicking delete post button shows inline confirmation strip', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: /delete post/i }));
    expect(screen.getByText('Delete post?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('clicking Cancel in post confirm strip reverts to normal card', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: /delete post/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Delete post?')).not.toBeInTheDocument();
  });

  it('confirming post delete calls deletePost and removes post from list', async () => {
    const { deletePost } = await import('../lib/lemmy');
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: /delete post/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1));
    await waitFor(() => expect(screen.queryByText('My Terminal Setup')).not.toBeInTheDocument());
  });

  it('shows delete button on comment card when viewing own profile', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
  });

  it('clicking delete comment button shows inline confirmation strip', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    fireEvent.click(screen.getByRole('button', { name: /delete comment/i }));
    expect(screen.getByText('Delete comment?')).toBeInTheDocument();
  });

  it('confirming comment delete calls deleteComment and removes comment from list', async () => {
    const { deleteComment } = await import('../lib/lemmy');
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    fireEvent.click(screen.getByRole('button', { name: /delete comment/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(deleteComment).toHaveBeenCalledWith('lemmy.world', 'tok', 5));
    await waitFor(() => expect(screen.queryByText('Great post!')).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- ProfilePage
```
Expected: FAIL — delete buttons not found.

- [ ] **Step 3: Update `ProfilePage.tsx` — add imports and state**

Add `deletePost` and `deleteComment` to the lemmy import:
```ts
import { fetchPersonDetails, blockPerson, deletePost, deleteComment, type PostView, type CommentView } from '../lib/lemmy';
```

Add `deleteConfirm` state and `isOwnProfile` computed value in the component body, after the existing state declarations:
```ts
const isOwnProfile = !target || (target.username === auth?.username && target.instance === auth?.instance);
const [deleteConfirm, setDeleteConfirm] = useState<{ kind: 'post' | 'comment'; id: number } | null>(null);
```

- [ ] **Step 4: Add `handleDeletePost` and `handleDeleteComment`**

After `handleBlockPerson`, add:
```ts
async function handleDeletePost(postId: number) {
  if (!auth) return;
  try {
    await deletePost(auth.instance, auth.token, postId);
    setPosts((prev) => prev.filter((pv) => pv.post.id !== postId));
  } catch {
    // suppress silently
  } finally {
    setDeleteConfirm(null);
  }
}

async function handleDeleteComment(commentId: number) {
  if (!auth) return;
  try {
    await deleteComment(auth.instance, auth.token, commentId);
    setComments((prev) => prev.filter((cv) => cv.comment.id !== commentId));
  } catch {
    // suppress silently
  } finally {
    setDeleteConfirm(null);
  }
}
```

- [ ] **Step 5: Update the post card render — add delete button and confirm strip**

In the post card `return` block inside `visibleItems.map`, replace the stats row:
```tsx
<div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
  <span>▲ {counts.score}</span>
  <span>💬 {counts.comments}</span>
</div>
```
with:
```tsx
{deleteConfirm?.kind === 'post' && deleteConfirm.id === post.id ? (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
    <span style={{ color: '#f0f0f0' }}>Delete post?</span>
    <button
      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
      style={{ background: '#2a2d35', border: 'none', borderRadius: 6, color: '#aaa', padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}
    >
      Cancel
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
      style={{ background: '#c0392b', border: 'none', borderRadius: 6, color: '#fff', padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
    >
      Delete
    </button>
  </div>
) : (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
      <span>▲ {counts.score}</span>
      <span>💬 {counts.comments}</span>
    </div>
    {isOwnProfile && (
      <button
        aria-label="Delete post"
        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ kind: 'post', id: post.id }); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555', padding: '0 4px' }}
      >
        🗑
      </button>
    )}
  </div>
)}
```

- [ ] **Step 6: Update the comment card render — add delete button and confirm strip**

In the comment card `return` block, replace the stats row:
```tsx
<div style={{ fontSize: 10, color: '#555', marginTop: 6 }}>▲ {counts.score}</div>
```
with:
```tsx
{deleteConfirm?.kind === 'comment' && deleteConfirm.id === comment.id ? (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 6 }}>
    <span style={{ color: '#f0f0f0' }}>Delete comment?</span>
    <button
      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
      style={{ background: '#2a2d35', border: 'none', borderRadius: 6, color: '#aaa', padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}
    >
      Cancel
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
      style={{ background: '#c0392b', border: 'none', borderRadius: 6, color: '#fff', padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
    >
      Delete
    </button>
  </div>
) : (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
    <div style={{ fontSize: 10, color: '#555' }}>▲ {counts.score}</div>
    {isOwnProfile && (
      <button
        aria-label="Delete comment"
        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ kind: 'comment', id: comment.id }); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555', padding: '0 4px' }}
      >
        🗑
      </button>
    )}
  </div>
)}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test -- ProfilePage
```
Expected: all pass.

- [ ] **Step 8: Run the full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/ProfilePage.tsx src/components/ProfilePage.test.tsx
git commit -m "feat: delete own posts and comments from ProfilePage with inline confirmation"
```
