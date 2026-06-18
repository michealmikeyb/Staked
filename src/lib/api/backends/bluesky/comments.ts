// src/lib/api/backends/bluesky/comments.ts
import type { CommentService } from '../../backend';
import type { Comment, Page } from '../../types';
import { mapThreadPost, parseBlueskyId } from './mappers';
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

    async vote() { return notSupported('vote on comments'); },
    async create() { return notSupported('reply to posts'); },
    async edit() { return notSupported('edit comments'); },
    async delete() { return notSupported('delete comments'); },
    async report() { return notSupported('report comments'); },
  };
}
