import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type SortType, type CommunityInfo } from '../lib/lemmy';
import { SORT_OPTIONS } from './HeaderBar';
import CommunityAvatar from './CommunityAvatar';

interface Props {
  name: string;
  instance: string;
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  onBack: () => void;
  communityInfo?: CommunityInfo | null;
  onSubscribeToggle?: () => void;
}

export default function CommunityHeader({
  name, instance, sortType, onSortChange, onBack, communityInfo, onSubscribeToggle,
}: Props) {
  const navigate = useNavigate();
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const currentLabel = SORT_OPTIONS.find((o) => o.sort === sortType)?.label ?? sortType;
  const isSubscribed = communityInfo?.subscribed === 'Subscribed';

  function handleSortSelect(sort: SortType) {
    setShowSortDropdown(false);
    onSortChange(sort);
  }

  function handleMenuAction(action: 'post' | 'subscribe' | 'about') {
    setShowMenu(false);
    if (action === 'post') {
      navigate('/create-post', { state: { community: `${name}@${instance}` } });
    } else if (action === 'subscribe') {
      onSubscribeToggle?.();
    } else {
      navigate(`/community/${instance}/${name}/about`, { state: { communityInfo } });
    }
  }

  const menuItemStyle: React.CSSProperties = {
    background: '#2a2d35', border: 'none', borderRadius: 8,
    cursor: 'pointer', padding: '10px 4px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    color: '#f5f5f5', fontSize: 11, fontWeight: 500,
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 16px', height: 48, flexShrink: 0,
        background: '#1a1d24', borderBottom: '1px solid #2a2d35',
      }}>
        <button
          aria-label="Back"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: '0 8px 0 0', lineHeight: 1 }}
        >
          ←
        </button>
        <CommunityAvatar name={name} icon={communityInfo?.icon} size={24} style={{ marginRight: 6 }} />
        <div style={{ flex: 1, textAlign: 'center', color: '#f5f5f5', fontWeight: 600, fontSize: 15 }}>
          c/{name}
        </div>
        <button
          aria-label={`${currentLabel} ▾`}
          onClick={() => { setShowMenu(false); setShowSortDropdown((v) => !v); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: '#f5f5f5', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {currentLabel}
          <span style={{ color: '#888', fontSize: 11 }}>▾</span>
        </button>
        <button
          aria-label="Community menu"
          onClick={() => { setShowSortDropdown(false); setShowMenu((v) => !v); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 12px', color: '#f5f5f5', fontSize: 18, lineHeight: 1 }}
        >
          ☰
        </button>
      </div>

      {showSortDropdown && (
        <>
          <div onClick={() => setShowSortDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30 }}>
            {SORT_OPTIONS.map(({ sort, label }) => (
              <button
                key={sort}
                onClick={() => handleSortSelect(sort)}
                aria-label={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid #1e2128', textAlign: 'left',
                  color: sort === sortType ? '#ff6b35' : '#f5f5f5',
                  fontWeight: sort === sortType ? 600 : 400, fontSize: 14,
                }}
              >
                <span style={{ width: 16, fontSize: 13 }}>{sort === sortType ? '✓' : ''}</span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <button
                aria-label="Post"
                onClick={() => handleMenuAction('post')}
                style={menuItemStyle}
              >
                <span style={{ fontSize: 20 }}>✏️</span>
                Post
              </button>
              <button
                aria-label={isSubscribed ? 'Subscribed' : 'Subscribe'}
                onClick={() => handleMenuAction('subscribe')}
                disabled={!communityInfo}
                style={{
                  ...menuItemStyle,
                  color: isSubscribed ? '#ff6b35' : '#f5f5f5',
                  border: isSubscribed ? '1px solid #ff6b35' : 'none',
                }}
              >
                <span style={{ fontSize: 20 }}>⭐</span>
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
              <button
                aria-label="About"
                onClick={() => handleMenuAction('about')}
                style={menuItemStyle}
              >
                <span style={{ fontSize: 20 }}>ℹ️</span>
                About
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
