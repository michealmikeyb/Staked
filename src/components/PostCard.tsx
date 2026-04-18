import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { type PostView, type CommentSortType } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { useCommentLoader } from '../hooks/useCommentLoader';
import { useSettings } from '../lib/SettingsContext';
import PostCardShell from './PostCardShell';
import styles from './PostCard.module.css';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;
const EMPTY_MOTION_PROPS = {};

interface Props {
  post: PostView;
  auth: AuthState | null;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onUndo: () => void;
  isReturning?: boolean;
  onReturnAnimationComplete?: () => void;
}

export default function PostCard({
  post, auth, zIndex, scale,
  onSwipeRight, onSwipeLeft, onUndo,
  isReturning = false,
  onReturnAnimationComplete,
}: Props) {
  const { post: p, community, creator, counts } = post;
  const { settings } = useSettings();
  const [activeSort, setActiveSort] = useState<CommentSortType>(() => settings.commentSort);
  const { comments, commentsLoaded } = useCommentLoader(p, community, auth, activeSort);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

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
        post={p}
        community={community}
        creator={creator}
        counts={counts}
        auth={auth ?? undefined}
        comments={comments}
        commentsLoaded={commentsLoaded}
        scrollRef={scrollRef}
        blurNsfw={settings.blurNsfw}
        activeSort={activeSort}
        onSortChange={setActiveSort}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </motion.div>
  );
}
