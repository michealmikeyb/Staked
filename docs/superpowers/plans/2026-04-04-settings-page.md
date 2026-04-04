# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings page with left-swipe behaviour, NSFW blur, and default sort — persisted in localStorage and shared via React Context.

**Architecture:** A `SettingsContext` wraps `AuthenticatedApp` and exposes `settings` + `updateSetting()`. Components consume the context directly via `useSettings()`. A context default value means components render correctly in isolation (no provider needed in tests).

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, react-router-dom v6, localStorage

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/store.ts` | Modify | Add `AppSettings` type + `loadSettings` / `saveSettings` |
| `src/lib/SettingsContext.tsx` | Create | `SettingsProvider` component + `useSettings()` hook |
| `src/components/SettingsPage.tsx` | Create | Full-page settings UI with pill selectors |
| `src/App.tsx` | Modify | Wrap `AuthenticatedApp` in `SettingsProvider`; add `/settings` route |
| `src/components/MenuDrawer.tsx` | Modify | Add ⚙️ Settings button; 4-column grid |
| `src/components/FeedStack.tsx` | Modify | Use `settings.defaultSort` as initial sort; check `settings.leftSwipe` before downvoting |
| `src/components/PostCard.tsx` | Modify | Blur image on NSFW posts when `settings.blurNsfw` is true |
| `src/lib/store.test.ts` | Modify | Tests for `loadSettings` / `saveSettings` |
| `src/lib/SettingsContext.test.tsx` | Create | Tests for provider and `updateSetting` |
| `src/components/SettingsPage.test.tsx` | Create | Tests for pill interactions |
| `src/components/MenuDrawer.test.tsx` | Modify | Update for 4th Settings button |
| `src/components/FeedStack.test.tsx` | Modify | Tests for defaultSort and leftSwipe behaviour |
| `src/components/PostCard.test.tsx` | Modify | Tests for NSFW blur overlay |

---

## Task 1: Settings persistence in store.ts

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/store.test.ts`:

```ts
import { loadSettings, saveSettings } from './store';

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual({
      leftSwipe: 'downvote',
      blurNsfw: true,
      defaultSort: 'TopTwelveHour',
    });
  });

  it('round-trips settings through localStorage', () => {
    const s = { leftSwipe: 'dismiss' as const, blurNsfw: false, defaultSort: 'Hot' as const };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });

  it('merges stored partial object with defaults (handles missing keys)', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ blurNsfw: false }));
    const s = loadSettings();
    expect(s.blurNsfw).toBe(false);
    expect(s.leftSwipe).toBe('downvote');
    expect(s.defaultSort).toBe('TopTwelveHour');
  });

  it('returns defaults when stored value is invalid JSON', () => {
    localStorage.setItem('stakswipe_settings', 'not-json');
    expect(loadSettings()).toEqual({
      leftSwipe: 'downvote',
      blurNsfw: true,
      defaultSort: 'TopTwelveHour',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- store
```

Expected: 4 failures — `loadSettings` and `saveSettings` are not defined.

- [ ] **Step 3: Add `AppSettings`, `loadSettings`, `saveSettings` to store.ts**

Add to `src/lib/store.ts` after the existing imports (add the import) and at the end of the file:

```ts
import { type SortType } from './lemmy';

export interface AppSettings {
  leftSwipe: 'downvote' | 'dismiss';
  blurNsfw: boolean;
  defaultSort: SortType;
}

const SETTINGS_KEY = 'stakswipe_settings';

const DEFAULT_SETTINGS: AppSettings = {
  leftSwipe: 'downvote',
  blurNsfw: true,
  defaultSort: 'TopTwelveHour',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- store
```

Expected: all store tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: add AppSettings persistence to store (loadSettings/saveSettings)"
```

---

## Task 2: SettingsContext

**Files:**
- Create: `src/lib/SettingsContext.tsx`
- Create: `src/lib/SettingsContext.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/lib/SettingsContext.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

beforeEach(() => { localStorage.clear(); });

