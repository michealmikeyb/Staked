# Multi-Account Support — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)

## Goal

Let a user maintain multiple logged-in accounts simultaneously and switch between
their feeds from the stak selector. The first iteration is Lemmy-only, but the
mechanism is backend-agnostic: each backend describes its own login fields so the
add-account flow can render the right form without hard-coding Lemmy specifics.

Scope (chosen): **full management** — add, switch, remove, reorder, and an explicit
active-account indicator, via a dedicated Accounts page.

## Context

The `decouple` branch already built a backend-abstraction layer that anticipated
this work:

- `Session` (`id`, `backendId`, `viewer`, `data`), `Stak` (already keyed by
  `sessionId`), and `ActiveStakRef` (`sessionId` + `stakId`) types exist in
  `src/lib/api/types.ts`.
- `Backend` exposes `capabilities`, `session`, `listStaks()`, and the service
  groups (`auth`, `feed`, …). `AuthService.login(credentials: Record<string,string>)`
  already takes generic credentials and returns a `Session`.
- `registry.ts` (`registerBackend`/`createBackend`) exists but is currently unused;
  `App.tsx` builds a single `createLemmyBackend` directly.
- Gaps that remain single-account: `HeaderBar.STAKS` (hardcoded), `FeedStack`'s
  local `stak` string, and `store.ts` `saveAuth`/`loadAuth` (flat localStorage keys,
  one account).

### Known issue to fix along the way

`getTimeline` keys off **lowercase** stak ids (`all`/`local`/`subscribed`) via
`backend.listStaks()`, but `HeaderBar.STAKS` and `FeedStack` pass **capitalized**
strings (`All`/`Local`/`Subscribed`), so `Subscribed`/`Local` silently fall through
to `All`. This rework makes `listStaks()` the single source of truth for the
selector and standardizes stak ids to lowercase, fixing the bug.

## Design

### 1. Persistence: account registry (`src/lib/accounts.ts`, new)

```ts
interface StoredAccount {
  session: Session;   // see stable-id note below
  addedAt: number;
}
```

- **`Session.id` is a stable account key** `${backendId}:${handle}`
  (e.g. `lemmy:alice@lemmy.world`), **not** the JWT — the token rotates on
  re-login, but staks and the active pointer must reference a stable id.
- `localStorage['stakswipe_accounts']` = `StoredAccount[]`; array order is the
  display / reorder order.
- `localStorage['stakswipe_active']` = `ActiveStakRef | null` (`null` = Anonymous).
- Functions: `loadAccounts`, `saveAccounts`, `addAccount`, `removeAccount`,
  `reorderAccounts`, `loadActive`, `saveActive`.
- **Migration on load:** if legacy `stakswipe_token` / `stakswipe_instance` /
  `stakswipe_username` exist and `stakswipe_accounts` does not, fold them into one
  `StoredAccount`, set it active at stak `all`, then clear the legacy keys.
  `settings.activeStakId` is superseded by `stakswipe_active` and migrated/ignored.

### 2. Backend self-description (extend `Capabilities` + `registry.ts`)

No separate descriptor object. The backend describes itself through its existing
`capabilities` property. Extend `Capabilities` (`src/lib/api/capabilities.ts`):

```ts
interface LoginField {
  key: string;                            // credential key passed to auth.login
  label: string;
  type: 'instance' | 'text' | 'password'; // 'instance' reuses InstanceInput
  required: boolean;
  placeholder?: string;
  suggestions?: string[];                 // e.g. popular instances
  autoCapitalize?: boolean;
}

interface Capabilities {
  // …existing fields…
  displayName: string;   // e.g. 'Lemmy'
  icon?: string;
  loginFields: LoginField[];
}
```

Lemmy's `loginFields`: `instance` (type `instance`, `suggestions` = popular list),
`usernameOrEmail` (text), `password` (password). The Lemmy backend module owns this
schema.

`registry.ts`: keep `registerBackend(backendId, factory)` and `createBackend(session)`;
add `listBackendIds(): string[]`. Registration is bootstrapped once at startup
(e.g. `src/lib/api/backends/index.ts`, imported by `main.tsx`/`App`).

Because display info and login fields live on `capabilities`, the add-account
pages get them by constructing an **anon backend** for a backend id
(`createBackend(anonSession(backendId))`) and reading `.capabilities`. The same
anon backend's `.auth.login(credentials)` performs the login.

### 3. AccountsContext (`src/lib/AccountsContext.tsx`, new)

