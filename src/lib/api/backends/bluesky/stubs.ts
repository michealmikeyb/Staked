// src/lib/api/backends/bluesky/stubs.ts
export function notSupported(action: string): never {
  throw new Error(`Not supported on Bluesky yet: ${action}`);
}
