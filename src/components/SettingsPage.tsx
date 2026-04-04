import { useNavigate } from 'react-router-dom';
import { useSettings } from '../lib/SettingsContext';
import { SORT_OPTIONS } from './HeaderBar';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { settings, updateSetting } = useSettings();

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
        <div style={card}>
          <div style={sectionLabel}>Left Swipe</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={settings.leftSwipe === 'downvote' ? active : inactive}
              onClick={() => updateSetting('leftSwipe', 'downvote')}
            >
              Downvote
            </button>
            <button
              style={settings.leftSwipe === 'dismiss' ? active : inactive}
              onClick={() => updateSetting('leftSwipe', 'dismiss')}
            >
              Dismiss
            </button>
          </div>
        </div>

        <div style={card}>
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

        <div style={card}>
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
      </div>
    </div>
  );
}
