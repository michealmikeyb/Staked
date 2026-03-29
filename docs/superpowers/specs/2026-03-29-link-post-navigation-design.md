# Link Post Navigation — Design Spec

**Date:** 2026-03-29
**Status:** Approved

## Overview

Link posts on Lemmy have a `post.url` field pointing to an external article or resource. Currently PostCard renders the URL only as a thumbnail image (when `isImageUrl(p.url)` is true) but provides no affordance for opening non-image link posts. This spec adds a tappable link banner to PostCard for those posts.

## Behaviour

A link banner is rendered inside PostCard when:

- `p.url` is set, AND
- `isImageUrl(p.url)` is false (i.e. the URL is not a direct image)

Text posts (no `p.url`) and image posts (direct image URL) are unchanged.

Tapping the banner calls `window.open(p.url, '_blank', 'noopener,noreferrer')`, opening the link in a new browser tab. No swipe gesture conflict — `useDrag` already uses `filterTaps: true`, so tap events on child elements fire normally.

## Visual Design

The banner sits **between the title and the thumbnail** (or between title and footer on posts with no thumbnail). It is a rounded row containing:

- A link icon on the left (🔗 or a small icon element)
- The extracted hostname of the URL (`new URL(p.url).hostname`) as the primary label
- "Tap to open link" as a secondary hint
- An `↗` arrow on the right

**Resting state:** dark background (`#252525`), 1px border (`#333`), `border-radius: 10px`.
**Active/pressed state:** orange-tinted background (`rgba(255,107,53,0.12)`), orange border, domain text turns orange, hint changes to "Opening in browser…".

The pressed state is achieved via an `isPressed` boolean in local state toggled `onPointerDown` / `onPointerUp`.

## Component Changes

### `PostCard.tsx`

- Add `isPressed` state (`useState(false)`) scoped to the banner.
- Render the banner conditionally: `p.url && !isImageUrl(p.url)`.
- Extract domain with `new URL(p.url).hostname` (safe — `p.url` is already validated as a URL by the Lemmy API).
- Banner `onClick`: call `window.open(p.url, '_blank', 'noopener,noreferrer')`.

### `PostCard.module.css`

- Add `.linkBanner` — resting style.
- Add `.linkBannerPressed` — active/pressed override.
- Add `.linkBannerDomain` and `.linkBannerHint` for text.

## Edge Cases

| Case | Behaviour |
|---|---|
| No `p.url` (text post) | Banner not rendered |
| `p.url` is an image | Banner not rendered; image shown as before |
| `p.url` is a link but no thumbnail | Banner shown; no image; footer follows directly |
| `p.url` is a link and thumbnail exists | Banner shown above thumbnail |
| Kbin/Mbin posts | `p.url` is still a valid external link; banner works normally |

## Out of Scope

- In-app web view / embedded browser
- Link preview cards (og:title, og:description fetching)
- Favicon fetching
