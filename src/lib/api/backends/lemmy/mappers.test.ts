// src/lib/api/backends/lemmy/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { mapPost, mapComment, mapUser, mapSource, parsePostId } from './mappers';
import type { PostView, CommentView, Person, CommunityView } from 'lemmy-js-client';

const samplePerson: Person = {
  id: 1, name: 'alice', display_name: 'Alice', avatar: 'https://lemmy.world/a.png',
  banned: false, published: '2026-01-01T00:00:00Z', actor_id: 'https://lemmy.world/u/alice',
  local: true, deleted: false, admin: false, bot_account: false, instance_id: 1,
} as Person;

const sampleCommunity: any = {
  community: {
    id: 10, name: 'news', title: 'News', actor_id: 'https://lemmy.world/c/news',
    local: true, deleted: false, removed: false, hidden: false, posting_restricted_to_mods: false,
    published: '2026-01-01T00:00:00Z', instance_id: 1, nsfw: false,
  },
  subscribed: 'NotSubscribed',
  blocked: false,
  counts: { id: 1, community_id: 10, subscribers: 5, posts: 3, comments: 7, published: '', users_active_day: 0, users_active_week: 0, users_active_month: 0, users_active_half_year: 0, hot_rank: 0 },
};

describe('mapPost', () => {
  it('maps a PostView to a neutral Post', () => {
    const pv: any = {
      post: {
        id: 42, name: 'hello', body: 'world', url: 'https://example.com/x',
        thumbnail_url: 'https://example.com/t.png', nsfw: false,
        ap_id: 'https://lemmy.world/post/42', published: '2026-02-01T00:00:00Z',
        creator_id: 1, community_id: 10, local: true, deleted: false, removed: false,
        locked: false, featured_community: false, featured_local: false, language_id: 0,
      },
      creator: samplePerson,
      community: sampleCommunity.community,
      creator_banned_from_community: false,
      creator_is_moderator: false,
      creator_is_admin: false,
      subscribed: 'NotSubscribed',
      saved: false,
      read: false,
      creator_blocked: false,
      counts: { id: 1, post_id: 42, comments: 3, score: 11, upvotes: 12, downvotes: 1,
        published: '', newest_comment_time_necro: '', newest_comment_time: '',
        featured_community: false, featured_local: false, hot_rank: 0, hot_rank_active: 0,
        controversy_rank: 0, scaled_rank: 0 },
      unread_comments: 0,
      my_vote: 1,
    };
    const post = mapPost(pv);
    expect(post.id).toBe('42|https://lemmy.world/post/42');
    expect(post.title).toBe('hello');
    expect(post.body).toBe('world');
    expect(post.externalUrl).toBe('https://example.com/x');
    expect(post.mediaUrl).toBe('https://example.com/t.png');
    expect(post.permalink).toBe('https://lemmy.world/post/42');
    expect(post.counts).toEqual({ score: 11, comments: 3 });
    expect(post.viewer?.vote).toBe(1);
    expect(post.viewer?.saved).toBe(false);
    expect(post.author.handle).toBe('alice@lemmy.world');
    expect(post.source.handle).toBe('news@lemmy.world');
  });
});

describe('parsePostId', () => {
  it('round-trips the encoded id', () => {
    const parsed = parsePostId('42|https://lemmy.world/post/42');
    expect(parsed).toEqual({ localId: 42, apId: 'https://lemmy.world/post/42' });
  });
});
