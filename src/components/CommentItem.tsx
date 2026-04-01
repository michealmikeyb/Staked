import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { likeComment, resolveCommentId, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId } from '../lib/urlUtils';
import CreatorAvatar from './CreatorAvatar';
import styles from './CommentItem.module.css';

interface Props {
  cv: CommentView;
  auth: AuthState;
  depth: number;
  onReply: (cv: CommentView) => void;
  onEdit?: (cv: CommentView) => void;
  overrideContent?: string;
  isHighlighted?: boolean;
}

export default function CommentItem({ cv, auth, depth, onReply, onEdit, overrideContent, isHighlighted }: Props) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [score, setScore] = useState(cv.counts.score);
  const [flash, setFlash] = useState<{ key: number; delta: 1 | -1 }>({ key: 0, delta: 1 });
  const lastTapRef = useRef<number>(0);
  const resolvedIdRef = useRef<number | null>(null);

  const isOwnComment =
    cv.creator.name === auth.username &&
    cv.creator.actor_id.includes(auth.instance);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      const newLiked = !liked;
      const delta = newLiked ? 1 : -1;
      setLiked(newLiked);
      setScore((s) => s + delta);
      setFlash((f) => ({ key: f.key + 1, delta: delta as 1 | -1 }));
      const doLike = async () => {
        if (resolvedIdRef.current === null) {
          const resolved = await resolveCommentId(auth.instance, auth.token, cv.comment.ap_id).catch(() => null);
          resolvedIdRef.current = resolved ?? cv.comment.id;
        }
        await likeComment(auth.instance, auth.token, resolvedIdRef.current, newLiked ? 1 : 0);
      };
      doLike().catch(() => {
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
      data-comment-id={cv.comment.id}
      className={styles.comment}
      style={{
        paddingLeft: `${16 + (depth - 1) * 14}px`,
        ...(isHighlighted ? { border: '2px solid #ff6b35', borderRadius: 8 } : {}),
      }}
      onClick={handleClick}
    >
      <div className={styles.authorRow}>
        <button
          className={styles.creatorName}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/user/${instanceFromActorId(cv.creator.actor_id)}/${cv.creator.name}`);
          }}
        >
          <CreatorAvatar name={cv.creator.name} avatar={cv.creator.avatar} size={20} />
          @{cv.creator.display_name ?? cv.creator.name}
        </button>
        <span className={liked ? styles.scoreLiked : styles.score}>▲ {score}</span>
        {flash.key > 0 && (
          <span key={flash.key} className={styles.scoreFlash}>
            {flash.delta > 0 ? '+1' : '-1'}
          </span>
        )}
      </div>
      <div className={styles.body}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {overrideContent ?? cv.comment.content}
        </ReactMarkdown>
      </div>
      <div className={styles.commentActions}>
        <button
          className={styles.replyButton}
          onClick={(e) => { e.stopPropagation(); onReply(cv); }}
        >
          ↩ Reply
        </button>
        {isOwnComment && onEdit && (
          <button
            className={styles.editButton}
            onClick={(e) => { e.stopPropagation(); onEdit(cv); }}
          >
            ✏ Edit
          </button>
        )}
      </div>
    </div>
  );
}
