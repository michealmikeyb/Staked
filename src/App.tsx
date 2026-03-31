import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { loadAuth, clearAuth, type AuthState } from './lib/store';
import LoginPage from './components/LoginPage';
import FeedStack from './components/FeedStack';
import InboxPage from './components/InboxPage';
import PostDetailPage from './components/PostDetailPage';
import SavedPage from './components/SavedPage';
import SavedPostDetailPage from './components/SavedPostDetailPage';
import ProfilePage from './components/ProfilePage';
import ProfilePostDetailPage from './components/ProfilePostDetailPage';
import SharedPostPage from './components/SharedPostPage';

function AuthenticatedApp({ auth, onLogout }: { auth: AuthState; onLogout: () => void }) {
  const [unreadCount, setUnreadCount] = useState(0);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <FeedStack
            auth={auth}
            onLogout={onLogout}
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
          />
        }
      />
      <Route
        path="/inbox"
        element={<InboxPage auth={auth} setUnreadCount={setUnreadCount} unreadCount={unreadCount} />}
      />
      <Route
        path="/inbox/:notifId"
        element={<PostDetailPage auth={auth} setUnreadCount={setUnreadCount} unreadCount={unreadCount} />}
      />
      <Route path="/saved" element={<SavedPage auth={auth} />} />
      <Route path="/saved/:postId" element={<SavedPostDetailPage auth={auth} />} />
      <Route path="/profile" element={<ProfilePage auth={auth} />} />
      <Route path="/profile/:postId" element={<ProfilePostDetailPage auth={auth} />} />
    </Routes>
  );
}

function AuthGate({ auth, onLogin, onLogout }: {
  auth: AuthState | null;
  onLogin: (a: AuthState) => void;
  onLogout: () => void;
}) {
  if (!auth) return <LoginPage onLogin={onLogin} />;
  return <AuthenticatedApp auth={auth} onLogout={onLogout} />;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());

  function handleLogin(newAuth: AuthState) {
    setAuth(newAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
        <Route
          path="/*"
          element={<AuthGate auth={auth} onLogin={handleLogin} onLogout={handleLogout} />}
        />
      </Routes>
    </HashRouter>
  );
}
