// src/lib/api/backends/bluesky/posts.ts
import type { PostService } from '../../backend';
import type { ID, Post, Vote } from '../../types';
import { mapPost, parseBlueskyId } from './mappers';
import { notSupported } from './stubs';

async function fetchPostView(agent: any, uri: string): Promise<any | null> {
  const res = await agent.getPosts({ uris: [uri] });
  return res.data.posts?.[0] ?? null;
}

export function createPostService(getAgent: () => any): PostService {
  return {
    async get(postId: ID): Promise<Post> {
      const { uri } = parseBlueskyId(postId);
      const view = await fetchPostView(getAgent(), uri);
      if (!view) throw new Error(`Bluesky: post not found: ${uri}`);
      return mapPost(view);
    },

    async getByPermalink(url: string): Promise<Post | null> {
      const m = url.match(/\/profile\/([^/]+)\/post\/([^/?#]+)/);
      if (!m) return null;
      const [, handle, rkey] = m;
      const uri = `at://${handle}/app.bsky.feed.post/${rkey}`;
      try {
        const view = await fetchPostView(getAgent(), uri);
        return view ? mapPost(view) : null;
      } catch {
        return null;
      }
    },

    async vote(postId: ID, vote: Vote): Promise<void> {
      const agent = getAgent();
      const { uri, cid } = parseBlueskyId(postId);
      if (vote > 0) {
        await agent.like(uri, cid);
        return;
      }
      // unlike: resolve the like record uri from the post's viewer state
      const view = await fetchPostView(agent, uri);
      const likeUri = view?.viewer?.like;
      if (likeUri) await agent.deleteLike(likeUri);
    },

    async save() { return notSupported('save posts'); },
    async report() { return notSupported('report posts'); },
    async delete() { return notSupported('delete posts'); },
    async create() { return notSupported('create posts'); },
  };
}
