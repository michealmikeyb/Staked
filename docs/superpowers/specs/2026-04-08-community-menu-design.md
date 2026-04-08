# Community Page Menu — Design Spec

Date: 2026-04-08

## Overview

Add a hamburger menu to the community feed header. Move the Post button into it. Add Subscribe (with live toggle state) and About (full page with markdown description) buttons. Show real community icons in the header and on post cards.

## Data Layer (`lemmy.ts`)

### `fetchCommunityInfo(instance, token, communityRef)`
Calls `getCommunity` and returns:
```ts
{
  id: number;
  icon?: string;
  banner?: string;
  description?: string;
  counts: { subscribers: number; posts: number; comments: number };
  subscribed: 'Subscribed' | 'NotSubscribed' | 'Pending';
}
```
Replaces `resolveCommunityId` — callers that needed only the ID will use this instead (or `resolveCommunityId` can be kept for `createPost` usage and left alone).

### `followCommunity(instance, token, communityId, follow)`
Calls the Lemmy client `followCommunity({ community_id, follow })`. Returns void.

## Data Flow (`FeedStack`)

When the `community` prop is set, `FeedStack` calls `fetchCommunityInfo` once on mount in parallel with `loadMore`. Result stored in:
```ts
const [communityInfo, setCommunityInfo] = useState<CommunityInfo | null>(null);
```

A `handleSubscribeToggle` callback:
1. Optimistically flips `subscribed` in state
2. Calls `followCommunity(follow: subscribed !== 'Subscribed')`
3. Reverts on error

`CommunityHeader` receives `communityInfo` and `onSubscribeToggle` as new props.

## `CommunityHeader` Changes

### New props
```ts
communityInfo?: CommunityInfo;
onSubscribeToggle?: () => void;
```

### Header bar layout (left → right)
- ← back button
- Community icon (24px circle; real image from `communityInfo.icon` or first-letter fallback)
- `c/name` centered label
- Sort dropdown button
- ☰ hamburger button

### Menu dropdown
Same drop-from-top pattern as the existing sort dropdown. A 3-column grid:

| ✏️ Post | ⭐ Subscribe | ℹ️ About |
|---------|-------------|---------|

- **Post**: navigates to `/create-post` with community state (same as current `onCompose`)
- **Subscribe**: highlighted orange + label "Subscribed" when subscribed; calls `onSubscribeToggle`; disabled/loading state while `communityInfo` is null
- **About**: navigates to `/community/:instance/:name/about` with `communityInfo` in location state

### Removed
- Standalone `onCompose` prop and button — replaced by Post item in the menu

## `PostCardShell` Changes

The `communityIcon` div currently renders the first letter. Update to:
- If `community.icon` exists: `<img src={community.icon} />` — 28px circle, `object-fit: cover`
- Otherwise: existing first-letter fallback

No prop interface changes needed.

## `CommunityAboutPage` (new)

### Route
`/community/:instance/:name/about` added to `App.tsx`.

### Data
Reads `communityInfo` from `location.state`. If absent (direct navigation), calls `fetchCommunityInfo` itself using the route params.

### Layout
```
[ ← back ]  [ About c/name ]
[        banner image        ]  (fallback: solid #1a1d24 bg)
         [icon 40px]
    Community Name
    12.4k members · 3.2k posts
    ──────────────────────────
    <MarkdownRenderer description />
```

- Banner: full-width, 120px tall, `object-fit: cover`; hidden if absent
- Icon: 40px circle, positioned at bottom-left of banner area, falls back to first-letter div
- Member/post counts from `communityInfo.counts`
- Description rendered with existing `MarkdownRenderer`

## What Is Not Changing

- Sort dropdown behavior — unchanged
- `resolveCommunityId` — kept as-is (used by `CreatePostPage`)
- Main feed `MenuDrawer` — unchanged
- Gesture/swipe behavior — unchanged
