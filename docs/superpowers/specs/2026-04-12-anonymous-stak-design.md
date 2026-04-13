# Anonymous Stak — Design Spec

**Date:** 2026-04-12

## Overview

Add an Anonymous browsing mode to Stakswipe. Anonymous users see a real Lemmy feed (fetched from the top-ranked public instance for the current sort) but swipes only dismiss cards — no voting. Anonymous mode is the default experience when not logged in, and is also available to logged-in users as a stak option.

---

## Section 1: Data & Settings

### `src/lib/instanceRankings.ts`
New file. Static mapping of `SortType → instance` derived from `scripts/instance-rankings.json` at build time (not fetched at runtime). Exports:

```ts
getAnonInstance(sort: SortType): string
```

Returns the top-ranked instance for a given sort (e.g. `'Active' → 'reddthat.com'`).

### `SettingsContext`
Add `anonInstance: string` (default: `''`). Empty string = auto (top-ranked per sort from rankings). Non-empty = use that instance regardless of sort. Persists to localStorage alongside existing settings.

### `StakType`
Extended to `'All' | 'Local' | 'Subscribed' | 'Anonymous'`. `'Anonymous'` is a UI-only concept — FeedStack maps it to `'All'` when calling the Lemmy API.

### `src/components/InstanceInput.tsx`
New shared component: a simple text input for entering a Lemmy instance hostname. Used in:
- `SettingsPage` — anonymous instance override
- `LoginPage` — replacing the existing custom instance `<input>`
- `CreatePostPage` — instance selection

Designed so a better searchable dropdown can be dropped in later without touching each consumer.

---

## Section 2: Routing & App Shell

### `App.tsx`
Remove the `AuthGate` pattern. The app always renders. `SettingsProvider` wraps all routes so settings (including `anonInstance`) work for unauthenticated users.

**Route changes:**
- `/` → `FeedStack` with `auth` (nullable)
- `/login` → `LoginPage` (new dedicated route; no longer the default gate)
- `/settings` → `SettingsPage` (moved outside `AuthenticatedApp`; accessible without auth)
- `/search` → `SearchPage` (moved outside `AuthenticatedApp`)
- Auth-gated routes (`/inbox`, `/saved`, `/profile`, `/create-post`, community and user routes) redirect to `/` when `auth === null`

### `LoginPage`
Gains a "Continue without account" link that navigates back to `/`. No other structural changes.

---

## Section 3: FeedStack & Anonymous Mode

### `FeedStack` props
`auth: AuthState | null` (previously required).

### Anonymous instance resolution
Applied when `auth === null` OR `stak === 'Anonymous'`:
- If `settings.anonInstance` is non-empty → use that instance
- Otherwise → `getAnonInstance(sortType)` (switches dynamically when sort changes)

### API calls
Token passed as `''` when anonymous. Stak mapped to `'All'` for the `getPosts` API call.

### Swipe & keyboard handlers
Skip `upvotePost`/`downvotePost` when in anonymous mode. Just call `dismissTop`.

### Other anonymous behaviour
- Unread count fetch: skipped when `auth === null`
- Seen history: tracked as normal
- Empty state: "Log out" button becomes "Log in" (navigates to `/login`) when `auth === null`

---

## Section 4: HeaderBar & MenuDrawer

### Stak selector
Only rendered when `auth !== null`. Anonymous users never see it.

### `STAKS` array
Gains `{ stak: 'Anonymous', label: 'Anonymous', icon: '🕵️' }`.

### `MenuDrawer` — unauthenticated
Shows: Login, Settings, Search.
Hides: Saved, Profile, Inbox, Post.

### `MenuDrawer` — authenticated + Anonymous stak
Full authenticated menu unchanged (Saved, Profile, Inbox, Post all visible). Only the feed behaviour changes.

---

## Section 5: Settings Page

`SettingsPage` gains an **"Anonymous Feed"** section containing an `InstanceInput` bound to `settings.anonInstance`. Placeholder text: `"Auto (top-ranked per sort)"`. Saves on change using existing settings pattern. Accessible to both logged-in and anonymous users.

---

## Out of scope

- Community feeds and user profile pages in anonymous mode (auth-gated, redirect to `/`)
- Persisting seen history across devices
- A better instance picker dropdown (InstanceInput is designed to accept this upgrade later)
