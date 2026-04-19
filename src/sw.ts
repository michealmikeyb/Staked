import { precacheAndRoute } from 'workbox-precaching';
import { type NotifState } from './lib/notifStore';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Workbox injects the asset manifest here at build time
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  (event as ExtendableEvent).waitUntil(self.clients.claim());
});

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

async function deleteState(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(RECORD_KEY);
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
    if (res.status === 401) {
      await deleteState();
      return;
    }
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
