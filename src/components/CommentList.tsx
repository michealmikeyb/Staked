import { useState, useMemo } from 'react';
import { createComment, resolveCommentId, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentItem from './CommentItem';
import ReplySheet from './ReplySheet';

interface Props {
  comments: CommentView[];
  auth: AuthState;
  postId: number;
  instance: string;
  token: string;
}

export default function CommentList({ comments, auth, postId, instance, token }: Props) {
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);

  const handleSubmit = async (content: string) => {
    // Parent comment may come from a foreign instance — resolve its local ID on the home instance.
    const parentApId = replyTarget!.comment.ap_id;
    const parentId = await resolveCommentId(instance, token, parentApId).catch(() => null)
      ?? replyTarget!.comment.id;
    const newComment = await createComment(instance, token, postId, content, parentId);
    // Remap path to use source-instance parent path so the tree-building childMap lookup works.
    // The API returns home-instance IDs in the path, which don't match source-instance IDs.
    const remapped = { ...newComment, comment: { ...newComment.comment, path: replyTarget!.comment.path + '.' + newComment.comment.id } };
    setLocalReplies((prev) => [...prev, remapped]);
    setReplyTarget(null);
  };

  // Preserve the API's score-based ordering while grouping each comment with its descendants.
  const items = useMemo(() => {
    const allItems = [...comments, ...localReplies];
    const childMap = new Map<string, CommentView[]>();
    const roots: CommentView[] = [];
    for (const cv of allItems) {
      const parts = cv.comment.path.split('.');
      if (parts.length === 2) {
        roots.push(cv);
      } else {
        const parentId = parts[parts.length - 2];
        if (!childMap.has(parentId)) childMap.set(parentId, []);
        childMap.get(parentId)!.push(cv);
      }
    }
    const result: CommentView[] = [];
    function collect(cv: CommentView) {
      result.push(cv);
      for (const child of childMap.get(String(cv.comment.id)) ?? []) collect(child);
    }
    for (const root of roots) collect(root);
    return result;
  }, [comments, localReplies]);

  return (
    <>
      {items.map((cv) => {
        const depth = cv.comment.path.split('.').length - 1;
        return (
          <CommentItem
            key={cv.comment.id}
            cv={cv}
            auth={auth}
            depth={depth}
            onReply={(cv) => setReplyTarget(cv)}
          />
        );
      })}
      <ReplySheet
        target={replyTarget}
        onSubmit={handleSubmit}
        onClose={() => setReplyTarget(null)}
      />
    </>
  );
}
