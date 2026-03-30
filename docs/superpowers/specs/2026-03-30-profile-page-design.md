# Profile Page Design

**Date:** 2026-03-30

## Overview

A profile page showing the current user's posts and comments. Follows the same pattern as the existing Saved page. Accessed via the Profile button in the MenuDrawer.

## Routes

| Route | Component |
|---|---|
| `/profile` | `ProfilePage` |
| `/profile/:postId` | `ProfilePostDetailPage` |

## ProfilePage

### Layout

- `MenuDrawer` header (same as all pages)
- Username (`u/<username>`) and instance name below the header
- Three-tab bar: **All** (default), **Posts**, **Comments**
- Scrollable list below the tabs with infinite scroll via `IntersectionObserver` sentinel

### Data fetching

Call `getPersonDetails` on the user's home instance (from `auth`). Returns `posts: PostView[]` and `comments: CommentView[]`. A single fetch populates all three tabs — the tab switch filters client-side.

Add `fetchPersonDetails(instance, token, username, page)` to `lemmy.ts`, returning `{ posts: PostView[], comments: CommentView[] }`.

### Pagination

Same pattern as `SavedPage`: `pageRef`, `loadingRef`, `canLoadMore` flag, sentinel `div` at the bottom triggers next page load.

### List items

**Post row** — identical to `SavedPage`:
- Banner image or coloured placeholder (120 px tall)
- `POST` badge (orange), community name, post title, score + comment count
- `onClick` → `navigate('/profile/:postId', { state: { post: postView } })`

**Comment row** — no image:
- `COMMENT` badge (blue `#4a9eff`), community name
- Italic truncated parent post title (context line, max 2 lines) with left border
- Comment body snippet (max 3 lines)
- Score
- `onClick` → `navigate('/profile/:postId', { state: { post: commentView, commentApId: comment.ap_id } })`

The `:postId` in the comment navigation is the **post's local ID** from `commentView.post.id`. State carries both the `PostView` (reconstructed from comment view fields) and the `commentApId`.

### Tab filtering

- **All**: interleaved chronologically. Merge posts and comments, sort by `published` descending.
- **Posts**: only post rows.
- **Comments**: only comment rows.

Filtering is done on the accumulated client-side data — no re-fetch on tab switch.

## ProfilePostDetailPage

Mirrors `SavedPostDetailPage` exactly, with:
- Back button reads `← Profile` (navigates to `/profile`)
- Passes `notifCommentApId` from route state to `PostDetailCard` when opened from a comment row
- `PostDetailCard` already handles scroll-to-comment via `notifCommentApId`

## MenuDrawer change

Wire the Profile button to `handleNavigate('/profile')` instead of just closing the drawer.

## lemmy.ts addition

```ts
export async function fetchPersonDetails(
  instance: string,
  token: string,
  username: string,
  page: number,
): Promise<{ posts: PostView[]; comments: CommentView[] }>
```

Calls `getPersonDetails` with `username`, `sort: 'New'`, `page`, `limit: 20`.

## What is NOT in scope

- Editing profile information
- Showing karma totals or join date
- Viewing other users' profiles
