import { useMemo } from 'react';
import { type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentItem from './CommentItem';

interface Props {
  comments: CommentView[];
  localReplies: CommentView[];
  auth: AuthState;
  postId: number;
  instance: string;
  token: string;
  replyTarget: CommentView | null;
  onSetReplyTarget: (cv: CommentView | null) => void;
}

export default function CommentList({ comments, localReplies, auth, postId: _postId, instance: _instance, token: _token, replyTarget: _replyTarget, onSetReplyTarget }: Props) {
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
            onReply={onSetReplyTarget}
          />
        );
      })}
    </>
  );
}
