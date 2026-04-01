# Comment Editing, Top-Level Commenting, and Reply UX

**Date:** 2026-03-31

## Overview

Add four UX improvements to the comment system in `PostCard`:

1. Edit button on the user's own comments
2. Larger textarea in the reply/edit sheet
3. Top-level "Comment on post" from the post footer
4. Scroll parent comment into view when replying

## Architecture

### Unified Sheet State

Replace `replyTarget: CommentView | null` in `PostCard` with a discriminated union:

```ts
type SheetState =
  | { mode: 'reply'; target: CommentView }
  | { mode: 'edit';  target: CommentView }
  | { mode: 'new' }
  | null
```

One state variable drives the sheet for all three modes. `null` means closed.

### Local Edit Tracking

Add `localEdits: Record<number, string>` state to `PostCard`. When an edit is submitted successfully, the comment ID is added as a key with the new content as the value. `CommentItem` uses `localEdits[cv.comment.id] ?? cv.comment.content` to display content.

## Component Changes

### `src/lib/lemmy.ts`

Add `editComment` function:

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

### `src/components/ReplySheet.tsx`

**Props:**
- Add `mode: 'reply' | 'edit' | 'new'`
- Add `initialContent?: string` (pre-filled for edit mode)
- `target: CommentView | null` remains (used in reply mode for header; null in new/edit modes)

**Behavior:**
- Header text per mode:
  - `reply`: "↩ Replying to @{username}"
  - `edit`: "✏ Editing your comment"
  - `new`: "💬 Commenting on post"
- `useState(initialContent ?? '')` for textarea — initializes with existing content in edit mode
- Sheet visible when `mode` prop is present (parent controls visibility by passing/not passing)
- Open condition: sheet renders when `mode` is not null (caller controls this via `sheetState`)

### `src/components/ReplySheet.module.css`

- Textarea `min-height`: 72px → 120px

### `src/components/CommentItem.tsx`

**Props:**
- Add `onEdit?: (cv: CommentView) => void`
- Add `overrideContent?: string` — displayed instead of `cv.comment.content` when set

**Behavior:**
- Show `✏ Edit` button when `cv.creator.name === auth.username` AND `auth.instance` matches the instance in `cv.creator.actor_id`
- Edit button: same row as Reply, styled in `var(--accent)` color
- Body renders `overrideContent ?? cv.comment.content`

### `src/components/CommentList.tsx`

**Props:**
- Add `onEdit: (cv: CommentView) => void`
- Add `localEdits: Record<number, string>`

Thread both down to each `CommentItem`.

### `src/components/PostCard.tsx`

**State:**
- Replace `replyTarget: CommentView | null` with `sheetState: SheetState`
- Add `localEdits: Record<number, string>`

**Handlers:**

`handleReplySubmit(content)` — unchanged logic, now reads `sheetState.target`:
- Resolves parent comment ID, calls `createComment` with `parentId`
- Remaps path, pushes to `localReplies`

`handleNewCommentSubmit(content)`:
- Calls `createComment(auth.instance, auth.token, p.id, content)` with no `parentId`
- Remaps path to `'0.' + newComment.comment.id`
- Pushes to `localReplies`

`handleEditSubmit(content)`:
- Reads `sheetState` (mode is `edit`, target is the comment)
- Resolves local comment ID via `resolveCommentId` → fallback to `target.comment.id`
- Calls `editComment(auth.instance, auth.token, localId, content)`
- Updates `localEdits`: `setLocalEdits(prev => ({ ...prev, [target.comment.id]: content }))`

**Unified submit handler** dispatches to the correct handler based on `sheetState.mode`.

**Footer:**
- Add `💬 Comment` button next to Share, calls `setSheetState({ mode: 'new' })`

**Scroll-to-parent:**
```ts
useEffect(() => {
  if (sheetState?.mode !== 'reply') return;
  const el = scrollRef.current?.querySelector(
    `[data-comment-id="${sheetState.target.comment.id}"]`
  );
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}, [sheetState]);
```

**Pass to `CommentList`:**
- `onSetReplyTarget`: `(cv) => setSheetState({ mode: 'reply', target: cv })`
- `onEdit`: `(cv) => setSheetState({ mode: 'edit', target: cv })`
- `localEdits`

## Files Changed

| File | Change |
|------|--------|
| `src/lib/lemmy.ts` | Add `editComment` |
| `src/components/ReplySheet.tsx` | Add `mode`, `initialContent` props; update header; sheet open logic |
| `src/components/ReplySheet.module.css` | Textarea min-height 72→120px |
| `src/components/CommentItem.tsx` | Add `onEdit`, `overrideContent` props; show Edit button for own comments |
| `src/components/CommentList.tsx` | Thread `onEdit`, `localEdits` |
| `src/components/PostCard.tsx` | Unified `SheetState`, `localEdits`, new handlers, footer button, scroll effect |

## Out of Scope

- Deleting comments
- Edit history or "edited" indicator
- Editing posts
