// src/lib/api/capabilities.ts
import type { FeedOption, SortOption } from './types';

export interface Capabilities {
  canDownvote: boolean;
  canBrowseAnonymously: boolean;
  hasNsfwFlag: boolean;
  hasSavedPosts: boolean;
  feedOptions: FeedOption[];
  commentSortOptions: SortOption[];
  sourceNoun: string;
}
