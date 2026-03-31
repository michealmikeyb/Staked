# Share Button & Shared Post View — Design Spec

**Date:** 2026-03-30

## Overview

Add a share button to post cards that generates a stakswipe.com link to a single-post view page. The shared link works without authentication — anyone can open it to read the post and comments.

---

## 1. URL Format & Configuration

Share URLs follow the pattern:

```
https://stakswipe.com/#/post/{instance}/{postId}
```

Example: `https://stakswipe.com/#/post/lemmy.world/12345`

- Instance and post ID are path segments (no URL encoding needed)
- Base URL is configured via `VITE_BASE_URL` env var, defaulting to `https://stakswipe.com`
- A `getShareUrl(instance: string, postId: number): string` helper is added to `src/lib/urlUtils.ts`

---

## 2. Share Button

**Placement:** Footer bar of `PostCard`, inline with the score and comment count, right-aligned:

```
▲ 142   💬 38                    Share ↗
```

The same button is added to `PostDetailCard` (used in inbox, saved, profile detail views).

**Behaviour:**

1. Construct the share URL via `getShareUrl`
2. Call `navigator.share({ title: post.name, url })` if available (Web Share API — native share sheet on iOS/Android)
3. Fall back to `navigator.clipboard.writeText(url)` + show a toast ("Link copied") if Web Share API is unavailable

No drag interference — the button sits inside the scrollable content area, and `filterTaps: true` is already set on the drag gesture.

---

## 3. Routing — Unauthenticated Access

`App.tsx` currently returns `<LoginPage>` immediately when `!auth`. The shared post route must be reachable without login.

**Change:** Move `HashRouter` to wrap the entire app. The `/post/:instance/:postId` route is declared **outside** the auth check. All other routes remain behind the existing auth gate.

```
HashRouter
  /post/:instance/:postId  → SharedPostPage  (no auth required)
  *                        → auth check
                             └─ if !auth → LoginPage
                             └─ if auth  → existing routes (/, /inbox, /saved, /profile, ...)
```

---

## 4. New API Function

Add to `src/lib/lemmy.ts`:

```ts
export async function fetchPost(instance: string, postId: number): Promise<PostView>
```

Calls `getPost({ id: postId })` anonymously (no token). The existing `client()` function already omits the `Authorization` header when no token is passed.

---

## 5. `SharedPostPage` Component

New file: `src/components/SharedPostPage.tsx`

**Behaviour:**

- Reads `instance` and `postId` from URL params
- Fetches the post via `fetchPost(instance, postId)` on mount
- States:
  - **Loading**: centered spinner
  - **Error** (not found, instance unreachable, anonymous access blocked): "Post not found" message + link to open the app
  - **Success**: renders `PostDetailCard` in read-only mode
- Header: Stakswipe logo/wordmark only (no `MenuDrawer` — no auth)
- Footer nudge at the bottom of the card: "Log in to interact" with a link to the app root

---

## 6. `PostDetailCard` — Make `auth` Optional

`auth: AuthState` becomes `auth?: AuthState`.

When `auth` is absent:

- `useCommentLoader` receives `{ instance, token: '', username: '' }` constructed from the URL params — the empty token means no `Authorization` header, so comments load anonymously for public posts
- `ReplySheet` is not rendered (read-only mode)
- No vote buttons shown

---

## Files Changed / Created

| File | Change |
|------|--------|
| `src/lib/urlUtils.ts` | Add `getShareUrl(instance, postId)` |
| `src/lib/lemmy.ts` | Add `fetchPost(instance, postId)` |
| `src/components/PostCard.tsx` | Add share button to footer |
| `src/components/PostDetailCard.tsx` | Make `auth` optional, hide ReplySheet when absent |
| `src/components/SharedPostPage.tsx` | New page component |
| `src/App.tsx` | Restructure routing — `/post/:instance/:postId` outside auth gate |
| `.env.example` (or `vite.config.ts` comment) | Document `VITE_BASE_URL` |
