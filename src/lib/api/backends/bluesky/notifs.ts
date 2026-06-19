// src/lib/api/backends/bluesky/notifs.ts
import type { NotificationService } from '../../backend';
import type { Comment, Notification, NotificationKind, Page } from '../../types';
import { encodeBlueskyId, mapUser, rkeyOf } from './mappers';

const PAGE_SIZE = 40;

// Bluesky reasons collapse onto the app's notification kinds. Reasons we don't
// recognise fall through to 'mention' so they still appear (and stay consistent
// with the unread badge, which counts every type).
const KIND_BY_REASON: Record<string, NotificationKind> = {
  reply: 'reply',
  mention: 'mention',
  quote: 'mention',
  like: 'like',
  'like-via-repost': 'like',
  repost: 'repost',
  'repost-via-repost': 'repost',
  follow: 'follow',
};

function didOf(atUri: string): string {
  // at://<did>/app.bsky.feed.post/<rkey>
  return atUri.split('/')[2] ?? '';
}

// Builds the neutral Notification from a Bluesky listNotifications entry. The
// notifying record (uri/cid/record) becomes the comment for replies/mentions;
// reasonSubject is the post it concerns (we have its uri but not its cid, so
// the post id carries an empty cid — posts.get only needs the uri). Likes,
// reposts, and follows have no comment; follows have no post.
export function mapNotification(n: any): Notification {
  const actor = mapUser(n.author);
  const kind = KIND_BY_REASON[n.reason] ?? 'mention';
  const subjectUri: string = n.reasonSubject ?? '';
  const post = subjectUri
    ? {
        id: encodeBlueskyId(subjectUri, ''),
        title: '',
        permalink: `https://bsky.app/profile/${didOf(subjectUri)}/post/${rkeyOf(subjectUri)}`,
      }
    : undefined;

  const base = {
    id: encodeBlueskyId(n.uri, n.cid),
    kind,
    read: !!n.isRead,
    receivedAt: n.indexedAt,
    actor,
  };

  if (kind === 'reply' || kind === 'mention') {
    const record = n.record ?? {};
    const comment: Comment = {
      id: encodeBlueskyId(n.uri, n.cid),
      postId: post?.id ?? encodeBlueskyId(subjectUri, ''),
      parentId: record.reply?.parent?.uri ?? null,
      depth: 0,
      author: actor,
      body: record.text ?? '',
      publishedAt: record.createdAt ?? n.indexedAt,
      permalink: `https://bsky.app/profile/${n.author.handle}/post/${rkeyOf(n.uri)}`,
      counts: { score: 0 },
      viewer: { vote: 0 },
    };
    return { ...base, comment, post };
  }

  return { ...base, post };
}

export function createNotificationService(getAgent: () => any): NotificationService {
  return {
    async unreadCount(): Promise<number> {
      const res = await getAgent().countUnreadNotifications();
      return res.data?.count ?? 0;
    },

    async list(opts): Promise<Page<Notification>> {
      const res = await getAgent().listNotifications({
        cursor: opts.cursor ?? undefined,
        limit: PAGE_SIZE,
      });
      const raw = (res.data.notifications as any[]) ?? [];
      const filtered = opts.unreadOnly ? raw.filter((n) => !n.isRead) : raw;
      return { items: filtered.map(mapNotification), nextCursor: res.data.cursor ?? null };
    },

    // Bluesky tracks read state by a single "seen" timestamp, not per item, so
    // viewing any notification marks everything up to now as seen.
    async markRead(): Promise<void> {
      await getAgent().updateSeenNotifications(new Date().toISOString());
    },
  };
}
