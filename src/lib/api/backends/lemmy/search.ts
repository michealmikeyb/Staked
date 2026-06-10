// src/lib/api/backends/lemmy/search.ts
import type { SearchService } from '../../backend';
import type { Post, Source, Page, Session } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapPost, mapSourceFromView } from './mappers';

const PAGE_SIZE = 20;
const pageNumber = (cursor: string | null): number => cursor ? parseInt(cursor, 10) : 1;
const nextCursor = (page: number, n: number): string | null => n < PAGE_SIZE ? null : String(page + 1);

export function createSearchService(session: Session): SearchService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async posts(query, opts): Promise<Page<Post>> {
      const page = pageNumber(opts.cursor);
      const res = await client().search({ q: query, type_: 'Posts', sort: 'TopAll', page, limit: PAGE_SIZE });
      return { items: res.posts.map(mapPost), nextCursor: nextCursor(page, res.posts.length) };
    },
    async sources(query, opts): Promise<Page<Source>> {
      const page = pageNumber(opts.cursor);
      const res = await client().search({ q: query, type_: 'Communities', sort: 'TopAll', page, limit: PAGE_SIZE });
      return { items: res.communities.map(mapSourceFromView), nextCursor: nextCursor(page, res.communities.length) };
    },
  };
}
