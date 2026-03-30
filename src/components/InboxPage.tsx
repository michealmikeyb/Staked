import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchReplies, fetchMentions, fetchUnreadCount,
  type NotifItem,
} from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import MenuDrawer from './MenuDrawer';

function getPublished(item: NotifItem): string {
  return item.type === 'reply'
    ? item.data.comment_reply.published
    : item.data.person_mention.published;
}

function isUnread(item: NotifItem): boolean {
  return item.type === 'reply'
    ? !item.data.comment_reply.read
    : !item.data.person_mention.read;
}

function getNotifId(item: NotifItem): string {
  return item.type === 'reply'
    ? `reply-${item.data.comment_reply.id}`
    : `mention-${item.data.person_mention.id}`;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  auth: AuthState;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  unreadCount: number;
}

export default function InboxPage({ auth, setUnreadCount, unreadCount }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(true);

  useEffect(() => {
    fetchUnreadCount(auth.instance, auth.token)
      .then(setUnreadCount)
      .catch(() => {});
  }, [auth, setUnreadCount]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchReplies(auth.instance, auth.token, unreadOnly),
      fetchMentions(auth.instance, auth.token, unreadOnly),
    ]).then(([replies, mentions]) => {
      if (cancelled) return;
      const merged: NotifItem[] = [
        ...replies.map((r): NotifItem => ({ type: 'reply', data: r })),
        ...mentions.map((m): NotifItem => ({ type: 'mention', data: m })),
      ];
      merged.sort((a, b) =>
        new Date(getPublished(b)).getTime() - new Date(getPublished(a)).getTime(),
      );
      setItems(merged);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [auth, unreadOnly]);

  const filterToggle = (
    <div style={{ display: 'flex', background: '#2a2d35', borderRadius: 20, padding: 2 }}>
      {(['Unread', 'All'] as const).map((label) => {
        const active = label === 'Unread' ? unreadOnly : !unreadOnly;
        return (
          <button
            key={label}
            onClick={() => setUnreadOnly(label === 'Unread')}
            style={{
              background: active ? '#ff6b35' : 'transparent',
              color: active ? '#fff' : '#aaa',
              border: 'none', borderRadius: 18, padding: '4px 14px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer
        onNavigate={navigate}
        onLogoClick={() => navigate('/')}
        centerContent={filterToggle}
        unreadCount={unreadCount}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading…</div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>
            {unreadOnly ? 'No unread notifications' : 'No notifications'}
          </div>
        )}
        {items.map((item) => {
          const post = item.data.post;
          const content = item.data.comment.content;
          const creator = item.data.creator;
          const notifId = getNotifId(item);
          const unread = isUnread(item);

          return (
            <div
              key={notifId}
              onClick={() => navigate(`/inbox/${notifId}`, { state: { notification: item } })}
              style={{
                margin: '6px 12px',
                background: '#1e2128',
                borderRadius: 12,
                padding: '12px 14px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  background: '#ff6b35', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 20,
                }}>
                  {item.type === 'reply' ? 'REPLY' : 'MENTION'}
                </span>
                <span style={{ color: '#888', fontSize: 11 }}>
                  {formatTime(getPublished(item))}
                </span>
                {unread && (
                  <span
                    data-testid="unread-dot"
                    style={{
                      marginLeft: 'auto',
                      width: 8, height: 8, borderRadius: '50%', background: '#ff6b35',
                    }}
                  />
                )}
              </div>
              <div style={{
                color: '#888', fontSize: 11, fontStyle: 'italic',
                marginBottom: 4,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {post.name}
              </div>
              <div style={{ color: '#aaa', fontSize: 11, marginBottom: 6 }}>
                {creator.display_name ?? creator.name}
              </div>
              <div style={{
                color: '#e0e0e0', fontSize: 13, lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
