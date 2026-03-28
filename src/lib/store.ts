const KEYS = {
  TOKEN: 'stakswipe_token',
  INSTANCE: 'stakswipe_instance',
  USERNAME: 'stakswipe_username',
} as const;

export interface AuthState {
  token: string;
  instance: string;
  username: string;
}

export function saveAuth(auth: AuthState): void {
  localStorage.setItem(KEYS.TOKEN, auth.token);
  localStorage.setItem(KEYS.INSTANCE, auth.instance);
  localStorage.setItem(KEYS.USERNAME, auth.username);
}

export function loadAuth(): AuthState | null {
  const token = localStorage.getItem(KEYS.TOKEN);
  const instance = localStorage.getItem(KEYS.INSTANCE);
  const username = localStorage.getItem(KEYS.USERNAME);
  if (!token || !instance || !username) return null;
  return { token, instance, username };
}

export function clearAuth(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}

const SEEN_KEY = 'stakswipe_seen';
const MAX_SEEN = 200;

export function loadSeen(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function addSeen(id: number): void {
  let arr: number[] = [];
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    }
  } catch {
    // start fresh if corrupted
  }
  if (!arr.includes(id)) {
    arr.push(id);
  }
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr.slice(-MAX_SEEN)));
}

export function clearSeen(): void {
  localStorage.removeItem(SEEN_KEY);
}
