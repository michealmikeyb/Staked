# Anonymous Stak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anonymous browsing as the default experience when logged out and as a stak option when logged in — fetching from the top-ranked Lemmy instance per sort type, with swipes that dismiss only (no voting).

**Architecture:** `auth` becomes nullable in FeedStack; a new `instanceRankings.ts` maps sort types to top-ranked public instances; FeedStack uses the ranked instance (or a user-configured override) and skips vote calls when `auth === null` or `stak === 'Anonymous'`. The login gate in App.tsx is replaced with a `/login` route; the anonymous feed is the root default.

**Tech Stack:** React 18, TypeScript, React Router v6 (HashRouter), Vitest + @testing-library/react, localStorage via existing `loadSettings`/`saveSettings`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/instanceRankings.ts` | Static sort→instance lookup from rankings data |
| Create | `src/lib/instanceRankings.test.ts` | Tests for getAnonInstance |
| Create | `src/components/InstanceInput.tsx` | Shared instance text input |
| Create | `src/components/InstanceInput.test.tsx` | Tests for InstanceInput |
| Modify | `src/lib/store.ts` | Add `anonInstance: string` to AppSettings |
| Modify | `src/lib/store.test.ts` | Cover anonInstance default |
| Modify | `src/lib/lemmy.ts` | Extend StakType to include `'Anonymous'` |
| Modify | `src/components/HeaderBar.tsx` | Add Anonymous to STAKS array |
| Modify | `src/components/HeaderBar.test.tsx` | Test Anonymous option renders |
| Modify | `src/components/MenuDrawer.tsx` | Add `isAuthenticated` prop; show Login when false |
| Modify | `src/components/MenuDrawer.test.tsx` | Test unauthenticated menu |
| Modify | `src/components/FeedStack.tsx` | auth nullable; anonymous instance/vote logic |
| Modify | `src/components/FeedStack.test.tsx` | Anonymous mode tests |
| Modify | `src/components/LoginPage.tsx` | Use InstanceInput; add "Continue without account" |
| Modify | `src/components/LoginPage.test.tsx` | Test skip link |
| Modify | `src/components/CreatePostPage.tsx` | Use InstanceInput for community field |
| Modify | `src/components/CreatePostPage.test.tsx` | Update for InstanceInput |
| Modify | `src/components/SettingsPage.tsx` | Add Anonymous Feed section with InstanceInput |
| Modify | `src/components/SettingsPage.test.tsx` | Test anonInstance setting |
| Modify | `src/App.tsx` | Remove AuthGate; add /login route; restructure |
| Modify | `src/App.test.tsx` | Update routing tests |

---

## Task 1: instanceRankings utility

**Files:**
- Create: `src/lib/instanceRankings.ts`
- Create: `src/lib/instanceRankings.test.ts`

Top instance per sort (from `scripts/instance-rankings.json` as of 2026-04-11):
- Active → reddthat.com, Hot → lemmy.blahaj.zone, New → reddthat.com, TopSixHour → reddthat.com, TopTwelveHour → reddthat.com, TopDay → reddthat.com

- [ ] **Write the failing test**

```ts
// src/lib/instanceRankings.test.ts
import { describe, it, expect } from 'vitest';
import { getAnonInstance } from './instanceRankings';