function TestConsumer() {
  const { settings, updateSetting } = useSettings();
  return (
    <div>
      <span data-testid="left-swipe">{settings.leftSwipe}</span>
      <span data-testid="blur-nsfw">{String(settings.blurNsfw)}</span>
      <span data-testid="default-sort">{settings.defaultSort}</span>
      <button onClick={() => updateSetting('leftSwipe', 'dismiss')}>set-dismiss</button>
      <button onClick={() => updateSetting('blurNsfw', false)}>set-no-blur</button>
      <button onClick={() => updateSetting('defaultSort', 'Hot')}>set-hot</button>
    </div>
  );
}

describe('SettingsContext', () => {
  it('provides default settings', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    expect(screen.getByTestId('left-swipe').textContent).toBe('downvote');
    expect(screen.getByTestId('blur-nsfw').textContent).toBe('true');
    expect(screen.getByTestId('default-sort').textContent).toBe('TopTwelveHour');
  });

  it('updateSetting updates the value in context', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-dismiss'));
    expect(screen.getByTestId('left-swipe').textContent).toBe('dismiss');
  });

  it('updateSetting persists to localStorage', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-hot'));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.defaultSort).toBe('Hot');
  });

  it('initialises from localStorage on mount', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      leftSwipe: 'dismiss', blurNsfw: false, defaultSort: 'New',
    }));
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    expect(screen.getByTestId('left-swipe').textContent).toBe('dismiss');
    expect(screen.getByTestId('blur-nsfw').textContent).toBe('false');
    expect(screen.getByTestId('default-sort').textContent).toBe('New');
  });

  it('useSettings returns default context value when used outside a provider', () => {
    render(<TestConsumer />);
    expect(screen.getByTestId('left-swipe').textContent).toBe('downvote');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- SettingsContext
```

Expected: failures — module not found.

- [ ] **Step 3: Implement SettingsContext**

Create `src/lib/SettingsContext.tsx`:

```tsx
import { createContext, useContext, useState } from 'react';
import { loadSettings, saveSettings, type AppSettings } from './store';

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const DEFAULT_VALUE: SettingsContextValue = {
  settings: { leftSwipe: 'downvote', blurNsfw: true, defaultSort: 'TopTwelveHour' },
  updateSetting: () => {},
};

const SettingsContext = createContext<SettingsContextValue>(DEFAULT_VALUE);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- SettingsContext
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/SettingsContext.tsx src/lib/SettingsContext.test.tsx
git commit -m "feat: add SettingsContext with provider and useSettings hook"
```

---

## Task 3: SettingsPage component

**Files:**
- Create: `src/components/SettingsPage.tsx`
- Create: `src/components/SettingsPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/SettingsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../lib/SettingsContext';
import SettingsPage from './SettingsPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  it('renders all three setting sections', () => {
    renderPage();
    expect(screen.getByText('Left Swipe')).toBeInTheDocument();
    expect(screen.getByText('Blur NSFW')).toBeInTheDocument();
    expect(screen.getByText('Default Sort')).toBeInTheDocument();
  });

  it('back button navigates to /', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('Dismiss pill updates leftSwipe setting', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.leftSwipe).toBe('dismiss');
  });

  it('Off pill updates blurNsfw setting', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^off$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.blurNsfw).toBe(false);
  });

  it('sort pill updates defaultSort setting', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.defaultSort).toBe('Hot');
  });

  it('active sort pill has distinct styling (orange background)', () => {
    renderPage();
    // TopTwelveHour is default — its button should have orange background
    const topBtn = screen.getByRole('button', { name: /top 12h/i });
    expect(topBtn).toHaveStyle({ background: '#ff6b35' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- SettingsPage
```

Expected: failures — module not found.

- [ ] **Step 3: Implement SettingsPage**

Create `src/components/SettingsPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../lib/SettingsContext';
import { SORT_OPTIONS } from './HeaderBar';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { settings, updateSetting } = useSettings();

  const pillBase: React.CSSProperties = {
    border: 'none', borderRadius: 8, padding: '8px 12px',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
  };
  const active: React.CSSProperties = { ...pillBase, background: '#ff6b35', color: '#fff' };
  const inactive: React.CSSProperties = { ...pillBase, background: '#2a2d35', color: '#888' };
  const card: React.CSSProperties = {
    background: '#2a2d35', borderRadius: 12, padding: 16, marginBottom: 12,
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 10,
  };

  return (
    <div style={{ background: '#1a1d24', minHeight: '100dvh', color: '#f5f5f5' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid #2a2d35',
      }}>
        <button
          aria-label="Back"
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: 0 }}
        >
          ←
        </button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Settings</span>
      </div>

      <div style={{ padding: 16 }}>
        <div style={card}>
          <div style={sectionLabel}>Left Swipe</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.leftSwipe === 'downvote' ? active : inactive}
              onClick={() => updateSetting('leftSwipe', 'downvote')}
            >
              Downvote
            </button>
            <button
              style={settings.leftSwipe === 'dismiss' ? active : inactive}
              onClick={() => updateSetting('leftSwipe', 'dismiss')}
            >
              Dismiss
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={sectionLabel}>Blur NSFW</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.blurNsfw ? active : inactive}
              onClick={() => updateSetting('blurNsfw', true)}
            >
              On
            </button>
            <button
              style={!settings.blurNsfw ? active : inactive}
              onClick={() => updateSetting('blurNsfw', false)}
            >
              Off
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={sectionLabel}>Default Sort</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SORT_OPTIONS.map(({ sort, label }) => (
              <button
                key={sort}
                style={settings.defaultSort === sort ? active : inactive}
                onClick={() => updateSetting('defaultSort', sort)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- SettingsPage
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsPage.tsx src/components/SettingsPage.test.tsx
git commit -m "feat: add SettingsPage component with pill selectors"
```

---

## Task 4: Wire SettingsProvider and route into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Run existing App tests to confirm baseline**

```bash
npm test -- App.test
```

Expected: all pass (baseline).

- [ ] **Step 2: Modify App.tsx**

In `src/App.tsx`, add imports and wire in the provider and route:

Add imports at the top:
```tsx
import { SettingsProvider } from './lib/SettingsContext';
import SettingsPage from './components/SettingsPage';
```

Inside `AuthenticatedApp`, add the `/settings` route:
```tsx
<Route path="/settings" element={<SettingsPage />} />
```

Wrap `<AuthenticatedApp>` in `AuthGate` with `SettingsProvider`:
```tsx
function AuthGate({ auth, onLogin, onLogout }: {
  auth: AuthState | null;
  onLogin: (a: AuthState) => void;
  onLogout: () => void;
}) {
  if (!auth) return <LoginPage onLogin={onLogin} />;
  return (
    <SettingsProvider>
      <AuthenticatedApp auth={auth} onLogout={onLogout} />
    </SettingsProvider>
  );
}
```

- [ ] **Step 3: Run App tests to confirm still passing**

```bash
npm test -- App.test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wrap AuthenticatedApp in SettingsProvider, add /settings route"
```

---

## Task 5: Add Settings button to MenuDrawer

**Files:**
- Modify: `src/components/MenuDrawer.tsx`
- Modify: `src/components/MenuDrawer.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/components/MenuDrawer.test.tsx` (inside the existing `describe('MenuDrawer')` block, after the existing tests):

```ts
it('renders Settings button when drawer is open', () => {
  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
});

it('calls onNavigate with /settings and closes drawer when Settings is clicked', () => {
  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  fireEvent.click(screen.getByRole('button', { name: /settings/i }));
  expect(mockNavigate).toHaveBeenCalledWith('/settings');
  expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- MenuDrawer
```

Expected: 2 new failures — no Settings button.

- [ ] **Step 3: Update MenuDrawer.tsx**

In `src/components/MenuDrawer.tsx`, change the grid column count and add the Settings button:

Change `gridTemplateColumns: 'repeat(3, 1fr)'` to `'repeat(4, 1fr)'`.

Add after the Inbox button:

```tsx
<button
  onClick={() => handleNavigate('/settings')}
  aria-label="Settings"
  style={drawerButtonStyle}
>
  <span style={iconStyle}>⚙️</span>
  Settings
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- MenuDrawer
```

Expected: all tests pass (the 3 existing "opens drawer" tests now also check Settings exists — those were checking for Saved/Profile/Inbox and don't assert the full set, so they still pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/MenuDrawer.tsx src/components/MenuDrawer.test.tsx
git commit -m "feat: add Settings button to MenuDrawer"
```

---

## Task 6: FeedStack — defaultSort from settings, leftSwipe behaviour

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 1: Write failing tests**

Add two new `describe` blocks to `src/components/FeedStack.test.tsx`:

```tsx
describe('FeedStack settings — defaultSort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('uses defaultSort from settings for initial fetch', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      leftSwipe: 'downvote', blurNsfw: true, defaultSort: 'Hot',
    }));
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        post: { id: 1, name: 'Hot Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
        community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
    ]);
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Hot Post');
    expect(fetchPosts).toHaveBeenCalledWith('lemmy.world', 'tok', 1, 'Hot');
  });
});

describe('FeedStack settings — leftSwipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('calls downvotePost on ArrowLeft when leftSwipe is downvote (default)', async () => {
    const { fetchPosts, downvotePost } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        post: { id: 1, name: 'Test Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
        community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
    ]).mockResolvedValue([]);
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(downvotePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1);
  });

  it('does not call downvotePost on ArrowLeft when leftSwipe is dismiss', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      leftSwipe: 'dismiss', blurNsfw: true, defaultSort: 'TopTwelveHour',
    }));
    const { fetchPosts, downvotePost } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        post: { id: 1, name: 'Test Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
        community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
        creator: { name: 'alice' },
        counts: { score: 10, comments: 0 },
      },
    ]).mockResolvedValue([]);
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(downvotePost).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- FeedStack
```

Expected: 2 new failures. All existing tests still pass.

- [ ] **Step 3: Update FeedStack.tsx**

Add import at the top of `src/components/FeedStack.tsx`:
```tsx
import { useSettings } from '../lib/SettingsContext';
```

Inside the component body, add after existing state declarations:
```tsx
const { settings } = useSettings();
```

Change the `sortType` initial state from:
```tsx
const [sortType, setSortType] = useState<SortType>(community ? 'Active' : 'TopTwelveHour');
```
to:
```tsx
const [sortType, setSortType] = useState<SortType>(community ? 'Active' : settings.defaultSort);
```

In the keyboard `useEffect`, change the `ArrowLeft` branch from:
```tsx
} else if (e.key === 'ArrowLeft') {
  downvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
  dismissTop(topPost.post.id);
}
```
to:
```tsx
} else if (e.key === 'ArrowLeft') {
  if (settings.leftSwipe === 'downvote') {
    downvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
  }
  dismissTop(topPost.post.id);
}
```

Also add `settings` to the `useEffect` dependency array:
```tsx
}, [posts, auth, settings]);
```

In the JSX `onSwipeLeft` prop for the top card, change from:
```tsx
onSwipeLeft={isTop ? async () => {
  await downvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
  dismissTop(post.post.id);
} : () => {}}
```
to:
```tsx
onSwipeLeft={isTop ? async () => {
  if (settings.leftSwipe === 'downvote') {
    await downvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
  }
  dismissTop(post.post.id);
} : () => {}}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npm test -- FeedStack
```

Expected: all tests pass including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
git commit -m "feat: FeedStack reads defaultSort from settings, respects leftSwipe=dismiss"
```

---

## Task 7: PostCard — NSFW image blur

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/components/PostCard.test.tsx` — first add a helper post fixture and tests:

```tsx
const NSFW_POST = {
  post: { id: 2, name: 'NSFW Post', body: null, url: null, thumbnail_url: 'https://example.com/thumb.jpg', nsfw: true },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'bob', actor_id: 'https://lemmy.world/u/bob', avatar: undefined },
  counts: { score: 5, comments: 0 },
} as unknown as PostView;

function renderCard(post = MOCK_POST) {
  return render(
    <PostCard
      post={post}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onUndo={vi.fn()}
      onSave={vi.fn()}
    />
  );
}

describe('PostCard NSFW blur', () => {
  it('shows blur overlay on image when post is nsfw and blurNsfw is true (default)', () => {
    renderCard(NSFW_POST);
    expect(screen.getByTestId('nsfw-blur-overlay')).toBeInTheDocument();
    expect(screen.getByText(/tap to reveal nsfw/i)).toBeInTheDocument();
  });

  it('hides image behind blur before reveal', () => {
    renderCard(NSFW_POST);
    // The img should not be directly visible — it should be under the overlay
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('removes overlay and shows image when tapped', () => {
    renderCard(NSFW_POST);
    fireEvent.click(screen.getByTestId('nsfw-blur-overlay'));
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('does not show blur overlay on non-nsfw posts', () => {
    renderCard(MOCK_POST);
    // MOCK_POST has url but no nsfw flag — no overlay
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
  });

  it('does not show blur overlay when blurNsfw setting is off', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      leftSwipe: 'downvote', blurNsfw: false, defaultSort: 'TopTwelveHour',
    }));
    renderCard(NSFW_POST);
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- PostCard
```

Expected: 5 new failures. All existing PostCard tests still pass.

- [ ] **Step 3: Update PostCard.tsx**

Add import at the top of `src/components/PostCard.tsx`:
```tsx
import { useSettings } from '../lib/SettingsContext';
```

Inside the component body, add after existing hook calls:
```tsx
const { settings } = useSettings();
const [nsfwRevealed, setNsfwRevealed] = useState(false);
const showNsfwBlur = p.nsfw && settings.blurNsfw && !nsfwRevealed;
```

Find the image render line (line 240):
```tsx
{imageSrc && <img className={styles.image} src={imageSrc} alt="" loading="lazy" />}
```

Replace it with:
```tsx
{imageSrc && (
  showNsfwBlur ? (
    <div
      data-testid="nsfw-blur-overlay"
      onClick={() => setNsfwRevealed(true)}
      style={{
        position: 'relative', cursor: 'pointer',
        borderRadius: 8, overflow: 'hidden',
        background: '#2a2d35', height: 180,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg,#3a2d35,#2a2d3a)',
        filter: 'blur(20px)', transform: 'scale(1.1)',
      }} />
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#2a2d35', border: '1px solid #3a3d45',
        borderRadius: 10, padding: '8px 18px', textAlign: 'center',
      }}>
        <div style={{ color: '#f5f5f5', fontSize: 13, fontWeight: 600 }}>Tap to reveal NSFW</div>
      </div>
    </div>
  ) : (
    <img className={styles.image} src={imageSrc} alt="" loading="lazy" />
  )
)}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npm test -- PostCard
```

Expected: all tests pass including the 5 new ones.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.test.tsx
git commit -m "feat: blur NSFW post images with tap-to-reveal overlay"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Left swipe: Downvote / Dismiss — Task 6 (FeedStack keyboard + swipe, both code paths)
- ✅ NSFW blur: on/off, image-only blur, "Tap to reveal NSFW" text, click to reveal — Task 7
- ✅ Default sort pill selector — Tasks 3 + 6
- ✅ Settings persisted to localStorage — Task 1 + 2
- ✅ React Context with `useSettings()` — Task 2
- ✅ SettingsPage with pill selectors — Task 3
- ✅ `/settings` route in App — Task 4
- ✅ ⚙️ Settings button in MenuDrawer — Task 5
- ✅ Tests for all components and behaviours — each task

**No placeholders found.**

**Type consistency:** `AppSettings` defined once in `store.ts`, imported by `SettingsContext.tsx`, `SettingsPage.tsx`, and tests. `updateSetting` signature consistent across all tasks.
