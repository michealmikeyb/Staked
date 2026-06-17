import { describe, it, expect, beforeEach } from 'vitest';
import { registerBackend, hasBackend, listBackendIds, createBackend, clearRegistry } from './registry';
import { createMockBackend } from './backends/mock';
import type { Session } from './types';

beforeEach(() => clearRegistry());

const session: Session = { id: 'mock:x', backendId: 'mock', viewer: null, data: {} };

describe('registry', () => {
  it('reports whether a backend is registered', () => {
    expect(hasBackend('mock')).toBe(false);
    registerBackend('mock', () => createMockBackend());
    expect(hasBackend('mock')).toBe(true);
  });

  it('lists registered backend ids', () => {
    registerBackend('mock', () => createMockBackend());
    expect(listBackendIds()).toEqual(['mock']);
  });

  it('creates a backend from a session', () => {
    registerBackend('mock', () => createMockBackend());
    expect(createBackend(session).backendId).toBe('mock');
  });
});
