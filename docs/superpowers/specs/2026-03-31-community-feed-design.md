# Community Feed Design

**Date:** 2026-03-31

## Overview

Add a community feed that shows posts from a single Lemmy community in the same swipe-based stack UI as the main feed. Accessible by tapping the community name on any post card.

## Behaviour

- **Swipe right** → upvote + dismiss (same as main feed)
- **Swipe left** → downvote + dismiss (same as main feed)
- **Swipe down (pull)** → save + dismiss (same as main feed)
- **Sort** → user-selectable, same `SortType` options as main feed; defaults to `Active`
- **Seen tracking** → independent from main feed; uses an in-memory set (not persisted to `localStorage`). Resets each time you enter the community feed. No "Reset seen history" button in empty state.

## Data Layer

New function in `src/lib/lemmy.ts`:

```ts
fetchCommunityPosts(
  instance: string,
  token: string,
  communityRef: string,  // "name@communityInstance", e.g. "asklemmy@lemmy.world"
  page: number,
  sort: SortType,
): Promise<PostView[]>
```

Calls `getPosts({ community_name: communityRef, sort, page, limit: 10 })`. Using the `name@instance` format allows the user's home instance to resolve cross-instance communities via federation.

## Routing

New route added to `AuthenticatedApp` in `App.tsx`:

```
/community/:instance/:name
```

Renders `<FeedStack>` with a new optional `community={{ name: string; instance: string }}` prop.

## PostCard — Community Link

The `c/{community.name}` div in `PostCard` becomes tappable. On tap, navigates to `/community/${instance}/${community.name}`. The `instance` value is already derived from `community.actor_id` via `instanceFromActorId` inside PostCard.

## FeedStack Changes

Add optional prop:

```ts
community?: { name: string; instance: string }
```

When `community` is present:

- Fetch via `fetchCommunityPosts(auth.instance, auth.token, "${name}@${instance}", page, sort)`
- Seen set: `useRef<Set<number>>(new Set())` — empty, not loaded from localStorage
- Header: replaced by a compact community header bar (no `MenuDrawer`)

## Community Header Bar

A new `CommunityHeader` component (not reusing `HeaderBar`, which always places the Logo on the left and hamburger on the right — incompatible with this layout).

Single bar:

```
[ ← ]   [ c/communityname ]   [ Active ▾ ]
  left        center               right
```

- `←` calls `navigate(-1)`
- Community name is display-only (no tap target)
- Sort picker: renders the same `SORT_OPTIONS` dropdown as `HeaderBar`, but positioned on the right side of the bar
- Styling matches `HeaderBar`: `height: 48`, `background: #1a1d24`, `borderBottom: 1px solid #2a2d35`

## Empty State

Same "You've seen everything!" message as main feed, but:

- No "Reset seen history" button (session-only tracking)
- "Log out" button retained

## Out of Scope

- Subscribing/unsubscribing to communities
- Community metadata (description, subscriber count)
- Moderator tools
