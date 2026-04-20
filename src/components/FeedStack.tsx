import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchPosts, fetchCommunityPosts, fetchUnreadCount, upvotePost, downvotePost, fetchCommunityInfo, followCommunity, blockCommunity, type PostView, type SortType, type StakType, type CommunityInfo } from '../lib/lemmy';
import { type AuthState, loadSeen, addSeen, clearSeen } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';
import { getAnonInstance } from '../lib/instanceRankings';
import PostCard from './PostCard';
import SwipeHint from './SwipeHint';
import MenuDrawer from './MenuDrawer';
import CommunityHeader from './CommunityHeader';
import Toast from './Toast';
import { SORT_OPTIONS, STAKS } from './HeaderBar';

interface Props {
  auth: AuthState | null;
  onLogout?: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  community?: { name: string; instance: string };
}

const STACK_VISIBLE = 3;
const screenStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16 };

export default function FeedStack({ auth, onLogout, unreadCount, setUnreadCount, community }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, updateSetting } = useSettings();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [undoStack, setUndoStack] = useState<PostView[]>([]);
  const [returningPostId, setReturningPostId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const seenRef = useRef<Set<number>>(community ? new Set() : loadSeen());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [sortType, setSortType] = useState<SortType>(community ? 'Active' : settings.defaultSort);
  const [stak, setStak] = useState<StakType>(auth === null ? 'All' : settings.activeStak);

  const isAnonymousMode = auth === null || stak === 'Anonymous';

  const [communityInfo, setCommunityInfo] = useState<CommunityInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (community) return;
    if (!auth) return;
    fetchUnreadCount(auth.instance, auth.token)
      .then(setUnreadCount)
      .catch(() => {});
  }, [auth, setUnreadCount, community]);

  useEffect(() => {
    if (!community) return;
    if (!auth) return;
    fetchCommunityInfo(auth.instance, auth.token, `${community.name}@${community.instance}`)
      .then(setCommunityInfo)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only: community and auth are stable for the lifetime of this route

  useEffect(() => {
    const msg = (location.state as { toast?: string } | null)?.toast;
    if (msg) setToast(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only: read once from navigation state

  const loadMore = useCallback(async (nextPage: number, sort: SortType, currentStak: StakType) => {
    setLoading(true);
    const isAnonymous = auth === null || currentStak === 'Anonymous';
    const instance = isAnonymous ? (settings.anonInstance || getAnonInstance(sort)) : auth!.instance;
    const token = isAnonymous ? '' : auth!.token;
    const stakForApi: StakType = currentStak === 'Anonymous' ? 'All' : currentStak;
    try {
      const newPosts = community
        ? await fetchCommunityPosts(instance, token, `${community.name}@${community.instance}`, nextPage, sort)
        : await fetchPosts(instance, token, nextPage, sort, stakForApi);
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
  }, [auth, community?.name, community?.instance, settings.anonInstance]);

  useEffect(() => {
    loadMore(1, sortType, stak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMore]);

  useEffect(() => {
    if (posts.length <= 3 && !loading && canLoadMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMore(nextPage, sortType, stak);
    }
  // stak excluded: handleStakChange already calls loadMore directly on stak change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length, loading, page, loadMore, canLoadMore, sortType]);

  function resetAndLoad(sort: SortType, newStak: StakType) {
    setPosts([]);
    setPage(1);
    setCanLoadMore(true);
    loadMore(1, sort, newStak);
  }

  async function handleSubscribeToggle() {
    if (!communityInfo || !auth) return;
    const follow = communityInfo.subscribed !== 'Subscribed';
    const previous = communityInfo;
    setCommunityInfo({ ...communityInfo, subscribed: follow ? 'Subscribed' : 'NotSubscribed' });
    try {
      await followCommunity(auth.instance, auth.token, communityInfo.id, follow);
    } catch {
      setCommunityInfo(previous);
    }
  }

  async function handleBlock() {
    if (!auth || !communityInfo || !community) return;
    await blockCommunity(auth.instance, auth.token, communityInfo.id, true);
    navigate('/', { state: { toast: `Blocked c/${community.name}` } });
  }

  function handleSortChange(newSort: SortType) {
    setSortType(newSort);
    resetAndLoad(newSort, stak);
  }

  function handleStakChange(newStak: StakType) {
    updateSetting('activeStak', newStak);
    setStak(newStak);
    seenRef.current = new Set();
    resetAndLoad(sortType, newStak);
  }

  function dismissTop(postId: number) {
    const topPost = posts[0];
    if (topPost) setUndoStack((stack) => [...stack, topPost]);
    setPosts((prev) => prev.slice(1));
    if (returningPostId !== null) setReturningPostId(null);
    if (!community) addSeen(postId);
    seenRef.current.add(postId);
    window.dispatchEvent(new CustomEvent('stakswipe:swiped'));
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const post = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setPosts((prev) => [post, ...prev]);
    setReturningPostId(post.post.id);
  }

  function voteForSwipe(isRight: boolean, postId: number): Promise<void> {
    if (isAnonymousMode) return Promise.resolve();
    const isUpvote = isRight !== settings.swapGestures;
    if (isUpvote) return upvotePost(auth!.instance, auth!.token, postId).catch(() => {});
    if (settings.nonUpvoteSwipeAction === 'downvote') return downvotePost(auth!.instance, auth!.token, postId).catch(() => {});
    return Promise.resolve();
  }

  useEffect(() => {
    const topPost = posts[0];
    if (!topPost) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        voteForSwipe(true, topPost.post.id);
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowLeft') {
        voteForSwipe(false, topPost.post.id);
        dismissTop(topPost.post.id);
      } else if (e.key === 'ArrowDown') {
        handleUndo();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [posts, auth, settings, isAnonymousMode]);

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
        <button onClick={auth !== null ? onLogout : () => navigate('/login')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
          {auth !== null ? 'Log out' : 'Log in'}
        </button>
      </div>
    );
  }

  if (posts.length === 0 && !loading && !canLoadMore) {
    const pillBase: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 14 };
    const pillActive: React.CSSProperties = { ...pillBase, background: 'var(--accent)', color: '#fff' };
    const pillInactive: React.CSSProperties = { ...pillBase, background: 'var(--surface)', color: 'var(--text-secondary)' };
    const pillRow: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' };
    const sectionLabel: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 };
    return (
      <div style={screenStyle}>
        <div style={{ fontSize: 32 }}>✓</div>
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 280, padding: '0 16px' }}>
          {stak === 'Subscribed'
            ? 'No more posts in your subscriptions.'
            : "You've seen everything in this stak."}
        </div>

        {!community && (
          <>
            <div style={sectionLabel}>Switch stak</div>
            <div style={pillRow}>
              {(auth !== null ? STAKS : STAKS.filter((s) => s.stak === 'All' || s.stak === 'Anonymous')).map(({ stak: s, label, icon }) => (
                <button key={s} onClick={() => handleStakChange(s)} style={s === stak ? pillActive : pillInactive}>
                  {icon} {label}
                </button>
              ))}
            </div>

            <div style={sectionLabel}>Switch sort</div>
            <div style={pillRow}>
              {SORT_OPTIONS.map(({ sort, label }) => (
                <button key={sort} onClick={() => handleSortChange(sort)} style={sort === sortType ? pillActive : pillInactive}>
                  {label}
                </button>
              ))}
            </div>

            {stak !== 'Subscribed' && (
              <button
                onClick={() => { clearSeen(); window.location.reload(); }}
                style={{ ...pillInactive, marginTop: 8 }}
              >
                Reset seen history
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const visible = posts.slice(0, STACK_VISIBLE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {community ? (
        <CommunityHeader
          name={community.name}
          instance={community.instance}
          sortType={sortType}
          onSortChange={handleSortChange}
          onBack={() => navigate(-1)}
          communityInfo={communityInfo}
          onSubscribeToggle={handleSubscribeToggle}
          onBlock={handleBlock}
        />
      ) : (
        <MenuDrawer
          sortType={sortType}
          onSortChange={handleSortChange}
          onNavigate={navigate}
          onLogoClick={() => navigate('/')}
          unreadCount={unreadCount}
          activeStak={auth !== null ? stak : undefined}
          onStakChange={auth !== null ? handleStakChange : undefined}
          isAuthenticated={auth !== null}
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
                await voteForSwipe(true, post.post.id);
                dismissTop(post.post.id);
              } : () => {}}
              onSwipeLeft={isTop ? async () => {
                await voteForSwipe(false, post.post.id);
                dismissTop(post.post.id);
              } : () => {}}
              onUndo={isTop ? handleUndo : () => {}}
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
      <Toast message={toast ?? ''} visible={!!toast} onHide={() => setToast(null)} />
    </div>
  );
}
