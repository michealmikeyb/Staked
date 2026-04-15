# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OS-level notifications for Lemmy replies and mentions — foreground polling for Chrome + Firefox, plus Periodic Background Sync for Chrome PWA users when the app is closed.

**Architecture:** A new `notifStore.ts` module bridges `localStorage`-based auth into IndexedDB so the service worker can read it. A `useNotificationPolling` hook mounted in `App` polls `fetchUnreadCount` every 5 minutes while the page is visible and shows native `Notification`s on increase. A custom service worker (`src/sw.ts`) handles `periodicsync` events to check for notifications in the background. `vite.config.ts` switches from `generateSW` to `injectManifest` mode to allow custom SW code.

**Tech Stack:** React 18, TypeScript, Vite, vite-plugin-pwa 0.20, workbox-precaching (bundled with vite-plugin-pwa), Web Notifications API, Periodic Background Sync API, IndexedDB, vitest, fake-indexeddb

---

### Task 1: Install fake-indexeddb

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install the package**

```bash
npm install --save-dev fake-indexeddb
```

Expected output: `added 1 package` (or similar). No errors.

- [ ] **Step 2: Verify install**

```bash
npm ls fake-indexeddb
```

Expected: `fake-indexeddb@...` listed under devDependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add fake-indexeddb for IndexedDB unit tests"
```

---

### Task 2: Create notifStore — IndexedDB bridge

**Files:**
- Create: `src/lib/notifStore.ts`
- Create: `src/lib/notifStore.test.ts`

The service worker can't read `localStorage`. This module gives both the page and the SW a shared store in IndexedDB holding `{ instance, token, lastCount }`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/notifStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import FakeIndexedDB from 'fake-indexeddb';
import { readNotifState, writeNotifState, clearNotifState } from './notifStore';

beforeEach(() => {
  (global as unknown as { indexedDB: unknown }).indexedDB = new FakeIndexedDB();
});

describe('notifStore', () => {
  it('returns null when nothing has been written', async () => {
    expect(await readNotifState()).toBeNull();
  });

  it('round-trips a written state', async () => {
    await writeNotifState({ instance: 'lemmy.world', token: 'tok', lastCount: 3 });
    expect(await readNotifState()).toEqual({ instance: 'lemmy.world', token: 'tok', lastCount: 3 });
  });

  it('overwrites previous state', async () => {
    await writeNotifState({ instance: 'lemmy.world', token: 'tok', lastCount: 3 });
    await writeNotifState({ instance: 'lemmy.world', token: 'tok', lastCount: 7 });
    const state = await readNotifState();
    expect(state?.lastCount).toBe(7);
  });

  it('clearNotifState removes the record', async () => {
    await writeNotifState({ instance: 'lemmy.world', token: 'tok', lastCount: 3 });
    await clearNotifState();
    expect(await readNotifState()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- notifStore
```

Expected: FAIL with "Cannot find module './notifStore'"

- [ ] **Step 3: Implement notifStore**

Create `src/lib/notifStore.ts`:

```typescript
const DB_NAME = 'stakswipe-notif';
const STORE_NAME = 'notif';
const RECORD_KEY = 'state';

export interface NotifState {
  instance: string;
  token: string;
  lastCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readNotifState(): Promise<NotifState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = () => resolve((req.result as NotifState) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function writeNotifState(state: NotifState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(state, RECORD_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearNotifState(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(RECORD_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- notifStore
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifStore.ts src/lib/notifStore.test.ts
git commit -m "feat: add notifStore IndexedDB bridge for notification state"
```

---

### Task 3: Create useNotificationPolling hook

**Files:**
- Create: `src/hooks/useNotificationPolling.ts`
- Create: `src/hooks/useNotificationPolling.test.ts`

This hook runs in `App`. It polls `fetchUnreadCount` every 5 minutes while the page is visible, shows a native `Notification` when the count increases, and registers `periodicSync` on Chrome PWA.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useNotificationPolling.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import FakeIndexedDB from 'fake-indexeddb';
import { useNotificationPolling } from './useNotificationPolling';

vi.mock('../lib/lemmy', () => ({
  fetchUnreadCount: vi.fn(),
}));

