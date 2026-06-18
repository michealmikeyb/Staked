// src/lib/api/backends/bluesky/feed.ts
import type { FeedService } from '../../backend';
import type { Page, Post } from '../../types';
import { mapPost } from './mappers';

const PAGE_SIZE = 30;

export function createFeedService(getAgent: () => any): FeedService {
  return {
    async getTimeline(opts): Promise<Page<Post>> {
      const agent = getAgent();
      const cursor = opts.cursor ?? undefined;
      const res = opts.feedId === 'following'
        ? await agent.getTimeline({ cursor, limit: PAGE_SIZE })
        : await agent.app.bsky.feed.getFeed({ feed: opts.feedId, cursor, limit: PAGE_SIZE });
      const items = (res.data.feed as any[]).map((fv) => mapPost(fv.post));
      return { items, nextCursor: res.data.cursor ?? null };
    },

    async getSourceFeed(): Promise<Page<Post>> {
      throw new Error('Bluesky has no community feeds');
    },

    async getSavedPosts(): Promise<Page<Post>> {
      return { items: [], nextCursor: null };
    },
  };
}
