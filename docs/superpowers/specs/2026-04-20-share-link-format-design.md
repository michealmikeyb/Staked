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

## Files Changed

| File | Change |
|------|--------|
| `src/lib/store.ts` | Add `shareLinkFormat` to `AppSettings` and `DEFAULT_SETTINGS` |
| `src/lib/urlUtils.ts` | Add `buildShareUrl` function |
| `src/lib/urlUtils.test.ts` | Tests for `buildShareUrl` |
| `src/components/PostCardShell.tsx` | Update `handleShare` to use `buildShareUrl` |
| `src/components/SettingsPage.tsx` | Add Share Link Format card |
| `src/components/SettingsPage.test.tsx` | Tests for new card and pill visibility |
