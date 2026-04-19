import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../lib/SettingsContext';
import { SORT_OPTIONS } from './HeaderBar';
import InstanceInput from './InstanceInput';
import type { CommentSortType } from '../lib/lemmy';

interface Props {
  isAuthenticated: boolean;
  onPermissionChange?: (permission: NotificationPermission) => void;
}

const COMMENT_SORT_OPTIONS: { sort: CommentSortType; label: string }[] = [
  { sort: 'Hot', label: 'Hot' },
  { sort: 'Top', label: 'Top' },
  { sort: 'New', label: 'New' },
  { sort: 'Old', label: 'Old' },
  { sort: 'Controversial', label: 'Controversial' },
];

export default function SettingsPage({ isAuthenticated, onPermissionChange }: Props) {
  const navigate = useNavigate();
  const { settings, updateSetting } = useSettings();

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });

  async function handleEnableNotifications() {
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    onPermissionChange?.(result);
  }

  const pillBase: React.CSSProperties = {
    border: 'none', borderRadius: 8, padding: '8px 12px',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
  };
  const active: React.CSSProperties = { ...pillBase, background: '#ff6b35', color: '#fff' };
  const inactive: React.CSSProperties = { ...pillBase, background: '#2a2d35', color: '#888' };
  const card: React.CSSProperties = {
    background: '#2a2d35', borderRadius: 12, padding: 16, marginBottom: 12,
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 10,
  };
  const descText: React.CSSProperties = { fontSize: 12, color: '#888', marginBottom: 10 };

  const swipeActionLabel = settings.swapGestures ? 'Right Swipe Action' : 'Left Swipe Action';
  const gestureDesc = settings.swapGestures
    ? 'Left swipe upvotes · Left tap upvotes'
    : 'Right swipe upvotes · Right tap upvotes';

  return (
    <div style={{ background: '#1a1d24', minHeight: '100dvh', color: '#f5f5f5' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid #2a2d35',
      }}>
        <button
          aria-label="Back"
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: 0 }}
        >
          ←
        </button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Settings</span>
      </div>

      <div style={{ padding: 16 }}>
        <div data-testid="swap-gestures-card" style={card}>
          <div style={sectionLabel}>Swap Gestures</div>
          <div style={descText}>{gestureDesc}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.swapGestures ? active : inactive}
              onClick={() => updateSetting('swapGestures', true)}
            >
              On
            </button>
            <button
              style={!settings.swapGestures ? active : inactive}
              onClick={() => updateSetting('swapGestures', false)}
            >
              Off
            </button>
          </div>
        </div>

        <div data-testid="non-upvote-swipe-card" style={card}>
          <div style={sectionLabel}>{swipeActionLabel}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.nonUpvoteSwipeAction === 'downvote' ? active : inactive}
              onClick={() => updateSetting('nonUpvoteSwipeAction', 'downvote')}
            >
              Downvote
            </button>
            <button
              style={settings.nonUpvoteSwipeAction === 'dismiss' ? active : inactive}
              onClick={() => updateSetting('nonUpvoteSwipeAction', 'dismiss')}
            >
              Dismiss
            </button>
          </div>
        </div>

        <div data-testid="blur-nsfw-card" style={card}>
          <div style={sectionLabel}>Blur NSFW</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.blurNsfw ? active : inactive}
              onClick={() => updateSetting('blurNsfw', true)}
            >
              On
            </button>
            <button
              style={!settings.blurNsfw ? active : inactive}
              onClick={() => updateSetting('blurNsfw', false)}
            >
              Off
            </button>
          </div>
        </div>

        <div data-testid="default-sort-card" style={card}>
          <div style={sectionLabel}>Default Sort</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SORT_OPTIONS.map(({ sort, label }) => (
              <button
                key={sort}
                style={settings.defaultSort === sort ? active : inactive}
                onClick={() => updateSetting('defaultSort', sort)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div data-testid="comment-sort-bar-card" style={card}>
          <div style={sectionLabel}>Comment Sort Bar</div>
          <div style={descText}>Show sort pills (Hot · Top · New · …) above comments</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.showCommentSortBar ? active : inactive}
              onClick={() => updateSetting('showCommentSortBar', true)}
            >
              On
            </button>
            <button
              style={!settings.showCommentSortBar ? active : inactive}
              onClick={() => updateSetting('showCommentSortBar', false)}
            >
              Off
            </button>
          </div>
        </div>

        <div data-testid="comment-sort-card" style={card}>
          <div style={sectionLabel}>Default Comment Sort</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COMMENT_SORT_OPTIONS.map(({ sort, label }) => (
              <button
                key={sort}
                style={settings.commentSort === sort ? active : inactive}
                onClick={() => updateSetting('commentSort', sort)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={sectionLabel}>Anonymous Feed</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Instance to use for anonymous browsing. Leave empty to use the top-ranked instance per sort.
          </div>
          <InstanceInput
            placeholder="Auto (top-ranked per sort)"
            value={settings.anonInstance}
            onChange={(v) => updateSetting('anonInstance', v)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#1a1d24', border: '1px solid #3a3d45',
              borderRadius: 8, padding: '10px 12px',
              color: '#f5f5f5', fontSize: 14, fontFamily: 'inherit',
            }}
          />
        </div>

        {notifPermission !== 'unsupported' && (
          <div style={card}>
            <div style={sectionLabel}>Notifications</div>
            {!isAuthenticated ? (
              <div style={{ fontSize: 12, color: '#888' }}>Log in to enable notifications</div>
            ) : notifPermission === 'granted' ? (
              <div style={{ fontSize: 13, color: '#4caf50', fontWeight: 600 }}>Notifications on</div>
            ) : notifPermission === 'denied' ? (
              <div style={{ fontSize: 12, color: '#888' }}>Blocked in browser settings</div>
            ) : (
              <button style={inactive} onClick={handleEnableNotifications}>
                Enable notifications
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
