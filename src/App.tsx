import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { loadAuth, clearAuth, type AuthState } from './lib/store';
import LoginPage from './components/LoginPage';
import FeedStack from './components/FeedStack';
import InboxPage from './components/InboxPage';
import PostDetailPage from './components/PostDetailPage';

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [unreadCount, setUnreadCount] = useState(0);

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

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <FeedStack
              auth={auth}
              onLogout={handleLogout}
              unreadCount={unreadCount}
              setUnreadCount={setUnreadCount}
            />
          }
        />
        <Route
          path="/inbox"
          element={<InboxPage auth={auth} setUnreadCount={setUnreadCount} />}
        />
        <Route
          path="/inbox/:notifId"
          element={<PostDetailPage auth={auth} setUnreadCount={setUnreadCount} />}
        />
      </Routes>
    </HashRouter>
  );
}
