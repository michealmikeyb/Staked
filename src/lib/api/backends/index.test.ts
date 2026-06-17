import { describe, it, expect, beforeEach } from 'vitest';
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
    expect(listBackendIds()).toEqual(['lemmy']);
  });
});
