import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./bluesky', () => ({
  createBlueskyBackend: vi.fn().mockReturnValue({ backendId: 'bluesky' }),
}));

vi.mock('../../accounts', () => ({
  updateSessionData: vi.fn(),
}));

import { registerBackends } from './index';
import { clearRegistry, hasBackend, listBackendIds, createBackend } from '../registry';

beforeEach(() => clearRegistry());

describe('registerBackends', () => {
  it('registers the lemmy backend', () => {
    registerBackends();
    expect(hasBackend('lemmy')).toBe(true);
    expect(listBackendIds()).toContain('lemmy');
  });

  it('is idempotent and does not overwrite an already-registered backend', () => {
    registerBackends();
    const before = createBackend({ id: 'lemmy:a', backendId: 'lemmy', viewer: null, data: { instance: 'x', token: null } });
    registerBackends();
    expect(before.backendId).toBe('lemmy');
    expect(listBackendIds()).toContain('lemmy');
    expect(listBackendIds().filter((id) => id === 'lemmy')).toHaveLength(1);
  });

  it('registers the bluesky backend', () => {
    registerBackends();
    expect(hasBackend('bluesky')).toBe(true);
    expect(listBackendIds()).toContain('bluesky');
  });
});
