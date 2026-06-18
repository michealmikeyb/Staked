// Minimal stub for @atproto/api used in tests running on Node 18,
// which cannot parse `import ... with { type: 'json' }` in the real package.
import { vi } from 'vitest';

export class CredentialSession {
  did?: string;
  handle?: string;
  accessJwt?: string;
  refreshJwt?: string;
  constructor(
    public service: URL,
    public _f?: unknown,
    public persist?: (data: unknown) => void,
  ) {}
  login = vi.fn();
  resumeSession = vi.fn();
}

export class Agent {
  constructor(public session: unknown) {}
  getProfile = vi.fn().mockResolvedValue({ data: { did: '', handle: '', displayName: '' } });
  app = {
    bsky: {
      actor: { getPreferences: vi.fn().mockResolvedValue({ data: { preferences: [] } }) },
      feed: { getFeedGenerators: vi.fn().mockResolvedValue({ data: { feeds: [] } }) },
    },
  };
}
