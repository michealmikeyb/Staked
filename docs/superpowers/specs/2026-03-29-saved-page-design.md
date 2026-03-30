# Saved Page — Design Spec

**Date:** 2026-03-29
**Status:** Approved

## Overview

Add a Saved Posts page to Stakswipe, reachable from the hamburger menu drawer. The page lists posts the user has saved on their Lemmy instance, with infinite scroll. Tapping a post opens a full card view with comment browsing and reply support. As part of this work, extract the duplicated hamburger drawer and the post detail card layout into shared components.

---

## Routes

| Path | Component | Description |
|---|---|---|
| `/saved` | `SavedPage` | Infinite-scroll list of saved posts |
| `/saved/:postId` | `SavedPostDetailPage` | Full card view for a single saved post |

---

## New Files

### `src/components/MenuDrawer.tsx`

Wraps `HeaderBar` and owns the `showDrawer` open/close state. Replaces the inline drawer code duplicated in `FeedStack`, `InboxPage`, and `PostDetailPage`.

**Props:**
- `centerContent?: React.ReactNode` — passed through to HeaderBar (sort selector on FeedStack, unread toggle on InboxPage, nothing on detail pages)
- `onLogoClick?: () => void`
- `onNavigate: (route: string) => void` — called with `/saved`, `/inbox`, etc.
- All other existing HeaderBar props (`sortType`, `onSortChange`, `leftContent`)

**Behaviour:** Renders `<HeaderBar onMenuOpen={...}>` and the overlay + 3-button grid below it when open. Buttons: Saved → `onNavigate('/saved')`, Profile → close only (no-op for now), Inbox → `onNavigate('/inbox')`.

---

### `src/components/PostDetailCard.tsx`

Extracted shared card body used by both `PostDetailPage` and `SavedPostDetailPage`.

**Props:**
- `post: PostView['post']`
- `community: CommunityView['community']` (or equivalent minimal type)
- `creator: PersonView['person']`
- `counts: PostView['counts']`
- `auth: AuthState`
- `highlightCommentId?: number` — scrolls to and highlights this comment on mount (used by PostDetailPage for inbox notifications)

**Renders:** Community meta row, title, link banner, image, post body, score/reply count footer, full comment list via `useCommentLoader`, reply sheet. The parent page owns the outer `height: 100dvh` shell, `<MenuDrawer>`, and any page-specific back button.

---

### `src/components/SavedPage.tsx`

**Route:** `/saved`

**Data fetching:** Calls `fetchSavedPosts(instance, token, page)` (page starts at 1). An `IntersectionObserver` watches a sentinel `div` at the bottom of the list; when it enters the viewport, the next page is fetched and appended. A `canLoadMore` flag stops fetching when an empty page is returned.

**List item layout (Style B — top banner):**
```
┌─────────────────────────────────────┐
│  [full-width image / colour block]  │  120px tall
├─────────────────────────────────────┤
│  c/communityName                    │  10px orange
│  Post title here, up to 2 lines     │  14px bold
│  ▲ 4.2k  💬 183  2d                 │  10px muted
└─────────────────────────────────────┘
```
- If `post.url` is an image → show it as the banner
- If `post.thumbnail_url` exists → use it as the banner
- Otherwise → muted coloured placeholder block (no broken-image states)

Tapping an item navigates to `/saved/:postId` passing the full `PostView` in route state.

---

### `src/components/SavedPostDetailPage.tsx`

**Route:** `/saved/:postId`

Reads `PostView` from `useLocation().state.post`. If state is missing (e.g. direct URL access), shows a "Navigate to Saved to view this post" fallback, matching the existing PostDetailPage pattern.

Renders:
- `<MenuDrawer>` (no center content)
- `← Saved` back button on iOS (same `isIOS` guard as PostDetailPage's `← Inbox`)
- `<PostDetailCard>` with no `highlightCommentId`
- Full reply support (same flow as PostDetailPage)

Does **not** mark anything as read (no notification side-effects).

---

## Modified Files

### `src/lib/lemmy.ts`

Add:
```ts
export async function fetchSavedPosts(
  instance: string,
  token: string,
  page: number,
): Promise<PostView[]> {
  const res = await client(instance, token).getPosts({
    type_: 'Saved',
    sort: 'New',
    page,
    limit: 20,
  });
  return res.posts;
}
```

### `src/App.tsx`

Add two routes:
```tsx
<Route path="/saved" element={<SavedPage auth={auth} />} />
<Route path="/saved/:postId" element={<SavedPostDetailPage auth={auth} />} />
```

### `src/components/FeedStack.tsx`

- Remove inline `showDrawer` state and drawer JSX
- Render `<MenuDrawer centerContent={sortSelector} onNavigate={navigate} onLogoClick={...} sortType={...} onSortChange={...} />`

### `src/components/InboxPage.tsx`

- Remove inline `showDrawer` state and drawer JSX
- Render `<MenuDrawer centerContent={filterToggle} onNavigate={navigate} onLogoClick={...} />`

### `src/components/PostDetailPage.tsx`

- Remove inline `showDrawer` state and drawer JSX
- Extract card body into `<PostDetailCard>`
- Render `<MenuDrawer onNavigate={navigate} onLogoClick={...} leftContent={backButton} />`

---

## Data Flow

```
SavedPage
  → fetchSavedPosts (lemmy.ts)  ← page 1, 2, 3... via IntersectionObserver
  → navigate('/saved/:postId', { state: { post: PostView } })

SavedPostDetailPage
  → reads PostView from route state
  → <PostDetailCard>
      → useCommentLoader (three-tier fallback, same as PostDetailPage)
      → createComment on reply submit
```

---

## Error Handling

- `fetchSavedPosts` failure on page 1: show inline error message
- `fetchSavedPosts` failure on page N > 1: silently stop loading more (set `canLoadMore = false`)
- Missing route state: show fallback message matching PostDetailPage pattern

---

## What's Not In Scope

- Unsaving a post from SavedPage
- Profile page (drawer button remains a no-op)
- Saved comments (Lemmy API supports it; excluded for now)
