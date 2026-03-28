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

export async function upvotePost(
  instance: string,
  token: string,
  postId: number,
): Promise<void> {
  // @ts-expect-error legacy auth
  await client(instance).likePost({ post_id: postId, score: 1, auth: token });
}

export async function downvotePost(
  instance: string,
  token: string,
  postId: number,
): Promise<void> {
  // @ts-expect-error legacy auth
  await client(instance).likePost({ post_id: postId, score: -1, auth: token });
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
