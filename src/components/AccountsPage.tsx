import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../lib/AccountsContext';

export default function AccountsPage() {
  const navigate = useNavigate();
  const { accounts, active, removeAccount, reorderAccounts } = useAccounts();

  function move(id: string, dir: -1 | 1) {
    const ids = accounts.map((a) => a.session.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderAccounts(ids);
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '12px 14px',
  };
  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, padding: 4,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: 16, gap: 10 }}>
      <button onClick={() => navigate(-1)} aria-label="Back"
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 15, cursor: 'pointer', padding: 4 }}>
        ‹ Back
      </button>
      <h1 style={{ color: 'var(--text)', fontSize: 20, margin: '8px 0' }}>Accounts</h1>

      {accounts.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No accounts yet.</div>
      )}

      {accounts.map((a, i) => {
        const id = a.session.id;
        const handle = a.session.viewer?.handle ?? id;
        const isActive = active?.sessionId === id;
        return (
          <div key={id} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{handle}</div>
              {isActive && <div data-testid={`active-${id}`} style={{ color: 'var(--accent)', fontSize: 12 }}>Active</div>}
            </div>
            <button style={iconBtn} aria-label={`Move ${handle} up`} disabled={i === 0} onClick={() => move(id, -1)}>↑</button>
            <button style={iconBtn} aria-label={`Move ${handle} down`} disabled={i === accounts.length - 1} onClick={() => move(id, 1)}>↓</button>
            <button style={{ ...iconBtn, color: '#ff4444' }} aria-label={`Remove ${handle}`} onClick={() => removeAccount(id)}>✕</button>
          </div>
        );
      })}

      <button
        onClick={() => navigate('/accounts/add')}
        aria-label="Add account"
        style={{ marginTop: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}
      >
        ➕ Add account
      </button>
    </div>
  );
}
