// src/lib/api/backends/lemmy/posts.ts
import type { PostService } from '../../backend';
import type { ID, Post, Session, Vote } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapPost, parsePostId } from './mappers';

export function createPostService(session: Session): PostService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async get(postId: ID): Promise<Post> {
      const { localId } = parsePostId(postId);
      const res = await client().getPost({ id: localId });
      return mapPost(res.post_view);
    },

    async getByPermalink(url: string): Promise<Post | null> {
      const lemmyMatch = url.match(/^https?:\/\/([^/]+)\/post\/(\d+)/);
      if (lemmyMatch) {
        const [, host, idStr] = lemmyMatch;
        try {
          const res = await makeLemmyClient(host).getPost({ id: parseInt(idStr, 10) });
          return mapPost(res.post_view);
        } catch { return null; }
      }
      try {
        const res = await client().resolveObject({ q: url });
        if (res.post) return mapPost(res.post);
      } catch { /* fall through */ }
      return null;
    },

    async vote(postId: ID, vote: Vote): Promise<void> {
      if (!token) throw new Error('Vote requires login');
      const { localId } = parsePostId(postId);
      await client().likePost({ post_id: localId, score: vote });
    },

    async save(postId: ID, saved: boolean): Promise<void> {
      if (!token) throw new Error('Save requires login');
      const { localId } = parsePostId(postId);
      await client().savePost({ post_id: localId, save: saved });
    },

    async report(postId: ID, reason: string): Promise<void> {
      if (!token) throw new Error('Report requires login');
      const { localId } = parsePostId(postId);
      await client().createPostReport({ post_id: localId, reason });
    },

    async delete(postId: ID): Promise<void> {
      if (!token) throw new Error('Delete requires login');
      const { localId } = parsePostId(postId);
      await client().deletePost({ post_id: localId, deleted: true });
    },

    async create(input): Promise<Post> {
      if (!token) throw new Error('Create requires login');
      const community = await client().getCommunity({ name: input.sourceHandle });
      const res = await client().createPost({
        community_id: community.community_view.community.id,
        name: input.title ?? '',
        body: input.body,
        url: input.url,
        nsfw: input.nsfw,
      });
      return mapPost(res.post_view);
    },
  };
}
