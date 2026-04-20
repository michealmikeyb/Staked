# ProfileHeader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a `ProfileHeader` component that replaces ProfilePage's two-section header (MenuDrawer + profile info div) with a single unified 48px bar matching CommunityHeader's pattern.

**Architecture:** New `ProfileHeader` component owns all header UI state (showMenu, showConfirm, blocking, blockError) and receives an `onBlock` async callback from `ProfilePage`. When `onBlock` is omitted the hamburger is hidden (own-profile case). `ProfilePage` retains `handleBlockPerson` and `personId` state unchanged.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/ProfileHeader.tsx` | **Create** | 48px unified header bar: back, title, hamburger, menu/confirm overlays |
| `src/components/ProfileHeader.test.tsx` | **Create** | Unit tests for ProfileHeader in isolation |
| `src/components/ProfilePage.tsx` | **Modify** | Replace MenuDrawer + profile info div with `<ProfileHeader>` |
| `src/components/ProfilePage.test.tsx` | **Modify** | Update header-related assertions to match new structure |

---

## Task 1: ProfileHeader component (TDD)

**Files:**
- Create: `src/components/ProfileHeader.tsx`
- Create: `src/components/ProfileHeader.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/ProfileHeader.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileHeader from './ProfileHeader';

describe('ProfileHeader', () => {
  const onBack = vi.fn();

  it('renders u/username@instance', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} />);
    expect(screen.getByText('u/alice@lemmy.world')).toBeInTheDocument();
  });

  it('does not show hamburger when onBlock is undefined', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} />);
    expect(screen.queryByRole('button', { name: /profile menu/i })).not.toBeInTheDocument();
  });

  it('shows hamburger when onBlock is provided', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={vi.fn()} />);
    expect(screen.getByRole('button', { name: /profile menu/i })).toBeInTheDocument();
  });

  it('clicking hamburger opens menu panel with Block button', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    expect(screen.getByRole('button', { name: /^block$/i })).toBeInTheDocument();
  });

  it('clicking Block in menu opens confirm panel', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    expect(screen.getByText('Block u/alice?')).toBeInTheDocument();
  });

  it('confirm panel shows correct username', () => {
    render(<ProfileHeader username="bob" instance="beehaw.org" onBack={onBack} onBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    expect(screen.getByText('Block u/bob?')).toBeInTheDocument();
  });

  it('cancel closes confirm panel', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Block u/alice?')).not.toBeInTheDocument();
  });

  it('successful block calls onBlock and closes confirm panel', async () => {
    const onBlock = vi.fn().mockResolvedValue(undefined);
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={onBlock} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(onBlock).toHaveBeenCalledOnce());
    expect(screen.queryByText('Block u/alice?')).not.toBeInTheDocument();
  });

  it('failed block shows error and keeps panel open', async () => {
    const onBlock = vi.fn().mockRejectedValue(new Error('fail'));
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={onBlock} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(screen.getByText('Failed to block. Try again.')).toBeInTheDocument());
    expect(screen.getByText('Block u/alice?')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- ProfileHeader
```

Expected: FAIL — `Cannot find module './ProfileHeader'`

- [ ] **Step 3: Implement ProfileHeader**

Create `src/components/ProfileHeader.tsx`:

```tsx
import { useState } from 'react';

interface Props {
  username: string;
  instance: string;
  onBack: () => void;
  onBlock?: () => Promise<void>;
}

export default function ProfileHeader({ username, instance, onBack, onBlock }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState('');

  const menuItemStyle: React.CSSProperties = {
    background: '#2a2d35', border: 'none', borderRadius: 8,
    cursor: 'pointer', padding: '10px 4px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    color: '#f5f5f5', fontSize: 11, fontWeight: 500,
  };

  async function handleBlock() {
    setBlocking(true);
    setBlockError('');
    try {
      await onBlock?.();
      setShowConfirm(false);
    } catch {
      setBlockError('Failed to block. Try again.');
    } finally {
      setBlocking(false);
    }
  }

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
        <div style={{ flex: 1, textAlign: 'center', color: '#f5f5f5', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          u/{username}@{instance}
        </div>
        {onBlock && (
          <button
            aria-label="Profile menu"
            onClick={() => { setShowMenu((v) => !v); setShowConfirm(false); setBlockError(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 18, padding: '0 0 0 12px', lineHeight: 1 }}
          >
            ☰
          </button>
        )}
      </div>

      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30, padding: 12 }}>
            <button
              aria-label="Block"
              onClick={() => { setShowMenu(false); setShowConfirm(true); }}
              style={{ ...menuItemStyle, width: '100%' }}
            >
              <span style={{ fontSize: 20 }}>🚫</span>
              Block
            </button>
          </div>
        </>
      )}

      {showConfirm && (
        <>
          <div onClick={() => { setShowConfirm(false); setBlockError(''); }} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30, padding: 16 }}>
            <div style={{ color: '#f5f5f5', fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
              Block u/{username}?
            </div>
            {blockError && (
              <div style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{blockError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                aria-label="Cancel"
                onClick={() => { setShowConfirm(false); setBlockError(''); }}
                style={{ flex: 1, padding: '10px 0', background: '#2a2d35', border: 'none', borderRadius: 8, color: '#f5f5f5', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                aria-label="Block"
                onClick={handleBlock}
                disabled={blocking}
                style={{ flex: 1, padding: '10px 0', background: '#cc2222', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: blocking ? 'not-allowed' : 'pointer', fontSize: 14, opacity: blocking ? 0.6 : 1 }}
              >
                {blocking ? '…' : 'Block'}
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
npm test -- ProfileHeader
```

Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfileHeader.tsx src/components/ProfileHeader.test.tsx
git commit -m "feat: add ProfileHeader component with block flow"
```

---

## Task 2: Update ProfilePage to use ProfileHeader

**Files:**
- Modify: `src/components/ProfilePage.tsx`
- Modify: `src/components/ProfilePage.test.tsx`

- [ ] **Step 1: Update ProfilePage.tsx**

Replace the imports at the top — remove `MenuDrawer`, add `ProfileHeader`:

```tsx
import ProfileHeader from './ProfileHeader';
```

Remove the `MenuDrawer` import line entirely:
```tsx
// remove: import MenuDrawer from './MenuDrawer';
```

Remove these state declarations (lines ~35–38):
```tsx
// remove:
const [showMenu, setShowMenu] = useState(false);
const [showConfirm, setShowConfirm] = useState(false);
const [blocking, setBlocking] = useState(false);
const [blockError, setBlockError] = useState('');
```

Remove the `menuItemStyle` constant (lines ~116–121):
```tsx
// remove:
const menuItemStyle: React.CSSProperties = {
  background: '#2a2d35', border: 'none', borderRadius: 8,
  cursor: 'pointer', padding: '10px 4px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  color: '#f5f5f5', fontSize: 11, fontWeight: 500,
};
```

In the JSX `return`, replace the `<MenuDrawer ...>` line and the entire profile info `<div>` block (including the two overlay panels for showMenu and showConfirm) with a single `<ProfileHeader>`:

```tsx
<ProfileHeader
  username={displayUsername}
  instance={displayInstance}
  onBack={() => navigate(-1)}
  onBlock={target && !(target.username === auth.username && target.instance === auth.instance)
    ? handleBlockPerson
    : undefined}
/>
```

The full top of the JSX `return` should now look like:

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
    <ProfileHeader
      username={displayUsername}
      instance={displayInstance}
      onBack={() => navigate(-1)}
      onBlock={target && !(target.username === auth.username && target.instance === auth.instance)
        ? handleBlockPerson
        : undefined}
    />

    <div style={{ display: 'flex', borderBottom: '2px solid #2a2d35', background: '#1a1d24' }}>
      {/* ... tabs ... */}
```

- [ ] **Step 2: Run ProfilePage tests to see what breaks**

```bash
npm test -- ProfilePage
```

Expected: some failures on header-related assertions (`u/alice`, `lemmy.world`, `u/bob`, `beehaw.org` checked separately).

- [ ] **Step 3: Update ProfilePage.test.tsx header assertions**

In the `ProfilePage` describe block, update "renders username and instance":

```tsx
it('renders username and instance', async () => {
  renderPage();
  await waitFor(() => screen.getByText('My Terminal Setup'));
  expect(screen.getByText('u/alice@lemmy.world')).toBeInTheDocument();
});
```

In the `ProfilePage with target prop` describe block, update "shows target username and instance in header":

```tsx
it('shows target username and instance in header', async () => {
  const { fetchPersonDetails } = await import('../lib/lemmy');
  (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ posts: [], comments: [], personId: null });
  render(
    <MemoryRouter initialEntries={['/user/beehaw.org/bob']}>
      <ProfilePage auth={mockAuth} target={{ username: 'bob', instance: 'beehaw.org' }} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
  expect(screen.getByText('u/bob@beehaw.org')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run all tests to confirm everything passes**

```bash
npm test
```

Expected: all tests pass (same 3 pre-existing empty-state failures in FeedStack are acceptable — they pre-date this change).

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfilePage.tsx src/components/ProfilePage.test.tsx
git commit -m "refactor: replace ProfilePage two-section header with ProfileHeader component"
```
