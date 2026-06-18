import { describe, it, expect } from 'vitest';
import { createLemmyBackend } from './index';
import type { Session } from '../../types';

const ANON: Session = { id: 'anon', backendId: 'lemmy', viewer: null, data: { instance: '', token: null } };

describe('lemmy capabilities', () => {
  it('exposes a display name and icon', () => {
    const caps = createLemmyBackend(ANON).capabilities;
    expect(caps.displayName).toBe('Lemmy');
    expect(caps.icon).toBeTruthy();
  });

  it('declares that lemmy has sources (communities)', () => {
    const caps = createLemmyBackend(ANON).capabilities;
    expect(caps.hasSources).toBe(true);
  });

  it('declares the login fields the add-account form needs', () => {
    const caps = createLemmyBackend(ANON).capabilities;
    const keys = caps.loginFields.map((f) => f.key);
    expect(keys).toEqual(['instance', 'usernameOrEmail', 'password']);
    const instanceField = caps.loginFields.find((f) => f.key === 'instance')!;
    expect(instanceField.type).toBe('instance');
    expect(instanceField.required).toBe(true);
    expect(instanceField.suggestions).toContain('lemmy.world');
    expect(caps.loginFields.find((f) => f.key === 'password')!.type).toBe('password');
  });
});
