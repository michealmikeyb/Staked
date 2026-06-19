// src/lib/api/backends/bluesky/comments.ts
import type { CommentService } from '../../backend';
import type { Comment, ID, Page, Vote } from '../../types';
import { mapThreadPost, parseBlueskyId } from './mappers';
import { setLike } from './likes';
import { createReport } from './moderation';
import { notSupported } from './stubs';

const THREAD_DEPTH = 6;

function flatten(replies: any[], parentId: string | null, depth: number, rootPostId: string, out: Comment[]): void {
  for (const node of replies ?? []) {
    if (!node?.post?.uri) continue; // skip blocked / not-found nodes
    const comment = mapThreadPost(node.post, parentId, depth, rootPostId);
    out.push(comment);
    if (Array.isArray(node.replies) && node.replies.length) {
      flatten(node.replies, comment.id, depth + 1, rootPostId, out);
    }
  }
}

async function fetchPostView(agent: any, uri: string): Promise<any | null> {
  const res = await agent.getPosts({ uris: [uri] });
  return res.data.posts?.[0] ?? null;
}

export function createCommentService(getAgent: () => any): CommentService {
  return {
    async list(postId, _opts): Promise<Page<Comment>> {
      const { uri } = parseBlueskyId(postId);
      const res = await getAgent().getPostThread({ uri, depth: THREAD_DEPTH });
      const thread = res.data.thread;
      const out: Comment[] = [];
      if (thread?.post?.uri) flatten(thread.replies ?? [], null, 0, postId, out);
      return { items: out, nextCursor: null };
    },

    async vote(commentId: ID, vote: Vote): Promise<void> {
      await setLike(getAgent(), commentId, vote);
    },

    async create(input): Promise<Comment> {
      const agent = getAgent();
      const root = parseBlueskyId(input.postId);
      const parent = parseBlueskyId(input.parentId ?? input.postId);
      const { uri } = await agent.post({
        text: input.body,
        reply: {
          root: { uri: root.uri, cid: root.cid },
          parent: { uri: parent.uri, cid: parent.cid },
        },
      });
      const view = await fetchPostView(agent, uri);
      if (!view) throw new Error('Bluesky: created reply could not be loaded');
      // depth 0 is fine — PostCardShell rebuilds nesting from parentId, which we
      // set to the encoded parent id so local and server ids align.
      return mapThreadPost(view, input.parentId ?? null, 0, input.postId);
    },

    async delete(commentId: ID): Promise<void> {
      const { uri } = parseBlueskyId(commentId);
      await getAgent().deletePost(uri);
    },

    async report(commentId: ID, reason: string): Promise<void> {
      const { uri, cid } = parseBlueskyId(commentId);
      await createReport(getAgent(), uri, cid, reason);
    },

    async edit() { return notSupported('edit comments'); },
  };
}
