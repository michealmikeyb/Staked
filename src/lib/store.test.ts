import { describe, it, expect, beforeEach } from 'vitest';
import { saveAuth, loadAuth, clearAuth, type AuthState } from './store';

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
