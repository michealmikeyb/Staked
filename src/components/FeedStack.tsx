import { type AuthState } from '../lib/store';

interface Props {
  auth: AuthState;
  onLogout: () => void;
}

export default function FeedStack({ auth }: Props) {
  return (
    <div style={{ color: 'var(--text-primary)', padding: 24 }}>
      Logged in as {auth.username} on {auth.instance}
    </div>
  );
}
