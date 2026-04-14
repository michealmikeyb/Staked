import { useState, useEffect, useRef, type MutableRefObject } from 'react';
import { fetchComments, resolvePostId, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId, sourceFromApId } from '../lib/urlUtils';

interface Result {
  comments: CommentView[];
  commentsLoaded: boolean;
  resolvedInstanceRef: MutableRefObject<string>;
  resolvedTokenRef: MutableRefObject<string>;
}

export function useCommentLoader(
  post: { ap_id: string; id: number },
  community: { actor_id: string },
  auth: AuthState | null,
): Result {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const resolvedInstanceRef = useRef<string>(auth?.instance ?? '');
  const resolvedTokenRef = useRef<string>(auth?.token ?? '');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let loaded: CommentView[] = [];
      const source = sourceFromApId(post.ap_id);

      if (source) {
        const sourceToken = source.instance === auth?.instance ? (auth?.token ?? '') : '';
        loaded = await fetchComments(source.instance, sourceToken, source.postId).catch(() => []);
        if (loaded.length > 0) {
          resolvedInstanceRef.current = source.instance;
          resolvedTokenRef.current = sourceToken;
        }
      }

      if (loaded.length === 0) {
        const communityInstance = instanceFromActorId(community.actor_id);
        if (communityInstance && communityInstance !== source?.instance) {
          const localId = await resolvePostId(communityInstance, post.ap_id).catch(() => null);
          if (localId != null) {
            const communityToken = communityInstance === auth?.instance ? (auth?.token ?? '') : '';
            loaded = await fetchComments(communityInstance, communityToken, localId).catch(() => []);
            if (loaded.length > 0) {
              resolvedInstanceRef.current = communityInstance;
              resolvedTokenRef.current = communityToken;
            }
          }
        }
      }

      // Tier 3: home instance fallback — only available when authenticated
      let cachedHomeComments: CommentView[] | null = null;

      if (auth && loaded.length === 0 && source?.instance !== auth.instance) {
        cachedHomeComments = await fetchComments(auth.instance, auth.token, post.id).catch(() => null) ?? [];
        loaded = cachedHomeComments.length > 0 ? cachedHomeComments
          : await fetchComments(auth.instance, '', post.id).catch(() => []);
        if (loaded.length > 0) {
          resolvedInstanceRef.current = auth.instance;
          resolvedTokenRef.current = auth.token;
        }
      }

      if (auth?.token && source?.instance !== auth.instance) {
        const homeComments = cachedHomeComments ?? await fetchComments(auth.instance, auth.token, post.id).catch(() => []);
        if (homeComments.length > 0) {
          const seenApIds = new Set(loaded.map((c) => c.comment.ap_id));
          const novel = homeComments.filter((c) => !seenApIds.has(c.comment.ap_id));
          if (novel.length > 0) {
            const homeIdToApId = new Map(homeComments.map((c) => [c.comment.id, c.comment.ap_id]));
            const sourceApIdToComment = new Map(loaded.map((c) => [c.comment.ap_id, c]));
            const result = [...loaded];
            for (const nc of novel) {
              const pathParts = nc.comment.path.split('.');
              const parentLocalId = pathParts.length > 2 ? parseInt(pathParts[pathParts.length - 2]) : null;
              const parentApId = parentLocalId != null ? homeIdToApId.get(parentLocalId) : null;
              const parentInSource = parentApId ? sourceApIdToComment.get(parentApId) : null;
              if (parentInSource) {
                const sourcePath = parentInSource.comment.path + '.' + nc.comment.id;
                const remapped = { ...nc, comment: { ...nc.comment, path: sourcePath } };
                const parentPath = parentInSource.comment.path;
                const parentFoundIdx = result.findIndex((c) => c.comment.ap_id === parentApId);
                let insertIdx = parentFoundIdx + 1;
                while (insertIdx < result.length && result[insertIdx].comment.path.startsWith(parentPath + '.')) {
                  insertIdx++;
                }
                result.splice(insertIdx, 0, remapped);
              } else {
                result.push(nc);
              }
            }
            loaded = result;
          }
        }
      }

      if (!cancelled) { setComments(loaded); setCommentsLoaded(true); }
    };

    load();
    return () => { cancelled = true; };
  }, [auth, post.ap_id, post.id, community.actor_id]);

  return { comments, commentsLoaded, resolvedInstanceRef, resolvedTokenRef };
}
