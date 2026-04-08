# Community Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hamburger menu to the community feed header containing Post, Subscribe (live toggle), and About buttons; show real community icons in the header and on post cards; add a Community About page with markdown rendering.

**Architecture:** `FeedStack` fetches community info on mount via a new `fetchCommunityInfo` lemmy function, stores it in state, and passes it down to the refactored `CommunityHeader`. `CommunityHeader` owns navigation for Post/About and calls an `onSubscribeToggle` callback for subscribe actions. A new `CommunityAboutPage` component reads community data from location state or re-fetches if navigated directly.

**Tech Stack:** React 18, TypeScript, react-router-dom v6, lemmy-js-client, Vitest + @testing-library/react

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/lib/lemmy.ts` | Modify | Add `CommunityInfo` type, `fetchCommunityInfo`, `followCommunity` |
| `src/components/PostCardShell.tsx` | Modify | `Community` interface gets `icon?`; render real icon image if present |
| `src/components/PostCardShell.test.tsx` | Modify | Add icon render tests |
| `src/components/CommunityAboutPage.tsx` | **Create** | New about page component |
| `src/components/CommunityAboutPage.test.tsx` | **Create** | Tests for about page |
| `src/components/CommunityHeader.tsx` | Modify | Add hamburger menu, community icon, subscribe toggle; remove `onCompose` |
| `src/components/CommunityHeader.test.tsx` | Modify | Replace `onCompose` tests; add menu/subscribe/about tests |
| `src/components/FeedStack.tsx` | Modify | Fetch community info on mount; pass to `CommunityHeader`; handle subscribe toggle |
| `src/components/FeedStack.test.tsx` | Modify | Add `fetchCommunityInfo`/`followCommunity` to mock; fix broken assertions |
| `src/App.tsx` | Modify | Add `/community/:instance/:name/about` route |

---

## Task 1: Add `fetchCommunityInfo` and `followCommunity` to `lemmy.ts`

**Files:**
- Modify: `src/lib/lemmy.ts`

No separate unit tests — `lemmy.ts` is mocked at the module level in all component tests.

- [ ] **Step 1: Add `CommunityInfo` type and two new exported functions**

  In `src/lib/lemmy.ts`, after the existing `export type StakType` line, add:

  ```typescript
  export interface CommunityInfo {
    id: number;
    icon?: string;
    banner?: string;
    description?: string;
    counts: { subscribers: number; posts: number; comments: number };
    subscribed: 'Subscribed' | 'NotSubscribed' | 'Pending';
  }
  ```

  Then at the end of the file, add:

  ```typescript
  export async function fetchCommunityInfo(
    instance: string,
    token: string,
    communityRef: string,
  ): Promise<CommunityInfo> {
    const res = await client(instance, token).getCommunity({ name: communityRef });
    const { community, counts } = res.community_view;
    return {
      id: community.id,
      icon: community.icon ?? undefined,
      banner: community.banner ?? undefined,
      description: community.description ?? undefined,
      counts: {
        subscribers: counts.subscribers,
        posts: counts.posts,
        comments: counts.comments,
      },
      subscribed: res.community_view.subscribed as 'Subscribed' | 'NotSubscribed' | 'Pending',
    };
  }

  export async function followCommunity(
    instance: string,
    token: string,
    communityId: number,
    follow: boolean,
  ): Promise<void> {
    await client(instance, token).followCommunity({ community_id: communityId, follow });
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build 2>&1 | head -30
  ```

  Expected: no errors related to the new functions (build may fail for other reasons — only care about lemmy.ts).

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/lemmy.ts
  git commit -m "feat: add fetchCommunityInfo and followCommunity to lemmy.ts"
  ```

---

## Task 2: PostCardShell — real community icon

**Files:**
- Modify: `src/components/PostCardShell.tsx`
- Modify: `src/components/PostCardShell.test.tsx`

- [ ] **Step 1: Write the failing tests**

  In `src/components/PostCardShell.test.tsx`, add two tests inside the existing `describe('PostCardShell', ...)` block:

  ```typescript
  it('renders community icon image when community.icon is provided', () => {
    renderShell({
      community: {
        name: 'linux',
        actor_id: 'https://lemmy.world/c/linux',
        icon: 'https://lemmy.world/pictrs/image/icon.png',
      },
    });
    const img = document.querySelector('[data-testid="community-icon-img"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://lemmy.world/pictrs/image/icon.png');
  });

  it('renders first-letter fallback when community.icon is absent', () => {
    renderShell({ community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' } });
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="community-icon-img"]')).toBeNull();
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- PostCardShell 2>&1 | tail -20
  ```

  Expected: the two new tests FAIL (community-icon-img not found).

- [ ] **Step 3: Update `Community` interface in `PostCardShell.tsx`**

  Find:
  ```typescript
  interface Community {
    name: string;
    actor_id: string;
  }
  ```

  Replace with:
  ```typescript
  interface Community {
    name: string;
    actor_id: string;
    icon?: string | null;
  }
  ```

- [ ] **Step 4: Update the `communityIcon` render in `PostCardShell.tsx`**

  Find:
  ```tsx
  <div className={styles.communityIcon}>{community.name.charAt(0).toUpperCase()}</div>
  ```

  Replace with:
  ```tsx
  <div className={styles.communityIcon}>
    {community.icon
      ? <img
          data-testid="community-icon-img"
          src={community.icon}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      : community.name.charAt(0).toUpperCase()
    }
  </div>
  ```

- [ ] **Step 5: Run tests to confirm they pass**

  ```bash
  npm test -- PostCardShell 2>&1 | tail -20
  ```

  Expected: all PostCardShell tests PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx
  git commit -m "feat: show real community icon in post card, with first-letter fallback"
  ```

---

## Task 3: CommunityAboutPage — new component and route

**Files:**
- Create: `src/components/CommunityAboutPage.tsx`
- Create: `src/components/CommunityAboutPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing tests**

  Create `src/components/CommunityAboutPage.test.tsx`:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { fireEvent } from '@testing-library/react';
  import { MemoryRouter, Route, Routes } from 'react-router-dom';
  import CommunityAboutPage from './CommunityAboutPage';

  vi.mock('../lib/lemmy', () => ({
    fetchCommunityInfo: vi.fn(),
  }));

  const mockNavigate = vi.fn();
  vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return { ...actual, useNavigate: () => mockNavigate };
  });

  const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

  const INFO = {
    id: 42,
    icon: undefined,
    banner: undefined,
    description: '**Hello** community',
    counts: { subscribers: 12400, posts: 3200, comments: 8900 },
    subscribed: 'NotSubscribed' as const,
  };

  function renderPage(locationState?: object) {
    return render(
      <MemoryRouter
        initialEntries={[{ pathname: '/community/lemmy.world/linux/about', state: locationState }]}
      >
        <Routes>
          <Route
            path="/community/:instance/:name/about"
            element={<CommunityAboutPage auth={AUTH} />}
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });

  describe('CommunityAboutPage', () => {
    it('renders title and community info from location state without fetching', async () => {
      const { fetchCommunityInfo } = await import('../lib/lemmy');
      renderPage({ communityInfo: INFO });
      expect(screen.getByText('About c/linux')).toBeInTheDocument();
      expect(screen.getByText(/12,400 members/)).toBeInTheDocument();
      expect(fetchCommunityInfo).not.toHaveBeenCalled();
    });

    it('fetches community info when no location state is provided', async () => {
      const { fetchCommunityInfo } = await import('../lib/lemmy');
      (fetchCommunityInfo as ReturnType<typeof vi.fn>).mockResolvedValueOnce(INFO);
      renderPage();
      await screen.findByText(/12,400 members/);
      expect(fetchCommunityInfo).toHaveBeenCalledWith(
        'lemmy.world', 'tok', 'linux@lemmy.world',
      );
    });

    it('shows error message when fetch fails', async () => {
      const { fetchCommunityInfo } = await import('../lib/lemmy');
      (fetchCommunityInfo as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      );
      renderPage();
      await screen.findByText('Network error');
    });

    it('calls navigate(-1) when back button is clicked', () => {
      renderPage({ communityInfo: INFO });
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('renders description markdown', () => {
      renderPage({ communityInfo: INFO });
      expect(screen.getByText('Hello community')).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- CommunityAboutPage 2>&1 | tail -20
  ```

  Expected: FAIL — `CommunityAboutPage` does not exist yet.

- [ ] **Step 3: Create `CommunityAboutPage.tsx`**

  Create `src/components/CommunityAboutPage.tsx`:

  ```typescript
  import { useState, useEffect } from 'react';
  import { useParams, useLocation, useNavigate } from 'react-router-dom';
  import { fetchCommunityInfo, type CommunityInfo } from '../lib/lemmy';
  import { type AuthState } from '../lib/store';
  import MarkdownRenderer from './MarkdownRenderer';

  interface Props {
    auth: AuthState;
  }

  export default function CommunityAboutPage({ auth }: Props) {
    const { instance, name } = useParams<{ instance: string; name: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    const stateInfo = (location.state as { communityInfo?: CommunityInfo } | null)?.communityInfo;
    const [info, setInfo] = useState<CommunityInfo | null>(stateInfo ?? null);
    const [loading, setLoading] = useState(!stateInfo);
    const [error, setError] = useState('');

    useEffect(() => {
      if (stateInfo) return;
      fetchCommunityInfo(auth.instance, auth.token, `${name}@${instance}`)
        .then((data) => { setInfo(data); setLoading(false); })
        .catch((e) => { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false); });
    }, []);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a', color: '#f5f5f5' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 16px', height: 48, flexShrink: 0,
          background: '#1a1d24', borderBottom: '1px solid #2a2d35',
        }}>
          <button
            aria-label="Back"
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: '0 8px 0 0', lineHeight: 1 }}
          >
            ←
          </button>
          <div style={{ flex: 1, textAlign: 'center', color: '#f5f5f5', fontWeight: 600, fontSize: 15 }}>
            About c/{name}
          </div>
        </div>

        {loading && (
          <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>Loading...</div>
        )}
        {error && (
          <div style={{ padding: 24, color: '#ff6b35', textAlign: 'center' }}>{error}</div>
        )}

        {info && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {info.banner && (
              <div style={{ width: '100%', height: 120, overflow: 'hidden', flexShrink: 0 }}>
                <img
                  src={info.banner}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
            <div style={{ padding: '16px 16px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                {info.icon ? (
                  <img
                    src={info.icon}
                    alt=""
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2a2d35', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: '#2a2d35',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 18, color: '#f5f5f5', flexShrink: 0,
                  }}>
                    {name!.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                    {info.counts.subscribers.toLocaleString()} members · {info.counts.posts.toLocaleString()} posts
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #2a2d35', paddingTop: 16 }}>
                {info.description
                  ? <MarkdownRenderer content={info.description} />
                  : <div style={{ color: '#888', fontSize: 14 }}>No description.</div>
                }
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- CommunityAboutPage 2>&1 | tail -20
  ```

  Expected: all 5 CommunityAboutPage tests PASS.

- [ ] **Step 5: Add the route in `App.tsx`**

  Add the import at the top of `src/App.tsx` alongside the other imports:
  ```typescript
  import CommunityAboutPage from './components/CommunityAboutPage';
  ```

  Inside `AuthenticatedApp`, add the new route after the existing `/community/:instance/:name` route:
  ```tsx
  <Route
    path="/community/:instance/:name/about"
    element={<CommunityAboutPage auth={auth} />}
  />
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/CommunityAboutPage.tsx src/components/CommunityAboutPage.test.tsx src/App.tsx
  git commit -m "feat: add CommunityAboutPage with markdown description and route"
  ```

---

## Task 4: Refactor `CommunityHeader`

**Files:**
- Modify: `src/components/CommunityHeader.tsx`
- Modify: `src/components/CommunityHeader.test.tsx`

- [ ] **Step 1: Rewrite the tests**

  Replace the entire contents of `src/components/CommunityHeader.test.tsx` with:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, fireEvent } from '@testing-library/react';
  import CommunityHeader from './CommunityHeader';

  const mockNavigate = vi.fn();
  vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return { ...actual, useNavigate: () => mockNavigate };
  });

  const BASE_PROPS = {
    name: 'asklemmy',
    instance: 'lemmy.world',
    sortType: 'Active' as const,
    onSortChange: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });

  describe('CommunityHeader', () => {
    it('renders the community name', () => {
      render(<CommunityHeader {...BASE_PROPS} />);
      expect(screen.getByText('c/asklemmy')).toBeInTheDocument();
    });

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn();
      render(<CommunityHeader {...BASE_PROPS} onBack={onBack} />);
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('opens sort dropdown and calls onSortChange when an option is selected', () => {
      const onSortChange = vi.fn();
      render(<CommunityHeader {...BASE_PROPS} onSortChange={onSortChange} />);
      fireEvent.click(screen.getByRole('button', { name: /active/i }));
      fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
      expect(onSortChange).toHaveBeenCalledWith('Hot');
    });

    it('opens community menu when hamburger is clicked', () => {
      render(<CommunityHeader {...BASE_PROPS} />);
      fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
      expect(screen.getByRole('button', { name: /^post$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^subscribe$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^about$/i })).toBeInTheDocument();
    });

    it('navigates to create-post when Post is clicked in the menu', () => {
      render(<CommunityHeader {...BASE_PROPS} />);
      fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
      fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
      expect(mockNavigate).toHaveBeenCalledWith(
        '/create-post',
        { state: { community: 'asklemmy@lemmy.world' } },
      );
    });

    it('navigates to about page with communityInfo state when About is clicked', () => {
      const communityInfo = {
        id: 1, icon: undefined, banner: undefined, description: 'desc',
        counts: { subscribers: 100, posts: 50, comments: 200 },
        subscribed: 'NotSubscribed' as const,
      };
      render(<CommunityHeader {...BASE_PROPS} communityInfo={communityInfo} />);
      fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
      fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
      expect(mockNavigate).toHaveBeenCalledWith(
        '/community/lemmy.world/asklemmy/about',
        { state: { communityInfo } },
      );
    });

    it('calls onSubscribeToggle when Subscribe is clicked and communityInfo is loaded', () => {
      const onSubscribeToggle = vi.fn();
      const communityInfo = {
        id: 1, icon: undefined, banner: undefined, description: '',
        counts: { subscribers: 100, posts: 50, comments: 200 },
        subscribed: 'NotSubscribed' as const,
      };
      render(
        <CommunityHeader
          {...BASE_PROPS}
          communityInfo={communityInfo}
          onSubscribeToggle={onSubscribeToggle}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
      fireEvent.click(screen.getByRole('button', { name: /^subscribe$/i }));
      expect(onSubscribeToggle).toHaveBeenCalledTimes(1);
    });

    it('shows "Subscribed" label and subscribe button is highlighted when already subscribed', () => {
      const communityInfo = {
        id: 1, icon: undefined, banner: undefined, description: '',
        counts: { subscribers: 100, posts: 50, comments: 200 },
        subscribed: 'Subscribed' as const,
      };
      render(<CommunityHeader {...BASE_PROPS} communityInfo={communityInfo} />);
      fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
      expect(screen.getByRole('button', { name: /^subscribed$/i })).toBeInTheDocument();
    });

    it('disables subscribe button when communityInfo is not yet loaded', () => {
      render(<CommunityHeader {...BASE_PROPS} communityInfo={null} />);
      fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
      expect(screen.getByRole('button', { name: /^subscribe$/i })).toBeDisabled();
    });

    it('shows community icon image when communityInfo.icon is provided', () => {
      const communityInfo = {
        id: 1, icon: 'https://lemmy.world/icon.png', banner: undefined, description: '',
        counts: { subscribers: 100, posts: 50, comments: 200 },
        subscribed: 'NotSubscribed' as const,
      };
      render(<CommunityHeader {...BASE_PROPS} communityInfo={communityInfo} />);
      const img = document.querySelector('[data-testid="header-community-icon"]') as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.src).toBe('https://lemmy.world/icon.png');
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test -- CommunityHeader 2>&1 | tail -30
  ```

  Expected: multiple FAILs — `instance` prop doesn't exist, `useNavigate` not used, no menu.

- [ ] **Step 3: Rewrite `CommunityHeader.tsx`**

  Replace the entire contents of `src/components/CommunityHeader.tsx` with:

  ```typescript
  import { useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { type SortType, type CommunityInfo } from '../lib/lemmy';
  import { SORT_OPTIONS } from './HeaderBar';

  interface Props {
    name: string;
    instance: string;
    sortType: SortType;
    onSortChange: (sort: SortType) => void;
    onBack: () => void;
    communityInfo?: CommunityInfo | null;
    onSubscribeToggle?: () => void;
  }

  export default function CommunityHeader({
    name, instance, sortType, onSortChange, onBack, communityInfo, onSubscribeToggle,
  }: Props) {
    const navigate = useNavigate();
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const currentLabel = SORT_OPTIONS.find((o) => o.sort === sortType)?.label ?? sortType;
    const isSubscribed = communityInfo?.subscribed === 'Subscribed';

    function handleSortSelect(sort: SortType) {
      setShowSortDropdown(false);
      onSortChange(sort);
    }

    function handleMenuAction(action: 'post' | 'subscribe' | 'about') {
      setShowMenu(false);
      if (action === 'post') {
        navigate('/create-post', { state: { community: `${name}@${instance}` } });
      } else if (action === 'subscribe') {
        onSubscribeToggle?.();
      } else {
        navigate(`/community/${instance}/${name}/about`, { state: { communityInfo } });
      }
    }

    const menuItemStyle: React.CSSProperties = {
      background: '#2a2d35', border: 'none', borderRadius: 8,
      cursor: 'pointer', padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      color: '#f5f5f5', fontSize: 11, fontWeight: 500,
    };

    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 16px', height: 48, flexShrink: 0,
          background: '#1a1d24', borderBottom: '1px solid #2a2d35',
        }}>
          <button
            aria-label="Back"
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: '0 8px 0 0', lineHeight: 1 }}
          >
            ←
          </button>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', overflow: 'hidden',
            marginRight: 6, flexShrink: 0, background: '#2a2d35',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#f5f5f5',
          }}>
            {communityInfo?.icon
              ? <img
                  data-testid="header-community-icon"
                  src={communityInfo.icon}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              : name.charAt(0).toUpperCase()
            }
          </div>
          <div style={{ flex: 1, textAlign: 'center', color: '#f5f5f5', fontWeight: 600, fontSize: 15 }}>
            c/{name}
          </div>
          <button
            aria-label={`${currentLabel} ▾`}
            onClick={() => setShowSortDropdown((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: '#f5f5f5', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {currentLabel}
            <span style={{ color: '#888', fontSize: 11 }}>▾</span>
          </button>
          <button
            aria-label="Community menu"
            onClick={() => setShowMenu((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 12px', color: '#f5f5f5', fontSize: 18, lineHeight: 1 }}
          >
            ☰
          </button>
        </div>

        {showSortDropdown && (
          <>
            <div onClick={() => setShowSortDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
            <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30 }}>
              {SORT_OPTIONS.map(({ sort, label }) => (
                <button
                  key={sort}
                  onClick={() => handleSortSelect(sort)}
                  aria-label={label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '12px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid #1e2128', textAlign: 'left',
                    color: sort === sortType ? '#ff6b35' : '#f5f5f5',
                    fontWeight: sort === sortType ? 600 : 400, fontSize: 14,
                  }}
                >
                  <span style={{ width: 16, fontSize: 13 }}>{sort === sortType ? '✓' : ''}</span>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
            <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30, padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <button
                  aria-label="Post"
                  onClick={() => handleMenuAction('post')}
                  style={menuItemStyle}
                >
                  <span style={{ fontSize: 20 }}>✏️</span>
                  Post
                </button>
                <button
                  aria-label={isSubscribed ? 'Subscribed' : 'Subscribe'}
                  onClick={() => handleMenuAction('subscribe')}
                  disabled={!communityInfo}
                  style={{
                    ...menuItemStyle,
                    color: isSubscribed ? '#ff6b35' : '#f5f5f5',
                    border: isSubscribed ? '1px solid #ff6b35' : 'none',
                  }}
                >
                  <span style={{ fontSize: 20 }}>⭐</span>
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
                <button
                  aria-label="About"
                  onClick={() => handleMenuAction('about')}
                  style={menuItemStyle}
                >
                  <span style={{ fontSize: 20 }}>ℹ️</span>
                  About
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  npm test -- CommunityHeader 2>&1 | tail -20
  ```

  Expected: all CommunityHeader tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/CommunityHeader.tsx src/components/CommunityHeader.test.tsx
  git commit -m "feat: refactor CommunityHeader with hamburger menu, community icon, subscribe toggle"
  ```

---

## Task 5: Wire up community info in `FeedStack`

**Files:**
- Modify: `src/components/FeedStack.tsx`
- Modify: `src/components/FeedStack.test.tsx`

- [ ] **Step 1: Update the `lemmy` mock in `FeedStack.test.tsx`**

  In `src/components/FeedStack.test.tsx`, find the `vi.mock('../lib/lemmy', ...)` block at the top and add two new entries:

  ```typescript
  fetchCommunityInfo: vi.fn().mockResolvedValue({
    id: 99,
    icon: undefined,
    banner: undefined,
    description: 'A rust community',
    counts: { subscribers: 5000, posts: 200, comments: 800 },
    subscribed: 'NotSubscribed',
  }),
  followCommunity: vi.fn().mockResolvedValue(undefined),
  ```

- [ ] **Step 2: Fix the broken assertion in existing community mode test**

  In `FeedStack.test.tsx`, find the test `'renders CommunityHeader instead of MenuDrawer when community prop is set'`. Change:

  ```typescript
  expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
  ```

  to:

  ```typescript
  expect(screen.queryByRole('button', { name: /^menu$/i })).not.toBeInTheDocument();
  ```

  (The regex `^menu$` matches exactly "Menu" — the MenuDrawer's button — not "Community menu".)

- [ ] **Step 3: Add a test for community info being fetched and passed**

  In the `describe('FeedStack community mode', ...)` block, add:

  ```typescript
  it('calls fetchCommunityInfo on mount in community mode', async () => {
    const { fetchCommunityInfo } = await import('../lib/lemmy');
    render(
      <SettingsProvider>
        <FeedStack
          auth={AUTH}
          onLogout={vi.fn()}
          unreadCount={0}
          setUnreadCount={vi.fn()}
          community={{ name: 'rust', instance: 'lemmy.world' }}
        />
      </SettingsProvider>,
    );
    await waitFor(() => {
      expect(fetchCommunityInfo).toHaveBeenCalledWith(
        'lemmy.world', AUTH.token, 'rust@lemmy.world',
      );
    });
  });
  ```

- [ ] **Step 4: Run tests to confirm existing pass, new fails**

  ```bash
  npm test -- FeedStack 2>&1 | tail -30
  ```

  Expected: existing tests PASS; the new `fetchCommunityInfo` test FAILS.

- [ ] **Step 5: Update `FeedStack.tsx` — add imports**

  In `src/components/FeedStack.tsx`, update the lemmy import to add the new functions and type:

  ```typescript
  import {
    fetchPosts, fetchCommunityPosts, fetchUnreadCount, upvotePost, downvotePost,
    fetchCommunityInfo, followCommunity,
    type PostView, type SortType, type StakType, type CommunityInfo,
  } from '../lib/lemmy';
  ```

- [ ] **Step 6: Add `communityInfo` state and fetch effect in `FeedStack.tsx`**

  After the existing `const [stak, setStak] = useState...` line, add:

  ```typescript
  const [communityInfo, setCommunityInfo] = useState<CommunityInfo | null>(null);
  ```

  Then add a new `useEffect` directly after the existing `useEffect` for `fetchUnreadCount`:

  ```typescript
  useEffect(() => {
    if (!community) return;
    fetchCommunityInfo(auth.instance, auth.token, `${community.name}@${community.instance}`)
      .then(setCommunityInfo)
      .catch(() => {});
  }, []);
  ```

- [ ] **Step 7: Add `handleSubscribeToggle` in `FeedStack.tsx`**

  Add after the `loadMore` callback (before the `handleSortChange` function):

  ```typescript
  async function handleSubscribeToggle() {
    if (!communityInfo) return;
    const follow = communityInfo.subscribed !== 'Subscribed';
    const previous = communityInfo;
    setCommunityInfo({ ...communityInfo, subscribed: follow ? 'Subscribed' : 'NotSubscribed' });
    try {
      await followCommunity(auth.instance, auth.token, communityInfo.id, follow);
    } catch {
      setCommunityInfo(previous);
    }
  }
  ```

- [ ] **Step 8: Update the `CommunityHeader` call in `FeedStack.tsx`**

  Find the `<CommunityHeader ... />` JSX block and replace it with:

  ```tsx
  <CommunityHeader
    name={community.name}
    instance={community.instance}
    sortType={sortType}
    onSortChange={handleSortChange}
    onBack={() => navigate(-1)}
    communityInfo={communityInfo}
    onSubscribeToggle={handleSubscribeToggle}
  />
  ```

  (Remove the old `onCompose` prop — it no longer exists on `CommunityHeader`.)

- [ ] **Step 9: Run all tests**

  ```bash
  npm test 2>&1 | tail -30
  ```

  Expected: all tests PASS.

- [ ] **Step 10: Commit**

  ```bash
  git add src/components/FeedStack.tsx src/components/FeedStack.test.tsx
  git commit -m "feat: wire community info fetch and subscribe toggle into FeedStack"
  ```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full test suite**

  ```bash
  npm test 2>&1 | tail -20
  ```

  Expected: all tests PASS, 0 failures.

- [ ] **Step 2: TypeScript build check**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: build succeeds with no errors.

- [ ] **Step 3: Commit if anything was fixed**

  If the build surfaced type issues and you fixed them:
  ```bash
  git add -p
  git commit -m "fix: resolve TypeScript errors from community menu feature"
  ```
