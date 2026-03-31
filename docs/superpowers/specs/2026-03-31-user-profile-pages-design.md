# User Profile Pages Design

**Date:** 2026-03-31
**Status:** Approved

## Summary

Extend the existing `ProfilePage` component to support viewing any user's public profile. Make usernames tappable in `PostCard` and `CommentItem` to navigate to that profile. Add avatar display in both components.

## Approach

Parameterize `ProfilePage` with an optional `target` prop rather than creating a new component. When `target` is absent the page behaves exactly as today (shows the logged-in user's own profile). When present, it fetches the target user's public profile using `fetchPersonDetails` (no token required for public profiles).

## Changes

### 1. `ProfilePage` — add optional `target` prop

```ts
interface Props {
  auth: AuthState;
  target?: { username: string; instance: string };
}
```

- When `target` is provided: fetch using `target.instance` and `target.username` (no auth token)
- When `target` is absent: existing behavior — fetch using `auth.instance`, `auth.token`, `auth.username`
- Header displays `u/{username}` + instance, same layout as today
- No visual changes to the existing own-profile view

### 2. Routing — new route in `App.tsx`

```
/user/:instance/:username  →  ProfilePage with target={instance, username}
```

A thin `UserProfileRoute` wrapper (same pattern as existing `CommunityFeedRoute`) reads `useParams` and passes `target` to `ProfilePage`. The existing `/profile` and `/profile/:postId` routes are untouched.

### 3. `PostCard` — avatar + tappable username

- Replace the plain creator name text (line 145) with a row: circular avatar (24px) + tappable username
- Avatar uses `creator.avatar` URL if present; falls back to `placeholderColor`-colored circle with first letter of username
- Tapping the username calls `navigate(`/user/${instanceFromActorId(creator.actor_id)}/${creator.name}`)`
- The tap must not trigger the swipe gesture — use `e.stopPropagation()`

### 4. `CommentItem` — avatar + tappable username

- Add 20px circular avatar to the left of `@name` in `authorRow`
- Make the name a tappable element navigating to `/user/:instance/:username`
- Use `e.stopPropagation()` so tapping the name doesn't fire the double-tap like handler
- `CommentItem` needs `useNavigate` added (currently has no navigation)

## Data

- `creator.avatar?: string` — already present on `Person` in both `PostView` and `CommentView`
- `creator.actor_id: string` — ActivityPub URL e.g. `https://beehaw.org/u/alice`; parse with existing `instanceFromActorId` utility to get home instance
- `creator.name: string` — the bare username (no `@instance` suffix)
- `fetchPersonDetails` already accepts any `username` string — no API changes needed

## Federation note

Profiles are always fetched from the **user's home instance** (parsed from `creator.actor_id`). This correctly handles cross-instance posts (e.g. you're on `lemmy.world`, creator is from `beehaw.org`). No `resolve_object` needed.

## Out of scope

- Clicking through to post detail from another user's profile (reuses existing ProfilePostDetailPage pattern — can be added later)
- Follow/block actions on user profiles
- User bio / cake day / stats header (plain layout only, same as own profile)
