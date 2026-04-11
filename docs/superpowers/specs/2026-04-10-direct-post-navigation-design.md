# Direct Post Navigation via URL Detection

**Date:** 2026-04-10
**Status:** Approved

## Overview

When a user pastes a Lemmy post URL or Stakswipe share URL into the search input, detect it in real-time and show a "Go to post" chip below the input. Clicking the chip navigates directly to the post viewer. No search API call is made.

## URL Patterns

Handled by a new `parsePostUrl` function in `urlUtils.ts`:

- `https://lemmy.world/post/2395953` — standard Lemmy post URL with protocol
- `lemmy.world/post/2395953` — without protocol (prepend `https://` and parse)
- `https://stakswipe.com/#/post/lemmy.world/2395953` — Stakswipe share URL

Returns `{ instance: string; postId: number }` or `null` if no match.

## Components

### `urlUtils.ts`

Add `parsePostUrl(query: string): { instance: string; postId: number } | null`.

Logic:
1. Check if the query contains `/#/post/` — if so, parse as a Stakswipe share URL: extract the path after `/#/post/`, split on `/` to get `[instance, postId]`.
2. Otherwise, attempt to parse as a Lemmy URL: prepend `https://` if no protocol present, parse with `new URL()`, check that the pathname matches `/post/<number>`, return `{ instance: hostname, postId }`.
3. Return `null` on any parse failure or non-matching shape.

### `SearchPage.tsx`

- Add `directPost: { instance: string; postId: number } | null` state, initialized to `null`.
- In the input `onChange` handler, call `parsePostUrl(value)` and set `directPost` accordingly.
- When `directPost` is non-null, render a chip below the search form:
  ```
  [ 🔗 Go to post → ]
  ```
  Styled with the existing dark card look (`#1e2128` background, `#ff6b35` accent, `12px` border radius, cursor pointer).
- Clicking the chip calls `navigate(`/view/${directPost.instance}/${directPost.postId}`)`.
- Disable the Search button when `directPost` is non-null (the chip is the action for URL inputs).
- Clear `directPost` when the input is cleared or changes to a non-URL value.

## Data Flow

```
user types URL → onChange → parsePostUrl → directPost state set → chip renders
user clicks chip → navigate('/view/:instance/:postId') → PostViewPage fetches post
```

No new network calls in SearchPage. `PostViewPage` already handles fetching and error states.

## Error Handling

- Malformed URLs: `parsePostUrl` returns `null` — chip never appears, no error shown.
- Post not found after navigation: handled by existing `PostViewPage` error state.

## Testing

- Unit tests for `parsePostUrl` in `urlUtils.test.ts`: all three URL patterns, malformed inputs, non-post URLs.
- `SearchPage.test.tsx`: chip appears when a valid URL is typed, chip absent for plain text, chip click navigates correctly, Search button disabled when chip is visible.
