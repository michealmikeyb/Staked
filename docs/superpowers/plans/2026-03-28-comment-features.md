# Comment Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add double-tap to like, reply via bottom sheet, and markdown rendering (including images) to comments in the Stakswipe post card.

**Architecture:** Three new components (`CommentItem`, `ReplySheet`, `CommentList`) replace the inline comment loop in `PostCard`. `lemmy.ts` gains `likeComment` and `createComment`. `PostCard` tracks which instance/token was used for the successful comment fetch so replies go to the right place.

**Tech Stack:** React 18 + TypeScript, react-markdown + remark-gfm, lemmy-js-client v0.19, Vitest + @testing-library/react, CSS Modules

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/lemmy.ts` | Add `likeComment`, `createComment` |
| Modify | `src/lib/lemmy.test.ts` | Tests for new API functions |
| Create | `src/components/CommentItem.tsx` | Single comment: markdown, double-tap like, reply button |
| Create | `src/components/CommentItem.module.css` | Comment, author, body, score flash, reply button styles |
| Create | `src/components/CommentItem.test.tsx` | Tests for like toggle and reply callback |
| Create | `src/components/ReplySheet.tsx` | Bottom sheet: textarea, send/cancel |
| Create | `src/components/ReplySheet.module.css` | Sheet slide-up, textarea, buttons |
| Create | `src/components/ReplySheet.test.tsx` | Tests for submit and close behaviour |
| Create | `src/components/CommentList.tsx` | Comment list + reply-target state |
| Create | `src/components/CommentList.test.tsx` | Tests for reply flow and list update |
| Modify | `src/components/PostCard.tsx` | Track resolved instance/token, use CommentList |
| Modify | `src/components/PostCard.module.css` | Remove `.comment`, `.commentAuthor`, `.commentBody` |

---

## Task 1: Install dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install react-markdown and remark-gfm**

```bash
npm install react-markdown remark-gfm
```

Expected output: added 2 packages (or similar). No errors.

- [ ] **Step 2: Verify install**

```bash
npm ls react-markdown remark-gfm
```

Expected: both packages listed under `stakswipe`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown and remark-gfm"
```

---

## Task 2: Add `likeComment` and `createComment` to `lemmy.ts`

**Files:**
- Modify: `src/lib/lemmy.ts`
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Add `likeComment` and `createComment` to the mock in `lemmy.test.ts`**

Open `src/lib/lemmy.test.ts`. The top mock currently sets up a `MockLemmyHttp`. Add `likeComment` and `createComment` to it, and update the import line:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments, likeComment, createComment } from './lemmy';

// Mock the entire lemmy-js-client module
vi.mock('lemmy-js-client', () => {
  const MockLemmyHttp = vi.fn().mockImplementation(() => ({
    login: vi.fn().mockResolvedValue({ jwt: 'mock-token' }),
    getPosts: vi.fn().mockResolvedValue({ posts: [{ post: { id: 1, name: 'Test Post' } }] }),
    likePost: vi.fn().mockResolvedValue({}),
    savePost: vi.fn().mockResolvedValue({}),
    getComments: vi.fn().mockResolvedValue({ comments: [{ comment: { id: 1, content: 'Hello' } }] }),
    likeComment: vi.fn().mockResolvedValue({}),
    createComment: vi.fn().mockResolvedValue({
      comment_view: {
        comment: { id: 99, content: 'A reply', path: '0.1.99' },
        creator: { name: 'bob' },
        counts: { score: 1 },
      },
    }),
  }));
  return { LemmyHttp: MockLemmyHttp };
});
```

- [ ] **Step 2: Write tests for `likeComment` and `createComment`**

Append to `src/lib/lemmy.test.ts` (after the existing `fetchComments` describe block):

```ts
describe('likeComment', () => {
  it('resolves without throwing for score 1', async () => {
    await expect(likeComment('lemmy.world', 'tok', 42, 1)).resolves.toBeUndefined();
  });

  it('resolves without throwing for score 0 (undo)', async () => {
    await expect(likeComment('lemmy.world', 'tok', 42, 0)).resolves.toBeUndefined();
  });
});

