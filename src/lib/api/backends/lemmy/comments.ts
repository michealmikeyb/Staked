// src/lib/api/backends/lemmy/comments.ts
import type { CommentService } from '../../backend';
import type { Comment, Session, Vote, ID } from '../../types';
import type { CommentView, CommentSortType } from 'lemmy-js-client';
import { makeLemmyClient, sourceFromApId } from './client';
import { getLemmySessionData } from './session';
import { mapComment, mapComments, parsePostId, parseCommentId } from './mappers';

async function resolvePostIdOn(instance: string, apId: string): Promise<number | null> {
  try {
    const res = await makeLemmyClient(instance).resolveObject({ q: apId });
    return res.post?.post.id ?? null;
  } catch { return null; }
}

async function fetchRaw(instance: string, token: string, postId: number, sort: CommentSortType): Promise<CommentView[]> {
  try {
    const res = await makeLemmyClient(instance, token || undefined).getComments({
      post_id: postId, sort, limit: 50,
    });
    return res.comments;
  } catch { return []; }
}

function pathParts(c: CommentView): string[] { return c.comment.path.split('.'); }

function crossStitch(source: CommentView[], home: CommentView[]): CommentView[] {
  if (home.length === 0) return source;
  const sourceApIds = new Set(source.map((c) => c.comment.ap_id));
  const novel = home.filter((c) => !sourceApIds.has(c.comment.ap_id));
  if (novel.length === 0) return source;
  const homeIdToApId = new Map(home.map((c) => [c.comment.id, c.comment.ap_id]));
  const sourceApIdToComment = new Map(source.map((c) => [c.comment.ap_id, c]));
  const result = [...source];
  for (const nc of novel) {
    const parts = pathParts(nc);
    const parentLocalId = parts.length > 2 ? parseInt(parts[parts.length - 2], 10) : null;
    const parentApId = parentLocalId != null ? homeIdToApId.get(parentLocalId) : null;
    const parentInSource = parentApId ? sourceApIdToComment.get(parentApId) : null;
    if (parentInSource) {
      const sourcePath = parentInSource.comment.path + '.' + nc.comment.id;
      const remapped: CommentView = { ...nc, comment: { ...nc.comment, path: sourcePath } };
      const parentPath = parentInSource.comment.path;
      const parentIdx = result.findIndex((c) => c.comment.ap_id === parentApId);
      let insertIdx = parentIdx + 1;
      while (insertIdx < result.length && result[insertIdx].comment.path.startsWith(parentPath + '.')) {
        insertIdx++;
      }
      result.splice(insertIdx, 0, remapped);
    } else {
      result.push(nc);
    }
  }
  return result;
}

export function createCommentService(session: Session): CommentService {
  const { instance: homeInstance, token } = getLemmySessionData(session);
  const homeClient = () => makeLemmyClient(homeInstance, token ?? undefined);

  return {
    async list(postId: ID, opts): Promise<Comment[]> {
      const sort = opts.sortId as CommentSortType;
      const { localId, apId } = parsePostId(postId);
      const source = sourceFromApId(apId);

      let loaded: CommentView[] = [];
      let cachedHome: CommentView[] | null = null;

      // Tier 1 — source instance
      if (source) {
        const srcToken = source.instance === homeInstance ? (token ?? '') : '';
        loaded = await fetchRaw(source.instance, srcToken, source.postId, sort);
      }

      // Tier 2 — source instance via community resolution (anonymous-compatible)
      if (loaded.length === 0 && opts.sourceHandle) {
        const communityInstance = opts.sourceHandle.split('@')[1] ?? '';
        if (communityInstance && communityInstance !== source?.instance) {
          const communityLocalId = await resolvePostIdOn(communityInstance, apId);
          if (communityLocalId != null) {
            const communityToken = communityInstance === homeInstance ? (token ?? '') : '';
            loaded = await fetchRaw(communityInstance, communityToken, communityLocalId, sort);
          }
        }
      }

      // Tier 3 — home instance, authenticated then anonymous
      if (token && source?.instance !== homeInstance && loaded.length === 0) {
        cachedHome = await fetchRaw(homeInstance, token, localId, sort);
        if (cachedHome.length === 0) {
          cachedHome = await fetchRaw(homeInstance, '', localId, sort);
        }
        loaded = cachedHome;
      }

      // Cross-stitch novel home comments into source tree
      if (token && source && source.instance !== homeInstance) {
        const home = cachedHome ?? await fetchRaw(homeInstance, token, localId, sort);
        loaded = crossStitch(loaded, home);
      }

      return mapComments(loaded);
    },

    async vote(commentId: ID, vote: Vote): Promise<void> {
      if (!token) throw new Error('Vote requires login');
      const { localId } = parseCommentId(commentId);
      await homeClient().likeComment({ comment_id: localId, score: vote });
    },

    async create(input): Promise<Comment> {
      if (!token) throw new Error('Comment requires login');
      const { localId: postLocalId } = parsePostId(input.postId);
      let parent_id: number | undefined;
      if (input.parentId) {
        const { localId: parentLocal, apId: parentApId } = parseCommentId(input.parentId);
        if (parentApId) {
          try {
            const r = await homeClient().resolveObject({ q: parentApId });
            parent_id = r.comment?.comment.id ?? parentLocal;
          } catch { parent_id = parentLocal; }
        } else {
          parent_id = parentLocal;
        }
      }
      const res = await homeClient().createComment({
        post_id: postLocalId, content: input.body, parent_id,
      });
      return mapComment(res.comment_view);
    },

    async edit(commentId, body): Promise<Comment> {
      if (!token) throw new Error('Edit requires login');
      const { localId } = parseCommentId(commentId);
      const res = await homeClient().editComment({ comment_id: localId, content: body });
      return mapComment(res.comment_view);
    },

    async delete(commentId): Promise<void> {
      if (!token) throw new Error('Delete requires login');
      const { localId } = parseCommentId(commentId);
      await homeClient().deleteComment({ comment_id: localId, deleted: true });
    },

    async report(commentId, reason): Promise<void> {
      if (!token) throw new Error('Report requires login');
      const { localId } = parseCommentId(commentId);
      await homeClient().createCommentReport({ comment_id: localId, reason });
    },
  };
}
