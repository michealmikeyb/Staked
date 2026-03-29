---
name: lemmy-api
description: Use when working on Lemmy API integration, debugging API calls, checking endpoint parameters, or unsure how a Lemmy API method works in this project
---

# Lemmy API Reference

## Overview

Use this skill to look up accurate Lemmy API documentation before writing or debugging API calls. Training data may lag behind the actual API — always fetch the live docs.

## When to Use

- Adding a new Lemmy API call
- Debugging a request that returns unexpected results
- Checking what parameters an endpoint accepts
- Verifying response shape / field names

## How to Consult the Docs

Fetch the live API reference with WebFetch:

```
URL: https://join-lemmy.org/api/main
```

The page contains the full TypeScript SDK documentation including all request/response types, method signatures, and field descriptions.

## Project Context

This project uses `lemmy-js-client` v0.19 with legacy JWT auth:

```ts
// @ts-expect-error legacy auth
await client.someMethod({ ..., auth: token });
```

All API calls are wrapped in `src/lib/lemmy.ts`. Check that file first — the method you need may already be implemented.

## Quick Reference

| Task | What to look up |
|------|----------------|
| Fetch posts | `GetPosts` / `GetPostsResponse` |
| Fetch comments | `GetComments` / `GetCommentsResponse` |
| Vote on post | `CreatePostLike` |
| Resolve federated object | `ResolveObject` |
| Auth / login | `Login` / `LoginResponse` |

## Common Gotchas

- `post.id` = local federated ID on the user's instance (not canonical)
- `post.ap_id` = canonical ActivityPub URL — use to reach source instance
- Kbin/Mbin instances use slug-based URLs, not `/post/123` — `resolve_object` fails on them
- Cross-posted content may have 0 comments on source; real thread is on community's home instance
