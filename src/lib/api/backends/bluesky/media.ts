// src/lib/api/backends/bluesky/media.ts
import type { MediaService } from '../../backend';
import type { Session } from '../../types';
import { getBlueskySessionData } from './session';

// Bluesky stores images as blobs, not at public URLs. uploadBlob returns a blob
// reference (a CID); the blob is then fetchable from the PDS getBlob endpoint.
// We surface that endpoint URL so the create-post flow has something to embed.
export function createMediaService(getAgent: () => any, session: Session): MediaService {
  return {
    async uploadImage(file): Promise<{ url: string }> {
      const { service, did } = getBlueskySessionData(session);
      const res = await getAgent().uploadBlob(file, { encoding: file.type });
      const blob = res.data?.blob;
      const cid = blob?.ref?.toString?.() ?? blob?.ref?.$link ?? blob?.cid;
      if (!cid) throw new Error('Bluesky: upload returned no blob reference');
      const base = (service || 'https://bsky.social').replace(/\/$/, '');
      return { url: `${base}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}` };
    },
  };
}
