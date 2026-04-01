# Design: Undo Stack, Save Button, Header Stats

**Date:** 2026-04-01

## Overview

Three related changes to the Stakswipe card UI:

1. Pull-down gesture changes from "save" to "undo" — with a full session undo stack so users can rapidly scroll back through cards they've already seen.
2. A dedicated Save button is added to the card footer.
3. Score and comment count move from the footer to the meta header, freeing the footer for three evenly-spaced action buttons.

---

## 1. Undo Stack (FeedStack)

### State

Add `undoStack: PostView[]` to `FeedStack` state (session-scoped, in-memory, not persisted).

### Dismiss

`dismissTop(postId)` is unchanged except it now also pushes the dismissed post onto `undoStack` before slicing it from `posts`:

```
setUndoStack(prev => [...prev, posts[0]]);
setPosts(prev => prev.slice(1));
```

`seenRef` and `addSeen` still run on dismiss. Undone posts remain in `seenRef` — the fetcher won't re-serve them, but they can be re-surfaced within the session via undo.

### Undo

`handleUndo()` pops the top of `undoStack` and prepends it to `posts`. If the stack is empty, it is a no-op.

```
setUndoStack(prev => prev.slice(0, -1));
setPosts(prev => [undoStack[undoStack.length - 1], ...prev]);
```

Rapid repeated pull-downs pop one card per gesture, allowing the user to scroll backwards through the session history.

### Keyboard shortcut

`ArrowDown` maps to `handleUndo()` instead of `savePost()`.

### PostCard prop

`onSave` (the pull-down callback) is renamed to `onUndo`. It receives `handleUndo` for the top card, no-op for background cards.

---

## 2. Card Entrance Animation (FeedStack + PostCard)

### Trigger

`FeedStack` tracks `returningPostId: number | null`. `handleUndo()` sets this to the ID of the post being prepended. PostCard receives an `isReturning: boolean` prop (`true` when `post.post.id === returningPostId`).

### Animation

When `isReturning` is true, the card's framer-motion `initial` is `{ y: '-110vh' }` and `animate` is `{ y: 0 }` with a spring transition (`stiffness: 280, damping: 26`). On animation complete, `FeedStack` clears `returningPostId`.

When `isReturning` is false (normal render), no `initial`/`animate` override — card renders in place as today.

---

## 3. Pull-Down Undo Overlay (PostCard)

The existing `saveOverlay` is repurposed as the undo overlay:

- Color: `rgba(14, 165, 233, 0.45)` (sky blue — distinct from orange upvote and grey downvote overlays)
- Content: centered `↩` icon that fades in as `pullDelta` grows
- Threshold and opacity logic unchanged (`pullDelta / 80`)

The CSS class `.saveOverlay` is renamed to `.undoOverlay`.

---

## 4. Save Button (PostCard footer)

A **🔖 Save** button is added to the footer. It calls `onSave()` (a new prop: just the `savePost` API call, no dismiss). After a successful save, a Toast confirms "Saved".

`onSave` is passed from `FeedStack` for the top card only: `() => savePost(auth.instance, auth.token, post.post.id).catch(() => {})`.

No card is dismissed on save. The user can continue swiping after saving.

---

## 5. Stats → Meta Header (PostCard)

`counts.score` (▲) and `counts.comments` (💬) move from the footer to the top-right of the `.meta` div, stacked vertically in a small column.

The footer is restructured to three evenly-spaced action buttons:

```
🔖 Save    Share ↗    💬 Comment
```

Each button takes `flex: 1` with `text-align: center`. The existing `.shareButton` style is reused for all three.

---

## Affected Files

- `src/components/FeedStack.tsx` — undo stack state, handleUndo, returningPostId, onSave prop, keyboard shortcut
- `src/components/PostCard.tsx` — isReturning animation, onUndo pull-down, onSave button, stats in header, footer restructure
- `src/components/PostCard.module.css` — rename saveOverlay → undoOverlay, footer layout, meta stats column
- `src/components/PostCard.test.tsx` — update tests for new props/layout
- `src/components/FeedStack.test.tsx` — update tests for undo stack behavior

---

## Out of Scope

- Persisting the undo stack across sessions
- Reversing vote/save API calls on undo
- Bounding the undo stack size
