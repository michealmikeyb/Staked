import { useState } from 'react';
import { type SortType } from '../lib/lemmy';

const SORT_OPTIONS: { sort: SortType; label: string }[] = [
  { sort: 'Active', label: 'Active' },
  { sort: 'Hot', label: 'Hot' },
  { sort: 'New', label: 'New' },
  { sort: 'TopSixHour', label: 'Top 6h' },
  { sort: 'TopTwelveHour', label: 'Top 12h' },
  { sort: 'TopDay', label: 'Top Day' },
];

interface Props {
  sortType?: SortType;
  onSortChange?: (sort: SortType) => void;
  onMenuOpen: () => void;
  centerContent?: React.ReactNode;
  onLogoClick?: () => void;
}

export default function HeaderBar({ sortType, onSortChange, onMenuOpen, centerContent, onLogoClick }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const currentLabel = SORT_OPTIONS.find((o) => o.sort === sortType)?.label ?? sortType ?? '';

  function handleSortSelect(sort: SortType) {
    setShowDropdown(false);
    onSortChange?.(sort);
  }

  const centerEl = centerContent ?? (sortType && onSortChange ? (
    <button
      onClick={() => setShowDropdown((v) => !v)}
      aria-label={showDropdown ? currentLabel : `${currentLabel} ▾`}
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
        <div
          onClick={onLogoClick}
          role={onLogoClick ? 'button' : undefined}
          style={{
            width: 32, height: 32, background: '#ff6b35', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: '#fff', flexShrink: 0,
            cursor: onLogoClick ? 'pointer' : 'default',
          }}
        >
          S
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

      {showDropdown && sortType && onSortChange && (
        <>
          <div
            onClick={() => setShowDropdown(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30,
          }}>
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
                <span style={{ width: 16, fontSize: 13 }}>
                  {sort === sortType ? '✓' : ''}
                </span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
