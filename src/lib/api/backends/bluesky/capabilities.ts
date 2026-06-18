// src/lib/api/backends/bluesky/capabilities.ts
import type { Capabilities } from '../../capabilities';
import type { Session } from '../../types';
import { feedOptionsFromSession } from './session';

export function buildBlueskyCapabilities(session: Session): Capabilities {
  return {
    canDownvote: false,
    canBrowseAnonymously: false,
    hasNsfwFlag: false,
    hasSavedPosts: false,
    hasSources: false,
    feedOptions: feedOptionsFromSession(session),
    commentSortOptions: [],
    sourceNoun: '',
    displayName: 'Bluesky',
    icon: '🦋',
    loginFields: [
      { key: 'identifier', label: 'Handle or email', type: 'text', required: true,
        placeholder: 'you.bsky.social', autoCapitalize: false },
      { key: 'appPassword', label: 'App password', type: 'password', required: true,
        placeholder: 'xxxx-xxxx-xxxx-xxxx' },
    ],
  };
}
