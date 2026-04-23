# Unsave Post + Delete Own Post/Comment

**Date:** 2026-04-22  
**Status:** Approved

## Overview

Two features: (1) toggle save state on posts with visual feedback, including unsave from SavedPage; (2) delete own posts and comments from the ProfilePage (the natural place to manage your own content — the main feed swipe stack is unlikely to surface your own posts).

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

## Delete post/comment (ProfilePage only)

Delete is only available on your own profile. `isOwnProfile` is true when there is no `target` prop, or when `target.username === auth.username && target.instance === auth.instance`.

**Post cards in ProfilePage**
- When `isOwnProfile`, each post card shows a "🗑" button (bottom-right, stopPropagation so it doesn't navigate)
- Tapping sets `deleteConfirm: { kind: 'post', id: number } | null` state in ProfilePage
- The matching card's stats row morphs into `"Delete post? [Cancel] [Delete]"` inline
- On confirm: call `deletePost(auth.instance, auth.token, post.id)`, remove the post from local `posts` state. On error: revert to normal.

**Comment cards in ProfilePage**
- Same pattern: "🗑" button, same `deleteConfirm` state (kind: `'comment'`, id: `comment.id`)
- On confirm: call `deleteComment(auth.instance, auth.token, comment.id)`, remove from local `comments` state.

**No federation complexity**: own content is always on `auth.instance`, so `post.id` and `comment.id` work directly — no `resolveCommentId` needed.

## Error handling

- **Save toggle**: optimistic update, revert on error (consistent with comment voting)
- **Delete**: wait for API success before removing from list; on error revert confirmation strip to normal card, suppress silently (consistent with existing `handleSave`)

## Testing

- `savePost` unit test: verify `save: false` is passed when unsaving
- `PostCardShell`: save toggle flips state; "Saved" button has orange tint
- `SavedPage`: unsave button removes post from list
- `ProfilePage`: delete button hidden when viewing another user's profile; confirm strip renders on tap; confirm removes item from list
