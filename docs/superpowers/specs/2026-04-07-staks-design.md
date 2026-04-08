# Staks — Feed Filter Selection

**Date:** 2026-04-07

## Overview

Add a "Staks" feature: named feed presets that filter posts by listing type. The initial three staks map directly to Lemmy's `ListingType`: All, Local, and Subscribed. The user selects a stak via a dropdown triggered by tapping the logo/title in the main feed header. The selection persists across sessions.

## Staks

| Stak | Lemmy `type_` | Description |
|------|--------------|-------------|
| All | `All` | All federated posts (current default behavior) |
| Local | `Local` | Posts from communities local to the user's instance |
| Subscribed | `Subscribed` | Posts from communities the user is subscribed to |

## Architecture

### 1. `store.ts` — Settings extension

Add `StakType` and extend `AppSettings`:

```ts
export type StakType = 'All' | 'Local' | 'Subscribed';

// AppSettings gains:
activeStak: StakType;  // default: 'All'
```

Persists automatically via the existing `loadSettings` / `saveSettings` / `DEFAULT_SETTINGS` machinery.

### 2. `lemmy.ts` — `fetchPosts` parameter

Change the hardcoded `type_: 'All'` to accept the stak value:

```ts
export async function fetchPosts(
  instance: string,
  token: string,
  page: number,
  sort: SortType = 'TopTwelveHour',
  stak: StakType = 'All',
): Promise<PostView[]>
```

Default `'All'` preserves backwards compatibility with existing call sites and tests.

### 3. `HeaderBar` — Stak picker dropdown

- Tapping the logo/title area opens a stak picker dropdown, centered below the title
- Dropdown lists: 🌐 All, 🏠 Local, ⭐ Subscribed
- Active stak shows a checkmark; the title displays the active stak name next to the logo
- A dark overlay behind the dropdown dismisses it on tap (same pattern as `MenuDrawer`)
- The dropdown is only rendered in the main feed (not in community feeds — `CommunityHeader` is unaffected)
- `HeaderBar` receives `activeStak`, `onStakChange` props; only shown when `onStakChange` is provided

### 4. `FeedStack` — Stak consumption

- Reads `activeStak` from `useSettings()`
- Passes `activeStak` as `stak` to `fetchPosts`
- Switching staks triggers the same reset as `handleSortChange`: clear `posts`, reset `page` to 1, reset `canLoadMore` to true, call `loadMore(1, sortType)` with the new stak

### 5. Subscribed empty state

When `posts.length === 0 && !loading && !canLoadMore && activeStak === 'Subscribed'`, show:

> ⭐ **No subscriptions yet**
> You haven't subscribed to any communities yet. Browse communities and subscribe to see their posts here.

The generic "You've seen everything!" message is shown for All and Local as before.

## Data Flow

```
User taps title → stak dropdown opens
User selects stak → HeaderBar calls onStakChange(stak)
  → FeedStack calls updateSettings({ activeStak: stak })
  → FeedStack resets and reloads: fetchPosts(instance, token, 1, sortType, stak)
  → Posts render normally
```

## What's Not Changing

- Community feed routes (`/community/:instance/:name`) use `fetchCommunityPosts` — no `type_` concept, unaffected
- Sort type is independent of stak; both can be changed freely
- Seen-post tracking works the same across all staks

## Testing

- **`store.ts`**: `activeStak` defaults to `'All'`; persists and reloads correctly
- **`FeedStack`**: verify `fetchPosts` is called with correct `stak` value on initial load and on stak change
- **`HeaderBar`**: stak dropdown opens on logo/title click; selecting an option fires `onStakChange` with the correct value; dropdown hidden when `onStakChange` not provided
