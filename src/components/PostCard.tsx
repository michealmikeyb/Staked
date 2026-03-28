import { useMemo } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { type PostView } from '../lib/lemmy';
import styles from './PostCard.module.css';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

interface Props {
  post: PostView;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onOpenComments: () => void;
}

function communityInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function instanceFromActorId(actorId: string): string {
  try { return new URL(actorId).hostname; } catch { return ''; }
}

export default function PostCard({ post, zIndex, scale, onSwipeRight, onSwipeLeft, onOpenComments }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = useMemo(() => instanceFromActorId(community.actor_id), [community.actor_id]);

  const x = useMotionValue(0);

  // Right swipe rotates CCW ("lifting"), left swipe CW ("sinking") — opposite of standard Tinder.
  const rotate = useTransform(x, [-150, 0, 150], [12, 0, -12]);

  const overlayColor = useTransform(x, (v) => {
    const opacity = Math.min(Math.abs(v) / 120, 1) * 0.45;
    return v > 0 ? `rgba(255,107,53,${opacity})` : `rgba(80,80,80,${opacity})`;
  });

  const bind = useDrag(({ movement: [mx], velocity: [vx], last }) => {
    x.set(mx);

    if (last) {
      const absMx = Math.abs(mx);
      const absVx = Math.abs(vx);
      const shouldSwipe = absMx > SWIPE_THRESHOLD || absVx > VELOCITY_THRESHOLD;

      if (shouldSwipe && mx > 0) {
        animate(x, 600, { duration: 0.3, onComplete: onSwipeRight });
      } else if (shouldSwipe && mx < 0) {
        animate(x, -600, { duration: 0.3, onComplete: onSwipeLeft });
      } else {
        animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      }
    }
  }, {
    axis: 'x',
    filterTaps: true,
    pointer: { touch: true },
  });

  return (
    <motion.div
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...(bind() as object)}
    >
      <motion.div
        className={styles.overlay}
        style={{ backgroundColor: overlayColor }}
      />

      <div className={styles.meta}>
        <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
        <div>
          <div className={styles.communityName}>c/{community.name}</div>
          <div className={styles.instanceName}>{instance} • {creator.name}</div>
        </div>
      </div>

      <div className={styles.title}>{p.name}</div>

      <div className={styles.thumbnail}>
        {p.thumbnail_url
          ? <img src={p.thumbnail_url} alt="" loading="lazy" />
          : <span>No image</span>}
      </div>

      {p.body && <div className={styles.excerpt}>{p.body}</div>}

      <div className={styles.footer}>
        <span>▲ {counts.score}</span>
        <span>💬 {counts.comments}</span>
      </div>

      <div className={styles.scrollHint} onClick={onOpenComments}>↓ comments</div>
    </motion.div>
  );
}
