# Blocking Feature Design

**Date:** 2026-04-19  
**Status:** Approved

## Overview

Add block functionality to profile and community pages. Both pages share a unified two-step UX: a `☰` hamburger button opens a grid menu of actions; tapping Block in that menu opens an inline confirmation panel; confirming calls the Lemmy block API, navigates to the main feed, and shows a toast.

## API layer (`src/lib/lemmy.ts`)

Two new exported functions:

```ts
blockPerson(instance: string, token: string, personId: number, block: boolean): Promise<void>
blockCommunity(instance: string, token: string, communityId: number, block: boolean): Promise<void>
```

Both delegate to `lemmy-js-client` (`blockPerson` / `blockCommunity`). The `block` param is `true` for all initial calls (unblock support deferred).

- `personId`: stored in state from the `fetchPersonDetails` response (`person_view.person.id`)
- `communityId`: already in `CommunityInfo.id`, fetched by `fetchCommunityInfo`

## Profile page (`src/components/ProfilePage.tsx`)

- Store `personId: number | null` in state, populated from `fetchPersonDetails` response.
- Add a `☰` icon button in the profile header, right-aligned, only rendered when `target` is set and `target.username !== auth.username`.
- Clicking opens an inline menu panel below the header — same visual style as `CommunityHeader`'s menu (dark background, `borderBottom: 2px solid #ff6b35`, grid of icon+label buttons).
- Menu contains one button for now: **Block** (🚫 icon). Additional actions can be added later.
- Tapping Block: close the menu, show an inline confirmation panel below the header.
- Confirmation panel shows: "Block u/\<username\>?" with a red **Block** button and a **Cancel** button. Shows a loading spinner while in flight.
- On confirm: call `blockPerson(auth.instance, auth.token, personId, true)`, then `navigate('/', { state: { toast: 'Blocked u/\<username\>' } })`.
- On error: show inline error in the panel, stay on page.
- On cancel: close the panel.

## Community header (`src/components/CommunityHeader.tsx`)

- Add a **Block** button to the hamburger menu grid (currently 3 items → 4 items, layout changes from `repeat(3, 1fr)` to `repeat(2, 1fr)`).
- Add `onBlock?: () => Promise<void>` callback prop. `CommunityHeader` does NOT call the API directly — it doesn't have `auth.token`.
- On Block click: close the menu, show an inline confirmation panel below the header.
- Confirmation panel shows: "Block c/\<name\>?" with a red **Block** button and a **Cancel** button. Shows a loading spinner while `onBlock` is in flight.
- On confirm: `await onBlock?.()`. On error, show inline error message in the panel. On success the parent navigates away.
- `communityInfo` may be null while loading; Block button is disabled when `!communityInfo`.

## Community block in parent (`src/components/FeedStack.tsx` — community variant)

- `FeedStack` passes `onBlock` to `CommunityHeader` as an async function.
- `onBlock` implementation: call `blockCommunity(auth.instance, auth.token, communityInfo.id, true)`, then `navigate('/', { state: { toast: 'Blocked c/\<name\>' } })`.
- On error, re-throw so `CommunityHeader` can display the inline error.

## Toast display (`src/components/FeedStack.tsx`)

- Add `useLocation` hook.
- On mount, read `location.state?.toast as string | undefined`.
- If present, set local `toastMessage` state and `toastVisible: true`.
- Render the existing `Toast` component with that message (auto-hides after 2s via existing `Toast` logic).

## Error handling

- If the block API call fails, show an inline error message in the confirmation panel ("Failed to block. Try again.") and stay on the current page.
- No navigation on failure.

## Test plan

### `src/lib/lemmy.test.ts`
- `blockPerson` calls `client.blockPerson` with correct args and resolves
- `blockCommunity` calls `client.blockCommunity` with correct args and resolves

### `src/components/ProfilePage.test.tsx`
- Hamburger button is not rendered when viewing own profile (`target.username === auth.username`)
- Hamburger button is rendered when viewing another user's profile
- Clicking hamburger opens menu panel with Block button
- Clicking Block in menu shows confirmation panel with "Block u/username?" text
- Clicking Cancel closes confirmation panel and returns to menu-closed state
- Clicking Block in confirmation panel calls `blockPerson` and navigates to `/` with toast state
- If `blockPerson` rejects, shows inline error message without navigating

### `src/components/CommunityHeader.test.tsx`
- Block button appears in hamburger menu grid
- Block button is disabled when `communityInfo` is null
- Clicking Block closes menu and shows confirmation panel with "Block c/name?" text
- Clicking Cancel closes confirmation panel
- Clicking Block in confirmation panel calls `onBlock` prop and shows loading state
- If `onBlock` rejects, shows inline error message

### `src/components/FeedStack.test.tsx`
- Toast is shown on mount when `location.state.toast` is set
- Toast is not shown when `location.state` has no toast
