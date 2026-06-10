// src/lib/api/backends/lemmy/feed.ts
import type { FeedService } from '../../backend';
import type { Page, Post, Session } from '../../types';
import type { SortType } from 'lemmy-js-client';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapPost } from './mappers';
import { getAnonInstance } from '../../../instanceRankings';

const PAGE_SIZE = 10;
const SAVED_PAGE_SIZE = 20;

function pageNumber(cursor: string | null): number {
  return cursor ? parseInt(cursor, 10) : 1;
}

function nextCursorOf(page: number, items: unknown[], size: number): string | null {
  return items.length < size ? null : String(page + 1);
}

function resolveInstance(session: Session, feedId: string, anonInstanceSetting: string | undefined): { instance: string; token: string | null } {
  const { instance, token } = getLemmySessionData(session);
  if (token) return { instance, token };
  const anon = anonInstanceSetting || getAnonInstance(feedId as SortType);
  return { instance: anon, token: null };
}

export function createFeedService(
  session: Session,
  getAnonInstanceSetting: () => string | undefined,
): FeedService {
  return {
    async getTimeline(opts): Promise<Page<Post>> {
      const { instance, token } = resolveInstance(session, opts.feedId, getAnonInstanceSetting());
      const stak = opts.stakId === 'subscribed' ? 'Subscribed'
                 : opts.stakId === 'local' ? 'Local'
                 : 'All';
      const page = pageNumber(opts.cursor);
      const res = await makeLemmyClient(instance, token).getPosts({
        type_: stak as any,
        sort: opts.feedId as SortType,
        page,
        limit: PAGE_SIZE,
      });
      const items = res.posts.map(mapPost);
      return { items, nextCursor: nextCursorOf(page, res.posts, PAGE_SIZE) };
    },

    async getSourceFeed(sourceHandle, opts): Promise<Page<Post>> {
      const { instance, token } = resolveInstance(session, opts.feedId, getAnonInstanceSetting());
      const page = pageNumber(opts.cursor);
      const res = await makeLemmyClient(instance, token).getPosts({
        community_name: sourceHandle,
        sort: opts.feedId as SortType,
        page,
        limit: PAGE_SIZE,
      });
      const items = res.posts.map(mapPost);
      return { items, nextCursor: nextCursorOf(page, res.posts, PAGE_SIZE) };
    },

    async getSavedPosts(opts): Promise<Page<Post>> {
      const { instance, token } = getLemmySessionData(session);
      if (!token) return { items: [], nextCursor: null };
      const page = pageNumber(opts.cursor);
      const res = await makeLemmyClient(instance, token).getPosts({
        saved_only: true,
        sort: 'New',
        page,
        limit: SAVED_PAGE_SIZE,
      });
      const items = res.posts.map(mapPost);
      return { items, nextCursor: nextCursorOf(page, res.posts, SAVED_PAGE_SIZE) };
    },
  };
}
