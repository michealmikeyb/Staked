import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { SettingsProvider } from './lib/SettingsContext';
import { AccountsProvider } from './lib/AccountsContext';
import { useBackend } from './lib/api/context';
import type { Session } from './lib/api/types';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import DynamicLoginPage from './components/DynamicLoginPage';
import BackendSelectPage from './components/BackendSelectPage';
import AccountsPage from './components/AccountsPage';
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

function RequireAuth({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session?.viewer) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CommunityFeedRoute({ unreadCount, setUnreadCount }: {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { instance, name } = useParams<{ instance: string; name: string }>();
  return (
    <FeedStack
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
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  notifPermission: NotificationPermission;
  setNotifPermission: React.Dispatch<React.SetStateAction<NotificationPermission>>;
}

function AppRoutes({ unreadCount, setUnreadCount, notifPermission, setNotifPermission }: AppRoutesProps) {
  const backend = useBackend();
  useNotificationPolling(backend, setUnreadCount, notifPermission);
  const session = backend.session;

  return (
    <Routes>
      <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
      <Route path="/login" element={<Navigate to="/accounts/add" replace />} />
      <Route path="/accounts" element={<AccountsPage />} />
      <Route path="/accounts/add" element={<BackendSelectPage />} />
      <Route path="/accounts/add/:backendId" element={<DynamicLoginPage />} />
      <Route
        path="/"
        element={<FeedStack unreadCount={unreadCount} setUnreadCount={setUnreadCount} />}
      />
      <Route path="/settings" element={<SettingsPage isAuthenticated={!!session?.viewer} onPermissionChange={setNotifPermission} />} />
      <Route path="/inbox" element={<RequireAuth session={session}><InboxPage setUnreadCount={setUnreadCount} unreadCount={unreadCount} /></RequireAuth>} />
      <Route path="/inbox/:notifId" element={<RequireAuth session={session}><PostDetailPage setUnreadCount={setUnreadCount} unreadCount={unreadCount} /></RequireAuth>} />
      <Route path="/saved" element={<RequireAuth session={session}><SavedPage /></RequireAuth>} />
      <Route path="/saved/:postId" element={<RequireAuth session={session}><SavedPostDetailPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth session={session}><ProfilePage /></RequireAuth>} />
      <Route path="/profile/view" element={<RequireAuth session={session}><ProfilePostDetailPage /></RequireAuth>} />
      <Route path="/create-post" element={<RequireAuth session={session}><CreatePostPage /></RequireAuth>} />
      <Route path="/community/:instance/:name" element={<RequireAuth session={session}><CommunityFeedRoute unreadCount={unreadCount} setUnreadCount={setUnreadCount} /></RequireAuth>} />
      <Route path="/community/:instance/:name/about" element={<RequireAuth session={session}><CommunityAboutPage /></RequireAuth>} />
      <Route path="/user/:instance/:username" element={<UserProfileRoute />} />
      <Route path="/search" element={<RequireAuth session={session}><SearchPage /></RequireAuth>} />
      <Route path="/view/:instance/:postId" element={<RequireAuth session={session}><PostViewPage /></RequireAuth>} />
    </Routes>
  );
}

export default function App() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  return (
    <HashRouter>
      <SettingsProvider>
        <AccountsProvider>
          <AppRoutes
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
            notifPermission={notifPermission}
            setNotifPermission={setNotifPermission}
          />
        </AccountsProvider>
      </SettingsProvider>
    </HashRouter>
  );
}
