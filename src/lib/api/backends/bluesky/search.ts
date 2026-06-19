// src/lib/api/backends/bluesky/search.ts
import type { SearchService } from '../../backend';
import type { Page, Post, Source } from '../../types';
import { mapPost } from './mappers';

const PAGE_SIZE = 25;

export function createSearchService(getAgent: () => any): SearchService {
  return {
    async posts(query, opts): Promise<Page<Post>> {
      const res = await getAgent().app.bsky.feed.searchPosts({
        q: query,
        cursor: opts.cursor ?? undefined,
        limit: PAGE_SIZE,
      });
      const items = (res.data.posts as any[]).map(mapPost);
      return { items, nextCursor: res.data.cursor ?? null };
    },

    // Bluesky has no communities/sources to search.
    async sources(): Promise<Page<Source>> {
      return { items: [], nextCursor: null };
    },
  };
}
