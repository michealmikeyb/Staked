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
