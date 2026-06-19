import { describe, it, expect, vi } from 'vitest';
import { createMediaService } from './media';
import type { Session } from '../../types';

const session = {
  id: 'bluesky:a', backendId: 'bluesky', viewer: null,
  data: { service: 'https://bsky.social', did: 'did:plc:me', handle: 'a.bsky.social', accessJwt: '', refreshJwt: '', feeds: [] },
} as unknown as Session;

describe('bluesky MediaService', () => {
  it('uploads a blob and returns its getBlob URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' });
    const uploadBlob = vi.fn().mockResolvedValue({ data: { blob: { ref: { toString: () => 'bafyblobcid' } } } });
    const svc = createMediaService(() => ({ uploadBlob }), session);
    const { url } = await svc.uploadImage(file);
    expect(uploadBlob).toHaveBeenCalledWith(file, { encoding: 'image/png' });
    expect(url).toBe('https://bsky.social/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Ame&cid=bafyblobcid');
  });

  it('throws when no blob reference comes back', async () => {
    const file = new File([new Uint8Array([1])], 'x.png', { type: 'image/png' });
    const uploadBlob = vi.fn().mockResolvedValue({ data: {} });
    const svc = createMediaService(() => ({ uploadBlob }), session);
    await expect(svc.uploadImage(file)).rejects.toThrow();
  });
});
