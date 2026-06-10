import { useEffect, useRef } from 'react';
import type { Backend } from '../lib/api/backend';
import { readNotifState, writeNotifState, clearNotifState } from '../lib/notifStore';

const POLL_INTERVAL = 5 * 60 * 1000;
const SYNC_TAG = 'check-notifications';
const SYNC_MIN_INTERVAL = 15 * 60 * 1000;

export function useNotificationPolling(
  backend: Backend | null,
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>,
  permission: NotificationPermission,
): void {
  const lastCountRef = useRef<number>(-1); // -1 = baseline not yet established

  useEffect(() => {
    if (!backend?.session || permission !== 'granted') return;

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

    const { instance = '', token = '' } = (backend.session.data ?? {}) as { instance?: string; token?: string };

    function poll() {
      if (document.visibilityState !== 'visible') return;
      backend!.notifications.unreadCount()
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
          writeNotifState({ instance, token, lastCount: count }).catch(() => {});
        })
        .catch(() => {});
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => { cancelled = true; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend?.session, permission]);

  useEffect(() => {
    if (!backend?.session) {
      lastCountRef.current = -1;
      clearNotifState().catch(() => {});
      return;
    }
    const { instance = '', token = '' } = (backend.session.data ?? {}) as { instance?: string; token?: string };
    readNotifState().then((state) => {
      writeNotifState({ instance, token, lastCount: state?.lastCount ?? 0 });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend?.session]);
}
