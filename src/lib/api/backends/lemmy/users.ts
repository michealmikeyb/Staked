// src/lib/api/backends/lemmy/users.ts
import type { UserService } from '../../backend';
import type { User, Post, Comment, Page, Session } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapUser, mapPost, mapComment } from './mappers';

const PAGE_SIZE = 20;
const pageNumber = (cursor: string | null): number => cursor ? parseInt(cursor, 10) : 1;
const nextCursor = (page: number, n: number): string | null => n < PAGE_SIZE ? null : String(page + 1);

export function createUserService(session: Session): UserService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async get(handle): Promise<User> {
      const res = await client().getPersonDetails({ username: handle, sort: 'New', page: 1, limit: 1 });
      return mapUser(res.person_view.person);
    },
    async getPosts(handle, opts): Promise<Page<Post>> {
      const page = pageNumber(opts.cursor);
      const res = await client().getPersonDetails({ username: handle, sort: 'New', page, limit: PAGE_SIZE });
      return { items: res.posts.map(mapPost), nextCursor: nextCursor(page, res.posts.length) };
    },
    async getComments(handle, opts): Promise<Page<Comment>> {
      const page = pageNumber(opts.cursor);
      const res = await client().getPersonDetails({ username: handle, sort: 'New', page, limit: PAGE_SIZE });
      return { items: res.comments.map(mapComment), nextCursor: nextCursor(page, res.comments.length) };
    },
    async block(userId, block): Promise<void> {
      if (!token) throw new Error('Block requires login');
      await client().blockPerson({ person_id: parseInt(userId, 10), block });
    },
  };
}
