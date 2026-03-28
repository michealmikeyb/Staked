import { useMemo, useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { fetchComments, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import styles from './PostCard.module.css';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
}

function communityInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function instanceFromActorId(actorId: string): string {
  try { return new URL(actorId).hostname; } catch { return ''; }
}

// Posts federate across instances — ap_id gives the canonical source instance + local post ID.
function sourceFromApId(apId: string): { instance: string; postId: number } | null {
  try {
    const url = new URL(apId);
    const postId = parseInt(url.pathname.split('/').pop() ?? '', 10);
    return isNaN(postId) ? null : { instance: url.hostname, postId };
  } catch { return null; }
}

export default function PostCard({ post, auth, zIndex, scale, onSwipeRight, onSwipeLeft }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = useMemo(() => instanceFromActorId(community.actor_id), [community.actor_id]);
  const [comments, setComments] = useState<CommentView[]>([]);

  useEffect(() => {
    const source = sourceFromApId(p.ap_id);
    if (!source) return;
    let cancelled = false;
    // Use auth only when fetching from the user's own instance; public instances need none.
    const token = source.instance === auth.instance ? auth.token : '';
    fetchComments(source.instance, token, source.postId)
      .then((c) => { if (!cancelled) setComments(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [auth, p.ap_id]);

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

  return (
    <motion.div
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...(bind() as object)}
    >
      <motion.div className={styles.overlay} style={{ backgroundColor: overlayColor }} />

      <div className={styles.scrollContent}>
        <div className={styles.meta}>
          <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
          <div>
            <div className={styles.communityName}>c/{community.name}</div>
            <div className={styles.instanceName}>{instance} • {creator.name}</div>
          </div>
        </div>

        <div className={styles.title}>{p.name}</div>

        {p.thumbnail_url && (
          <img className={styles.image} src={p.thumbnail_url} alt="" loading="lazy" />
        )}

        {p.body && <div className={styles.excerpt}>{p.body}</div>}

        <div className={styles.footer}>
          <span>▲ {counts.score}</span>
          <span>💬 {counts.comments}</span>
        </div>

        <div className={styles.commentsSection}>
          {comments.map((cv) => {
            const depth = cv.comment.path.split('.').length - 1;
            return (
              <div
                key={cv.comment.id}
                className={styles.comment}
                style={{ paddingLeft: `${16 + (depth - 1) * 14}px` }}
              >
                <div className={styles.commentAuthor}>@{cv.creator.name} · ▲ {cv.counts.score}</div>
                <div className={styles.commentBody}>{cv.comment.content}</div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
