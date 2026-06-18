// src/lib/api/backends/bluesky/session.ts
import type { Session, Stak } from '../../types';
import { rkeyOf } from './mappers';

export const DISCOVER_FEED_URI =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';

export interface BlueskyFeed {
  id: string;    // 'following' | feed at-uri
  label: string;
}

export interface BlueskySessionData {
  service: string;
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  feeds: BlueskyFeed[];
}

export function getBlueskySessionData(session: Session): BlueskySessionData {
  return session.data as unknown as BlueskySessionData;
}

export function listBlueskyStaks(session: Session): Stak[] {
  return [{ sessionId: session.id, id: 'home', label: 'Home' }];
}

export function feedOptionsFromSession(session: Session): { id: string; label: string }[] {
  const feeds = getBlueskySessionData(session)?.feeds;
  if (feeds && feeds.length) return feeds.map((f) => ({ id: f.id, label: f.label }));
  return [{ id: 'following', label: 'Following' }];
}

export async function resolveFeeds(agent: any): Promise<BlueskyFeed[]> {
  const feeds: BlueskyFeed[] = [{ id: 'following', label: 'Following' }];
  try {
    const prefs = await agent.app.bsky.actor.getPreferences();
    const saved = (prefs.data.preferences as any[]).find(
      (p) => p.$type === 'app.bsky.actor.defs#savedFeedsPrefV2');
    const pinnedUris: string[] = (saved?.items ?? [])
      .filter((it: any) => it.pinned && it.type === 'feed')
      .map((it: any) => it.value as string);
    if (pinnedUris.length) {
      const gens = await agent.app.bsky.feed.getFeedGenerators({ feeds: pinnedUris });
      const nameByUri = new Map<string, string>(
        (gens.data.feeds as any[]).map((g) => [g.uri, g.displayName as string]));
      for (const uri of pinnedUris) {
        feeds.push({ id: uri, label: nameByUri.get(uri) ?? rkeyOf(uri) });
      }
    }
  } catch {
    feeds.push({ id: DISCOVER_FEED_URI, label: 'Discover' });
    return feeds;
  }
  if (!feeds.some((f) => f.id.includes('/app.bsky.feed.generator/'))) {
    feeds.push({ id: DISCOVER_FEED_URI, label: 'Discover' });
  }
  return feeds;
}
