// src/lib/api/backends/lemmy/sources.ts
import type { SourceService } from '../../backend';
import type { Source, Session } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapSource } from './mappers';

export function createSourceService(session: Session): SourceService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async get(handle): Promise<Source> {
      const res = await client().getCommunity({ name: handle });
      return mapSource(res.community_view.community, res.community_view.counts as any, res.community_view.subscribed);
    },
    async subscribe(sourceId, sub): Promise<void> {
      if (!token) throw new Error('Subscribe requires login');
      await client().followCommunity({ community_id: parseInt(sourceId, 10), follow: sub });
    },
    async block(sourceId, block): Promise<void> {
      if (!token) throw new Error('Block requires login');
      await client().blockCommunity({ community_id: parseInt(sourceId, 10), block });
    },
  };
}
