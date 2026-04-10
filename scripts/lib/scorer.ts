import type { InstanceRawData, InstanceScore } from './types.js';

const WEIGHTS = {
  posts: 0.40,
  comments: 0.35,
  postVotes: 0.15,
  commentVotes: 0.10,
};

export function scoreInstances(
  instanceData: InstanceRawData[],
  universe: Set<string>,
): InstanceScore[] {
  const raw = instanceData.map((data) => {
    const postsVisible = data.posts.filter((p) => universe.has(p.ap_id)).length;
    const postAbsoluteVotes = data.posts.reduce(
      (sum, p) => sum + p.upvotes + p.downvotes, 0
    );
    const commentsVisible = data.comments.length;
    const commentAbsoluteVotes = data.comments.reduce(
      (sum, c) => sum + c.upvotes + c.downvotes, 0
    );
    return { instance: data.instance, postsVisible, postAbsoluteVotes, commentsVisible, commentAbsoluteVotes };
  });

  const maxPosts = Math.max(...raw.map((r) => r.postsVisible), 1);
  const maxPostVotes = Math.max(...raw.map((r) => r.postAbsoluteVotes), 1);
  const maxComments = Math.max(...raw.map((r) => r.commentsVisible), 1);
  const maxCommentVotes = Math.max(...raw.map((r) => r.commentAbsoluteVotes), 1);

  return raw
    .map((r) => ({
      instance: r.instance,
      score:
        WEIGHTS.posts * (r.postsVisible / maxPosts) +
        WEIGHTS.comments * (r.commentsVisible / maxComments) +
        WEIGHTS.postVotes * (r.postAbsoluteVotes / maxPostVotes) +
        WEIGHTS.commentVotes * (r.commentAbsoluteVotes / maxCommentVotes),
      postsVisible: r.postsVisible,
      postAbsoluteVotes: r.postAbsoluteVotes,
      commentsVisible: r.commentsVisible,
      commentAbsoluteVotes: r.commentAbsoluteVotes,
    }))
    .sort((a, b) => b.score - a.score);
}
