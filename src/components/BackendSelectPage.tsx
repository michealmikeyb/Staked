import { useNavigate } from 'react-router-dom';
import { listBackendIds, createBackend } from '../lib/api/registry';
import type { Session } from '../lib/api/types';

function anonSession(backendId: string): Session {
  return { id: `anon:${backendId}`, backendId, viewer: null, data: { instance: '', token: null } };
}

export default function BackendSelectPage() {
  const navigate = useNavigate();
  const backends = listBackendIds().map((id) => {
    const caps = createBackend(anonSession(id)).capabilities;
    return { id, name: caps.displayName, icon: caps.icon };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: 16, gap: 12 }}>
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 15, cursor: 'pointer', padding: 4 }}
      >
        ‹ Back
      </button>
      <h1 style={{ color: 'var(--text)', fontSize: 20, margin: '8px 0 4px' }}>Add account</h1>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>Choose a backend</div>
      {backends.map((b) => (
        <button
          key={b.id}
          onClick={() => navigate(`/accounts/add/${b.id}`)}
          aria-label={b.name}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '16px', cursor: 'pointer', color: 'var(--text)', fontSize: 16, fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 24 }}>{b.icon}</span>
          {b.name}
        </button>
      ))}
    </div>
  );
}
