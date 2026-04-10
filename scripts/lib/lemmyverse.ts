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
  const res = await fetch('https://lemmyverse.net/data/lemmy.min.json');
  if (!res.ok) throw new Error(`lemmyverse.net returned ${res.status}`);
  const data = (await res.json()) as LemmyverseInstance[];
  return filterTopInstances(data, n);
}
