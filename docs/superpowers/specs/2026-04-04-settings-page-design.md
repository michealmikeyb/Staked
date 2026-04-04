# Settings Page Design

**Date:** 2026-04-04
**Status:** Approved

## Overview

Add a settings page accessible from the menu drawer. Three settings: left swipe behaviour, NSFW blur, and default sort. Settings persist to localStorage and propagate via React Context.

## Settings Schema

Stored under `stakswipe_settings` in localStorage as a single JSON object.

```ts
interface AppSettings {
  leftSwipe: 'downvote' | 'dismiss'; // default: 'downvote'
  blurNsfw: boolean;                 // default: true
  defaultSort: SortType;             // default: 'TopTwelveHour'
}
```

`dismiss` means the card is dismissed without calling `downvotePost`.

Allowed values for `defaultSort` (displayed in settings): `Active`, `Hot`, `New`, `TopHour`, `TopSixHour`, `TopTwelveHour`, `TopDay`, `TopWeek`.

## Architecture

### `src/lib/store.ts` — persistence

Add two functions alongside the existing auth/seen helpers:

- `loadSettings(): AppSettings` — reads `stakswipe_settings` from localStorage, merges with defaults (handles missing keys from older stored values)
- `saveSettings(settings: AppSettings): void` — writes full object to localStorage

### `src/lib/SettingsContext.tsx` — new file

Provides a `SettingsProvider` component and `useSettings()` hook.

- `SettingsProvider` initialises state from `loadSettings()`, calls `saveSettings()` on every update
- `useSettings()` returns `{ settings: AppSettings, updateSetting<K>(key: K, value: AppSettings[K]): void }`
- No external dependencies beyond `store.ts`

### `src/components/SettingsPage.tsx` — new file

Full-page route at `/settings`. Pill-selector UI (Option B from design).

Layout — three cards stacked vertically:

1. **Left Swipe** — two pills: `Downvote` | `Dismiss`
2. **Blur NSFW** — two pills: `On` | `Off`
3. **Default Sort** — eight pills in a wrapping row: `Active`, `Hot`, `New`, `Top Hour`, `Top 6h`, `Top 12h`, `Top Day`, `Top Week`

Each tap calls `updateSetting()` immediately — no save button. Header has a back button (`← Settings`) that navigates to `/`.

### `src/components/MenuDrawer.tsx` — modified

Add a ⚙️ **Settings** button as a fourth item. The grid changes from `repeat(3, 1fr)` to `repeat(4, 1fr)`. Navigates to `/settings`.

### `src/App.tsx` — modified

- Wrap `AuthenticatedApp` in `<SettingsProvider>`
- Add `<Route path="/settings" element={<SettingsPage />} />` inside `AuthenticatedApp`'s routes

### `src/components/FeedStack.tsx` — modified

- Read `settings.defaultSort` from `useSettings()` for the initial `sortType` state (home feed only; community feed keeps `'Active'`)
- Left swipe handler: if `settings.leftSwipe === 'dismiss'`, call `dismissTop()` without calling `downvotePost()`
- Keyboard `ArrowLeft` handler: same check

### `src/components/PostCard.tsx` — modified

- Read `settings.blurNsfw` from `useSettings()`
- Add local state `nsfwRevealed: boolean` (default `false`)
- If `post.nsfw && blurNsfw && !nsfwRevealed`: render a blur overlay on the image element only (not the whole card). The overlay contains a "Tap to reveal NSFW" button. Tapping sets `nsfwRevealed = true`
- After reveal: image displays normally; a small `NSFW` pill badge renders in the top-right corner of the image
- `nsfwRevealed` is per-card local state and resets naturally when the card unmounts (dismissed)

## Data Flow

```
App
└── SettingsProvider
      └── AuthenticatedApp
            ├── FeedStack       — consumes leftSwipe, defaultSort
            │     └── PostCard  — consumes blurNsfw
            └── SettingsPage    — consumes + mutates all settings
```

## Testing

- `store.ts`: unit tests for `loadSettings` (defaults on empty, partial merge, full object)
- `SettingsContext`: test that `updateSetting` persists to localStorage and triggers re-render
- `SettingsPage`: render test that pill selection calls `updateSetting` with correct args
- `MenuDrawer`: existing tests updated to expect 4 buttons when drawer is open; new test for Settings navigation
- `FeedStack`: test that left swipe with `leftSwipe='dismiss'` does not call `downvotePost`
- `PostCard`: test that NSFW post with `blurNsfw=true` renders blur overlay; tapping it removes overlay
