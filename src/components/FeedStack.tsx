import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPosts, upvotePost, downvotePost, savePost, type PostView, type SortType } from '../lib/lemmy';
import { type AuthState, loadSeen, addSeen, clearSeen } from '../lib/store';
import PostCard from './PostCard';
import SwipeHint from './SwipeHint';
import HeaderBar from './HeaderBar';

interface Props {
  auth: AuthState;
  onLogout: () => void;
}

const STACK_VISIBLE = 3;
const screenStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16 };

export default function FeedStack({ auth, onLogout }: Props) {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [page, setPage] = useState(1);
  const seenRef = useRef<Set<number>>(loadSeen());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [sortType, setSortType] = useState<SortType>('TopTwelveHour');
  const [showDrawer, setShowDrawer] = useState(false);

  const loadMore = useCallback(async (nextPage: number, sort: SortType) => {
    try {
      const newPosts = await fetchPosts(auth.instance, auth.token, nextPage, sort);
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
  }, [auth]);

  useEffect(() => {
    loadMore(1, sortType);
  }, [loadMore]); // eslint-disable-line react-hooks/exhaustive-deps

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
    addSeen(postId);
    seenRef.current.add(postId);
    setPosts((prev) => prev.slice(1));
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
        savePost(auth.instance, auth.token, topPost.post.id).catch(() => {});
        dismissTop(topPost.post.id);
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
        <button
          onClick={() => { clearSeen(); window.location.reload(); }}
          style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}
        >
          Reset seen history
        </button>
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
      <HeaderBar sortType={sortType} onSortChange={handleSortChange} onMenuOpen={() => setShowDrawer((v) => !v)} />
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
              onSave={isTop ? () => {
                savePost(auth.instance, auth.token, post.post.id).catch(() => {});
                dismissTop(post.post.id);
              } : () => {}}
            />
          );
        })}
        <SwipeHint />
      </div>
      {showDrawer && (
        <>
          <div
            onClick={() => setShowDrawer(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '1px solid #2a2d35',
            zIndex: 40, padding: 16,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { icon: '🔖', label: 'Saved' },
                { icon: '👤', label: 'Profile' },
                { icon: '📬', label: 'Inbox' },
              ].map(({ icon, label }) => (
                <button
                  key={label}
                  onClick={() => setShowDrawer(false)}
                  style={{
                    background: '#2a2d35', border: 'none', borderRadius: 12,
                    cursor: 'pointer', padding: '14px 8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    color: '#f5f5f5', fontSize: 12, fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
