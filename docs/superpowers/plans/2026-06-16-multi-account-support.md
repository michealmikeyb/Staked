# Multi-Account Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user hold multiple logged-in accounts at once, add new ones through a backend-agnostic add-account flow, and switch between their staks from the selector.

**Architecture:** Build on the existing `src/lib/api` backend abstraction. Each backend describes its login fields via its `Capabilities`. A new `accounts.ts` persists a registry of `StoredAccount`s plus an active-stak pointer; a new `AccountsProvider` derives the active `Session`, builds the active `Backend` (via the wired-up `registry.ts`), and supplies the aggregated stak list to the UI. The selector, add-account pages, and a manage-accounts page sit on top.

**Tech Stack:** React 18 + TypeScript, react-router-dom (HashRouter), Vitest + jsdom + @testing-library/react, lemmy-js-client.

**Spec:** `docs/superpowers/specs/2026-06-16-multi-account-design.md`

---

## File Structure

**Create:**
- `src/lib/accounts.ts` — account registry persistence (CRUD, active pointer, legacy migration)
- `src/lib/accounts.test.ts`
- `src/lib/AccountsContext.tsx` — provider deriving active session/backend + aggregated staks
- `src/lib/AccountsContext.test.tsx`
- `src/components/BackendSelectPage.tsx` — pick a backend to add
- `src/components/BackendSelectPage.test.tsx`
- `src/components/DynamicLoginPage.tsx` — render login fields from `capabilities.loginFields`
- `src/components/DynamicLoginPage.test.tsx`
- `src/components/AccountsPage.tsx` — list / remove / reorder accounts
- `src/components/AccountsPage.test.tsx`
- `src/lib/api/backends/index.ts` — `registerBackends()` bootstrap

**Modify:**
- `src/lib/api/capabilities.ts` — add `displayName`, `icon?`, `loginFields`, `LoginField`
- `src/lib/api/backends/lemmy/index.ts` — add capability fields; stable `Session.id`
- `src/lib/api/backends/mock/index.ts` — add new capability defaults
- `src/lib/api/registry.ts` — add `hasBackend`, `listBackendIds`
- `src/components/HeaderBar.tsx` — stak selector reads aggregated staks + Add/Manage entries
- `src/components/MenuDrawer.tsx` — pass new stak props through
- `src/components/FeedStack.tsx` — drive stak/account from `AccountsContext`
- `src/App.tsx` — wrap in `AccountsProvider`; new routes; drop single-account `auth` state
- `src/App.test.tsx` — adapt to AccountsProvider

**Remove (after migration):** `src/components/LoginPage.tsx` + `LoginPage.test.tsx` are superseded by `DynamicLoginPage`; `/login` redirects to `/accounts/add`.

---

## Task 1: Extend Capabilities with backend self-description

**Files:**
- Modify: `src/lib/api/capabilities.ts`
- Modify: `src/lib/api/backends/lemmy/index.ts:18-46` (the `LEMMY_CAPABILITIES` object)
- Modify: `src/lib/api/backends/mock/index.ts:11-30` (the `DEFAULT_CAPABILITIES` object)
- Test: `src/lib/api/backends/lemmy/mappers.test.ts` is unrelated; add a new test file `src/lib/api/backends/lemmy/capabilities.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/lemmy/capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createLemmyBackend } from './index';
import type { Session } from '../../types';

const ANON: Session = { id: 'anon', backendId: 'lemmy', viewer: null, data: { instance: '', token: null } };

describe('lemmy capabilities', () => {
  it('exposes a display name and icon', () => {
    const caps = createLemmyBackend(ANON).capabilities;
    expect(caps.displayName).toBe('Lemmy');
    expect(caps.icon).toBeTruthy();
  });

  it('declares the login fields the add-account form needs', () => {
    const caps = createLemmyBackend(ANON).capabilities;
    const keys = caps.loginFields.map((f) => f.key);
    expect(keys).toEqual(['instance', 'usernameOrEmail', 'password']);
    const instanceField = caps.loginFields.find((f) => f.key === 'instance')!;
    expect(instanceField.type).toBe('instance');
    expect(instanceField.required).toBe(true);
    expect(instanceField.suggestions).toContain('lemmy.world');
    expect(caps.loginFields.find((f) => f.key === 'password')!.type).toBe('password');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/lemmy/capabilities.test.ts`
Expected: FAIL — `displayName`/`loginFields` are `undefined`, type errors on `Capabilities`.

- [ ] **Step 3: Add the types to `capabilities.ts`**

Replace the whole file `src/lib/api/capabilities.ts` with:

```ts
// src/lib/api/capabilities.ts
import type { SelectOption } from './types';

export interface LoginField {
  key: string;                            // credential key passed to auth.login
  label: string;
  type: 'instance' | 'text' | 'password'; // 'instance' renders an InstanceInput
  required: boolean;
  placeholder?: string;
  suggestions?: string[];                 // e.g. popular instances
  autoCapitalize?: boolean;
}

export interface Capabilities {
  canDownvote: boolean;
  canBrowseAnonymously: boolean;
  hasNsfwFlag: boolean;
  hasSavedPosts: boolean;
  feedOptions: SelectOption[];
  commentSortOptions: SelectOption[];
  sourceNoun: string;
  displayName: string;
  icon?: string;
  loginFields: LoginField[];
}
```

- [ ] **Step 4: Populate Lemmy capabilities**

In `src/lib/api/backends/lemmy/index.ts`, add these three fields to the `LEMMY_CAPABILITIES` object, immediately after `sourceNoun: 'Community',`:

```ts
  displayName: 'Lemmy',
  icon: '🐭',
  loginFields: [
    {
      key: 'instance',
      label: 'Instance',
      type: 'instance',
      required: true,
      placeholder: 'your.instance.com',
      suggestions: [
        'lemmy.world',
        'lemmy.dbzer0.com',
        'beehaw.org',
        'programming.dev',
        'lemmy.ml',
        'sh.itjust.works',
      ],
    },
    { key: 'usernameOrEmail', label: 'Username or email', type: 'text', required: true, placeholder: 'Username', autoCapitalize: false },
    { key: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Password' },
  ],
```

- [ ] **Step 5: Populate mock capability defaults**

In `src/lib/api/backends/mock/index.ts`, add to the `DEFAULT_CAPABILITIES` object, after `sourceNoun: 'Source',`:

```ts
  displayName: 'Mock',
  icon: '🧪',
  loginFields: [
    { key: 'instance', label: 'Instance', type: 'instance', required: true },
    { key: 'usernameOrEmail', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/lib/api/backends/lemmy/capabilities.test.ts`
