import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Source } from '../lib/api/types';
import MarkdownRenderer from './MarkdownRenderer';
import CommunityAvatar from './CommunityAvatar';

interface Props {
  auth?: unknown; // kept for App.tsx compat — backend provides session
}

export default function CommunityAboutPage({ auth: _auth }: Props) {
  const { instance, name } = useParams<{ instance: string; name: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const backend = useBackend();

  const stateInfo = (location.state as { communityInfo?: Source } | null)?.communityInfo;
  const [info, setInfo] = useState<Source | null>(stateInfo ?? null);
  const [loading, setLoading] = useState(!stateInfo);
  const [error, setError] = useState('');

  useEffect(() => {
    if (stateInfo) return;
    backend.sources.get(`${name}@${instance}`)
      .then((data) => { setInfo(data); setLoading(false); })
      .catch((e) => { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a', color: '#f5f5f5' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 16px', height: 48, flexShrink: 0,
        background: '#1a1d24', borderBottom: '1px solid #2a2d35',
      }}>
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: '0 8px 0 0', lineHeight: 1 }}
        >
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', color: '#f5f5f5', fontWeight: 600, fontSize: 15 }}>
          About c/{name}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>Loading...</div>
      )}
      {error && (
        <div style={{ padding: 24, color: '#ff6b35', textAlign: 'center' }}>{error}</div>
      )}

      {info && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {info.banner && (
            <div style={{ width: '100%', height: 120, overflow: 'hidden', flexShrink: 0 }}>
              <img
                src={info.banner}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
          <div style={{ padding: '16px 16px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <CommunityAvatar name={name!} icon={info.icon} size={40} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                  {info.counts.members.toLocaleString()} members · {info.counts.posts.toLocaleString()} posts
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #2a2d35', paddingTop: 16 }}>
              {info.description
                ? <MarkdownRenderer content={info.description} />
                : <div style={{ color: '#888', fontSize: 14 }}>No description.</div>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
