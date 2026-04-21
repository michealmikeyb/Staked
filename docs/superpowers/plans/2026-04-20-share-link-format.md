# Share Link Format Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `shareLinkFormat` setting that controls whether the share button produces a Stakswipe URL, a source-instance Lemmy URL, or a home-instance Lemmy URL.

**Architecture:** Add `shareLinkFormat` to `AppSettings` and `DEFAULT_SETTINGS`; implement `buildShareUrl` in `urlUtils.ts` that encapsulates all three URL-building strategies; update `handleShare` in `PostCardShell.tsx` to call `buildShareUrl` using the active setting; add a pill-button card to `SettingsPage.tsx` that hides the Home Instance option when not authenticated.

**Tech Stack:** TypeScript, React 18, Vitest + @testing-library/react, localStorage settings persistence.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/store.ts` | Add `shareLinkFormat` field to `AppSettings` and `DEFAULT_SETTINGS` |
| `src/lib/urlUtils.ts` | Add `buildShareUrl` function |
| `src/lib/urlUtils.test.ts` | Add `buildShareUrl` test suite |
| `src/components/PostCardShell.tsx` | Update imports and `handleShare` to use `buildShareUrl` |
| `src/components/PostCardShell.test.tsx` | Add `buildShareUrl` to mock; add share format tests |
| `src/components/PostCard.test.tsx` | Add `buildShareUrl` to mock (no new tests) |
| `src/components/SettingsPage.tsx` | Add Share Link Format card |
| `src/components/SettingsPage.test.tsx` | Add Share Link Format card tests |

---

## Task 1: Add `shareLinkFormat` to `AppSettings`

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Add the field to `AppSettings` and `DEFAULT_SETTINGS`**

In `src/lib/store.ts`, update the interface and defaults:

```typescript
export interface AppSettings {
  nonUpvoteSwipeAction: 'downvote' | 'dismiss';
  swapGestures: boolean;
  blurNsfw: boolean;
  defaultSort: SortType;
  activeStak: StakType;
  anonInstance: string;
  commentSort: CommentSortType;
  showCommentSortBar: boolean;
  shareLinkFormat: 'stakswipe' | 'source' | 'home';
}

export const DEFAULT_SETTINGS: AppSettings = {
  nonUpvoteSwipeAction: 'downvote',
  swapGestures: false,
  blurNsfw: true,
  defaultSort: 'TopTwelveHour',
  activeStak: 'All',
  anonInstance: '',
  commentSort: 'Top',
  showCommentSortBar: true,
  shareLinkFormat: 'stakswipe',
};
```

No migration needed — `loadSettings` already does `{ ...DEFAULT_SETTINGS, ...parsed }`, so stored settings missing this key automatically get `'stakswipe'`.

- [ ] **Step 2: Run the existing store tests to verify nothing broke**

```bash
npm test -- src/lib/store.test.ts
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: add shareLinkFormat to AppSettings (default: stakswipe)"
```

---

## Task 2: Implement `buildShareUrl` (TDD)

**Files:**
- Modify: `src/lib/urlUtils.test.ts`
- Modify: `src/lib/urlUtils.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/urlUtils.test.ts`:

```typescript
import { buildShareUrl } from './urlUtils';

