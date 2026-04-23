import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSavedPosts, savePost, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { isImageUrl, placeholderColor } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';

interface Props {
  auth: AuthState;
}

export default function SavedPage({ auth }: Props) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const loadingRef = useRef(false);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await fetchSavedPosts(auth.instance, auth.token, pageNum);
      if (result.length === 0) {
        setCanLoadMore(false);
      } else {
        setPosts((prev) => [...prev, ...result]);
      }
    } catch (err) {
      if (pageNum === 1) {
        setError(err instanceof Error ? err.message : 'Failed to load saved posts');
      } else {
        setCanLoadMore(false);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [auth]);

  const handleUnsave = async (postId: number) => {
    const snapshot = posts;
    setPosts((prev) => prev.filter((pv) => pv.post.id !== postId));
    try {
      await savePost(auth.instance, auth.token, postId, false);
    } catch {
      setPosts(snapshot);
    }
  };

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    if (!canLoadMore) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingRef.current && canLoadMore) {
        pageRef.current += 1;
        loadPage(pageRef.current);
      }
    }, { threshold: 0.1 });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadPage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading…</div>
        )}
        {!loading && error && (
          <div style={{ textAlign: 'center', color: '#ff4444', padding: 32 }}>{error}</div>
        )}
        {!loading && !error && posts.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No saved posts</div>
        )}
        {posts.map((pv) => {
          const { post, community, counts } = pv;
          const isImage = !!post.url && isImageUrl(post.url);
          const bannerSrc = isImage ? post.url : post.thumbnail_url;

          return (
            <div
              key={post.id}
              onClick={() => navigate(`/saved/${post.id}`, { state: { post: pv } })}
              style={{
                margin: '6px 12px',
                background: '#1e2128',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              {bannerSrc ? (
                <img
                  src={bannerSrc}
                  alt=""
                  style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: 120,
                  background: placeholderColor(post.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, color: 'rgba(255,255,255,0.15)',
                }}>
                  🔖
                </div>
              )}
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600, marginBottom: 5 }}>
                  c/{community.name}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35,
                  marginBottom: 8,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {post.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                    <span>▲ {counts.score}</span>
                    <span>💬 {counts.comments}</span>
                  </div>
                  <button
                    aria-label="Unsave"
                    onClick={(e) => { e.stopPropagation(); handleUnsave(post.id); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: '#888', padding: '2px 6px',
                    }}
                  >
                    🔖 Unsave
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {canLoadMore && !error && <div ref={sentinelRef} style={{ height: 1 }} />}
      </div>
    </div>
  );
}
