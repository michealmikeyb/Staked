# Seen Posts Persistence

**Date:** 2026-03-28

## Goal

Prevent posts the user has already swiped from reappearing after a page reload. The seen history is independent of auth state (survives logout/login), capped at 200 entries to bound memory use, and resettable by the user.

## Data Layer (`src/lib/store.ts`)

Add a `stakswipe_seen` key to localStorage alongside the existing auth keys. The value is a JSON array of numeric post IDs (the local federated `post.id` used by Lemmy).

Three new functions:

- **`loadSeen(): Set<number>`** — reads `stakswipe_seen`, parses the JSON array, returns a `Set<number>` for O(1) lookup. Returns an empty Set if the key is absent or unparseable.
- **`addSeen(id: number): void`** — loads the current array, appends the new ID, deduplicates, trims to 200 entries by dropping from the front (oldest first), writes back.
- **`clearSeen(): void`** — removes `stakswipe_seen` from localStorage.

Storage cost: 200 integers as JSON ≈ ~1 KB maximum.

## Feed Logic (`src/components/FeedStack.tsx`)

- On mount, call `loadSeen()` and store the result in a `useRef` (not state — no re-render needed).
- In `loadMore`, after fetching a page, filter out posts whose `post.id` is in the seen ref.
- In `dismissTop` (called on every swipe), call `addSeen(post.post.id)` and add the ID to the seen ref to prevent re-display within the same session.
- The existing pagination and buffer logic is unchanged. Filtered results naturally cause more pages to be fetched until enough unseen posts are found.

## Empty Feed UI (`src/components/FeedStack.tsx`)

When `posts.length === 0 && !loading && !canLoadMore`, render a centered empty-state screen with:

- A message indicating no more posts are available.
- **"Reset seen history"** button — calls `clearSeen()` then `window.location.reload()` to restart from the full feed.
- **"Log out"** button — existing logout behavior.

This is the only place the reset button appears, keeping it accessible without cluttering normal use.

## What is not changing

- Pagination logic (`page` state, `canLoadMore` flag) — unchanged.
- Auth persistence — unchanged.
- Post fetching API calls — unchanged; filtering is client-side after fetch.
- The seen list is not scoped per-instance. Post IDs are instance-local numeric values, but since the app only ever connects to one instance at a time and the list is short-lived (200 cap), collisions across instance switches are negligible.
