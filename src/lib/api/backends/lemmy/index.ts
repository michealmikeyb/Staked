// src/lib/api/backends/lemmy/index.ts
import type { Backend, AuthService } from '../../backend';
import type { Capabilities } from '../../capabilities';
import type { Session, Stak } from '../../types';
import { makeLemmyClient } from './client';
import { listLemmyStaks, type LemmySessionData } from './session';
import { mapUser } from './mappers';
import { createFeedService } from './feed';
import { createPostService } from './posts';
import { createCommentService } from './comments';
import { createSourceService } from './sources';
import { createUserService } from './users';
import { createNotificationService } from './notifs';
import { createSearchService } from './search';
import { createMediaService } from './media';

const LEMMY_CAPABILITIES: Capabilities = {
  canDownvote: true,
  canBrowseAnonymously: true,
  hasNsfwFlag: true,
  hasSavedPosts: true,
  feedOptions: [
    { id: 'Active', label: 'Active' },
    { id: 'Hot', label: 'Hot' },
    { id: 'New', label: 'New' },
    { id: 'TopHour', label: 'Top — Hour' },
    { id: 'TopSixHour', label: 'Top — 6h' },
    { id: 'TopTwelveHour', label: 'Top — 12h' },
    { id: 'TopDay', label: 'Top — Day' },
    { id: 'TopWeek', label: 'Top — Week' },
    { id: 'TopMonth', label: 'Top — Month' },
    { id: 'TopYear', label: 'Top — Year' },
    { id: 'TopAll', label: 'Top — All' },
    { id: 'MostComments', label: 'Most Comments' },
    { id: 'NewComments', label: 'New Comments' },
  ],
  commentSortOptions: [
    { id: 'Top', label: 'Top' },
    { id: 'Hot', label: 'Hot' },
    { id: 'New', label: 'New' },
    { id: 'Old', label: 'Old' },
  ],
  sourceNoun: 'Community',
};

function createAuthService(session: Session): AuthService {
  return {
    async login(credentials): Promise<Session> {
      const { instance, usernameOrEmail, password } = credentials as {
        instance: string; usernameOrEmail: string; password: string;
      };
      const res = await makeLemmyClient(instance).login({ username_or_email: usernameOrEmail, password });
      if (!res.jwt) throw new Error('Login failed: no token returned');
      const persRes = await makeLemmyClient(instance, res.jwt).getSite();
      const viewer = persRes.my_user?.local_user_view?.person
        ? mapUser(persRes.my_user.local_user_view.person)
        : null;
      const data: LemmySessionData & Record<string, unknown> = { instance, token: res.jwt };
      return { ...session, viewer, data };
    },
    async logout(): Promise<void> {},
  };
}

export interface LemmyBackendOptions {
  anonInstanceSetting?: () => string | undefined;
}

export function createLemmyBackend(session: Session, opts: LemmyBackendOptions = {}): Backend {
  const getAnon = opts.anonInstanceSetting ?? (() => undefined);
  return {
    backendId: 'lemmy',
    capabilities: LEMMY_CAPABILITIES,
    session,
    listStaks(): Stak[] { return listLemmyStaks(session); },
    auth: createAuthService(session),
    feed: createFeedService(session, getAnon),
    posts: createPostService(session),
    comments: createCommentService(session),
    sources: createSourceService(session),
    users: createUserService(session),
    notifications: createNotificationService(session),
    search: createSearchService(session),
    media: createMediaService(session),
  };
}
