// src/lib/api/backends/bluesky/stubs.ts
import type { SourceService, NotificationService, SearchService, MediaService } from '../../backend';

export function notSupported(action: string): never {
  throw new Error(`Not supported on Bluesky yet: ${action}`);
}

export function createStubSourceService(): SourceService {
  return {
    async get() { return notSupported('communities'); },
    async subscribe() { /* no-op */ },
    async block() { /* no-op */ },
  };
}

export function createStubNotificationService(): NotificationService {
  return {
    async unreadCount() { return 0; },
    async list() { return { items: [], nextCursor: null }; },
    async markRead() { /* no-op */ },
  };
}

export function createStubSearchService(): SearchService {
  return {
    async posts() { return { items: [], nextCursor: null }; },
    async sources() { return { items: [], nextCursor: null }; },
  };
}

export function createStubMediaService(): MediaService {
  return {
    async uploadImage() { return notSupported('image upload'); },
  };
}
