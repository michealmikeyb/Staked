# Unified Post Card Shell — Design Spec

**Date:** 2026-04-07
**Status:** Approved

## Problem

`PostDetailCard` (used by `SharedPostPage` and `SavedPostDetailPage`) has broken visual output:

- Footer uses `styles.shareButton` which doesn't exist in `PostCard.module.css`, causing the browser's default white-box button style to render.
- Score and comment count are in the footer as `<span>` elements instead of the `metaStats` top-right position used by `PostCard`.
- No NSFW blur handling.
- No Save button.

The feed stack (`PostCard`) and detail views look completely different. The goal is unified visual structure.

## Approach

Extract a `PostCardShell` component that owns the full scrollable content area — including the footer action buttons and `ReplySheet`. Both `PostCard` and `PostDetailCard` use it internally. The shell is self-contained: it derives which actions to show from `auth` and handles all action logic directly.

## Component: `PostCardShell`

### Responsibility

Renders everything inside the card's scroll area:
- Meta row (community icon, community name, instance/creator, `metaStats` at top-right)
- Title
- Link banner (optional)
- Image with NSFW blur (optional)
- Body/excerpt (optional)
- Footer action bar: Save (auth-gated), Share (always), Comment (auth-gated)
- Comments section (fallback link + `CommentList`)
- `ReplySheet` overlay (positioned absolutely, manages its own `sheetState`)
- Save toast and Share toast

### Props

```ts
interface PostCardShellProps {
  // Data
  post: Post;           // id, name, ap_id, url?, body?, thumbnail_url?, nsfw?
  community: Community; // name, actor_id
  creator: Creator;     // name, display_name?, avatar?, actor_id?
  counts: Counts;       // score, comments

  // Auth — presence gates Save and Comment buttons
  auth?: AuthState;

  // Comments (loaded by caller via useCommentLoader)
  comments: CommentView[];
  commentsLoaded: boolean;
  highlightCommentId?: number;

  // Scroll ref forwarded from parent (PostCard needs it for pull-to-undo)
  scrollRef?: React.RefObject<HTMLDivElement>;

  // Touch handlers for pull-to-undo (PostCard only)
  onTouchStart?: React.TouchEventHandler;
  onTouchMove?: React.TouchEventHandler;
  onTouchEnd?: React.TouchEventHandler;

  // NSFW — defaults true; PostCard passes settings.blurNsfw
  blurNsfw?: boolean;
}
```

### Creator interface unification

`PostDetailCard` currently uses a minimal `Creator` type with no `avatar` or `actor_id`. The shell accepts both optional. The shell calls `useNavigate()` internally for community and creator navigation. Creator renders as a tappable `creatorLink` button (with `CreatorAvatar` if `avatar` is present) when `actor_id` is available; otherwise plain `instanceName` text. Community name is always tappable.

### Footer logic (inside shell)

| Button | Condition | Action |
|--------|-----------|--------|
| 🔖 Save | `auth` present | Calls `savePost(auth.instance, auth.token, post.id)`, shows "Saved" toast |
| Share ↗ | Always | Calls `useShare` hook, shows "Link copied" toast |
| 💬 Comment | `auth` present | Sets internal `sheetState` to `{ mode: 'new' }` |

### ReplySheet (inside shell)

`sheetState` moves from `PostCard`/`PostDetailCard` into the shell. The shell manages reply/edit/new modes, `localReplies`, `localEdits` (all internal state), keyboard offset, and `ReplySheet` rendering. This eliminates duplicated sheetState logic from both callers.

### NSFW blur

Shell holds `nsfwRevealed` state. Blur is applied when `post.nsfw && (blurNsfw ?? true) && !nsfwRevealed`. Tap-to-reveal sets `nsfwRevealed = true`. Identical behaviour to current `PostCard`.

## Updated: `PostCard`

Keeps: `motion.div` wrapper, gesture binding (`useDrag`), swipe overlays, pull-to-undo touch handlers, undo/save/swipe callbacks from `FeedStack`.

Removes: all content rendering (meta, title, banner, image, body, footer, comments, ReplySheet, sheetState, localReplies, localEdits, keyboardOffset, toasts, nsfwRevealed).

Passes to shell:
- All data props
- `auth`
- `comments`, `commentsLoaded` (still loaded in PostCard via `useCommentLoader`)
- `scrollRef`, touch handlers
- `blurNsfw={settings.blurNsfw}`

## Updated: `PostDetailCard`

Keeps: outer `div` wrapper, `useCommentLoader`, `anonAuth` fallback, `notifCommentApId` scroll highlighting.

Removes: all content rendering (meta, title, banner, image, body, footer, ReplySheet, sheetState, localReplies, localEdits, keyboardOffset, toasts).

Passes to shell:
- All data props
- `auth` (present for SavedPostDetailPage, absent for SharedPostPage)
- `comments`, `commentsLoaded`
- `highlightCommentId`
- No `blurNsfw` (shell defaults to true)

## File layout

```
src/components/
  PostCardShell.tsx       — new
  PostCardShell.module.css — new (or reuse PostCard.module.css directly)
  PostCard.tsx            — slimmed, delegates content to PostCardShell
  PostDetailCard.tsx      — slimmed, delegates content to PostCardShell
```

CSS: `PostCardShell` imports `PostCard.module.css` unchanged. No new CSS classes needed — all required classes already exist (`meta`, `metaStats`, `footerAction`, `creatorLink`, etc.).

## What doesn't change

- `PostCard.module.css` — no changes
- `SharedPostPage`, `SavedPostDetailPage`, `FeedStack` — no changes
- `CommentList`, `ReplySheet`, `useCommentLoader`, `useShare` — no changes
- All existing tests — PostCard and PostDetailCard external interfaces are unchanged

## Out of scope

- Saved page list card design (the thumbnail list in `SavedPage.tsx`)
- Profile post detail page (`ProfilePostDetailPage`)