- Owns `accounts` and `active`; derives the **current `Session`** (the active
  account's session, or an anon session when `active === null`) and builds the
  active `Backend` via `createBackend`, provided through the existing
  `BackendProvider` (so all existing components keep using `useBackend()`).
- Exposes `allStaks`: aggregated across accounts. For each account, build its
  backend and call `listStaks()`, mapping to
  `{ sessionId, stakId, label, icon, handle }`, plus a synthetic Anonymous entry
  (`sessionId: null`).
- Actions:
  - `setActive(ref | null)` — switch active account/stak (or Anonymous).
  - `addAccount(session)` — append + make active at its default stak.
  - `removeAccount(sessionId)` — if it was active, fall back to Anonymous (or the
    first remaining account).
  - `reorderAccounts(orderedIds)`.
- Persists `accounts` and `active` on every change.

### 4. Stak selector (`HeaderBar`)

- Replace hardcoded `STAKS` with `allStaks` from context: a flat list rendering
  `label · handle` per row, an Anonymous row, a divider, then **"➕ Add account"**
  (shown both logged-in and logged-out) and **"⚙️ Manage accounts"**.
- Active row shows ✓. Selecting a stak → `setActive(...)`. The logo area shows the
  active account/stak label.
- "Add account" → navigate `/accounts/add`; "Manage accounts" → `/accounts`.

### 5. Add-account flow

- `/accounts/add` → **BackendSelectPage**: one card per `listBackendIds()` (just
  Lemmy today), each showing `capabilities.displayName`/`icon`. Pick →
  `/accounts/add/:backendId`. (Page is kept even with a single backend — it is the
  extensibility seam.)
- `/accounts/add/:backendId` → **DynamicLoginPage**: build an anon backend for the
  id, render `capabilities.loginFields` (reusing `InstanceInput` for
  `type:'instance'`), collect a `Record<string,string>` of credentials, call
  `auth.login(credentials)` → `Session` → `addAccount(session)` → navigate `/`
  (new account active).
- Old `/login` route redirects into this flow. "Continue without account" sets
  `active = null` and navigates `/`.

### 6. Accounts management page (`/accounts`, new)

- Lists accounts in order: handle, backend icon, active indicator, a remove
  action, and reorder controls (up/down buttons — mobile-friendly), plus an
  "Add account" button. Reachable from the stak selector and from Settings.
- Remove → `removeAccount`; if the active account is removed, fall back to
  Anonymous.

### 7. FeedStack refactor

- Drop the local `stak` string and `settings.activeStakId`; read the active
  account/stak from AccountsContext. `isAnonymousMode` = `active === null`.
- An account switch changes the backend (different session) → existing
  load-on-backend-change path reloads the feed.
- Empty-state "Switch stak" pills use `allStaks` (the active account's staks).
- Stak ids standardized to lowercase (`all`/`local`/`subscribed`), consistent with
  `listStaks()`/`getTimeline`.

### 8. Routing & App wiring

- `App.tsx`: replace single `auth` state with `AccountsProvider`; the provider
  supplies the active `Backend` to `BackendProvider`. `onLogin`/`onLogout` are
  replaced by context actions.
- New routes: `/accounts`, `/accounts/add`, `/accounts/add/:backendId`. `/login`
  redirects to `/accounts/add`.

## Data flow

1. App start → `AccountsProvider` loads accounts + active (running migration if
   needed) → builds active backend → renders.
2. User opens stak selector → sees `allStaks` (per-account) + Anonymous + Add/Manage.
3. Add account → backend select → dynamic login → `auth.login` → `addAccount` →
   becomes active → feed reloads as that account.
4. Switch stak/account → `setActive` → active backend rebuilt → feed reloads.
5. Remove account on `/accounts` → `removeAccount` → falls back if it was active.

## Error handling

- Login failure: DynamicLoginPage shows the thrown error message inline (as the
  current LoginPage does); no account is stored.
- Duplicate account (same `${backendId}:${handle}`): `addAccount` replaces the
  existing record's session (re-login refreshes the token) rather than adding a
  duplicate row.
- Corrupt/oversized storage: loaders fail safe to an empty account list +
  Anonymous active (mirrors existing `loadSettings`/`loadSeen` try/catch pattern).
- Removing the last/active account: fall back to Anonymous so the app always has a
  valid session to render.

## Testing

Vitest + jsdom, following existing patterns and required mocks.

- `accounts.ts`: CRUD, stable-id keying, duplicate replacement, legacy migration,
  active-fallback on remove, fail-safe loaders.
- `registry.ts`: register/list/create, anon-backend creation per id.
- Lemmy `capabilities`: exposes `displayName` + `loginFields`.
- `BackendSelectPage`: lists registered backends from capabilities.
- `DynamicLoginPage`: renders fields from `loginFields`, submits credentials,
  surfaces login error, calls `addAccount` on success.
- `AccountsPage`: list, remove, reorder, active indicator.
- `HeaderBar`: aggregated `allStaks` rendering, Add/Manage entries shown
  logged-in and logged-out, active ✓.
- `FeedStack`: account switch triggers reload; Anonymous mode disables voting.

## Out of scope

- Non-Lemmy backends (the seam is built; no second backend implemented).
- Cross-account unified/merged feeds (one active account at a time).
- Per-account notification badges/aggregation (badge follows the active account).
- Drag-and-drop reorder (up/down buttons suffice for v1).
```
