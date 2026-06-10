// src/lib/api/backends/lemmy/notifs.ts
import type { NotificationService } from '../../backend';
import type { Notification, Page, Session } from '../../types';
import { makeLemmyClient } from './client';
import { getLemmySessionData } from './session';
import { mapReply, mapMention } from './mappers';

const PAGE_SIZE = 50;

function splitCursor(cursor: string | null): { rep: number; men: number } {
  if (!cursor) return { rep: 1, men: 1 };
  const [r, m] = cursor.split('|');
  return { rep: parseInt(r, 10) || 1, men: parseInt(m, 10) || 1 };
}

export function createNotificationService(session: Session): NotificationService {
  const { instance, token } = getLemmySessionData(session);
  const client = () => makeLemmyClient(instance, token ?? undefined);

  return {
    async unreadCount(): Promise<number> {
      if (!token) return 0;
      const res = await client().getUnreadCount();
      return res.replies + res.mentions;
    },
    async list(opts): Promise<Page<Notification>> {
      if (!token) return { items: [], nextCursor: null };
      const { rep, men } = splitCursor(opts.cursor);
      const [repliesRes, mentionsRes] = await Promise.all([
        client().getReplies({ sort: 'New', unread_only: opts.unreadOnly, page: rep, limit: PAGE_SIZE }),
        client().getPersonMentions({ sort: 'New', unread_only: opts.unreadOnly, page: men, limit: PAGE_SIZE }),
      ]);
      const replies = repliesRes.replies.map(mapReply);
      const mentions = mentionsRes.mentions.map(mapMention);
      const items = [...replies, ...mentions].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      const repNext = replies.length < PAGE_SIZE ? null : rep + 1;
      const menNext = mentions.length < PAGE_SIZE ? null : men + 1;
      const nextCursor = repNext == null && menNext == null
        ? null
        : `${repNext ?? rep}|${menNext ?? men}`;
      return { items, nextCursor };
    },
    async markRead(notificationId): Promise<void> {
      if (!token) throw new Error('Mark-read requires login');
      const [kind, idStr] = notificationId.split('-');
      const id = parseInt(idStr, 10);
      if (kind === 'reply') {
        await client().markCommentReplyAsRead({ comment_reply_id: id, read: true });
      } else if (kind === 'mention') {
        await client().markPersonMentionAsRead({ person_mention_id: id, read: true });
      }
    },
  };
}
