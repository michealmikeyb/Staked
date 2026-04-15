# Push Notifications Design

**Date:** 2026-04-14  
**Status:** Approved

## Summary

Add OS-level notifications for Lemmy replies and mentions. No backend server. Two-layer approach: foreground polling (Chrome + Firefox) with Periodic Background Sync layered on top for Chrome PWA users.

---

## Architecture & Components

| File | Change |
|---|---|
| `src/lib/notifStore.ts` | New. IndexedDB bridge — reads/writes `{ instance, token, lastCount }`. Shared between the page and service worker since the SW cannot access `localStorage`. |
| `src/hooks/useNotificationPolling.ts` | New. Foreground polling hook — signature `useNotificationPolling(auth, setUnreadCount)`. Requests `Notification` permission, polls `fetchUnreadCount` every 5 min when the page is visible, registers `periodicSync` for Chrome PWA, shows native notifications on count increase. |
| `src/sw.ts` | New. Custom service worker — imports the Workbox precache manifest and adds a `periodicsync` event handler that reads auth from IndexedDB, fetches unread count from Lemmy, and calls `showNotification()`. |
| `vite.config.ts` | Modify. Switch from `generateSW` to `injectManifest` mode and point at `src/sw.ts`. |
| `src/components/SettingsPage.tsx` | Modify. Add a "Notifications" toggle. Tapping it calls `Notification.requestPermission()` and registers the sync if granted. |
| `src/App.tsx` | Modify. Call `useNotificationPolling(auth, setUnreadCount)` at the root so polling is always active when logged in. |

---

## Data Flow

### Permission + setup (one-time)
1. User taps Notifications toggle in Settings → `Notification.requestPermission()` is called.
2. If granted, `useNotificationPolling` writes auth to IndexedDB and registers `periodicSync` with a 15-minute minimum interval on Chrome PWA.

### Foreground polling (Chrome + Firefox)
1. `setInterval` every 5 minutes, only when `document.visibilityState === 'visible'` and auth is present.
2. Calls `fetchUnreadCount(auth.instance, auth.token)`.
3. Compares to previous count held in a React ref (resets on page load).
4. On increase: `new Notification('New Stakswipe notifications', { body: 'You have unread replies or mentions', icon: '/icon-192.png' })`.
5. Updates `setUnreadCount` in App state so the inbox badge also reflects the new count.

### Background sync (Chrome PWA only)
1. Chrome fires `periodicsync` to the SW at a minimum 15-minute interval (actual timing up to the browser).
2. SW reads `{ instance, token, lastCount }` from IndexedDB.
3. SW calls Lemmy's `/api/v3/user/unread_count` directly via plain `fetch` (no `lemmy-js-client`).
4. If new count > `lastCount`, calls `self.registration.showNotification()`.
5. SW writes new count back to IndexedDB.

### Auth changes
When auth changes (login/logout), `useNotificationPolling` syncs the change to IndexedDB immediately and cancels or re-registers the polling interval accordingly.

---

## Error Handling & UX

**Permission denied:** Toggle shows as off and disabled with a note "Blocked in browser settings." No polling or sync is registered.

**`periodicSync` not supported** (Firefox, non-installed Chrome): `useNotificationPolling` wraps registration in a `'periodicSync' in registration` check — silently skipped. Foreground polling still works.

**Lemmy fetch fails in SW:** SW catches the error and does nothing. The count in IndexedDB is not updated, so the next sync will retry.

**Token expired in SW:** The SW fetch returns 401. Treated as a fetch failure — silent skip. User sees the expired state on next app open (existing behaviour).

**Duplicate notifications (app open + SW fires simultaneously):** Not deduplicated. The page polls every 5 minutes; the SW fires at 15-minute minimum intervals, so the page will almost always see the change first. YAGNI.

---

## Testing

**`useNotificationPolling` tests:**
- Mock `Notification`, `document.visibilityState`, `navigator.serviceWorker`, and `fetchUnreadCount`.
- Assert polling starts when auth is present, stops when auth is null.
- Assert notification fires when count increases; not when count stays the same or decreases.
- Assert `periodicSync.register` called when permission is granted and API is available.
- Assert `periodicSync.register` silently skipped when API is absent.

**`notifStore` tests:**
- Unit test IndexedDB read/write/clear using `fake-indexeddb`.

**`SettingsPage` tests:**
- Mock `Notification.requestPermission` and assert toggle renders correctly for each permission state: `'default'`, `'granted'`, `'denied'`.

**Service worker:** Not unit tested. The `periodicsync` handler is thin enough that coverage from the other tests is sufficient.
