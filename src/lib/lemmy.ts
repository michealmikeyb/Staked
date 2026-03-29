import { LemmyHttp, type PostView, type CommentView } from 'lemmy-js-client';

export type { PostView, CommentView };

function client(instance: string): LemmyHttp {
  return new LemmyHttp(`https://${instance}`);
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
  const res = await client(instance).getPosts({
    type_: 'All',
    sort: 'TopTwelveHour',
    page,
    limit: 10,
    // @ts-expect-error legacy auth
    auth: token,
  });
  return res.posts;
}

async function votePost(instance: string, token: string, postId: number, score: 1 | -1): Promise<void> {
  // @ts-expect-error legacy auth
  await client(instance).likePost({ post_id: postId, score, auth: token });
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
  // @ts-expect-error legacy auth
  await client(instance).savePost({ post_id: postId, save: true, auth: token });
}

export async function fetchComments(
  instance: string,
  token: string,
  postId: number,
): Promise<CommentView[]> {
  const res = await client(instance).getComments({
    post_id: postId,
    sort: 'Top',
    limit: 50,
    // @ts-expect-error legacy auth
    auth: token,
  });
  return res.comments;
}

export async function resolvePostId(instance: string, apId: string): Promise<number | null> {
  const res = await client(instance).resolveObject({ q: apId });
  return res.post?.post.id ?? null;
}

export async function likeComment(
  instance: string,
  token: string,
  commentId: number,
  score: 1 | 0,
): Promise<void> {
  // @ts-expect-error legacy auth
  await client(instance).likeComment({ comment_id: commentId, score, auth: token });
}

export async function createComment(
  instance: string,
  token: string,
  postId: number,
  content: string,
  parentId?: number,
): Promise<CommentView> {
  const res = await client(instance).createComment({
    post_id: postId,
    content,
    parent_id: parentId,
    // @ts-expect-error legacy auth
    auth: token,
  });
  return res.comment_view;
}