describe('buildShareUrl', () => {
  const POST = { id: 1, ap_id: 'https://lemmy.world/post/1' };
  const KBIN_POST = { id: 99, ap_id: 'https://kbin.social/m/mag/p/123/some-slug' };
  const AUTH = { instance: 'beehaw.org' };
  const COMMUNITY_ACTOR_ID = 'https://lemmy.world/c/linux';

  it('stakswipe + auth: uses auth.instance and post.id', () => {
    expect(buildShareUrl('stakswipe', POST, AUTH, COMMUNITY_ACTOR_ID))
      .toBe('https://stakswipe.com/#/post/beehaw.org/1');
  });

  it('stakswipe + no auth: uses source instance parsed from ap_id', () => {
    expect(buildShareUrl('stakswipe', POST, null, COMMUNITY_ACTOR_ID))
      .toBe('https://stakswipe.com/#/post/lemmy.world/1');
  });

  it('stakswipe + no auth + Kbin ap_id: falls back to community instance', () => {
    expect(buildShareUrl('stakswipe', KBIN_POST, null, COMMUNITY_ACTOR_ID))
      .toBe('https://stakswipe.com/#/post/lemmy.world/99');
  });

  it('source: returns native Lemmy URL on source instance', () => {
    expect(buildShareUrl('source', POST, AUTH, COMMUNITY_ACTOR_ID))
      .toBe('https://lemmy.world/post/1');
  });

  it('source + Kbin ap_id: falls back to raw ap_id string', () => {
    expect(buildShareUrl('source', KBIN_POST, AUTH, COMMUNITY_ACTOR_ID))
      .toBe('https://kbin.social/m/mag/p/123/some-slug');
  });

  it('home + auth: returns home instance URL', () => {
    expect(buildShareUrl('home', POST, AUTH, COMMUNITY_ACTOR_ID))
      .toBe('https://beehaw.org/post/1');
  });

  it('home + no auth: falls back to source URL', () => {
    expect(buildShareUrl('home', POST, null, COMMUNITY_ACTOR_ID))
      .toBe('https://lemmy.world/post/1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/lib/urlUtils.test.ts
```

Expected: FAIL — `buildShareUrl` is not exported from `./urlUtils`.

- [ ] **Step 3: Implement `buildShareUrl` in `urlUtils.ts`**

Append to `src/lib/urlUtils.ts` (after the existing `getShareUrl` function):

```typescript
export function buildShareUrl(
  format: 'stakswipe' | 'source' | 'home',
  post: { id: number; ap_id: string },
  auth: { instance: string } | null,
  communityActorId: string,
): string {
  const src = sourceFromApId(post.ap_id);
  const communityInstance = instanceFromActorId(communityActorId);

  if (format === 'home' && auth) {
    return `https://${auth.instance}/post/${post.id}`;
  }

  if (format === 'source' || format === 'home') {
    // home without auth falls back to source
    if (src) return `https://${src.instance}/post/${src.postId}`;
    return post.ap_id;
  }

  // stakswipe
  if (auth) return getShareUrl(auth.instance, post.id);
  const shareInstance = src?.instance ?? communityInstance;
  const sharePostId = src?.postId ?? post.id;
  return getShareUrl(shareInstance, sharePostId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/lib/urlUtils.test.ts
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/urlUtils.ts src/lib/urlUtils.test.ts
git commit -m "feat: add buildShareUrl with stakswipe/source/home format support"
```

---

## Task 3: Update `handleShare` in `PostCardShell` (TDD)

**Files:**
- Modify: `src/components/PostCardShell.test.tsx`
- Modify: `src/components/PostCard.test.tsx`
- Modify: `src/components/PostCardShell.tsx`

- [ ] **Step 1: Add `buildShareUrl` to the mock in `PostCardShell.test.tsx`**

Find the existing `vi.mock('../lib/urlUtils', ...)` block and replace it:

```typescript
vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return {
    ...actual,
    getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
    buildShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
  };
});
```

Also add this import near the top of `PostCardShell.test.tsx` (after the mock block):

```typescript
import { buildShareUrl } from '../lib/urlUtils';
```

- [ ] **Step 2: Add `buildShareUrl` to the mock in `PostCard.test.tsx`**

Find the existing `vi.mock('../lib/urlUtils', ...)` block and replace it:

```typescript
vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return {
    ...actual,
    getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
    buildShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
  };
});
```

- [ ] **Step 3: Write failing tests in `PostCardShell.test.tsx`**

Add a new `describe` block at the bottom of the outer `describe('PostCardShell', ...)` block:

```typescript
describe('share link format', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    });
  });

  it('calls buildShareUrl with stakswipe format by default', () => {
    renderShell();
    fireEvent.click(screen.getByTestId('share-button'));
    expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith('stakswipe', POST, AUTH, COMMUNITY.actor_id);
  });

  it('calls buildShareUrl with source format when shareLinkFormat=source', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ shareLinkFormat: 'source' }));
    renderShell();
    fireEvent.click(screen.getByTestId('share-button'));
    expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith('source', POST, AUTH, COMMUNITY.actor_id);
  });

  it('calls buildShareUrl with home format when shareLinkFormat=home', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ shareLinkFormat: 'home' }));
    renderShell();
    fireEvent.click(screen.getByTestId('share-button'));
    expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith('home', POST, AUTH, COMMUNITY.actor_id);
  });

  it('passes null auth when not authenticated', () => {
    renderShell({ auth: undefined });
    fireEvent.click(screen.getByTestId('share-button'));
    expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith('stakswipe', POST, null, COMMUNITY.actor_id);
  });
});
```

- [ ] **Step 4: Run tests to verify the new tests fail**

```bash
npm test -- src/components/PostCardShell.test.tsx
```

Expected: The four new `share link format` tests FAIL (existing tests pass).

- [ ] **Step 5: Update `PostCardShell.tsx` — imports and `handleShare`**

Update the import line (remove `getShareUrl` and `sourceFromApId`, add `buildShareUrl`):

```typescript
import { instanceFromActorId, isImageUrl, buildShareUrl } from '../lib/urlUtils';
```

Replace `handleShare`:

```typescript
const handleShare = () => {
  const url = buildShareUrl(settings.shareLinkFormat, post, auth ?? null, community.actor_id);
  share(post.name, url);
};
```

- [ ] **Step 6: Run all tests to verify everything passes**

```bash
npm test -- src/components/PostCardShell.test.tsx src/components/PostCard.test.tsx
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx src/components/PostCard.test.tsx
git commit -m "feat: use buildShareUrl in handleShare, driven by shareLinkFormat setting"
```

---

## Task 4: Add Share Link Format card to `SettingsPage` (TDD)

**Files:**
- Modify: `src/components/SettingsPage.test.tsx`
- Modify: `src/components/SettingsPage.tsx`

- [ ] **Step 1: Write failing tests in `SettingsPage.test.tsx`**

Add a new `describe` block inside the outer `describe('SettingsPage', ...)`:

```typescript
describe('Share Link Format card', () => {
  it('renders Share Link Format section', () => {
    renderPage();
    expect(screen.getByText('Share Link Format')).toBeInTheDocument();
  });

  it('Stakswipe pill is active (orange) by default', () => {
    renderPage();
    const card = screen.getByTestId('share-link-format-card');
    expect(within(card).getByRole('button', { name: /^stakswipe$/i })).toHaveStyle({ background: '#ff6b35' });
  });

  it('Source Instance pill is always shown for unauthenticated users', () => {
    renderPage({ isAuthenticated: false });
    const card = screen.getByTestId('share-link-format-card');
    expect(within(card).getByRole('button', { name: /^source instance$/i })).toBeInTheDocument();
  });

  it('Home Instance pill is shown when isAuthenticated is true', () => {
    renderPage({ isAuthenticated: true });
    const card = screen.getByTestId('share-link-format-card');
    expect(within(card).getByRole('button', { name: /^home instance$/i })).toBeInTheDocument();
  });

  it('Home Instance pill is not shown when isAuthenticated is false', () => {
    renderPage({ isAuthenticated: false });
    const card = screen.getByTestId('share-link-format-card');
    expect(within(card).queryByRole('button', { name: /^home instance$/i })).not.toBeInTheDocument();
  });

  it('clicking Source Instance pill updates shareLinkFormat to source', () => {
    renderPage();
    const card = screen.getByTestId('share-link-format-card');
    fireEvent.click(within(card).getByRole('button', { name: /^source instance$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.shareLinkFormat).toBe('source');
  });

  it('clicking Home Instance pill updates shareLinkFormat to home', () => {
    renderPage({ isAuthenticated: true });
    const card = screen.getByTestId('share-link-format-card');
    fireEvent.click(within(card).getByRole('button', { name: /^home instance$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.shareLinkFormat).toBe('home');
  });

  it('clicking Stakswipe pill updates shareLinkFormat to stakswipe', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ shareLinkFormat: 'source' }));
    renderPage();
    const card = screen.getByTestId('share-link-format-card');
    fireEvent.click(within(card).getByRole('button', { name: /^stakswipe$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.shareLinkFormat).toBe('stakswipe');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/components/SettingsPage.test.tsx
```

Expected: All eight new tests FAIL with "Unable to find an element with the text: 'Share Link Format'".

- [ ] **Step 3: Add the card to `SettingsPage.tsx`**

Insert this block inside the scrollable `<div>` in `SettingsPage.tsx`, before the Anonymous Feed card (before the `<div style={card}>` block that contains `<div style={sectionLabel}>Anonymous Feed</div>`):

```tsx
<div data-testid="share-link-format-card" style={card}>
  <div style={sectionLabel}>Share Link Format</div>
  <div style={{ display: 'flex', gap: 8 }}>
    <button
      style={settings.shareLinkFormat === 'stakswipe' ? active : inactive}
      onClick={() => updateSetting('shareLinkFormat', 'stakswipe')}
    >
      Stakswipe
    </button>
    <button
      style={settings.shareLinkFormat === 'source' ? active : inactive}
      onClick={() => updateSetting('shareLinkFormat', 'source')}
    >
      Source Instance
    </button>
    {isAuthenticated && (
      <button
        style={settings.shareLinkFormat === 'home' ? active : inactive}
        onClick={() => updateSetting('shareLinkFormat', 'home')}
      >
        Home Instance
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/components/SettingsPage.test.tsx
```

Expected: All pass.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPage.tsx src/components/SettingsPage.test.tsx
git commit -m "feat: add Share Link Format card to SettingsPage"
```
