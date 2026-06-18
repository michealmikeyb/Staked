import { describe, it, expect, vi, beforeEach } from 'vitest';

const login = vi.fn();
const resumeSession = vi.fn();

vi.mock('@atproto/api', () => {
  class CredentialSession {
    did?: string; handle?: string; accessJwt?: string; refreshJwt?: string;
    constructor(public service: URL, public _f?: unknown, public persist?: any) {}
    resumeSession = resumeSession;
    login = login;
  }
  class Agent {
    constructor(public session: any) {}
    getProfile = vi.fn().mockResolvedValue({ data: { did: 'did:plc:a', handle: 'alice.bsky.social', displayName: 'Alice' } });
    app = { bsky: {
      actor: { getPreferences: vi.fn().mockResolvedValue({ data: { preferences: [] } }) },
      feed: { getFeedGenerators: vi.fn() },
    } };
  }
  return { CredentialSession, Agent };
});

import { createBlueskyBackend } from './index';
import type { Session } from '../../types';

const anon: Session = { id: 'anon:bluesky', backendId: 'bluesky', viewer: null, data: {} as any };

beforeEach(() => {
  login.mockReset(); resumeSession.mockReset();
  // Real CredentialSession stores auth data on `this.session` (AtpSessionData).
  login.mockImplementation(function (this: any) {
    this.session = { did: 'did:plc:a', handle: 'alice.bsky.social', accessJwt: 'acc', refreshJwt: 'ref', active: true };
    return Promise.resolve();
  });
});

describe('createBlueskyBackend', () => {
  it('exposes capabilities, a single Home stak, and the expected backendId', () => {
    const backend = createBlueskyBackend(anon);
    expect(backend.backendId).toBe('bluesky');
    expect(backend.capabilities.displayName).toBe('Bluesky');
    expect(backend.listStaks()).toEqual([{ sessionId: 'anon:bluesky', id: 'home', label: 'Home' }]);
  });

  it('logs in, maps the viewer, resolves feeds, and returns a stable session id', async () => {
    const backend = createBlueskyBackend(anon);
    const session = await backend.auth.login({ identifier: 'alice.bsky.social', appPassword: 'pw' });
    expect(login).toHaveBeenCalledWith({ identifier: 'alice.bsky.social', password: 'pw' });
    expect(session.id).toBe('bluesky:alice.bsky.social');
    expect(session.viewer?.handle).toBe('alice.bsky.social');
    const data = session.data as any;
    expect(data.accessJwt).toBe('acc');
    expect(data.feeds[0]).toEqual({ id: 'following', label: 'Following' });
  });
});
