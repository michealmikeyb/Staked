// src/lib/api/backend.ts
import type {
  ID, Vote, Session, User, Source, Post, Comment, Notification, Page, Stak,
} from './types';
import type { Capabilities } from './capabilities';

export interface AuthService {
  login(credentials: Record<string, string>): Promise<Session>;
  logout(): Promise<void>;
}

export interface FeedService {
  getTimeline(opts: { feedId: string; stakId: string; cursor: string | null }): Promise<Page<Post>>;
  getSourceFeed(sourceHandle: string, opts: { feedId: string; cursor: string | null }): Promise<Page<Post>>;
  getSavedPosts(opts: { cursor: string | null }): Promise<Page<Post>>;
}

export interface PostService {
  get(postId: ID): Promise<Post>;
  getByPermalink(url: string): Promise<Post | null>;
  vote(postId: ID, vote: Vote): Promise<void>;
  save(postId: ID, saved: boolean): Promise<void>;
  report(postId: ID, reason: string): Promise<void>;
  delete(postId: ID): Promise<void>;
  create(input: { sourceHandle: string; title?: string; body?: string; url?: string; nsfw?: boolean }): Promise<Post>;
}

export interface CommentService {
  list(postId: ID, opts: { sortId: string }): Promise<Comment[]>;
  vote(commentId: ID, vote: Vote): Promise<void>;
  create(input: { postId: ID; parentId?: ID; body: string }): Promise<Comment>;
  edit(commentId: ID, body: string): Promise<Comment>;
  delete(commentId: ID): Promise<void>;
  report(commentId: ID, reason: string): Promise<void>;
}

export interface SourceService {
  get(handle: string): Promise<Source>;
  subscribe(sourceId: ID, subscribe: boolean): Promise<void>;
  block(sourceId: ID, block: boolean): Promise<void>;
}

export interface UserService {
  get(handle: string): Promise<User>;
  getPosts(handle: string, opts: { cursor: string | null }): Promise<Page<Post>>;
  getComments(handle: string, opts: { cursor: string | null }): Promise<Page<Comment>>;
  block(userId: ID, block: boolean): Promise<void>;
}

export interface NotificationService {
  unreadCount(): Promise<number>;
  list(opts: { unreadOnly: boolean; cursor: string | null }): Promise<Page<Notification>>;
  markRead(notificationId: ID): Promise<void>;
}

export interface SearchService {
  posts(query: string, opts: { cursor: string | null }): Promise<Page<Post>>;
  sources(query: string, opts: { cursor: string | null }): Promise<Page<Source>>;
}

export interface MediaService {
  uploadImage(file: File): Promise<{ url: string }>;
}

export interface Backend {
  readonly backendId: string;
  readonly capabilities: Capabilities;
  readonly session: Session | null;

  listStaks(): Stak[];

  auth: AuthService;
  feed: FeedService;
  posts: PostService;
  comments: CommentService;
  sources: SourceService;
  users: UserService;
  notifications: NotificationService;
  search: SearchService;
  media: MediaService;
}
