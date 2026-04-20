import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import type { SortType, InstanceRawData, MissRecord, Rankings, RawPost } from './lib/types.js';
import { SORT_TYPES } from './lib/types.js';
import { fetchTopInstances } from './lib/lemmyverse.js';
import { Semaphore } from './lib/semaphore.js';
import { fetchPostsPage, fetchPostComments } from './lib/fetchers.js';
import { buildUniverse } from './lib/universe.js';
import { scoreInstances } from './lib/scorer.js';
import { writeJson, printConsoleReport } from './lib/output.js';

const TOP_N = 20;
const MAX_PAGES = 50;
const GLOBAL_CONCURRENCY = 10;
const PER_INSTANCE_CONCURRENCY = 3;

// Per-sort stopping thresholds.
// Time-based sorts (Active, Hot, New): stop when the last post on a page is older than N hours.
//   Active — decay based on latest comment time, capped at 48h by Lemmy
//   Hot    — decay based on post publication time; anything >24h is well past its peak rank
//   New    — strictly chronological; 2h keeps the comparison focused on live traffic
// Vote-based sorts (Top*): stop when last post on page has fewer than N absolute votes.
//   TopSixHour/TopTwelveHour/TopDay windows are fixed server-side, so pages exhaust naturally;
//   low thresholds just prevent scraping noise at the bottom of the list.
const SORT_THRESHOLDS: Record<SortType, { type: 'time'; hours: number } | { type: 'votes'; min: number }> = {
  Active:        { type: 'time',  hours: 48 },
  Hot:           { type: 'time',  hours: 24 },
  New:           { type: 'time',  hours: 2  },
  TopSixHour:    { type: 'votes', min: 5    },
  TopTwelveHour: { type: 'votes', min: 10   },
  TopDay:        { type: 'votes', min: 20   },
};

function reachedThreshold(posts: RawPost[], sort: SortType): boolean {
  if (posts.length === 0) return false;
  const last = posts[posts.length - 1];
  const threshold = SORT_THRESHOLDS[sort];
  if (threshold.type === 'time') {
    const ageMs = Date.now() - new Date(last.published ?? 0).getTime();
    return ageMs > threshold.hours * 60 * 60 * 1000;
  }
  return (last.upvotes + last.downvotes) < threshold.min;
}

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

  // Fetch pages until threshold reached (vote floor or age ceiling) or feed exhausted
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await instanceSem.run(() =>
      globalSem.run(() => fetchPostsPage(instance, sort, page))
    );
    if (result.error) {
      misses.push({ instance, sortType: sort, type: 'page-fetch', page, error: result.error });
    } else {
      posts.push(...result.posts);
      if (result.posts.length < 10 || reachedThreshold(result.posts, sort)) break;
    }
  }

  // Deduplicate posts by ap_id (same post can appear on multiple pages in active feeds)
  const uniquePosts = [...new Map(posts.map((p) => [p.ap_id, p])).values()];

  // Fetch comments for all posts found — parallel within per-instance semaphore
  await Promise.all(
    uniquePosts.map(async (post) => {
      const result = await instanceSem.run(() =>
        globalSem.run(() => fetchPostComments(instance, post.id, post.ap_id))
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
  const status = misses.some((m) => m.type === 'page-fetch') && posts.length === 0 ? '✗' : '✓';
  console.log(`${status} ${instance.padEnd(30)} ${sort.padEnd(16)} [${completed.count}/${completed.total}]`);

  return { instance, sortType: sort, posts: uniquePosts, comments, misses };
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
