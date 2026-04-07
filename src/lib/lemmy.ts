import { LemmyHttp, type PostView, type CommentView, type SortType, type CommentReplyView, type PersonMentionView } from 'lemmy-js-client';

export type { PostView, CommentView, SortType, CommentReplyView, PersonMentionView };

export type NotifItem =
  | { type: 'reply'; data: CommentReplyView }
  | { type: 'mention'; data: PersonMentionView };

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
  sort: SortType = 'TopTwelveHour',
): Promise<PostView[]> {
  const res = await client(instance, token).getPosts({
    type_: 'All',
    sort,
    page,
    limit: 10,
  });
  return res.posts;
}

export async function fetchCommunityPosts(
  instance: string,
  token: string,
  communityRef: string,
  page: number,
  sort: SortType = 'Active',
): Promise<PostView[]> {
  const res = await client(instance, token).getPosts({
    community_name: communityRef,
    sort,
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

export async function fetchSavedPosts(
  instance: string,
  token: string,
  page: number,
): Promise<PostView[]> {
  const res = await client(instance, token).getPosts({
    saved_only: true,
    sort: 'New',
    page,
    limit: 20,
  });
  return res.posts;
}

export async function fetchPost(instance: string, postId: number): Promise<PostView> {
  const res = await client(instance).getPost({ id: postId });
  return res.post_view;
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

export async function editComment(
  instance: string,
  token: string,
  commentId: number,
  content: string,
): Promise<CommentView> {
  const res = await client(instance, token).editComment({
    comment_id: commentId,
    content,
  });
  return res.comment_view;
}

export async function fetchUnreadCount(instance: string, token: string): Promise<number> {
  const res = await client(instance, token).getUnreadCount();
  // private_messages excluded — not surfaced in this inbox UI
  return res.replies + res.mentions;
}

export async function fetchReplies(
  instance: string,
  token: string,
  unreadOnly: boolean,
): Promise<CommentReplyView[]> {
  const res = await client(instance, token).getReplies({
    sort: 'New',
    unread_only: unreadOnly,
    limit: 50,
  });
  return res.replies;
}

export async function fetchMentions(
  instance: string,
  token: string,
  unreadOnly: boolean,
): Promise<PersonMentionView[]> {
  const res = await client(instance, token).getPersonMentions({
    sort: 'New',
    unread_only: unreadOnly,
    limit: 50,
  });
  return res.mentions;
}

export async function markReplyAsRead(instance: string, token: string, replyId: number): Promise<void> {
  await client(instance, token).markCommentReplyAsRead({ comment_reply_id: replyId, read: true });
}

export async function markMentionAsRead(instance: string, token: string, mentionId: number): Promise<void> {
  await client(instance, token).markPersonMentionAsRead({ person_mention_id: mentionId, read: true });
}

export async function fetchPersonDetails(
  instance: string,
  token: string | undefined,
  username: string,
  page: number,
): Promise<{ posts: PostView[]; comments: CommentView[] }> {
  const res = await client(instance, token).getPersonDetails({
    username,
    sort: 'New',
    page,
    limit: 20,
  });
  return { posts: res.posts, comments: res.comments };
}

export async function resolveCommunityId(
  instance: string,
  token: string,
  communityRef: string,
): Promise<number> {
  const res = await client(instance, token).getCommunity({ name: communityRef });
  return res.community_view.community.id;
}

export async function createPost(
  instance: string,
  token: string,
  params: { name: string; community_id: number; url?: string; body?: string },
): Promise<void> {
  await client(instance, token).createPost(params);
}

export async function uploadImage(
  instance: string,
  token: string,
  file: File,
): Promise<string> {
  const formData = new FormData();
  formData.append('images[]', file);
  const res = await fetch(`https://${instance}/pictrs/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json() as { files?: { file: string }[] };
  if (!data.files?.[0]?.file) throw new Error('Upload failed: no file returned');
  return `https://${instance}/pictrs/image/${data.files[0].file}`;
}
