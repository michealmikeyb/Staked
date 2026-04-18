# Comment Sort Setting — Design Spec

## Overview

Add a comment sort pill row and a settings toggle to show/hide it. The sort bar appears on every surface that renders comments via `PostCardShell` — the swipe card, post detail pages, shared post, and profile/saved post views. Users can change sort per-view; the setting controls the default.

---

## New Settings

Two new fields added to `AppSettings` in `src/lib/store.ts`:

| Field | Type | Default | Description |
|---|---|---|---|
| `commentSort` | `CommentSortType` | `'Top'` | Default sort applied when a card first loads |
| `showCommentSortBar` | `boolean` | `true` | Whether the pill row renders on every comment-showing surface |

`CommentSortType` is already exported from `lemmy-js-client`: `"Hot" | "Top" | "New" | "Old" | "Controversial"`.

---

## PostCardShell Changes

### Sort bar

`PostCardShell` is the single rendering point for comments across all surfaces: `PostCard`, `PostDetailCard`, `SharedPostPage`, `PostViewPage`, `SavedPostDetailPage`, and `ProfilePostDetailPage`. Adding the sort bar here covers all of them.

When `showCommentSortBar` is `true`, a pill row renders between the footer actions border and the first comment. Layout matches the existing footer style (dark background, `#ff6b35` accent for active).

- Pills: `Hot · Top · New · Old · Controversial`
- Active pill: `background: #ff6b35, color: #fff`
- Inactive pill: `background: #2a2d35, color: #888`
- Local state `activeSort` initialises from `settings.commentSort`
- Tapping a pill sets `activeSort`, which triggers comment re-fetch

`PostCardShell` reads `settings.showCommentSortBar` via `useSettings()` and receives two new props:
- `activeSort: CommentSortType` — current sort (owned by the parent)
- `onSortChange: (sort: CommentSortType) => void` — called when a pill is tapped

Both `PostCard` and `PostDetailCard` own `activeSort` state (initialised from `settings.commentSort`), pass it to `useCommentLoader`, and thread it down to `PostCardShell`.

### useCommentLoader

Add `sort: CommentSortType` parameter. Include `sort` in the `useEffect` dependency array so changing it triggers a re-fetch. Pass `sort` through all three tiers of `fetchComments` calls.

### fetchComments (lemmy.ts)

Add `sort: CommentSortType` parameter (replaces hardcoded `'Top'`). Signature becomes:

```ts
fetchComments(instance, token, postId, sort?: CommentSortType): Promise<CommentView[]>
```

Default `sort` to `'Top'` so existing callers outside the card (inbox, saved posts, post detail) are unaffected.

---

## Settings Page Changes

Two new cards added to `SettingsPage`, below the existing "Default Sort" card:

1. **Comment Sort Bar** — On/Off pill toggle controlling `showCommentSortBar`
2. **Default Comment Sort** — pill picker for `commentSort`, same style as the existing "Default Sort" card, showing all five `CommentSortType` values

---

## Data Flow

`useCommentLoader` is called in `PostCard` and `PostDetailCard` (not in `PostCardShell`). The flow for sort switching is:

1. `PostCard` / `PostDetailCard` initialise `activeSort` state from `settings.commentSort`
2. `activeSort` is passed to `useCommentLoader`, which re-fetches when it changes
3. `activeSort` + `onSortChange` are threaded as props into `PostCardShell`
4. `PostCardShell` renders the pill row and calls `onSortChange` on tap

This covers all surfaces because every page that shows comments goes through `PostCard` or `PostDetailCard`.

---

## Testing

- `useCommentLoader.test.ts` — add a case verifying the effect re-runs and calls `fetchComments` with the new sort when `sort` changes
- `SettingsPage.test` — add cases for the two new cards (render + click updates setting)
- `PostCardShell` — existing tests unaffected (sort bar hidden when `showCommentSortBar=false`, which is the mock default)
