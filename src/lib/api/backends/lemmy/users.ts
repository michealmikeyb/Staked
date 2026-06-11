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
  const { instance: homeInstance, token } = getLemmySessionData(session);

  // When anonymous (no home instance), resolve using the handle's own instance directly.
  function clientFor(handle: string) {
    if (homeInstance) return makeLemmyClient(homeInstance, token ?? undefined);
    const atIdx = handle.lastIndexOf('@');
    const inst = atIdx >= 0 ? handle.slice(atIdx + 1) : '';
    return makeLemmyClient(inst || 'lemmy.world');
  }

  return {
    async get(handle): Promise<User> {
      const res = await clientFor(handle).getPersonDetails({ username: handle, sort: 'New', page: 1, limit: 1 });
      return mapUser(res.person_view.person);
    },
    async getPosts(handle, opts): Promise<Page<Post>> {
      const page = pageNumber(opts.cursor);
      const res = await clientFor(handle).getPersonDetails({ username: handle, sort: 'New', page, limit: PAGE_SIZE });
      return { items: res.posts.map(mapPost), nextCursor: nextCursor(page, res.posts.length) };
    },
    async getComments(handle, opts): Promise<Page<Comment>> {
      const page = pageNumber(opts.cursor);
      const res = await clientFor(handle).getPersonDetails({ username: handle, sort: 'New', page, limit: PAGE_SIZE });
      return { items: res.comments.map(mapComment), nextCursor: nextCursor(page, res.comments.length) };
    },
    async block(userId, block): Promise<void> {
      if (!token) throw new Error('Block requires login');
      await makeLemmyClient(homeInstance, token).blockPerson({ person_id: parseInt(userId, 10), block });
    },
  };
}
