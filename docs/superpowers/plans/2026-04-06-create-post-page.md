# Create Post Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Create Post page to Stakswipe that lets authenticated users submit posts to Lemmy communities, with pictrs image upload support.

**Architecture:** New `CreatePostPage` at `/create-post` route, reads optional community pre-fill from React Router location state. Two entry points: a ✏️ Post button added to `MenuDrawer`, and a ✏️ compose button added to `CommunityHeader` (passes `{ community: 'name@instance' }` as location state). Three new functions in `lemmy.ts`: `resolveCommunityId`, `createPost`, `uploadImage`.

**Tech Stack:** React 18, TypeScript, `lemmy-js-client` (LemmyHttp), Vitest + @testing-library/react, React Router v6, pictrs HTTP API (direct `fetch`)

---

### Task 1: Add `resolveCommunityId`, `createPost`, `uploadImage` to lemmy.ts

**Files:**
- Modify: `src/lib/lemmy.ts`
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Add `getCommunity` and `createPost` to the LemmyHttp mock in lemmy.test.ts**

In `src/lib/lemmy.test.ts`, add these methods to the object returned by `MockLemmyHttp` (inside the `vi.mock('lemmy-js-client', ...)` block, alongside the existing methods):

```ts
getCommunity: vi.fn().mockResolvedValue({
  community_view: { community: { id: 42 } },
}),
createPost: vi.fn().mockResolvedValue({ post_view: { post: { id: 99 } } }),
```

Also update the import at the top of the file to include the new functions:

```ts
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments, likeComment, createComment, editComment, fetchPersonDetails, fetchPost, resolveCommunityId, createPost, uploadImage } from './lemmy';
```

- [ ] **Step 2: Add tests for the three new functions**

Append to `src/lib/lemmy.test.ts`:

```ts
describe('resolveCommunityId', () => {
  it('returns the community id', async () => {
    const id = await resolveCommunityId('lemmy.world', 'tok', 'programming@lemmy.world');
    expect(id).toBe(42);
  });

  it('calls getCommunity with the community ref', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await resolveCommunityId('lemmy.world', 'tok', 'programming@lemmy.world');
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.getCommunity).toHaveBeenCalledWith({ name: 'programming@lemmy.world' });
  });
});

describe('createPost', () => {
  it('calls LemmyHttp.createPost with the right params', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await createPost('lemmy.world', 'tok', { name: 'Test post', community_id: 42, url: 'https://example.com' });
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.createPost).toHaveBeenCalledWith({
      name: 'Test post',
      community_id: 42,
      url: 'https://example.com',
    });
  });

  it('resolves without throwing', async () => {
    await expect(
      createPost('lemmy.world', 'tok', { name: 'Hello', community_id: 1 }),
    ).resolves.toBeUndefined();
  });
});

describe('uploadImage', () => {
  it('returns the full image url on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: [{ file: 'abc123.jpg' }] }),
    } as unknown as Response);
    const url = await uploadImage('lemmy.world', 'tok', new File([''], 'test.jpg'));
    expect(url).toBe('https://lemmy.world/pictrs/image/abc123.jpg');
  });

  it('sends Authorization header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: [{ file: 'x.png' }] }),
    } as unknown as Response);
    await uploadImage('lemmy.world', 'tok', new File([''], 'test.png'));
    expect(global.fetch).toHaveBeenCalledWith(
      'https://lemmy.world/pictrs/image',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
    );
  });

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 413 } as unknown as Response);
    await expect(uploadImage('lemmy.world', 'tok', new File([''], 'big.jpg')))
      .rejects.toThrow('Upload failed: 413');
  });

  it('throws when files array is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    } as unknown as Response);
    await expect(uploadImage('lemmy.world', 'tok', new File([''], 'test.jpg')))
      .rejects.toThrow('Upload failed: no file returned');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: failures referencing `resolveCommunityId`, `createPost`, `uploadImage` not exported from `./lemmy`.

- [ ] **Step 4: Implement the three functions in lemmy.ts**

Append to `src/lib/lemmy.ts`:

```ts
export async function resolveCommunityId(
  instance: string,
  token: string,
  communityRef: string,
): Promise<number> {
  const res = await client(instance, token).getCommunity({ name: communityRef });
  return res.community_view.community.id;
}

