# Create Post Page — Design Spec

**Date:** 2026-04-06

## Overview

Add a Create Post page to Stakswipe. Accessible from two entry points: the MenuDrawer (global, no community pre-fill) and a new compose button in the CommunityHeader (pre-fills community from current feed context). Submits to Lemmy via `LemmyHttp.createPost`. Supports image upload via the instance's pictrs service.

---

## Entry Points

### MenuDrawer
Add a fifth button (✏️ "Post") to the existing 4-button grid. Change grid to `repeat(5, 1fr)`. Navigates to `/create-post` with no state.

### CommunityHeader
Add a ✏️ icon button to the right of the community name (left of the sort dropdown). Navigates to `/create-post` using React Router `navigate('/create-post', { state: { community: 'name@instance' } })`.

---

## Routing

New route in `App.tsx` (inside `AuthenticatedApp`):

```
/create-post  →  <CreatePostPage auth={auth} />
```

---

## CreatePostPage Component

**File:** `src/components/CreatePostPage.tsx`

**Props:** `{ auth: AuthState }`

### Layout

Full-screen page matching the existing page pattern (dark background, header with back arrow and page title).

Header bar:
- Left: ← back button (`navigate(-1)`)
- Center: "New Post"
- Right: "Post" submit button (disabled until title + community are non-empty, and no upload in progress)

Form fields (top to bottom):
1. **Community** — text input, placeholder `communityname@instance.tld`, pre-filled from location state if present
2. **Title** *(required)* — text input
3. **URL** — text input + 📷 button on the right; button opens a hidden `<input type="file" accept="image/*">` to trigger upload
4. **Body** — resizable `<textarea>`

### Image Upload Flow

1. User clicks 📷 button → triggers hidden file input click
2. On file selected: `POST https://{auth.instance}/pictrs/image` with `Authorization: Bearer {token}` header and `FormData` containing the file
3. While uploading: disable the 📷 button, show spinner/`Uploading…` text below the URL field
4. On success: parse response `files[0].file`, build URL as `https://{auth.instance}/pictrs/image/{filename}`, set as URL field value
5. On error: show inline error message below URL field, re-enable button

pictrs response shape:
```json
{ "msg": "ok", "files": [{ "file": "uuid.ext", "delete_token": "..." }] }
```

### Submit Flow

1. Look up community ID: `LemmyHttp.getCommunity({ name: communityField })` → `community_view.community.id`
2. Call `createPost(auth.instance, auth.token, { name: title, community_id, url?, body? })`
3. On success: `navigate(-1)` (back to previous page)
4. On error: show inline error below the Post button

Community lookup and post creation both happen on submit (not eagerly). If the community name is invalid, the error from `getCommunity` surfaces as the submit error.

---

## New lemmy.ts Functions

### `createPost`
```ts
createPost(instance, token, params: {
  name: string;
  community_id: number;
  url?: string;
  body?: string;
}): Promise<void>
```
Wraps `LemmyHttp.createPost`. Uses `// @ts-expect-error legacy auth` per project convention.

### `uploadImage`
```ts
uploadImage(instance: string, token: string, file: File): Promise<string>
```
Direct `fetch` to `POST https://{instance}/pictrs/image` (not through lemmy-js-client). Returns the full image URL. Throws on non-ok response or missing `files[0]`.

### `resolveCommunityId`
```ts
resolveCommunityId(instance: string, token: string, communityRef: string): Promise<number>
```
Calls `LemmyHttp.getCommunity({ name: communityRef })` and returns `community_view.community.id`. Throws if not found.

---

## Error States

| Scenario | Behavior |
|---|---|
| Title empty | Post button disabled |
| Community empty | Post button disabled |
| Upload in progress | Post button disabled, 📷 disabled |
| Upload fails | Inline error below URL field |
| Community not found on submit | Inline error below form |
| Post creation fails | Inline error below form |

---

## Out of Scope

- Community search/autocomplete (free-text only for now)
- NSFW toggle
- Scheduled posts
- Cross-posting UI
