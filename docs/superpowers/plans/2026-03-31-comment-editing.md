# Comment Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit button on own comments, larger textarea, top-level "comment on post", and scroll-to-parent on reply.

**Architecture:** Extend `ReplySheet` to a mode-based unified sheet (`reply | edit | new | null`), thread `onEdit` and `localEdits` through `CommentList` → `CommentItem`, and replace `replyTarget` in `PostCard` with a `SheetState` discriminated union.

**Tech Stack:** React 18 + TypeScript, Vitest + @testing-library/react, lemmy-js-client

---

## File Map

| File | Change |
|------|--------|
| `src/lib/lemmy.ts` | Add `editComment` function |
| `src/lib/lemmy.test.ts` | Add `editComment` mock + tests |
| `src/components/ReplySheet.tsx` | Add `mode`, `initialContent` props; drop `target`-controls-visibility |
| `src/components/ReplySheet.module.css` | Textarea min-height 72px → 120px |
| `src/components/ReplySheet.test.tsx` | Update to new mode-based API |
| `src/components/CommentItem.tsx` | Add `onEdit?`, `overrideContent?` props; show Edit button for own comments |
| `src/components/CommentItem.test.tsx` | Add tests for edit button and overrideContent |
| `src/components/CommentList.tsx` | Thread `onEdit` and `localEdits` props |
| `src/components/CommentList.test.tsx` | Update Wrapper for new ReplySheet/CommentList APIs |
| `src/components/PostCard.tsx` | Replace `replyTarget` with `SheetState`; add `localEdits`; wire handlers; footer button; scroll effect |
| `src/components/PostCard.test.tsx` | Add editComment to mock; add Comment button and edit sheet tests |
| `src/components/PostDetailCard.tsx` | Minimal update to use new ReplySheet API (no new features) |

---

## Task 1: Add `editComment` to lemmy.ts

**Files:**
- Modify: `src/lib/lemmy.ts`
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Add `editComment` mock to the MockLemmyHttp in lemmy.test.ts**

Open `src/lib/lemmy.test.ts`. Add `editComment` to the `MockLemmyHttp` mock object (the object inside `vi.mock('lemmy-js-client', ...)`), alongside the existing `createComment` mock:

```ts
editComment: vi.fn().mockResolvedValue({
  comment_view: {
    comment: { id: 7, content: 'Edited content', path: '0.7', ap_id: 'https://lemmy.world/comment/7' },
    creator: { name: 'alice' },
    counts: { score: 3 },
  },
}),
```

Also add `editComment` to the import on line 2:
```ts
import { login, fetchPosts, upvotePost, downvotePost, savePost, fetchComments, likeComment, createComment, editComment, fetchPersonDetails, fetchPost } from './lemmy';
```

- [ ] **Step 2: Write the failing tests for `editComment`**

Add at the end of `src/lib/lemmy.test.ts`:

```ts
describe('editComment', () => {
  it('returns the updated comment_view', async () => {
    const cv = await editComment('lemmy.world', 'tok', 7, 'Edited content');
    expect(cv.comment.id).toBe(7);
    expect(cv.comment.content).toBe('Edited content');
  });

  it('calls client.editComment with comment_id and content', async () => {
    const { LemmyHttp } = await import('lemmy-js-client');
    await editComment('lemmy.world', 'tok', 7, 'Edited content');
    const mockInstance = vi.mocked(LemmyHttp).mock.results[vi.mocked(LemmyHttp).mock.results.length - 1]!.value;
    expect(mockInstance.editComment).toHaveBeenCalledWith({
      comment_id: 7,
      content: 'Edited content',
    });
  });
});
```

- [ ] **Step 3: Run the failing tests**

```bash
npm test -- --run src/lib/lemmy.test.ts
```

Expected: FAIL — `editComment` is not exported from `./lemmy`.

- [ ] **Step 4: Implement `editComment` in lemmy.ts**

Add after the `createComment` function in `src/lib/lemmy.ts` (after line 139):

