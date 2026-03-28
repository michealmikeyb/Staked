# Stakswipe — Claude Code Guide

## What this is

Stakswipe is a mobile-first PWA Lemmy client with a Tinder-style swipe UI. Swipe right to upvote, left to downvote. Comments load inline at the bottom of each card. Built with React 18 + TypeScript + Vite.

## Commands

```bash
npm run dev       # dev server on :5173 (binds 0.0.0.0)
npm test          # run all tests once (vitest)
npm run test:watch  # watch mode
npm run build     # tsc + vite build
```

## Architecture

```
src/
  lib/
    lemmy.ts      # All Lemmy API calls (lemmy-js-client wrapper)
    store.ts      # localStorage auth persistence (token, instance, username)
  components/
    LoginPage     # Instance picker + login form
    FeedStack     # Manages the post queue, pagination, swipe callbacks
    PostCard      # Single card: drag gesture, comment fetching, rendering
    SwipeHint     # One-time animated hint overlay
    Toast         # Auto-dismissing toast (unused in current feed flow)
    CommentsPanel # Standalone comments panel (not used in main feed)
```

## Key technical decisions

### Lemmy auth
`lemmy-js-client` v0.19 uses legacy JWT auth passed as `auth: token` in request bodies. All API calls use `// @ts-expect-error legacy auth` to suppress the type error. Do not "fix" these.

### Comment fetching (three-tier fallback)
Lemmy's federated post IDs differ across instances. `PostCard` uses `post.ap_id` (the canonical ActivityPub URL) to find the real source, with fallbacks:

1. **Source instance** — parse `ap_id` to extract instance + numeric post ID, fetch directly. Fails for Kbin/Mbin (slug-based URLs like `quokk.au/c/mag/p/123/slug`).
2. **Community instance** — call `resolve_object` on the community's home instance to get a local post ID, then fetch comments there. Handles cross-posts and non-Lemmy sources.
3. **Home instance** — fetch via `auth.instance` using `post.id` (already the local federated ID). Tries authenticated first, then anonymous (catches expired token 401s).

If all three tiers return 0 comments but `counts.comments > 0`, a fallback link to the original post is shown (common for Kbin/Mbin posts whose comments don't federate to Lemmy).

### Gesture + animation
- `@use-gesture/react` `useDrag` with `axis: 'x'`, `filterTaps: true`, `pointer: { touch: true }`
- `touch-action: pan-y` on the card so vertical scroll coexists with horizontal swipe
- `framer-motion` `useMotionValue` / `useTransform` for the card tilt and color overlay
- Right swipe: card flies to +600, then `onSwipeRight` fires (upvote + dismiss)
- Left swipe: card flies to -600, then `onSwipeLeft` fires (downvote + dismiss)

### Pagination
`FeedStack` keeps a buffer of posts. When the visible stack drops to ≤3, it fetches the next page. A `canLoadMore` flag prevents infinite retry loops when fetching fails or pages are exhausted.

### Federation gotchas
- `post.id` on the user's instance is the **local federated ID**, not the canonical source ID
- `post.ap_id` is the **canonical ActivityPub URL** — use this to reach the source
- Kbin/Mbin instances use `/c/magazine/p/123/slug` URLs, not `/post/123`
- `quokk.au`, `kbin.social`, etc. don't support Lemmy's `/api/v3/resolve_object`
- Cross-posted content may have 0 comments on the source instance; the real thread is on the community's home instance

## Testing

Tests use Vitest + jsdom + @testing-library/react.

### Mocks required in every test file that renders PostCard or FeedStack

```ts
vi.mock('../lib/lemmy', () => ({
  fetchPosts: vi.fn().mockResolvedValue([...]),
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  upvotePost: vi.fn().mockResolvedValue(undefined),
  downvotePost: vi.fn().mockResolvedValue(undefined),
}));
```

`useDrag` doesn't work in jsdom. Tests capture the handler via a `vi.mock('@use-gesture/react')` and call it directly. `framer-motion`'s `animate` is mocked to call `onComplete` synchronously.

## Deployment

- **Docker**: multi-stage build (node build → nginx serve). `nginx.conf` handles SPA routing.
- **Helm chart**: `helm/` — configured for Raspberry Pi k8s cluster.
- **PWA**: `vite-plugin-pwa` with workbox, auto-update, installable icons at `public/icon-*.png`.

## Credentials (local dev)

Lemmy test credentials are at `~/Development/lemmy-creds.env` (not committed). The dev server runs on port 5173; some Lemmy instances block CORS from localhost origins.
