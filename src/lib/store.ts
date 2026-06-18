const SEEN_KEY = 'stakswipe_seen';
const MAX_SEEN = 200;

export function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

export function addSeen(id: string): void {
  const seen = loadSeen();
  if (seen.has(id)) return;
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id].slice(-MAX_SEEN)));
}

export function clearSeen(): void {
  localStorage.removeItem(SEEN_KEY);
}

export interface AppSettings {
  nonUpvoteSwipeAction: 'downvote' | 'dismiss';
  swapGestures: boolean;
  blurNsfw: boolean;
  defaultFeedId: string;
  defaultCommentSortId: string;
  showCommentSortBar: boolean;
  shareLinkFormat: 'stakswipe' | 'source' | 'home';
  lemmy: { anonInstance: string };
}

const SETTINGS_KEY = 'stakswipe_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  nonUpvoteSwipeAction: 'downvote',
  swapGestures: false,
  blurNsfw: true,
  defaultFeedId: 'TopTwelveHour',
  defaultCommentSortId: 'Top',
  showCommentSortBar: true,
  shareLinkFormat: 'stakswipe',
  lemmy: { anonInstance: '' },
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, lemmy: { ...DEFAULT_SETTINGS.lemmy } };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if ('leftSwipe' in parsed && !('nonUpvoteSwipeAction' in parsed)) {
      parsed.nonUpvoteSwipeAction = parsed.leftSwipe;
      delete parsed.leftSwipe;
    }
    if ('defaultSort' in parsed && !('defaultFeedId' in parsed)) {
      parsed.defaultFeedId = parsed.defaultSort;
    }
    if ('commentSort' in parsed && !('defaultCommentSortId' in parsed)) {
      parsed.defaultCommentSortId = parsed.commentSort;
    }
    if ('anonInstance' in parsed && !('lemmy' in parsed)) {
      parsed.lemmy = { anonInstance: parsed.anonInstance as string };
    }
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (!merged.lemmy || typeof merged.lemmy !== 'object') {
      merged.lemmy = { anonInstance: '' };
    } else {
      merged.lemmy = { ...DEFAULT_SETTINGS.lemmy, ...(merged.lemmy as Record<string, unknown>) };
    }
    return merged as AppSettings;
  } catch {
    return { ...DEFAULT_SETTINGS, lemmy: { ...DEFAULT_SETTINGS.lemmy } };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
