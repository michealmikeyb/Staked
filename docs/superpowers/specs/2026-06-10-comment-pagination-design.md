# Comment Pagination Design

**Date:** 2026-06-10  
**Branch:** decouple

## Problem

`fetchRaw` in `src/lib/api/backends/lemmy/comments.ts` fetches a single page of 50 comments (Lemmy's max). On posts with many comments sorted by `Top`, lower-scored comments — including a user's own reply — never load. The fix is scroll-based pagination: load the first page immediately, then fetch more as the user scrolls down.

## Goals

- Load enough comments to reliably surface any comment in the thread
- Never miss a `targetCommentApId` (inbox navigation) even if it sits deep in the list
- Keep the API footprint low — only fetch what the user actually scrolls to

## Non-Goals

- Paginating Tier 2 or Tier 3 comment fetches (fallback paths that only run when Tier 1 returns 0 results)
- Re-running cross-stitch or supplemental fetches on pages beyond page 1

---

## Design

### 1. `CommentService` interface (`src/lib/api/backend.ts`)

Add `cursor` to opts. Change return type to `Page<Comment>`:

```ts
list(postId: ID, opts: {
  sortId: string;
  sourceHandle?: string;
  targetCommentApId?: string;
  cursor?: string | null;
}): Promise<Page<Comment>>;
```

Cursor is a stringified page number, consistent with `FeedService`, `UserService`, and `SearchService`. `nextCursor` is `null` when the returned page has fewer than 50 items (thread exhausted).

### 2. `fetchRaw` (`src/lib/api/backends/lemmy/comments.ts`)

Add optional `page` param (default `1`):

```ts
async function fetchRaw(
  instance: string,
  token: string,
  postId: number,
  sort: CommentSortType,
  page = 1,
): Promise<CommentView[]>
```

Pass `page` through to `getComments`. No other change.

### 3. `list()` pagination logic

- Parse cursor: `const page = cursor ? parseInt(cursor, 10) : 1`
- Tier 1 fetches `page` from the source instance
- `nextCursor = results.length === 50 ? String(page + 1) : null`

**`targetCommentApId` auto-load (page 1 only):** When `cursor` is null/`'1'` and `targetCommentApId` is set and the target is not found in the initial fetch, loop pages 2 and 3, appending and deduplicating by `ap_id`, stopping as soon as the target appears. The returned `nextCursor` points to the page after where the loop stopped, so the user can continue scrolling normally.

**Cross-stitch and supplemental fetch** only run when `!cursor || cursor === '1'`. Subsequent pages are raw Tier 1 source comments appended to the UI's accumulated list.

### 4. UI (`src/components/PostDetailCard.tsx`)

Replace the single `useAsync` call with explicit state:

```ts
const [allComments, setAllComments] = useState<Comment[]>([]);
const [nextCursor, setNextCursor] = useState<string | null>(null);
const [loadingMore, setLoadingMore] = useState(false);
```

**Initial load:** `useEffect` on `[neutralPost.id, activeSort]` — fetch page 1 with `targetCommentApId`, replace `allComments`, store `nextCursor`.

**Scroll trigger:** `IntersectionObserver` on a sentinel `<div>` at the bottom of the comments list. When sentinel becomes visible, `nextCursor` is non-null, and `loadingMore` is false: fetch next page, append to `allComments`, update `nextCursor`. A spinner replaces the sentinel while loading.

**Highlight logic:** `highlightCommentId` derives from `allComments` — unchanged. It fires once the target comment appears (guaranteed by the auto-load loop on page 1).

---

## File Changeset

| File | Change |
|------|--------|
| `src/lib/api/backend.ts` | `list()` opts gains `cursor?`, return type `Comment[]` → `Page<Comment>` |
| `src/lib/api/backends/lemmy/comments.ts` | `fetchRaw` gains `page` param; `list()` gains cursor parsing, page loop for target, nextCursor |
| `src/components/PostDetailCard.tsx` | Replace `useAsync` with state + `useEffect` + `IntersectionObserver` sentinel |

---

## Edge Cases

- **Sort change:** `useEffect` dep on `activeSort` resets `allComments` and `nextCursor` to initial state.
- **Page overlap:** Lemmy pages can overlap; deduplication by `ap_id` prevents duplicates when merging pages.
- **Target not found after 3 pages:** The existing supplemental `resolveObject` fetch still runs as a final fallback.
- **Exhausted thread:** `nextCursor === null` hides the sentinel, preventing further requests.
