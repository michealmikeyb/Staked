// src/lib/api/backends/lemmy/session.ts
import type { Session, Stak } from '../../types';

export interface LemmySessionData {
  instance: string;
  token: string | null;
}

export function getLemmySessionData(session: Session): LemmySessionData {
  return session.data as unknown as LemmySessionData;
}

export function listLemmyStaks(session: Session): Stak[] {
  const isLoggedIn = !!getLemmySessionData(session).token;
  const staks: Stak[] = [
    { sessionId: session.id, id: 'all', label: 'All' },
    { sessionId: session.id, id: 'local', label: 'Local' },
  ];
  if (isLoggedIn) {
    staks.push({ sessionId: session.id, id: 'subscribed', label: 'Subscribed' });
  }
  return staks;
}
