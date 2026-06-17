// src/lib/api/registry.ts
import type { Backend } from './backend';
import type { Session } from './types';

export type BackendFactory = (session: Session) => Backend;

const registry = new Map<string, BackendFactory>();

export function registerBackend(backendId: string, factory: BackendFactory): void {
  registry.set(backendId, factory);
}

export function hasBackend(backendId: string): boolean {
  return registry.has(backendId);
}

export function listBackendIds(): string[] {
  return [...registry.keys()];
}

export function createBackend(session: Session): Backend {
  const factory = registry.get(session.backendId);
  if (!factory) throw new Error(`Unknown backendId: ${session.backendId}`);
  return factory(session);
}

export function clearRegistry(): void {
  registry.clear();
}
