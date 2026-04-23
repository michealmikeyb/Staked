# Unsave Post + Delete Own Post/Comment

**Date:** 2026-04-22  
**Status:** Approved

## Overview

Two features: (1) toggle save state on posts with visual feedback, including unsave from SavedPage; (2) delete own posts and comments via an inline confirmation strip.

## API layer (`src/lib/lemmy.ts`)

- `savePost(instance, token, postId, save: boolean)` — add `save` param, replacing hardcoded `save: true`
- `deletePost(instance, token, postId)` — calls `client.deletePost({ post_id, deleted: true })`
- `deleteComment(instance, token, commentId)` — calls `client.deleteComment({ comment_id, deleted: true })`

## Save toggle

**`PostCardShell`**
- Add `saved?: boolean` to the `Post` interface
- Track `localSaved` state, initialized from `post.saved ?? false`
- Footer "🔖 Save" / "🔖 Saved" button toggles on tap: optimistic update, revert on error
- "Saved" state renders with orange tint to distinguish it visually

**`SavedPage`**
- Each card gets a small "🔖 Unsave" button in the bottom-right
- On tap: call `savePost(..., false)`, remove post from local list

## Delete post

**`PostCardShell`**
- Add `onDelete?: () => void` prop
- Detect post ownership: `creator.actor_id` compared against `auth.instance` + `auth.username`
- Footer shows "🗑 Delete" only for own posts
- Tapping sets `showDeleteConfirm` boolean — footer row morphs into `"Delete post? [Cancel] [Delete]"`
- On confirm: call `deletePost`, then call `onDelete()`. On error: revert to normal footer.
- No optimistic update — wait for API success before calling `onDelete`

**`PostCard`**
- Add `onDismiss` prop (advance feed without voting)
- Pass `onDelete` to PostCardShell: animates card off-screen (`animate(x, 600, ...)`) then calls `onDismiss`

**`FeedStack`**
- Add `onDismiss` callback alongside `onSwipeRight`/`onSwipeLeft`
- Same queue-advance logic as a swipe, skips the vote call

## Delete comment

**`CommentItem`**
- Add `onDelete?: (cv: CommentView) => void` prop
- Show "🗑 Delete" next to "✏ Edit" for own comments only
- Tapping sets local `showDeleteConfirm` state — action row morphs into `"Delete? [Cancel] [Delete]"`
- On confirm: call `onDelete(cv)`. Parent handles the API call and list update.

**`PostCardShell`**
- Handle `onDelete` from CommentItem: resolve comment ID (same pattern as edit), call `deleteComment`
- Track `localDeletes: Set<number>` state for deleted comment IDs
- Pass `localDeletes` to `CommentList`, which filters those IDs out of the rendered list

## Error handling

- **Save toggle**: optimistic update, revert on error (consistent with comment voting)
- **Delete post/comment**: wait for API success; on error revert footer to normal actions, suppress error silently (consistent with existing `handleSave`)

## Testing

- `savePost` unit test: verify `save: false` is passed when unsaving
- `PostCardShell`: save toggle flips state; delete confirm renders inline strip; confirm triggers `onDelete`
- `CommentItem`: delete confirm renders for own comments; confirm calls `onDelete`
- `FeedStack`: `onDismiss` advances queue without calling upvote/downvote
