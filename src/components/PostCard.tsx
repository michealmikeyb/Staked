import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import type { Post, Comment } from '../lib/api/types';
import { useBackend } from '../lib/api/context';
import { useSettings } from '../lib/SettingsContext';
import PostCardShell from './PostCardShell';
import styles from './PostCard.module.css';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;
const EMPTY_MOTION_PROPS = {};

interface Props {
  post: Post;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onUndo: () => void;
  isReturning?: boolean;
  onReturnAnimationComplete?: () => void;
}

export default function PostCard({
  post, zIndex, scale,
  onSwipeRight, onSwipeLeft, onUndo,
  isReturning = false,
  onReturnAnimationComplete,
}: Props) {
  const backend = useBackend();
  const { settings } = useSettings();
  const [activeSort, setActiveSort] = useState<string>(() => settings.defaultCommentSortId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAllComments([]);
    setNextCursor(null);
    setCommentsLoaded(false);
    backend.comments.list(post.id, { sortId: activeSort, sourceHandle: post.source.handle, cursor: null })
      .then((page) => {
        if (!cancelled) {
          setAllComments(page.items);
          setNextCursor(page.nextCursor);
          setCommentsLoaded(true);
        }
      }).catch(() => { if (!cancelled) setCommentsLoaded(true); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, activeSort]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    backend.comments.list(post.id, { sortId: activeSort, sourceHandle: post.source.handle, cursor: nextCursor })
      .then((page) => {
        setAllComments((prev) => {
          const existing = new Set(prev.map((c) => c.id));
          return [...prev, ...page.items.filter((c) => !existing.has(c.id))];
        });
        setNextCursor(page.nextCursor);
        setLoadingMore(false);
      }).catch(() => { setLoadingMore(false); });
  }, [nextCursor, loadingMore, post.id, activeSort, backend]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 0, 150], [12, 0, -12]);
  const overlayColor = useTransform(x, (v) => {
    const opacity = Math.min(Math.abs(v) / 120, 1) * 0.45;
    return v > 0 ? `rgba(255,107,53,${opacity})` : `rgba(80,80,80,${opacity})`;
  });

  const bind = useDrag(({ movement: [mx], velocity: [vx], last }) => {
    x.set(mx);
    if (last) {
      const shouldSwipe = Math.abs(mx) > SWIPE_THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD;
      if (shouldSwipe && mx > 0) {
        animate(x, 600, { duration: 0.3, onComplete: onSwipeRight });
      } else if (shouldSwipe && mx < 0) {
        animate(x, -600, { duration: 0.3, onComplete: onSwipeLeft });
      } else {
        animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      }
    }
  }, { axis: 'x', filterTaps: true, pointer: { touch: true } });

  const returningMotionProps = isReturning
    ? {
        initial: { y: '-110vh' },
        animate: { y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
        onAnimationComplete: onReturnAnimationComplete,
      }
    : EMPTY_MOTION_PROPS;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const delta = e.touches[0].clientY - touchStartY.current;
    if (scrollRef.current && scrollRef.current.scrollTop <= 0 && delta > 0) {
      setPullDelta(delta);
    } else {
      setPullDelta(0);
    }
  };

  const handleTouchEnd = () => {
    if (pullDelta >= 80) onUndo();
    setPullDelta(0);
  };

  return (
    <motion.div
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...returningMotionProps}
      {...(bind() as object)}
    >
      <motion.div className={styles.overlay} style={{ backgroundColor: overlayColor }} />
      <motion.div
        className={styles.undoOverlay}
        style={{ opacity: Math.min(pullDelta / 80, 1) }}
      >
        <span style={{ fontSize: '3rem' }}>↩</span>
      </motion.div>
      <PostCardShell
        post={post}
        comments={allComments}
        commentsLoaded={commentsLoaded}
        scrollRef={scrollRef}
        blurNsfw={settings.blurNsfw}
        activeSort={activeSort}
        onSortChange={setActiveSort}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onLoadMore={nextCursor ? handleLoadMore : undefined}
        loadingMore={loadingMore}
      />
    </motion.div>
  );
}
