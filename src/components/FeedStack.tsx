import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPosts, fetchCommunityPosts, fetchUnreadCount, upvotePost, downvotePost, savePost, type PostView, type SortType } from '../lib/lemmy';
import { type AuthState, loadSeen, addSeen, clearSeen } from '../lib/store';
import PostCard from './PostCard';
import SwipeHint from './SwipeHint';
import MenuDrawer from './MenuDrawer';
import CommunityHeader from './CommunityHeader';

interface Props {
  auth: AuthState;
  onLogout: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  community?: { name: string; instance: string };
}

const STACK_VISIBLE = 3;
const screenStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16 };

export default function FeedStack({ auth, onLogout, unreadCount, setUnreadCount, community }: Props) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [undoStack, setUndoStack] = useState<PostView[]>([]);
  const [returningPostId, setReturningPostId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const seenRef = useRef<Set<number>>(community ? new Set() : loadSeen());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [sortType, setSortType] = useState<SortType>(community ? 'Active' : 'TopTwelveHour');

  useEffect(() => {
    if (community) return;
    fetchUnreadCount(auth.instance, auth.token)
      .then(setUnreadCount)
      .catch(() => {});
  }, [auth, setUnreadCount, community]);

  const loadMore = useCallback(async (nextPage: number, sort: SortType) => {
    setLoading(true);
    try {
      const newPosts = community
        ? await fetchCommunityPosts(auth.instance, auth.token, `${community.name}@${community.instance}`, nextPage, sort)
        : await fetchPosts(auth.instance, auth.token, nextPage, sort);
      if (newPosts.length === 0) {
        setCanLoadMore(false);
      } else {
        const unseen = newPosts.filter((p) => !seenRef.current.has(p.post.id));
        setPosts((prev) => [...prev, ...unseen]);
      }
    } catch (err) {
      setCanLoadMore(false);
      if (nextPage === 1) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      }
    } finally {
      setLoading(false);
    }
  // Use primitive values (not the community object) as deps to avoid re-creating
  // loadMore every render when the parent passes `community={{ ... }}` inline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, community?.name, community?.instance]);

  useEffect(() => {
    loadMore(1, sortType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMore]);

  useEffect(() => {
    if (posts.length <= 3 && !loading && canLoadMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMore(nextPage, sortType);
    }
  }, [posts.length, loading, page, loadMore, canLoadMore, sortType]);

  function handleSortChange(newSort: SortType) {
    setSortType(newSort);
    setPosts([]);
    setPage(1);
    setCanLoadMore(true);
    setLoading(true);
    loadMore(1, newSort);
  }

  function dismissTop(postId: number) {
    const topPost = posts[0];
    if (topPost) setUndoStack((stack) => [...stack, topPost]);
    setPosts((prev) => prev.slice(1));
    setReturningPostId(null);
    if (!community) addSeen(postId);
    seenRef.current.add(postId);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const post = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setPosts((prev) => [post, ...prev]);
    setReturningPostId(post.post.id);
  }

  useEffect(() => {
    const topPost = posts[0];
    if (!topPost) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        upvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowLeft') {
        downvotePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowDown') {
        handleUndo();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [posts, auth]);

  if (loading && posts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={screenStyle}>
        <div style={{ color: '#ff4444' }}>{error}</div>
        <button onClick={onLogout} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
          Log out
        </button>
      </div>
    );
  }

  if (posts.length === 0 && !loading && !canLoadMore) {
    return (
      <div style={screenStyle}>
        <div style={{ color: 'var(--text-secondary)' }}>You've seen everything!</div>
        {!community && (
          <button
            onClick={() => { clearSeen(); window.location.reload(); }}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
          >
            Reset seen history
          </button>
        )}
        <button
          onClick={onLogout}
          style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--text-secondary)', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
        >
          Log out
        </button>
      </div>
    );
  }

  const visible = posts.slice(0, STACK_VISIBLE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {community ? (
        <CommunityHeader
          name={community.name}
          sortType={sortType}
          onSortChange={handleSortChange}
          onBack={() => navigate(-1)}
        />
      ) : (
        <MenuDrawer
          sortType={sortType}
          onSortChange={handleSortChange}
          onNavigate={navigate}
          onLogoClick={() => navigate('/')}
          unreadCount={unreadCount}
        />
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {visible.map((post, i) => {
          const isTop = i === 0;
          const scale = 1 - i * 0.04;
          const zIndex = STACK_VISIBLE - i;
          return (
            <PostCard
              key={post.post.id}
              post={post}
              auth={auth}
              zIndex={zIndex}
              scale={isTop ? 1 : scale}
              onSwipeRight={isTop ? async () => {
                await upvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
                dismissTop(post.post.id);
              } : () => {}}
              onSwipeLeft={isTop ? async () => {
                await downvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
                dismissTop(post.post.id);
              } : () => {}}
              onUndo={isTop ? handleUndo : () => {}}
              onSave={isTop ? () => {
                savePost(auth.instance, auth.token, post.post.id).catch(() => {});
              } : () => {}}
              isReturning={isTop && post.post.id === returningPostId}
              onReturnAnimationComplete={
                isTop && post.post.id === returningPostId
                  ? () => setReturningPostId(null)
                  : undefined
              }
            />
          );
        })}
        <SwipeHint />
      </div>
    </div>
  );
}
