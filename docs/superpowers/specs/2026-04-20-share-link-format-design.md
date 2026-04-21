# Share Link Format Setting — Design Spec

## Overview

Add a user setting that controls which URL format is used when sharing a post. The three options are a Stakswipe preview link, the post's source/origin instance URL, and the user's home instance URL.

## Setting

**Key:** `shareLinkFormat`  
**Type:** `'stakswipe' | 'source' | 'home'`  
**Default:** `'stakswipe'`  
**Location:** `AppSettings` in `src/lib/store.ts`

No migration needed — `loadSettings` already spreads defaults over stored values, so missing keys resolve to the default automatically.

## URL Formats

Implemented as `buildShareUrl` in `src/lib/urlUtils.ts`:

| Option | URL produced | Notes |
|--------|-------------|-------|
| `stakswipe` | `https://stakswipe.com/#/post/{instance}/{postId}` | Current behavior. Renders a branded preview page. |
| `source` | `https://{source.instance}/post/{source.postId}` | Parsed from `post.ap_id` via `sourceFromApId`. For Kbin/Mbin posts where `ap_id` has no numeric post ID, falls back to the raw `ap_id` URL (still a valid link to the post). |
| `home` | `https://{auth.instance}/post/{post.id}` | Only reachable when `auth` is present. Uses the locally-federated post ID. |

`getShareUrl` remains unchanged — existing call sites are unaffected.

## Share Logic (`PostCardShell.tsx`)

`handleShare` reads `settings.shareLinkFormat` and calls `buildShareUrl(format, post, auth, community.actor_id)`. The `useShare` hook is unchanged — it still dispatches to `navigator.share` or clipboard.

`PostCardShell` already imports `useSettings`, so no prop drilling is needed.

## Settings UI (`SettingsPage.tsx`)

New card: **Share Link Format**, placed before the Anonymous Feed card.

Three pills using the existing pill-button pattern:
- **Stakswipe** — always shown
- **Source Instance** — always shown
- **Home Instance** — only rendered when `isAuthenticated` is `true`

## Edge Cases

- **Anonymous user with `home` saved:** Cannot occur in normal usage — Home Instance pill is not rendered for unauthenticated users. If a user logs out after setting `home`, the setting persists in storage but `handleShare` will only receive `auth = null`, so `buildShareUrl` treats `home` as `source` in that case.
- **Kbin/Mbin posts with `source` format:** `sourceFromApId` returns `null` for slug-based URLs. `buildShareUrl` falls back to the raw `ap_id` string, which is still a navigable URL.

## Test Plan

### `urlUtils.test.ts` — `buildShareUrl`
- Returns Stakswipe URL for `'stakswipe'` format
- Returns source instance URL for `'source'` with a standard Lemmy `ap_id`
- Falls back to raw `ap_id` for `'source'` when `ap_id` is a Kbin/Mbin slug URL (no numeric post ID)
- Returns home instance URL for `'home'` when auth is present
- Falls back to `'source'` behavior for `'home'` when auth is `null`

### `SettingsPage.test.tsx` — Share Link Format card
- Renders Stakswipe and Source Instance pills for unauthenticated users
- Does not render Home Instance pill when `isAuthenticated` is false
- Renders all three pills when `isAuthenticated` is true
- Clicking a pill calls `updateSetting('shareLinkFormat', ...)` with the correct value

### `PostCardShell.test.tsx` / `PostCard.test.tsx` — share behavior
- When `shareLinkFormat` is `'stakswipe'`, `navigator.share` is called with a Stakswipe URL
- When `shareLinkFormat` is `'source'`, `navigator.share` is called with the source instance URL
- When `shareLinkFormat` is `'home'` and auth is present, `navigator.share` is called with the home instance URL

## Files Changed

| File | Change |
|------|--------|
| `src/lib/store.ts` | Add `shareLinkFormat` to `AppSettings` and `DEFAULT_SETTINGS` |
| `src/lib/urlUtils.ts` | Add `buildShareUrl` function |
| `src/lib/urlUtils.test.ts` | Tests for `buildShareUrl` |
| `src/components/PostCardShell.tsx` | Update `handleShare` to use `buildShareUrl` |
| `src/components/SettingsPage.tsx` | Add Share Link Format card |
| `src/components/SettingsPage.test.tsx` | Tests for new card and pill visibility |
