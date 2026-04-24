# Reporting Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add report post and report comment functionality using Lemmy's native report API, surfaced as a bottom sheet with predefined reason chips and an optional free-text detail field.

**Architecture:** Two new `lemmy.ts` API functions feed a shared `ReportSheet` component. `PostCardShell` manages a single `reportTarget` state covering both post and comment reports; the sheet opens when the footer Report button (post) or a comment's Report button (comment) is tapped. Comment ID resolution to the user's home instance is handled inside `ReportSheet` on submit, matching how `CommentItem` resolves IDs for voting.

**Tech Stack:** React 18, TypeScript, lemmy-js-client (`createPostReport`, `createCommentReport`), CSS Modules, Vitest + @testing-library/react.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/lemmy.ts` | Add `reportPost`, `reportComment` |
| Modify | `src/lib/lemmy.test.ts` | Mock new methods + unit tests |
| Create | `src/components/ReportSheet.tsx` | Bottom sheet UI (chips, detail, success/error) |
| Create | `src/components/ReportSheet.module.css` | Sheet styles |
| Create | `src/components/ReportSheet.test.tsx` | Unit tests for ReportSheet |
| Modify | `src/components/CommentItem.tsx` | Add `onReport` prop + Report button |
| Modify | `src/components/CommentItem.module.css` | `.reportButton` style |
| Modify | `src/components/CommentItem.test.tsx` | Test Report button visibility + callback |
| Modify | `src/components/CommentList.tsx` | Thread `onReport` prop to CommentItem |
| Modify | `src/components/PostCardShell.tsx` | `reportTarget` state, footer button, ReportSheet |
| Modify | `src/components/PostCardShell.test.tsx` | Test Report button + sheet opening |

---

### Task 1: API functions

**Files:**
- Modify: `src/lib/lemmy.ts`
- Modify: `src/lib/lemmy.test.ts`

- [ ] **Step 1: Add failing tests to `src/lib/lemmy.test.ts`**

Update the import line at the top to include `reportPost` and `reportComment`:

```ts
import { login, fetchPosts, upvotePost, downvotePost, savePost, deletePost, deleteComment, fetchComments, likeComment, createComment, editComment, fetchPersonDetails, fetchPost, resolveCommunityId, createPost, uploadImage, searchCommunities, searchPosts, blockPerson, blockCommunity, reportPost, reportComment } from './lemmy';
```

In the `vi.mock('lemmy-js-client', ...)` block, inside the object returned by `MockLemmyHttp.mockImplementation(() => ({ ... }))`, add these two entries alongside the existing mock methods (before the closing `})`):

```ts
createPostReport: vi.fn().mockResolvedValue({}),
createCommentReport: vi.fn().mockResolvedValue({}),
```

At the end of the file (after the last `describe` block), add:

```ts
describe('reportPost', () => {
  it('calls createPostReport with post_id and reason', async () => {
    await reportPost('lemmy.world', 'tok', 42, 'Spam');
    const instance = MockLemmyHttp.mock.results[0].value;
    expect(instance.createPostReport).toHaveBeenCalledWith({ post_id: 42, reason: 'Spam' });
  });
});

