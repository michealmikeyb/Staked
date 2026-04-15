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
  permission: NotificationPermission,
): void {
  const lastCountRef = useRef<number>(-1); // -1 = baseline not yet established

  useEffect(() => {
    if (!auth || permission !== 'granted') return;

    let cancelled = false;

    lastCountRef.current = -1;

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
          if (cancelled) return;
          if (count !== lastCountRef.current) setUnreadCount(count);
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
    return () => { cancelled = true; clearInterval(id); };
  }, [auth, setUnreadCount, permission]);

  useEffect(() => {
    if (!auth) {
      lastCountRef.current = -1;
      clearNotifState().catch(() => {});
      return;
    }
    readNotifState().then((state) => {
      writeNotifState({ instance: auth.instance, token: auth.token, lastCount: state?.lastCount ?? 0 });
    }).catch(() => {});
  }, [auth]);
}
