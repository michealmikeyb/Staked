import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAccounts, saveAccounts, addAccount, removeAccount, reorderAccounts,
  loadActive, saveActive, type StoredAccount,
} from './accounts';
import type { Session } from './api/types';

beforeEach(() => localStorage.clear());

function session(id: string, handle: string): Session {
  return { id, backendId: 'lemmy', viewer: { id: handle, handle, profileUrl: `https://x/u/${handle}` }, data: { instance: 'x', token: 't' } };
}

describe('accounts persistence', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadAccounts()).toEqual([]);
  });

  it('round-trips accounts through localStorage', () => {
    const accts: StoredAccount[] = [{ session: session('lemmy:a@x', 'a@x'), addedAt: 1 }];
    saveAccounts(accts);
    expect(loadAccounts()).toEqual(accts);
  });

  it('addAccount appends a new account', () => {
    const next = addAccount([], session('lemmy:a@x', 'a@x'));
    expect(next).toHaveLength(1);
    expect(next[0].session.id).toBe('lemmy:a@x');
  });

  it('addAccount replaces an existing account with the same id (re-login)', () => {
    const first = addAccount([], session('lemmy:a@x', 'a@x'));
    const refreshed = { ...session('lemmy:a@x', 'a@x'), data: { instance: 'x', token: 'NEW' } };
    const next = addAccount(first, refreshed);
    expect(next).toHaveLength(1);
    expect((next[0].session.data as { token: string }).token).toBe('NEW');
  });

  it('removeAccount drops the matching account', () => {
    const accts = addAccount(addAccount([], session('lemmy:a@x', 'a@x')), session('lemmy:b@x', 'b@x'));
    const next = removeAccount(accts, 'lemmy:a@x');
    expect(next.map((a) => a.session.id)).toEqual(['lemmy:b@x']);
  });

  it('reorderAccounts orders by the given id list', () => {
    const accts = addAccount(addAccount([], session('lemmy:a@x', 'a@x')), session('lemmy:b@x', 'b@x'));
    const next = reorderAccounts(accts, ['lemmy:b@x', 'lemmy:a@x']);
    expect(next.map((a) => a.session.id)).toEqual(['lemmy:b@x', 'lemmy:a@x']);
  });

  it('round-trips the active pointer (null clears it)', () => {
    saveActive({ sessionId: 'lemmy:a@x', stakId: 'all' });
    expect(loadActive()).toEqual({ sessionId: 'lemmy:a@x', stakId: 'all' });
    saveActive(null);
    expect(loadActive()).toBeNull();
  });

  it('fails safe to empty on corrupt storage', () => {
    localStorage.setItem('stakswipe_accounts', '{not json');
    expect(loadAccounts()).toEqual([]);
  });

  it('migrates a legacy single-account login into the registry', () => {
    localStorage.setItem('stakswipe_token', 'tok');
    localStorage.setItem('stakswipe_instance', 'lemmy.world');
    localStorage.setItem('stakswipe_username', 'alice');
    const accts = loadAccounts();
    expect(accts).toHaveLength(1);
    expect(accts[0].session.id).toBe('lemmy:alice@lemmy.world');
    expect((accts[0].session.data as { token: string }).token).toBe('tok');
    expect(loadActive()).toEqual({ sessionId: 'lemmy:alice@lemmy.world', stakId: 'all' });
    expect(localStorage.getItem('stakswipe_token')).toBeNull();
  });
});