```ts
export async function editComment(
  instance: string,
  token: string,
  commentId: number,
  content: string,
): Promise<CommentView> {
  const res = await client(instance, token).editComment({
    comment_id: commentId,
    content,
  });
  return res.comment_view;
}
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
npm test -- --run src/lib/lemmy.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add editComment to lemmy API client"
```

---

## Task 2: Refactor ReplySheet to mode-based API

**Files:**
- Modify: `src/components/ReplySheet.tsx`
- Modify: `src/components/ReplySheet.module.css`
- Modify: `src/components/ReplySheet.test.tsx`
- Modify: `src/components/PostDetailCard.tsx`

- [ ] **Step 1: Rewrite ReplySheet.test.tsx for the new API**

Replace the entire content of `src/components/ReplySheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReplySheet from './ReplySheet';

const mockTarget = {
  comment: { id: 5, content: 'Parent comment', path: '0.5' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 3 },
};

describe('ReplySheet', () => {
  it('renders nothing when mode is null', () => {
    render(<ReplySheet mode={null} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows replying-to header in reply mode', () => {
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('shows editing header in edit mode', () => {
    render(
      <ReplySheet mode="edit" target={mockTarget as never} initialContent="old text" onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/editing your comment/i)).toBeInTheDocument();
  });

  it('shows commenting-on-post header in new mode', () => {
    render(<ReplySheet mode="new" onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/commenting on post/i)).toBeInTheDocument();
  });

  it('pre-fills textarea with initialContent in edit mode', () => {
    render(
      <ReplySheet mode="edit" target={mockTarget as never} initialContent="old text" onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('old text');
  });

  it('calls onSubmit with textarea content when Send is clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={onSubmit} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My reply' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onSubmit).toHaveBeenCalledWith('My reply');
  });

  it('clears textarea and calls onClose after successful submit', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={onSubmit} onClose={onClose} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My reply' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('shows error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={onSubmit} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My reply' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('Send button is disabled when textarea is empty', () => {
    render(<ReplySheet mode="new" onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={vi.fn()} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

```bash
npm test -- --run src/components/ReplySheet.test.tsx
```

Expected: most tests fail since the component API hasn't changed yet.

- [ ] **Step 3: Rewrite ReplySheet.tsx**

Replace the entire content of `src/components/ReplySheet.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { type CommentView } from '../lib/lemmy';
import styles from './ReplySheet.module.css';

interface Props {
  mode: 'reply' | 'edit' | 'new' | null;
  target?: CommentView;
  initialContent?: string;
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}

