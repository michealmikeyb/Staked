import { LemmyHttp } from 'lemmy-js-client';
import type { RawPost, RawComment, MissRecord, SortType } from './types.js';

const TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

function client(instance: string): LemmyHttp {
  return new LemmyHttp(`https://${instance}`);
}

export async function fetchPostsPage(
  instance: string,
  sort: SortType,
  page: number,
): Promise<{ posts: RawPost[]; error?: string }> {
  try {
    const res = await withTimeout(
      client(instance).getPosts({
        type_: 'All',
        sort: sort as import('lemmy-js-client').SortType,
        page,
        limit: 10,
      }),
      TIMEOUT_MS
    );
    const posts: RawPost[] = res.posts
      .filter((pv) => pv.post?.ap_id != null && pv.counts != null)
      .map((pv) => ({
        id: pv.post.id,
        ap_id: pv.post.ap_id,
        upvotes: pv.counts.upvotes ?? 0,
        downvotes: pv.counts.downvotes ?? 0,
        published: pv.post.published,
      }));
    return { posts };
  } catch (err) {
    return { posts: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchPostComments(
  instance: string,
  postId: number,
  postApId: string,
): Promise<{ comments: RawComment[]; error?: string }> {
  try {
    const res = await withTimeout(
      client(instance).getComments({
        post_id: postId,
        sort: 'Top',
        limit: 50,
      }),
      TIMEOUT_MS
    );
    const comments: RawComment[] = res.comments
      .filter((cv) => cv.counts != null)
      .map((cv) => ({
        postApId,
        upvotes: cv.counts.upvotes ?? 0,
        downvotes: cv.counts.downvotes ?? 0,
      }));
    return { comments };
  } catch (err) {
    return { comments: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function resolveLocalPostId(
  instance: string,
  apId: string,
): Promise<number | null> {
  try {
    const res = await withTimeout(
      client(instance).resolveObject({ q: apId }),
      TIMEOUT_MS
    );
    return res.post?.post.id ?? null;
  } catch {
    return null;
  }
}
