import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createBackend } from '../lib/api/registry';
import { useAccounts } from '../lib/AccountsContext';
import type { Session } from '../lib/api/types';
import type { LoginField } from '../lib/api/capabilities';
import styles from './LoginPage.module.css';
import Logo from './Logo';
import InstanceInput from './InstanceInput';

function anonSession(backendId: string): Session {
  return { id: `anon:${backendId}`, backendId, viewer: null, data: { instance: '', token: null } };
}

export default function DynamicLoginPage() {
  const navigate = useNavigate();
  const { backendId } = useParams<{ backendId: string }>();
  const { addAccount } = useAccounts();

  const backend = useMemo(() => createBackend(anonSession(backendId!)), [backendId]);
  const fields: LoginField[] = backend.capabilities.loginFields;

  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const ready = fields.every((f) => !f.required || (values[f.key] ?? '').trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError('');
    setLoading(true);
    try {
      const session = await backend.auth.login(values);
      addAccount(session);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Logo variant="full" layout="vertical" size={44} />
      <div className={styles.tagline}>{backend.capabilities.displayName}</div>
      <form className={styles.form} onSubmit={handleSubmit}>
        {fields.map((f) => (
          <div key={f.key}>
            <div className={styles.label}>{f.label}</div>
            {f.type === 'instance' ? (
              <InstanceInput
                id={f.key}
                aria-label={f.label}
                className={styles.input}
                placeholder={f.placeholder ?? 'instance.tld'}
                value={values[f.key] ?? ''}
                onChange={(val) => setField(f.key, val)}
              />
            ) : (
              <input
                id={f.key}
                aria-label={f.label}
                className={styles.input}
                type={f.type === 'password' ? 'password' : 'text'}
                placeholder={f.placeholder ?? f.label}
                value={values[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
                autoCapitalize={f.autoCapitalize === false ? 'none' : undefined}
                autoCorrect={f.autoCapitalize === false ? 'off' : undefined}
              />
            )}
          </div>
        ))}
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit" disabled={loading || !ready}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <button
        onClick={() => navigate('/')}
        style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}
      >
        Cancel
      </button>
    </div>
  );
}
