export function instanceFromActorId(actorId: string): string {
  try { return new URL(actorId).hostname; } catch { return ''; }
}

export function sourceFromApId(apId: string): { instance: string; postId: number } | null {
  try {
    const url = new URL(apId);
    const postId = parseInt(url.pathname.split('/').pop() ?? '', 10);
    return isNaN(postId) ? null : { instance: url.hostname, postId };
  } catch { return null; }
}

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|avif|bmp)(\?.*)?$/i;

export function isImageUrl(url: string): boolean {
  try { return IMAGE_EXT.test(new URL(url).pathname); } catch { return false; }
}
