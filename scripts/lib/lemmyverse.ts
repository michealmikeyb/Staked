export interface LemmyverseInstance {
  baseurl: string;
  users: { month: number };
  isSuspicious: boolean;
}

export function filterTopInstances(
  instances: LemmyverseInstance[],
  n: number,
): string[] {
  return instances
    .filter((i) => !i.isSuspicious && i.users.month > 0)
    .sort((a, b) => b.users.month - a.users.month)
    .slice(0, n)
    .map((i) => i.baseurl);
}

export async function fetchTopInstances(n: number): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://lemmyverse.net/data/lemmy.min.json', {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`lemmyverse.net returned ${res.status}`);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error('lemmyverse.net response is not an array');
    return filterTopInstances(data as LemmyverseInstance[], n);
  } finally {
    clearTimeout(timer);
  }
}
