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

export function getShareUrl(instance: string, postId: number): string {
  const base = import.meta.env.VITE_BASE_URL ?? 'https://stakswipe.com';
  return `${base}/#/post/${instance}/${postId}`;
}

export function parsePostUrl(query: string): { instance: string; postId: number } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Stakswipe share URL: https://stakswipe.com/#/post/lemmy.world/2395953
  const stakswiperMatch = trimmed.match(/#\/post\/([^/]+)\/(\d+)/);
  if (stakswiperMatch) {
    const postId = parseInt(stakswiperMatch[2], 10);
    return isNaN(postId) ? null : { instance: stakswiperMatch[1], postId };
  }

  // Lemmy post URL: https://lemmy.world/post/2395953 or lemmy.world/post/2395953
  try {
    const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    const parts = url.pathname.split('/');
    if (parts.length === 3 && parts[1] === 'post') {
      const postId = parseInt(parts[2], 10);
      return isNaN(postId) ? null : { instance: url.hostname, postId };
    }
  } catch {
    // not a URL
  }

  return null;
}
