# Instance Ranker Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `scripts/rank-instances.ts` — a script that fetches the top 20 Lemmy instances from lemmyverse.net, benchmarks each one across 6 sort types by fetching 100 posts + all their comments anonymously, scores them, and writes `scripts/instance-rankings.json` plus a console report.

**Architecture:** A single TypeScript script run with `npx tsx scripts/rank-instances.ts`. Pure functions (universe builder, scorer, instance filter) are unit-tested with vitest. I/O functions (Lemmy API fetchers, lemmyverse fetcher) are not unit-tested — they are integration-tested by running the script. A counting semaphore controls concurrency (global max 10, per-instance max 3).

**Tech Stack:** TypeScript, tsx, lemmy-js-client (already installed), vitest (already installed), Node.js fetch + AbortController (built-in, Node 18+)

---

## File Map

| File | Role |
|---|---|
| `scripts/rank-instances.ts` | Main script — wires all pieces together |
| `scripts/lib/lemmyverse.ts` | Fetch + filter top N instances from lemmyverse.net |
| `scripts/lib/semaphore.ts` | Counting semaphore for concurrency control |
| `scripts/lib/fetchers.ts` | Anonymous Lemmy API wrappers (posts page, comments) |
| `scripts/lib/universe.ts` | Build post universe from raw data |
| `scripts/lib/scorer.ts` | Score each instance against the universe |
| `scripts/lib/output.ts` | Write JSON + print console table + miss report |
| `scripts/lib/types.ts` | Shared TypeScript types |
| `scripts/__tests__/lemmyverse.test.ts` | Unit tests for instance filtering |
| `scripts/__tests__/semaphore.test.ts` | Unit tests for semaphore |
| `scripts/__tests__/universe.test.ts` | Unit tests for universe builder |
| `scripts/__tests__/scorer.test.ts` | Unit tests for scorer |
| `scripts/instance-rankings.json` | Output file (created/updated by script run) |

---

## Task 1: Install tsx and create file skeleton

**Files:**
- Modify: `package.json`
- Create: `scripts/lib/types.ts`
- Create: `scripts/rank-instances.ts` (stub)

- [ ] **Step 1: Install tsx**

```bash
npm install --save-dev tsx
```

Expected: `tsx` appears in `package.json` devDependencies.

- [ ] **Step 2: Add a `rank` script to package.json**

In `package.json`, add to the `"scripts"` object:

```json
"rank": "tsx scripts/rank-instances.ts"
```

- [ ] **Step 3: Create the shared types file**

Create `scripts/lib/types.ts`:

```typescript
export type SortType = 'Active' | 'Hot' | 'New' | 'TopSixHour' | 'TopTwelveHour' | 'TopDay';

export const SORT_TYPES: SortType[] = ['Active', 'Hot', 'New', 'TopSixHour', 'TopTwelveHour', 'TopDay'];

export interface RawPost {
  ap_id: string;
  upvotes: number;
  downvotes: number;
}

export interface RawComment {
  postApId: string;
  upvotes: number;
  downvotes: number;
}

export interface MissRecord {
  instance: string;
  sortType: SortType;
  type: 'page-fetch' | 'comment-fetch';
  page?: number;
  postApId?: string;
  error: string;
}

export interface InstanceRawData {
  instance: string;
  sortType: SortType;
  posts: RawPost[];
  comments: RawComment[];
  misses: MissRecord[];
}

export interface InstanceScore {
  instance: string;
  score: number;
  postsVisible: number;
  postAbsoluteVotes: number;
  commentsVisible: number;
  commentAbsoluteVotes: number;
}

export interface Rankings {
  generatedAt: string;
  instancesChecked: string[];
  bySort: Record<string, InstanceScore[]>;
  recommended: Record<string, string>;
  misses: MissRecord[];
}
```

- [ ] **Step 4: Create the stub main script**

Create `scripts/rank-instances.ts`:

```typescript
import { SORT_TYPES } from './lib/types.js';

async function main() {
  console.log('Instance ranker starting...');
  console.log(`Sort types: ${SORT_TYPES.join(', ')}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Verify the script runs**

