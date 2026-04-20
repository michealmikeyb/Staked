# Blocking Feature Design

**Date:** 2026-04-19  
**Status:** Approved

## Overview

Add block functionality to profile and community pages. A hamburger menu button on each page opens a confirmation panel; confirming calls the Lemmy block API, navigates to the main feed, and shows a toast.

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
- Clicking opens an inline confirmation panel (local state, same pattern as community sort dropdown).
- Confirmation panel shows: "Block u/\<username\>?" with a red **Block** button and a **Cancel** button. Shows a loading spinner while the API call is in flight.
- On confirm: call `blockPerson(auth.instance, auth.token, personId, true)`, then `navigate('/', { state: { toast: 'Blocked u/\<username\>' } })`.
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