describe('createComment', () => {
  it('returns the comment_view from the response', async () => {
    const cv = await createComment('lemmy.world', 'tok', 1, 'A reply', 10);
    expect(cv.comment.id).toBe(99);
    expect(cv.comment.content).toBe('A reply');
  });

  it('works without parentId (top-level)', async () => {
    const cv = await createComment('lemmy.world', 'tok', 1, 'Top level');
    expect(cv.comment.id).toBe(99);
  });
});
```

- [ ] **Step 3: Run tests — expect them to fail**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: FAIL — `likeComment` and `createComment` are not exported from `./lemmy`.

- [ ] **Step 4: Implement `likeComment` and `createComment` in `lemmy.ts`**

Append to `src/lib/lemmy.ts` (after the existing `resolvePostId` function):

```ts
export async function likeComment(
  instance: string,
  token: string,
  commentId: number,
  score: 1 | 0,
): Promise<void> {
  // @ts-expect-error legacy auth
  await client(instance).likeComment({ comment_id: commentId, score, auth: token });
}

export async function createComment(
  instance: string,
  token: string,
  postId: number,
  content: string,
  parentId?: number,
): Promise<CommentView> {
  const res = await client(instance).createComment({
    post_id: postId,
    content,
    parent_id: parentId,
    // @ts-expect-error legacy auth
    auth: token,
  });
  return res.comment_view;
}
```

- [ ] **Step 5: Run tests — expect them to pass**

```bash
npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add likeComment and createComment to lemmy API"
```

---

## Task 3: Create `CommentItem` component

**Files:**
- Create: `src/components/CommentItem.tsx`
- Create: `src/components/CommentItem.module.css`
- Create: `src/components/CommentItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/CommentItem.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommentItem from './CommentItem';

vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
}));

const mockCv = {
  comment: { id: 7, content: '**Bold** and ![img](https://example.com/img.png)', path: '0.7' },
  creator: { name: 'alice' },
  counts: { score: 10 },
};

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

beforeEach(() => { vi.clearAllMocks(); });