Expected: PASS. Then `npm test` to confirm nothing else broke (the `Capabilities` type now requires the new fields — only the two capability objects above define full ones, and `renderWithBackend` merges partials over `DEFAULT_CAPABILITIES`, so existing tests still compile).

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/capabilities.ts src/lib/api/backends/lemmy/index.ts src/lib/api/backends/lemmy/capabilities.test.ts src/lib/api/backends/mock/index.ts
git commit -m "feat(api): backends self-describe login fields via capabilities"
```

---

## Task 2: Stable session id + registry helpers

The active pointer and staks reference `Session.id`. It must be stable across re-logins, so derive it from the handle, not the JWT. Also add registry inspection helpers.

**Files:**
- Modify: `src/lib/api/backends/lemmy/index.ts:48-60` (the `login` method)
- Modify: `src/lib/api/registry.ts`
- Test: `src/lib/api/registry.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/registry.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { registerBackend, hasBackend, listBackendIds, createBackend, clearRegistry } from './registry';
import { createMockBackend } from './backends/mock';
import type { Session } from './types';

beforeEach(() => clearRegistry());

const session: Session = { id: 'mock:x', backendId: 'mock', viewer: null, data: {} };

describe('registry', () => {
  it('reports whether a backend is registered', () => {
    expect(hasBackend('mock')).toBe(false);
    registerBackend('mock', () => createMockBackend());
    expect(hasBackend('mock')).toBe(true);
  });

  it('lists registered backend ids', () => {
    registerBackend('mock', () => createMockBackend());
    expect(listBackendIds()).toEqual(['mock']);
  });

  it('creates a backend from a session', () => {
    registerBackend('mock', () => createMockBackend());
    expect(createBackend(session).backendId).toBe('mock');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/registry.test.ts`
Expected: FAIL — `hasBackend`/`listBackendIds` are not exported.

- [ ] **Step 3: Add registry helpers**

In `src/lib/api/registry.ts`, add after the `registerBackend` function:

```ts
export function hasBackend(backendId: string): boolean {
  return registry.has(backendId);
}

export function listBackendIds(): string[] {
  return [...registry.keys()];
}
```

- [ ] **Step 4: Make the Lemmy session id stable**

In `src/lib/api/backends/lemmy/index.ts`, replace the body of the `login` method (the `async login(credentials)` block) with:

```ts
    async login(credentials): Promise<Session> {
      const { instance, usernameOrEmail, password } = credentials as {
        instance: string; usernameOrEmail: string; password: string;
      };
      const res = await makeLemmyClient(instance).login({ username_or_email: usernameOrEmail, password });
      if (!res.jwt) throw new Error('Login failed: no token returned');
      const persRes = await makeLemmyClient(instance, res.jwt).getSite();
      const viewer = persRes.my_user?.local_user_view?.person
        ? mapUser(persRes.my_user.local_user_view.person)
        : null;
      const handle = viewer?.handle ?? `${usernameOrEmail}@${instance}`;
      const data: LemmySessionData & Record<string, unknown> = { instance, token: res.jwt };
      return { ...session, id: `lemmy:${handle}`, backendId: 'lemmy', viewer, data };
    },
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/lib/api/registry.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/registry.ts src/lib/api/registry.test.ts src/lib/api/backends/lemmy/index.ts
git commit -m "feat(api): stable handle-based session id + registry helpers"
```

---

## Task 3: Backend bootstrap registration

A single place that registers every backend into the registry. Wired to read the anon-instance setting lazily (per request), so the active backend never needs rebuilding when that setting changes.

**Files:**
- Create: `src/lib/api/backends/index.ts`
- Test: `src/lib/api/backends/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/backends/index.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { registerBackends } from './index';
import { clearRegistry, hasBackend, listBackendIds, createBackend } from '../registry';

beforeEach(() => clearRegistry());

describe('registerBackends', () => {
  it('registers the lemmy backend', () => {
    registerBackends();
    expect(hasBackend('lemmy')).toBe(true);
    expect(listBackendIds()).toContain('lemmy');
  });

  it('is idempotent and does not overwrite an already-registered backend', () => {
    registerBackends();
    const before = createBackend({ id: 'lemmy:a', backendId: 'lemmy', viewer: null, data: { instance: 'x', token: null } });
    registerBackends();
    expect(before.backendId).toBe('lemmy');
    expect(listBackendIds()).toEqual(['lemmy']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/api/backends/index.test.ts`
Expected: FAIL — module `./index` does not exist.

- [ ] **Step 3: Create the bootstrap module**

Create `src/lib/api/backends/index.ts`:

```ts
// src/lib/api/backends/index.ts
import { registerBackend, hasBackend } from '../registry';
import { createLemmyBackend } from './lemmy';
import { loadSettings } from '../../store';

/**
 * Register every backend into the registry. Idempotent: only registers a
 * backend that isn't already present, so tests can pre-register a stub.
 */
export function registerBackends(): void {
  if (!hasBackend('lemmy')) {
    registerBackend('lemmy', (session) =>
      createLemmyBackend(session, {
        anonInstanceSetting: () => loadSettings().lemmy?.anonInstance || undefined,
      }),
    );
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/api/backends/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/backends/index.ts src/lib/api/backends/index.test.ts
git commit -m "feat(api): backend bootstrap registration"
```

---

## Task 4: Account registry persistence (`accounts.ts`)

**Files:**
- Create: `src/lib/accounts.ts`
- Test: `src/lib/accounts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/accounts.test.ts`:

```ts
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
    // active pointer set to the migrated account at the 'all' stak
    expect(loadActive()).toEqual({ sessionId: 'lemmy:alice@lemmy.world', stakId: 'all' });
    // legacy keys cleared
    expect(localStorage.getItem('stakswipe_token')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/accounts.test.ts`
Expected: FAIL — module `./accounts` does not exist.

- [ ] **Step 3: Implement `accounts.ts`**

Create `src/lib/accounts.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/accounts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/accounts.ts src/lib/accounts.test.ts
git commit -m "feat(accounts): account registry persistence + legacy migration"
```

---

## Task 5: AccountsContext provider

**Files:**
- Create: `src/lib/AccountsContext.tsx`
- Test: `src/lib/AccountsContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lib/AccountsContext.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AccountsProvider, useAccounts } from './AccountsContext';
import { useBackend } from './api/context';
import { clearRegistry, registerBackend } from './api/registry';
import { createMockBackend } from './api/backends/mock';
import type { Session } from './api/types';
import { saveAccounts } from './accounts';

function mockSession(id: string, handle: string): Session {
  return { id, backendId: 'mock', viewer: { id: handle, handle, profileUrl: `https://x/u/${handle}` }, data: {} };
}

beforeEach(() => {
  localStorage.clear();
  clearRegistry();
  // every session resolves to a mock backend whose listStaks() returns all/local/subscribed
  registerBackend('mock', (s) => {
    const b = createMockBackend();
    return { ...b, session: s, listStaks: () => b.listStaks().map((st) => ({ ...st, sessionId: s.id })) };
  });
});

function Probe() {
  const { accounts, active, allStaks, setActive, addAccount, removeAccount } = useAccounts();
  const backend = useBackend();
  return (
    <div>
      <div data-testid="count">{accounts.length}</div>
      <div data-testid="active">{active ? `${active.sessionId}:${active.stakId}` : 'anon'}</div>
      <div data-testid="staks">{allStaks.map((s) => `${s.sessionId ?? 'anon'}:${s.stakId}`).join(',')}</div>
      <div data-testid="viewer">{backend.session?.viewer?.handle ?? 'none'}</div>
      <button onClick={() => addAccount(mockSession('mock:a@x', 'a@x'))}>add</button>
      <button onClick={() => setActive(null)}>anon</button>
      <button onClick={() => removeAccount('mock:a@x')}>remove</button>
    </div>
  );
}

function renderProbe() {
  return render(<AccountsProvider><Probe /></AccountsProvider>);
}

describe('AccountsContext', () => {
  it('starts anonymous with no accounts', () => {
    renderProbe();
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('active').textContent).toBe('anon');
    expect(screen.getByTestId('viewer').textContent).toBe('none');
    // anonymous entry always present
    expect(screen.getByTestId('staks').textContent).toContain('anon:anonymous');
  });

  it('adds an account, makes it active, and aggregates its staks', () => {
    renderProbe();
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('active').textContent).toBe('mock:a@x:all');
    expect(screen.getByTestId('viewer').textContent).toBe('a@x');
    const staks = screen.getByTestId('staks').textContent!;
    expect(staks).toContain('mock:a@x:all');
    expect(staks).toContain('mock:a@x:subscribed');
    expect(staks).toContain('anon:anonymous');
  });

  it('falls back to anonymous when the active account is removed', () => {
    renderProbe();
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('active').textContent).toBe('anon');
  });

  it('hydrates persisted accounts on mount', () => {
    saveAccounts([{ session: mockSession('mock:b@x', 'b@x'), addedAt: 1 }]);
    renderProbe();
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/AccountsContext.test.tsx`
Expected: FAIL — module `./AccountsContext` does not exist.

- [ ] **Step 3: Implement `AccountsContext.tsx`**

Create `src/lib/AccountsContext.tsx`:

```tsx
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
    const ref = { sessionId: session.id, stakId: 'all' };
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/AccountsContext.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/AccountsContext.tsx src/lib/AccountsContext.test.tsx
git commit -m "feat(accounts): AccountsProvider derives active backend + aggregated staks"
```

---

## Task 6: HeaderBar stak selector rework

Replace the hardcoded `STAKS` dropdown with the aggregated stak list plus Add/Manage entries. Keep `SORT_OPTIONS` and `STAKS` exports removed from `HeaderBar` consumers in later tasks.

**Files:**
- Modify: `src/components/HeaderBar.tsx`
- Modify: `src/components/HeaderBar.test.tsx` (stak-related tests)
- Test: `src/components/HeaderBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/HeaderBar.test.tsx` (new `describe` block; keep existing sort tests):

```tsx
import type { StakOption } from '../lib/AccountsContext';

const STAKS_FIXTURE: StakOption[] = [
  { sessionId: 'lemmy:alice@lemmy.world', stakId: 'all', label: 'All', icon: '🌐', handle: 'alice@lemmy.world' },
  { sessionId: 'lemmy:alice@lemmy.world', stakId: 'subscribed', label: 'Subscribed', icon: '⭐', handle: 'alice@lemmy.world' },
  { sessionId: null, stakId: 'anonymous', label: 'Anonymous', icon: '🕵️' },
];

describe('HeaderBar stak selector', () => {
  it('opens the stak list and shows staks with their handle', () => {
    renderWithBackend(
      <HeaderBar
        onMenuOpen={vi.fn()}
        staks={STAKS_FIXTURE}
        activeStakKey="lemmy:alice@lemmy.world:all"
        onStakSelect={vi.fn()}
        onAddAccount={vi.fn()}
        onManageAccounts={vi.fn()}
      />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    expect(screen.getByRole('button', { name: /All · alice@lemmy.world/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subscribed · alice@lemmy.world/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Anonymous$/i })).toBeInTheDocument();
  });

  it('calls onStakSelect with the chosen stak option', () => {
    const onStakSelect = vi.fn();
    renderWithBackend(
      <HeaderBar onMenuOpen={vi.fn()} staks={STAKS_FIXTURE} activeStakKey="anon:anonymous"
        onStakSelect={onStakSelect} onAddAccount={vi.fn()} onManageAccounts={vi.fn()} />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(screen.getByRole('button', { name: /Subscribed · alice@lemmy.world/i }));
    expect(onStakSelect).toHaveBeenCalledWith(STAKS_FIXTURE[1]);
  });

  it('shows Add account and Manage accounts entries', () => {
    const onAddAccount = vi.fn();
    const onManageAccounts = vi.fn();
    renderWithBackend(
      <HeaderBar onMenuOpen={vi.fn()} staks={STAKS_FIXTURE} activeStakKey="anon:anonymous"
        onStakSelect={vi.fn()} onAddAccount={onAddAccount} onManageAccounts={onManageAccounts} />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));
    expect(onAddAccount).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(screen.getByRole('button', { name: /manage accounts/i }));
    expect(onManageAccounts).toHaveBeenCalled();
  });
});
```

Also note: existing HeaderBar tests that pass `activeStak`/`onStakChange` (string-based) must be updated or removed in this step, since those props are being replaced. Search `HeaderBar.test.tsx` for `onStakChange` and delete those old stak-dropdown tests (the three new tests above replace them).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/HeaderBar.test.tsx`
Expected: FAIL — `staks`/`onStakSelect`/`activeStakKey` props don't exist; TS error.

- [ ] **Step 3: Rework HeaderBar**

In `src/components/HeaderBar.tsx`:

(a) Add the import at the top:

```ts
import type { StakOption } from '../lib/AccountsContext';
```

(b) Delete the `STAKS` export (lines 24-29). Replace the stak-related `Props` fields. Change the `Props` interface's `activeStak`/`onStakChange` to:

```ts
  staks?: StakOption[];
  activeStakKey?: string;          // `${sessionId ?? 'anon'}:${stakId}`
  onStakSelect?: (stak: StakOption) => void;
  onAddAccount?: () => void;
  onManageAccounts?: () => void;
```

(c) Update the function signature destructuring to replace `activeStak, onStakChange` with `staks, activeStakKey, onStakSelect, onAddAccount, onManageAccounts`.

(d) Add a helper above the return and replace `handleStakSelect`:

```ts
  const stakKeyOf = (s: StakOption) => `${s.sessionId ?? 'anon'}:${s.stakId}`;
  const activeStakLabel = staks?.find((s) => stakKeyOf(s) === activeStakKey)?.label ?? 'Anonymous';

  function handleStakSelect(stak: StakOption) {
    setShowStakDropdown(false);
    onStakSelect?.(stak);
  }
```

(e) In the logo button block, change the condition `onStakChange ?` to `staks ?`, the `aria-label` to ``Switch stak, currently ${activeStakLabel}``, and the displayed label `{activeStak ?? STAKS[0].stak}` to `{activeStakLabel}`.

(f) Replace the entire `{showStakDropdown && onStakChange && ( ... )}` block (lines ~163-196) with:

```tsx
      {showStakDropdown && staks && (
        <>
          <div
            onClick={() => setShowStakDropdown(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30,
          }}>
            {staks.map((s) => {
              const key = stakKeyOf(s);
              const active = key === activeStakKey;
              return (
                <button
                  key={key}
                  onClick={() => handleStakSelect(s)}
                  aria-label={s.handle ? `${s.label} · ${s.handle}` : s.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '12px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid #1e2128', textAlign: 'left',
                    color: active ? '#ff6b35' : '#f5f5f5',
                    fontWeight: active ? 600 : 400, fontSize: 14,
                  }}
                >
                  <span style={{ width: 16, fontSize: 13 }}>{active ? '✓' : ''}</span>
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  {s.handle && <span style={{ color: '#888', fontSize: 12 }}>· {s.handle}</span>}
                </button>
              );
            })}
            <button
              onClick={() => { setShowStakDropdown(false); onAddAccount?.(); }}
              aria-label="Add account"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderTop: '1px solid #2a2d35', borderBottom: '1px solid #1e2128',
                textAlign: 'left', color: '#f5f5f5', fontSize: 14,
              }}
            >
              <span style={{ width: 16 }} /><span>➕</span><span>Add account</span>
            </button>
            <button
              onClick={() => { setShowStakDropdown(false); onManageAccounts?.(); }}
              aria-label="Manage accounts"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                color: '#f5f5f5', fontSize: 14,
              }}
            >
              <span style={{ width: 16 }} /><span>⚙️</span><span>Manage accounts</span>
            </button>
          </div>
        </>
      )}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/HeaderBar.test.tsx`
Expected: PASS. (Build will still fail in `FeedStack`/`MenuDrawer` which import the removed `STAKS` — fixed in Task 11. Do not run full `npm run build` yet.)

- [ ] **Step 5: Commit**

```bash
git add src/components/HeaderBar.tsx src/components/HeaderBar.test.tsx
git commit -m "feat(header): aggregated stak selector with add/manage entries"
```

---

## Task 7: BackendSelectPage

**Files:**
- Create: `src/components/BackendSelectPage.tsx`
- Test: `src/components/BackendSelectPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/BackendSelectPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackendSelectPage from './BackendSelectPage';
import { clearRegistry, registerBackend } from '../lib/api/registry';
import { createMockBackend } from '../lib/api/backends/mock';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

beforeEach(() => {
  navigate.mockReset();
  clearRegistry();
  registerBackend('lemmy', () => createMockBackend(undefined, { displayName: 'Lemmy', icon: '🐭' }));
});

describe('BackendSelectPage', () => {
  it('lists registered backends by display name', () => {
    render(<MemoryRouter><BackendSelectPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /lemmy/i })).toBeInTheDocument();
  });

  it('navigates to the dynamic login route for the chosen backend', () => {
    render(<MemoryRouter><BackendSelectPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /lemmy/i }));
    expect(navigate).toHaveBeenCalledWith('/accounts/add/lemmy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/BackendSelectPage.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement BackendSelectPage**

Create `src/components/BackendSelectPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { listBackendIds, createBackend } from '../lib/api/registry';
import type { Session } from '../lib/api/types';

function anonSession(backendId: string): Session {
  return { id: `anon:${backendId}`, backendId, viewer: null, data: { instance: '', token: null } };
}

export default function BackendSelectPage() {
  const navigate = useNavigate();
  const backends = listBackendIds().map((id) => {
    const caps = createBackend(anonSession(id)).capabilities;
    return { id, name: caps.displayName, icon: caps.icon };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: 16, gap: 12 }}>
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 15, cursor: 'pointer', padding: 4 }}
      >
        ‹ Back
      </button>
      <h1 style={{ color: 'var(--text)', fontSize: 20, margin: '8px 0 4px' }}>Add account</h1>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>Choose a backend</div>
      {backends.map((b) => (
        <button
          key={b.id}
          onClick={() => navigate(`/accounts/add/${b.id}`)}
          aria-label={b.name}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '16px', cursor: 'pointer', color: 'var(--text)', fontSize: 16, fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 24 }}>{b.icon}</span>
          {b.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/BackendSelectPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BackendSelectPage.tsx src/components/BackendSelectPage.test.tsx
git commit -m "feat(accounts): backend select page"
```

---

## Task 8: DynamicLoginPage

Renders the chosen backend's `loginFields` and logs in, then stores the account via `useAccounts().addAccount`.

**Files:**
- Create: `src/components/DynamicLoginPage.tsx`
- Test: `src/components/DynamicLoginPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/DynamicLoginPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DynamicLoginPage from './DynamicLoginPage';
import { AccountsProvider } from '../lib/AccountsContext';
import { clearRegistry, registerBackend } from '../lib/api/registry';
import { createMockBackend } from '../lib/api/backends/mock';
import type { Session } from '../lib/api/types';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
  useParams: () => ({ backendId: 'lemmy' }),
}));

const loginFields = [
  { key: 'instance', label: 'Instance', type: 'instance' as const, required: true, suggestions: ['lemmy.world'] },
  { key: 'usernameOrEmail', label: 'Username or email', type: 'text' as const, required: true },
  { key: 'password', label: 'Password', type: 'password' as const, required: true },
];

const loggedInSession: Session = {
  id: 'lemmy:alice@lemmy.world', backendId: 'lemmy',
  viewer: { id: 'alice', handle: 'alice@lemmy.world', profileUrl: 'https://lemmy.world/u/alice' },
  data: { instance: 'lemmy.world', token: 'tok' },
};

let loginImpl: (creds: Record<string, string>) => Promise<Session>;

beforeEach(() => {
  localStorage.clear();
  navigate.mockReset();
  clearRegistry();
  loginImpl = vi.fn().mockResolvedValue(loggedInSession);
  registerBackend('lemmy', () => {
    const b = createMockBackend(undefined, { displayName: 'Lemmy', loginFields });
    return { ...b, auth: { ...b.auth, login: (creds: Record<string, string>) => loginImpl(creds) } };
  });
});

function renderPage() {
  return render(
    <MemoryRouter><AccountsProvider><DynamicLoginPage /></AccountsProvider></MemoryRouter>,
  );
}

describe('DynamicLoginPage', () => {
  it('renders a field per loginField', () => {
    renderPage();
    expect(screen.getByLabelText('Instance')).toBeInTheDocument();
    expect(screen.getByLabelText('Username or email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('submits collected credentials and stores the account', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Instance'), { target: { value: 'lemmy.world' } });
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(loginImpl).toHaveBeenCalledWith({ instance: 'lemmy.world', usernameOrEmail: 'alice', password: 'pw' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(JSON.parse(localStorage.getItem('stakswipe_accounts')!)[0].session.id).toBe('lemmy:alice@lemmy.world');
  });

  it('shows an error message when login fails', async () => {
    loginImpl = vi.fn().mockRejectedValue(new Error('Bad password'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Instance'), { target: { value: 'lemmy.world' } });
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText('Bad password')).toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalledWith('/');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/DynamicLoginPage.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement DynamicLoginPage**

Create `src/components/DynamicLoginPage.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createBackend } from '../lib/api/registry';
import { useAccounts } from '../lib/AccountsContext';
import type { Session } from '../lib/api/types';
import type { LoginField } from '../lib/api/capabilities';
import styles from './LoginPage.module.css';
import Logo from './Logo';
import InstanceInput from './InstanceInput';

function anonSession(backendId: string): Session {
  return { id: `anon:${backendId}`, backendId, viewer: null, data: { instance: '', token: null } };
}

export default function DynamicLoginPage() {
  const navigate = useNavigate();
  const { backendId } = useParams<{ backendId: string }>();
  const { addAccount } = useAccounts();

  const backend = useMemo(() => createBackend(anonSession(backendId!)), [backendId]);
  const fields: LoginField[] = backend.capabilities.loginFields;

  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const ready = fields.every((f) => !f.required || (values[f.key] ?? '').trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError('');
    setLoading(true);
    try {
      const session = await backend.auth.login(values);
      addAccount(session);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Logo variant="full" layout="vertical" size={44} />
      <div className={styles.tagline}>{backend.capabilities.displayName}</div>
      <form className={styles.form} onSubmit={handleSubmit}>
        {fields.map((f) => (
          <div key={f.key}>
            <div className={styles.label}>{f.label}</div>
            {f.type === 'instance' ? (
              <InstanceInput
                id={f.key}
                className={styles.input}
                placeholder={f.placeholder ?? 'instance.tld'}
                value={values[f.key] ?? ''}
                onChange={(val) => setField(f.key, val)}
              />
            ) : (
              <input
                id={f.key}
                aria-label={f.label}
                className={styles.input}
                type={f.type === 'password' ? 'password' : 'text'}
                placeholder={f.placeholder ?? f.label}
                value={values[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                autoCapitalize={f.autoCapitalize === false ? 'none' : undefined}
                autoCorrect={f.autoCapitalize === false ? 'off' : undefined}
              />
            )}
          </div>
        ))}
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit" disabled={loading || !ready}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <button
        onClick={() => navigate('/')}
        style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}
      >
        Cancel
      </button>
    </div>
  );
}
```

Note: `InstanceInput` renders an `<input>` with `id={f.key}`; the `<div className={styles.label}>` is plain text (not a `<label htmlFor>`), so the test queries the instance field via `getByLabelText('Instance')` will fail for the instance field unless we add an `aria-label`. **Add `aria-label={f.placeholder ? f.label : f.label}`** — simpler: pass `aria-label` through. Since `InstanceInput` does not accept `aria-label`, query the instance field in the test by its label text is provided via the text-input branch only. To keep the test valid, extend `InstanceInput` to forward `aria-label`:

In `src/components/InstanceInput.tsx`, add `'aria-label'?: string;` to `Props` and spread it onto the `<input>`. Then in DynamicLoginPage pass `aria-label={f.label}` to `InstanceInput`.

- [ ] **Step 4: Extend InstanceInput to forward aria-label**

In `src/components/InstanceInput.tsx`, add to `Props`:

```ts
  'aria-label'?: string;
```

and update the function to accept it (destructure `'aria-label': ariaLabel`) and add `aria-label={ariaLabel}` to the `<input>`. Then in `DynamicLoginPage.tsx`'s `InstanceInput` usage add `aria-label={f.label}`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/components/DynamicLoginPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DynamicLoginPage.tsx src/components/DynamicLoginPage.test.tsx src/components/InstanceInput.tsx
git commit -m "feat(accounts): dynamic login page driven by backend login fields"
```

---

## Task 9: AccountsPage (manage accounts)

**Files:**
- Create: `src/components/AccountsPage.tsx`
- Test: `src/components/AccountsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/AccountsPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountsPage from './AccountsPage';
import { AccountsProvider } from '../lib/AccountsContext';
import { clearRegistry, registerBackend } from '../lib/api/registry';
import { createMockBackend } from '../lib/api/backends/mock';
import { saveAccounts, saveActive } from '../lib/accounts';
import type { Session } from '../lib/api/types';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

function session(id: string, handle: string): Session {
  return { id, backendId: 'lemmy', viewer: { id: handle, handle, profileUrl: `https://x/u/${handle}` }, data: { instance: 'x', token: 't' } };
}

beforeEach(() => {
  localStorage.clear();
  navigate.mockReset();
  clearRegistry();
  registerBackend('lemmy', (s) => ({ ...createMockBackend(), session: s }));
  saveAccounts([
    { session: session('lemmy:a@x', 'a@x'), addedAt: 1 },
    { session: session('lemmy:b@x', 'b@x'), addedAt: 2 },
  ]);
  saveActive({ sessionId: 'lemmy:a@x', stakId: 'all' });
});

function renderPage() {
  return render(<MemoryRouter><AccountsProvider><AccountsPage /></AccountsProvider></MemoryRouter>);
}

describe('AccountsPage', () => {
  it('lists all accounts with an active indicator', () => {
    renderPage();
    expect(screen.getByText('a@x')).toBeInTheDocument();
    expect(screen.getByText('b@x')).toBeInTheDocument();
    expect(screen.getByTestId('active-lemmy:a@x')).toBeInTheDocument();
  });

  it('removes an account', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /remove b@x/i }));
    expect(screen.queryByText('b@x')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('stakswipe_accounts')!).map((a: { session: Session }) => a.session.id)).toEqual(['lemmy:a@x']);
  });

  it('moves an account down', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /move a@x down/i }));
    expect(JSON.parse(localStorage.getItem('stakswipe_accounts')!).map((a: { session: Session }) => a.session.id)).toEqual(['lemmy:b@x', 'lemmy:a@x']);
  });

  it('navigates to add-account flow', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));
    expect(navigate).toHaveBeenCalledWith('/accounts/add');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/AccountsPage.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement AccountsPage**

Create `src/components/AccountsPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../lib/AccountsContext';

export default function AccountsPage() {
  const navigate = useNavigate();
  const { accounts, active, removeAccount, reorderAccounts } = useAccounts();

  function move(id: string, dir: -1 | 1) {
    const ids = accounts.map((a) => a.session.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderAccounts(ids);
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '12px 14px',
  };
  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, padding: 4,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: 16, gap: 10 }}>
      <button onClick={() => navigate(-1)} aria-label="Back"
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 15, cursor: 'pointer', padding: 4 }}>
        ‹ Back
      </button>
      <h1 style={{ color: 'var(--text)', fontSize: 20, margin: '8px 0' }}>Accounts</h1>

      {accounts.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No accounts yet.</div>
      )}

      {accounts.map((a, i) => {
        const id = a.session.id;
        const handle = a.session.viewer?.handle ?? id;
        const isActive = active?.sessionId === id;
        return (
          <div key={id} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{handle}</div>
              {isActive && <div data-testid={`active-${id}`} style={{ color: 'var(--accent)', fontSize: 12 }}>Active</div>}
            </div>
            <button style={iconBtn} aria-label={`Move ${handle} up`} disabled={i === 0} onClick={() => move(id, -1)}>↑</button>
            <button style={iconBtn} aria-label={`Move ${handle} down`} disabled={i === accounts.length - 1} onClick={() => move(id, 1)}>↓</button>
            <button style={{ ...iconBtn, color: '#ff4444' }} aria-label={`Remove ${handle}`} onClick={() => removeAccount(id)}>✕</button>
          </div>
        );
      })}

      <button
        onClick={() => navigate('/accounts/add')}
        aria-label="Add account"
        style={{ marginTop: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}
      >
        ➕ Add account
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/AccountsPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AccountsPage.tsx src/components/AccountsPage.test.tsx
git commit -m "feat(accounts): manage-accounts page with remove/reorder"
```

---

## Task 10: App wiring + routes

Replace single-account `auth` state with `AccountsProvider`; add the new routes; redirect `/login`.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/main.tsx` (register backends at startup)

- [ ] **Step 1: Update main.tsx**

In `src/main.tsx`, add an import that registers backends before the app renders. After the existing imports add:

```ts
import { registerBackends } from './lib/api/backends';

registerBackends();
```

- [ ] **Step 2: Rewrite App.tsx**

Replace the whole `src/App.tsx` with:

```tsx
import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { SettingsProvider } from './lib/SettingsContext';
import { AccountsProvider } from './lib/AccountsContext';
import { useBackend } from './lib/api/context';
import type { Session } from './lib/api/types';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import DynamicLoginPage from './components/DynamicLoginPage';
import BackendSelectPage from './components/BackendSelectPage';
import AccountsPage from './components/AccountsPage';
import FeedStack from './components/FeedStack';
import InboxPage from './components/InboxPage';
import PostDetailPage from './components/PostDetailPage';
import SavedPage from './components/SavedPage';
import SavedPostDetailPage from './components/SavedPostDetailPage';
import ProfilePage from './components/ProfilePage';
import ProfilePostDetailPage from './components/ProfilePostDetailPage';
import SettingsPage from './components/SettingsPage';
import CreatePostPage from './components/CreatePostPage';
import SharedPostPage from './components/SharedPostPage';
import CommunityAboutPage from './components/CommunityAboutPage';
import SearchPage from './components/SearchPage';
import PostViewPage from './components/PostViewPage';

function RequireAuth({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session?.viewer) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CommunityFeedRoute({ unreadCount, setUnreadCount }: {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { instance, name } = useParams<{ instance: string; name: string }>();
  return (
    <FeedStack
      unreadCount={unreadCount}
      setUnreadCount={setUnreadCount}
      community={{ name: name!, instance: instance! }}
    />
  );
}

function UserProfileRoute() {
  const { instance, username } = useParams<{ instance: string; username: string }>();
  return <ProfilePage target={{ instance: instance!, username: username! }} />;
}

interface AppRoutesProps {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  notifPermission: NotificationPermission;
  setNotifPermission: React.Dispatch<React.SetStateAction<NotificationPermission>>;
}

function AppRoutes({ unreadCount, setUnreadCount, notifPermission, setNotifPermission }: AppRoutesProps) {
  const backend = useBackend();
  useNotificationPolling(backend, setUnreadCount, notifPermission);
  const session = backend.session;

  return (
    <Routes>
      <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
      <Route path="/login" element={<Navigate to="/accounts/add" replace />} />
      <Route path="/accounts" element={<AccountsPage />} />
      <Route path="/accounts/add" element={<BackendSelectPage />} />
      <Route path="/accounts/add/:backendId" element={<DynamicLoginPage />} />
      <Route
        path="/"
        element={<FeedStack unreadCount={unreadCount} setUnreadCount={setUnreadCount} />}
      />
      <Route path="/settings" element={<SettingsPage isAuthenticated={!!session?.viewer} onPermissionChange={setNotifPermission} />} />
      <Route path="/inbox" element={<RequireAuth session={session}><InboxPage setUnreadCount={setUnreadCount} unreadCount={unreadCount} /></RequireAuth>} />
      <Route path="/inbox/:notifId" element={<RequireAuth session={session}><PostDetailPage setUnreadCount={setUnreadCount} unreadCount={unreadCount} /></RequireAuth>} />
      <Route path="/saved" element={<RequireAuth session={session}><SavedPage /></RequireAuth>} />
      <Route path="/saved/:postId" element={<RequireAuth session={session}><SavedPostDetailPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth session={session}><ProfilePage /></RequireAuth>} />
      <Route path="/profile/view" element={<RequireAuth session={session}><ProfilePostDetailPage /></RequireAuth>} />
      <Route path="/create-post" element={<RequireAuth session={session}><CreatePostPage /></RequireAuth>} />
      <Route path="/community/:instance/:name" element={<RequireAuth session={session}><CommunityFeedRoute unreadCount={unreadCount} setUnreadCount={setUnreadCount} /></RequireAuth>} />
      <Route path="/community/:instance/:name/about" element={<RequireAuth session={session}><CommunityAboutPage /></RequireAuth>} />
      <Route path="/user/:instance/:username" element={<UserProfileRoute />} />
      <Route path="/search" element={<RequireAuth session={session}><SearchPage /></RequireAuth>} />
      <Route path="/view/:instance/:postId" element={<RequireAuth session={session}><PostViewPage /></RequireAuth>} />
    </Routes>
  );
}

export default function App() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  return (
    <HashRouter>
      <SettingsProvider>
        <AccountsProvider>
          <AppRoutes
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
            notifPermission={notifPermission}
            setNotifPermission={setNotifPermission}
          />
        </AccountsProvider>
      </SettingsProvider>
    </HashRouter>
  );
}
```

- [ ] **Step 3: Update App.test.tsx**

The store mock no longer needs `loadAuth`/`clearAuth`. Replace the `vi.mock('./lib/store', ...)` block so it keeps `loadSettings`/`saveSettings` and adds the account/registry functions used by `AccountsProvider`. Replace the existing store mock with:

```tsx
vi.mock('./lib/store', () => {
  const DEFAULT_SETTINGS = {
    nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: true,
    defaultFeedId: 'Active', activeStakId: 'all', lemmy: { anonInstance: '' },
  };
  return {
    loadSettings: vi.fn().mockReturnValue(DEFAULT_SETTINGS),
    saveSettings: vi.fn(),
    DEFAULT_SETTINGS,
  };
});
```

Then replace the `LoginPage` mock with `DynamicLoginPage` + add page mocks. Replace:

```tsx
vi.mock('./components/LoginPage', () => ({
  default: (_props: { onLogin: unknown }) => <div>LoginPage</div>,
}));
```

with:

```tsx
vi.mock('./components/DynamicLoginPage', () => ({ default: () => <div>DynamicLoginPage</div> }));
vi.mock('./components/BackendSelectPage', () => ({ default: () => <div>BackendSelectPage</div> }));
vi.mock('./components/AccountsPage', () => ({ default: () => <div>AccountsPage</div> }));
```

Update the `beforeEach` (remove the `loadAuth` mock manipulation) to:

```tsx
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });
```

Replace the auth-specific route tests. Change the `/login` test to expect the redirect target:

```tsx
  it('redirects /login to the add-account flow', () => {
    window.location.hash = '#/login';
    render(<App />);
    expect(screen.getByText('BackendSelectPage')).toBeInTheDocument();
  });
```

Replace the two `loadAuth.mockReturnValue({...})` "authenticated" tests with localStorage-based setup using the new account registry:

```tsx
  function seedLoggedIn() {
    localStorage.setItem('stakswipe_accounts', JSON.stringify([
      { session: { id: 'lemmy:alice@lemmy.world', backendId: 'lemmy', viewer: { id: 'alice', handle: 'alice@lemmy.world', profileUrl: 'https://lemmy.world/u/alice' }, data: { instance: 'lemmy.world', token: 'tok' } }, addedAt: 1 },
    ]));
    localStorage.setItem('stakswipe_active', JSON.stringify({ sessionId: 'lemmy:alice@lemmy.world', stakId: 'all' }));
  }

  it('shows FeedStack when authenticated', () => {
    seedLoggedIn();
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
  });

  it('renders ProfilePage at /user/:instance/:username when authenticated', async () => {
    seedLoggedIn();
    window.location.hash = '#/user/beehaw.org/bob';
    render(<App />);
    await waitFor(() => expect(screen.getByText('ProfilePage')).toBeInTheDocument());
  });

  it('renders CreatePostPage at /create-post when authenticated', async () => {
    seedLoggedIn();
    window.location.hash = '#/create-post';
    render(<App />);
    await waitFor(() => expect(screen.getByText('CreatePostPage')).toBeInTheDocument());
  });
```

And the notification-polling test becomes:

```tsx
  it('calls useNotificationPolling with the active backend', () => {
    seedLoggedIn();
    render(<App />);
    expect(useNotificationPolling).toHaveBeenCalledWith(
      expect.objectContaining({ backendId: 'lemmy' }),
      expect.any(Function),
      expect.any(String),
    );
  });
```

(The `/post/...` SharedPostPage test and the `does not render auth-gated page` test stay as-is.)

- [ ] **Step 4: Run tests**

Run: `npm test -- src/App.test.tsx`
Expected: PASS. (`FeedStack` still imports `STAKS` — App.test mocks `FeedStack`, so this test passes; the real build is fixed in Task 11.)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/main.tsx
git commit -m "feat(app): wire AccountsProvider and add-account routes"
```

---

## Task 11: FeedStack + MenuDrawer use AccountsContext

Final integration: drive stak/account from context, fix the stak-id casing, and remove the dead `STAKS`/`onLogout`/`activeStakId` paths so the build is green.

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/MenuDrawer.tsx`
- Modify: `src/components/FeedStack.test.tsx`
- Delete: `src/components/LoginPage.tsx`, `src/components/LoginPage.test.tsx`

- [ ] **Step 1: Update MenuDrawer props**

In `src/components/MenuDrawer.tsx`, replace the `activeStak`/`onStakChange` props with the new stak props and pass them through to `HeaderBar`.

Change the `Props` interface fields:

```ts
  staks?: import('../lib/AccountsContext').StakOption[];
  activeStakKey?: string;
  onStakSelect?: (stak: import('../lib/AccountsContext').StakOption) => void;
  onAddAccount?: () => void;
  onManageAccounts?: () => void;
```

Update the function destructuring (replace `activeStak, onStakChange`) and the `<HeaderBar ... />` props (replace `activeStak={activeStak} onStakChange={onStakChange}`) with:

```tsx
        staks={staks}
        activeStakKey={activeStakKey}
        onStakSelect={onStakSelect}
        onAddAccount={onAddAccount}
        onManageAccounts={onManageAccounts}
```

- [ ] **Step 2: Rewrite the stak/account wiring in FeedStack**

In `src/components/FeedStack.tsx`:

(a) Replace the import line 12 `import { SORT_OPTIONS, STAKS } from './HeaderBar';` with:

```ts
import { SORT_OPTIONS } from './HeaderBar';
import { useAccounts, type StakOption } from '../lib/AccountsContext';
import type { ActiveStakRef } from '../lib/api/types';
```

(b) Remove `onLogout` from `Props` and the function signature. Remove the now-unused `auth?` comment prop if present is fine to leave; just stop referencing `onLogout`.

(c) Replace the stak state. Delete `const [stak, setStak] = useState(...)` (line 41). After `const isLoggedIn = ...` add:

```ts
  const { active, allStaks, setActive } = useAccounts();
  const stak = active?.stakId ?? 'all';
  const stakKeyOf = (s: StakOption) => `${s.sessionId ?? 'anon'}:${s.stakId}`;
  const activeStakKey = active ? `${active.sessionId}:${active.stakId}` : 'anon:anonymous';
```

(d) Change `const isAnonymousMode = !isLoggedIn || stak === 'Anonymous';` to:

```ts
  const isAnonymousMode = active === null;
```

(e) Replace the two load effects (the `useEffect(() => { loadMore(sortType, stak, null); }, [loadMore])` block AND the `resetAndLoad` usage) so account/stak changes reload via one effect. Replace the existing effect at lines ~102-105 with:

```tsx
  useEffect(() => {
    if (community) return; // community feed loads via its own mount effect below
    setPosts([]);
    setCursor(null);
    setCanLoadMore(true);
    loadMore(sortType, stak, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, stak]);

  useEffect(() => {
    if (!community) return;
    loadMore(sortType, stak, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMore]);
```

(f) In the low-buffer pagination effect (lines ~107-113), add `stak` to the dependency array:

```tsx
  }, [posts.length, loading, canLoadMore, sortType, cursor, stak]);
```

(g) Replace `handleStakChange`:

```tsx
  function handleStakChange(option: StakOption) {
    const ref: ActiveStakRef | null = option.sessionId
      ? { sessionId: option.sessionId, stakId: option.stakId }
      : null;
    seenRef.current = new Set();
    setActive(ref); // active change → reload effect (d) fires with the new backend/stak
  }
```

(h) `handleSortChange` keeps `setSortType` + `resetAndLoad` — but since the reload effect (e) keys on `[backend, stak]` (not `sortType`), keep `resetAndLoad` for sort:

```tsx
  function handleSortChange(newSort: string) {
    setSortType(newSort);
    resetAndLoad(newSort, stak);
  }
```

(`resetAndLoad` already exists; leave it. It is now only used by `handleSortChange`.)

(i) In the error screen (line ~215), replace the logout button with anonymous fallback / login:

```tsx
        <button onClick={isLoggedIn ? () => setActive(null) : () => navigate('/accounts/add')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
          {isLoggedIn ? 'Browse anonymously' : 'Log in'}
        </button>
```

(j) In the empty-state "Switch stak" pills (lines ~239-246), replace the `STAKS` map with `allStaks`:

```tsx
            <div style={sectionLabel}>Switch stak</div>
            <div style={pillRow}>
              {allStaks.map((s) => {
                const keyActive = stakKeyOf(s) === activeStakKey;
                return (
                  <button key={stakKeyOf(s)} onClick={() => handleStakChange(s)} style={keyActive ? pillActive : pillInactive}>
                    {s.icon} {s.label}{s.handle ? ` · ${s.handle}` : ''}
                  </button>
                );
              })}
            </div>
```

(k) In the `<MenuDrawer ... />` render (lines ~287-296), replace `activeStak`/`onStakChange` props with:

```tsx
          staks={allStaks}
          activeStakKey={activeStakKey}
          onStakSelect={handleStakChange}
          onAddAccount={() => navigate('/accounts/add')}
          onManageAccounts={() => navigate('/accounts')}
```

(l) Remove the now-unused `updateSetting` from the `useSettings()` destructure if it is no longer referenced (it was only used for `activeStakId`). Verify with a grep in the file; keep `settings`.

- [ ] **Step 3: Update FeedStack.test.tsx**

`FeedStack` now requires an `AccountsProvider` ancestor (it calls `useAccounts`). The existing tests use `renderWithBackend`, which only supplies `BackendProvider`. Add a wrapper. At the top of `src/components/FeedStack.test.tsx`, after imports, add a helper and use it instead of `renderWithBackend` for FeedStack renders:

```tsx
import { AccountsProvider } from '../lib/AccountsContext';
import { clearRegistry, registerBackend } from '../lib/api/registry';
import { createMockBackend } from '../lib/api/backends/mock';

// Render FeedStack inside an AccountsProvider so useAccounts works.
function renderFeed(ui: React.ReactElement, opts?: Parameters<typeof renderWithBackend>[1]) {
  return renderWithBackend(<AccountsProvider>{ui}</AccountsProvider>, opts);
}
```

In the test file's `beforeEach`, register a mock backend so `AccountsProvider`'s `createBackend` resolves (the provider builds the active backend from the registry, separate from `renderWithBackend`'s injected one):

```tsx
beforeEach(() => {
  localStorage.clear();
  clearRegistry();
  registerBackend('lemmy', (s) => ({ ...createMockBackend(), session: s }));
});
```

Replace `renderWithBackend(<FeedStack .../>, ...)` calls with `renderFeed(<FeedStack .../>, ...)`. For tests asserting logged-in stak behavior, seed `localStorage` before render with an account + active pointer (see `seedLoggedIn` pattern in App.test). Update any assertion that referenced the old capitalized stak labels (`All`/`Subscribed`) to the new `label · handle` format, and remove assertions tied to the deleted `onLogout` prop.

> Note for the implementer: run `npm test -- src/components/FeedStack.test.tsx` and fix each failing assertion to match the new context-driven behavior. The component logic above is the source of truth; adjust test expectations (stak labels now come from `allStaks`, logout button text is now "Browse anonymously").

- [ ] **Step 4: Delete the obsolete LoginPage**

```bash
git rm src/components/LoginPage.tsx src/components/LoginPage.test.tsx
```

(`LoginPage.module.css` stays — it is reused by `DynamicLoginPage`.)

- [ ] **Step 5: Run the full suite and the build**

Run: `npm test`
Expected: PASS (all files).

Run: `npm run build`
Expected: `tsc` + `vite build` succeed with no type errors. Fix any remaining references to removed symbols (`STAKS`, `onLogout`, `activeStakId`, `loadAuth`, `saveAuth`, `clearAuth`) reported by `tsc`.

- [ ] **Step 6: Commit**

```bash
git add src/components/FeedStack.tsx src/components/MenuDrawer.tsx src/components/FeedStack.test.tsx
git commit -m "feat(feed): drive stak/account selection from AccountsContext"
```

---

## Task 12: Cleanup pass — remove dead single-account store APIs

**Files:**
- Modify: `src/lib/store.ts` (remove `saveAuth`/`loadAuth`/`clearAuth`/`AuthState` and the `activeStakId` field if unused)
- Modify: `src/lib/store.test.ts`
- Modify: `src/components/PostDetailCard.tsx` (uses `loadAuth` per grep — repoint to backend session)

- [ ] **Step 1: Check remaining consumers**

Run: `grep -rn "loadAuth\|saveAuth\|clearAuth\|AuthState\|activeStakId" src/ | grep -v node_modules`
Expected: only `src/lib/store.ts`, `src/lib/store.test.ts`, and `src/components/PostDetailCard.tsx`.

- [ ] **Step 2: Repoint PostDetailCard**

Open `src/components/PostDetailCard.tsx`, find the `loadAuth()` usage. Replace it with the backend session: add `import { useBackend } from '../lib/api/context';`, call `const backend = useBackend();`, and derive what it needed (e.g. `const viewerHandle = backend.session?.viewer?.handle`) from `backend.session` instead of `loadAuth()`. Run `npm test -- src/components/PostDetailCard.test.tsx` and adjust the test's backend fixture (via `renderWithBackend`) so the viewer is present where the old test relied on `loadAuth`.

- [ ] **Step 3: Remove dead exports from store.ts**

In `src/lib/store.ts`, delete the `KEYS` object, `AuthState` interface, and `saveAuth`/`loadAuth`/`clearAuth` functions (lines 1-29). Remove the `activeStakId` field from `AppSettings` and `DEFAULT_SETTINGS`, and the `activeStak`→`activeStakId` migration branch (lines ~93-96), since the active stak now lives in `stakswipe_active`.

- [ ] **Step 4: Update store.test.ts**

Delete the `saveAuth / loadAuth` and `clearAuth` describe blocks from `src/lib/store.test.ts` and remove `saveAuth, loadAuth, clearAuth, type AuthState` from its import. Keep the seen-history and settings tests; drop any `activeStakId` assertions.

- [ ] **Step 5: Run tests + build**

Run: `npm test`
Expected: PASS.
Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts src/components/PostDetailCard.tsx src/components/PostDetailCard.test.tsx
git commit -m "refactor: remove single-account store APIs superseded by accounts registry"
```

---

## Self-Review

**Spec coverage:**
- §1 persistence/registry/migration → Task 4 (`accounts.ts`).
- §2 backend self-description via `Capabilities` + registry → Tasks 1, 2, 3.
- §3 AccountsContext (active session/backend, `allStaks`, actions) → Task 5.
- §4 stak selector (flat `label · handle`, Anonymous, Add/Manage) → Task 6.
- §5 add-account flow (backend select → dynamic login) → Tasks 7, 8.
- §6 manage-accounts page (remove/reorder/active) → Task 9.
- §7 FeedStack refactor + lowercase stak ids → Task 11.
- §8 routing/App wiring → Task 10.
- Testing requirements → tests in every task.
- Cleanup of superseded single-account APIs → Task 12.

**Type consistency:** `StakOption` defined in Task 5 (`AccountsContext`) and consumed in Tasks 6/11; `LoginField` defined in Task 1 (`capabilities.ts`) and consumed in Task 8; `ActiveStakRef` (existing type) used in Tasks 4/5/11; `StoredAccount` defined in Task 4 and consumed in Task 5/9; registry helpers `hasBackend`/`listBackendIds` defined in Task 2 and consumed in Tasks 3/7. Session id format `lemmy:${handle}` set in Task 2, asserted in Tasks 4/8/10.

**Decisions baked in:** newly-added account becomes active at stak `all`; Anonymous = `active === null`; backend-select page kept even with one backend; stak ids standardized lowercase; duplicate account id replaces (re-login refreshes token).
