import type { SortType } from 'lemmy-js-client';

const RANKINGS: Record<string, string> = {
  Active: 'reddthat.com',
  Hot: 'lemmy.blahaj.zone',
  New: 'reddthat.com',
  TopSixHour: 'reddthat.com',
  TopTwelveHour: 'reddthat.com',
  TopDay: 'reddthat.com',
};

export function getAnonInstance(sort: SortType): string {
  return RANKINGS[sort] ?? 'lemmy.world';
}
