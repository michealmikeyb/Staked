import { type AuthState } from '../lib/store';

interface InboxPageProps {
  auth: AuthState;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

export default function InboxPage({ auth, setUnreadCount: _setUnreadCount }: InboxPageProps) {
  return <div>InboxPage - {auth.username}</div>;
}
