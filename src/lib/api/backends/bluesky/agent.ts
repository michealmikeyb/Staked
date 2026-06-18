// src/lib/api/backends/bluesky/agent.ts
import { Agent, CredentialSession } from '@atproto/api';
import type { Session } from '../../types';
import { getBlueskySessionData, type BlueskySessionData } from './session';

export function buildAgent(
  session: Session,
  persist?: (data: Partial<BlueskySessionData>) => void,
): Agent {
  const data = getBlueskySessionData(session);
  const service = data?.service || 'https://bsky.social';
  const credSession = new CredentialSession(
    new URL(service),
    undefined,
    persist
      ? (_evt: string, s?: any) => {
          if (s) persist({ accessJwt: s.accessJwt, refreshJwt: s.refreshJwt, handle: s.handle, did: s.did });
        }
      : undefined,
  );
  if (data?.accessJwt && data?.did) {
    credSession.resumeSession({
      did: data.did,
      handle: data.handle,
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt,
      active: true,
    } as any);
  }
  return new Agent(credSession);
}

export async function loginWithAppPassword(
  service: string,
  identifier: string,
  appPassword: string,
): Promise<{ agent: Agent; data: Omit<BlueskySessionData, 'feeds'> }> {
  const credSession = new CredentialSession(new URL(service));
  await credSession.login({ identifier, password: appPassword });
  // CredentialSession stores the authenticated session as `.session`
  // (AtpSessionData); only `did` is also exposed as a top-level getter.
  const s = (credSession as any).session ?? {};
  return {
    agent: new Agent(credSession),
    data: {
      service,
      did: s.did,
      handle: s.handle,
      accessJwt: s.accessJwt,
      refreshJwt: s.refreshJwt,
    },
  };
}
