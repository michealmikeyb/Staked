// src/lib/api/backends/lemmy/comments.ts
import type { CommentService } from '../../backend';
import type { Comment, Session, Vote, ID, Page } from '../../types';
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

async function fetchRaw(instance: string, token: string, postId: number, sort: CommentSortType, page = 1): Promise<CommentView[]> {
  try {
    const res = await makeLemmyClient(instance, token || undefined).getComments({
      post_id: postId, sort, limit: 50, page,
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

async function resolveHomeCommentId(
  homeClient: ReturnType<typeof makeLemmyClient>,
  localId: number,
  apId: string,
): Promise<number> {
  if (!apId) return localId;
  try {
    const r = await homeClient.resolveObject({ q: apId });
    return r.comment?.comment.id ?? localId;
  } catch { return localId; }
}

export function createCommentService(session: Session): CommentService {
  const { instance: homeInstance, token } = getLemmySessionData(session);
  const homeClient = () => makeLemmyClient(homeInstance, token ?? undefined);

  return {
    async list(postId: ID, opts): Promise<Page<Comment>> {
      const sort = opts.sortId as CommentSortType;
      const { localId, apId } = parsePostId(postId);
      const source = sourceFromApId(apId);
      const parsed = opts.cursor ? parseInt(opts.cursor, 10) : NaN;
      const page = isNaN(parsed) ? 1 : parsed;
      const isFirstPage = page === 1;

      let loaded: CommentView[] = [];
      let cachedHome: CommentView[] | null = null;

      // Tier 1 — source instance
      if (source) {
        const srcToken = source.instance === homeInstance ? (token ?? '') : '';
        loaded = await fetchRaw(source.instance, srcToken, source.postId, sort, page);
      }
      const tier1Count = loaded.length;

      let tier2Count = 0;
      let tier3Count = 0;
      let tier2Ran = false;

      // Tier 2 — community instance via resolve_object (anonymous-compatible)
      if (loaded.length === 0 && opts.sourceHandle) {
        const communityInstance = opts.sourceHandle.split('@')[1] ?? '';
        if (communityInstance && communityInstance !== source?.instance) {
          const communityLocalId = await resolvePostIdOn(communityInstance, apId);
          if (communityLocalId != null) {
            tier2Ran = true;
            const communityToken = communityInstance === homeInstance ? (token ?? '') : '';
            loaded = await fetchRaw(communityInstance, communityToken, communityLocalId, sort, page);
            tier2Count = loaded.length;
          }
        }
      }

      // Tier 3 — home instance, authenticated then anonymous
      // On page 2+, skip if Tier 2 already ran (don't mix tiers across pages)
      const skipTier3 = !isFirstPage && tier2Ran;
      if (!skipTier3 && token && source?.instance !== homeInstance && loaded.length === 0) {
        if (isFirstPage) {
          cachedHome = await fetchRaw(homeInstance, token, localId, sort);
          if (cachedHome.length === 0) cachedHome = await fetchRaw(homeInstance, '', localId, sort);
          loaded = cachedHome;
        } else {
          loaded = await fetchRaw(homeInstance, token, localId, sort, page);
          if (loaded.length === 0) loaded = await fetchRaw(homeInstance, '', localId, sort, page);
        }
        tier3Count = loaded.length;
      }

      // Cross-stitch novel home comments into source tree (first page only)
      if (isFirstPage && token && source && source.instance !== homeInstance) {
        const home = cachedHome ?? await fetchRaw(homeInstance, token, localId, sort);
        loaded = crossStitch(loaded, home);
      }

      // Supplemental fetch: if a specific target comment wasn't found in the initial load,
      // resolve it on the source instance and fetch its thread to ensure it appears.
      if (isFirstPage && opts.targetCommentApId && source) {
        const targetApId = opts.targetCommentApId;
        const alreadyLoaded = loaded.some((cv) => cv.comment.ap_id === targetApId);
        if (!alreadyLoaded) {
          try {
            const srcToken = source.instance === homeInstance ? (token ?? '') : '';
            const res = await makeLemmyClient(source.instance, srcToken || undefined).resolveObject({ q: targetApId });
            if (res.comment) {
              const cv = res.comment;
              const parts = cv.comment.path.split('.');
              // Fetch from the grandparent level for context, or parent if shallow
              const ancestorIdx = Math.max(1, parts.length - 3);
              const ancestorId = parts[ancestorIdx] !== '0' ? parseInt(parts[ancestorIdx], 10) : undefined;
              const threadRes = await makeLemmyClient(source.instance, srcToken || undefined).getComments({
                post_id: source.postId, parent_id: ancestorId, limit: 50,
              });
              const existingApIds = new Set(loaded.map((c) => c.comment.ap_id));
              const novel = threadRes.comments.filter((c) => !existingApIds.has(c.comment.ap_id));
              loaded = [...loaded, ...novel];
            }
          } catch { /* silently skip supplemental fetch on failure */ }
        }
      }

      const activeTierCount = tier1Count || tier2Count || tier3Count;
      const nextCursor = activeTierCount === 50 ? String(page + 1) : null;
      return { items: mapComments(loaded), nextCursor };
    },

    async vote(commentId: ID, vote: Vote): Promise<void> {
      if (!token) throw new Error('Vote requires login');
      const { localId, apId } = parseCommentId(commentId);
      const client = homeClient();
      const homeId = await resolveHomeCommentId(client, localId, apId);
      await client.likeComment({ comment_id: homeId, score: vote });
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
      const { localId, apId } = parseCommentId(commentId);
      const client = homeClient();
      const homeId = await resolveHomeCommentId(client, localId, apId);
      const res = await client.editComment({ comment_id: homeId, content: body });
      return mapComment(res.comment_view);
    },

    async delete(commentId): Promise<void> {
      if (!token) throw new Error('Delete requires login');
      const { localId, apId } = parseCommentId(commentId);
      const client = homeClient();
      const homeId = await resolveHomeCommentId(client, localId, apId);
      await client.deleteComment({ comment_id: homeId, deleted: true });
    },

    async report(commentId, reason): Promise<void> {
      if (!token) throw new Error('Report requires login');
      const { localId, apId } = parseCommentId(commentId);
      const client = homeClient();
      const homeId = await resolveHomeCommentId(client, localId, apId);
      await client.createCommentReport({ comment_id: homeId, reason });
    },
  };
}
