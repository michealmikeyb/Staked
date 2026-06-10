import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useBackend } from '../lib/api/context';
import type { Post, Comment } from '../lib/api/types';
import styles from './CommentsPanel.module.css';

interface Props {
  post: Post;
  auth?: unknown; // kept for caller compat — backend provides session
  onClose: () => void;
  onSave: () => void;
}

export default function CommentsPanel({ post, onClose, onSave }: Props) {
  const backend = useBackend();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  useEffect(() => {
    let cancelled = false;
    backend.comments.list(post.id, { sortId: 'Top', sourceHandle: post.source.handle })
      .then((c) => { if (!cancelled) setComments(c); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

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
        <div className={styles.headerTitle}>{post.title}</div>
        <div className={styles.headerMeta}>▲ {post.counts.score} · 💬 {post.counts.comments}</div>
      </div>

      <div
        ref={scrollRef}
        className={styles.scrollArea}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className={styles.saveHint}>↓ pull down to save post</div>

        {loading && <div className={styles.loading}>Loading comments…</div>}

        {comments.map((comment) => (
          <div
            key={comment.id}
            className={styles.comment}
            data-depth={comment.depth}
            style={{ paddingLeft: `${16 + (comment.depth - 1) * 14}px` }}
          >
            <div className={styles.commentAuthor}>
              @{comment.author.displayName ?? comment.author.handle} · ▲ {comment.counts.score}
            </div>
            <div className={styles.commentBody}>{comment.body}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
