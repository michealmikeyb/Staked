# Markdown Rendering & Text Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proper markdown rendering (links, blockquotes, code, Lemmy spoilers) to post bodies; unify comment rendering through a shared component; improve text contrast and enable text selection on mobile.

**Architecture:** A new `MarkdownRenderer` component wraps `react-markdown` with `remark-gfm`, `remark-directive`, and a custom spoiler plugin. Both post bodies (currently raw text) and comments (currently inline ReactMarkdown) are migrated to use it. CSS changes to the card remove the `user-select: none` block that prevents mobile text copying.

**Tech Stack:** react-markdown v10, remark-gfm v4, remark-directive (new), CSS Modules

**Baseline:** 26 test files, 271 tests — all passing. Run `npm test` after each task to confirm no regressions.

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/components/MarkdownRenderer.tsx` | Shared markdown renderer component |
| Create | `src/components/MarkdownRenderer.module.css` | Styles for markdown elements |
| Create | `src/components/MarkdownRenderer.test.tsx` | Tests for MarkdownRenderer |
| Modify | `src/components/PostCard.tsx` | Use MarkdownRenderer for post body |
| Modify | `src/components/PostCard.module.css` | Higher contrast excerpt; remove user-select: none |
| Modify | `src/components/PostCard.test.tsx` | Add markdown body rendering test |
| Modify | `src/components/PostDetailCard.tsx` | Use MarkdownRenderer for post body |
| Modify | `src/components/CommentItem.tsx` | Use MarkdownRenderer instead of inline ReactMarkdown |
| Modify | `src/components/CommentItem.module.css` | Add user-select: text to .body |

---

## Task 1: Install remark-directive

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install remark-directive
```

- [ ] **Step 2: Verify it installed**

```bash
ls node_modules/remark-directive/index.js
```

