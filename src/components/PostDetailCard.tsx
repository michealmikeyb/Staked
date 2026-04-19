import { useMemo, useState } from 'react';
import { instanceFromActorId } from '../lib/urlUtils';
import { useCommentLoader } from '../hooks/useCommentLoader';
import { type AuthState } from '../lib/store';
import { type CommentSortType } from '../lib/lemmy';
import { useSettings } from '../lib/SettingsContext';
import PostCardShell from './PostCardShell';

interface Post {
  id: number;
  name: string;
  ap_id: string;
  url?: string | null;
  body?: string | null;
  thumbnail_url?: string | null;
  nsfw?: boolean;
  published: string;
}

interface Community {
  name: string;
  actor_id: string;
}

interface Creator {
  name: string;
  display_name?: string | null;
}

interface Counts {
  score: number;
  comments: number;
}

interface Props {
  post: Post;
  community: Community;
  creator: Creator;
  counts: Counts;
  auth?: AuthState;
  notifCommentApId?: string;
}

export default function PostDetailCard({
  post, community, creator, counts, auth, notifCommentApId,
}: Props) {
  const anonAuth: AuthState = useMemo(() => ({
    instance: instanceFromActorId(community.actor_id),
    token: '',
    username: '',
  }), [community.actor_id]);

  const { settings } = useSettings();
  const [activeSort, setActiveSort] = useState<CommentSortType>(() => settings.commentSort);

  const { comments, commentsLoaded } = useCommentLoader(
    { ap_id: post.ap_id, id: post.id },
    { actor_id: community.actor_id },
    auth ?? anonAuth,
    activeSort,
  );

  const highlightCommentId = useMemo(() => {
    if (!commentsLoaded || !notifCommentApId) return undefined;
    return comments.find((c) => c.comment.ap_id === notifCommentApId)?.comment.id;
  }, [comments, commentsLoaded, notifCommentApId]);

  return (
    <div style={{
      position: 'relative', width: '92vw', maxWidth: 440,
      height: 'calc(100dvh - 72px)',
      borderRadius: 20, background: 'var(--card-bg, #1e2128)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', margin: '12px 0',
      display: 'flex', flexDirection: 'column',
    }}>
      <PostCardShell
        post={post}
        community={community}
        creator={creator}
        counts={counts}
        auth={auth}
        comments={comments}
        commentsLoaded={commentsLoaded}
        highlightCommentId={highlightCommentId}
        activeSort={activeSort}
        onSortChange={setActiveSort}
      />
    </div>
  );
}
