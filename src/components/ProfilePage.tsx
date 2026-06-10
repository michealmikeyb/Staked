import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Post, Comment, User } from '../lib/api/types';
import { isImageUrl, placeholderColor } from '../lib/urlUtils';
import ProfileHeader from './ProfileHeader';

interface Props {
  auth?: unknown; // kept for App.tsx compat — backend provides session
  target?: { username: string; instance: string };
}

type Tab = 'all' | 'posts' | 'comments';

type FeedItem =
  | { kind: 'post'; data: Post; published: string }
  | { kind: 'comment'; data: Comment; published: string };

function ConfirmStrip({ label, onCancel, onConfirm, style }: {
  label: string;
  onCancel: (e: React.MouseEvent) => void;
  onConfirm: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, ...style }}>
      <span style={{ color: '#f0f0f0' }}>{label}</span>
      <button onClick={onCancel} style={{ background: '#2a2d35', border: 'none', borderRadius: 6, color: '#aaa', padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>
        Cancel
      </button>
      <button onClick={onConfirm} style={{ background: '#c0392b', border: 'none', borderRadius: 6, color: '#fff', padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
        Delete
      </button>
    </div>
  );
}

export default function ProfilePage({ target }: Props) {
  const navigate = useNavigate();
  const backend = useBackend();

  const viewerHandle = backend.session?.viewer?.handle ?? '';
  const handle = target ? `${target.username}@${target.instance}` : viewerHandle;
  const displayUsername = target?.username ?? (viewerHandle.includes('@') ? viewerHandle.split('@')[0] : viewerHandle);
  const displayInstance = target?.instance ?? (viewerHandle.includes('@') ? viewerHandle.split('@')[1] : '');

  const isOwnProfile = !!backend.session && (!target || backend.session.viewer?.handle === handle);

  const [user, setUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ kind: 'post' | 'comment'; id: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      return;
    }
    Promise.all([
      backend.users.get(handle),
      backend.users.getPosts(handle, { cursor: null }),
      backend.users.getComments(handle, { cursor: null }),
    ]).then(([u, postsPage, commentsPage]) => {
      setUser(u);
      setPosts(postsPage.items);
      setComments(commentsPage.items);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allItems = useMemo<FeedItem[]>(() => [
    ...posts.map((p): FeedItem => ({ kind: 'post', data: p, published: p.publishedAt })),
    ...comments.map((c): FeedItem => ({ kind: 'comment', data: c, published: c.publishedAt })),
  ].sort((a, b) => b.published.localeCompare(a.published)), [posts, comments]);

  const visibleItems = useMemo<FeedItem[]>(() =>
    tab === 'posts' ? allItems.filter((i) => i.kind === 'post') :
    tab === 'comments' ? allItems.filter((i) => i.kind === 'comment') :
    allItems,
  [allItems, tab]);

  const isEmpty = !loading && !error && posts.length === 0 && comments.length === 0;

  async function handleDelete(kind: 'post' | 'comment', id: string) {
    try {
      if (kind === 'post') {
        await backend.posts.delete(id);
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        await backend.comments.delete(id);
        setComments((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
    } finally {
      setDeleteConfirm(null);
    }
  }

  async function handleBlockPerson() {
    if (!user) return;
    await backend.users.block(user.id, true);
    navigate('/', { state: { toast: `Blocked u/${displayUsername}` } });
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1, textAlign: 'center', padding: '10px 0', fontSize: 13,
    fontWeight: tab === t ? 600 : 400,
    color: tab === t ? '#ff6b35' : '#555',
    borderBottom: tab === t ? '2px solid #ff6b35' : '2px solid transparent',
    marginBottom: -2,
    background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <ProfileHeader
        username={displayUsername}
        instance={displayInstance}
        onBack={() => navigate(-1)}
        onBlock={!!backend.session && !!target && !isOwnProfile ? handleBlockPerson : undefined}
        blockDisabled={!user}
      />

      <div style={{ display: 'flex', borderBottom: '2px solid #2a2d35', background: '#1a1d24' }}>
        <button style={tabStyle('all')} onClick={() => setTab('all')} aria-label="All">All</button>
        <button style={tabStyle('posts')} onClick={() => setTab('posts')} aria-label="Posts">Posts</button>
        <button style={tabStyle('comments')} onClick={() => setTab('comments')} aria-label="Comments">Comments</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading…</div>
        )}
        {!loading && error && (
          <div style={{ textAlign: 'center', color: '#ff4444', padding: 32 }}>{error}</div>
        )}
        {isEmpty && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No activity yet</div>
        )}

        {visibleItems.map((item) => {
          if (item.kind === 'post') {
            const post = item.data;
            const isImage = !!post.externalUrl && isImageUrl(post.externalUrl);
            const bannerSrc = isImage ? post.externalUrl : post.mediaUrl;
            return (
              <div
                key={`post-${post.id}`}
                onClick={() => navigate(`/profile/${post.id}`, { state: { post } })}
                style={{ margin: '6px 12px', background: '#1e2128', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}
              >
                {bannerSrc ? (
                  <img src={bannerSrc} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{
                    width: '100%', height: 120, background: placeholderColor(post.title ?? ''),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, color: 'rgba(255,255,255,0.15)',
                  }}>👤</div>
                )}
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 8, background: '#ff6b35', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>POST</span>
                    <span style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600 }}>c/{post.source.name}</span>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35, marginBottom: 8,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{post.title}</div>
                  {deleteConfirm?.kind === 'post' && deleteConfirm.id === post.id ? (
                    <ConfirmStrip
                      label="Delete post?"
                      onCancel={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                      onConfirm={(e) => { e.stopPropagation(); handleDelete('post', post.id); }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                        <span>▲ {post.counts.score}</span>
                        <span>💬 {post.counts.comments}</span>
                      </div>
                      {isOwnProfile && (
                        <button
                          aria-label="Delete post"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ kind: 'post', id: post.id }); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555', padding: '0 4px' }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          const comment = item.data;
          return (
            <div
              key={`comment-${comment.id}`}
              onClick={() => navigate(`/profile/${comment.postId}`, {
                state: {
                  postId: comment.postId,
                  commentApId: comment.permalink,
                },
              })}
              style={{ margin: '6px 12px', background: '#1e2128', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 8, background: '#4a9eff', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>COMMENT</span>
              </div>
              <div style={{
                fontSize: 13, color: '#d0d0d0', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{comment.body}</div>
              {deleteConfirm?.kind === 'comment' && deleteConfirm.id === comment.id ? (
                <ConfirmStrip
                  label="Delete comment?"
                  onCancel={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                  onConfirm={(e) => { e.stopPropagation(); handleDelete('comment', comment.id); }}
                  style={{ marginTop: 6 }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <div style={{ fontSize: 10, color: '#555' }}>▲ {comment.counts.score}</div>
                  {isOwnProfile && (
                    <button
                      aria-label="Delete comment"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ kind: 'comment', id: comment.id }); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555', padding: '0 4px' }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
