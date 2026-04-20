import { useState } from 'react';

interface Props {
  username: string;
  instance: string;
  onBack: () => void;
  onBlock?: () => Promise<void>;
  blockDisabled?: boolean;
}

const menuItemStyle: React.CSSProperties = {
  background: '#2a2d35', border: 'none', borderRadius: 8,
  cursor: 'pointer', padding: '10px 4px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  color: '#f5f5f5', fontSize: 11, fontWeight: 500,
};

export default function ProfileHeader({ username, instance, onBack, onBlock, blockDisabled }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState('');

  function closeConfirm() { setShowConfirm(false); setBlockError(''); }

  async function handleBlock() {
    setBlocking(true);
    setBlockError('');
    try {
      await onBlock?.();
      setShowConfirm(false);
    } catch {
      setBlockError('Failed to block. Try again.');
    } finally {
      setBlocking(false);
    }
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: '0 8px 0 0', lineHeight: 1 }}
        >
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', color: '#f5f5f5', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          u/{username}@{instance}
        </div>
        {onBlock && (
          <button
            aria-label="Profile menu"
            onClick={() => { setShowMenu((v) => !v); closeConfirm(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 18, padding: '0 0 0 12px', lineHeight: 1 }}
          >
            ☰
          </button>
        )}
      </div>

      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30, padding: 12 }}>
            <button
              aria-label="Block"
              onClick={() => { setShowMenu(false); setShowConfirm(true); }}
              style={{ ...menuItemStyle, width: '100%' }}
            >
              <span style={{ fontSize: 20 }}>🚫</span>
              Block
            </button>
          </div>
        </>
      )}

      {showConfirm && (
        <>
          <div onClick={closeConfirm} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'fixed', top: 48, left: 0, right: 0, background: '#1a1d24', borderBottom: '2px solid #ff6b35', zIndex: 30, padding: 16 }}>
            <div style={{ color: '#f5f5f5', fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
              Block u/{username}?
            </div>
            {blockError && (
              <div style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{blockError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                aria-label="Cancel"
                onClick={closeConfirm}
                style={{ flex: 1, padding: '10px 0', background: '#2a2d35', border: 'none', borderRadius: 8, color: '#f5f5f5', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                aria-label="Block"
                onClick={handleBlock}
                disabled={blocking || blockDisabled}
                style={{ flex: 1, padding: '10px 0', background: '#cc2222', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: blocking || blockDisabled ? 'not-allowed' : 'pointer', fontSize: 14, opacity: blocking || blockDisabled ? 0.6 : 1 }}
              >
                {blocking ? '…' : 'Block'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
