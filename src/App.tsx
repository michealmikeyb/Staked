import { useState } from 'react';
import { HashRouter, Routes, Route, useParams } from 'react-router-dom';
import { loadAuth, clearAuth, type AuthState } from './lib/store';
import { SettingsProvider } from './lib/SettingsContext';
import LoginPage from './components/LoginPage';
import FeedStack from './components/FeedStack';
import InboxPage from './components/InboxPage';
import PostDetailPage from './components/PostDetailPage';
import SavedPage from './components/SavedPage';
import SavedPostDetailPage from './components/SavedPostDetailPage';
import ProfilePage from './components/ProfilePage';
import ProfilePostDetailPage from './components/ProfilePostDetailPage';
import SettingsPage from './components/SettingsPage';
import CreatePostPage from './components/CreatePostPage';
import SharedPostPage from './components/SharedPostPage';
import CommunityAboutPage from './components/CommunityAboutPage';
import SearchPage from './components/SearchPage';
import PostViewPage from './components/PostViewPage';

function CommunityFeedRoute({ auth, onLogout, unreadCount, setUnreadCount }: {
  auth: AuthState;
  onLogout: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { instance, name } = useParams<{ instance: string; name: string }>();
  return (
    <FeedStack
      auth={auth}
      onLogout={onLogout}
      unreadCount={unreadCount}
      setUnreadCount={setUnreadCount}
      community={{ name: name!, instance: instance! }}
    />
  );
}

function UserProfileRoute({ auth }: { auth: AuthState }) {
  const { instance, username } = useParams<{ instance: string; username: string }>();
  return <ProfilePage auth={auth} target={{ instance: instance!, username: username! }} />;
}

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
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/create-post" element={<CreatePostPage auth={auth} />} />
      <Route
        path="/community/:instance/:name"
        element={
          <CommunityFeedRoute
            auth={auth}
            onLogout={onLogout}
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
          />
        }
      />
      <Route
        path="/community/:instance/:name/about"
        element={<CommunityAboutPage auth={auth} />}
      />
      <Route path="/user/:instance/:username" element={<UserProfileRoute auth={auth} />} />
      <Route path="/search" element={<SearchPage auth={auth} />} />
      <Route
        path="/view/:instance/:postId"
        element={<PostViewPage auth={auth} />}
      />
    </Routes>
  );
}

function AuthGate({ auth, onLogin, onLogout }: {
  auth: AuthState | null;
  onLogin: (a: AuthState) => void;
  onLogout: () => void;
}) {
  if (!auth) return <LoginPage onLogin={onLogin} />;
  return (
    <SettingsProvider>
      <AuthenticatedApp auth={auth} onLogout={onLogout} />
    </SettingsProvider>
  );
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
