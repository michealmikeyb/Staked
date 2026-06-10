import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Post } from '../lib/api/types';
import { isImageUrl, placeholderColor } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';

interface Props {
  auth?: unknown; // kept for App.tsx compat — backend provides session
}

export default function SavedPage({ auth: _auth }: Props) {
  const navigate = useNavigate();
  const backend = useBackend();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    backend.feed.getSavedPosts({ cursor: null })
      .then((page) => {
        setPosts(page.items);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load saved posts');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnsave = async (postId: string) => {
    const snapshot = posts;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await backend.posts.save(postId, false);
    } catch {
      setPosts(snapshot);
    }
  };

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
        {posts.map((post) => {
          const isImage = !!post.externalUrl && isImageUrl(post.externalUrl);
          const bannerSrc = isImage ? post.externalUrl : post.mediaUrl;

          return (
            <div
              key={post.id}
              onClick={() => navigate(`/saved/${post.id}`, { state: { post } })}
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
                  background: placeholderColor(post.title ?? ''),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, color: 'rgba(255,255,255,0.15)',
                }}>
                  🔖
                </div>
              )}
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600, marginBottom: 5 }}>
                  c/{post.source.name}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35,
                  marginBottom: 8,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {post.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                    <span>▲ {post.counts.score}</span>
                    <span>💬 {post.counts.comments}</span>
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
      </div>
    </div>
  );
}
