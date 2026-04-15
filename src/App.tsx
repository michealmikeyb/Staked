import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { loadAuth, clearAuth, type AuthState } from './lib/store';
import { SettingsProvider } from './lib/SettingsContext';
import { useNotificationPolling } from './hooks/useNotificationPolling';
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

function RequireAuth({ auth, children }: { auth: AuthState | null; children: React.ReactNode }) {
  if (!auth) return <Navigate to="/" replace />;
  return <>{children}</>;
}

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

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  useNotificationPolling(auth, setUnreadCount, notifPermission);

  function handleLogin(newAuth: AuthState) {
    setAuth(newAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  return (
    <HashRouter>
      <SettingsProvider>
        <Routes>
          <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
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
          <Route path="/settings" element={<SettingsPage isAuthenticated={auth !== null} onPermissionChange={setNotifPermission} />} />
          <Route
            path="/inbox"
            element={
              <RequireAuth auth={auth}>
                <InboxPage auth={auth!} setUnreadCount={setUnreadCount} unreadCount={unreadCount} />
              </RequireAuth>
            }
          />
          <Route
            path="/inbox/:notifId"
            element={
              <RequireAuth auth={auth}>
                <PostDetailPage auth={auth!} setUnreadCount={setUnreadCount} unreadCount={unreadCount} />
              </RequireAuth>
            }
          />
          <Route
            path="/saved"
            element={<RequireAuth auth={auth}><SavedPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/saved/:postId"
            element={<RequireAuth auth={auth}><SavedPostDetailPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/profile"
            element={<RequireAuth auth={auth}><ProfilePage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/profile/:postId"
            element={<RequireAuth auth={auth}><ProfilePostDetailPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/create-post"
            element={<RequireAuth auth={auth}><CreatePostPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/community/:instance/:name"
            element={
              <RequireAuth auth={auth}>
                <CommunityFeedRoute
                  auth={auth!}
                  onLogout={handleLogout}
                  unreadCount={unreadCount}
                  setUnreadCount={setUnreadCount}
                />
              </RequireAuth>
            }
          />
          <Route
            path="/community/:instance/:name/about"
            element={
              <RequireAuth auth={auth}><CommunityAboutPage auth={auth!} /></RequireAuth>
            }
          />
          <Route
            path="/user/:instance/:username"
            element={
              <RequireAuth auth={auth}><UserProfileRoute auth={auth!} /></RequireAuth>
            }
          />
          <Route
            path="/search"
            element={<RequireAuth auth={auth}><SearchPage auth={auth!} /></RequireAuth>}
          />
          <Route
            path="/view/:instance/:postId"
            element={<RequireAuth auth={auth}><PostViewPage auth={auth!} /></RequireAuth>}
          />
        </Routes>
      </SettingsProvider>
    </HashRouter>
  );
}
