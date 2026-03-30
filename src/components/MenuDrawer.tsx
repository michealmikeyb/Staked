import { useState } from 'react';
import { type SortType } from '../lib/lemmy';
import HeaderBar from './HeaderBar';

interface Props {
  onNavigate: (route: string) => void;
  centerContent?: React.ReactNode;
  onLogoClick?: () => void;
  leftContent?: React.ReactNode;
  sortType?: SortType;
  onSortChange?: (sort: SortType) => void;
  unreadCount?: number;
}

export default function MenuDrawer({
  onNavigate,
  centerContent,
  onLogoClick,
  leftContent,
  sortType,
  onSortChange,
  unreadCount = 0,
}: Props) {
  const [showDrawer, setShowDrawer] = useState(false);

  function handleNavigate(route: string) {
    setShowDrawer(false);
    onNavigate(route);
  }

  const drawerButtonStyle: React.CSSProperties = {
    background: '#2a2d35', border: 'none', borderRadius: 12,
    cursor: 'pointer', padding: '14px 8px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    color: '#f5f5f5', fontSize: 12, fontWeight: 500,
    position: 'relative',
  };

  const iconStyle: React.CSSProperties = { fontSize: 22 };

  return (
    <>
      <HeaderBar
        sortType={sortType}
        onSortChange={onSortChange}
        onMenuOpen={() => setShowDrawer((v) => !v)}
        onLogoClick={onLogoClick}
        centerContent={centerContent}
        leftContent={leftContent}
      />
      {showDrawer && (
        <>
          <div
            data-testid="drawer-overlay"
            onClick={() => setShowDrawer(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '1px solid #2a2d35',
            zIndex: 40, padding: 16,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <button
                onClick={() => handleNavigate('/saved')}
                aria-label="Saved"
                style={drawerButtonStyle}
              >
                <span style={iconStyle}>🔖</span>
                Saved
              </button>
              <button
                onClick={() => handleNavigate('/profile')}
                aria-label="Profile"
                style={drawerButtonStyle}
              >
                <span style={iconStyle}>👤</span>
                Profile
              </button>
              <button
                onClick={() => handleNavigate('/inbox')}
                aria-label="Inbox"
                style={drawerButtonStyle}
              >
                {unreadCount > 0 && (
                  <span
                    data-testid="inbox-badge"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: '#ff6b35', color: '#fff',
                      borderRadius: '50%', minWidth: 18, height: 18,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
                <span style={iconStyle}>📬</span>
                Inbox
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