vi.mock('../lib/notifStore', () => ({
  readNotifState: vi.fn().mockResolvedValue(null),
  writeNotifState: vi.fn().mockResolvedValue(undefined),
  clearNotifState: vi.fn().mockResolvedValue(undefined),
}));

import { fetchUnreadCount } from '../lib/lemmy';
import { clearNotifState, writeNotifState } from '../lib/notifStore';

const mockNotification = vi.fn();
const mockRequestPermission = vi.fn().mockResolvedValue('granted');

beforeEach(() => {
  (global as unknown as { indexedDB: unknown }).indexedDB = new FakeIndexedDB();
  vi.useFakeTimers();

  Object.defineProperty(global, 'Notification', {
    value: Object.assign(mockNotification, {
      permission: 'granted',
      requestPermission: mockRequestPermission,
    }),
    writable: true,
    configurable: true,
  });

  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    writable: true,
    configurable: true,
  });

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve({
        periodicSync: { register: vi.fn().mockResolvedValue(undefined) },
      }),
    },
    writable: true,
    configurable: true,
  });

  vi.clearAllMocks();
  mockNotification.mockClear();
  // Re-apply Notification.permission after clearAllMocks
  Object.defineProperty(global, 'Notification', {
    value: Object.assign(mockNotification, {
      permission: 'granted',
      requestPermission: mockRequestPermission,
    }),
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const auth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };

describe('useNotificationPolling', () => {
  it('does not poll when auth is null', async () => {
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(null, setUnreadCount));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(fetchUnreadCount).not.toHaveBeenCalled();
  });

  it('does not poll when permission is not granted', async () => {
    Object.defineProperty(global, 'Notification', {
      value: Object.assign(mockNotification, { permission: 'denied', requestPermission: mockRequestPermission }),
      writable: true, configurable: true,
    });
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(fetchUnreadCount).not.toHaveBeenCalled();
  });

  it('polls on mount and calls setUnreadCount', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(3);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(fetchUnreadCount).toHaveBeenCalledWith('lemmy.world', 'tok');
    expect(setUnreadCount).toHaveBeenCalledWith(3);
  });

  it('does NOT fire a Notification on first poll (establishing baseline)', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(5);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('fires a Notification when count increases after baseline', async () => {
    vi.mocked(fetchUnreadCount)
      .mockResolvedValueOnce(3)  // first poll: baseline
      .mockResolvedValueOnce(5); // second poll: increase
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount));
    // first poll (on mount)
    await act(async () => { vi.runAllTimersAsync(); });
    // second poll (after 5 min interval)
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); vi.runAllTimersAsync(); });
    expect(mockNotification).toHaveBeenCalledWith(
      'New Stakswipe notifications',
      expect.objectContaining({ body: 'You have unread replies or mentions' }),
    );
  });

  it('does NOT fire a Notification when count stays the same', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(3);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount));
    await act(async () => { vi.runAllTimersAsync(); });
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); vi.runAllTimersAsync(); });
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('registers periodicSync when serviceWorker and periodicSync are available', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(0);
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ periodicSync: { register: mockRegister } }) },
      writable: true, configurable: true,
    });
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(mockRegister).toHaveBeenCalledWith('check-notifications', { minInterval: 15 * 60 * 1000 });
  });

  it('skips periodicSync silently when not supported', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(0);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) }, // no periodicSync
      writable: true, configurable: true,
    });
    const setUnreadCount = vi.fn();
    expect(() =>
      renderHook(() => useNotificationPolling(auth, setUnreadCount))
    ).not.toThrow();
  });

  it('calls clearNotifState when auth becomes null', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(0);
    const setUnreadCount = vi.fn();
    const { rerender } = renderHook(
      ({ a }: { a: typeof auth | null }) => useNotificationPolling(a, setUnreadCount),
      { initialProps: { a: auth } },
    );
    await act(async () => { vi.runAllTimersAsync(); });
    rerender({ a: null });
    await act(async () => {});
    expect(clearNotifState).toHaveBeenCalled();
  });

  it('skips polling when page is not visible', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden', writable: true, configurable: true,
    });
    vi.mocked(fetchUnreadCount).mockResolvedValue(3);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); vi.runAllTimersAsync(); });
    expect(fetchUnreadCount).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- useNotificationPolling
