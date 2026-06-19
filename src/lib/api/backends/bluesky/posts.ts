// src/lib/api/backends/bluesky/posts.ts
import type { PostService } from '../../backend';
import type { ID, Post, Vote } from '../../types';
import { mapPost, parseBlueskyId } from './mappers';
import { setLike } from './likes';
import { createReport } from './moderation';
import { notSupported } from './stubs';

async function fetchPostView(agent: any, uri: string): Promise<any | null> {
  const res = await agent.getPosts({ uris: [uri] });
  return res.data.posts?.[0] ?? null;
}

// Bluesky posts are plain text — there are no communities, titles, or url
// fields. Fold the Lemmy-shaped create form into a single text body.
function composeText(input: { title?: string; body?: string; url?: string }): string {
  return [input.title, input.body, input.url]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s)
    .join('\n\n');
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
      await setLike(getAgent(), postId, vote);
    },

    async report(postId: ID, reason: string): Promise<void> {
      const { uri, cid } = parseBlueskyId(postId);
      await createReport(getAgent(), uri, cid, reason);
    },

    async delete(postId: ID): Promise<void> {
      const { uri } = parseBlueskyId(postId);
      await getAgent().deletePost(uri);
    },

    async create(input): Promise<Post> {
      const agent = getAgent();
      const text = composeText(input);
      const { uri } = await agent.post({ text });
      const view = await fetchPostView(agent, uri);
      if (!view) throw new Error('Bluesky: created post could not be loaded');
      return mapPost(view);
    },

    async save() { return notSupported('save posts'); },
  };
}
