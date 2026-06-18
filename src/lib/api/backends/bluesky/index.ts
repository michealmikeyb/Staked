// src/lib/api/backends/bluesky/index.ts
import type { Backend, AuthService } from '../../backend';
import type { Session, Stak } from '../../types';
import { buildBlueskyCapabilities } from './capabilities';
import { buildAgent, loginWithAppPassword } from './agent';
import { listBlueskyStaks, resolveFeeds, type BlueskySessionData } from './session';
import { mapUser } from './mappers';
import { createFeedService } from './feed';
import { createPostService } from './posts';
import { createCommentService } from './comments';
import { createUserService } from './users';
import {
  createStubSourceService, createStubNotificationService,
  createStubSearchService, createStubMediaService,
} from './stubs';

const SERVICE = 'https://bsky.social';

export interface BlueskyBackendOptions {
  persistSession?: (data: Partial<BlueskySessionData>) => void;
}

function createAuthService(session: Session): AuthService {
  return {
    async login(credentials): Promise<Session> {
      const { identifier, appPassword } = credentials as { identifier: string; appPassword: string };
      const { agent, data } = await loginWithAppPassword(SERVICE, identifier, appPassword);
      const profile = await agent.getProfile({ actor: data.did });
      const viewer = mapUser(profile.data);
      const feeds = await resolveFeeds(agent);
      const sessionData: BlueskySessionData = { ...data, feeds };
      return {
        ...session,
        id: `bluesky:${data.handle.toLowerCase()}`,
        backendId: 'bluesky',
        viewer,
        data: sessionData as unknown as Session['data'],
      };
    },
    async logout(): Promise<void> {},
  };
}

export function createBlueskyBackend(session: Session, opts: BlueskyBackendOptions = {}): Backend {
  const agent = buildAgent(session, opts.persistSession);
  const getAgent = () => agent;
  return {
    backendId: 'bluesky',
    capabilities: buildBlueskyCapabilities(session),
    session,
    listStaks(): Stak[] { return listBlueskyStaks(session); },
    auth: createAuthService(session),
    feed: createFeedService(getAgent),
    posts: createPostService(getAgent),
    comments: createCommentService(getAgent),
    sources: createStubSourceService(),
    users: createUserService(getAgent),
    notifications: createStubNotificationService(),
    search: createStubSearchService(),
    media: createStubMediaService(),
  };
}
