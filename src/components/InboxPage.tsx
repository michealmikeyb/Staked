import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Notification } from '../lib/api/types';
import MenuDrawer from './MenuDrawer';

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  auth?: unknown; // kept for App.tsx compat — backend provides session
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  unreadCount: number;
}

export default function InboxPage({ setUnreadCount, unreadCount }: Props) {
  const navigate = useNavigate();
  const backend = useBackend();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(true);

  useEffect(() => {
    backend.notifications.unreadCount()
      .then(setUnreadCount)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    backend.notifications.list({ unreadOnly, cursor: null })
      .then((page) => {
        if (cancelled) return;
        const sorted = [...page.items].sort(
          (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
        );
        setItems(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

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
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/inbox/${item.id}`, { state: { notification: item } })}
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
                {item.kind === 'reply' ? 'REPLY' : 'MENTION'}
              </span>
              <span style={{ color: '#888', fontSize: 11 }}>
                {formatTime(item.receivedAt)}
              </span>
              {!item.read && (
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
              {item.post.title}
            </div>
            <div style={{ color: '#aaa', fontSize: 11, marginBottom: 6 }}>
              {item.comment.author.displayName ?? item.comment.author.handle}
            </div>
            <div style={{
              color: '#e0e0e0', fontSize: 13, lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {item.comment.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
