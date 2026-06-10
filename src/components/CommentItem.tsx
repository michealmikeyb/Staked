import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from './MarkdownRenderer';
import { useBackend } from '../lib/api/context';
import type { Comment } from '../lib/api/types';
import { useSettings } from '../lib/SettingsContext';
import CreatorAvatar from './CreatorAvatar';
import styles from './CommentItem.module.css';

interface Props {
  comment: Comment;
  onReply: (comment: Comment) => void;
  onEdit?: (comment: Comment) => void;
  onReport?: (comment: Comment) => void;
  overrideContent?: string;
  isHighlighted?: boolean;
  opActorId?: string;
}

export default function CommentItem({ comment, onReply, onEdit, onReport, overrideContent, isHighlighted, opActorId }: Props) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const backend = useBackend();
  const [vote, setVote] = useState<1 | 0 | -1>(0);
  const [flash, setFlash] = useState<{ key: number; delta: 1 | -1 }>({ key: 0, delta: 1 });
  const displayScore = comment.counts.score + vote;
  const lastTapRef = useRef<number>(0);

  const isOwnComment = comment.author.handle === backend.session?.viewer?.handle;
  const isOP = opActorId != null && comment.author.profileUrl === opActorId;

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
      backend.comments.vote(comment.id, newVote).catch(() => {
        setVote(prevVote);
      });
    } else {
      lastTapRef.current = now;
    }
  };

  const [authorName] = comment.author.handle.split('@');

  return (
    <div
      data-testid="comment-item"
      data-comment-id={comment.id}
      className={styles.comment}
      style={{
        paddingLeft: `${16 + comment.depth * 14}px`,
        ...(isHighlighted ? { border: '2px solid #ff6b35', borderRadius: 8 } : {}),
      }}
      onClick={handleClick}
    >
      <div className={styles.authorRow}>
        <button
          className={styles.creatorName}
          onClick={(e) => {
            e.stopPropagation();
            const [name, instance] = comment.author.handle.split('@');
            navigate(`/user/${instance}/${name}`);
          }}
        >
          <CreatorAvatar name={authorName} avatar={comment.author.avatar} size={20} />
          @{comment.author.displayName ?? authorName}
        </button>
        {isOP && <span className={styles.opBadge}>OP</span>}
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
        content={overrideContent ?? comment.body}
        className={styles.body}
      />
      <div className={styles.commentActions}>
        <button
          className={styles.replyButton}
          onClick={(e) => { e.stopPropagation(); onReply(comment); }}
        >
          ↩ Reply
        </button>
        {isOwnComment && onEdit && (
          <button
            className={styles.editButton}
            onClick={(e) => { e.stopPropagation(); onEdit(comment); }}
          >
            ✏ Edit
          </button>
        )}
        {!isOwnComment && onReport && (
          <button
            className={styles.reportButton}
            onClick={(e) => { e.stopPropagation(); onReport(comment); }}
          >
            ⚑ Report
          </button>
        )}
      </div>
    </div>
  );
}
