// src/lib/api/backends/bluesky/notifs.ts
import type { NotificationService } from '../../backend';
import type { Comment, Notification, Page } from '../../types';
import { encodeBlueskyId, mapUser, rkeyOf } from './mappers';

const PAGE_SIZE = 40;

// Reasons the app models. Bluesky has no separate "comment" entity — a reply is
// itself a post — so reply/mention/quote all surface as reply or mention.
const REASONS = ['reply', 'mention', 'quote'];

function didOf(atUri: string): string {
  // at://<did>/app.bsky.feed.post/<rkey>
  return atUri.split('/')[2] ?? '';
}

// Builds the neutral Notification from a Bluesky listNotifications entry. The
// notifying record (uri/cid/record) becomes the comment; reasonSubject is the
// post it concerns (we have its uri but not its cid, so the post id carries an
// empty cid — posts.get only needs the uri).
export function mapNotification(n: any): Notification {
  const record = n.record ?? {};
  const author = mapUser(n.author);
  const subjectUri: string = n.reasonSubject ?? '';
  const postId = encodeBlueskyId(subjectUri, '');
  const comment: Comment = {
    id: encodeBlueskyId(n.uri, n.cid),
    postId,
    parentId: record.reply?.parent?.uri ?? null,
    depth: 0,
    author,
    body: record.text ?? '',
    publishedAt: record.createdAt ?? n.indexedAt,
    permalink: `https://bsky.app/profile/${n.author.handle}/post/${rkeyOf(n.uri)}`,
    counts: { score: 0 },
    viewer: { vote: 0 },
  };
  return {
    id: encodeBlueskyId(n.uri, n.cid),
    kind: n.reason === 'reply' ? 'reply' : 'mention',
    read: !!n.isRead,
    receivedAt: n.indexedAt,
    comment,
    post: {
      id: postId,
      title: '',
      permalink: subjectUri
        ? `https://bsky.app/profile/${didOf(subjectUri)}/post/${rkeyOf(subjectUri)}`
        : '',
    },
  };
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
        reasons: REASONS,
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
