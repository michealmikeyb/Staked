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
