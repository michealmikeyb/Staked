import { useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  markReplyAsRead, markMentionAsRead,
  type NotifItem,
} from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth: AuthState;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  unreadCount?: number;
}

export default function PostDetailPage({ auth, setUnreadCount, unreadCount = 0 }: Props) {
  useParams<{ notifId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const notification = state?.notification as NotifItem | undefined;

  const markedReadRef = useRef(false);

  // Mark as read on mount (once)
  useEffect(() => {
    if (!notification) return;
    if (markedReadRef.current) return;
    markedReadRef.current = true;

    const doMark = async () => {
      if (notification.type === 'reply') {
        await markReplyAsRead(auth.instance, auth.token, notification.data.comment_reply.id);
      } else {
        await markMentionAsRead(auth.instance, auth.token, notification.data.person_mention.id);
      }
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };
    doMark().catch(() => {});
  }, [auth, notification, setUnreadCount]);

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

  const post = notification.data.post;
  const community = notification.data.community;
  const creator = notification.data.creator;
  const counts = notification.data.counts;

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
          auth={auth}
          notifCommentApId={notification.data.comment.ap_id}
        />
      </div>
    </div>
  );
}
