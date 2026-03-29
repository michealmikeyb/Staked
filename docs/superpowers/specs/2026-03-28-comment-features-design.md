# Comment Features Design

**Date:** 2026-03-28
**Status:** Approved

## Overview

Three features added to the comment section in `PostCard`:

1. **Double-tap to like** — double-tapping a comment upvotes it (or undoes the upvote). Score updates optimistically with a +1/−1 flash animation.
2. **Reply button** — each comment has a reply button that opens a bottom sheet with a textarea for composing a reply. Works at any nesting depth.
3. **Markdown rendering** — comment content is rendered as full markdown including inline images, via `react-markdown` + `remark-gfm`.

---

## New Files

```
src/components/
  CommentItem.tsx      # Single comment: markdown, double-tap like, reply button
  CommentList.tsx      # Comment list + reply-target state
  ReplySheet.tsx       # Bottom sheet: textarea, send/cancel
src/lib/
  lemmy.ts             # +likeComment, +createComment
```

---

## API Layer (`lemmy.ts`)

### `likeComment`

```ts
likeComment(instance: string, token: string, commentId: number, score: 1 | 0): Promise<void>
```

- `score: 1` = upvote, `score: 0` = remove vote (Lemmy uses 0 to undo)
- Uses `// @ts-expect-error legacy auth` pattern (same as existing vote calls)

### `createComment`

```ts
createComment(
  instance: string,
  token: string,
  postId: number,
  content: string,
  parentId?: number,
): Promise<CommentView>
```

- `parentId` is the comment being replied to; omit for top-level
- Returns the newly created `CommentView` for optimistic list append

---

## `CommentItem`

**Props:**

```ts
interface Props {
  cv: CommentView;
  auth: AuthState;
  depth: number;
  onReply: (cv: CommentView) => void;
}
```

**State:** `liked: boolean`, `score: number` (initialised from `cv.counts.score`)

**Double-tap detection:**
- Ref stores timestamp of last tap
- If second tap arrives within 300ms → double-tap
- On double-tap: flip `liked`, update `score` optimistically (+1 / −1), fire `likeComment` in background with `score: liked ? 1 : 0`

**Score flash animation:**
- CSS keyframe: score text turns orange
- A `+1` or `−1` element floats upward ~8px and fades over 600ms
- Triggered via a key-incremented state value that forces animation replay

**Markdown:**
```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]}>{cv.comment.content}</ReactMarkdown>
```
Images render inline as standard `<img>` elements. No extra configuration needed.

**Reply button:** Small "↩ Reply" label below content. Calls `onReply(cv)`.

**Indentation:** Same `paddingLeft: 16 + (depth - 1) * 14` px logic as current PostCard.

---

## `ReplySheet`

**Props:**

```ts
interface Props {
  target: CommentView | null;
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}
```

**Behaviour:**
- Always mounted; slides up via CSS `transform: translateY` when `target` is not null
- Header: "↩ Replying to @{target.creator.name}"
- `<textarea>` for content
- Send button disabled while submitting (`submitting` local state)
- On success: clear textarea, call `onClose()`
- On error: show inline error message below textarea
- Cancel button calls `onClose()`

---

## `CommentList`

**Props:**

```ts
interface Props {
  comments: CommentView[];
  auth: AuthState;
  postId: number;
  instance: string;
  token: string;
}
```

**State:** `items: CommentView[]` (initialised from `comments` prop), `replyTarget: CommentView | null`

**`handleReply(content)`:**
1. Calls `createComment(instance, token, postId, content, replyTarget.comment.id)`
2. Appends returned `CommentView` to `items`
3. Sets `replyTarget` to `null` (closes sheet)

**Renders:**
- `<CommentItem>` for each item in `items`
- `<ReplySheet target={replyTarget} onSubmit={handleReply} onClose={() => setReplyTarget(null)} />`

---

## `PostCard` Changes

Remove the inline comment loop. Replace with:

```tsx
<CommentList
  comments={comments}
  auth={auth}
  postId={p.id}
  instance={resolvedInstance}
  token={resolvedToken}
/>
```

`resolvedInstance` and `resolvedToken` are the instance and token used for the successful `fetchComments` call. The existing load effect stores these in two refs (`resolvedInstanceRef`, `resolvedTokenRef`) updated at each tier before falling through. PostCard reads the refs after load to pass down to `CommentList`.

---

## Dependencies

```bash
npm install react-markdown remark-gfm
```

- `react-markdown` — safe markdown-to-JSX, no `dangerouslySetInnerHTML`
- `remark-gfm` — GFM extensions: tables, strikethrough, task lists, autolinks

---

## Testing

| Test file | What it covers |
|---|---|
| `CommentItem.test.tsx` | Double-tap → `likeComment(1)`, second double-tap → `likeComment(0)`, score updates |
| `ReplySheet.test.tsx` | Renders with target, textarea fill, Send → `onSubmit` called, sheet closes |
| `CommentList.test.tsx` | Reply flow: tap Reply → sheet opens → submit → new comment in list |
| `PostCard.test.tsx` | Existing tests unchanged (fetchComments mock still applies) |

**Mock requirements for new test files:**

```ts
vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  createComment: vi.fn().mockResolvedValue({ comment: { id: 99, content: 'reply', path: '0.1.99' }, creator: { name: 'user' }, counts: { score: 1 } }),
}));
```

---

## Out of Scope

- Downvoting comments (only upvote/undo)
- Editing or deleting comments
- Pagination of comments (existing 50-comment limit unchanged)
- Markdown in post body (only comments)
