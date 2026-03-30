import { useState } from 'react';
import { login } from '../lib/lemmy';
import { saveAuth, type AuthState } from '../lib/store';
import styles from './LoginPage.module.css';
import Logo from './Logo';

const POPULAR_INSTANCES = [
  'lemmy.world',
  'lemmy.dbzer0.com',
  'beehaw.org',
  'programming.dev',
  'lemmy.ml',
  'sh.itjust.works',
];

interface Props {
  onLogin: (auth: AuthState) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [selectedInstance, setSelectedInstance] = useState(POPULAR_INSTANCES[0]);
  const [customInstance, setCustomInstance] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const instance = selectedInstance === 'custom' ? customInstance.trim() : selectedInstance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instance || !username || !password) return;
    setError('');
    setLoading(true);
    try {
      const token = await login(instance, username, password);
      const auth: AuthState = { token, instance, username };
      saveAuth(auth);
      onLogin(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Logo variant="full" size={56} />
      <div className={styles.tagline}>Lemmy, fast</div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div>
          <div className={styles.label}>Instance</div>
          <select
            className={styles.select}
            value={selectedInstance}
            onChange={(e) => setSelectedInstance(e.target.value)}
          >
            {POPULAR_INSTANCES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
            <option value="custom">custom...</option>
          </select>
        </div>
        {selectedInstance === 'custom' && (
          <input
            className={styles.input}
            placeholder="your.instance.com"
            value={customInstance}
            onChange={(e) => setCustomInstance(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        )}
        <input
          className={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <input
          className={styles.input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? 'Signing in\u2026' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
