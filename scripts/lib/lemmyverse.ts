export interface LemmyverseInstance {
  baseurl: string;
  usage?: { users?: { activeMonth?: number } };
  isSuspicious?: boolean;
}

export function filterTopInstances(
  instances: LemmyverseInstance[],
  n: number,
): string[] {
  return instances
    .filter((i) => !i.isSuspicious && (i.usage?.users?.activeMonth ?? 0) > 0)
    .sort((a, b) => (b.usage?.users?.activeMonth ?? 0) - (a.usage?.users?.activeMonth ?? 0))
    .slice(0, n)
    .map((i) => i.baseurl);
}

export async function fetchTopInstances(n: number): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://lemmyverse.net/data/instance.full.json', {
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
