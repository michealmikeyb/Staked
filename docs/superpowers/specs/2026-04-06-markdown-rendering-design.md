# Markdown Rendering & Text Selection Design

**Date:** 2026-04-06
**Status:** Approved

## Overview

Add proper markdown rendering to post bodies and unify comment rendering through a shared component. Improve text contrast in post bodies, support Lemmy's `:::spoiler` syntax, and enable text copying on mobile by adjusting CSS gesture handling.

## Goals

- Post body text renders markdown (links, blockquotes, bold, code, spoilers) in both `PostCard` and `PostDetailCard`
- Comments render spoilers, blockquotes, and code correctly (links already work via `remarkGfm`)
- Text in post bodies and comments is copyable on mobile
- Text under card content (post body) has higher contrast
- Lemmy spoiler blocks (`:::spoiler title\ncontent\n:::`) render as collapsed `<details>/<summary>` elements

## New Dependency

- `remark-directive` — parses `:::` container blocks; used to handle Lemmy's spoiler syntax

## Architecture

### `MarkdownRenderer` component

**File:** `src/components/MarkdownRenderer.tsx`
**CSS:** `src/components/MarkdownRenderer.module.css`

Wraps `react-markdown` with:
- `remark-gfm` — tables, strikethrough, task lists, autolink literals
- `remark-directive` — parses `:::spoiler title\ncontent\n:::` container blocks
- A small inline remark plugin that converts `spoiler` container directives into `<details>/<summary>` hast nodes

Custom ReactMarkdown `components`:
- `a` — opens all links with `target="_blank" rel="noopener noreferrer"`
- `img` — `max-width: 100%`, `height: auto`, `border-radius: 6px`, `loading="lazy"`
- `details` / `summary` — styled collapsible spoiler, closed by default

Props:
```ts
interface Props {
  content: string;
  className?: string;
}
```

### CSS — `MarkdownRenderer.module.css`

Styles scoped to the rendered markdown output:

| Element | Style |
|---|---|
| `a` | `color: var(--accent)`, `text-decoration: underline` |
| `blockquote` | Left border `var(--accent)`, `padding-left: 10px`, `color: var(--text-secondary)`, `font-style: italic` |
| `code` (inline) | `background: rgba(255,255,255,0.08)`, `border-radius: 4px`, `padding: 1px 4px`, monospace |
| `pre` | `background: #0d0f14`, `border-radius: 6px`, `padding: 10px`, `overflow-x: auto` |
| `details` | `background: rgba(255,255,255,0.04)`, `border-radius: 6px`, `padding: 8px 12px` |
| `summary` | `cursor: pointer`, `color: var(--accent)`, `font-weight: 600` |

## Component Changes

### `PostCard.tsx`

- Replace `{p.body && <div className={styles.excerpt}>{p.body}</div>}` with:
  ```tsx
  {p.body && <MarkdownRenderer content={p.body} className={styles.excerpt} />}
  ```

### `PostDetailCard.tsx`

- Replace `{post.body && <div className={styles.excerpt}>{post.body}</div>}` with:
  ```tsx
  {post.body && <MarkdownRenderer content={post.body} className={styles.excerpt} />}
  ```

### `CommentItem.tsx`

- Replace inline `<ReactMarkdown remarkPlugins={[remarkGfm]}>` with:
  ```tsx
  <MarkdownRenderer content={overrideContent ?? cv.comment.content} />
  ```
- Remove unused `ReactMarkdown` and `remarkGfm` imports

## CSS Changes

### `PostCard.module.css`

- `.excerpt`: change `color: var(--text-secondary)` → `color: var(--text-primary)` for higher contrast
- `.card`: remove `user-select: none`
- `.excerpt`: add `user-select: text`

### `CommentItem.module.css`

- `.body`: add `user-select: text`

## Text Selection & Gesture Coexistence

The swipe gesture (`useDrag`, `axis: 'x'`, threshold 120px or velocity 0.5) and long-press text selection are distinct browser gestures. Long-press enters the browser's native selection mode, which suppresses the pointer drag stream — so horizontal swipe does not trigger during text selection. No changes to the `useDrag` configuration are needed.

## Out of Scope

- Sanitizing markdown for XSS (react-markdown renders to a React tree, not innerHTML — XSS is not a concern)
- Custom rendering of Lemmy's other non-standard extensions (e.g., subscript/superscript)
- Adding copy buttons or other explicit copy affordances
