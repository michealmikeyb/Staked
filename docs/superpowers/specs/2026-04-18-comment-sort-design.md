# Comment Sort Setting — Design Spec

## Overview

Add per-card comment sort control (pill row) and a settings toggle to show/hide it. Users can change sort per-card; the setting controls the default.

---

## New Settings

Two new fields added to `AppSettings` in `src/lib/store.ts`:

| Field | Type | Default | Description |
|---|---|---|---|
| `commentSort` | `CommentSortType` | `'Top'` | Default sort applied when a card first loads |
| `showCommentSortBar` | `boolean` | `true` | Whether the pill row renders on each card |

`CommentSortType` is already exported from `lemmy-js-client`: `"Hot" | "Top" | "New" | "Old" | "Controversial"`.

---

## Card Changes

### Sort bar (PostCardShell)

When `showCommentSortBar` is `true`, a pill row renders between the footer actions border and the first comment. Layout matches the existing footer style (dark background, `#ff6b35` accent for active).

- Pills: `Hot · Top · New · Old · Controversial`
- Active pill: `background: #ff6b35, color: #fff`
- Inactive pill: `background: #2a2d35, color: #888`
- Local state `activeSort` initialises from `settings.commentSort`
- Tapping a pill sets `activeSort`, which triggers comment re-fetch

`PostCardShell` receives `commentSort` and `showCommentSortBar` as props (passed down from `PostCard` via `useSettings`).

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

## Other Callers of fetchComments

`useCommentLoader` is used by `PostCard`, `PostDetailPage`, `SavedPostDetailPage`, `ProfilePostDetailPage`, and `SharedPostPage`. Only `PostCard` gets the sort bar UI — the others call `useCommentLoader` without a sort argument and fall back to the default `'Top'`.

---

## Testing

- `useCommentLoader.test.ts` — add a case verifying the effect re-runs and calls `fetchComments` with the new sort when `sort` changes
- `SettingsPage.test` — add cases for the two new cards (render + click updates setting)
- `PostCardShell` — existing tests unaffected (sort bar hidden when `showCommentSortBar=false`, which is the mock default)
