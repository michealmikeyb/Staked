# Direct Post Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user pastes a Lemmy post URL or Stakswipe share URL into the search input, show a "Go to post" chip that navigates directly to the post viewer.

**Architecture:** Add `parsePostUrl` to `urlUtils.ts` to detect URLs on `onChange`; `SearchPage` stores the parsed result in `directPost` state and renders a chip when set; clicking the chip navigates to `/view/:instance/:postId` with no API call.

**Tech Stack:** React 18, TypeScript, react-router-dom (HashRouter), Vitest + @testing-library/react

---

## File Map

| File | Change |
|---|---|
| `src/lib/urlUtils.ts` | Add `parsePostUrl` export |
| `src/lib/urlUtils.test.ts` | Add `parsePostUrl` tests |
| `src/components/SearchPage.tsx` | Add `directPost` state, onChange handler, chip UI, disable Search when chip visible |
| `src/components/SearchPage.test.tsx` | Add chip appearance, chip click, Search disabled tests |

---

### Task 1: Add `parsePostUrl` to urlUtils with tests (TDD)

**Files:**
- Modify: `src/lib/urlUtils.test.ts`
- Modify: `src/lib/urlUtils.ts`

- [ ] **Step 1: Write failing tests for `parsePostUrl`**

Add to `src/lib/urlUtils.test.ts` (after existing `getShareUrl` describe block):

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { getShareUrl, parsePostUrl } from './urlUtils';
```

```ts
describe('parsePostUrl', () => {
  it('parses a full Lemmy URL with protocol', () => {
    expect(parsePostUrl('https://lemmy.world/post/2395953')).toEqual({
      instance: 'lemmy.world',
      postId: 2395953,
    });
  });

  it('parses a Lemmy URL without protocol', () => {
    expect(parsePostUrl('lemmy.world/post/42')).toEqual({
      instance: 'lemmy.world',
      postId: 42,
    });
  });

  it('parses a Stakswipe share URL', () => {
    expect(parsePostUrl('https://stakswipe.com/#/post/lemmy.world/2395953')).toEqual({
      instance: 'lemmy.world',
      postId: 2395953,
    });
  });

  it('returns null for a plain search query', () => {
    expect(parsePostUrl('rust programming')).toBeNull();
  });

  it('returns null for a community URL', () => {
    expect(parsePostUrl('https://lemmy.world/c/rust')).toBeNull();
  });

  it('returns null for a Lemmy URL with non-numeric post ID', () => {
    expect(parsePostUrl('https://lemmy.world/post/abc')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parsePostUrl('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose urlUtils
```

Expected: 7 failures — `parsePostUrl is not a function` or similar import error.

- [ ] **Step 3: Implement `parsePostUrl` in urlUtils.ts**

Add to `src/lib/urlUtils.ts` (after the existing exports):

```ts
export function parsePostUrl(query: string): { instance: string; postId: number } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Stakswipe share URL: https://stakswipe.com/#/post/lemmy.world/2395953
  const stakswiperMatch = trimmed.match(/#\/post\/([^/]+)\/(\d+)/);
  if (stakswiperMatch) {
    const postId = parseInt(stakswiperMatch[2], 10);
    return isNaN(postId) ? null : { instance: stakswiperMatch[1], postId };
  }

  // Lemmy post URL: https://lemmy.world/post/2395953 or lemmy.world/post/2395953
  try {
    const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    const parts = url.pathname.split('/');
    // pathname should be /post/<number>
    if (parts.length === 3 && parts[1] === 'post') {
      const postId = parseInt(parts[2], 10);
      return isNaN(postId) ? null : { instance: url.hostname, postId };
    }
  } catch {
    // not a URL
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose urlUtils
```

Expected: 9 tests pass (2 existing + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/urlUtils.ts src/lib/urlUtils.test.ts
git commit -m "feat: add parsePostUrl to detect Lemmy and Stakswipe post URLs"
```

---

### Task 2: Add directPost state and chip to SearchPage (TDD)

**Files:**
- Modify: `src/components/SearchPage.test.tsx`
- Modify: `src/components/SearchPage.tsx`

- [ ] **Step 1: Write failing tests for chip behavior**

Add to `src/components/SearchPage.test.tsx` (inside the existing `describe('SearchPage', ...)` block, after existing tests):

```ts
it('shows "Go to post" chip when a Lemmy post URL is typed', () => {
  renderPage();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'https://lemmy.world/post/2395953' },
  });
  expect(screen.getByText(/Go to post/)).toBeInTheDocument();
});

it('shows "Go to post" chip for a URL without protocol', () => {
  renderPage();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'lemmy.world/post/42' },
  });
  expect(screen.getByText(/Go to post/)).toBeInTheDocument();
});

it('shows "Go to post" chip for a Stakswipe share URL', () => {
  renderPage();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'https://stakswipe.com/#/post/lemmy.world/2395953' },
  });
  expect(screen.getByText(/Go to post/)).toBeInTheDocument();
});

it('does not show "Go to post" chip for a plain text query', () => {
  renderPage();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'rust programming' },
  });
  expect(screen.queryByText(/Go to post/)).not.toBeInTheDocument();
});

it('chip click navigates to /view/:instance/:postId', () => {
  renderPage();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'https://lemmy.world/post/2395953' },
  });
  fireEvent.click(screen.getByText(/Go to post/));
  expect(mockNavigate).toHaveBeenCalledWith('/view/lemmy.world/2395953');
});

it('disables Search button when a URL is detected', () => {
  renderPage();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'https://lemmy.world/post/2395953' },
  });
  expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
});

it('hides chip and re-enables Search when input changes to non-URL', () => {
  renderPage();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'https://lemmy.world/post/2395953' },
  });
  expect(screen.getByText(/Go to post/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'rust' },
  });
  expect(screen.queryByText(/Go to post/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /search/i })).not.toBeDisabled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose SearchPage
```

Expected: 7 new failures — chip not found / Search not disabled.

- [ ] **Step 3: Update SearchPage to add directPost state and onChange detection**

In `src/components/SearchPage.tsx`, add the import for `parsePostUrl` at the top:

```ts
import { instanceFromActorId, sourceFromApId, isImageUrl, placeholderColor, parsePostUrl } from '../lib/urlUtils';
```

Add `directPost` state after the existing state declarations (around line 28):

```ts
const [directPost, setDirectPost] = useState<{ instance: string; postId: number } | null>(null);
```

Replace the existing `onChange` on the input (currently inline `onChange={(e) => setQuery(e.target.value)}`) with:

```tsx
onChange={(e) => {
  const val = e.target.value;
  setQuery(val);
  setDirectPost(parsePostUrl(val));
}}
```

Update the Search button `disabled` condition (currently `loading || !query.trim()`) to also disable when a URL is detected:

```tsx
disabled={loading || !query.trim() || !!directPost}
```

- [ ] **Step 4: Add the chip UI below the form**

In `src/components/SearchPage.tsx`, add the chip between the closing `</form>` tag and the `{searched && ...}` tabs block:

```tsx
{directPost && (
  <div style={{ padding: '8px 12px 0' }}>
    <button
      onClick={() => navigate(`/view/${directPost.instance}/${directPost.postId}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '12px 14px', borderRadius: 12,
        border: '1px solid #2a2d35', background: '#1e2128',
        color: '#ff6b35', fontWeight: 600, fontSize: 14,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span>🔗</span>
      <span>Go to post →</span>
    </button>
  </div>
)}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose SearchPage
```

Expected: all 15 tests pass (8 existing + 7 new).

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/SearchPage.tsx src/components/SearchPage.test.tsx
git commit -m "feat: show Go to post chip in search when URL is detected"
```