Expected: file exists (no error)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install remark-directive for spoiler support"
```

---

## Task 2: Write MarkdownRenderer tests (failing)

**Files:**
- Create: `src/components/MarkdownRenderer.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/components/MarkdownRenderer.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownRenderer from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders a link with target="_blank" and rel="noopener noreferrer"', () => {
    render(<MarkdownRenderer content="[Click here](https://example.com)" />);
    const link = screen.getByRole('link', { name: 'Click here' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders a blockquote for > prefix', () => {
    render(<MarkdownRenderer content="> this is a quote" />);
    expect(document.querySelector('blockquote')).toBeInTheDocument();
    expect(screen.getByText('this is a quote')).toBeInTheDocument();
  });

  it('renders inline code', () => {
    render(<MarkdownRenderer content="use `npm install` to install" />);
    const code = document.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toBe('npm install');
  });

  it('renders a fenced code block as pre', () => {
    render(<MarkdownRenderer content={"```\nconst x = 1;\n```"} />);
    expect(document.querySelector('pre')).toBeInTheDocument();
  });

  it('renders a spoiler as a details element with summary', () => {
    render(
      <MarkdownRenderer content={":::spoiler Click to reveal\nhidden content\n:::"} />,
    );
    const details = document.querySelector('details');
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('Click to reveal')).toBeInTheDocument();
    expect(screen.getByText('hidden content')).toBeInTheDocument();
  });

  it('applies the provided className to the wrapper div', () => {
    const { container } = render(<MarkdownRenderer content="hello" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/components/MarkdownRenderer.test.tsx
```

Expected: error — `Cannot find module './MarkdownRenderer'`

---

## Task 3: Implement MarkdownRenderer

**Files:**
- Create: `src/components/MarkdownRenderer.tsx`
- Create: `src/components/MarkdownRenderer.module.css`

- [ ] **Step 1: Create the CSS file**

```css
/* src/components/MarkdownRenderer.module.css */
.markdown a {
  color: var(--accent);
  text-decoration: underline;
}

.markdown blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 10px;
  color: var(--text-secondary);
  font-style: italic;
  margin: 6px 0;
}

.markdown code {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 1px 4px;
  font-family: monospace;
  font-size: 0.9em;
}

.markdown pre {
  background: #0d0f14;
  border-radius: 6px;
  padding: 10px;
  overflow-x: auto;
  margin: 6px 0;
}

.markdown pre code {
  background: none;
  padding: 0;
  font-size: 0.85rem;
}

.markdown details {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 8px 12px;
  margin: 6px 0;
}

.markdown summary {
  cursor: pointer;
  color: var(--accent);
  font-weight: 600;
  user-select: none;
}

.markdown table {
  border-collapse: collapse;
  width: 100%;
  margin: 6px 0;
  font-size: 0.85em;
  overflow-x: auto;
  display: block;
}

.markdown th,
.markdown td {
  border: 1px solid var(--border);
  padding: 4px 8px;
  text-align: left;
}

.markdown th {
  background: rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 2: Create the component**

```tsx
// src/components/MarkdownRenderer.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import styles from './MarkdownRenderer.module.css';

// Lemmy posts use `:::spoiler title` (space) but remark-directive expects `:::name[label]`
function preprocessSpoilers(text: string): string {
  return text.replace(/^:::spoiler\s+(.+)$/gm, ':::spoiler[$1]');
}

// Converts :::spoiler[label] container directives to <details>/<summary> HTML nodes
function remarkLemmySpoiler() {
  return (tree: any) => {
    visit(tree, 'containerDirective', (node: any) => {
      if (node.name !== 'spoiler') return;
      const label = node.attributes?.label ?? 'Spoiler';
      node.data = { hName: 'details', hProperties: {} };
      node.children.unshift({
        type: 'paragraph',
        data: { hName: 'summary' },
        children: [{ type: 'text', value: label }],
      });
    });
  };
}

interface Props {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className }: Props) {
  const processed = preprocessSpoilers(content);
  const wrapperClass = [styles.markdown, className].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDirective, remarkLemmySpoiler]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? ''}
              loading="lazy"
              style={{ maxWidth: '100%', height: 'auto', borderRadius: 6, display: 'block', marginTop: 6 }}
            />
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 3: Run MarkdownRenderer tests**

```bash
npm test -- --reporter=verbose src/components/MarkdownRenderer.test.tsx
```

Expected: 6 tests pass

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: 26 test files, 277 tests — all passing

- [ ] **Step 5: Commit**

```bash
git add src/components/MarkdownRenderer.tsx src/components/MarkdownRenderer.module.css src/components/MarkdownRenderer.test.tsx
git commit -m "feat: add MarkdownRenderer component with spoiler support"
```

---

## Task 4: Update PostCard body rendering

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.module.css`
- Modify: `src/components/PostCard.test.tsx`

- [ ] **Step 1: Add a failing test for markdown in post body**

In `src/components/PostCard.test.tsx`, add this test inside the existing `describe('PostCard link banner', ...)` block, after the last `it(...)` in that block:

```tsx
  it('renders a link in the post body as an anchor tag', () => {
    const MARKDOWN_POST = {
      post: { id: 5, name: 'Markdown post', body: 'Visit [example](https://example.com)', url: null, thumbnail_url: null },
      community: { name: 'general', actor_id: 'https://lemmy.world/c/general' },
      creator: { name: 'frank', actor_id: 'https://lemmy.world/u/frank', avatar: undefined },
      counts: { score: 1, comments: 0 },
    } as unknown as PostView;

    render(
      <PostCard post={MARKDOWN_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onUndo={vi.fn()} onSave={vi.fn()} />,
    );
    const link = screen.getByRole('link', { name: 'example' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose src/components/PostCard.test.tsx
```

Expected: new test fails — `Unable to find an accessible element with the role "link"` (body is rendered as raw text)

- [ ] **Step 3: Update PostCard.tsx to use MarkdownRenderer**

In `src/components/PostCard.tsx`, add the import after line 16 (`import Toast from './Toast';`):

```tsx
import MarkdownRenderer from './MarkdownRenderer';
```

Then replace line 278:
```tsx
        {p.body && <div className={styles.excerpt}>{p.body}</div>}
```
with:
```tsx
        {p.body && <MarkdownRenderer content={p.body} className={styles.excerpt} />}
```

- [ ] **Step 4: Update PostCard.module.css for contrast and text selection**

In `src/components/PostCard.module.css`:

Change `.excerpt` color (line 111):
```css
.excerpt {
  padding: 10px 16px;
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.5;
  user-select: text;
}
```

Remove `user-select: none` from `.card` (line 12) — the full `.card` rule becomes:
```css
.card {
  position: absolute;
  width: 92vw;
  max-width: 440px;
  height: calc(100dvh - 48px);
  border-radius: 20px;
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: grab;
  /* pan-y: browser handles vertical scroll natively; horizontal drag handled by useDrag */
  touch-action: pan-y;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --reporter=verbose src/components/PostCard.test.tsx
```

Expected: all PostCard tests pass (including new one)

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: 26 test files, 272 tests — all passing

- [ ] **Step 7: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.module.css src/components/PostCard.test.tsx
git commit -m "feat: render post body as markdown, improve contrast and enable text selection"
```

---

## Task 5: Update PostDetailCard body rendering

**Files:**
- Modify: `src/components/PostDetailCard.tsx`

- [ ] **Step 1: Add the MarkdownRenderer import**

In `src/components/PostDetailCard.tsx`, add after the existing imports (after line 10, `import { useShare } from '../hooks/useShare';`):

```tsx
import MarkdownRenderer from './MarkdownRenderer';
```

- [ ] **Step 2: Replace the raw body render**

Find line 156:
```tsx
        {post.body && <div className={styles.excerpt}>{post.body}</div>}
```

Replace with:
```tsx
        {post.body && <MarkdownRenderer content={post.body} className={styles.excerpt} />}
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: 26 test files, 272 tests — all passing

- [ ] **Step 4: Commit**

```bash
git add src/components/PostDetailCard.tsx
git commit -m "feat: render PostDetailCard body as markdown"
```

---

## Task 6: Update CommentItem to use MarkdownRenderer

**Files:**
- Modify: `src/components/CommentItem.tsx`
- Modify: `src/components/CommentItem.module.css`

- [ ] **Step 1: Update the import in CommentItem.tsx**

In `src/components/CommentItem.tsx`, remove these two import lines:
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
```

Add in their place:
```tsx
import MarkdownRenderer from './MarkdownRenderer';
```

- [ ] **Step 2: Replace the inline ReactMarkdown with MarkdownRenderer**

Find lines 87–91:
```tsx
      <div className={styles.body}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {overrideContent ?? cv.comment.content}
        </ReactMarkdown>
      </div>
```

Replace with:
```tsx
      <MarkdownRenderer
        content={overrideContent ?? cv.comment.content}
        className={styles.body}
      />
```

- [ ] **Step 3: Add user-select: text to .body in CommentItem.module.css**

In `src/components/CommentItem.module.css`, update the `.body` rule (lines 43–47):
```css
.body {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.5;
  user-select: text;
}
```

- [ ] **Step 4: Run CommentItem tests**

```bash
npm test -- --reporter=verbose src/components/CommentItem.test.tsx
```

Expected: all 13 CommentItem tests pass

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: 26 test files, 272 tests — all passing

- [ ] **Step 6: Commit**

```bash
git add src/components/CommentItem.tsx src/components/CommentItem.module.css
git commit -m "feat: migrate CommentItem to MarkdownRenderer, enable text selection"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Clickable links open in new tab | Task 3 (MarkdownRenderer `a` component) |
| Blockquotes render with `>` prefix | Task 3 (CSS + ReactMarkdown GFM) |
| Lemmy spoilers as `<details>/<summary>` | Task 3 (remarkLemmySpoiler plugin) |
| Higher contrast text below card content | Task 4 (`.excerpt` color change) |
| Text copyable on mobile | Tasks 4+6 (remove `user-select: none`, add `user-select: text`) |
| Markdown applies to post body | Tasks 4+5 (PostCard + PostDetailCard) |
| Markdown applies to comments | Task 6 (CommentItem) |

No gaps found.

**Placeholder scan:** No TBDs, TODOs, or vague steps. All steps include exact file paths and complete code.

**Type consistency:** `MarkdownRenderer` props (`content: string`, `className?: string`) are used consistently across Tasks 3–6. The `wrapperClass` construction is internal to the component. No cross-task type drift.
