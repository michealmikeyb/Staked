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

const PLACEHOLDER_COLORS = ['#1a2a3a', '#2a1a3a', '#1a3a2a', '#3a2a1a', '#2a3a1a', '#3a1a2a'];

export function placeholderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PLACEHOLDER_COLORS[Math.abs(hash) % PLACEHOLDER_COLORS.length];
}

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|avif|bmp)(\?.*)?$/i;

export function isImageUrl(url: string): boolean {
  try { return IMAGE_EXT.test(new URL(url).pathname); } catch { return false; }
}
