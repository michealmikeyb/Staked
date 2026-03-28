import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPosts, upvotePost, downvotePost, type PostView } from '../lib/lemmy';
import { type AuthState, loadSeen, addSeen, clearSeen } from '../lib/store';
import PostCard from './PostCard';
import SwipeHint from './SwipeHint';

interface Props {
  auth: AuthState;
  onLogout: () => void;
}

const STACK_VISIBLE = 3;
const screenStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 };

export default function FeedStack({ auth, onLogout }: Props) {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [page, setPage] = useState(1);
  const seenRef = useRef<Set<number>>(loadSeen());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);

  const loadMore = useCallback(async (nextPage: number) => {
    try {
      const newPosts = await fetchPosts(auth.instance, auth.token, nextPage);
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
    loadMore(1);
  }, [loadMore]);

  useEffect(() => {
    if (posts.length <= 3 && !loading && canLoadMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMore(nextPage);
    }
  }, [posts.length, loading, page, loadMore, canLoadMore]);

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
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [posts, auth]);

  if (loading && posts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'relative', overflow: 'hidden' }}>
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
          />
        );
      })}
      <SwipeHint />
    </div>
  );
}
