# Inbox — Design Spec

**Date:** 2026-03-29

## Overview

Add an inbox page showing replies and @mentions. The drawer button shows an unread count badge. Tapping a notification opens a post detail view with the relevant comment highlighted and reply functionality.

---

## Section 1: Routing & Navigation

Install `react-router-dom`. Wrap the app in `<HashRouter>` in `main.tsx`.

Routes:
- `/` — `FeedStack` (current feed)
- `/inbox` — `InboxPage`
- `/inbox/:notifId` — `PostDetailPage` (`:notifId` encoded as `reply-{id}` or `mention-{id}`)

Drawer buttons in `FeedStack` use `useNavigate()` to push routes. Future pages (Saved, Profile) follow the same pattern.

**Navigation rules:**
- The `S` logo in `HeaderBar` always navigates to `/` (home/feed). It is the app's home button on every page.
- `PostDetailPage` has a separate `← Back` link that navigates to `/inbox`.

---

## Section 2: Unread Count Badge

**New API function in `lemmy.ts`:** `fetchUnreadCount(instance, token)` — calls `getUnreadCount()`, returns `replies + mentions` as a number. Private messages are excluded.

**Count lifecycle:**
- Fetched on `FeedStack` mount and on `InboxPage` mount.
- Stored in `App.tsx` state (or a small React context) so the drawer badge in `FeedStack` and `InboxPage`/`PostDetailPage` can all read and update it.
- Decremented by 1 when a notification is individually opened in `PostDetailPage` (after `markReplyAsRead` / `markMentionAsRead` succeeds).
- Never cleared to 0 automatically — always reflects actual unread state.

**Badge UI:** Small orange circle with white count number, overlaid top-right on the 📬 icon in the drawer. Hidden when count is 0.

---

## Section 3: HeaderBar Changes

`HeaderBar` gains an optional `centerContent?: React.ReactNode` prop and makes `sortType`/`onSortChange` optional. The center area logic:

- `centerContent` provided → render it (replaces sort dropdown).
- `sortType` + `onSortChange` provided, no `centerContent` → render sort dropdown (current behavior).
- Neither provided → center area is empty.

Usage per page:
- Feed: `sortType` + `onSortChange` passed → sort dropdown shown as today.
- InboxPage: `centerContent` = unread/all pill toggle, no sort props.
- PostDetailPage: neither passed → empty center.

The logo (`S`) click handler is always `() => navigate('/')`.

---

## Section 4: InboxPage (`/inbox`)

**Component:** `src/components/InboxPage.tsx`

**Data fetching:**
- On mount: call `fetchUnreadCount` (updates global count), then fetch notifications.
- Fetch `getReplies` + `getMentions` in parallel, merge results, sort by date descending.
- Default filter: `unread_only: true`. Toggle to `unread_only: false` refetches with all notifications.

**Filter toggle (in HeaderBar `centerContent`):**
- Pill with two options: "Unread" (default) / "All".
- Selecting "All" refetches notifications with `unread_only: false`.

**Notification list item (card style with type badge):**
```
┌─────────────────────────────────────────────┐
│ [REPLY]  2 hours ago                      • │  ← orange badge, unread dot
│ Best programming languages for 2025?        │  ← post title, grey italic
│ mikey_lemmy                                 │  ← username
│ "I think Rust is a great choice for sys..." │  ← reply/mention content
└─────────────────────────────────────────────┘
```
- Badge: `REPLY` or `MENTION` in orange pill.
- Unread dot: small orange circle on right edge, hidden if already read.
- Tapping navigates to `/inbox/reply-{id}` or `/inbox/mention-{id}`.

---

## Section 5: PostDetailPage (`/inbox/:notifId`)

**Component:** `src/components/PostDetailPage.tsx`

**Header:**
- `S` logo → navigates to `/` (feed).
- `← Inbox` text link rendered just right of the logo (in the left section of the header) → navigates to `/inbox`. **Only rendered on iOS** (detected via `navigator.userAgent`). On Android the system/browser back button handles navigation natively via the hash router.
- No center content (sort dropdown hidden).

**Body layout:** Same visual structure as `PostCard` but non-swipeable:
- Community meta (icon, name, instance, creator).
- Post title.
- Link banner (if link post).
- Image (if image post).
- Post body text excerpt.
- Score + comment count footer.
- Full comment list (`CommentList`) below.

No `framer-motion` motion values or `useDrag` — plain scrollable `div`.

**Comment highlighting:**
- The notification's comment is highlighted with an orange border.
- On mount, `scrollIntoView({ behavior: 'smooth', block: 'center' })` is called on the highlighted comment's DOM node via a `ref`.

**Reply functionality:**
- Reuses `ReplySheet` exactly as in `PostCard`.
- `resolvedInstanceRef` / `resolvedTokenRef` pattern reused for posting to the correct instance.

**Mark as read:**
- On mount, call `markReplyAsRead(id)` or `markMentionAsRead(id)` depending on notif type.
- On success, decrement the global unread count by 1 (no-op if already 0).

**Comment fetching:** Uses the same three-tier fallback logic as `PostCard` (source instance → community instance → home instance). This logic should be extracted into a shared `useCommentLoader` hook to avoid duplication.

---

## Section 6: New API Functions in `lemmy.ts`

```ts
fetchUnreadCount(instance, token): Promise<number>
fetchReplies(instance, token, unreadOnly: boolean): Promise<ReplyView[]>
fetchMentions(instance, token, unreadOnly: boolean): Promise<PersonMentionView[]>
markReplyAsRead(instance, token, replyId: number): Promise<void>
markMentionAsRead(instance, token, mentionId: number): Promise<void>
```

Types `ReplyView` and `PersonMentionView` are re-exported from `lemmy-js-client`.

---

## Section 7: State Architecture

Global unread count lives in `App.tsx` as `const [unreadCount, setUnreadCount] = useState(0)` and is passed down as props:
- `FeedStack` receives `unreadCount` for the badge.
- `InboxPage` and `PostDetailPage` receive `setUnreadCount` to update it.

This avoids a context for now (only 3 consumers). If more pages are added, migrate to a small `NotificationContext`.

---

## Testing

- `InboxPage`: mock `fetchReplies`, `fetchMentions`, `fetchUnreadCount`. Assert list renders, filter toggle refetches, tapping an item navigates.
- `PostDetailPage`: mock comment loader, assert highlighted comment gets `scrollIntoView` called, assert `markReplyAsRead` called on mount.
- `HeaderBar`: assert `centerContent` renders in place of sort dropdown when provided.
- `lemmy.ts`: unit test new functions with mocked `LemmyHttp`.
