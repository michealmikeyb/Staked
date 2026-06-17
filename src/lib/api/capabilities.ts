// src/lib/api/capabilities.ts
import type { SelectOption } from './types';

export interface LoginField {
  key: string;                            // credential key passed to auth.login
  label: string;
  type: 'instance' | 'text' | 'password'; // 'instance' renders an InstanceInput
  required: boolean;
  placeholder?: string;
  suggestions?: string[];                 // e.g. popular instances
  autoCapitalize?: boolean;
}

export interface Capabilities {
  canDownvote: boolean;
  canBrowseAnonymously: boolean;
  hasNsfwFlag: boolean;
  hasSavedPosts: boolean;
  feedOptions: SelectOption[];
  commentSortOptions: SelectOption[];
  sourceNoun: string;
  displayName: string;
  icon?: string;
  loginFields: LoginField[];
}
