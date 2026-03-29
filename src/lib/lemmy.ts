import { LemmyHttp, type PostView, type CommentView } from 'lemmy-js-client';

export type { PostView, CommentView };

function client(instance: string, token?: string): LemmyHttp {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return new LemmyHttp(`https://${instance}`, { headers });
}

export async function login(
  instance: string,
  usernameOrEmail: string,
  password: string,
): Promise<string> {
  const res = await client(instance).login({ username_or_email: usernameOrEmail, password });
  if (!res.jwt) throw new Error('Login failed: no token returned');
  return res.jwt;
}

export async function fetchPosts(
  instance: string,
  token: string,
  page: number,
): Promise<PostView[]> {
  const res = await client(instance, token).getPosts({
    type_: 'All',
    sort: 'TopTwelveHour',
    page,
    limit: 10,
  });
  return res.posts;
}

async function votePost(instance: string, token: string, postId: number, score: 1 | -1): Promise<void> {
  await client(instance, token).likePost({ post_id: postId, score });
}

export async function upvotePost(instance: string, token: string, postId: number): Promise<void> {
  return votePost(instance, token, postId, 1);
}

export async function downvotePost(instance: string, token: string, postId: number): Promise<void> {
  return votePost(instance, token, postId, -1);
}

export async function savePost(
  instance: string,
  token: string,
  postId: number,
): Promise<void> {
  await client(instance, token).savePost({ post_id: postId, save: true });
}

export async function fetchComments(
  instance: string,
  token: string,
  postId: number,
): Promise<CommentView[]> {
  const res = await client(instance, token).getComments({
    post_id: postId,
    sort: 'Top',
    limit: 50,
  });
  return res.comments;
}

export async function resolvePostId(instance: string, apId: string): Promise<number | null> {
  const res = await client(instance).resolveObject({ q: apId });
  return res.post?.post.id ?? null;
}

export async function resolveCommentId(instance: string, token: string, apId: string): Promise<number | null> {
  const res = await client(instance, token).resolveObject({ q: apId });
  return res.comment?.comment.id ?? null;
}

export async function likeComment(
  instance: string,
  token: string,
  commentId: number,
  score: 1 | 0,
): Promise<void> {
  await client(instance, token).likeComment({ comment_id: commentId, score });
}

export async function createComment(
  instance: string,
  token: string,
  postId: number,
  content: string,
  parentId?: number,
): Promise<CommentView> {
  const res = await client(instance, token).createComment({
    post_id: postId,
    content,
    parent_id: parentId,
  });
  return res.comment_view;
}
