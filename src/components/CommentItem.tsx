import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from './MarkdownRenderer';
import { likeComment, resolveCommentId, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { useSettings } from '../lib/SettingsContext';
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
  const { settings } = useSettings();
  const [vote, setVote] = useState<1 | 0 | -1>(0);
  const [flash, setFlash] = useState<{ key: number; delta: 1 | -1 }>({ key: 0, delta: 1 });
  const displayScore = cv.counts.score + vote;
  const lastTapRef = useRef<number>(0);
  const resolvedIdRef = useRef<number | null>(null);

  const isOwnComment =
    cv.creator.name === auth.username &&
    instanceFromActorId(cv.creator.actor_id ?? '') === auth.instance;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const mid = rect.left + rect.width / 2;
      const tappedRight = e.clientX >= mid;
      const isUpvoteSide = settings.swapGestures ? !tappedRight : tappedRight;
      const targetVote: 1 | -1 = isUpvoteSide ? 1 : -1;
      const newVote: 1 | 0 | -1 = vote === targetVote ? 0 : targetVote;
      const delta = newVote - vote;
      const prevVote = vote;
      setVote(newVote);
      setFlash((f) => ({ key: f.key + 1, delta: delta > 0 ? 1 : -1 }));
      const doLike = async () => {
        if (resolvedIdRef.current === null) {
          const resolved = await resolveCommentId(auth.instance, auth.token, cv.comment.ap_id).catch(() => null);
          if (resolved !== null) resolvedIdRef.current = resolved;
        }
        const commentId = resolvedIdRef.current ?? cv.comment.id;
        await likeComment(auth.instance, auth.token, commentId, newVote);
      };
      doLike().catch(() => {
        setVote(prevVote);
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
        <span className={vote === 1 ? styles.scoreLiked : vote === -1 ? styles.scoreDownvoted : styles.score}>
          {vote === -1 ? '▼' : '▲'} {displayScore}
        </span>
        {flash.key > 0 && (
          <span key={flash.key} className={styles.scoreFlash}>
            {flash.delta > 0 ? '+1' : '-1'}
          </span>
        )}
      </div>
      <MarkdownRenderer
        content={overrideContent ?? cv.comment.content}
        className={styles.body}
      />
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
