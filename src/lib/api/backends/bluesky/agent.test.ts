import { describe, it, expect, vi, beforeEach } from 'vitest';

const resumeSession = vi.fn();
const login = vi.fn();

vi.mock('@atproto/api', () => {
  class CredentialSession {
    did?: string; handle?: string;
    constructor(public service: URL, public _fetch?: unknown, public persist?: any) {}
    resumeSession = resumeSession;
    login = login;
  }
  class Agent { constructor(public session: unknown) {} }
  return { CredentialSession, Agent };
});

import { buildAgent, loginWithAppPassword } from './agent';
import type { Session } from '../../types';

beforeEach(() => { resumeSession.mockReset(); login.mockReset(); });

const session = (data: any): Session => ({ id: 'bluesky:a', backendId: 'bluesky', viewer: null, data });

describe('buildAgent', () => {
  it('resumes a stored session when tokens are present', () => {
    buildAgent(session({ service: 'https://bsky.social', did: 'did:plc:a', handle: 'a.bsky.social', accessJwt: 'acc', refreshJwt: 'ref', feeds: [] }));
    expect(resumeSession).toHaveBeenCalledWith(expect.objectContaining({
      did: 'did:plc:a', handle: 'a.bsky.social', accessJwt: 'acc', refreshJwt: 'ref', active: true,
    }));
  });

  it('does not resume when there is no token', () => {
    buildAgent(session({}));
    expect(resumeSession).not.toHaveBeenCalled();
  });
});

describe('loginWithAppPassword', () => {
  it('logs in and returns session data', async () => {
    // The real @atproto/api CredentialSession stores session data on
    // `this.session` (AtpSessionData), not as top-level properties.
    login.mockImplementation(function (this: any) {
      this.session = { did: 'did:plc:a', handle: 'a.bsky.social', accessJwt: 'acc', refreshJwt: 'ref', active: true };
      return Promise.resolve();
    });
    const { data } = await loginWithAppPassword('https://bsky.social', 'a.bsky.social', 'pw');
    expect(login).toHaveBeenCalledWith({ identifier: 'a.bsky.social', password: 'pw' });
    expect(data).toMatchObject({ did: 'did:plc:a', handle: 'a.bsky.social', accessJwt: 'acc', refreshJwt: 'ref', service: 'https://bsky.social' });
  });
});
