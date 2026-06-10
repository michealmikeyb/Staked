import { useMemo } from 'react';
import type { Comment } from '../lib/api/types';
import CommentItem from './CommentItem';

interface Props {
  comments: Comment[];
  localReplies: Comment[];
  onSetReplyTarget: (comment: Comment) => void;
  onEdit?: (comment: Comment) => void;
  onReport?: (comment: Comment) => void;
  localEdits?: Record<string, string>;
  highlightCommentId?: string;
  opActorId?: string;
}

export default function CommentList({ comments, localReplies, onSetReplyTarget, onEdit, onReport, localEdits, highlightCommentId, opActorId }: Props) {
  const items = useMemo(() => {
    const allItems = [...comments, ...localReplies];
    const childMap = new Map<string | null, Comment[]>();
    for (const c of allItems) {
      const key = c.parentId ?? null;
      if (!childMap.has(key)) childMap.set(key, []);
      childMap.get(key)!.push(c);
    }
    const result: Comment[] = [];
    function collect(parentId: string | null) {
      for (const c of childMap.get(parentId) ?? []) {
        result.push(c);
        collect(c.id);
      }
    }
    collect(null);
    return result;
  }, [comments, localReplies]);

  return (
    <>
      {items.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onReply={onSetReplyTarget}
          onEdit={onEdit}
          onReport={onReport}
          overrideContent={localEdits?.[comment.id]}
          isHighlighted={comment.id === highlightCommentId}
          opActorId={opActorId}
        />
      ))}
    </>
  );
}
