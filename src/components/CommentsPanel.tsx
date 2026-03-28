import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchComments, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import styles from './CommentsPanel.module.css';

interface Props {
  post: PostView;
  auth: AuthState;
  onClose: () => void;
  onSave: () => void;
}

function depthFromPath(path: string): number {
  // Path format: "0.parentId.childId" — depth = number of segments - 1
  return path.split('.').length - 1;
}

export default function CommentsPanel({ post, auth, onClose, onSave }: Props) {
  const { post: p, counts } = post;
  const [comments, setComments] = useState<CommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  useEffect(() => {
    fetchComments(auth.instance, auth.token, p.id)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [auth, p.id]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const el = scrollRef.current;
    if (!el) return;
    const atTop = el.scrollTop <= 0;
    const dragDown = e.touches[0].clientY - touchStartY.current > 60;
    if (atTop && dragDown) {
      onSave();
    }
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
    >
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close comments">←</button>
        <div className={styles.headerTitle}>{p.name}</div>
        <div className={styles.headerMeta}>▲ {counts.score} · 💬 {counts.comments}</div>
      </div>

      <div
        ref={scrollRef}
        className={styles.scrollArea}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className={styles.saveHint}>↓ pull down to save post</div>

        {loading && <div className={styles.loading}>Loading comments…</div>}

        {comments.map((cv) => {
          const depth = depthFromPath(cv.comment.path);
          return (
            <div
              key={cv.comment.id}
              className={styles.comment}
              data-depth={depth}
              style={{ paddingLeft: `${16 + (depth - 1) * 14}px` }}
            >
              <div className={styles.commentAuthor}>@{cv.creator.name} · ▲ {cv.counts.score}</div>
              <div className={styles.commentBody}>{cv.comment.content}</div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