```

Expected: FAIL with "Cannot find module './useNotificationPolling'"

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useNotificationPolling.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { fetchUnreadCount } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { readNotifState, writeNotifState, clearNotifState } from '../lib/notifStore';

const POLL_INTERVAL = 5 * 60 * 1000;
const SYNC_TAG = 'check-notifications';
const SYNC_MIN_INTERVAL = 15 * 60 * 1000;

export function useNotificationPolling(
  auth: AuthState | null,
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>,
): void {
  const lastCountRef = useRef<number>(-1); // -1 = baseline not yet established

  useEffect(() => {
    if (!auth || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    // Sync auth to IndexedDB for the service worker
    readNotifState().then((state) => {
      writeNotifState({ instance: auth.instance, token: auth.token, lastCount: state?.lastCount ?? 0 });
    }).catch(() => {});

    // Register periodicSync for Chrome PWA background delivery
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if ('periodicSync' in reg) {
          // @ts-expect-error periodicSync not in standard lib types
          reg.periodicSync.register(SYNC_TAG, { minInterval: SYNC_MIN_INTERVAL }).catch(() => {});
        }
      }).catch(() => {});
    }

    function poll() {
      if (document.visibilityState !== 'visible') return;
      fetchUnreadCount(auth!.instance, auth!.token)
        .then((count) => {
          setUnreadCount(count);
          if (lastCountRef.current >= 0 && count > lastCountRef.current) {
            new Notification('New Stakswipe notifications', {
              body: 'You have unread replies or mentions',
              icon: '/icon-192.png',
            });
          }
          lastCountRef.current = count;
          writeNotifState({ instance: auth!.instance, token: auth!.token, lastCount: count }).catch(() => {});
        })
        .catch(() => {});
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => { clearInterval(id); };
  }, [auth, setUnreadCount]);

  // Clean up IndexedDB and reset baseline on logout
  useEffect(() => {
    if (!auth) {
      lastCountRef.current = -1;
      clearNotifState().catch(() => {});
    }
  }, [auth]);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- useNotificationPolling
```

Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNotificationPolling.ts src/hooks/useNotificationPolling.test.ts
git commit -m "feat: add useNotificationPolling hook for foreground notification polling"
```

---

### Task 4: Switch vite-plugin-pwa to injectManifest and create custom service worker

**Files:**
- Create: `src/sw.ts`
- Modify: `vite.config.ts`

The default `generateSW` mode produces a service worker Workbox controls entirely. Switching to `injectManifest` lets us write `src/sw.ts` ourselves — Workbox injects the precache manifest into it at build time.

- [ ] **Step 1: Create the custom service worker**

Create `src/sw.ts`:

```typescript
import { precacheAndRoute } from 'workbox-precaching';
import { type NotifState } from './lib/notifStore';

declare const self: ServiceWorkerGlobalScope;
declare const __WB_MANIFEST: Array<{ url: string; revision: string | null }>;

// Workbox injects the asset manifest here at build time
precacheAndRoute(__WB_MANIFEST);

