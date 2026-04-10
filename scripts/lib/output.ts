import { writeFileSync } from 'fs';
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
