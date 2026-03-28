import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { fetchPosts, upvotePost, downvotePost, savePost, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import PostCard from './PostCard';
import CommentsPanel from './CommentsPanel';
import SwipeHint from './SwipeHint';
import Toast from './Toast';

interface Props {
  auth: AuthState;
  onLogout: () => void;
}

const STACK_VISIBLE = 3;

export default function FeedStack({ auth, onLogout }: Props) {
  const [posts, setPosts] = useState<PostView[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentPost, setCommentPost] = useState<PostView | null>(null);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
  }

  const loadMore = useCallback(async (nextPage: number) => {
    try {
      const newPosts = await fetchPosts(auth.instance, auth.token, nextPage);
      setPosts((prev) => [...prev, ...newPosts]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    loadMore(1);
  }, [loadMore]);

  useEffect(() => {
    if (posts.length <= 3 && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMore(nextPage);
    }
  }, [posts.length, loading, page, loadMore]);

  function dismissTop() {
    setPosts((prev) => prev.slice(1));
  }

  if (loading && posts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
        <div style={{ color: '#ff4444' }}>{error}</div>
        <button onClick={onLogout} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
          Log out
        </button>
      </div>
    );
  }

  const visible = posts.slice(0, STACK_VISIBLE);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'relative' }}>
      {visible.map((post, i) => {
        const isTop = i === 0;
        const scale = 1 - i * 0.04;
        const zIndex = STACK_VISIBLE - i;
        return (
          <PostCard
            key={post.post.id}
            post={post}
            zIndex={zIndex}
            scale={isTop ? 1 : scale}
            onSwipeRight={isTop ? async () => {
              await upvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
              dismissTop();
            } : () => {}}
            onSwipeLeft={isTop ? async () => {
              await downvotePost(auth.instance, auth.token, post.post.id).catch(() => {});
              dismissTop();
            } : () => {}}
            onOpenComments={() => setCommentPost(post)}
          />
        );
      })}
      <AnimatePresence>
        {commentPost && (
          <CommentsPanel
            post={commentPost}
            auth={auth}
            onClose={() => setCommentPost(null)}
            onSave={async () => {
              await savePost(auth.instance, auth.token, commentPost.post.id).catch(() => {});
              setCommentPost(null);
              dismissTop();
              showToast('Post saved!');
            }}
          />
        )}
      </AnimatePresence>
      <SwipeHint />
      <Toast message={toast} visible={toastVisible} onHide={() => setToastVisible(false)} />
    </div>
  );
}
