import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { createMockBackend } from '../lib/api/backends/mock';
import type { MockBackend } from '../lib/api/backends/mock';
import { useNotificationPolling } from './useNotificationPolling';

vi.mock('../lib/notifStore', () => ({
  readNotifState: vi.fn().mockResolvedValue(null),
  writeNotifState: vi.fn().mockResolvedValue(undefined),
  clearNotifState: vi.fn().mockResolvedValue(undefined),
}));

import { clearNotifState, readNotifState, writeNotifState } from '../lib/notifStore';

const mockNotification = vi.fn();
const mockRequestPermission = vi.fn().mockResolvedValue('granted');

let backend: MockBackend;

beforeEach(() => {
  (global as unknown as { indexedDB: unknown }).indexedDB = new IDBFactory();
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

  backend = createMockBackend({}, {}, false);
  vi.spyOn(backend.notifications, 'unreadCount').mockResolvedValue(0);

  mockNotification.mockClear();
  vi.mocked(readNotifState).mockResolvedValue(null);
  vi.mocked(writeNotifState).mockResolvedValue(undefined);
  vi.mocked(clearNotifState).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useNotificationPolling', () => {
  it('does not poll when backend is null', async () => {
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(null, setUnreadCount, 'granted'));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(backend.notifications.unreadCount).not.toHaveBeenCalled();
  });

  it('does not poll when permission is not granted', async () => {
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(backend, setUnreadCount, 'denied'));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(backend.notifications.unreadCount).not.toHaveBeenCalled();
  });

  it('polls on mount and calls setUnreadCount', async () => {
    vi.spyOn(backend.notifications, 'unreadCount').mockResolvedValue(3);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(backend, setUnreadCount, 'granted'));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(backend.notifications.unreadCount).toHaveBeenCalled();
    expect(setUnreadCount).toHaveBeenCalledWith(3);
  });

  it('does NOT fire a Notification on first poll (establishing baseline)', async () => {
    vi.spyOn(backend.notifications, 'unreadCount').mockResolvedValue(5);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(backend, setUnreadCount, 'granted'));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('fires a Notification when count increases after baseline', async () => {
    vi.spyOn(backend.notifications, 'unreadCount')
      .mockResolvedValueOnce(3)  // first poll: baseline
      .mockResolvedValueOnce(5); // second poll: increase
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(backend, setUnreadCount, 'granted'));
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
    vi.spyOn(backend.notifications, 'unreadCount').mockResolvedValue(3);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(backend, setUnreadCount, 'granted'));
    await act(async () => { vi.runAllTimersAsync(); });
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); vi.runAllTimersAsync(); });
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('registers periodicSync when serviceWorker and periodicSync are available', async () => {
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ periodicSync: { register: mockRegister } }) },
      writable: true, configurable: true,
    });
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(backend, setUnreadCount, 'granted'));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(mockRegister).toHaveBeenCalledWith('check-notifications', { minInterval: 15 * 60 * 1000 });
  });

  it('skips periodicSync silently when not supported', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) }, // no periodicSync
      writable: true, configurable: true,
    });
    const setUnreadCount = vi.fn();
    expect(() =>
      renderHook(() => useNotificationPolling(backend, setUnreadCount, 'granted'))
    ).not.toThrow();
  });

  it('calls clearNotifState when backend becomes null', async () => {
    const setUnreadCount = vi.fn();
    const { rerender } = renderHook(
      ({ b }: { b: MockBackend | null }) => useNotificationPolling(b, setUnreadCount, 'granted'),
      { initialProps: { b: backend } },
    );
    await act(async () => { vi.runAllTimersAsync(); });
    rerender({ b: null });
    await act(async () => {});
    expect(clearNotifState).toHaveBeenCalled();
  });

  it('skips polling when page is not visible', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden', writable: true, configurable: true,
    });
    vi.spyOn(backend.notifications, 'unreadCount').mockResolvedValue(3);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(backend, setUnreadCount, 'granted'));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); vi.runAllTimersAsync(); });
    expect(backend.notifications.unreadCount).not.toHaveBeenCalled();
  });

  it('writes updated count to notifStore after poll', async () => {
    vi.spyOn(backend.notifications, 'unreadCount').mockResolvedValue(7);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(backend, setUnreadCount, 'granted'));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(writeNotifState).toHaveBeenCalledWith(
      expect.objectContaining({ lastCount: 7 }),
    );
  });
});
