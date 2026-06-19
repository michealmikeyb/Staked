// src/lib/api/backends/bluesky/likes.ts
// Shared like/unlike for any AT Protocol record (posts and comments are both
// app.bsky.feed.post records). A positive vote creates a like; anything else
// removes the existing like, resolved from the record's viewer state.
import { parseBlueskyId } from './mappers';
import type { Vote } from '../../types';

export async function setLike(agent: any, recordId: string, vote: Vote): Promise<void> {
  const { uri, cid } = parseBlueskyId(recordId);
  if (vote > 0) {
    await agent.like(uri, cid);
    return;
  }
  const res = await agent.getPosts({ uris: [uri] });
  const likeUri = res.data.posts?.[0]?.viewer?.like;
  if (likeUri) await agent.deleteLike(likeUri);
}
