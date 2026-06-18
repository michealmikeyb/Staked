// src/lib/api/backends/bluesky/users.ts
import type { UserService } from '../../backend';
import type { Comment, Page, Post, User } from '../../types';
import { mapPost, mapUser } from './mappers';

const PAGE_SIZE = 30;

export function createUserService(getAgent: () => any): UserService {
  return {
    async get(handle: string): Promise<User> {
      const res = await getAgent().getProfile({ actor: handle });
      return mapUser(res.data);
    },

    async getPosts(handle, opts): Promise<Page<Post>> {
      const res = await getAgent().getAuthorFeed({ actor: handle, cursor: opts.cursor ?? undefined, limit: PAGE_SIZE });
      const items = (res.data.feed as any[]).map((fv) => mapPost(fv.post));
      return { items, nextCursor: res.data.cursor ?? null };
    },

    async getComments(): Promise<Page<Comment>> {
      return { items: [], nextCursor: null };
    },

    async block() { /* no-op */ },
  };
}