describe('reportComment', () => {
  it('calls createCommentReport with comment_id and reason', async () => {
    await reportComment('lemmy.world', 'tok', 7, 'Harassment — bad actor');
    const instance = MockLemmyHttp.mock.results[0].value;
    expect(instance.createCommentReport).toHaveBeenCalledWith({ comment_id: 7, reason: 'Harassment — bad actor' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: FAIL — `reportPost is not a function`.

- [ ] **Step 3: Add `reportPost` and `reportComment` to `src/lib/lemmy.ts`**

At the very end of `src/lib/lemmy.ts`, after the `blockCommunity` function, add:

```ts
export async function reportPost(
  instance: string,
  token: string,
  postId: number,
  reason: string,
): Promise<void> {
  await client(instance, token).createPostReport({ post_id: postId, reason });
}

export async function reportComment(
  instance: string,
  token: string,
  commentId: number,
  reason: string,
): Promise<void> {
  await client(instance, token).createCommentReport({ comment_id: commentId, reason });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/lib/lemmy.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lemmy.ts src/lib/lemmy.test.ts
git commit -m "feat: add reportPost and reportComment API functions"
```

---

### Task 2: ReportSheet component

**Files:**
- Create: `src/components/ReportSheet.tsx`
- Create: `src/components/ReportSheet.module.css`
- Create: `src/components/ReportSheet.test.tsx`

- [ ] **Step 1: Create `src/components/ReportSheet.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReportSheet from './ReportSheet';

vi.mock('../lib/lemmy', () => ({
  reportPost: vi.fn().mockResolvedValue(undefined),
  reportComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

const AUTH = { instance: 'lemmy.world', token: 'tok', username: 'alice' };
const POST_TARGET = { type: 'post' as const, postId: 42 };
const COMMENT_TARGET = { type: 'comment' as const, commentId: 7, apId: 'https://lemmy.world/comment/7' };
const onClose = vi.fn();

beforeEach(() => { vi.clearAllMocks(); });

describe('ReportSheet', () => {
  it('renders nothing when target is null', () => {
    const { container } = render(<ReportSheet target={null} auth={AUTH} onClose={onClose} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Report post" title for post target', () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    expect(screen.getByText('Report post')).toBeInTheDocument();
  });

  it('shows "Report comment" title for comment target', () => {
    render(<ReportSheet target={COMMENT_TARGET} auth={AUTH} onClose={onClose} />);
    expect(screen.getByText('Report comment')).toBeInTheDocument();
  });

  it('Submit button is disabled before a chip is selected', () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('Submit button is enabled after a chip is selected', () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
  });

  it('sends chip-only reason string when detail is empty', async () => {
    const { reportPost } = await import('../lib/lemmy');
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(reportPost).toHaveBeenCalledWith('lemmy.world', 'tok', 42, 'Spam');
  });

  it('sends chip + detail reason string when detail is filled', async () => {
    const { reportPost } = await import('../lib/lemmy');
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Harassment' }));
    fireEvent.change(screen.getByPlaceholderText(/additional details/i), { target: { value: 'repeated abuse' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(reportPost).toHaveBeenCalledWith('lemmy.world', 'tok', 42, 'Harassment — repeated abuse');
  });

  it('calls reportComment for comment target', async () => {
    const { reportComment } = await import('../lib/lemmy');
    render(<ReportSheet target={COMMENT_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'NSFW' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(reportComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 'NSFW');
  });

  it('shows "Report submitted" after successful submit', async () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    expect(screen.getByText('Report submitted')).toBeInTheDocument();
  });

  it('calls onClose 1.5s after successful submit', async () => {
    vi.useFakeTimers();
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows inline error on API failure and does not close', async () => {
    const { reportPost } = await import('../lib/lemmy');
    vi.mocked(reportPost).mockRejectedValueOnce(new Error('Server error'));
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    expect(screen.getByText('Server error')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancel button calls onClose', () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/ReportSheet.test.tsx
```

Expected: FAIL — `Cannot find module './ReportSheet'`.

- [ ] **Step 3: Create `src/components/ReportSheet.module.css`**

```css
.sheet {
  position: relative;
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.chip {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.chipSelected {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.textarea {
  width: 100%;
  min-height: 80px;
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

.success {
  font-size: 0.88rem;
  color: var(--accent);
  text-align: center;
  padding: 16px 0;
  font-weight: 600;
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

- [ ] **Step 4: Create `src/components/ReportSheet.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { type AuthState } from '../lib/store';
import { reportPost, reportComment, resolveCommentId } from '../lib/lemmy';
import styles from './ReportSheet.module.css';

const REASONS = ['Spam', 'Harassment', 'Hate speech', 'NSFW', 'Misinformation', 'Other'];

export type ReportTarget =
  | { type: 'post'; postId: number }
  | { type: 'comment'; commentId: number; apId: string }
  | null;

interface Props {
  target: ReportTarget;
  auth: AuthState;
  onClose: () => void;
}

export default function ReportSheet({ target, auth, onClose }: Props) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!target) {
      setSelectedReason(null);
      setDetail('');
      setError(null);
      setSuccess(false);
    }
  }, [target]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(onClose, 1500);
    return () => clearTimeout(timer);
  }, [success, onClose]);

  if (!target) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    const reason = detail.trim() ? `${selectedReason} — ${detail.trim()}` : selectedReason;
    setSubmitting(true);
    setError(null);
    try {
      if (target.type === 'post') {
        await reportPost(auth.instance, auth.token, target.postId, reason);
      } else {
        const resolved = await resolveCommentId(auth.instance, auth.token, target.apId).catch(() => null);
        const commentId = resolved ?? target.commentId;
        await reportComment(auth.instance, auth.token, commentId, reason);
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const title = target.type === 'post' ? 'Report post' : 'Report comment';

  return (
    <div className={`${styles.sheet} ${styles.open}`}>
      <div className={styles.header}>{title}</div>
      {success ? (
        <div className={styles.success}>Report submitted</div>
      ) : (
        <>
          <div className={styles.chips}>
            {REASONS.map((r) => (
              <button
                key={r}
                className={`${styles.chip} ${selectedReason === r ? styles.chipSelected : ''}`}
                onClick={() => setSelectedReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            className={styles.textarea}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Additional details (optional)"
          />
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button className={styles.cancel} onClick={onClose}>Cancel</button>
            <button
              className={styles.send}
              onClick={handleSubmit}
              disabled={submitting || !selectedReason}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/ReportSheet.test.tsx
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ReportSheet.tsx src/components/ReportSheet.module.css src/components/ReportSheet.test.tsx
git commit -m "feat: add ReportSheet component"
```

---

### Task 3: Wire CommentItem and CommentList

**Files:**
- Modify: `src/components/CommentItem.tsx`
- Modify: `src/components/CommentItem.module.css`
- Modify: `src/components/CommentItem.test.tsx`
- Modify: `src/components/CommentList.tsx`

- [ ] **Step 1: Add failing tests to `src/components/CommentItem.test.tsx`**

At the end of the existing `describe('CommentItem', ...)` block, add these four tests:

```ts
it('shows Report button on non-own comments when onReport is provided', () => {
  renderItem({ onReport: vi.fn() });
  expect(screen.getByRole('button', { name: /report/i })).toBeInTheDocument();
});

it('hides Report button on own comments even when onReport is provided', () => {
  const ownCv = {
    ...mockCv,
    creator: { name: 'me', actor_id: 'https://lemmy.world/u/me', avatar: undefined },
  };
  render(
    <SettingsProvider>
      <CommentItem cv={ownCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} onReport={vi.fn()} />
    </SettingsProvider>
  );
  expect(screen.queryByRole('button', { name: /report/i })).not.toBeInTheDocument();
});

it('clicking Report button calls onReport with the comment view', () => {
  const onReport = vi.fn();
  renderItem({ onReport });
  fireEvent.click(screen.getByRole('button', { name: /report/i }));
  expect(onReport).toHaveBeenCalledWith(mockCv);
});

it('does not show Report button when onReport prop is absent', () => {
  renderItem();
  expect(screen.queryByRole('button', { name: /report/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/CommentItem.test.tsx
```

Expected: FAIL — Report button tests fail because the button doesn't exist yet.

- [ ] **Step 3: Add `onReport` prop and Report button to `src/components/CommentItem.tsx`**

In the `Props` interface, add:
```ts
onReport?: (cv: CommentView) => void;
```

Update the component function signature destructuring to include `onReport`:
```ts
export default function CommentItem({ cv, auth, depth, onReply, onEdit, onReport, overrideContent, isHighlighted, opActorId }: Props) {
```

In the `commentActions` div (after the edit button block), add:
```tsx
{!isOwnComment && onReport && (
  <button
    className={styles.reportButton}
    onClick={(e) => { e.stopPropagation(); onReport(cv); }}
  >
    ⚑ Report
  </button>
)}
```

- [ ] **Step 4: Add `.reportButton` to `src/components/CommentItem.module.css`**

At the end of the file, add:

```css
.reportButton {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.72rem;
  padding: 4px 0 0;
  cursor: pointer;
}

.reportButton:hover {
  color: #e55;
}
```

- [ ] **Step 5: Thread `onReport` through `src/components/CommentList.tsx`**

In the `Props` interface, add:
```ts
onReport?: (cv: CommentView) => void;
```

Update the function signature to destructure `onReport`:
```ts
export default function CommentList({ comments, localReplies, auth, onSetReplyTarget, onEdit, localEdits, highlightCommentId, opActorId, onReport }: Props) {
```

In the `<CommentItem>` render call inside the `items.map(...)`, add the prop:
```tsx
onReport={onReport}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/CommentItem.test.tsx
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/CommentItem.tsx src/components/CommentItem.module.css src/components/CommentItem.test.tsx src/components/CommentList.tsx
git commit -m "feat: add Report button to comments"
```

---

### Task 4: Wire PostCardShell

**Files:**
- Modify: `src/components/PostCardShell.tsx`
- Modify: `src/components/PostCardShell.test.tsx`

- [ ] **Step 1: Add mocks and failing tests to `src/components/PostCardShell.test.tsx`**

In the existing `vi.mock('../lib/lemmy', ...)` block, add `reportPost` and `reportComment` alongside the existing entries:

```ts
reportPost: vi.fn().mockResolvedValue(undefined),
reportComment: vi.fn().mockResolvedValue(undefined),
```

(`resolveCommentId` is already mocked — do not duplicate it.)

At the end of the existing `describe('PostCardShell', ...)` block, add:

```ts
it('shows Report button when auth is provided', () => {
  renderShell({ auth: AUTH });
  expect(screen.getByTestId('report-button')).toBeInTheDocument();
});

it('hides Report button when auth is null', () => {
  renderShell({ auth: null });
  expect(screen.queryByTestId('report-button')).not.toBeInTheDocument();
});

it('clicking Report button opens the report sheet', () => {
  renderShell({ auth: AUTH });
  fireEvent.click(screen.getByTestId('report-button'));
  expect(screen.getByText('Report post')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/PostCardShell.test.tsx
```

Expected: FAIL — `report-button` not found.

- [ ] **Step 3: Update `src/components/PostCardShell.tsx`**

Add imports after the existing import block:
```tsx
import ReportSheet, { type ReportTarget } from './ReportSheet';
```

Add `reportTarget` state alongside the existing `localSaved` state:
```tsx
const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
```

Add a `handleReport` handler alongside the existing `handleSave`:
```tsx
const handleReport = (cv: CommentView) => {
  setReportTarget({ type: 'comment', commentId: cv.comment.id, apId: cv.comment.ap_id });
};
```

In the `footer` div, after the Share button, add the Report button (auth-gated):
```tsx
{auth && (
  <button
    data-testid="report-button"
    className={styles.footerAction}
    onClick={(e) => { e.stopPropagation(); setReportTarget({ type: 'post', postId: post.id }); }}
  >
    ⚑ Report
  </button>
)}
```

In the `<CommentList>` call, add the `onReport` prop (after `localEdits`):
```tsx
onReport={auth ? handleReport : undefined}
```

After the existing `reply-wrapper` div (and inside the outer `position: relative` container), add:
```tsx
{auth && (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
    <ReportSheet
      target={reportTarget}
      auth={auth}
      onClose={() => setReportTarget(null)}
    />
  </div>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/mikey/Development/Staked && npm test -- --reporter=verbose src/components/PostCardShell.test.tsx
```

Expected: All tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
cd /home/mikey/Development/Staked && npm test
```

Expected: All tests pass with no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx
git commit -m "feat: wire reporting into PostCardShell"
```
