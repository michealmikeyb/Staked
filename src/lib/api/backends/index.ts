// src/lib/api/backends/index.ts
import { registerBackend, hasBackend } from '../registry';
import { createLemmyBackend } from './lemmy';
import { loadSettings } from '../../store';

/**
 * Register every backend into the registry. Idempotent: only registers a
 * backend that isn't already present, so tests can pre-register a stub.
 */
export function registerBackends(): void {
  if (!hasBackend('lemmy')) {
    registerBackend('lemmy', (session) =>
      createLemmyBackend(session, {
        anonInstanceSetting: () => loadSettings().lemmy?.anonInstance || undefined,
      }),
    );
  }
}
