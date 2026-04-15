import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
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
import { clearNotifState, readNotifState, writeNotifState } from '../lib/notifStore';

const mockNotification = vi.fn();
const mockRequestPermission = vi.fn().mockResolvedValue('granted');

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

  mockNotification.mockClear();
  vi.mocked(fetchUnreadCount).mockReset();
  vi.mocked(fetchUnreadCount).mockResolvedValue(0);
  vi.mocked(readNotifState).mockResolvedValue(null);
  vi.mocked(writeNotifState).mockResolvedValue(undefined);
  vi.mocked(clearNotifState).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

const auth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };

describe('useNotificationPolling', () => {
  it('does not poll when auth is null', async () => {
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(null, setUnreadCount, 'granted'));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(fetchUnreadCount).not.toHaveBeenCalled();
  });

  it('does not poll when permission is not granted', async () => {
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount, 'denied'));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(fetchUnreadCount).not.toHaveBeenCalled();
  });

  it('polls on mount and calls setUnreadCount', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(3);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount, 'granted'));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(fetchUnreadCount).toHaveBeenCalledWith('lemmy.world', 'tok');
    expect(setUnreadCount).toHaveBeenCalledWith(3);
  });

  it('does NOT fire a Notification on first poll (establishing baseline)', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(5);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount, 'granted'));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('fires a Notification when count increases after baseline', async () => {
    vi.mocked(fetchUnreadCount)
      .mockResolvedValueOnce(3)  // first poll: baseline
      .mockResolvedValueOnce(5); // second poll: increase
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount, 'granted'));
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
    renderHook(() => useNotificationPolling(auth, setUnreadCount, 'granted'));
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
    renderHook(() => useNotificationPolling(auth, setUnreadCount, 'granted'));
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
      renderHook(() => useNotificationPolling(auth, setUnreadCount, 'granted'))
    ).not.toThrow();
  });

  it('calls clearNotifState when auth becomes null', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(0);
    const setUnreadCount = vi.fn();
    const { rerender } = renderHook(
      ({ a }: { a: typeof auth | null }) => useNotificationPolling(a, setUnreadCount, 'granted'),
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
    renderHook(() => useNotificationPolling(auth, setUnreadCount, 'granted'));
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); vi.runAllTimersAsync(); });
    expect(fetchUnreadCount).not.toHaveBeenCalled();
  });

  it('writes updated count to notifStore after poll', async () => {
    vi.mocked(fetchUnreadCount).mockResolvedValue(7);
    const setUnreadCount = vi.fn();
    renderHook(() => useNotificationPolling(auth, setUnreadCount, 'granted'));
    await act(async () => { vi.runAllTimersAsync(); });
    expect(writeNotifState).toHaveBeenCalledWith(
      expect.objectContaining({ lastCount: 7 }),
    );
  });
});
