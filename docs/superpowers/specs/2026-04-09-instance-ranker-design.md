# Instance Ranker Script — Design Spec

**Date:** 2026-04-09
**Status:** Approved

## Purpose

A standalone script that benchmarks the top 20 Lemmy instances (by monthly active users, sourced from lemmyverse.net) to determine which instance provides the best anonymous view of the fediverse for each feed sort type. Results are used to configure the anonymous stak in Stakswipe.

## Sort Types Evaluated

The same six sort types shown in the Stakswipe header bar dropdown:
- `Active`, `Hot`, `New`, `TopSixHour`, `TopTwelveHour`, `TopDay`

## Files

```
scripts/
  rank-instances.ts        # main script (run with: npx tsx scripts/rank-instances.ts)
  instance-rankings.json   # output — committed to repo, updated each run
```

## High-Level Flow

1. Fetch instance list from lemmyverse.net → select top 20 by monthly active users
2. For each sort type × each instance (in parallel, with rate limiting):
   - Fetch 10 pages of posts (100 posts total) — post visibility + vote counts come free in list response
   - For each post, fetch comments — collect comment count + vote counts
3. Build a **post universe** per sort type: union of all unique `ap_id`s seen across all 20 instances
4. Score each instance against the universe using weighted metrics
5. Write `instance-rankings.json` and print console table + miss report

## Data Model

### Raw collection (per instance per sort type)

```typescript
interface InstanceRawData {
  instance: string;
  sortType: string;
  posts: Array<{
    ap_id: string;
    upvotes: number;
    downvotes: number;
  }>;
  comments: Array<{
    postApId: string;
    upvotes: number;
    downvotes: number;
  }>;
}
```

Post `upvotes`/`downvotes` come from `post_view.counts` in the list response — no extra API calls needed for post votes.

### Miss record

```typescript
interface MissRecord {
  instance: string;
  sortType: string;
  type: 'page-fetch' | 'comment-fetch';
  page?: number;       // for page-fetch misses
  postApId?: string;   // for comment-fetch misses
  error: string;
}
```

### JSON output

```typescript
interface Rankings {
  generatedAt: string;        // ISO timestamp
  instancesChecked: string[]; // the 20 instances queried
  bySort: Record<string, Array<{
    instance: string;
    score: number;             // 0–1 composite score
    postsVisible: number;      // count of universe posts this instance can see
    postAbsoluteVotes: number; // sum of (upvotes + downvotes) across all posts
    commentsVisible: number;   // total comments fetched across all posts
    commentAbsoluteVotes: number; // sum of (upvotes + downvotes) across all comments
  }>>;                         // each array sorted descending by score
  recommended: Record<string, string>; // sort type → best-scoring instance
  misses: MissRecord[];
}
```

## Scoring

Each metric is normalized to 0–1 relative to the best-performing instance for that metric in that sort type, then weighted:

| Metric | Weight |
|---|---|
| Posts visible (count of universe posts seen) | 40% |
| Total comments visible | 35% |
| Sum of absolute post votes (upvotes + downvotes) | 15% |
| Sum of absolute comment votes | 10% |

```
score = 0.40 × (postsVisible / maxPostsVisible)
      + 0.35 × (commentsVisible / maxCommentsVisible)
      + 0.15 × (postAbsoluteVotes / maxPostAbsoluteVotes)
      + 0.10 × (commentAbsoluteVotes / maxCommentAbsoluteVotes)
```

## Concurrency Model

- **Global max:** 10 simultaneous in-flight requests
- **Per-instance max:** 3 concurrent requests (avoids triggering rate limits on any single host)
- Implemented with a simple counting semaphore — no extra dependencies beyond `tsx`

## Error Handling

- **Per-request timeout:** 15 seconds. Timed-out requests are aborted and logged as misses.
- **Page fetch failure:** Failed pages are skipped and logged as misses; posts from successfully fetched pages are still used. If all 10 pages fail (0 posts collected), the instance is excluded from that sort type's results entirely.
- **Comment fetch failure:** That post contributes 0 to comment metrics. Post still counts toward post visibility. Logged as miss.
- **Lemmyverse fetch failure:** Fatal — script exits with a clear error. Cannot proceed without the instance list.
- **No retries:** Failed requests are treated as misses. Consistently-failing instances will score poorly and won't be recommended.

## Progress Reporting

Print a status line as each instance+sort combo completes:
```
✓ lemmy.world  Active  [12/120]
✗ kbin.social  Hot     [13/120] — timeout
```

## Console Output (end of run)

Two sections printed after the run:

**Rankings table** — per sort type, top 5 instances with scores:
```
=== Active ===
1. lemmy.world     0.94  (posts: 98, comments: 4821, postVotes: 182400, commentVotes: 29100)
2. lemmy.ml        0.87  ...
...

Recommended per sort:
  Active       → lemmy.world
  Hot          → lemmy.world
  New          → sh.itjust.works
  ...
```

**Miss report** — grouped by instance:
```
=== Miss Report ===
lemmy.ml:    8 misses  (6 comment-fetch, 2 page-fetch)
kbin.social: 47 misses (47 comment-fetch)
...
```

## Running the Script

```bash
npx tsx scripts/rank-instances.ts
```

Results are written to `scripts/instance-rankings.json`. Commit the output file to track rankings over time.

## Out of Scope

- Resume/caching if script fails partway (just re-run)
- Retry logic
- Authenticated fetching (anonymous only — this is for the anonymous stak)
