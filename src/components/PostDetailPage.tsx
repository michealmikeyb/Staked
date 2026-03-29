import { type AuthState } from '../lib/store';

interface PostDetailPageProps {
  auth: AuthState;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

export default function PostDetailPage({ auth, setUnreadCount: _setUnreadCount }: PostDetailPageProps) {
  return <div>PostDetailPage - {auth.username}</div>;
}
