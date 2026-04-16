import { describe, it, expect, beforeEach } from 'vitest';
import { saveAuth, loadAuth, clearAuth, loadSeen, addSeen, clearSeen, type AuthState, loadSettings, saveSettings, type AppSettings } from './store';

const VALID_AUTH: AuthState = {
  token: 'test-jwt-token',
  instance: 'lemmy.world',
  username: 'alice',
};

beforeEach(() => {
  localStorage.clear();
});

describe('saveAuth / loadAuth', () => {
  it('returns null when nothing is stored', () => {
    expect(loadAuth()).toBeNull();
  });

  it('round-trips auth state through localStorage', () => {
    saveAuth(VALID_AUTH);
    expect(loadAuth()).toEqual(VALID_AUTH);
  });

  it('returns null if token is missing', () => {
    saveAuth(VALID_AUTH);
    localStorage.removeItem('stakswipe_token');
    expect(loadAuth()).toBeNull();
  });

  it('returns null if instance is missing', () => {
    saveAuth(VALID_AUTH);
    localStorage.removeItem('stakswipe_instance');
    expect(loadAuth()).toBeNull();
  });
});

describe('clearAuth', () => {
  it('removes stored auth so loadAuth returns null', () => {
    saveAuth(VALID_AUTH);
    clearAuth();
    expect(loadAuth()).toBeNull();
  });
});

describe('loadSeen', () => {
  it('returns an empty Set when nothing is stored', () => {
    expect(loadSeen()).toEqual(new Set());
  });

  it('returns stored IDs as a Set', () => {
    localStorage.setItem('stakswipe_seen', JSON.stringify([1, 2, 3]));
    expect(loadSeen()).toEqual(new Set([1, 2, 3]));
  });

  it('returns an empty Set when stored value is invalid JSON', () => {
    localStorage.setItem('stakswipe_seen', 'not-json');
    expect(loadSeen()).toEqual(new Set());
  });
});

describe('addSeen', () => {
  it('stores a single ID', () => {
    addSeen(42);
    expect(loadSeen()).toEqual(new Set([42]));
  });

  it('accumulates multiple IDs', () => {
    addSeen(1);
    addSeen(2);
    addSeen(3);
    expect(loadSeen()).toEqual(new Set([1, 2, 3]));
  });

  it('does not duplicate an already-stored ID', () => {
    addSeen(5);
    addSeen(5);
    const arr = JSON.parse(localStorage.getItem('stakswipe_seen')!);
    expect(arr).toEqual([5]);
  });

  it('caps the stored list at 200 entries, dropping oldest', () => {
    for (let i = 0; i < 201; i++) addSeen(i);
    const arr = JSON.parse(localStorage.getItem('stakswipe_seen')!) as number[];
    expect(arr.length).toBe(200);
    expect(arr[0]).toBe(1);   // ID 0 was dropped
    expect(arr[199]).toBe(200);
  });

  it('recovers gracefully when stored value is corrupted', () => {
    localStorage.setItem('stakswipe_seen', 'bad-json');
    addSeen(7);
    expect(loadSeen()).toEqual(new Set([7]));
  });
});

describe('clearSeen', () => {
  it('removes all stored seen IDs', () => {
    addSeen(10);
    addSeen(20);
    clearSeen();
    expect(loadSeen()).toEqual(new Set());
  });
});

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual({
      nonUpvoteSwipeAction: 'downvote',
      swapGestures: false,
      blurNsfw: true,
      defaultSort: 'TopTwelveHour',
      activeStak: 'All',
      anonInstance: '',
    });
  });

  it('round-trips settings through localStorage', () => {
    const s: AppSettings = {
      nonUpvoteSwipeAction: 'dismiss',
      swapGestures: true,
      blurNsfw: false,
      defaultSort: 'Hot',
      activeStak: 'Local',
      anonInstance: '',
    };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it('merges stored partial object with defaults (handles missing keys)', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ blurNsfw: false }));
    const s = loadSettings();
    expect(s.blurNsfw).toBe(false);
    expect(s.nonUpvoteSwipeAction).toBe('downvote');
    expect(s.swapGestures).toBe(false);
    expect(s.defaultSort).toBe('TopTwelveHour');
    expect(s.activeStak).toBe('All');
  });

  it('returns defaults when stored value is invalid JSON', () => {
    localStorage.setItem('stakswipe_settings', 'not-json');
    expect(loadSettings()).toEqual({
      nonUpvoteSwipeAction: 'downvote',
      swapGestures: false,
      blurNsfw: true,
      defaultSort: 'TopTwelveHour',
      activeStak: 'All',
      anonInstance: '',
    });
  });

  it('persists and reloads activeStak: Subscribed', () => {
    saveSettings({
      nonUpvoteSwipeAction: 'downvote',
      swapGestures: false,
      blurNsfw: true,
      defaultSort: 'TopTwelveHour',
      activeStak: 'Subscribed',
      anonInstance: '',
    });
    expect(loadSettings().activeStak).toBe('Subscribed');
  });

  it('loadSettings returns anonInstance empty string by default', () => {
    localStorage.clear();
    const settings = loadSettings();
    expect(settings.anonInstance).toBe('');
  });

  it('loadSettings merges anonInstance from stored JSON', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ anonInstance: 'lemmy.ml' }));
    const settings = loadSettings();
    expect(settings.anonInstance).toBe('lemmy.ml');
  });

  it('loadSettings fills missing anonInstance from defaults when not in stored JSON', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ nonUpvoteSwipeAction: 'dismiss' }));
    const settings = loadSettings();
    expect(settings.anonInstance).toBe('');
  });

  it('migrates old leftSwipe value to nonUpvoteSwipeAction', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ leftSwipe: 'dismiss' }));
    const s = loadSettings();
    expect(s.nonUpvoteSwipeAction).toBe('dismiss');
    expect(s.swapGestures).toBe(false);
  });

  it('does not overwrite nonUpvoteSwipeAction if already present alongside leftSwipe', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      leftSwipe: 'dismiss',
      nonUpvoteSwipeAction: 'downvote',
    }));
    expect(loadSettings().nonUpvoteSwipeAction).toBe('downvote');
  });
});
