# Search Page Design

**Date:** 2026-04-08

## Overview

Add a Search page accessible from the main menu drawer. The menu expands from 5 buttons (1×5) to 6 buttons (2×3). Search supports communities and posts via the Lemmy `/search` API.

## Menu Changes

- `MenuDrawer` grid changes from `gridTemplateColumns: 'repeat(5, 1fr)'` to `repeat(3, 1fr)`
- New 🔍 Search button added, navigates to `/search`
- Button order (reading left-to-right, top-to-bottom): Saved, Profile, Inbox, Settings, Post, Search

## Route

`/search` → `<SearchPage auth={auth} />`

Added to `AuthenticatedApp` in `App.tsx`.

## SearchPage Component

**File:** `src/components/SearchPage.tsx`

**Layout:** Same shell as `SavedPage` — full-height column, `MenuDrawer` at top, scrollable content below.

### Search Input

- Single text input with a Submit button (or Enter key triggers search)
- Does not search on every keystroke — only on explicit submit
- Input is cleared/reset when the user navigates away and returns

### Tabs

Two tabs: **Communities** and **Posts**. Default: Communities.

- Tabs switch the visible result list without re-fetching
- Active tab indicated by orange underline (`#ff6b35`) consistent with app accent color

### Data Fetching

Single call to a new `searchLemmy()` function with `type_: 'All'`. Results are split client-side into `communities` and `posts` arrays. This avoids two round trips.

Pagination: load page 1 on submit. A "Load more" button (not infinite scroll) appends additional pages to the active type's results. Page resets to 1 on new search.

### Community Results

Each result shows:
- Community icon (or colored placeholder matching `CommunityAvatar` style)
- `c/name` in orange
- Subscriber count
- Description snippet (2-line clamp)

Tap → navigate to `/community/:instance/:name` (existing community feed route).

The instance is extracted from the community's `actor_id` URL (e.g. `https://lemmy.world/c/foo` → `lemmy.world`).

### Post Results

Each result shows:
- Community name in orange
- Post title (2-line clamp)
- Score and comment count

Tap → navigate to `/saved/:postId` with `{ state: { post: pv } }` (reuses `SavedPostDetailPage`, same pattern as `SavedPage`).

### States

- **Initial:** prompt text "Search communities and posts"
- **Loading:** "Loading…" centered (same style as `SavedPage`)
- **Error:** error message in red
- **Empty:** "No results for \[query\]"

## API Addition — `lemmy.ts`

```ts
export async function searchLemmy(
  instance: string,
  token: string,
  query: string,
  page: number,
): Promise<{ communities: CommunityView[]; posts: PostView[] }>
```

- Calls `client(instance, token).search({ q: query, type_: 'All', sort: 'TopAll', page, limit: 20 })`
- Returns `{ communities: res.communities, posts: res.posts }`
- Export `CommunityView` from `lemmy.ts` so `SearchPage` can type its state

## Types to Export

Add to `lemmy.ts` exports:
```ts
export type { PostView, CommentView, SortType, CommentReplyView, PersonMentionView, CommunityView };
```

## Testing

`SearchPage.test.tsx` following existing test patterns:
- Mock `searchLemmy` in `../lib/lemmy`
- Render `<MemoryRouter><SearchPage auth={mockAuth} /></MemoryRouter>`
- Test: initial state shows prompt
- Test: submitting a query calls `searchLemmy` and renders community results
- Test: switching to Posts tab shows post results
- Test: empty results shows empty state
- Test: error state shows error message