```bash
npx tsx scripts/rank-instances.ts
```

Expected output:
```
Instance ranker starting...
Sort types: Active, Hot, New, TopSixHour, TopTwelveHour, TopDay
```

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/lib/types.ts scripts/rank-instances.ts
git commit -m "feat: scaffold instance ranker script and types"
```

---

## Task 2: Semaphore

**Files:**
- Create: `scripts/lib/semaphore.ts`
- Create: `scripts/__tests__/semaphore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `scripts/__tests__/semaphore.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Semaphore } from '../lib/semaphore.js';

describe('Semaphore', () => {
  it('runs tasks up to concurrency limit simultaneously', async () => {
    const sem = new Semaphore(2);
    const order: string[] = [];

    const task = (id: string, delay: number) =>
      sem.run(async () => {
        order.push(`start:${id}`);
        await new Promise((r) => setTimeout(r, delay));
        order.push(`end:${id}`);
      });

    await Promise.all([task('a', 10), task('b', 10), task('c', 10)]);

    // a and b start before c (concurrency=2)
    expect(order[0]).toBe('start:a');
    expect(order[1]).toBe('start:b');
    // c starts only after a or b finishes
    expect(order.indexOf('start:c')).toBeGreaterThan(order.indexOf('end:a'));
  });

  it('resolves the return value of the task', async () => {
    const sem = new Semaphore(1);
    const result = await sem.run(async () => 42);
    expect(result).toBe(42);
  });

  it('propagates errors from tasks', async () => {
    const sem = new Semaphore(1);
    await expect(
      sem.run(async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');
  });

  it('releases slot after error so subsequent tasks can run', async () => {
    const sem = new Semaphore(1);
    await sem.run(async () => { throw new Error('oops'); }).catch(() => {});
    const result = await sem.run(async () => 'ok');
    expect(result).toBe('ok');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run scripts/__tests__/semaphore.test.ts
```

Expected: FAIL — `Cannot find module '../lib/semaphore.js'`

- [ ] **Step 3: Implement the semaphore**

Create `scripts/lib/semaphore.ts`:

```typescript
export class Semaphore {
  private slots: number;
  private queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this.slots = concurrency;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.slots > 0) {
      this.slots--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.slots++;
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run scripts/__tests__/semaphore.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/semaphore.ts scripts/__tests__/semaphore.test.ts
git commit -m "feat: add counting semaphore for concurrency control"
```

---

## Task 3: Lemmyverse instance fetcher

**Files:**
- Create: `scripts/lib/lemmyverse.ts`
- Create: `scripts/__tests__/lemmyverse.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `scripts/__tests__/lemmyverse.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterTopInstances } from '../lib/lemmyverse.js';

const makeInstance = (baseurl: string, month: number, isSuspicious = false) => ({
  baseurl,
  users: { month },
  isSuspicious,
});

