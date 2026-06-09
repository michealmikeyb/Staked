// src/lib/api/capabilities.ts
import type { SelectOption } from './types';

export interface Capabilities {
  canDownvote: boolean;
  canBrowseAnonymously: boolean;
  hasNsfwFlag: boolean;
  hasSavedPosts: boolean;
  feedOptions: SelectOption[];
  commentSortOptions: SelectOption[];
  sourceNoun: string;
}
