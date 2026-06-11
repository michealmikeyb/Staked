import { useMemo, useState, useEffect, useCallback } from 'react';
import { useBackend } from '../lib/api/context';
import { instanceFromActorId } from '../lib/urlUtils';
import type { AuthState } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';
import type { Post as NeutralPost, Comment } from '../lib/api/types';
import PostCardShell from './PostCardShell';

interface Post {
  id: number;
  name: string;
  ap_id: string;
  url?: string | null;
  body?: string | null;
  thumbnail_url?: string | null;
  nsfw?: boolean;
  published?: string;
}

interface Community {
  name: string;
  actor_id: string;
}

interface Creator {
  name: string;
  display_name?: string | null;
  actor_id?: string;
}

interface Counts {
  score: number;
  comments: number;
}

interface Props {
  post: Post;
  community: Community;
  creator: Creator;
  counts: Counts;
  auth?: AuthState;
  notifCommentApId?: string;
}

export default function PostDetailCard({
  post, community, creator, counts, auth, notifCommentApId,
}: Props) {
  const backend = useBackend();
  const { settings } = useSettings();
  const [activeSort, setActiveSort] = useState<string>(() => settings.defaultCommentSortId);

  const neutralPost = useMemo<NeutralPost>(() => {
    const srcInstance = instanceFromActorId(community.actor_id);
    const authorInstance = creator.actor_id ? instanceFromActorId(creator.actor_id) : '';
    return {
      id: post.ap_id ? `${post.id}|${post.ap_id}` : String(post.id),
      source: {
        id: community.actor_id,
        handle: `${community.name}@${srcInstance}`,
        name: community.name,
        icon: undefined,
        counts: { members: 0, posts: 0 },
      },
      author: {
        id: creator.actor_id ?? creator.name,
        handle: authorInstance ? `${creator.name}@${authorInstance}` : creator.name,
        displayName: creator.display_name ?? undefined,
        avatar: undefined,
        profileUrl: creator.actor_id ?? '',
      },
      title: post.name,
      body: post.body ?? undefined,
      externalUrl: post.url ?? undefined,
      mediaUrl: post.thumbnail_url ?? undefined,
      nsfw: post.nsfw ?? false,
      publishedAt: post.published ?? new Date().toISOString(),
      permalink: post.ap_id,
      counts: { score: counts.score, comments: counts.comments },
      viewer: undefined,
    };
  }, [post, community, creator, counts]);

  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAllComments([]);
    setNextCursor(null);
    setCommentsLoaded(false);
    backend.comments.list(neutralPost.id, {
      sortId: activeSort,
      sourceHandle: neutralPost.source.handle,
      targetCommentApId: notifCommentApId,
      cursor: null,
    }).then((page) => {
      if (!cancelled) {
        setAllComments(page.items);
        setNextCursor(page.nextCursor);
        setCommentsLoaded(true);
      }
    });
    return () => { cancelled = true; };
  // notifCommentApId intentionally omitted — only used on initial mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neutralPost.id, activeSort]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    backend.comments.list(neutralPost.id, {
      sortId: activeSort,
      sourceHandle: neutralPost.source.handle,
      cursor: nextCursor,
    }).then((page) => {
      setAllComments((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        return [...prev, ...page.items.filter((c) => !existing.has(c.id))];
      });
      setNextCursor(page.nextCursor);
      setLoadingMore(false);
    });
  }, [nextCursor, loadingMore, neutralPost.id, activeSort, backend]);

  const highlightCommentId = useMemo(() => {
    if (!commentsLoaded || !notifCommentApId) return undefined;
    return allComments.find((c) => c.permalink === notifCommentApId)?.id;
  }, [allComments, commentsLoaded, notifCommentApId]);

  // Suppress unused auth warning — kept in props for caller backward compat
  void auth;

  return (
    <div style={{
      position: 'relative', width: '92vw', maxWidth: 440,
      height: 'calc(100dvh - 72px)',
      borderRadius: 20, background: 'var(--card-bg, #1e2128)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', margin: '12px 0',
      display: 'flex', flexDirection: 'column',
    }}>
      <PostCardShell
        post={neutralPost}
        comments={allComments}
        commentsLoaded={commentsLoaded}
        highlightCommentId={highlightCommentId}
        activeSort={activeSort}
        onSortChange={setActiveSort}
        onLoadMore={nextCursor ? handleLoadMore : undefined}
        loadingMore={loadingMore}
      />
    </div>
  );
}
