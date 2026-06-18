// src/lib/AccountsContext.tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Backend } from './api/backend';
import type { Session, ActiveStakRef } from './api/types';
import { createBackend } from './api/registry';
import { registerBackends } from './api/backends';
import { BackendProvider } from './api/context';
import {
  loadAccounts, saveAccounts, loadActive, saveActive,
  addAccount as addAccountTo, removeAccount as removeAccountFrom, reorderAccounts as reorderAccountsIn,
  type StoredAccount,
} from './accounts';

const STAK_ICONS: Record<string, string> = { all: '🌐', local: '🏠', subscribed: '⭐' };
const ANON_SESSION: Session = { id: 'anon', backendId: 'lemmy', viewer: null, data: { instance: '', token: null } };

export interface StakOption {
  sessionId: string | null; // null = anonymous
  stakId: string;
  label: string;
  icon?: string;
  handle?: string;
}

interface AccountsContextValue {
  accounts: StoredAccount[];
  active: ActiveStakRef | null;
  allStaks: StakOption[];
  setActive: (ref: ActiveStakRef | null) => void;
  addAccount: (session: Session) => void;
  removeAccount: (sessionId: string) => void;
  reorderAccounts: (orderedIds: string[]) => void;
}

const AccountsContext = createContext<AccountsContextValue | null>(null);

export function AccountsProvider({ children }: { children: ReactNode }) {
  registerBackends(); // idempotent; ensures the registry is populated before createBackend

  const [accounts, setAccounts] = useState<StoredAccount[]>(loadAccounts);
  const [active, setActiveState] = useState<ActiveStakRef | null>(loadActive);

  const currentSession: Session = useMemo(() => {
    if (!active) return ANON_SESSION;
    return accounts.find((a) => a.session.id === active.sessionId)?.session ?? ANON_SESSION;
  }, [active, accounts]);

  const backend: Backend = useMemo(() => createBackend(currentSession), [currentSession]);

  const allStaks: StakOption[] = useMemo(() => {
    const out: StakOption[] = [];
    for (const a of accounts) {
      const b = createBackend(a.session);
      for (const s of b.listStaks()) {
        out.push({ sessionId: a.session.id, stakId: s.id, label: s.label, icon: STAK_ICONS[s.id], handle: a.session.viewer?.handle });
      }
    }
    out.push({ sessionId: null, stakId: 'anonymous', label: 'Anonymous', icon: '🕵️' });
    return out;
  }, [accounts]);

  function setActive(ref: ActiveStakRef | null) {
    setActiveState(ref);
    saveActive(ref);
  }

  function addAccount(session: Session) {
    setAccounts((prev) => {
      const next = addAccountTo(prev, session);
      saveAccounts(next);
      return next;
    });
    // Use the account's own first stak — backends differ (Lemmy: 'all',
    // Bluesky: 'home'). Hardcoding 'all' left non-Lemmy accounts pointing at a
    // nonexistent stak, so the selector mislabeled them as "Anonymous".
    const firstStakId = createBackend(session).listStaks()[0]?.id ?? 'all';
    const ref = { sessionId: session.id, stakId: firstStakId };
    setActiveState(ref);
    saveActive(ref);
  }

  function removeAccount(sessionId: string) {
    setAccounts((prev) => {
      const next = removeAccountFrom(prev, sessionId);
      saveAccounts(next);
      return next;
    });
    setActiveState((prev) => {
      if (prev?.sessionId === sessionId) { saveActive(null); return null; }
      return prev;
    });
  }

  function reorderAccounts(orderedIds: string[]) {
    setAccounts((prev) => {
      const next = reorderAccountsIn(prev, orderedIds);
      saveAccounts(next);
      return next;
    });
  }

  const value = useMemo<AccountsContextValue>(
    () => ({ accounts, active, allStaks, setActive, addAccount, removeAccount, reorderAccounts }),
    [accounts, active, allStaks],
  );

  return (
    <AccountsContext.Provider value={value}>
      <BackendProvider value={backend}>{children}</BackendProvider>
    </AccountsContext.Provider>
  );
}

export function useAccounts(): AccountsContextValue {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error('useAccounts must be used within an AccountsProvider');
  return ctx;
}
