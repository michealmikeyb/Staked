import { useState } from 'react';
import { createComment, type CommentView } from '../lib/lemmy';
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
    const newComment = await createComment(
      instance,
      token,
      postId,
      content,
      replyTarget!.comment.id,
    );
    setLocalReplies((prev) => [...prev, newComment]);
    setReplyTarget(null);
  };

  const items = [...comments, ...localReplies];

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