describe('getAnonInstance', () => {
  it('returns reddthat.com for Active', () => {
    expect(getAnonInstance('Active')).toBe('reddthat.com');
  });

  it('returns lemmy.blahaj.zone for Hot', () => {
    expect(getAnonInstance('Hot')).toBe('lemmy.blahaj.zone');
  });

  it('returns a non-empty string for every SortType', () => {
    const sorts = ['Active', 'Hot', 'New', 'TopSixHour', 'TopTwelveHour', 'TopDay'] as const;
    for (const sort of sorts) {
      expect(getAnonInstance(sort).length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
cd /home/mikey/Development/Staked && npm test -- instanceRankings
```
Expected: FAIL with "Cannot find module"

- [ ] **Write the implementation**

```ts
// src/lib/instanceRankings.ts
import type { SortType } from './lemmy';

const RANKINGS: Record<string, string> = {
  Active: 'reddthat.com',
  Hot: 'lemmy.blahaj.zone',
  New: 'reddthat.com',
  TopSixHour: 'reddthat.com',
  TopTwelveHour: 'reddthat.com',
  TopDay: 'reddthat.com',
};

export function getAnonInstance(sort: SortType): string {
  return RANKINGS[sort] ?? 'lemmy.world';
}
```

- [ ] **Run test to confirm it passes**

```bash
npm test -- instanceRankings
```
Expected: PASS (3 tests)

- [ ] **Commit**

```bash
git add src/lib/instanceRankings.ts src/lib/instanceRankings.test.ts
git commit -m "feat: add instanceRankings utility for anonymous feed"
```

---

## Task 2: InstanceInput shared component

**Files:**
- Create: `src/components/InstanceInput.tsx`
- Create: `src/components/InstanceInput.test.tsx`

A plain text input with optional `className` (for CSS-module consumers like LoginPage) and optional `style` (for inline-style consumers like SettingsPage and CreatePostPage). Always sets `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`.

- [ ] **Write the failing test**

```tsx
// src/components/InstanceInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstanceInput from './InstanceInput';

describe('InstanceInput', () => {
  it('renders with placeholder text', () => {
    render(<InstanceInput value="" onChange={() => {}} placeholder="my.instance.tld" />);
    expect(screen.getByPlaceholderText('my.instance.tld')).toBeInTheDocument();
  });

  it('shows the current value', () => {
    render(<InstanceInput value="lemmy.world" onChange={() => {}} />);
    expect(screen.getByDisplayValue('lemmy.world')).toBeInTheDocument();
  });

  it('calls onChange with the new value when typed', () => {
    const handleChange = vi.fn();
    render(<InstanceInput value="" onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'sh.itjust.works' } });
    expect(handleChange).toHaveBeenCalledWith('sh.itjust.works');
  });

  it('applies a provided className', () => {
    render(<InstanceInput value="" onChange={() => {}} className="my-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('my-class');
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
npm test -- InstanceInput
```
Expected: FAIL with "Cannot find module"

- [ ] **Write the implementation**

```tsx
// src/components/InstanceInput.tsx
interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function InstanceInput({
  value,
  onChange,
  placeholder = 'instance.tld',
  id,
  className,
  style,
}: Props) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className={className}
      style={style}
    />
  );
}
```

- [ ] **Run test to confirm it passes**

```bash
npm test -- InstanceInput
```
Expected: PASS (4 tests)

- [ ] **Commit**

```bash
git add src/components/InstanceInput.tsx src/components/InstanceInput.test.tsx
git commit -m "feat: add InstanceInput shared component"
```

---

## Task 3: Add anonInstance to AppSettings

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.ts`

- [ ] **Write the failing test**

Add to `src/lib/store.test.ts` (find the existing settings tests and add after them):

```ts
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
  localStorage.setItem('stakswipe_settings', JSON.stringify({ leftSwipe: 'dismiss' }));
  const settings = loadSettings();
  expect(settings.anonInstance).toBe('');
});
```

- [ ] **Run test to confirm it fails**

```bash
npm test -- store
```
Expected: FAIL — `settings.anonInstance` is `undefined`

- [ ] **Update `store.ts`**

In `src/lib/store.ts`, update the `AppSettings` interface and `DEFAULT_SETTINGS`:

```ts
export interface AppSettings {
  leftSwipe: 'downvote' | 'dismiss';
  blurNsfw: boolean;
  defaultSort: SortType;
  activeStak: StakType;
  anonInstance: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  leftSwipe: 'downvote',
  blurNsfw: true,
  defaultSort: 'TopTwelveHour',
  activeStak: 'All',
  anonInstance: '',
};
```

(`loadSettings` already spreads `DEFAULT_SETTINGS` over stored JSON, so old stored settings without `anonInstance` automatically get `''`.)

- [ ] **Run test to confirm it passes**

```bash
npm test -- store
```
Expected: all store tests pass

- [ ] **Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: add anonInstance to AppSettings"
```

---

## Task 4: Extend StakType and add Anonymous to STAKS

**Files:**
- Modify: `src/lib/lemmy.ts` (line 5)
- Modify: `src/components/HeaderBar.tsx` (STAKS array)
- Modify: `src/components/HeaderBar.test.tsx`

- [ ] **Write the failing test**

Add to `src/components/HeaderBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeaderBar from './HeaderBar';

// Add this test inside an existing or new describe block:
describe('HeaderBar stak selector', () => {
  it('shows Anonymous option in the stak dropdown', () => {
    render(
      <HeaderBar
        onMenuOpen={() => {}}
        activeStak="All"
        onStakChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    expect(screen.getByRole('button', { name: /anonymous/i })).toBeInTheDocument();
  });

  it('does not render stak selector when onStakChange is not provided', () => {
    render(<HeaderBar onMenuOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: /switch stak/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
npm test -- HeaderBar
```
Expected: FAIL — "Anonymous" option not found

- [ ] **Update `lemmy.ts` StakType**

Change line 5 in `src/lib/lemmy.ts`:

```ts
export type StakType = 'All' | 'Local' | 'Subscribed' | 'Anonymous';
```

- [ ] **Update `HeaderBar.tsx` STAKS array**

In `src/components/HeaderBar.tsx`, update the STAKS constant:

```ts
export const STAKS: { stak: StakType; label: string; icon: string }[] = [
  { stak: 'All', label: 'All', icon: '🌐' },
  { stak: 'Local', label: 'Local', icon: '🏠' },
  { stak: 'Subscribed', label: 'Subscribed', icon: '⭐' },
  { stak: 'Anonymous', label: 'Anonymous', icon: '🕵️' },
];
```

- [ ] **Run test to confirm it passes**

```bash
npm test -- HeaderBar
```
Expected: all HeaderBar tests pass

- [ ] **Commit**

```bash
git add src/lib/lemmy.ts src/components/HeaderBar.tsx src/components/HeaderBar.test.tsx
git commit -m "feat: add Anonymous to StakType and stak selector"
```

---

## Task 5: MenuDrawer unauthenticated mode

**Files:**
- Modify: `src/components/MenuDrawer.tsx`
- Modify: `src/components/MenuDrawer.test.tsx`

When `isAuthenticated` is false, the drawer shows Login, Settings, and Search only (no Saved, Profile, Inbox, Post).

- [ ] **Write the failing tests**

Add to `src/components/MenuDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuDrawer from './MenuDrawer';

describe('MenuDrawer unauthenticated', () => {
  function renderUnauth(onNavigate = vi.fn()) {
    render(
      <MenuDrawer onNavigate={onNavigate} isAuthenticated={false} />
    );
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  }

  it('shows Login button when not authenticated', () => {
    renderUnauth();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows Settings button when not authenticated', () => {
    renderUnauth();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('shows Search button when not authenticated', () => {
    renderUnauth();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('hides Saved, Profile, Inbox, Post when not authenticated', () => {
    renderUnauth();
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /inbox/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^post$/i })).not.toBeInTheDocument();
  });

  it('navigates to /login when Login button is clicked', () => {
    const onNavigate = vi.fn();
    renderUnauth(onNavigate);
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(onNavigate).toHaveBeenCalledWith('/login');
  });
});
```

- [ ] **Run test to confirm it fails**

```bash
npm test -- MenuDrawer
```
Expected: FAIL — `isAuthenticated` prop not recognized

- [ ] **Update `MenuDrawer.tsx`**

Add `isAuthenticated?: boolean` (default `true`) to the Props interface and the function signature. Conditionally render buttons based on it:

```tsx
interface Props {
  onNavigate: (route: string) => void;
  centerContent?: React.ReactNode;
  onLogoClick?: () => void;
  leftContent?: React.ReactNode;
  sortType?: SortType;
  onSortChange?: (sort: SortType) => void;
  unreadCount?: number;
  activeStak?: StakType;
  onStakChange?: (stak: StakType) => void;
  isAuthenticated?: boolean;
}

export default function MenuDrawer({
  onNavigate,
  centerContent,
  onLogoClick,
  leftContent,
  sortType,
  onSortChange,
  unreadCount = 0,
  activeStak,
  onStakChange,
  isAuthenticated = true,
}: Props) {
  const [showDrawer, setShowDrawer] = useState(false);

  function handleNavigate(route: string) {
    setShowDrawer(false);
    onNavigate(route);
  }

  const drawerButtonStyle: React.CSSProperties = {
    background: '#2a2d35', border: 'none', borderRadius: 12,
    cursor: 'pointer', padding: '14px 8px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    color: '#f5f5f5', fontSize: 12, fontWeight: 500,
    position: 'relative',
  };

  const iconStyle: React.CSSProperties = { fontSize: 22 };

  return (
    <>
      <HeaderBar
        sortType={sortType}
        onSortChange={onSortChange}
        onMenuOpen={() => setShowDrawer((v) => !v)}
        onLogoClick={onLogoClick}
        centerContent={centerContent}
        leftContent={leftContent}
        activeStak={activeStak}
        onStakChange={onStakChange}
      />
      {showDrawer && (
        <>
          <div
            data-testid="drawer-overlay"
            onClick={() => setShowDrawer(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '1px solid #2a2d35',
            zIndex: 40, padding: 16,
          }}>
            {isAuthenticated ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <button onClick={() => handleNavigate('/saved')} aria-label="Saved" style={drawerButtonStyle}>
                  <span style={iconStyle}>🔖</span>Saved
                </button>
                <button onClick={() => handleNavigate('/profile')} aria-label="Profile" style={drawerButtonStyle}>
                  <span style={iconStyle}>👤</span>Profile
                </button>
                <button onClick={() => handleNavigate('/inbox')} aria-label="Inbox" style={drawerButtonStyle}>
                  {unreadCount > 0 && (
                    <span
                      data-testid="inbox-badge"
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        background: '#ff6b35', color: '#fff',
                        borderRadius: '50%', minWidth: 18, height: 18,
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px',
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                  <span style={iconStyle}>📬</span>Inbox
                </button>
                <button onClick={() => handleNavigate('/settings')} aria-label="Settings" style={drawerButtonStyle}>
                  <span style={iconStyle}>⚙️</span>Settings
                </button>
                <button onClick={() => handleNavigate('/create-post')} aria-label="Post" style={drawerButtonStyle}>
                  <span style={iconStyle}>✏️</span>Post
                </button>
                <button onClick={() => handleNavigate('/search')} aria-label="Search" style={drawerButtonStyle}>
                  <span style={iconStyle}>🔍</span>Search
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <button onClick={() => handleNavigate('/login')} aria-label="Login" style={drawerButtonStyle}>
                  <span style={iconStyle}>🔑</span>Login
                </button>
                <button onClick={() => handleNavigate('/settings')} aria-label="Settings" style={drawerButtonStyle}>
                  <span style={iconStyle}>⚙️</span>Settings
                </button>
                <button onClick={() => handleNavigate('/search')} aria-label="Search" style={drawerButtonStyle}>
                  <span style={iconStyle}>🔍</span>Search
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Run test to confirm it passes**

```bash
npm test -- MenuDrawer
```
Expected: all MenuDrawer tests pass

- [ ] **Commit**

```bash
git add src/components/MenuDrawer.tsx src/components/MenuDrawer.test.tsx
git commit -m "feat: add isAuthenticated prop to MenuDrawer"
```

---

## Task 6: FeedStack — anonymous mode

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

Key changes:
- `auth: AuthState | null`
- `onLogout?: () => void` (optional — no logout when unauthenticated)
- `isAnonymousMode = auth === null || stak === 'Anonymous'`
- When `isAnonymousMode`: use `settings.anonInstance || getAnonInstance(sort)` as instance, `''` as token, `'All'` as API stak, skip vote calls
- When `auth === null`: don't pass `onStakChange` to MenuDrawer (hides stak selector); pass `isAuthenticated={false}`
- When `auth === null`: initialize `stak` as `'All'` regardless of stored activeStak (Subscribed/Local don't work without auth)
- Empty state: show "Log in" button (navigate to `/login`) when `auth === null`; "Log out" when auth present
- Unread count fetch: skipped when `auth === null`

- [ ] **Write the failing tests**

Add a new describe block at the end of `src/components/FeedStack.test.tsx`:

```tsx
describe('FeedStack anonymous mode (auth === null)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders posts when auth is null using the ranked instance', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        post: { id: 1, name: 'Anon Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://reddthat.com/post/1' },
        community: { name: 'technology', actor_id: 'https://reddthat.com/c/technology' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
    ]);

    render(
      <SettingsProvider>
        <FeedStack auth={null} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />
      </SettingsProvider>,
    );

    await screen.findByText('Anon Post');
    // TopTwelveHour → reddthat.com per rankings
    expect(fetchPosts).toHaveBeenCalledWith('reddthat.com', '', 1, 'TopTwelveHour', 'All');
  });

  it('uses anonInstance setting when set', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ anonInstance: 'lemmy.ml' }));
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        post: { id: 1, name: 'ML Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.ml/post/1' },
        community: { name: 'tech', actor_id: 'https://lemmy.ml/c/tech' },
        creator: { name: 'alice' },
        counts: { score: 5, comments: 0 },
      },
    ]);

    render(
      <SettingsProvider>
        <FeedStack auth={null} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />
      </SettingsProvider>,
    );

    await screen.findByText('ML Post');
    expect(fetchPosts).toHaveBeenCalledWith('lemmy.ml', '', 1, 'TopTwelveHour', 'All');
  });

  it('does not call upvotePost on ArrowRight when auth is null', async () => {
    const { fetchPosts, upvotePost } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        post: { id: 1, name: 'Anon Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://reddthat.com/post/1' },
        community: { name: 'tech', actor_id: 'https://reddthat.com/c/tech' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
    ]).mockResolvedValue([]);

    render(
      <SettingsProvider>
        <FeedStack auth={null} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />
      </SettingsProvider>,
    );

    await screen.findByText('Anon Post');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(upvotePost).not.toHaveBeenCalled();
  });

  it('does not call downvotePost on ArrowLeft when auth is null', async () => {
    const { fetchPosts, downvotePost } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        post: { id: 1, name: 'Anon Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://reddthat.com/post/1' },
        community: { name: 'tech', actor_id: 'https://reddthat.com/c/tech' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
    ]).mockResolvedValue([]);

    render(
      <SettingsProvider>
        <FeedStack auth={null} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />
      </SettingsProvider>,
    );

    await screen.findByText('Anon Post');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(downvotePost).not.toHaveBeenCalled();
  });

  it('shows Log in button in empty state when auth is null', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(
      <SettingsProvider>
        <FeedStack auth={null} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />
      </SettingsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });
  });

  it('does not fetch unread count when auth is null', async () => {
    const { fetchPosts, fetchUnreadCount } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(
      <SettingsProvider>
        <FeedStack auth={null} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />
      </SettingsProvider>,
    );

    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(fetchUnreadCount).not.toHaveBeenCalled();
  });
});

describe('FeedStack Anonymous stak (logged in)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('fetches from ranked instance when stak is Anonymous', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ activeStak: 'Anonymous' }));
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        post: { id: 1, name: 'Anon Stak Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://reddthat.com/post/1' },
        community: { name: 'tech', actor_id: 'https://reddthat.com/c/tech' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
    ]);

    render(
      <SettingsProvider>
        <FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />
      </SettingsProvider>,
    );

    await screen.findByText('Anon Stak Post');
    expect(fetchPosts).toHaveBeenCalledWith('reddthat.com', '', 1, 'TopTwelveHour', 'All');
  });

  it('does not call upvotePost on ArrowRight when stak is Anonymous', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ activeStak: 'Anonymous' }));
    const { fetchPosts, upvotePost } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        post: { id: 1, name: 'Anon Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://reddthat.com/post/1' },
        community: { name: 'tech', actor_id: 'https://reddthat.com/c/tech' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
    ]).mockResolvedValue([]);

    render(
      <SettingsProvider>
        <FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />
      </SettingsProvider>,
    );

    await screen.findByText('Anon Post');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(upvotePost).not.toHaveBeenCalled();
  });
});
```

Also add this mock near the top of the file (alongside the existing `vi.mock('../lib/lemmy', ...)` block):

```ts
vi.mock('../lib/instanceRankings', () => ({
  getAnonInstance: vi.fn().mockReturnValue('reddthat.com'),
}));
```

- [ ] **Run test to confirm it fails**

```bash
npm test -- FeedStack
```
Expected: new tests FAIL

- [ ] **Update `FeedStack.tsx`**

Replace the entire file with the following. The key differences from the current file are: `auth: AuthState | null`, `onLogout?: () => void`, anonymous mode logic in `loadMore`, swipe handlers, keyboard handler, and the render:

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchPosts, fetchCommunityPosts, fetchUnreadCount,
  upvotePost, downvotePost, fetchCommunityInfo, followCommunity,
  type PostView, type SortType, type StakType, type CommunityInfo,
} from '../lib/lemmy';
import { type AuthState, loadSeen, addSeen, clearSeen } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';
import { getAnonInstance } from '../lib/instanceRankings';
import PostCard from './PostCard';
import SwipeHint from './SwipeHint';
import MenuDrawer from './MenuDrawer';
import CommunityHeader from './CommunityHeader';

interface Props {
  auth: AuthState | null;
  onLogout?: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  community?: { name: string; instance: string };
}

const STACK_VISIBLE = 3;
const screenStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', height: '100dvh', gap: 16,
};

export default function FeedStack({ auth, onLogout, unreadCount, setUnreadCount, community }: Props) {
  const navigate = useNavigate();
  const { settings, updateSetting } = useSettings();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [undoStack, setUndoStack] = useState<PostView[]>([]);
  const [returningPostId, setReturningPostId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const seenRef = useRef<Set<number>>(community ? new Set() : loadSeen());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [sortType, setSortType] = useState<SortType>(community ? 'Active' : settings.defaultSort);
  const [stak, setStak] = useState<StakType>(() => {
    if (!auth) return 'All';
    return settings.activeStak;
  });
  const [communityInfo, setCommunityInfo] = useState<CommunityInfo | null>(null);

  const isAnonymousMode = auth === null || stak === 'Anonymous';

  function effectiveInstance(sort: SortType): string {
    if (!isAnonymousMode) return auth!.instance;
    return settings.anonInstance || getAnonInstance(sort);
  }

  function effectiveToken(): string {
    return isAnonymousMode ? '' : auth!.token;
  }

  useEffect(() => {
    if (community || auth === null) return;
    fetchUnreadCount(auth.instance, auth.token)
      .then(setUnreadCount)
      .catch(() => {});
  }, [auth, setUnreadCount, community]);

  useEffect(() => {
    if (!community || !auth) return;
    fetchCommunityInfo(auth.instance, auth.token, `${community.name}@${community.instance}`)
      .then(setCommunityInfo)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async (nextPage: number, sort: SortType, currentStak: StakType) => {
    const isAnon = auth === null || currentStak === 'Anonymous';
    const instance = isAnon
      ? (settings.anonInstance || getAnonInstance(sort))
      : auth!.instance;
    const token = isAnon ? '' : auth!.token;
    const apiStak: 'All' | 'Local' | 'Subscribed' = currentStak === 'Anonymous' ? 'All' : (currentStak as 'All' | 'Local' | 'Subscribed');

    setLoading(true);
    try {
      const newPosts = community
        ? await fetchCommunityPosts(instance, token, `${community.name}@${community.instance}`, nextPage, sort)
        : await fetchPosts(instance, token, nextPage, sort, apiStak);
      if (newPosts.length === 0) {
        setCanLoadMore(false);
      } else {
        const unseen = newPosts.filter((p) => !seenRef.current.has(p.post.id));
        setPosts((prev) => [...prev, ...unseen]);
      }
    } catch (err) {
      setCanLoadMore(false);
      if (nextPage === 1) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, settings.anonInstance, community?.name, community?.instance]);

  useEffect(() => {
    loadMore(1, sortType, stak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMore]);

  useEffect(() => {
    if (posts.length <= 3 && !loading && canLoadMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMore(nextPage, sortType, stak);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length, loading, page, loadMore, canLoadMore, sortType]);

  function resetAndLoad(sort: SortType, newStak: StakType) {
    setPosts([]);
    setPage(1);
    setCanLoadMore(true);
    loadMore(1, sort, newStak);
  }

  async function handleSubscribeToggle() {
    if (!communityInfo || !auth) return;
    const follow = communityInfo.subscribed !== 'Subscribed';
    const previous = communityInfo;
    setCommunityInfo({ ...communityInfo, subscribed: follow ? 'Subscribed' : 'NotSubscribed' });
    try {
      await followCommunity(auth.instance, auth.token, communityInfo.id, follow);
    } catch {
      setCommunityInfo(previous);
    }
  }

  function handleSortChange(newSort: SortType) {
    setSortType(newSort);
    resetAndLoad(newSort, stak);
  }

  function handleStakChange(newStak: StakType) {
    updateSetting('activeStak', newStak);
    setStak(newStak);
    seenRef.current = new Set();
    resetAndLoad(sortType, newStak);
  }

  function dismissTop(postId: number) {
    const topPost = posts[0];
    if (topPost) setUndoStack((stack) => [...stack, topPost]);
    setPosts((prev) => prev.slice(1));
    if (returningPostId !== null) setReturningPostId(null);
    if (!community) addSeen(postId);
    seenRef.current.add(postId);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const post = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setPosts((prev) => [post, ...prev]);
    setReturningPostId(post.post.id);
  }

  useEffect(() => {
    const topPost = posts[0];
    if (!topPost) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        if (!isAnonymousMode && auth) {
          upvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        }
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowLeft') {
        if (!isAnonymousMode && auth && settings.leftSwipe === 'downvote') {
          downvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        }
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowDown') {
        handleUndo();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, auth, settings, isAnonymousMode]);

  if (loading && posts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={screenStyle}>
        <div style={{ color: '#ff4444' }}>{error}</div>
        {auth ? (
          <button
            onClick={onLogout}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
          >
            Log out
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
          >
            Log in
          </button>
        )}
      </div>
    );
  }

  if (posts.length === 0 && !loading && !canLoadMore) {
    return (
      <div style={screenStyle}>
        {stak === 'Subscribed' ? (
          <>
            <div style={{ fontSize: 32 }}>⭐</div>
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 280, padding: '0 16px' }}>
              No subscriptions yet. Browse communities and subscribe to see their posts here.
            </div>
          </>
        ) : (
          <>
            <div style={{ color: 'var(--text-secondary)' }}>You've seen everything!</div>
            {!community && (
              <button
                onClick={() => { clearSeen(); window.location.reload(); }}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
              >
                Reset seen history
              </button>
            )}
          </>
        )}
        {auth ? (
          <button
            onClick={onLogout}
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--text-secondary)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
          >
            Log out
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--text-secondary)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
          >
            Log in
          </button>
        )}
      </div>
    );
  }

  const visible = posts.slice(0, STACK_VISIBLE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {community && auth ? (
        <CommunityHeader
          name={community.name}
          instance={community.instance}
          sortType={sortType}
          onSortChange={handleSortChange}
          onBack={() => navigate(-1)}
          communityInfo={communityInfo}
          onSubscribeToggle={handleSubscribeToggle}
        />
      ) : (
        <MenuDrawer
          sortType={sortType}
          onSortChange={handleSortChange}
          onNavigate={navigate}
          onLogoClick={() => navigate('/')}
          unreadCount={unreadCount}
          activeStak={auth ? stak : undefined}
          onStakChange={auth ? handleStakChange : undefined}
          isAuthenticated={auth !== null}
        />
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {visible.map((post, i) => {
          const isTop = i === 0;
          const scale = 1 - i * 0.04;
          const zIndex = STACK_VISIBLE - i;
          return (
            <PostCard
              key={post.post.id}
              post={post}
              auth={auth}
              zIndex={zIndex}
              scale={isTop ? 1 : scale}
              onSwipeRight={isTop ? async () => {
                if (!isAnonymousMode && auth) {
                  await upvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
                }
                dismissTop(post.post.id);
              } : () => {}}
              onSwipeLeft={isTop ? async () => {
                if (!isAnonymousMode && auth && settings.leftSwipe === 'downvote') {
                  await downvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
                }
                dismissTop(post.post.id);
              } : () => {}}
              onUndo={isTop ? handleUndo : () => {}}
              isReturning={isTop && post.post.id === returningPostId}
              onReturnAnimationComplete={
                isTop && post.post.id === returningPostId
                  ? () => setReturningPostId(null)
                  : undefined
              }
            />
          );
        })}
        <SwipeHint />
      </div>
    </div>
  );
}
```

Note: `PostCard` currently receives `auth: AuthState`. It will need to accept `auth: AuthState | null` — check `PostCard.tsx` for any required type update. If PostCard uses `auth` for comment fetching (which it does via a token), it already handles empty tokens via the three-tier fallback. Update PostCard's Props interface to `auth: AuthState | null` if needed; the logic inside should work as-is since it uses `auth.instance` and `auth.token` only for fallback tier 3, and `auth.token` can be `''`.

- [ ] **Run all FeedStack tests**

```bash
npm test -- FeedStack
```
Expected: all tests pass (both old and new)

- [ ] **Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: make FeedStack support anonymous mode (auth nullable)"
```

---

## Task 7: PostCard — accept nullable auth

**Files:**
- Modify: `src/components/PostCard.tsx` (Props interface only)
- Modify: `src/components/PostCard.test.tsx` (add null auth test)

Check PostCard's Props interface and update `auth: AuthState` → `auth: AuthState | null`. The three-tier comment fetching fallback in PostCard already uses `auth.instance` and `auth.token`; when `auth` is null we should skip tier 3 (home instance fallback) or use empty values.

- [ ] **Read the PostCard Props interface**

Open `src/components/PostCard.tsx` and find the Props interface. Identify all usages of `auth` inside the component.

- [ ] **Update PostCard to accept `auth: AuthState | null`**

Change the Props interface:
```ts
auth: AuthState | null;
```

Inside PostCard, guard any `auth.instance`/`auth.token` usage with null checks. The comment loader hook (`useCommentLoader`) receives auth — update its signature to match. In `useCommentLoader.ts`, change `auth: AuthState` to `auth: AuthState | null` and treat null auth as no home-instance fallback (tiers 1 and 2 don't require auth; tier 3 should be skipped when `auth === null`).

- [ ] **Write a minimal test confirming PostCard renders with null auth**

In `src/components/PostCard.test.tsx`, add:

```tsx
it('renders with null auth (anonymous mode)', async () => {
  render(
    <SettingsProvider>
      <PostCard
        post={{
          post: { id: 1, name: 'Anon Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://reddthat.com/post/1' },
          community: { name: 'tech', actor_id: 'https://reddthat.com/c/tech' },
          creator: { name: 'alice' },
          counts: { score: 5, comments: 0 },
        }}
        auth={null}
        zIndex={1}
        scale={1}
        onSwipeRight={() => {}}
        onSwipeLeft={() => {}}
        onUndo={() => {}}
        isReturning={false}
      />
    </SettingsProvider>
  );
  expect(screen.getByText('Anon Post')).toBeInTheDocument();
});
```

- [ ] **Run tests**

```bash
npm test -- PostCard useCommentLoader
```
Expected: all pass

- [ ] **Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.test.tsx src/hooks/useCommentLoader.ts src/hooks/useCommentLoader.test.ts
git commit -m "feat: allow PostCard and useCommentLoader to accept null auth"
```

---

## Task 8: LoginPage — InstanceInput + skip link

**Files:**
- Modify: `src/components/LoginPage.tsx`
- Modify: `src/components/LoginPage.test.tsx`

- [ ] **Write the failing tests**

Add to `src/components/LoginPage.test.tsx`:

```tsx
it('shows a "Continue without account" link', () => {
  render(<LoginPage onLogin={() => {}} />);
  expect(screen.getByRole('link', { name: /continue without account/i })).toBeInTheDocument();
});
```

Or if the skip uses a button instead of a link:
```tsx
it('shows a "Continue without account" button that navigates to /', () => {
  render(
    <MemoryRouter>
      <LoginPage onLogin={() => {}} />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /continue without account/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/');
});
```

- [ ] **Run test to confirm it fails**

```bash
npm test -- LoginPage
```

- [ ] **Update `LoginPage.tsx`**

1. Import `InstanceInput` and `useNavigate`:
```tsx
import { useNavigate } from 'react-router-dom';
import InstanceInput from './InstanceInput';
```

2. Add `const navigate = useNavigate();` inside the component.

3. Replace the custom instance `<input>` block:
```tsx
{selectedInstance === 'custom' && (
  <InstanceInput
    className={styles.input}
    placeholder="your.instance.com"
    value={customInstance}
    onChange={setCustomInstance}
  />
)}
```

4. Add a "Continue without account" button below the Sign In button:
```tsx
<button
  type="button"
  onClick={() => navigate('/')}
  style={{
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', fontSize: '0.85rem',
    textDecoration: 'underline', marginTop: 4,
  }}
>
  Continue without account
</button>
```

- [ ] **Run tests**

```bash
npm test -- LoginPage
```
Expected: all pass

- [ ] **Commit**

```bash
git add src/components/LoginPage.tsx src/components/LoginPage.test.tsx
git commit -m "feat: add InstanceInput and skip link to LoginPage"
```

---

## Task 9: CreatePostPage — use InstanceInput

**Files:**
- Modify: `src/components/CreatePostPage.tsx`
- Modify: `src/components/CreatePostPage.test.tsx`

The community field accepts `communityname@instance.tld`. Replace its raw `<input>` with `<InstanceInput>` using the same `inputStyle`.

- [ ] **Update `CreatePostPage.tsx`**

Import InstanceInput:
```tsx
import InstanceInput from './InstanceInput';
```

Replace the community `<input>`:
```tsx
<InstanceInput
  style={inputStyle}
  placeholder="communityname@instance.tld"
  value={community}
  onChange={setCommunity}
/>
```

- [ ] **Run existing tests to confirm nothing broke**

```bash
npm test -- CreatePostPage
```
Expected: all existing tests pass (InstanceInput is a drop-in replacement)

- [ ] **Commit**

```bash
git add src/components/CreatePostPage.tsx
git commit -m "refactor: use InstanceInput in CreatePostPage"
```

---

## Task 10: SettingsPage — Anonymous Feed section

**Files:**
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/components/SettingsPage.test.tsx`

- [ ] **Write the failing tests**

Add to `src/components/SettingsPage.test.tsx`:

```tsx
it('renders Anonymous Feed section', () => {
  renderPage();
  expect(screen.getByText('Anonymous Feed')).toBeInTheDocument();
});

it('shows the anonInstance input with auto placeholder', () => {
  renderPage();
  expect(screen.getByPlaceholderText('Auto (top-ranked per sort)')).toBeInTheDocument();
});

it('typing in anonInstance field updates the setting', () => {
  renderPage();
  const input = screen.getByPlaceholderText('Auto (top-ranked per sort)');
  fireEvent.change(input, { target: { value: 'lemmy.ml' } });
  const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
  expect(stored.anonInstance).toBe('lemmy.ml');
});

it('shows persisted anonInstance value in the field', () => {
  localStorage.setItem('stakswipe_settings', JSON.stringify({ anonInstance: 'sh.itjust.works' }));
  renderPage();
  expect(screen.getByDisplayValue('sh.itjust.works')).toBeInTheDocument();
});
```

- [ ] **Run test to confirm it fails**

```bash
npm test -- SettingsPage
```
Expected: FAIL — "Anonymous Feed" not found

- [ ] **Update `SettingsPage.tsx`**

Import InstanceInput:
```tsx
import InstanceInput from './InstanceInput';
```

Add the Anonymous Feed section after the existing Default Sort card:

```tsx
<div style={card}>
  <div style={sectionLabel}>Anonymous Feed</div>
  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
    Instance to use when browsing anonymously. Leave blank to use the top-ranked instance per sort.
  </div>
  <InstanceInput
    value={settings.anonInstance}
    onChange={(v) => updateSetting('anonInstance', v)}
    placeholder="Auto (top-ranked per sort)"
    style={{
      width: '100%', boxSizing: 'border-box',
      background: '#1a1d24', border: '1px solid #3a3d45',
      borderRadius: 8, padding: '10px 12px',
      color: '#f5f5f5', fontSize: 14, fontFamily: 'inherit',
    }}
  />
</div>
```

- [ ] **Run tests**

```bash
npm test -- SettingsPage
```
Expected: all pass

- [ ] **Commit**

```bash
git add src/components/SettingsPage.tsx src/components/SettingsPage.test.tsx
git commit -m "feat: add Anonymous Feed instance setting to SettingsPage"
```

---

## Task 11: App.tsx — remove AuthGate, restructure routing

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

This is the final wiring task. Remove `AuthGate`. Add `unreadCount` state to App. Move `SettingsProvider` to wrap all routes. Add `/login` route. Move `/settings` and `/search` outside auth guard. Auth-gated routes use a `<Navigate to="/" />` when auth is null.

- [ ] **Write the failing tests**

Replace the content of `src/App.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

vi.mock('./lib/store', () => ({
  loadAuth: vi.fn().mockReturnValue(null),
  clearAuth: vi.fn(),
  loadSettings: vi.fn().mockReturnValue({
    leftSwipe: 'downvote', blurNsfw: true, defaultSort: 'TopTwelveHour', activeStak: 'All', anonInstance: '',
  }),
  saveSettings: vi.fn(),
  DEFAULT_SETTINGS: {
    leftSwipe: 'downvote', blurNsfw: true, defaultSort: 'TopTwelveHour', activeStak: 'All', anonInstance: '',
  },
}));

vi.mock('./lib/lemmy', () => ({
  fetchPost: vi.fn().mockResolvedValue({
    post: { id: 5, name: 'Shared Post', ap_id: 'https://lemmy.world/post/5', url: null, body: null, thumbnail_url: null },
    community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
    creator: { name: 'carol', display_name: null },
    counts: { score: 10, comments: 0 },
  }),
}));

vi.mock('./components/LoginPage', () => ({
  default: (_props: { onLogin: unknown }) => <div>LoginPage</div>,
}));

vi.mock('./components/FeedStack', () => ({
  default: () => <div>FeedStack</div>,
}));

vi.mock('./components/InboxPage', () => ({
  default: () => <div>InboxPage</div>,
}));

vi.mock('./components/PostDetailPage', () => ({
  default: () => <div>PostDetailPage</div>,
}));

vi.mock('./components/SavedPage', () => ({
  default: () => <div>SavedPage</div>,
}));

vi.mock('./components/SavedPostDetailPage', () => ({
  default: () => <div>SavedPostDetailPage</div>,
}));

vi.mock('./components/ProfilePage', () => ({
  default: () => <div>ProfilePage</div>,
}));

vi.mock('./components/ProfilePostDetailPage', () => ({
  default: () => <div>ProfilePostDetailPage</div>,
}));

vi.mock('./components/SharedPostPage', () => ({
  default: () => <div>Shared Post</div>,
}));

vi.mock('./components/SettingsPage', () => ({
  default: () => <div>SettingsPage</div>,
}));

vi.mock('./components/CreatePostPage', () => ({
  default: () => <div>CreatePostPage</div>,
}));

describe('App routing', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('shows FeedStack at / when not authenticated (anonymous mode)', () => {
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
  });

  it('shows LoginPage at /login when not authenticated', () => {
    window.location.hash = '#/login';
    render(<App />);
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  it('shows FeedStack when authenticated', async () => {
    const { loadAuth } = await import('./lib/store');
    vi.mocked(loadAuth).mockReturnValue({ token: 'tok', instance: 'lemmy.world', username: 'alice' });
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
  });

  it('renders SharedPostPage at /post/:instance/:postId without auth', async () => {
    window.location.hash = '#/post/lemmy.world/5';
    render(<App />);
    await waitFor(() => expect(screen.getByText('Shared Post')).toBeInTheDocument());
  });

  it('redirects /inbox to / when not authenticated', () => {
    window.location.hash = '#/inbox';
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
    expect(screen.queryByText('InboxPage')).not.toBeInTheDocument();
  });

  it('redirects /saved to / when not authenticated', () => {
    window.location.hash = '#/saved';
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
    expect(screen.queryByText('SavedPage')).not.toBeInTheDocument();
  });

  it('renders SettingsPage at /settings without auth', () => {
    window.location.hash = '#/settings';
    render(<App />);
    expect(screen.getByText('SettingsPage')).toBeInTheDocument();
  });

  it('renders ProfilePage at /user/:instance/:username when authenticated', async () => {
    const { loadAuth } = await import('./lib/store');
    vi.mocked(loadAuth).mockReturnValue({ token: 'tok', instance: 'lemmy.world', username: 'alice' });
    window.location.hash = '#/user/beehaw.org/bob';
    render(<App />);
    await waitFor(() => expect(screen.getByText('ProfilePage')).toBeInTheDocument());
  });

  it('renders CreatePostPage at /create-post when authenticated', async () => {
    const { loadAuth } = await import('./lib/store');
    vi.mocked(loadAuth).mockReturnValue({ token: 'tok', instance: 'lemmy.world', username: 'alice' });
    window.location.hash = '#/create-post';
    render(<App />);
    await waitFor(() => expect(screen.getByText('CreatePostPage')).toBeInTheDocument());
  });

  it('redirects /create-post to / when not authenticated', () => {
    window.location.hash = '#/create-post';
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
    expect(screen.queryByText('CreatePostPage')).not.toBeInTheDocument();
  });
});
```

- [ ] **Run test to confirm new tests fail**

```bash
npm test -- App
```
Expected: several new tests FAIL

- [ ] **Rewrite `App.tsx`**

```tsx
import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { loadAuth, clearAuth, type AuthState } from './lib/store';
import { SettingsProvider } from './lib/SettingsContext';
import LoginPage from './components/LoginPage';
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

function RequireAuth({ auth, children }: { auth: AuthState | null; children: React.ReactNode }) {
  if (!auth) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CommunityFeedRoute({ auth, onLogout, unreadCount, setUnreadCount }: {
  auth: AuthState | null;
  onLogout: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { instance, name } = useParams<{ instance: string; name: string }>();
  if (!auth) return <Navigate to="/" replace />;
  return (
    <FeedStack
      auth={auth}
      onLogout={onLogout}
      unreadCount={unreadCount}
      setUnreadCount={setUnreadCount}
      community={{ name: name!, instance: instance! }}
    />
  );
}

function UserProfileRoute({ auth }: { auth: AuthState | null }) {
  const { instance, username } = useParams<{ instance: string; username: string }>();
  if (!auth) return <Navigate to="/" replace />;
  return <ProfilePage auth={auth} target={{ instance: instance!, username: username! }} />;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [unreadCount, setUnreadCount] = useState(0);

  function handleLogin(newAuth: AuthState) {
    setAuth(newAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  return (
    <HashRouter>
      <SettingsProvider>
        <Routes>
          <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route
            path="/"
            element={
              <FeedStack
                auth={auth}
                onLogout={handleLogout}
                unreadCount={unreadCount}
                setUnreadCount={setUnreadCount}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/search" element={<SearchPage auth={auth} />} />
          <Route
            path="/inbox"
            element={
              <RequireAuth auth={auth}>
                <InboxPage auth={auth!} setUnreadCount={setUnreadCount} unreadCount={unreadCount} />
              </RequireAuth>
            }
          />
          <Route
            path="/inbox/:notifId"
            element={
              <RequireAuth auth={auth}>
                <PostDetailPage auth={auth!} setUnreadCount={setUnreadCount} unreadCount={unreadCount} />
              </RequireAuth>
            }
          />
          <Route
            path="/saved"
            element={<RequireAuth auth={auth}><SavedPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/saved/:postId"
            element={<RequireAuth auth={auth}><SavedPostDetailPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/profile"
            element={<RequireAuth auth={auth}><ProfilePage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/profile/:postId"
            element={<RequireAuth auth={auth}><ProfilePostDetailPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/create-post"
            element={<RequireAuth auth={auth}><CreatePostPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/community/:instance/:name"
            element={
              <CommunityFeedRoute
                auth={auth}
                onLogout={handleLogout}
                unreadCount={unreadCount}
                setUnreadCount={setUnreadCount}
              />
            }
          />
          <Route
            path="/community/:instance/:name/about"
            element={
              <RequireAuth auth={auth}>
                <CommunityAboutPage auth={auth!} />
              </RequireAuth>
            }
          />
          <Route path="/user/:instance/:username" element={<UserProfileRoute auth={auth} />} />
          <Route
            path="/view/:instance/:postId"
            element={<PostViewPage auth={auth} />}
          />
        </Routes>
      </SettingsProvider>
    </HashRouter>
  );
}
```

Note: `PostViewPage`, `SearchPage`, and `CommunityAboutPage` may need their `auth` prop type updated to `AuthState | null`. Check their Props interfaces and update accordingly.

- [ ] **Run all tests**

```bash
npm test -- App
```
Expected: all App tests pass

- [ ] **Run the full test suite**

```bash
npm test
```
Expected: all tests pass. If any fail due to prop type mismatches (e.g. `auth: AuthState` vs `auth: AuthState | null` in PostViewPage, SearchPage, CommunityAboutPage), update those Props interfaces to accept `AuthState | null`.

- [ ] **Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: remove AuthGate, anonymous feed is default, /login is a route"
```

---

## Task 12: Final verification

- [ ] **Run full test suite**

```bash
npm test
```
Expected: all tests pass with no failures

- [ ] **Start dev server and manually verify**

```bash
npm run dev
```

Check:
1. Opening the app without being logged in shows the feed (anonymous, using reddthat.com for TopTwelveHour sort)
2. Hamburger menu when anonymous shows Login, Settings, Search only
3. Tapping Login navigates to the login page; "Continue without account" goes back to the feed
4. Changing sort in anonymous mode uses the correct ranked instance
5. Logging in shows the stak selector; switching to Anonymous stak fetches from ranked instance
6. Settings page shows Anonymous Feed section; entering `lemmy.ml` and going back to feed uses `lemmy.ml`
7. Swiping in anonymous mode dismisses cards but does not call vote endpoints (check network tab)
8. Logging out returns to the anonymous feed (not the login page)

- [ ] **Commit any final fixes**

```bash
git add -p
git commit -m "fix: resolve any remaining type/prop issues from anonymous mode"
```
