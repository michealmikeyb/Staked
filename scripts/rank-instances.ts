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
  const status = misses.some((m) => m.type === 'page-fetch') && posts.length === 0 ? '✗' : '✓';
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
