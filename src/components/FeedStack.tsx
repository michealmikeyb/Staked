import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Post, Source } from '../lib/api/types';
import { useBackend } from '../lib/api/context';
import { loadSeen, addSeen, clearSeen } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';
import PostCard from './PostCard';
import SwipeHint from './SwipeHint';
import MenuDrawer from './MenuDrawer';
import CommunityHeader from './CommunityHeader';
import Toast from './Toast';
import { SORT_OPTIONS } from './HeaderBar';
import { useAccounts, type StakOption } from '../lib/AccountsContext';
import type { ActiveStakRef } from '../lib/api/types';

interface Props {
  auth?: unknown; // kept for App.tsx backward compat — not used internally
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  community?: { name: string; instance: string };
}

const STACK_VISIBLE = 3;
const screenStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 16 };

export default function FeedStack({ unreadCount, setUnreadCount, community }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const backend = useBackend();
  const isLoggedIn = !!backend.session?.viewer;

  const { active, allStaks, setActive } = useAccounts();
  const stak = active?.stakId ?? 'all';
  const stakKeyOf = (s: StakOption) => `${s.sessionId ?? 'anon'}:${s.stakId}`;
  const activeStakKey = active ? `${active.sessionId}:${active.stakId}` : 'anon:anonymous';

  const [posts, setPosts] = useState<Post[]>([]);
  const [undoStack, setUndoStack] = useState<Post[]>([]);
  const [returningPostId, setReturningPostId] = useState<string | null>(null);
  const seenRef = useRef<Set<number>>(community ? new Set() : loadSeen());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sortType, setSortType] = useState<string>(community ? 'Active' : settings.defaultFeedId);

  const isAnonymousMode = active === null;

  const [communityInfo, setCommunityInfo] = useState<Source | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (community) return;
    if (!isLoggedIn) return;
    backend.notifications.unreadCount().then(setUnreadCount).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!community) return;
    if (!isLoggedIn) return;
    backend.sources.get(`${community.name}@${community.instance}`)
      .then(setCommunityInfo)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  useEffect(() => {
    const msg = (location.state as { toast?: string } | null)?.toast;
    if (msg) setToast(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  const loadMore = useCallback(async (sort: string, currentStak: string, nextCursor: string | null) => {
    setLoading(true);
    try {
      const page = community
        ? await backend.feed.getSourceFeed(`${community.name}@${community.instance}`, { feedId: sort, cursor: nextCursor })
        : await backend.feed.getTimeline({ feedId: sort, stakId: currentStak, cursor: nextCursor });

      const unseen = page.items.filter((p) => {
        const localId = parseInt(p.id.split('|')[0], 10) || parseInt(p.id, 10);
        return !seenRef.current.has(localId);
      });

      if (unseen.length === 0 && page.nextCursor === null) {
        setCanLoadMore(false);
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          return [...prev, ...unseen.filter((p) => !existingIds.has(p.id))];
        });
        setCursor(page.nextCursor);
      }
    } catch (err) {
      setCanLoadMore(false);
      if (!nextCursor) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, community?.name, community?.instance]);

  useEffect(() => {
    if (community) return; // community feed loads via its own effect below
    setPosts([]);
    setCursor(null);
    setCanLoadMore(true);
    loadMore(sortType, stak, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, stak]);

  useEffect(() => {
    if (!community) return;
    loadMore(sortType, stak, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMore]);

  useEffect(() => {
    if (posts.length <= 3 && !loading && canLoadMore) {
      loadMore(sortType, stak, cursor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length, loading, canLoadMore, sortType, cursor, stak]);

  function resetAndLoad(sort: string, newStak: string) {
    setPosts([]);
    setCursor(null);
    setCanLoadMore(true);
    loadMore(sort, newStak, null);
  }

  async function handleSubscribeToggle() {
    if (!communityInfo) return;
    const follow = communityInfo.viewer?.subscribed !== 'yes';
    const previous = communityInfo;
    setCommunityInfo({ ...communityInfo, viewer: { subscribed: follow ? 'yes' : 'no' } });
    try {
      await backend.sources.subscribe(communityInfo.id, follow);
    } catch {
      setCommunityInfo(previous);
    }
  }

  async function handleBlock() {
    if (!communityInfo || !community) return;
    await backend.sources.block(communityInfo.id, true);
    navigate('/', { state: { toast: `Blocked c/${community.name}` } });
  }

  function handleSortChange(newSort: string) {
    setSortType(newSort);
    resetAndLoad(newSort, stak);
  }

  function handleStakChange(option: StakOption) {
    const ref: ActiveStakRef | null = option.sessionId
      ? { sessionId: option.sessionId, stakId: option.stakId }
      : null;
    seenRef.current = new Set();
    setActive(ref); // active change → reset+load effect fires with the new backend/stak
  }

  function getLocalId(postId: string): number {
    return parseInt(postId.split('|')[0], 10) || parseInt(postId, 10);
  }

  function dismissTop(postId: string) {
    const topPost = posts[0];
    if (topPost) setUndoStack((stack) => [...stack, topPost]);
    setPosts((prev) => prev.slice(1));
    if (returningPostId !== null) setReturningPostId(null);
    if (!community) addSeen(getLocalId(postId));
    seenRef.current.add(getLocalId(postId));
    window.dispatchEvent(new CustomEvent('stakswipe:swiped'));
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const post = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setPosts((prev) => [post, ...prev]);
    setReturningPostId(post.id);
  }

  function voteForSwipe(isRight: boolean, postId: string): Promise<void> {
    if (isAnonymousMode) return Promise.resolve();
    const isUpvote = isRight !== settings.swapGestures;
    if (isUpvote) return backend.posts.vote(postId, 1).catch(() => {});
    if (settings.nonUpvoteSwipeAction === 'downvote') return backend.posts.vote(postId, -1).catch(() => {});
    return Promise.resolve();
  }

  useEffect(() => {
    const topPost = posts[0];
    if (!topPost) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        voteForSwipe(true, topPost.id);
        dismissTop(topPost.id);
      } else if (e.key === 'ArrowLeft') {
        voteForSwipe(false, topPost.id);
        dismissTop(topPost.id);
      } else if (e.key === 'ArrowDown') {
        handleUndo();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, isAnonymousMode, settings]);

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
        <button onClick={isLoggedIn ? () => setActive(null) : () => navigate('/accounts/add')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>
          {isLoggedIn ? 'Browse anonymously' : 'Log in'}
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
          {stak === 'subscribed'
            ? 'No more posts in your subscriptions.'
            : "You've seen everything in this stak."}
        </div>

        {!community && (
          <>
            <div style={sectionLabel}>Switch stak</div>
            <div style={pillRow}>
              {allStaks.map((s) => {
                const keyActive = stakKeyOf(s) === activeStakKey;
                return (
                  <button key={stakKeyOf(s)} onClick={() => handleStakChange(s)} style={keyActive ? pillActive : pillInactive}>
                    {s.icon} {s.label}{s.handle ? ` · ${s.handle}` : ''}
                  </button>
                );
              })}
            </div>

            <div style={sectionLabel}>Switch sort</div>
            <div style={pillRow}>
              {SORT_OPTIONS.map(({ sort, label }) => (
                <button key={sort} onClick={() => handleSortChange(sort)} style={sort === sortType ? pillActive : pillInactive}>
                  {label}
                </button>
              ))}
            </div>

            {stak !== 'subscribed' && (
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
          sortType={sortType as any}
          onSortChange={handleSortChange as any}
          onBack={() => navigate(-1)}
          communityInfo={communityInfo as any}
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
          staks={allStaks}
          activeStakKey={activeStakKey}
          onStakSelect={handleStakChange}
          onAddAccount={() => navigate('/accounts/add')}
          onManageAccounts={() => navigate('/accounts')}
          isAuthenticated={isLoggedIn}
        />
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {visible.map((post, i) => {
          const isTop = i === 0;
          const scale = 1 - i * 0.04;
          const zIndex = STACK_VISIBLE - i;
          return (
            <PostCard
              key={post.id}
              post={post}
              zIndex={zIndex}
              scale={isTop ? 1 : scale}
              onSwipeRight={isTop ? async () => {
                await voteForSwipe(true, post.id);
                dismissTop(post.id);
              } : () => {}}
              onSwipeLeft={isTop ? async () => {
                await voteForSwipe(false, post.id);
                dismissTop(post.id);
              } : () => {}}
              onUndo={isTop ? handleUndo : () => {}}
              isReturning={isTop && post.id === returningPostId}
              onReturnAnimationComplete={
                isTop && post.id === returningPostId
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
