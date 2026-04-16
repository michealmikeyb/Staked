# Gesture Voting Settings Design

**Date:** 2026-04-15  
**Status:** Approved

## Summary

Add side-aware double-tap voting on comments (right = upvote, left = downvote) and a unified "swap gestures" setting that flips both post swipe directions and comment tap sides simultaneously. Refactor the existing `leftSwipe` store key to `nonUpvoteSwipeAction` for clarity.

---

## Data / Store (`src/lib/store.ts`)

### `AppSettings` changes

- Rename `leftSwipe: 'downvote' | 'dismiss'` → `nonUpvoteSwipeAction: 'downvote' | 'dismiss'`
- Add `swapGestures: boolean` (default `false`)

### `DEFAULT_SETTINGS`

```ts
nonUpvoteSwipeAction: 'downvote',
swapGestures: false,
```

### Migration in `loadSettings`

If the parsed localStorage object has a `leftSwipe` key and no `nonUpvoteSwipeAction`, copy the value across and discard `leftSwipe`. This is silent and one-way — no user action required.

---

## FeedStack swipe logic (`src/components/FeedStack.tsx`)

Both the drag callback and keyboard arrow handler are updated:

| Gesture | `swapGestures: false` | `swapGestures: true` |
|---|---|---|
| Right swipe / ArrowRight | upvote | `nonUpvoteSwipeAction` |
| Left swipe / ArrowLeft | `nonUpvoteSwipeAction` | upvote |

`nonUpvoteSwipeAction: 'downvote'` calls `downvotePost`; `'dismiss'` skips voting and just pops the card. All references to `settings.leftSwipe` are replaced with `settings.nonUpvoteSwipeAction`.

---

## CommentItem double-tap voting (`src/components/CommentItem.tsx`)

### Side detection

On double-tap, compare `e.clientX` to the midpoint of the element's `getBoundingClientRect()`:

```
const mid = el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
const tappedRight = e.clientX >= mid;
const upvoteSide = settings.swapGestures ? 'left' : 'right';
const isUpvote = (tappedRight && upvoteSide === 'right') || (!tappedRight && upvoteSide === 'left');
```

### Vote state

Replace `liked: boolean` with `vote: 1 | 0 | -1`.

- Double-tap same side as current vote → remove vote (`0`)
- Double-tap opposite side → switch vote directly (no intermediate `0`)
- `likeComment` is called with score `1`, `0`, or `-1`

### Score indicator

- `vote === 1`: `▲ {score}` (orange, existing style)
- `vote === -1`: `▼ {score}` (new style, e.g. blue or red)
- `vote === 0`: `▲ {score}` (neutral grey, existing default)

---

## Settings UI (`src/components/SettingsPage.tsx`)

### New "Swap Gestures" card

```
[Swap Gestures]
Right swipe upvotes · Right tap upvotes   ← when off
Left swipe upvotes · Left tap upvotes     ← when on
[On] [Off]
```

### Updated non-upvote swipe card

Label changes dynamically:
- `swapGestures: false` → "Left Swipe Action"
- `swapGestures: true` → "Right Swipe Action"

Pills remain: **Downvote** | **Dismiss**, now bound to `nonUpvoteSwipeAction`.

---

## Testing

- `store.test.ts`: add migration test (old `leftSwipe` value survives rename), add `swapGestures` default test
- `FeedStack.test.tsx`: update existing `leftSwipe` tests to use `nonUpvoteSwipeAction`; add swap-gestures tests for right/left swipe with `swapGestures: true`
- `CommentItem.test.tsx`: add tests for left-half double-tap (downvote), right-half double-tap (upvote), same-side toggle to 0, opposite-side switch, and `swapGestures: true` inversion
- `SettingsPage.test.tsx`: update existing test; add test for swap gestures toggle and dynamic label
