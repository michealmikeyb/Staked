# Search Page Design

**Date:** 2026-04-08

## Overview

Add a Search page accessible from the main menu drawer. The menu expands from 5 buttons (1×5) to 6 buttons (2×3). Search supports communities and posts via the Lemmy `/search` API.

## Menu Changes

- `MenuDrawer` grid changes from `gridTemplateColumns: 'repeat(5, 1fr)'` to `repeat(3, 1fr)`
- New 🔍 Search button added, navigates to `/search`
- Button order (reading left-to-right, top-to-bottom): Saved, Profile, Inbox, Settings, Post, Search

## Routes

- `/search` → `<SearchPage auth={auth} />` — the search UI
- `/view/:instance/:postId` → `<PostViewPage auth={auth} />` — authenticated post detail, same URL structure as share links

Both added to `AuthenticatedApp` in `App.tsx`.

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

Two parallel calls on submit — one with `type_: 'Communities'` and one with `type_: 'Posts'`. Each gets its own 20-result page, so neither tab is starved of results by the other type dominating the response.

Pagination: each tab tracks its own page independently. A "Load more" button appends the next page for the active tab only. Both pages reset to 1 on new search.

### Community Results

Each result shows:
- Community icon (or colored placeholder matching `CommunityAvatar` style)
- `c/name` in orange
- Subscriber count
- Description snippet (2-line clamp)

Tap → navigate to `/community/:instance/:name` (existing community feed route).

The instance is extracted from the community's `actor_id` URL (e.g. `https://lemmy.world/c/foo` → `lemmy.world`).

### Post Results

Same card style as `SavedPage`: thumbnail/image banner (120px tall) or colored placeholder, community name in orange, post title (2-line clamp), score and comment count.

Tap → navigate to `/view/:instance/:postId` where `instance` is parsed from `post.ap_id` and `postId` is the source post's numeric ID (also from `ap_id`, e.g. `https://lemmy.world/post/123` → instance `lemmy.world`, id `123`).

### States

- **Initial:** prompt text "Search communities and posts"
- **Loading:** "Loading…" centered (same style as `SavedPage`)
- **Error:** error message in red
- **Empty:** "No results for \[query\]"

## PostViewPage Component

**File:** `src/components/PostViewPage.tsx`

Authenticated post detail view reached from search results. Mirrors `SharedPostPage` layout but inside the auth gate.

- Reads `instance` and `postId` from URL params
- Calls `fetchPost(instance, parseInt(postId))` on mount
- Renders `MenuDrawer` + `PostDetailCard` with `auth` prop (enabling comments, voting, etc.)
- Loading/error states same as `SharedPostPage`
- Back navigation: `← Search` button on iOS (same pattern as `PostDetailPage` using `← Inbox`)

## API Addition — `lemmy.ts`

Two separate functions, one per type:

```ts
export async function searchCommunities(
  instance: string,
  token: string,
  query: string,
  page: number,
): Promise<CommunityView[]>

export async function searchPosts(
  instance: string,
  token: string,
  query: string,
  page: number,
): Promise<PostView[]>
```

- Each calls `client(instance, token).search({ q: query, type_: 'Communities'/'Posts', sort: 'TopAll', page, limit: 20 })`
- `SearchPage` calls both in parallel (`Promise.all`) on submit for the initial load, then calls only the relevant one on "Load more"
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
