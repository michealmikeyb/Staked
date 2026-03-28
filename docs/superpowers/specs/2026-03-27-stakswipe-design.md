# Stakswipe — Design Spec
_Date: 2026-03-27_

## Overview

Stakswipe is a pure client-side PWA for reading Lemmy (federated Reddit alternative) using a Tinder-style swipe interface. The user swipes through posts one at a time: right to upvote, left to downvote, scroll down to read comments, overscroll-down from top to save. No backend — the browser talks directly to the user's Lemmy instance API. Deployed as a Docker container on a Raspberry Pi Kubernetes cluster via Helm.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Bundler / Dev server | Vite (HMR for dev) |
| Lemmy API | `lemmy-js-client` |
| Gesture detection | `@use-gesture/react` |
| Card animation / physics | `framer-motion` |
| PWA | `vite-plugin-pwa` (Workbox) |
| Production serving | Nginx (static files) |
| Containerisation | Docker (multi-stage) |
| Kubernetes packaging | Helm chart |

---

## Architecture

Stakswipe is a single-page application. All API calls are made from the browser directly to the user's chosen Lemmy instance. There is no proxy, backend, or server-side rendering.

```
Browser ──── User's Lemmy instance (e.g. lemmy.world)
               ├── POST /api/v3/user/login
               ├── GET  /api/v3/post/list       (feed)
               ├── POST /api/v3/post/like        (upvote / downvote)
               ├── POST /api/v3/post/save
               └── GET  /api/v3/comment/list
```

Auth token and instance URL are persisted in `localStorage`. The app has two routes: `/login` and `/feed`.

---

## Component Structure

```
src/
├── main.tsx
├── App.tsx                  # Renders LoginPage or FeedStack based on auth state
├── lib/
│   ├── lemmy.ts             # lemmy-js-client initialisation, typed API helpers
│   └── store.ts             # localStorage helpers: token, instance, username
├── components/
│   ├── LoginPage.tsx        # Instance picker + username + password
│   ├── FeedStack.tsx        # Post queue management, pagination, card rendering
│   ├── PostCard.tsx         # Swipeable card (Framer Motion drag)
│   ├── CommentsPanel.tsx    # Pinned card header + scrollable comment thread
│   └── SwipeHint.tsx        # Animated ← → hints shown on first launch
```

---

## Feed Behaviour

- **Default feed:** All (federated, across the network)
- **Default sort:** Top / 12 hours (`TopTwelveHour`)
- `FeedStack` maintains a queue of ~10 posts. When ≤3 remain, it fetches the next page.
- Behind the active card, the next 2 cards are rendered at reduced scale (95%, 90%) and advance forward with a spring animation when the top card is dismissed.

---

## Gesture Model

| Gesture | Result | API call |
|---|---|---|
| Swipe right (≥120px or >500px/s) | Upvote + dismiss | `POST /post/like` score: +1 |
| Swipe left (≥120px or >500px/s) | Downvote + dismiss | `POST /post/like` score: -1 |
| Scroll down on card | Open comments (card pins as header) | `GET /comment/list` |
| Scroll to top of comments → overscroll down | Save post + show toast | `POST /post/save` |

### Card Physics

- During a right swipe the card rotates **counter-clockwise** (~-12°), giving a "lifting/approving" feel as it exits right.
- During a left swipe the card rotates **clockwise** (~+12°), giving a "sinking/rejecting" feel as it exits left.
- An overlay fades in during drag: orange tint for right (upvote), dark grey tint for left (downvote).
- On release below threshold, the card springs back to centre.

---

## Login Page

- App logo + tagline at top
- **Instance picker:** dropdown of popular instances (lemmy.world, beehaw.org, programming.dev, lemmy.ml, sh.itjust.works) with a "custom…" option that reveals a text input
- Username and password fields
- Sign In button calls `POST /api/v3/user/login` on the selected instance
- Token + instance URL stored in `localStorage` on success; redirects to `/feed`

---

## Comments View

When the user scrolls down on an active card:
- The post card "pins" to the top of the screen as a condensed header (community, title, score)
- Comments load below in a scrollable list, threaded with indent levels
- Scrolling back to the top dismisses the comments panel and returns the card to swipeable state
- Swipe left/right still functions while comments are open to dismiss the post

---

## PWA Configuration

- `manifest.webmanifest`: `name: "Stakswipe"`, `display: standalone`, `theme_color: #ff6b35`, `background_color: #111318`
- Icons: 192×192 and 512×512 PNG (orange logo on dark background)
- Service worker via Workbox: caches app shell (HTML, JS, CSS) for offline launch
- Firefox on Android will show "Add to Home Screen" install prompt automatically

---

## Visual Design

- **Background:** `#111318` (near-black)
- **Card background:** `#1c1e24`
- **Accent / brand colour:** `#ff6b35` (orange)
- **Text primary:** `#f5f5f5`
- **Text secondary:** `#888`
- **Upvote overlay:** orange tint at 40% opacity
- **Downvote overlay:** `#444` tint at 40% opacity

---

## Docker

Two-stage Dockerfile:

**Dev stage**
- Base: `node:20-alpine`
- Runs `vite dev --host 0.0.0.0` on port 5173
- Source directory mounted as a volume — edits reflect instantly via HMR, no rebuild needed

**Prod stage**
- Stage 1: `node:20-alpine` — runs `vite build`
- Stage 2: `nginx:alpine` — serves `/dist` on port 80
- Nginx config rewrites all paths to `index.html` for SPA routing

---

## Helm Chart

```
helm/stakswipe/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── deployment.yaml
    └── service.yaml
```

- `values.yaml` exposes: `image.repository`, `image.tag`, `replicaCount`, `service.port` (default 80)
- `Service` type: `ClusterIP` — intended to be fronted by an existing ingress controller
- No ingress resource in the chart (cluster already has one)
- Target host: `stackswipe.com`

---

## Development Workflow

1. `docker compose up` starts the dev container with source mounted and HMR active
2. Edit files locally → changes appear in browser immediately
3. Playwright is used to verify gesture behaviour and visual correctness during development
4. Build prod image: `docker build --target prod -t stakswipe:latest .`
5. Deploy: `helm upgrade --install stakswipe helm/stakswipe/`

---

## Implementation Phases

1. **Phase 1 — Skeleton:** Docker dev container serving a React app with login page
2. **Phase 2 — Feed:** Auth flow complete, posts loading from Lemmy API, cards rendering
3. **Phase 3 — Gestures:** Swipe left/right with physics, upvote/downvote API calls
4. **Phase 4 — Comments:** Scroll-into-comments, pinned header, comment thread
5. **Phase 5 — Save:** Overscroll-down gesture, save API call, toast feedback
6. **Phase 6 — PWA + Helm:** manifest, service worker, Helm chart, prod Nginx image