describe('filterTopInstances', () => {
  it('returns top N instances sorted by monthly active users', () => {
    const raw = [
      makeInstance('c.example', 100),
      makeInstance('a.example', 5000),
      makeInstance('b.example', 2000),
    ];
    const result = filterTopInstances(raw, 2);
    expect(result).toEqual(['a.example', 'b.example']);
  });

  it('excludes suspicious instances', () => {
    const raw = [
      makeInstance('good.example', 9999),
      makeInstance('bad.example', 99999, true),
    ];
    const result = filterTopInstances(raw, 5);
    expect(result).toEqual(['good.example']);
  });

  it('excludes instances with 0 monthly active users', () => {
    const raw = [
      makeInstance('active.example', 500),
      makeInstance('dead.example', 0),
    ];
    const result = filterTopInstances(raw, 5);
    expect(result).toEqual(['active.example']);
  });

  it('caps result at N even if more instances are available', () => {
    const raw = Array.from({ length: 30 }, (_, i) =>
      makeInstance(`inst${i}.example`, 1000 - i)
    );
    expect(filterTopInstances(raw, 20)).toHaveLength(20);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run scripts/__tests__/lemmyverse.test.ts
```

Expected: FAIL — `Cannot find module '../lib/lemmyverse.js'`

- [ ] **Step 3: Implement the lemmyverse fetcher**

Create `scripts/lib/lemmyverse.ts`:

```typescript
export interface LemmyverseInstance {
  baseurl: string;
  users: { month: number };
  isSuspicious: boolean;
}

export function filterTopInstances(
  instances: LemmyverseInstance[],
  n: number,
): string[] {
  return instances
    .filter((i) => !i.isSuspicious && i.users.month > 0)
    .sort((a, b) => b.users.month - a.users.month)
    .slice(0, n)
    .map((i) => i.baseurl);
}

export async function fetchTopInstances(n: number): Promise<string[]> {
  const res = await fetch('https://lemmyverse.net/data/lemmy.min.json');
  if (!res.ok) throw new Error(`lemmyverse.net returned ${res.status}`);
  const data = (await res.json()) as LemmyverseInstance[];
  return filterTopInstances(data, n);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run scripts/__tests__/lemmyverse.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/lemmyverse.ts scripts/__tests__/lemmyverse.test.ts
git commit -m "feat: add lemmyverse instance fetcher and filter"
```

---

## Task 4: Lemmy API fetchers

**Files:**
- Create: `scripts/lib/fetchers.ts`

These are pure I/O functions — no unit tests. They are verified by running the full script at the end.

- [ ] **Step 1: Create the fetchers**

Create `scripts/lib/fetchers.ts`:

```typescript
import { LemmyHttp } from 'lemmy-js-client';
import type { RawPost, RawComment, MissRecord, SortType } from './types.js';

const TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

function client(instance: string): LemmyHttp {
  return new LemmyHttp(`https://${instance}`);
}

export async function fetchPostsPage(
  instance: string,
  sort: SortType,
  page: number,
): Promise<{ posts: RawPost[]; error?: string }> {
  try {
    const res = await withTimeout(
      client(instance).getPosts({
        type_: 'All',
        sort,
        page,
        limit: 10,
      }),
      TIMEOUT_MS
    );
    const posts: RawPost[] = res.posts.map((pv) => ({
      ap_id: pv.post.ap_id,
      upvotes: pv.counts.upvotes,
      downvotes: pv.counts.downvotes,
    }));
    return { posts };
  } catch (err) {
    return { posts: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchPostComments(
  instance: string,
  postId: number,
  postApId: string,
): Promise<{ comments: RawComment[]; error?: string }> {
  try {
    const res = await withTimeout(
      client(instance).getComments({
        post_id: postId,
        sort: 'Top',
        limit: 50,
      }),
      TIMEOUT_MS
    );
    const comments: RawComment[] = res.comments.map((cv) => ({
      postApId,
      upvotes: cv.counts.upvotes,
      downvotes: cv.counts.downvotes,
    }));
    return { comments };
  } catch (err) {
    return { comments: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function resolveLocalPostId(
  instance: string,
  apId: string,
): Promise<number | null> {
  try {
    const res = await withTimeout(
      client(instance).resolveObject({ q: apId }),
      TIMEOUT_MS
    );
    return res.post?.post.id ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/fetchers.ts
git commit -m "feat: add anonymous Lemmy API fetchers with timeout"
```

---

## Task 5: Universe builder

**Files:**
- Create: `scripts/lib/universe.ts`
- Create: `scripts/__tests__/universe.test.ts`

The universe is the set of unique `ap_id`s seen across all instances for a given sort type. We use it to measure how many universe posts each instance can see.

- [ ] **Step 1: Write the failing tests**

Create `scripts/__tests__/universe.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildUniverse } from '../lib/universe.js';
import type { InstanceRawData } from '../lib/types.js';

const makeRaw = (instance: string, apIds: string[]): InstanceRawData => ({
  instance,
  sortType: 'Active',
  posts: apIds.map((ap_id) => ({ ap_id, upvotes: 10, downvotes: 2 })),
  comments: [],
  misses: [],
});

describe('buildUniverse', () => {
  it('returns the union of all ap_ids across instances', () => {
    const data = [
      makeRaw('a.example', ['post1', 'post2']),
      makeRaw('b.example', ['post2', 'post3']),
    ];
    const universe = buildUniverse(data);
    expect(universe).toEqual(new Set(['post1', 'post2', 'post3']));
  });

  it('returns empty set when no posts', () => {
    const data = [makeRaw('a.example', [])];
    expect(buildUniverse(data)).toEqual(new Set());
  });

  it('deduplicates ap_ids that appear across all instances', () => {
    const data = [
      makeRaw('a.example', ['post1', 'post1']),
      makeRaw('b.example', ['post1']),
    ];
    expect(buildUniverse(data).size).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run scripts/__tests__/universe.test.ts
```

Expected: FAIL — `Cannot find module '../lib/universe.js'`

- [ ] **Step 3: Implement the universe builder**

Create `scripts/lib/universe.ts`:

```typescript
import type { InstanceRawData } from './types.js';

export function buildUniverse(instanceData: InstanceRawData[]): Set<string> {
  const universe = new Set<string>();
  for (const data of instanceData) {
    for (const post of data.posts) {
      universe.add(post.ap_id);
    }
  }
  return universe;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run scripts/__tests__/universe.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/universe.ts scripts/__tests__/universe.test.ts
git commit -m "feat: add post universe builder"
```

---

## Task 6: Scorer

**Files:**
- Create: `scripts/lib/scorer.ts`
- Create: `scripts/__tests__/scorer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `scripts/__tests__/scorer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { scoreInstances } from '../lib/scorer.js';
import type { InstanceRawData } from '../lib/types.js';

const makeRaw = (
  instance: string,
  posts: Array<{ ap_id: string; upvotes: number; downvotes: number }>,
  commentVotes: number[],
): InstanceRawData => ({
  instance,
  sortType: 'Active',
  posts,
  comments: commentVotes.map((v) => ({ postApId: 'x', upvotes: v, downvotes: 0 })),
  misses: [],
});

describe('scoreInstances', () => {
  it('gives score 1.0 to the best instance across all metrics', () => {
    const universe = new Set(['p1', 'p2', 'p3']);
    const data = [
      makeRaw('best', [
        { ap_id: 'p1', upvotes: 100, downvotes: 10 },
        { ap_id: 'p2', upvotes: 100, downvotes: 10 },
        { ap_id: 'p3', upvotes: 100, downvotes: 10 },
      ], [50, 50]),
      makeRaw('worse', [
        { ap_id: 'p1', upvotes: 10, downvotes: 1 },
      ], [5]),
    ];
    const scores = scoreInstances(data, universe);
    const best = scores.find((s) => s.instance === 'best')!;
    expect(best.score).toBeCloseTo(1.0);
  });

  it('applies weights: posts 40%, comments 35%, postVotes 15%, commentVotes 10%', () => {
    // Instance A: perfect posts, zero comments/votes
    // Instance B: zero posts, perfect comments/votes
    // A should score higher (40% > 35%+10%+15%)... wait
    // Actually 40% (posts) vs 60% (comments+votes) — B wins if it has all non-post metrics
    // Let's test a simpler case: A has perfect posts only
    const universe = new Set(['p1']);
    const a = makeRaw('a', [{ ap_id: 'p1', upvotes: 0, downvotes: 0 }], []);
    const b = makeRaw('b', [], [100]);
    // a: postsVisible=1 (max), all others 0
    // b: postsVisible=0, commentVotes=100 (max)
    // a.score = 0.40*1 + 0.35*0 + 0.15*0 + 0.10*0 = 0.40
    // b.score = 0.40*0 + 0.35*0 + 0.15*0 + 0.10*1 = 0.10
    const scores = scoreInstances([a, b], universe);
    const aScore = scores.find((s) => s.instance === 'a')!.score;
    const bScore = scores.find((s) => s.instance === 'b')!.score;
    expect(aScore).toBeCloseTo(0.40);
    expect(bScore).toBeCloseTo(0.10);
  });

  it('returns instances sorted descending by score', () => {
    const universe = new Set(['p1', 'p2']);
    const data = [
      makeRaw('low', [{ ap_id: 'p1', upvotes: 1, downvotes: 0 }], []),
      makeRaw('high', [
        { ap_id: 'p1', upvotes: 100, downvotes: 10 },
        { ap_id: 'p2', upvotes: 100, downvotes: 10 },
      ], [50]),
    ];
    const scores = scoreInstances(data, universe);
    expect(scores[0].instance).toBe('high');
    expect(scores[1].instance).toBe('low');
  });

  it('handles all-zero metrics without dividing by zero', () => {
    const universe = new Set<string>();
    const data = [makeRaw('a', [], [])];
    const scores = scoreInstances(data, universe);
    expect(scores[0].score).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run scripts/__tests__/scorer.test.ts
```

Expected: FAIL — `Cannot find module '../lib/scorer.js'`

- [ ] **Step 3: Implement the scorer**

Create `scripts/lib/scorer.ts`:

```typescript
import type { InstanceRawData, InstanceScore } from './types.js';

const WEIGHTS = {
  posts: 0.40,
  comments: 0.35,
  postVotes: 0.15,
  commentVotes: 0.10,
};

export function scoreInstances(
  instanceData: InstanceRawData[],
  universe: Set<string>,
): InstanceScore[] {
  const raw = instanceData.map((data) => {
    const postsVisible = data.posts.filter((p) => universe.has(p.ap_id)).length;
    const postAbsoluteVotes = data.posts.reduce(
      (sum, p) => sum + p.upvotes + p.downvotes, 0
    );
    const commentsVisible = data.comments.length;
    const commentAbsoluteVotes = data.comments.reduce(
      (sum, c) => sum + c.upvotes + c.downvotes, 0
    );
    return { instance: data.instance, postsVisible, postAbsoluteVotes, commentsVisible, commentAbsoluteVotes };
  });

  const maxPosts = Math.max(...raw.map((r) => r.postsVisible), 1);
  const maxPostVotes = Math.max(...raw.map((r) => r.postAbsoluteVotes), 1);
  const maxComments = Math.max(...raw.map((r) => r.commentsVisible), 1);
  const maxCommentVotes = Math.max(...raw.map((r) => r.commentAbsoluteVotes), 1);

  return raw
    .map((r) => ({
      instance: r.instance,
      score:
        WEIGHTS.posts * (r.postsVisible / maxPosts) +
        WEIGHTS.comments * (r.commentsVisible / maxComments) +
        WEIGHTS.postVotes * (r.postAbsoluteVotes / maxPostVotes) +
        WEIGHTS.commentVotes * (r.commentAbsoluteVotes / maxCommentVotes),
      postsVisible: r.postsVisible,
      postAbsoluteVotes: r.postAbsoluteVotes,
      commentsVisible: r.commentsVisible,
      commentAbsoluteVotes: r.commentAbsoluteVotes,
    }))
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run scripts/__tests__/scorer.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/scorer.ts scripts/__tests__/scorer.test.ts
git commit -m "feat: add instance scorer with weighted metrics"
```

---

## Task 7: Output writer

**Files:**
- Create: `scripts/lib/output.ts`

- [ ] **Step 1: Create the output module**

Create `scripts/lib/output.ts`:

```typescript
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Rankings, MissRecord } from './types.js';

export function writeJson(rankings: Rankings, outPath: string): void {
  writeFileSync(outPath, JSON.stringify(rankings, null, 2));
}

export function printConsoleReport(rankings: Rankings): void {
  console.log('\n' + '='.repeat(60));
  console.log('RANKINGS');
  console.log('='.repeat(60));

  for (const [sort, scores] of Object.entries(rankings.bySort)) {
    console.log(`\n=== ${sort} ===`);
    scores.slice(0, 5).forEach((s, i) => {
      console.log(
        `${i + 1}. ${s.instance.padEnd(30)} score: ${s.score.toFixed(3)}  ` +
        `posts: ${s.postsVisible}  comments: ${s.commentsVisible}  ` +
        `postVotes: ${s.postAbsoluteVotes}  commentVotes: ${s.commentAbsoluteVotes}`
      );
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDED PER SORT');
  console.log('='.repeat(60));
  for (const [sort, instance] of Object.entries(rankings.recommended)) {
    console.log(`  ${sort.padEnd(18)} → ${instance}`);
  }

  printMissReport(rankings.misses);
}

function printMissReport(misses: MissRecord[]): void {
  if (misses.length === 0) {
    console.log('\nNo misses recorded.');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('MISS REPORT');
  console.log('='.repeat(60));

  const byInstance = new Map<string, { pageFetch: number; commentFetch: number }>();
  for (const miss of misses) {
    const key = miss.instance;
    const entry = byInstance.get(key) ?? { pageFetch: 0, commentFetch: 0 };
    if (miss.type === 'page-fetch') entry.pageFetch++;
    else entry.commentFetch++;
    byInstance.set(key, entry);
  }

  const sorted = [...byInstance.entries()].sort(
    (a, b) => (b[1].pageFetch + b[1].commentFetch) - (a[1].pageFetch + a[1].commentFetch)
  );

  for (const [instance, counts] of sorted) {
    const total = counts.pageFetch + counts.commentFetch;
    console.log(
      `  ${instance.padEnd(30)} ${String(total).padStart(4)} misses  ` +
      `(${counts.pageFetch} page-fetch, ${counts.commentFetch} comment-fetch)`
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/output.ts
git commit -m "feat: add JSON writer and console report printer"
```

---

## Task 8: Orchestrator and main

**Files:**
- Modify: `scripts/rank-instances.ts`

This is the final wiring task. Replace the stub with the full orchestration logic.

- [ ] **Step 1: Replace the stub main script**

Overwrite `scripts/rank-instances.ts` with:

```typescript
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import type { SortType, InstanceRawData, MissRecord, Rankings } from './lib/types.js';
import { SORT_TYPES } from './lib/types.js';
import { fetchTopInstances } from './lib/lemmyverse.js';
import { Semaphore } from './lib/semaphore.js';
import { fetchPostsPage, fetchPostComments, resolveLocalPostId } from './lib/fetchers.js';
import { buildUniverse } from './lib/universe.js';
import { scoreInstances } from './lib/scorer.js';
import { writeJson, printConsoleReport } from './lib/output.js';

const TOP_N = 20;
const PAGES_PER_SORT = 10;
const GLOBAL_CONCURRENCY = 10;
const PER_INSTANCE_CONCURRENCY = 3;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, 'instance-rankings.json');

async function collectInstanceSortData(
  instance: string,
  sort: SortType,
  globalSem: Semaphore,
  instanceSem: Semaphore,
  completed: { count: number; total: number },
): Promise<InstanceRawData> {
  const posts: InstanceRawData['posts'] = [];
  const comments: InstanceRawData['comments'] = [];
  const misses: MissRecord[] = [];

  // Fetch all pages sequentially per instance to avoid hammering it
  for (let page = 1; page <= PAGES_PER_SORT; page++) {
    const result = await instanceSem.run(() =>
      globalSem.run(() => fetchPostsPage(instance, sort, page))
    );
    if (result.error) {
      misses.push({ instance, sortType: sort, type: 'page-fetch', page, error: result.error });
    } else {
      posts.push(...result.posts);
    }
  }

  // Fetch comments for all posts found — parallel within per-instance semaphore
  await Promise.all(
    posts.map(async (post) => {
      // Need local post ID to fetch comments — resolve it
      const localId = await instanceSem.run(() =>
        globalSem.run(() => resolveLocalPostId(instance, post.ap_id))
      );

      if (localId === null) {
        misses.push({
          instance,
          sortType: sort,
          type: 'comment-fetch',
          postApId: post.ap_id,
          error: 'Could not resolve local post ID',
        });
        return;
      }

      const result = await instanceSem.run(() =>
        globalSem.run(() => fetchPostComments(instance, localId, post.ap_id))
      );

      if (result.error) {
        misses.push({
          instance,
          sortType: sort,
          type: 'comment-fetch',
          postApId: post.ap_id,
          error: result.error,
        });
      } else {
        comments.push(...result.comments);
      }
    })
  );

  completed.count++;
  const status = misses.some((m) => m.type === 'page-fetch' && posts.length === 0) ? '✗' : '✓';
  console.log(`${status} ${instance.padEnd(30)} ${sort.padEnd(16)} [${completed.count}/${completed.total}]`);

  return { instance, sortType: sort, posts, comments, misses };
}

async function main() {
  console.log('Fetching top instances from lemmyverse.net...');
  const instances = await fetchTopInstances(TOP_N);
  console.log(`Checking ${instances.length} instances: ${instances.join(', ')}\n`);

  const globalSem = new Semaphore(GLOBAL_CONCURRENCY);
  // One semaphore per instance
  const instanceSems = new Map(instances.map((i) => [i, new Semaphore(PER_INSTANCE_CONCURRENCY)]));

  const totalCombos = instances.length * SORT_TYPES.length;
  const completed = { count: 0, total: totalCombos };

  // Run all instance×sort combinations in parallel
  const allRawData = await Promise.all(
    SORT_TYPES.flatMap((sort) =>
      instances.map((instance) =>
        collectInstanceSortData(instance, sort, globalSem, instanceSems.get(instance)!, completed)
      )
    )
  );

  // Build results per sort type
  const bySort: Rankings['bySort'] = {};
  const allMisses: MissRecord[] = [];

  for (const sort of SORT_TYPES) {
    const sortData = allRawData.filter((d) => d.sortType === sort);
    const universe = buildUniverse(sortData);
    // Exclude instances with 0 posts (all pages failed)
    const validData = sortData.filter((d) => d.posts.length > 0);
    bySort[sort] = scoreInstances(validData, universe);
    allMisses.push(...sortData.flatMap((d) => d.misses));
  }

  const recommended: Record<string, string> = {};
  for (const [sort, scores] of Object.entries(bySort)) {
    if (scores.length > 0) recommended[sort] = scores[0].instance;
  }

  const rankings: Rankings = {
    generatedAt: new Date().toISOString(),
    instancesChecked: instances,
    bySort,
    recommended,
    misses: allMisses,
  };

  writeJson(rankings, OUT_PATH);
  printConsoleReport(rankings);
  console.log(`\nResults written to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run all tests to confirm nothing is broken**

```bash
npx vitest run
```

Expected: All tests pass (semaphore, lemmyverse, universe, scorer tests + existing app tests).

- [ ] **Step 3: Commit**

```bash
git add scripts/rank-instances.ts
git commit -m "feat: wire instance ranker orchestrator and main"
```

- [ ] **Step 4: Do a live test run**

```bash
npm run rank
```

Expected: Progress lines appear as combos complete, then rankings table and miss report print, then `scripts/instance-rankings.json` is created.

If you see `lemmyverse.net returned 404` — the API URL may have changed. Check `https://lemmyverse.net` in a browser for the correct data endpoint and update `scripts/lib/lemmyverse.ts`.

- [ ] **Step 5: Commit the generated output**

```bash
git add scripts/instance-rankings.json
git commit -m "chore: add initial instance rankings output"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Top 20 instances from lemmyverse.net ✓ (Task 3)
  - 6 sort types from header bar ✓ (Task 1 — SORT_TYPES)
  - 10 pages × 10 posts = 100 posts per instance+sort ✓ (Task 8 — PAGES_PER_SORT=10)
  - Comments fetched for all posts ✓ (Task 8 — orchestrator)
  - 15s timeout ✓ (Task 4 — TIMEOUT_MS)
  - Global concurrency 10, per-instance 3 ✓ (Task 8)
  - Weighted scoring 40/35/15/10 ✓ (Task 6)
  - JSON output + console table + miss report ✓ (Tasks 7, 8)
  - Failed pages skipped (not fatal), all-pages-failed = exclusion ✓ (Task 8 — `validData` filter)
  - Miss report grouped by instance ✓ (Task 7)
- [x] **No placeholders:** All steps have complete code.
- [x] **Type consistency:** `InstanceRawData`, `MissRecord`, `RawPost`, `RawComment`, `InstanceScore`, `Rankings` defined in Task 1 and used consistently throughout.
