// src/lib/api/backends/bluesky/stubs.ts
import type { SourceService } from '../../backend';

export function notSupported(action: string): never {
  throw new Error(`Not supported on Bluesky yet: ${action}`);
}

// Bluesky has no communities, so there are no sources to fetch. Subscribe/block
// are no-ops; get throws because nothing in the UI should reach it.
export function createStubSourceService(): SourceService {
  return {
    async get() { return notSupported('communities'); },
    async subscribe() { /* no-op */ },
    async block() { /* no-op */ },
  };
}
