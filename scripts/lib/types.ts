export type SortType = 'Active' | 'Hot' | 'New' | 'TopSixHour' | 'TopTwelveHour' | 'TopDay';

export const SORT_TYPES: SortType[] = ['Active', 'Hot', 'New', 'TopSixHour', 'TopTwelveHour', 'TopDay'];

export interface RawPost {
  id: number;
  ap_id: string;
  upvotes: number;
  downvotes: number;
  published?: string; // ISO timestamp — used for threshold-based fetch stopping
}

export interface RawComment {
  postApId: string;
  upvotes: number;
  downvotes: number;
}

export interface MissRecord {
  instance: string;
  sortType: SortType;
  type: 'page-fetch' | 'comment-fetch';
  page?: number;
  postApId?: string;
  error: string;
}

export interface InstanceRawData {
  instance: string;
  sortType: SortType;
  posts: RawPost[];
  comments: RawComment[];
  misses: MissRecord[];
}

export interface InstanceScore {
  instance: string;
  score: number;
  postsVisible: number;
  postAbsoluteVotes: number;
  commentsVisible: number;
  commentAbsoluteVotes: number;
}

export interface Rankings {
  generatedAt: string;
  instancesChecked: string[];
  bySort: Record<string, InstanceScore[]>;
  recommended: Record<string, string>;
  misses: MissRecord[];
}
