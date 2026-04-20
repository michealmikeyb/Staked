import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPersonDetails, blockPerson, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { isImageUrl, placeholderColor } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';

interface Props {
  auth: AuthState;
  target?: { username: string; instance: string };
}

type Tab = 'all' | 'posts' | 'comments';

type FeedItem =
  | { kind: 'post'; data: PostView; published: string }
  | { kind: 'comment'; data: CommentView; published: string };

export default function ProfilePage({ auth, target }: Props) {
  const navigate = useNavigate();
  // Display values shown in the header
  const displayUsername = target?.username ?? auth.username;
  const displayInstance = target?.instance ?? auth.instance;
  // Fetch from auth.instance using "user@instance" format so federation handles it —
  // avoids hitting non-Lemmy instances (PieFed, Kbin, etc.) directly.
  const fetchUsername = target ? `${target.username}@${target.instance}` : auth.username;

  const [posts, setPosts] = useState<PostView[]>([]);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [personId, setPersonId] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState('');
  const loadingRef = useRef(false);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await fetchPersonDetails(auth.instance, auth.token, fetchUsername, pageNum);
      if (result.posts.length === 0 && result.comments.length === 0) {
        setCanLoadMore(false);
      } else {
        setPosts((prev) => [...prev, ...result.posts]);
        setComments((prev) => [...prev, ...result.comments]);
      }
      if (pageNum === 1 && result.personId !== null) {
        setPersonId(result.personId);
      }
    } catch (err) {
      if (pageNum === 1) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } else {
        setCanLoadMore(false);
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [auth.instance, auth.token, fetchUsername]);

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

  const allItems = useMemo<FeedItem[]>(() => [
    ...posts.map((pv): FeedItem => ({ kind: 'post', data: pv, published: pv.post.published })),
    ...comments.map((cv): FeedItem => ({ kind: 'comment', data: cv, published: cv.comment.published })),
  ].sort((a, b) => b.published.localeCompare(a.published)), [posts, comments]);

  const visibleItems = useMemo<FeedItem[]>(() =>
    tab === 'posts' ? allItems.filter((i) => i.kind === 'post') :
    tab === 'comments' ? allItems.filter((i) => i.kind === 'comment') :
    allItems,
  [allItems, tab]);

  const isEmpty = !loading && !error && posts.length === 0 && comments.length === 0;

  async function handleBlockPerson() {
    if (!personId) return;
    setBlocking(true);
    setBlockError('');
    try {
      await blockPerson(auth.instance, auth.token, personId, true);
      setShowConfirm(false);
      navigate('/', { state: { toast: `Blocked u/${displayUsername}` } });
    } catch {
      setBlockError('Failed to block. Try again.');
    } finally {
      setBlocking(false);
    }
  }

  const menuItemStyle: React.CSSProperties = {
    background: '#2a2d35', border: 'none', borderRadius: 8,
    cursor: 'pointer', padding: '10px 4px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    color: '#f5f5f5', fontSize: 11, fontWeight: 500,
  };

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
      <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />

      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #2a2d35' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 2 }}>
              u/{displayUsername}
            </div>
            <div style={{ fontSize: 11, color: '#666' }}>{displayInstance}</div>
          </div>
          {target && !(target.username === auth.username && target.instance === auth.instance) && (
            <button
              aria-label="Profile menu"
              onClick={() => { setShowMenu((v) => !v); setShowConfirm(false); setBlockError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 18, padding: '0 0 0 12px', lineHeight: 1 }}
            >
              ☰
            </button>
          )}
        </div>
      </div>

      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'fixed', top: 112, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <button
                aria-label="Block"
                onClick={() => { setShowMenu(false); setShowConfirm(true); }}
                style={menuItemStyle}
              >
                <span style={{ fontSize: 20 }}>🚫</span>
                Block
              </button>
            </div>
          </div>
        </>
      )}

      {showConfirm && (
        <>
          <div onClick={() => { setShowConfirm(false); setBlockError(''); }} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'fixed', top: 112, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30, padding: 16 }}>
            <div style={{ color: '#f5f5f5', fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
              Block u/{displayUsername}?
            </div>
            {blockError && (
              <div style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{blockError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                aria-label="Cancel"
                onClick={() => { setShowConfirm(false); setBlockError(''); }}
                style={{ flex: 1, padding: '10px 0', background: '#2a2d35', border: 'none', borderRadius: 8, color: '#f5f5f5', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                aria-label="Block"
                onClick={handleBlockPerson}
                disabled={blocking}
                style={{ flex: 1, padding: '10px 0', background: '#cc2222', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: blocking ? 'not-allowed' : 'pointer', fontSize: 14, opacity: blocking ? 0.6 : 1 }}
              >
                {blocking ? '…' : 'Block'}
              </button>
            </div>
          </div>
        </>
      )}

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
            const { post, community, counts } = item.data;
            const isImage = !!post.url && isImageUrl(post.url);
            const bannerSrc = isImage ? post.url : post.thumbnail_url;
            return (
              <div
                key={`post-${post.id}`}
                onClick={() => navigate(`/profile/${post.id}`, { state: { post: item.data } })}
                style={{ margin: '6px 12px', background: '#1e2128', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}
              >
                {bannerSrc ? (
                  <img src={bannerSrc} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{
                    width: '100%', height: 120, background: placeholderColor(post.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, color: 'rgba(255,255,255,0.15)',
                  }}>👤</div>
                )}
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 8, background: '#ff6b35', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>POST</span>
                    <span style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600 }}>c/{community.name}</span>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35, marginBottom: 8,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{post.name}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                    <span>▲ {counts.score}</span>
                    <span>💬 {counts.comments}</span>
                  </div>
                </div>
              </div>
            );
          }

          const { comment, post, community, counts } = item.data;
          return (
            <div
              key={`comment-${comment.id}`}
              onClick={() => navigate(`/profile/${post.id}`, {
                state: {
                  postId: post.id,
                  commentApId: comment.ap_id,
                },
              })}
              style={{ margin: '6px 12px', background: '#1e2128', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 8, background: '#4a9eff', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>COMMENT</span>
                <span style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600 }}>c/{community.name}</span>
              </div>
              <div style={{
                fontSize: 11, color: '#666', borderLeft: '2px solid #2a2d35', paddingLeft: 8, marginBottom: 6,
                fontStyle: 'italic',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{post.name}</div>
              <div style={{
                fontSize: 13, color: '#d0d0d0', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{comment.content}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 6 }}>▲ {counts.score}</div>
            </div>
          );
        })}

        {canLoadMore && !error && <div ref={sentinelRef} style={{ height: 1 }} />}
      </div>
    </div>
  );
}
