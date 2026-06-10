import { useState, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { loadAuth, clearAuth, type AuthState } from './lib/store';
import { SettingsProvider, useSettings } from './lib/SettingsContext';
import { BackendProvider } from './lib/api/context';
import { createLemmyBackend } from './lib/api/backends/lemmy';
import type { Session } from './lib/api/types';
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

function authToSession(auth: AuthState | null): Session {
  if (!auth) {
    return {
      id: 'anon',
      backendId: 'lemmy',
      viewer: null,
      data: { instance: '', token: null },
    };
  }
  return {
    id: auth.token,
    backendId: 'lemmy',
    viewer: {
      id: auth.username,
      handle: `${auth.username}@${auth.instance}`,
      profileUrl: `https://${auth.instance}/u/${auth.username}`,
    },
    data: { instance: auth.instance, token: auth.token },
  };
}

function RequireAuth({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session?.viewer) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CommunityFeedRoute({ onLogout, unreadCount, setUnreadCount }: {
  onLogout: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { instance, name } = useParams<{ instance: string; name: string }>();
  return (
    <FeedStack
      onLogout={onLogout}
      unreadCount={unreadCount}
      setUnreadCount={setUnreadCount}
      community={{ name: name!, instance: instance! }}
    />
  );
}

function UserProfileRoute() {
  const { instance, username } = useParams<{ instance: string; username: string }>();
  return <ProfilePage target={{ instance: instance!, username: username! }} />;
}

interface AppRoutesProps {
  auth: AuthState | null;
  onLogin: (auth: AuthState) => void;
  onLogout: () => void;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  notifPermission: NotificationPermission;
  setNotifPermission: React.Dispatch<React.SetStateAction<NotificationPermission>>;
}

function AppRoutes({
  auth, onLogin, onLogout, unreadCount, setUnreadCount, notifPermission, setNotifPermission,
}: AppRoutesProps) {
  const { settings } = useSettings();
  const backend = useMemo(
    () => createLemmyBackend(authToSession(auth), {
      anonInstanceSetting: () => settings.lemmy?.anonInstance || undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth, settings.lemmy?.anonInstance],
  );

  useNotificationPolling(backend, setUnreadCount, notifPermission);

  const session = backend.session;

  return (
    <BackendProvider value={backend}>
      <Routes>
        <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
        <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
        <Route
          path="/"
          element={
            <FeedStack
              onLogout={onLogout}
              unreadCount={unreadCount}
              setUnreadCount={setUnreadCount}
            />
          }
        />
        <Route path="/settings" element={<SettingsPage isAuthenticated={!!session?.viewer} onPermissionChange={setNotifPermission} />} />
        <Route
          path="/inbox"
          element={
            <RequireAuth session={session}>
              <InboxPage setUnreadCount={setUnreadCount} unreadCount={unreadCount} />
            </RequireAuth>
          }
        />
        <Route
          path="/inbox/:notifId"
          element={
            <RequireAuth session={session}>
              <PostDetailPage setUnreadCount={setUnreadCount} unreadCount={unreadCount} />
            </RequireAuth>
          }
        />
        <Route
          path="/saved"
          element={<RequireAuth session={session}><SavedPage /></RequireAuth>}
        />
        <Route
          path="/saved/:postId"
          element={<RequireAuth session={session}><SavedPostDetailPage /></RequireAuth>}
        />
        <Route
          path="/profile"
          element={<RequireAuth session={session}><ProfilePage /></RequireAuth>}
        />
        <Route
          path="/profile/view"
          element={<RequireAuth session={session}><ProfilePostDetailPage /></RequireAuth>}
        />
        <Route
          path="/create-post"
          element={<RequireAuth session={session}><CreatePostPage /></RequireAuth>}
        />
        <Route
          path="/community/:instance/:name"
          element={
            <RequireAuth session={session}>
              <CommunityFeedRoute
                onLogout={onLogout}
                unreadCount={unreadCount}
                setUnreadCount={setUnreadCount}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/community/:instance/:name/about"
          element={
            <RequireAuth session={session}><CommunityAboutPage /></RequireAuth>
          }
        />
        <Route
          path="/user/:instance/:username"
          element={<UserProfileRoute />}
        />
        <Route
          path="/search"
          element={<RequireAuth session={session}><SearchPage /></RequireAuth>}
        />
        <Route
          path="/view/:instance/:postId"
          element={<RequireAuth session={session}><PostViewPage /></RequireAuth>}
        />
      </Routes>
    </BackendProvider>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

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
        <AppRoutes
          auth={auth}
          onLogin={handleLogin}
          onLogout={handleLogout}
          unreadCount={unreadCount}
          setUnreadCount={setUnreadCount}
          notifPermission={notifPermission}
          setNotifPermission={setNotifPermission}
        />
      </SettingsProvider>
    </HashRouter>
  );
}
