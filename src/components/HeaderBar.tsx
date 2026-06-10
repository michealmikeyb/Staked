import { useState } from 'react';
import { useBackend } from '../lib/api/context';
import Logo from './Logo';

// Keep exported for backward compat — FeedStack, CommunityHeader, SettingsPage, PostCardShell
// migrate these in Tasks 24–31.
export const SORT_OPTIONS: { sort: string; label: string }[] = [
  { sort: 'Active', label: 'Active' },
  { sort: 'Hot', label: 'Hot' },
  { sort: 'New', label: 'New' },
  { sort: 'TopSixHour', label: 'Top 6h' },
  { sort: 'TopTwelveHour', label: 'Top 12h' },
  { sort: 'TopDay', label: 'Top Day' },
];

export const COMMENT_SORT_OPTIONS: { sort: string; label: string }[] = [
  { sort: 'Hot', label: 'Hot' },
  { sort: 'Top', label: 'Top' },
  { sort: 'New', label: 'New' },
  { sort: 'Old', label: 'Old' },
  { sort: 'Controversial', label: 'Controversial' },
];

export const STAKS: { stak: string; label: string; icon: string }[] = [
  { stak: 'All', label: 'All', icon: '🌐' },
  { stak: 'Local', label: 'Local', icon: '🏠' },
  { stak: 'Subscribed', label: 'Subscribed', icon: '⭐' },
  { stak: 'Anonymous', label: 'Anonymous', icon: '🕵️' },
];

interface Props {
  sortType?: string;
  onSortChange?: (sort: string) => void;
  onMenuOpen: () => void;
  centerContent?: React.ReactNode;
  onLogoClick?: () => void;
  leftContent?: React.ReactNode;
  activeStak?: string;
  onStakChange?: (stak: string) => void;
}

export default function HeaderBar({
  sortType,
  onSortChange,
  onMenuOpen,
  centerContent,
  onLogoClick,
  leftContent,
  activeStak,
  onStakChange,
}: Props) {
  const backend = useBackend();
  const feedOptions = backend.capabilities.feedOptions;
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showStakDropdown, setShowStakDropdown] = useState(false);
  const currentLabel = feedOptions.find((o) => o.id === sortType)?.label ?? sortType ?? '';

  function handleSortSelect(sort: string) {
    setShowSortDropdown(false);
    onSortChange?.(sort);
  }

  function handleStakSelect(stak: string) {
    setShowStakDropdown(false);
    onStakChange?.(stak);
  }

  const centerEl = centerContent ?? (sortType && onSortChange ? (
    <button
      onClick={() => setShowSortDropdown((v) => !v)}
      aria-label={showSortDropdown ? currentLabel : `${currentLabel} ▾`}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: '#f5f5f5', fontSize: 13, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      {currentLabel}
      <span style={{ color: '#888', fontSize: 11 }}>▾</span>
    </button>
  ) : null);

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', height: 48, flexShrink: 0,
        background: '#1a1d24', borderBottom: '1px solid #2a2d35',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onStakChange ? (
            <button
              onClick={() => setShowStakDropdown((v) => !v)}
              aria-label={`Switch stak, currently ${activeStak ?? STAKS[0].stak}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Logo variant="mark" size={32} />
              <span style={{ color: '#f5f5f5', fontWeight: 700, fontSize: 14 }}>
                {activeStak ?? STAKS[0].stak}
              </span>
              <span style={{ color: '#888', fontSize: 11 }}>▾</span>
            </button>
          ) : (
            <Logo variant="mark" size={32} onClick={onLogoClick} />
          )}
          {leftContent}
        </div>
        {centerEl}
        <div style={{ flex: 1 }} />
        <button
          onClick={onMenuOpen}
          aria-label="Menu"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 20, height: 2, background: '#f5f5f5', borderRadius: 1 }} />
          ))}
        </button>
      </div>

      {showSortDropdown && sortType && onSortChange && (
        <>
          <div
            onClick={() => setShowSortDropdown(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div
            data-testid="sort-dropdown"
            style={{
              position: 'fixed', top: 48, left: 0, right: 0,
              background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30,
            }}>
            {feedOptions.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleSortSelect(id)}
                aria-label={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid #1e2128', textAlign: 'left',
                  color: id === sortType ? '#ff6b35' : '#f5f5f5',
                  fontWeight: id === sortType ? 600 : 400, fontSize: 14,
                }}
              >
                <span style={{ width: 16, fontSize: 13 }}>
                  {id === sortType ? '✓' : ''}
                </span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {showStakDropdown && onStakChange && (
        <>
          <div
            onClick={() => setShowStakDropdown(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30,
          }}>
            {STAKS.map(({ stak, label, icon }) => (
              <button
                key={stak}
                onClick={() => handleStakSelect(stak)}
                aria-label={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid #1e2128', textAlign: 'left',
                  color: stak === activeStak ? '#ff6b35' : '#f5f5f5',
                  fontWeight: stak === activeStak ? 600 : 400, fontSize: 14,
                }}
              >
                <span style={{ width: 16, fontSize: 13 }}>
                  {stak === activeStak ? '✓' : ''}
                </span>
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
