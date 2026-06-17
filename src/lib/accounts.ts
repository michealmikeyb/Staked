// src/lib/accounts.ts
import type { Session, ActiveStakRef } from './api/types';

const ACCOUNTS_KEY = 'stakswipe_accounts';
const ACTIVE_KEY = 'stakswipe_active';
const LEGACY = {
  TOKEN: 'stakswipe_token',
  INSTANCE: 'stakswipe_instance',
  USERNAME: 'stakswipe_username',
} as const;

export interface StoredAccount {
  session: Session;
  addedAt: number;
}

export function loadAccounts(): StoredAccount[] {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
    } catch {
      return [];
    }
  }
  return migrateLegacy();
}

function migrateLegacy(): StoredAccount[] {
  const token = localStorage.getItem(LEGACY.TOKEN);
  const instance = localStorage.getItem(LEGACY.INSTANCE);
  const username = localStorage.getItem(LEGACY.USERNAME);
  if (!token || !instance || !username) return [];

  const handle = `${username}@${instance}`;
  const session: Session = {
    id: `lemmy:${handle}`,
    backendId: 'lemmy',
    viewer: { id: username, handle, profileUrl: `https://${instance}/u/${username}` },
    data: { instance, token },
  };
  const accounts: StoredAccount[] = [{ session, addedAt: Date.now() }];
  saveAccounts(accounts);
  saveActive({ sessionId: session.id, stakId: 'all' });
  Object.values(LEGACY).forEach((k) => localStorage.removeItem(k));
  return accounts;
}

export function saveAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function addAccount(accounts: StoredAccount[], session: Session): StoredAccount[] {
  const without = accounts.filter((a) => a.session.id !== session.id);
  return [...without, { session, addedAt: Date.now() }];
}

export function removeAccount(accounts: StoredAccount[], sessionId: string): StoredAccount[] {
  return accounts.filter((a) => a.session.id !== sessionId);
}

export function reorderAccounts(accounts: StoredAccount[], orderedIds: string[]): StoredAccount[] {
  const map = new Map(accounts.map((a) => [a.session.id, a]));
  const out: StoredAccount[] = [];
  for (const id of orderedIds) {
    const a = map.get(id);
    if (a) { out.push(a); map.delete(id); }
  }
  map.forEach((a) => out.push(a)); // keep any not named in orderedIds
  return out;
}

export function loadActive(): ActiveStakRef | null {
  const raw = localStorage.getItem(ACTIVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.sessionId === 'string' && typeof parsed.stakId === 'string') {
      return parsed as ActiveStakRef;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveActive(active: ActiveStakRef | null): void {
  if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  else localStorage.removeItem(ACTIVE_KEY);
}
