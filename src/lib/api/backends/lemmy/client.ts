// src/lib/api/backends/lemmy/client.ts
import { LemmyHttp } from 'lemmy-js-client';

export function makeLemmyClient(instance: string, token?: string | null): LemmyHttp {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return new LemmyHttp(`https://${instance}`, { headers });
}

export function instanceFromActorId(actorId: string): string {
  try { return new URL(actorId).host; } catch { return ''; }
}

export function sourceFromApId(apId: string): { instance: string; postId: number } | null {
  try {
    const u = new URL(apId);
    const m = u.pathname.match(/^\/post\/(\d+)/);
    if (!m) return null;
    return { instance: u.host, postId: parseInt(m[1], 10) };
  } catch { return null; }
}
