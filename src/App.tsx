import { useState } from 'react';
import { loadAuth, clearAuth } from './lib/store';
import { type AuthState } from './lib/store';
import LoginPage from './components/LoginPage';
import FeedStack from './components/FeedStack';

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());

  function handleLogin(newAuth: AuthState) {
    setAuth(newAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <FeedStack auth={auth} onLogout={handleLogout} />;
}
