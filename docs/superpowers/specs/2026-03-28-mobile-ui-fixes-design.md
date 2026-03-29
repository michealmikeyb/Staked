# Mobile UI Fixes — Design Spec

**Date:** 2026-03-28

## Overview

Three mobile UI issues in Stakswipe: card overflow at the bottom of the screen, no gesture or key to save/bookmark posts, and the reply composer being hidden by the soft keyboard.

---

## Issue 1: Card bottom overflow

### Problem
The card uses `height: calc(100vh - 24px)` and the FeedStack container uses `height: 100vh`. On mobile, `100vh` equals the layout viewport, which includes browser chrome (address bar). This causes the card to overflow below the visible screen edge, clipping the rounded bottom corners.

### Fix
Switch both the container and card height to use `100dvh` (dynamic viewport height), which tracks the actual visible area as the browser UI appears and disappears.

- `FeedStack` container inline style: `height: '100vh'` → `height: '100dvh'`
- `PostCard.module.css`: `height: calc(100vh - 24px)` → `height: calc(100dvh - 48px)`

The `48px` gives ~24px clearance at the top and ~24px at the bottom, matching the visual weight of the 4% side margins.

---

## Issue 2: Pull-down gesture and keyboard shortcut to save

### Problem
There is no way to save/bookmark a post in the app. Lemmy supports a native save feature visible in the user's saved posts list.

### Fix

**API layer (`lemmy.ts`):**
- Add `savePost(instance: string, token: string, postId: number, save: boolean): Promise<void>`

**FeedStack:**
- Add `onSave` prop to `PostCard` (type: `() => void`, only wired for the top card)
- In the top card's handler: call `savePost(auth.instance, auth.token, post.post.id, true)` then `dismissTop(post.post.id)`
- Add `ArrowDown` to the existing `keydown` handler, triggering the same save+dismiss logic

**PostCard — pull-down gesture:**
- Add a `scrollRef` (via `useRef`) on the `.scrollContent` div
- Add `onTouchStart`, `onTouchMove`, `onTouchEnd` handlers on the scroll container div:
  - `onTouchStart`: record `touchStartY`
  - `onTouchMove`: if `scrollRef.current.scrollTop === 0` and `currentY - touchStartY >= 80`, set `pulling = true`
  - `onTouchEnd`: if `pulling`, call `onSave`; always reset `pulling`
- Add a save overlay inside the card (sibling to the vote overlay): bookmark icon + "Save" label, fades in proportionally as the user pulls (opacity based on pull distance / 80), green tint (`rgba(34, 197, 94, opacity)`)
- Overlay is only shown when `pulling` state is true (or pull-in-progress)

---

## Issue 3: Reply sheet hidden by soft keyboard

### Problem
`ReplySheet` renders inside `.scrollContent` with `position: sticky; bottom: 0`. When the soft keyboard opens, it covers the bottom of the scroll container. The sticky element does not escape the scroll container to track the visual viewport, so the textarea and action buttons are hidden behind the keyboard.

### Fix

**State lifting:**
- Move `replyTarget` state from `CommentList` to `PostCard`
- `CommentList` receives `replyTarget: CommentView | null` and `onSetReplyTarget: (cv: CommentView | null) => void` as props instead of owning the state
- `handleSubmit` and `localReplies` remain in `CommentList`; `onSubmit` and `onClose` are passed to `ReplySheet` by `PostCard`

**Rendering:**
- Remove `<ReplySheet>` from `CommentList`
- Render `<ReplySheet>` in `PostCard` as a direct child of the card root `motion.div`, as a sibling to `.scrollContent` (not inside it)

**Positioning:**
- `ReplySheet.module.css`: change `position: sticky; bottom: 0` → `position: absolute; bottom: 0; left: 0; right: 0`
- The card root already has `position: absolute` and `border-radius: 20px` with `overflow: hidden`, so the sheet will clip to the card's rounded corners

**Keyboard offset:**
- In `PostCard`, add a `keyboardOffset` state (number, default 0)
- When `replyTarget` is set (non-null), attach a `resize` listener to `window.visualViewport`:
  - `keyboardOffset = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop`
  - Apply as inline style `bottom: keyboardOffset` on the `ReplySheet` wrapper
- When `replyTarget` is cleared, reset `keyboardOffset` to 0 and remove the listener

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/lemmy.ts` | Add `savePost` |
| `src/components/FeedStack.tsx` | Wire `onSave`, add `ArrowDown` key handler |
| `src/components/PostCard.tsx` | Add `onSave` prop, pull-down gesture, scrollRef, keyboard offset, render ReplySheet |
| `src/components/PostCard.module.css` | Fix height to `100dvh`, add save overlay styles |
| `src/components/CommentList.tsx` | Accept `replyTarget`/`onSetReplyTarget` props, remove ReplySheet render |
| `src/components/ReplySheet.module.css` | Change to `position: absolute` |
