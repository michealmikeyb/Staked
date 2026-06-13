import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Notification, Post as NeutralPost } from '../lib/api/types';
import { instanceFromActorId } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth?: unknown; // kept for App.tsx compat — backend provides session
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  unreadCount?: number;
}

export default function PostDetailPage({ setUnreadCount, unreadCount = 0 }: Props) {
  useParams<{ notifId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const backend = useBackend();
  const notification = state?.notification as Notification | undefined;

  const [fullPost, setFullPost] = useState<NeutralPost | null>(null);

  const markedReadRef = useRef(false);

  useEffect(() => {
    if (!notification) return;
    if (markedReadRef.current) return;
    markedReadRef.current = true;
    backend.notifications.markRead(notification.id)
      .then(() => setUnreadCount((prev) => Math.max(0, prev - 1)))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notification) return;
    backend.posts.get(notification.post.id)
      .then((p) => setFullPost(p))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!notification) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
        <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} unreadCount={unreadCount} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Navigate to Inbox to view this notification.
        </div>
      </div>
    );
  }

  // Build legacy PostDetailCard props (PostDetailCard migrates in a later task).
  // Use full post data when available; fall back to notification fields so comments
  // still load immediately via the encoded post ID while the fetch is in flight.
  let post, community, creator, counts;
  if (fullPost) {
    const srcParts = fullPost.source.handle.split('@');
    const srcName = srcParts[0] ?? '';
    const srcInst = srcParts[1] ?? '';
    const communityActorId = srcInst ? `https://${srcInst}/c/${srcName}` : fullPost.source.id;
    const authorParts = fullPost.author.handle.split('@');
    const authorName = authorParts[0] ?? fullPost.author.handle;
    post = {
      id: fullPost.id ? (() => { const i = fullPost.id.indexOf('|'); return i >= 0 ? parseInt(fullPost.id.slice(0, i), 10) : 0; })() : 0,
      name: fullPost.title ?? '',
      ap_id: fullPost.permalink,
      url: fullPost.externalUrl ?? null,
      body: fullPost.body ?? null,
      thumbnail_url: fullPost.mediaUrl ?? null,
      nsfw: fullPost.nsfw,
      published: fullPost.publishedAt,
    };
    community = { name: fullPost.source.name, actor_id: communityActorId };
    creator = {
      name: authorName,
      display_name: fullPost.author.displayName ?? null,
      actor_id: fullPost.author.profileUrl,
    };
    counts = { score: fullPost.counts.score, comments: fullPost.counts.comments };
  } else {
    // Fallback while fetch is in flight: enough to load comments via Tier 1/3.
    const encodedPostId = notification.post.id;
    const pipeIdx = encodedPostId.indexOf('|');
    const postLocalId = pipeIdx >= 0 ? parseInt(encodedPostId.slice(0, pipeIdx), 10) : 0;
    const srcInstance = instanceFromActorId(notification.post.permalink);
    post = {
      id: postLocalId,
      name: notification.post.title ?? '',
      ap_id: notification.post.permalink,
      url: null, body: null, thumbnail_url: null,
    };
    community = { name: '', actor_id: `https://${srcInstance}` };
    creator = { name: '', display_name: null };
    counts = { score: 0, comments: 0 };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer
        onNavigate={navigate}
        onLogoClick={() => navigate('/')}
        unreadCount={unreadCount}
        leftContent={
          isIOS ? (
            <button
              onClick={() => navigate('/inbox')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Inbox
            </button>
          ) : undefined
        }
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <PostDetailCard
          post={post}
          community={community}
          creator={creator}
          counts={counts}
          notifCommentApId={notification.comment.permalink}
        />
      </div>
    </div>
  );
}
