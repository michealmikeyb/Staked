import { useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Notification } from '../lib/api/types';
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

  // Convert neutral Notification to legacy PostDetailCard props (PostDetailCard migrates in a later task)
  const post = {
    id: 0,
    name: notification.post.title ?? '',
    ap_id: notification.post.permalink,
    url: null,
    body: null,
    thumbnail_url: null,
  };
  const community = { name: '', actor_id: notification.post.permalink };
  const creator = { name: '', display_name: null };
  const counts = { score: 0, comments: 0 };

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
