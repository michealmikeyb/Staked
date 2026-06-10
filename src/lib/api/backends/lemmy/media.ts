// src/lib/api/backends/lemmy/media.ts
import type { MediaService } from '../../backend';
import type { Session } from '../../types';
import { getLemmySessionData } from './session';

export function createMediaService(session: Session): MediaService {
  const { instance, token } = getLemmySessionData(session);

  return {
    async uploadImage(file): Promise<{ url: string }> {
      if (!token) throw new Error('Upload requires login');
      const formData = new FormData();
      formData.append('images[]', file);
      const res = await fetch(`https://${instance}/pictrs/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json() as { files?: { file: string }[] };
      if (!data.files?.[0]?.file) throw new Error('Upload failed: no file returned');
      return { url: `https://${instance}/pictrs/image/${data.files[0].file}` };
    },
  };
}