export default function ReplySheet({ mode, target, initialContent, onSubmit, onClose }: Props) {
  const [content, setContent] = useState(initialContent ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(initialContent ?? '');
    setError(null);
  }, [mode, initialContent]);

  const handleSend = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(content.trim());
      setContent('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mode) return null;

  const header =
    mode === 'reply'
      ? `↩ Replying to @${target?.creator.display_name ?? target?.creator.name}`
      : mode === 'edit'
      ? '✏ Editing your comment'
      : '💬 Commenting on post';

  return (
    <div className={`${styles.sheet} ${styles.open}`}>
      <div className={styles.header}>{header}</div>
      <textarea
        className={styles.textarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={mode === 'edit' ? 'Edit your comment...' : 'Write a comment...'}
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

- [ ] **Step 4: Update textarea min-height in ReplySheet.module.css**

In `src/components/ReplySheet.module.css`, change the `.textarea` rule:

```css
.textarea {
  width: 100%;
  min-height: 120px;
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
```

(Change `min-height: 72px` to `min-height: 120px`.)

- [ ] **Step 5: Run ReplySheet tests and verify they pass**

```bash
npm test -- --run src/components/ReplySheet.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Update PostDetailCard.tsx to use the new ReplySheet API**

In `src/components/PostDetailCard.tsx`, find the `ReplySheet` usage (around line 192):

```tsx
<ReplySheet
  target={replyTarget}
  onSubmit={handleReplySubmit}
  onClose={() => setReplyTarget(null)}
/>
```

Replace with:

```tsx
<ReplySheet
  mode={replyTarget ? 'reply' : null}
  target={replyTarget ?? undefined}
  onSubmit={handleReplySubmit}
  onClose={() => setReplyTarget(null)}
/>
```

- [ ] **Step 7: Run full test suite to check for regressions**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/ReplySheet.tsx src/components/ReplySheet.module.css src/components/ReplySheet.test.tsx src/components/PostDetailCard.tsx
git commit -m "feat: refactor ReplySheet to mode-based API with larger textarea"
```

---

## Task 3: Add Edit button to CommentItem

**Files:**
- Modify: `src/components/CommentItem.tsx`
- Modify: `src/components/CommentItem.test.tsx`

- [ ] **Step 1: Write failing tests for the Edit button and overrideContent**

Add the following tests to the `describe('CommentItem', ...)` block in `src/components/CommentItem.test.tsx`:

```ts
it('shows edit button for own comments', () => {
  const ownCv = {
    ...mockCv,
    creator: { name: 'me', actor_id: 'https://lemmy.world/u/me', avatar: undefined },
  };
  render(
    <CommentItem cv={ownCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} onEdit={vi.fn()} />,
  );
  expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
});

it('hides edit button for other users comments', () => {
  // mockCv creator is 'alice' on beehaw.org; mockAuth.username is 'me' on lemmy.world
  render(
    <CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} onEdit={vi.fn()} />,
  );
  expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});

it('clicking edit button calls onEdit with the comment view', () => {
  const onEdit = vi.fn();
  const ownCv = {
    ...mockCv,
    creator: { name: 'me', actor_id: 'https://lemmy.world/u/me', avatar: undefined },
  };
  render(
    <CommentItem cv={ownCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} onEdit={onEdit} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));
  expect(onEdit).toHaveBeenCalledWith(ownCv);
});

it('displays overrideContent instead of original comment content', () => {
  render(
    <CommentItem
      cv={mockCv as never}
      auth={mockAuth}
      depth={1}
      onReply={vi.fn()}
      overrideContent="Updated text"
    />,
  );
  expect(screen.getByText('Updated text')).toBeInTheDocument();
  expect(screen.queryByText(/Bold/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the failing tests**

```bash
npm test -- --run src/components/CommentItem.test.tsx
```

Expected: the four new tests fail.

- [ ] **Step 3: Update CommentItem.tsx**

Replace the entire content of `src/components/CommentItem.tsx`:

```tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { likeComment, resolveCommentId, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId } from '../lib/urlUtils';
import CreatorAvatar from './CreatorAvatar';
import styles from './CommentItem.module.css';

interface Props {
  cv: CommentView;
  auth: AuthState;
  depth: number;
  onReply: (cv: CommentView) => void;
  onEdit?: (cv: CommentView) => void;
  overrideContent?: string;
  isHighlighted?: boolean;
}

export default function CommentItem({ cv, auth, depth, onReply, onEdit, overrideContent, isHighlighted }: Props) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [score, setScore] = useState(cv.counts.score);
  const [flash, setFlash] = useState<{ key: number; delta: 1 | -1 }>({ key: 0, delta: 1 });
  const lastTapRef = useRef<number>(0);
  const resolvedIdRef = useRef<number | null>(null);

  const isOwnComment =
    cv.creator.name === auth.username &&
    cv.creator.actor_id.includes(auth.instance);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      const newLiked = !liked;
      const delta = newLiked ? 1 : -1;
      setLiked(newLiked);
      setScore((s) => s + delta);
      setFlash((f) => ({ key: f.key + 1, delta: delta as 1 | -1 }));
      const doLike = async () => {
        if (resolvedIdRef.current === null) {
          const resolved = await resolveCommentId(auth.instance, auth.token, cv.comment.ap_id).catch(() => null);
          resolvedIdRef.current = resolved ?? cv.comment.id;
        }
        await likeComment(auth.instance, auth.token, resolvedIdRef.current, newLiked ? 1 : 0);
      };
      doLike().catch(() => {
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
      data-comment-id={cv.comment.id}
      className={styles.comment}
      style={{
        paddingLeft: `${16 + (depth - 1) * 14}px`,
        ...(isHighlighted ? { border: '2px solid #ff6b35', borderRadius: 8 } : {}),
      }}
      onClick={handleClick}
    >
      <div className={styles.authorRow}>
        <button
          className={styles.creatorName}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/user/${instanceFromActorId(cv.creator.actor_id)}/${cv.creator.name}`);
          }}
        >
          <CreatorAvatar name={cv.creator.name} avatar={cv.creator.avatar} size={20} />
          @{cv.creator.display_name ?? cv.creator.name}
        </button>
        <span className={liked ? styles.scoreLiked : styles.score}>▲ {score}</span>
        {flash.key > 0 && (
          <span key={flash.key} className={styles.scoreFlash}>
            {flash.delta > 0 ? '+1' : '-1'}
          </span>
        )}
      </div>
      <div className={styles.body}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {overrideContent ?? cv.comment.content}
        </ReactMarkdown>
      </div>
      <div className={styles.commentActions}>
        <button
          className={styles.replyButton}
          onClick={(e) => { e.stopPropagation(); onReply(cv); }}
        >
          ↩ Reply
        </button>
        {isOwnComment && onEdit && (
          <button
            className={styles.editButton}
            onClick={(e) => { e.stopPropagation(); onEdit(cv); }}
          >
            ✏ Edit
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add CSS for commentActions and editButton to CommentItem.module.css**

Add at the end of `src/components/CommentItem.module.css`:

```css
.commentActions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.editButton {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.72rem;
  padding: 4px 0 0;
  cursor: pointer;
  display: block;
}

.editButton:hover {
  opacity: 0.8;
}
```

Also update the existing `.replyButton` rule — remove `display: block` since it's now inside a flex container:

```css
.replyButton {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.72rem;
  padding: 4px 0 0;
  cursor: pointer;
}
```

- [ ] **Step 5: Run CommentItem tests and verify they pass**

```bash
npm test -- --run src/components/CommentItem.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/CommentItem.tsx src/components/CommentItem.module.css src/components/CommentItem.test.tsx
git commit -m "feat: add edit button to own comments in CommentItem"
```

---

## Task 4: Thread onEdit and localEdits through CommentList

**Files:**
- Modify: `src/components/CommentList.tsx`
- Modify: `src/components/CommentList.test.tsx`

- [ ] **Step 1: Write a failing test for onEdit threading**

Add to the `describe('CommentList', ...)` block in `src/components/CommentList.test.tsx`:

```ts
it('passes onEdit down to CommentItems', () => {
  const onEdit = vi.fn();
  const ownComment = {
    comment: { id: 3, content: 'My comment', path: '0.3', ap_id: 'https://lemmy.world/comment/3' },
    creator: { name: 'me', actor_id: 'https://lemmy.world/u/me' },
    counts: { score: 1 },
  } as unknown as CommentView;
  render(
    <CommentList
      comments={[...mockComments, ownComment]}
      localReplies={[]}
      auth={mockAuth}
      onSetReplyTarget={() => {}}
      onEdit={onEdit}
      localEdits={{}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));
  expect(onEdit).toHaveBeenCalledWith(ownComment);
});

it('passes overrideContent from localEdits to the matching CommentItem', () => {
  render(
    <CommentList
      comments={mockComments}
      localReplies={[]}
      auth={mockAuth}
      onSetReplyTarget={() => {}}
      onEdit={vi.fn()}
      localEdits={{ 1: 'Edited first comment' }}
    />,
  );
  expect(screen.getByText('Edited first comment')).toBeInTheDocument();
  expect(screen.queryByText('First comment')).not.toBeInTheDocument();
});
```

Also update the `Wrapper` component inside `CommentList.test.tsx` to include the new props:

```tsx
function Wrapper({ onSubmit = vi.fn() }: { onSubmit?: (content: string) => Promise<void> }) {
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [localReplies] = useState<CommentView[]>([]);
  return (
    <>
      <CommentList
        comments={mockComments}
        localReplies={localReplies}
        auth={mockAuth}
        onSetReplyTarget={setReplyTarget}
        onEdit={vi.fn()}
        localEdits={{}}
      />
      <ReplySheet
        mode={replyTarget ? 'reply' : null}
        target={replyTarget ?? undefined}
        onSubmit={onSubmit}
        onClose={() => setReplyTarget(null)}
      />
    </>
  );
}
```

- [ ] **Step 2: Run the failing tests**

```bash
npm test -- --run src/components/CommentList.test.tsx
```

Expected: the two new tests fail (TypeScript errors or runtime — `onEdit`/`localEdits` not accepted yet).

- [ ] **Step 3: Update CommentList.tsx**

Replace the entire content of `src/components/CommentList.tsx`:

```tsx
import { useMemo } from 'react';
import { type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentItem from './CommentItem';

interface Props {
  comments: CommentView[];
  localReplies: CommentView[];
  auth: AuthState;
  onSetReplyTarget: (cv: CommentView | null) => void;
  onEdit: (cv: CommentView) => void;
  localEdits: Record<number, string>;
  highlightCommentId?: number;
}

export default function CommentList({ comments, localReplies, auth, onSetReplyTarget, onEdit, localEdits, highlightCommentId }: Props) {
  const items = useMemo(() => {
    const allItems = [...comments, ...localReplies];
    const childMap = new Map<string, CommentView[]>();
    const roots: CommentView[] = [];
    for (const cv of allItems) {
      const parts = cv.comment.path.split('.');
      if (parts.length === 2) {
        roots.push(cv);
      } else {
        const parentId = parts[parts.length - 2];
        if (!childMap.has(parentId)) childMap.set(parentId, []);
        childMap.get(parentId)!.push(cv);
      }
    }
    const result: CommentView[] = [];
    function collect(cv: CommentView) {
      result.push(cv);
      for (const child of childMap.get(String(cv.comment.id)) ?? []) collect(child);
    }
    for (const root of roots) collect(root);
    return result;
  }, [comments, localReplies]);

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
            onReply={onSetReplyTarget}
            onEdit={onEdit}
            overrideContent={localEdits[cv.comment.id]}
            isHighlighted={cv.comment.id === highlightCommentId}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 4: Run CommentList tests and verify they pass**

```bash
npm test -- --run src/components/CommentList.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/CommentList.tsx src/components/CommentList.test.tsx
git commit -m "feat: thread onEdit and localEdits through CommentList"
```

---

## Task 5: Wire up PostCard with SheetState, edit, new comment, and scroll

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Add editComment to the lemmy mock and new tests in PostCard.test.tsx**

In `src/components/PostCard.test.tsx`, find the `vi.mock('../lib/lemmy', ...)` block and add `editComment` and `resolveCommentId` to it:

```ts
vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'My reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
  editComment: vi.fn().mockResolvedValue({
    comment: { id: 1, content: 'Edited', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
    creator: { name: 'alice', display_name: null },
    counts: { score: 1 },
  }),
  savePost: vi.fn().mockResolvedValue(undefined),
}));
```

Add these tests to the `describe('PostCard', ...)` block:

```ts
it('renders a Comment button in the footer', () => {
  render(
    <PostCard
      post={MOCK_POST}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onSave={vi.fn()}
    />,
  );
  expect(screen.getByTestId('comment-button')).toBeInTheDocument();
});

it('clicking Comment button shows Commenting on post header in sheet', async () => {
  render(
    <PostCard
      post={MOCK_POST}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onSave={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByTestId('comment-button'));
  expect(screen.getByText(/commenting on post/i)).toBeInTheDocument();
});

it('submitting a new comment calls createComment without parentId and adds it locally', async () => {
  const { createComment } = await import('../lib/lemmy');
  render(
    <PostCard
      post={MOCK_POST}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onSave={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByTestId('comment-button'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Top level comment' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
  });
  expect(createComment).toHaveBeenCalledWith('lemmy.world', 'tok', 1, 'Top level comment', undefined);
});
```

- [ ] **Step 2: Run the failing tests**

```bash
npm test -- --run src/components/PostCard.test.tsx
```

Expected: the three new tests fail.

- [ ] **Step 3: Rewrite PostCard.tsx**

Replace the entire content of `src/components/PostCard.tsx`:

```tsx
import { useMemo, useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { useNavigate } from 'react-router-dom';
import { resolveCommentId, createComment, editComment, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import styles from './PostCard.module.css';
import { useCommentLoader } from '../hooks/useCommentLoader';
import { useShare } from '../hooks/useShare';
import { instanceFromActorId, isImageUrl, getShareUrl } from '../lib/urlUtils';
import CreatorAvatar from './CreatorAvatar';
import Toast from './Toast';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

type SheetState =
  | { mode: 'reply'; target: CommentView }
  | { mode: 'edit'; target: CommentView }
  | { mode: 'new' }
  | null;

interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSave: () => void;
}

function communityInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export default function PostCard({ post, auth, zIndex, scale, onSwipeRight, onSwipeLeft, onSave }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = useMemo(() => instanceFromActorId(community.actor_id), [community.actor_id]);
  const { comments, commentsLoaded } = useCommentLoader(p, community, auth);
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
  const [localEdits, setLocalEdits] = useState<Record<number, string>>({});
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isLinkBannerPressed, setIsLinkBannerPressed] = useState(false);
  const { share, toastVisible, setToastVisible } = useShare();
  const navigate = useNavigate();

  // Raise card when keyboard appears
  useEffect(() => {
    if (!sheetState || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
    };
    vv.addEventListener('resize', handler);
    handler();
    return () => {
      vv.removeEventListener('resize', handler);
      setKeyboardOffset(0);
    };
  }, [sheetState]);

  // Scroll parent comment into view when replying
  useEffect(() => {
    if (sheetState?.mode !== 'reply') return;
    const el = scrollRef.current?.querySelector(
      `[data-comment-id="${sheetState.target.comment.id}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [sheetState]);

  const x = useMotionValue(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

  // Right swipe rotates CCW ("lifting"), left swipe CW ("sinking")
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

  const isImage = !!p.url && isImageUrl(p.url);
  const imageSrc = isImage ? p.url : p.thumbnail_url;
  const showLinkBanner = !!p.url && !isImage;

  const handleShare = () => share(p.name, getShareUrl(auth.instance, p.id));

  const handleReplySubmit = async (content: string, target: CommentView) => {
    const parentApId = target.comment.ap_id;
    const parentId =
      await resolveCommentId(auth.instance, auth.token, parentApId).catch(() => null)
      ?? target.comment.id;
    const newComment = await createComment(auth.instance, auth.token, p.id, content, parentId);
    const remapped = {
      ...newComment,
      comment: { ...newComment.comment, path: target.comment.path + '.' + newComment.comment.id },
    };
    setLocalReplies((prev) => [...prev, remapped]);
  };

  const handleEditSubmit = async (content: string, target: CommentView) => {
    const localId =
      await resolveCommentId(auth.instance, auth.token, target.comment.ap_id).catch(() => null)
      ?? target.comment.id;
    await editComment(auth.instance, auth.token, localId, content);
    setLocalEdits((prev) => ({ ...prev, [target.comment.id]: content }));
  };

  const handleNewCommentSubmit = async (content: string) => {
    const newComment = await createComment(auth.instance, auth.token, p.id, content);
    const remapped = {
      ...newComment,
      comment: { ...newComment.comment, path: '0.' + newComment.comment.id },
    };
    setLocalReplies((prev) => [...prev, remapped]);
  };

  const handleSubmit = async (content: string) => {
    if (!sheetState) return;
    if (sheetState.mode === 'reply') {
      await handleReplySubmit(content, sheetState.target);
    } else if (sheetState.mode === 'edit') {
      await handleEditSubmit(content, sheetState.target);
    } else {
      await handleNewCommentSubmit(content);
    }
    setSheetState(null);
  };

  const initialEditContent =
    sheetState?.mode === 'edit'
      ? (localEdits[sheetState.target.comment.id] ?? sheetState.target.comment.content)
      : undefined;

  return (
    <motion.div
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...(bind() as object)}
    >
      <motion.div className={styles.overlay} style={{ backgroundColor: overlayColor }} />
      <motion.div
        className={styles.saveOverlay}
        style={{ opacity: Math.min(pullDelta / 80, 1) }}
      />

      <div
        ref={scrollRef}
        data-testid="scroll-content"
        className={styles.scrollContent}
        onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          const delta = e.touches[0].clientY - touchStartY.current;
          if (scrollRef.current && scrollRef.current.scrollTop <= 0 && delta > 0) {
            setPullDelta(delta);
          } else {
            setPullDelta(0);
          }
        }}
        onTouchEnd={() => {
          if (pullDelta >= 80) onSave();
          setPullDelta(0);
        }}
      >
        <div className={styles.meta}>
          <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
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
        </div>

        <div className={styles.title}>{p.name}</div>

        {showLinkBanner && (
          <div
            data-testid="link-banner"
            className={isLinkBannerPressed ? `${styles.linkBanner} ${styles.linkBannerPressed}` : styles.linkBanner}
            onPointerDown={() => setIsLinkBannerPressed(true)}
            onPointerUp={() => setIsLinkBannerPressed(false)}
            onPointerLeave={() => setIsLinkBannerPressed(false)}
            onClick={() => window.open(p.url!, '_blank', 'noopener,noreferrer')}
          >
            <span className={styles.linkBannerIcon}>🔗</span>
            <div className={styles.linkBannerContent}>
              <div className={styles.linkBannerDomain}>{instanceFromActorId(p.url!)}</div>
              <div className={styles.linkBannerHint}>Tap to open link</div>
            </div>
            <span className={styles.linkBannerArrow}>↗</span>
          </div>
        )}

        {imageSrc && <img className={styles.image} src={imageSrc} alt="" loading="lazy" />}

        {p.body && <div className={styles.excerpt}>{p.body}</div>}

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
          <button
            data-testid="comment-button"
            className={styles.shareButton}
            onClick={(e) => { e.stopPropagation(); setSheetState({ mode: 'new' }); }}
          >
            💬 Comment
          </button>
        </div>

        <div className={styles.commentsSection}>
          {commentsLoaded && comments.length === 0 && counts.comments > 0 && (
            <a
              className={styles.commentsFallback}
              href={p.ap_id}
              target="_blank"
              rel="noopener noreferrer"
            >
              {counts.comments} comments — view on {instanceFromActorId(p.ap_id)}
            </a>
          )}
          <CommentList
            comments={comments}
            localReplies={localReplies}
            auth={auth}
            onSetReplyTarget={(cv) => setSheetState({ mode: 'reply', target: cv })}
            onEdit={(cv) => setSheetState({ mode: 'edit', target: cv })}
            localEdits={localEdits}
          />
        </div>
      </div>
      <div
        data-testid="reply-wrapper"
        style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardOffset }}
      >
        <ReplySheet
          mode={sheetState?.mode ?? null}
          target={sheetState && sheetState.mode !== 'new' ? sheetState.target : undefined}
          initialContent={initialEditContent}
          onSubmit={handleSubmit}
          onClose={() => setSheetState(null)}
        />
      </div>
      <Toast message="Link copied" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </motion.div>
  );
}
```

- [ ] **Step 4: Run PostCard tests and verify they pass**

```bash
npm test -- --run src/components/PostCard.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run the full test suite to verify no regressions**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.test.tsx
git commit -m "feat: add comment editing, top-level commenting, and scroll-to-parent on reply"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Edit button on own comments — Task 3 (CommentItem) + Task 5 (PostCard wires `onEdit`)
- ✅ Bigger textarea — Task 2 (min-height 72→120px)
- ✅ Top-level comment on post — Task 5 (footer button + `handleNewCommentSubmit`)
- ✅ Scroll parent into view on reply — Task 5 (`useEffect` on `sheetState`)
- ✅ `editComment` API call — Task 1 (lemmy.ts)
- ✅ `localEdits` updates displayed content — Task 4 (CommentList) + Task 3 (CommentItem `overrideContent`)
- ✅ PostDetailCard stays working — Task 2 (minimal migration)

**Placeholder scan:** No TBDs, all code blocks complete.

**Type consistency:** `SheetState` defined once in `PostCard.tsx` and used only there. `onEdit: (cv: CommentView) => void` matches across `CommentItem`, `CommentList`, and `PostCard`. `localEdits: Record<number, string>` consistent across `CommentList` and `PostCard`.