export async function createPost(
  instance: string,
  token: string,
  params: { name: string; community_id: number; url?: string; body?: string },
): Promise<void> {
  await client(instance, token).createPost(params);
}

export async function uploadImage(
  instance: string,
  token: string,
  file: File,
): Promise<string> {
  const formData = new FormData();
  formData.append('images[]', file);
  const res = await fetch(`https://${instance}/pictrs/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  if (!data.files?.[0]?.file) throw new Error('Upload failed: no file returned');
  return `https://${instance}/pictrs/image/${data.files[0].file}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add resolveCommunityId, createPost, uploadImage to lemmy.ts"
```

---

### Task 2: Add Post button to MenuDrawer

**Files:**
- Modify: `src/components/MenuDrawer.tsx`
- Modify: `src/components/MenuDrawer.test.tsx`

- [ ] **Step 1: Write failing tests**

In `src/components/MenuDrawer.test.tsx`, append inside the `describe('MenuDrawer', ...)` block:

```ts
it('renders Post button when drawer is open', () => {
  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  expect(screen.getByRole('button', { name: /^post$/i })).toBeInTheDocument();
});

it('calls onNavigate with /create-post and closes drawer when Post is clicked', () => {
  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/create-post');
  expect(screen.queryByRole('button', { name: /^post$/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/MenuDrawer.test.tsx
```

Expected: FAIL — no button with name "Post" found.

- [ ] **Step 3: Update MenuDrawer.tsx**

In `src/components/MenuDrawer.tsx`, change `repeat(4, 1fr)` to `repeat(5, 1fr)`:

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
```

Add the Post button after the Settings button:

```tsx
<button
  onClick={() => handleNavigate('/create-post')}
  aria-label="Post"
  style={drawerButtonStyle}
>
  <span style={iconStyle}>✏️</span>
  Post
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/MenuDrawer.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/MenuDrawer.tsx src/components/MenuDrawer.test.tsx
git commit -m "feat: add Post button to MenuDrawer"
```

---

### Task 3: Add compose button to CommunityHeader

**Files:**
- Modify: `src/components/CommunityHeader.tsx`
- Modify: `src/components/CommunityHeader.test.tsx`
- Modify: `src/components/FeedStack.tsx`

- [ ] **Step 1: Write failing test for compose button**

In `src/components/CommunityHeader.test.tsx`, append inside the `describe('CommunityHeader', ...)` block:

```ts
it('calls onCompose when compose button is clicked', () => {
  const onCompose = vi.fn();
  render(
    <CommunityHeader
      name="programming"
      sortType="Active"
      onSortChange={vi.fn()}
      onBack={vi.fn()}
      onCompose={onCompose}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /compose/i }));
  expect(onCompose).toHaveBeenCalledTimes(1);
});

it('does not render compose button when onCompose is not provided', () => {
  render(
    <CommunityHeader
      name="programming"
      sortType="Active"
      onSortChange={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: /compose/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/CommunityHeader.test.tsx
```

Expected: FAIL — no compose button found.

- [ ] **Step 3: Update CommunityHeader.tsx**

Replace the `interface Props` and component signature in `src/components/CommunityHeader.tsx`:

```tsx
interface Props {
  name: string;
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  onBack: () => void;
  onCompose?: () => void;
}

export default function CommunityHeader({ name, sortType, onSortChange, onBack, onCompose }: Props) {
```

Add the compose button between the `<div>c/{name}</div>` and the sort dropdown button:

```tsx
{onCompose && (
  <button
    aria-label="Compose"
    onClick={onCompose}
    style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#f5f5f5', fontSize: 18, padding: '0 4px 0 8px', lineHeight: 1,
    }}
  >
    ✏️
  </button>
)}
```

- [ ] **Step 4: Update FeedStack.tsx to pass onCompose**

In `src/components/FeedStack.tsx`, update the `CommunityHeader` usage:

```tsx
<CommunityHeader
  name={community.name}
  sortType={sortType}
  onSortChange={handleSortChange}
  onBack={() => navigate(-1)}
  onCompose={() => navigate('/create-post', { state: { community: `${community.name}@${community.instance}` } })}
/>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/CommunityHeader.test.tsx src/components/FeedStack.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/CommunityHeader.tsx src/components/CommunityHeader.test.tsx src/components/FeedStack.tsx
git commit -m "feat: add compose button to CommunityHeader"
```

---

### Task 4: Build CreatePostPage

**Files:**
- Create: `src/components/CreatePostPage.tsx`
- Create: `src/components/CreatePostPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/CreatePostPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CreatePostPage from './CreatePostPage';
import * as lemmy from '../lib/lemmy';

vi.mock('../lib/lemmy', () => ({
  resolveCommunityId: vi.fn(),
  createPost: vi.fn(),
  uploadImage: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const auth = { instance: 'lemmy.world', token: 'tok', username: 'user' };

function renderPage(locationState: unknown = null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/create-post', state: locationState }]}>
      <Routes>
        <Route path="/create-post" element={<CreatePostPage auth={auth} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('CreatePostPage', () => {
  it('renders all form fields', () => {
    renderPage();
    expect(screen.getByPlaceholderText('communityname@instance.tld')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Post title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Optional text body…')).toBeInTheDocument();
  });

  it('pre-fills community from location state', () => {
    renderPage({ community: 'programming@lemmy.world' });
    expect(screen.getByPlaceholderText('communityname@instance.tld')).toHaveValue('programming@lemmy.world');
  });

  it('disables Post button when title is empty', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('communityname@instance.tld'), {
      target: { value: 'programming@lemmy.world' },
    });
    expect(screen.getByRole('button', { name: /^post$/i })).toBeDisabled();
  });

  it('disables Post button when community is empty', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'Hello world' } });
    expect(screen.getByRole('button', { name: /^post$/i })).toBeDisabled();
  });

  it('enables Post button when title and community are both filled', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('communityname@instance.tld'), {
      target: { value: 'programming@lemmy.world' },
    });
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'Hello world' } });
    expect(screen.getByRole('button', { name: /^post$/i })).toBeEnabled();
  });

  it('resolves community id, calls createPost, and navigates back on success', async () => {
    vi.mocked(lemmy.resolveCommunityId).mockResolvedValue(42);
    vi.mocked(lemmy.createPost).mockResolvedValue(undefined);
    renderPage({ community: 'programming@lemmy.world' });
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'My post' } });
    fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() =>
      expect(lemmy.resolveCommunityId).toHaveBeenCalledWith('lemmy.world', 'tok', 'programming@lemmy.world'),
    );
    expect(lemmy.createPost).toHaveBeenCalledWith('lemmy.world', 'tok', {
      name: 'My post',
      community_id: 42,
      url: 'https://example.com',
      body: undefined,
    });
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('omits url and body when empty', async () => {
    vi.mocked(lemmy.resolveCommunityId).mockResolvedValue(1);
    vi.mocked(lemmy.createPost).mockResolvedValue(undefined);
    renderPage({ community: 'tech@lemmy.world' });
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'Title only' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() => expect(lemmy.createPost).toHaveBeenCalled());
    expect(lemmy.createPost).toHaveBeenCalledWith('lemmy.world', 'tok', {
      name: 'Title only',
      community_id: 1,
      url: undefined,
      body: undefined,
    });
  });

  it('shows error message when submit fails', async () => {
    vi.mocked(lemmy.resolveCommunityId).mockRejectedValue(new Error('Community not found'));
    renderPage({ community: 'bad@lemmy.world' });
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'My post' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() => expect(screen.getByText('Community not found')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows upload error when image upload fails', async () => {
    vi.mocked(lemmy.uploadImage).mockRejectedValue(new Error('Upload failed: 413'));
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Upload failed: 413')).toBeInTheDocument());
  });

  it('auto-fills URL field after successful image upload', async () => {
    vi.mocked(lemmy.uploadImage).mockResolvedValue('https://lemmy.world/pictrs/image/abc.jpg');
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('https://...')).toHaveValue('https://lemmy.world/pictrs/image/abc.jpg'),
    );
  });

  it('navigates back when back button is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/components/CreatePostPage.test.tsx
```

Expected: FAIL — module `./CreatePostPage` not found.

- [ ] **Step 3: Implement CreatePostPage.tsx**

Create `src/components/CreatePostPage.tsx`:

```tsx
import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { type AuthState } from '../lib/store';
import { resolveCommunityId, createPost, uploadImage } from '../lib/lemmy';

interface Props {
  auth: AuthState;
}

export default function CreatePostPage({ auth }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { community?: string } | null)?.community ?? '';

  const [community, setCommunity] = useState(prefill);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = title.trim() !== '' && community.trim() !== '' && !uploading && !submitting;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const imageUrl = await uploadImage(auth.instance, auth.token, file);
      setUrl(imageUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit() {
    setSubmitError('');
    setSubmitting(true);
    try {
      const communityId = await resolveCommunityId(auth.instance, auth.token, community.trim());
      await createPost(auth.instance, auth.token, {
        name: title.trim(),
        community_id: communityId,
        url: url.trim() || undefined,
        body: body.trim() || undefined,
      });
      navigate(-1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: '#2a2d35', border: '1px solid #3a3d45',
    borderRadius: 8, padding: '10px 12px',
    color: '#f5f5f5', fontSize: 14, fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 6, display: 'block',
  };

  return (
    <div style={{ background: '#1a1d24', minHeight: '100dvh', color: '#f5f5f5' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', height: 48, flexShrink: 0,
        background: '#1a1d24', borderBottom: '1px solid #2a2d35',
      }}>
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: 0 }}
        >
          ←
        </button>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 16 }}>New Post</span>
        <button
          aria-label="Post"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            background: canSubmit ? '#ff6b35' : '#3a3d45',
            color: canSubmit ? '#fff' : '#888',
            border: 'none', borderRadius: 8,
            padding: '7px 16px', fontSize: 14, fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'default',
          }}
        >
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Community</label>
          <input
            style={inputStyle}
            placeholder="communityname@instance.tld"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>
            Title <span style={{ color: '#ff6b35' }}>*</span>
          </label>
          <input
            style={inputStyle}
            placeholder="Post title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>URL</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, width: 'auto', flex: 1 }}
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              aria-label="Upload image"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                background: '#2a2d35', border: '1px solid #3a3d45',
                borderRadius: 8, padding: '0 12px',
                color: uploading ? '#888' : '#f5f5f5',
                fontSize: 18, cursor: uploading ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              📷
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          {uploading && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Uploading…</div>
          )}
          {uploadError && (
            <div style={{ fontSize: 12, color: '#ff4444', marginTop: 4 }}>{uploadError}</div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Body</label>
          <textarea
            style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
            placeholder="Optional text body…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {submitError && (
          <div style={{ fontSize: 13, color: '#ff4444' }}>{submitError}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/components/CreatePostPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/CreatePostPage.tsx src/components/CreatePostPage.test.tsx
git commit -m "feat: add CreatePostPage component"
```

---

### Task 5: Wire up /create-post route in App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing test**

In `src/App.test.tsx`, add a mock for `CreatePostPage` alongside the other component mocks:

```ts
vi.mock('./components/CreatePostPage', () => ({
  default: () => <div>CreatePostPage</div>,
}));
```

Then append a test inside `describe('App routing', ...)`:

```ts
it('renders CreatePostPage at /create-post when authenticated', async () => {
  const { loadAuth } = await import('./lib/store');
  vi.mocked(loadAuth).mockReturnValue({ token: 'tok', instance: 'lemmy.world', username: 'alice' });
  window.location.hash = '#/create-post';
  render(<App />);
  await waitFor(() => expect(screen.getByText('CreatePostPage')).toBeInTheDocument());
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose src/App.test.tsx
```

Expected: FAIL — `CreatePostPage` text not found (route not registered).

- [ ] **Step 3: Add import and route to App.tsx**

Add import at the top of `src/App.tsx`:

```ts
import CreatePostPage from './components/CreatePostPage';
```

Add route inside `AuthenticatedApp`'s `<Routes>`, after the `/settings` route:

```tsx
<Route path="/create-post" element={<CreatePostPage auth={auth} />} />
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npm test
```

Expected: all tests pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add /create-post route to App"
```