const DB_NAME = 'stakswipe-notif';
const STORE_NAME = 'notif';
const RECORD_KEY = 'state';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readState(): Promise<NotifState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = () => resolve((req.result as NotifState) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function writeState(state: NotifState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(state, RECORD_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function checkAndNotify(): Promise<void> {
  const state = await readState();
  if (!state) return;

  let count: number;
  try {
    const res = await fetch(`https://${state.instance}/api/v3/user/unread_count`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!res.ok) return;
    const json = await res.json() as { replies: number; mentions: number };
    count = json.replies + json.mentions;
  } catch {
    return;
  }

  if (count > state.lastCount) {
    await self.registration.showNotification('New Stakswipe notifications', {
      body: 'You have unread replies or mentions',
      icon: '/icon-192.png',
    });
  }

  await writeState({ ...state, lastCount: count });
}

self.addEventListener('periodicsync', (event) => {
  const syncEvent = event as ExtendableEvent & { tag: string };
  if (syncEvent.tag !== 'check-notifications') return;
  syncEvent.waitUntil(checkAndNotify());
});
```

Note: The IndexedDB logic is duplicated from `notifStore.ts` rather than imported because the SW runs in a separate Rollup bundle entry — inlining it avoids any potential bundling issues with the service worker context.

- [ ] **Step 2: Update vite.config.ts to use injectManifest mode**

Read the current `vite.config.ts` first, then replace the `VitePWA(...)` call:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Stakswipe',
        short_name: 'Stakswipe',
        description: 'Lemmy, fast. Swipe to vote.',
        theme_color: '#ff6b35',
        background_color: '#111318',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
```

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: Build completes with no TypeScript or Workbox errors. The `dist/` folder should contain a `sw.js` file.

If you see `Cannot find module 'workbox-precaching'`, run `npm install workbox-precaching` (it should already be available as a transitive dep of vite-plugin-pwa, but install it explicitly if missing).

- [ ] **Step 4: Run the full test suite to confirm nothing regressed**

```bash
npm test
```

Expected: All previously passing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sw.ts vite.config.ts package.json package-lock.json
git commit -m "feat: add custom service worker with periodicsync for background notifications"
```

---

### Task 5: Add Notifications toggle to SettingsPage

**Files:**
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/components/SettingsPage.test.tsx`

The toggle shows the current permission state and lets the user request permission. It only shows when `Notification` is supported by the browser (e.g. not in Safari iOS). Auth is read directly from localStorage via `loadAuth()` to decide whether to show an "account required" message.

- [ ] **Step 1: Read the existing SettingsPage test to understand the pattern**

Read `src/components/SettingsPage.test.tsx` before editing it.

- [ ] **Step 2: Add tests for the notifications section**

In `src/components/SettingsPage.test.tsx`, add the following describe block inside the existing `describe('SettingsPage', ...)` (or at file scope if there isn't one). Add these imports at the top if not already present:

```typescript
import userEvent from '@testing-library/user-event';
import { loadAuth } from '../lib/store';
vi.mock('../lib/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/store')>();
  return { ...actual, loadAuth: vi.fn() };
});
```

Then add these tests:

```typescript
describe('Notifications section', () => {
  beforeEach(() => {
    vi.mocked(loadAuth).mockReturnValue({ instance: 'lemmy.world', token: 'tok', username: 'alice' });
  });

  it('shows Enable button when permission is default', () => {
    Object.defineProperty(global, 'Notification', {
      value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
      writable: true, configurable: true,
    });
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /enable notifications/i })).toBeInTheDocument();
  });

  it('shows On state when permission is granted', () => {
    Object.defineProperty(global, 'Notification', {
      value: { permission: 'granted', requestPermission: vi.fn() },
      writable: true, configurable: true,
    });
    render(<SettingsPage />);
    expect(screen.getByText(/notifications on/i)).toBeInTheDocument();
  });

  it('shows Blocked message when permission is denied', () => {
    Object.defineProperty(global, 'Notification', {
      value: { permission: 'denied', requestPermission: vi.fn() },
      writable: true, configurable: true,
    });
    render(<SettingsPage />);
    expect(screen.getByText(/blocked in browser settings/i)).toBeInTheDocument();
  });

  it('shows Log in message when not authenticated', () => {
    vi.mocked(loadAuth).mockReturnValue(null);
    Object.defineProperty(global, 'Notification', {
      value: { permission: 'default', requestPermission: vi.fn() },
      writable: true, configurable: true,
    });
    render(<SettingsPage />);
    expect(screen.getByText(/log in to enable notifications/i)).toBeInTheDocument();
  });

  it('calls requestPermission when Enable is clicked', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(global, 'Notification', {
      value: { permission: 'default', requestPermission },
      writable: true, configurable: true,
    });
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: /enable notifications/i }));
    expect(requestPermission).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests — verify new tests fail**

```bash
npm test -- SettingsPage
```

Expected: existing tests pass, new Notification tests FAIL.

- [ ] **Step 4: Implement the Notifications card in SettingsPage**

In `src/components/SettingsPage.tsx`, add these imports at the top of the file (SettingsPage has no React import currently — the JSX transform handles it, but `useState` must be imported explicitly):

```typescript
import { useState } from 'react';
import { loadAuth } from '../lib/store';
```

Then add this state inside the `SettingsPage` component function (before the `return`):

```typescript
const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
});
const isAuthenticated = loadAuth() !== null;

async function handleEnableNotifications() {
  const result = await Notification.requestPermission();
  setNotifPermission(result);
}
```

Then add this card in the JSX, after the existing cards and before the closing `</div>`:

```tsx
{notifPermission !== 'unsupported' && (
  <div style={card}>
    <div style={sectionLabel}>Notifications</div>
    {!isAuthenticated ? (
      <div style={{ fontSize: 12, color: '#888' }}>Log in to enable notifications</div>
    ) : notifPermission === 'granted' ? (
      <div style={{ fontSize: 13, color: '#4caf50', fontWeight: 600 }}>Notifications on</div>
    ) : notifPermission === 'denied' ? (
      <div style={{ fontSize: 12, color: '#888' }}>Blocked in browser settings</div>
    ) : (
      <button style={inactive} onClick={handleEnableNotifications}>
        Enable notifications
      </button>
    )}
  </div>
)}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test -- SettingsPage
```

Expected: All SettingsPage tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPage.tsx src/components/SettingsPage.test.tsx
git commit -m "feat: add notifications toggle to SettingsPage"
```

---

### Task 6: Wire useNotificationPolling into App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

Mount the hook at the root so it's always active when the user is logged in, regardless of which route they're on.

- [ ] **Step 1: Read App.test.tsx to understand the current mock setup**

Read `src/App.test.tsx` before editing.

- [ ] **Step 2: Add a test confirming the hook runs when logged in**

In `src/App.test.tsx`, add this mock near the top of the file (alongside other `vi.mock` calls):

```typescript
vi.mock('./hooks/useNotificationPolling', () => ({
  useNotificationPolling: vi.fn(),
}));
import { useNotificationPolling } from './hooks/useNotificationPolling';
```

Then add this test inside the existing describe block (or at file level):

```typescript
it('calls useNotificationPolling with auth and setUnreadCount', async () => {
  // Render the app with a mocked logged-in state by pre-populating localStorage
  localStorage.setItem('stakswipe_token', 'tok');
  localStorage.setItem('stakswipe_instance', 'lemmy.world');
  localStorage.setItem('stakswipe_username', 'alice');

  render(<App />);

  expect(useNotificationPolling).toHaveBeenCalledWith(
    expect.objectContaining({ instance: 'lemmy.world', token: 'tok' }),
    expect.any(Function),
  );

  localStorage.clear();
});
```

- [ ] **Step 3: Run the test — verify it fails**

```bash
npm test -- App.test
```

Expected: New test FAIL ("useNotificationPolling not called" or similar).

- [ ] **Step 4: Update App.tsx**

Add this import near the top of `src/App.tsx`:

```typescript
import { useNotificationPolling } from './hooks/useNotificationPolling';
```

Inside the `App` component function, add this line immediately after the existing state declarations:

```typescript
useNotificationPolling(auth, setUnreadCount);
```

The top of `App` should now look like:

```typescript
export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [unreadCount, setUnreadCount] = useState(0);
  useNotificationPolling(auth, setUnreadCount);
  // ...rest unchanged
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test
```

Expected: All tests PASS, including the new App test.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire useNotificationPolling into App root"
```

---

### Task 7: Verify the full build and test suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests PASS with no failures.

- [ ] **Step 2: Run a production build**

```bash
npm run build
```

Expected: Build completes. `dist/sw.js` exists and is non-empty.

- [ ] **Step 3: Smoke test in dev (optional but recommended)**

```bash
npm run dev
```

Open `http://localhost:5173` in Chrome. Navigate to Settings. You should see a "Notifications" section. Tap "Enable notifications" — Chrome should prompt for permission. If granted, the section should update to show "Notifications on."

To test the polling: open DevTools → Application → Service Workers and confirm the SW is registered. For periodicSync, in DevTools → Application → Service Workers → click "Periodic Background Sync" to manually trigger the sync tag `check-notifications`.
