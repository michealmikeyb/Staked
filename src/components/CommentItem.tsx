import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { likeComment, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import styles from './CommentItem.module.css';

interface Props {
  cv: CommentView;
  auth: AuthState;
  depth: number;
  onReply: (cv: CommentView) => void;
}

export default function CommentItem({ cv, auth, depth, onReply }: Props) {
  const [liked, setLiked] = useState(false);
  const [score, setScore] = useState(cv.counts.score);
  const [flash, setFlash] = useState<{ key: number; delta: 1 | -1 }>({ key: 0, delta: 1 });
  const lastTapRef = useRef<number>(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      const newLiked = !liked;
      const delta = newLiked ? 1 : -1;
      setLiked(newLiked);
      setScore((s) => s + delta);
      setFlash((f) => ({ key: f.key + 1, delta: delta as 1 | -1 }));
      likeComment(auth.instance, auth.token, cv.comment.id, newLiked ? 1 : 0).catch(() => {
        setLiked(!newLiked);
        setScore((s) => s - delta);
      });
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div
      data-testid="comment-item"
      className={styles.comment}
      style={{ paddingLeft: `${16 + (depth - 1) * 14}px` }}
      onClick={handleClick}
    >
      <div className={styles.authorRow}>
        <span>@{cv.creator.name}</span>
        <span className={liked ? styles.scoreLiked : styles.score}>▲ {score}</span>
        {flash.key > 0 && (
          <span key={flash.key} className={styles.scoreFlash}>
            {flash.delta > 0 ? '+1' : '-1'}
          </span>
        )}
      </div>
      <div className={styles.body}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cv.comment.content}</ReactMarkdown>
      </div>
      <button
        className={styles.replyButton}
        onClick={(e) => { e.stopPropagation(); onReply(cv); }}
      >
        ↩ Reply
      </button>
    </div>
  );
}
