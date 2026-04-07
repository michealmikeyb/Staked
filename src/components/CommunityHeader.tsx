import { useState } from 'react';
import { type SortType } from '../lib/lemmy';
import { SORT_OPTIONS } from './HeaderBar';

interface Props {
  name: string;
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  onBack: () => void;
  onCompose?: () => void;
}

export default function CommunityHeader({ name, sortType, onSortChange, onBack, onCompose }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const currentLabel = SORT_OPTIONS.find((o) => o.sort === sortType)?.label ?? sortType;

  function handleSortSelect(sort: SortType) {
    setShowDropdown(false);
    onSortChange(sort);
  }

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
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#f5f5f5', fontSize: 20, padding: '0 8px 0 0', lineHeight: 1,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', color: '#f5f5f5', fontWeight: 600, fontSize: 15 }}>
          c/{name}
        </div>
        {onCompose && (
          <button
            aria-label="Compose"
            onClick={onCompose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#f5f5f5', fontSize: 18, padding: '0 4px 0 8px', lineHeight: 1,
            }}
          >
            ✏️
          </button>
        )}
        <button
          aria-label={`${currentLabel} ▾`}
          onClick={() => setShowDropdown((v) => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: '#f5f5f5', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {currentLabel}
          <span style={{ color: '#888', fontSize: 11 }}>▾</span>
        </button>
      </div>

      {showDropdown && (
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
                <span style={{ width: 16, fontSize: 13 }}>{sort === sortType ? '✓' : ''}</span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