describe('CommentItem', () => {
  it('renders the author and score', () => {
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.png');
    expect(screen.getByText('Bold')).toBeInTheDocument();
  });

  it('double-tap calls likeComment with score 1 and increments score', async () => {
    const { likeComment } = await import('../lib/lemmy');
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    const comment = screen.getByTestId('comment-item');
    await act(async () => {
      fireEvent.click(comment);
      fireEvent.click(comment);
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 1);
    expect(screen.getByText(/11/)).toBeInTheDocument();
  });

  it('second double-tap undoes the like (score 0) and decrements score', async () => {
    const { likeComment } = await import('../lib/lemmy');
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    const comment = screen.getByTestId('comment-item');
    // First double-tap: like
    await act(async () => {
      fireEvent.click(comment);
      fireEvent.click(comment);
    });
    // Second double-tap: undo
    await act(async () => {
      fireEvent.click(comment);
      fireEvent.click(comment);
    });
    expect(likeComment).toHaveBeenLastCalledWith('lemmy.world', 'tok', 7, 0);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('single tap does not call likeComment', async () => {
    const { likeComment } = await import('../lib/lemmy');
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    fireEvent.click(screen.getByTestId('comment-item'));
    await act(async () => {});
    expect(likeComment).not.toHaveBeenCalled();
  });

  it('reply button calls onReply with the comment view', () => {
    const onReply = vi.fn();
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={onReply} />);
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    expect(onReply).toHaveBeenCalledWith(mockCv);
  });

  it('applies left padding proportional to depth', () => {
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={3} onReply={vi.fn()} />);
    const item = screen.getByTestId('comment-item');
    // depth 3 → 16 + (3-1)*14 = 44px
    expect(item).toHaveStyle('padding-left: 44px');
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npm test -- --reporter=verbose src/components/CommentItem.test.tsx
```

Expected: FAIL — `CommentItem` does not exist.

- [ ] **Step 3: Create `CommentItem.module.css`**

Create `src/components/CommentItem.module.css`:

```css
.comment {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.authorRow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--accent);
  margin-bottom: 4px;
  position: relative;
}

.score {
  transition: color 0.2s;
}

.scoreLiked {
  color: var(--accent);
  font-weight: 700;
}

@keyframes floatUp {
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-8px); }
}

.scoreFlash {
  position: absolute;
  left: 60px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
  animation: floatUp 0.6s ease-out forwards;
  pointer-events: none;
}

.body {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.5;
}

.body img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
  margin-top: 6px;
}

.body p {
  margin: 0 0 6px;
}

.body p:last-child {
  margin-bottom: 0;
}

.replyButton {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.72rem;
  padding: 4px 0 0;
  cursor: pointer;
  display: block;
}

.replyButton:hover {
  color: var(--accent);
}
```

- [ ] **Step 4: Create `CommentItem.tsx`**

Create `src/components/CommentItem.tsx`:

```tsx
import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { likeComment, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import styles from './CommentItem.module.css';

interface Props {
  cv: CommentView;
  auth: AuthState;
  depth: number;
  onReply: (cv: CommentView) => void;
}

export default function CommentItem({ cv, auth, depth, onReply }: Props) {
  const [liked, setLiked] = useState(false);
  const [score, setScore] = useState(cv.counts.score);
  const [flashKey, setFlashKey] = useState(0);
  const [flashDelta, setFlashDelta] = useState(0);
  const lastTapRef = useRef<number>(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      const newLiked = !liked;
      const delta = newLiked ? 1 : -1;
      setLiked(newLiked);
      setScore((s) => s + delta);
      setFlashDelta(delta);
      setFlashKey((k) => k + 1);
      likeComment(auth.instance, auth.token, cv.comment.id, newLiked ? 1 : 0).catch(() => {
        setLiked(!newLiked);
        setScore((s) => s - delta);
      });
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div
      data-testid="comment-item"
      className={styles.comment}
      style={{ paddingLeft: `${16 + (depth - 1) * 14}px` }}
      onClick={handleClick}
    >
      <div className={styles.authorRow}>
        <span>@{cv.creator.name}</span>
        <span className={liked ? styles.scoreLiked : styles.score}>▲ {score}</span>
        {flashKey > 0 && (
          <span key={flashKey} className={styles.scoreFlash}>
            {flashDelta > 0 ? '+1' : '-1'}
          </span>
        )}
      </div>
      <div className={styles.body}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cv.comment.content}</ReactMarkdown>
      </div>
      <button
        className={styles.replyButton}
        onClick={(e) => { e.stopPropagation(); onReply(cv); }}
      >
        ↩ Reply
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run tests — expect them to pass**

```bash
npm test -- --reporter=verbose src/components/CommentItem.test.tsx
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CommentItem.tsx src/components/CommentItem.module.css src/components/CommentItem.test.tsx
git commit -m "feat: add CommentItem with double-tap like and markdown rendering"
```

---

## Task 4: Create `ReplySheet` component

**Files:**
- Create: `src/components/ReplySheet.tsx`
- Create: `src/components/ReplySheet.module.css`
- Create: `src/components/ReplySheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ReplySheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ReplySheet from './ReplySheet';

const mockTarget = {
  comment: { id: 5, content: 'Parent comment', path: '0.5' },
  creator: { name: 'alice' },
  counts: { score: 3 },
};

describe('ReplySheet', () => {
  it('is not visible when target is null', () => {
    render(<ReplySheet target={null} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('shows the target author when open', () => {
    render(<ReplySheet target={mockTarget as never} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('calls onSubmit with textarea content when Send is clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReplySheet target={mockTarget as never} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onSubmit).toHaveBeenCalledWith('My reply');
  });

  it('clears textarea and calls onClose after successful submit', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReplySheet target={mockTarget as never} onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/write a reply/i)).toHaveValue('');
  });

  it('shows error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<ReplySheet target={mockTarget as never} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('Send button is disabled when textarea is empty', () => {
    render(<ReplySheet target={mockTarget as never} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ReplySheet target={mockTarget as never} onSubmit={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npm test -- --reporter=verbose src/components/ReplySheet.test.tsx
```

Expected: FAIL — `ReplySheet` does not exist.

- [ ] **Step 3: Create `ReplySheet.module.css`**

Create `src/components/ReplySheet.module.css`:

```css
.sheet {
  position: sticky;
  bottom: 0;
  background: var(--card-bg);
  border-top: 2px solid var(--accent);
  border-radius: 12px 12px 0 0;
  padding: 12px 16px;
  transform: translateY(100%);
  transition: transform 0.25s ease;
}

.sheet.open {
  transform: translateY(0);
}

.header {
  font-size: 0.75rem;
  color: var(--accent);
  margin-bottom: 8px;
}

.textarea {
  width: 100%;
  min-height: 72px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  font-size: 0.88rem;
  color: var(--text-primary);
  resize: none;
  box-sizing: border-box;
  font-family: inherit;
}

.textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.error {
  font-size: 0.75rem;
  color: #e55;
  margin-top: 4px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.cancel {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.send {
  background: var(--accent);
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.8rem;
  color: #fff;
  cursor: pointer;
}

.send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Create `ReplySheet.tsx`**

Create `src/components/ReplySheet.tsx`:

```tsx
import { useState } from 'react';
import { type CommentView } from '../lib/lemmy';
import styles from './ReplySheet.module.css';

interface Props {
  target: CommentView | null;
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}

export default function ReplySheet({ target, onSubmit, onClose }: Props) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(content.trim());
      setContent('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  if (!target) return null;

  return (
    <div className={`${styles.sheet} ${styles.open}`}>
      <div className={styles.header}>↩ Replying to @{target.creator.name}</div>
      <textarea
        className={styles.textarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a reply..."
      />
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        <button className={styles.cancel} onClick={onClose}>Cancel</button>
        <button
          className={styles.send}
          onClick={handleSend}
          disabled={submitting || !content.trim()}
        >
          {submitting ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests — expect them to pass**

```bash
npm test -- --reporter=verbose src/components/ReplySheet.test.tsx
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ReplySheet.tsx src/components/ReplySheet.module.css src/components/ReplySheet.test.tsx
git commit -m "feat: add ReplySheet bottom sheet component"
```

---

## Task 5: Create `CommentList` component

**Files:**
- Create: `src/components/CommentList.tsx`
- Create: `src/components/CommentList.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/CommentList.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommentList from './CommentList';

vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'My reply', path: '0.1.99' },
    creator: { name: 'me' },
    counts: { score: 1 },
  }),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockComments = [
  {
    comment: { id: 1, content: 'First comment', path: '0.1' },
    creator: { name: 'alice' },
    counts: { score: 5 },
  },
  {
    comment: { id: 2, content: 'Second comment', path: '0.2' },
    creator: { name: 'bob' },
    counts: { score: 3 },
  },
];

beforeEach(() => { vi.clearAllMocks(); });

describe('CommentList', () => {
  it('renders all comments', () => {
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });

  it('opens reply sheet when Reply is clicked on a comment', () => {
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('calls createComment and appends the new comment on submit', async () => {
    const { createComment } = await import('../lib/lemmy');
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    // Open reply sheet for first comment
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    // Fill in reply
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(createComment).toHaveBeenCalledWith('lemmy.world', 'tok', 10, 'My reply', 1);
    expect(screen.getByText('My reply')).toBeInTheDocument();
  });

  it('closes the reply sheet after submit', async () => {
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('closes the reply sheet when Cancel is clicked', () => {
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npm test -- --reporter=verbose src/components/CommentList.test.tsx
```

Expected: FAIL — `CommentList` does not exist.

- [ ] **Step 3: Create `CommentList.tsx`**

Create `src/components/CommentList.tsx`:

```tsx
import { useState } from 'react';
import { createComment, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentItem from './CommentItem';
import ReplySheet from './ReplySheet';

interface Props {
  comments: CommentView[];
  auth: AuthState;
  postId: number;
  instance: string;
  token: string;
}

export default function CommentList({ comments, auth, postId, instance, token }: Props) {
  const [items, setItems] = useState<CommentView[]>(comments);
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);

  const handleSubmit = async (content: string) => {
    const newComment = await createComment(
      instance,
      token,
      postId,
      content,
      replyTarget!.comment.id,
    );
    setItems((prev) => [...prev, newComment]);
    setReplyTarget(null);
  };

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
            onReply={(cv) => setReplyTarget(cv)}
          />
        );
      })}
      <ReplySheet
        target={replyTarget}
        onSubmit={handleSubmit}
        onClose={() => setReplyTarget(null)}
      />
    </>
  );
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npm test -- --reporter=verbose src/components/CommentList.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CommentList.tsx src/components/CommentList.test.tsx
git commit -m "feat: add CommentList with reply state management"
```

---

## Task 6: Update `PostCard` to use `CommentList`

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.module.css`

- [ ] **Step 1: Run existing PostCard tests to establish baseline**

```bash
npm test -- --reporter=verbose src/components/PostCard.test.tsx
```

Expected: all tests PASS before any changes.

- [ ] **Step 2: Update `PostCard.tsx`**

Replace the entire contents of `src/components/PostCard.tsx` with:

```tsx
import { useMemo, useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { fetchComments, resolvePostId, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentList from './CommentList';
import styles from './PostCard.module.css';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
}

function communityInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function instanceFromActorId(actorId: string): string {
  try { return new URL(actorId).hostname; } catch { return ''; }
}

// Posts federate across instances — ap_id gives the canonical source instance + local post ID.
function sourceFromApId(apId: string): { instance: string; postId: number } | null {
  try {
    const url = new URL(apId);
    const postId = parseInt(url.pathname.split('/').pop() ?? '', 10);
    return isNaN(postId) ? null : { instance: url.hostname, postId };
  } catch { return null; }
}

export default function PostCard({ post, auth, zIndex, scale, onSwipeRight, onSwipeLeft }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = useMemo(() => instanceFromActorId(community.actor_id), [community.actor_id]);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  // Track which instance+token produced the successful comment fetch so replies go to the right place.
  const resolvedInstanceRef = useRef<string>(auth.instance);
  const resolvedTokenRef = useRef<string>(auth.token);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let comments: CommentView[] = [];
      const source = sourceFromApId(p.ap_id);

      if (source) {
        const sourceToken = source.instance === auth.instance ? auth.token : '';
        comments = await fetchComments(source.instance, sourceToken, source.postId).catch(() => []);
        if (comments.length > 0) {
          resolvedInstanceRef.current = source.instance;
          resolvedTokenRef.current = sourceToken;
        }
      }

      // Cross-posts, non-Lemmy sources (Kbin/Mbin ap_ids etc.), or empty source fetch:
      // resolve via the community's home instance.
      if (comments.length === 0) {
        const communityInstance = instanceFromActorId(community.actor_id);
        if (communityInstance && communityInstance !== source?.instance) {
          const localId = await resolvePostId(communityInstance, p.ap_id).catch(() => null);
          if (localId != null) {
            const communityToken = communityInstance === auth.instance ? auth.token : '';
            comments = await fetchComments(communityInstance, communityToken, localId).catch(() => []);
            if (comments.length > 0) {
              resolvedInstanceRef.current = communityInstance;
              resolvedTokenRef.current = communityToken;
            }
          }
        }
      }

      // Last resort: user's home instance with the already-known local post ID.
      // Try authenticated first; fall back to anonymous if token is expired (401).
      if (comments.length === 0 && source?.instance !== auth.instance) {
        comments = await fetchComments(auth.instance, auth.token, p.id).catch(() =>
          fetchComments(auth.instance, '', p.id).catch(() => [])
        );
        if (comments.length > 0) {
          resolvedInstanceRef.current = auth.instance;
          resolvedTokenRef.current = auth.token;
        }
      }

      if (!cancelled) { setComments(comments); setCommentsLoaded(true); }
    };

    load();
    return () => { cancelled = true; };
  }, [auth, p.ap_id, p.id, community.actor_id]);

  const x = useMotionValue(0);

  // Right swipe rotates CCW ("lifting"), left swipe CW ("sinking") — opposite of standard Tinder.
  const rotate = useTransform(x, [-150, 0, 150], [12, 0, -12]);

  const overlayColor = useTransform(x, (v) => {
    const opacity = Math.min(Math.abs(v) / 120, 1) * 0.45;
    return v > 0 ? `rgba(255,107,53,${opacity})` : `rgba(80,80,80,${opacity})`;
  });

  const bind = useDrag(({ movement: [mx], velocity: [vx], last }) => {
    x.set(mx);
    if (last) {
      const shouldSwipe = Math.abs(mx) > SWIPE_THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD;
      if (shouldSwipe && mx > 0) {
        animate(x, 600, { duration: 0.3, onComplete: onSwipeRight });
      } else if (shouldSwipe && mx < 0) {
        animate(x, -600, { duration: 0.3, onComplete: onSwipeLeft });
      } else {
        animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      }
    }
  }, { axis: 'x', filterTaps: true, pointer: { touch: true } });

  return (
    <motion.div
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...(bind() as object)}
    >
      <motion.div className={styles.overlay} style={{ backgroundColor: overlayColor }} />

      <div className={styles.scrollContent}>
        <div className={styles.meta}>
          <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
          <div>
            <div className={styles.communityName}>c/{community.name}</div>
            <div className={styles.instanceName}>{instance} • {creator.name}</div>
          </div>
        </div>

        <div className={styles.title}>{p.name}</div>

        {p.thumbnail_url && (
          <img className={styles.image} src={p.thumbnail_url} alt="" loading="lazy" />
        )}

        {p.body && <div className={styles.excerpt}>{p.body}</div>}

        <div className={styles.footer}>
          <span>▲ {counts.score}</span>
          <span>💬 {counts.comments}</span>
        </div>

        <div className={styles.commentsSection}>
          {commentsLoaded && comments.length === 0 && counts.comments > 0 && (
            <a
              className={styles.commentsFallback}
              href={p.ap_id}
              target="_blank"
              rel="noopener noreferrer"
            >
              {counts.comments} comments — view on {new URL(p.ap_id).hostname}
            </a>
          )}
          <CommentList
            comments={comments}
            auth={auth}
            postId={p.id}
            instance={resolvedInstanceRef.current}
            token={resolvedTokenRef.current}
          />
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Remove the now-unused `.comment`, `.commentAuthor`, `.commentBody` rules from `PostCard.module.css`**

In `src/components/PostCard.module.css`, delete these three rule blocks (lines 113–129 in the original):

```css
.comment {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.commentAuthor {
  font-size: 0.72rem;
  color: var(--accent);
  margin-bottom: 4px;
}

.commentBody {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.5;
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --reporter=verbose
```

Expected: all tests PASS. The existing PostCard tests mock `fetchComments` and don't exercise the comment rendering directly, so they are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.module.css
git commit -m "feat: integrate CommentList into PostCard, track resolved instance for replies"
```

---

## Task 7: Full test run and smoke check

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests across all files PASS. Note the count — should be higher than before this feature (new tests added for CommentItem, ReplySheet, CommentList, and lemmy).

- [ ] **Step 2: Start dev server and visually verify**

```bash
npm run dev
```

Open the app. Log in. Check that:
- Comments render markdown formatting (bold, links, images)
- Double-tapping a comment shows a +1 flash and updates the score
- Tapping Reply opens the bottom sheet with "↩ Replying to @username"
- Typing and sending a reply appends it to the comment list
- The Cancel button dismisses the sheet

- [ ] **Step 3: Final commit tag**

```bash
git commit --allow-empty -m "feat: comment like, reply, and markdown rendering complete"
```
