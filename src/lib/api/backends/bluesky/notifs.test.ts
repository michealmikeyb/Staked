import { describe, it, expect, vi } from 'vitest';
import { createNotificationService, mapNotification } from './notifs';

const replyNotif = {
  uri: 'at://did:plc:bob/app.bsky.feed.post/reply1',
  cid: 'rc',
  author: { did: 'did:plc:bob', handle: 'bob.bsky.social', displayName: 'Bob' },
  reason: 'reply',
  reasonSubject: 'at://did:plc:me/app.bsky.feed.post/orig',
  record: { text: 'nice post', createdAt: '2026-02-01T00:00:00Z', reply: { parent: { uri: 'at://did:plc:me/app.bsky.feed.post/orig', cid: 'oc' } } },
  isRead: false,
  indexedAt: '2026-02-01T00:01:00Z',
};

describe('mapNotification', () => {
  it('maps a reply notification to a neutral notification', () => {
    const n = mapNotification(replyNotif);
    expect(n.kind).toBe('reply');
    expect(n.read).toBe(false);
    expect(n.actor.handle).toBe('bob.bsky.social');
    expect(n.comment?.body).toBe('nice post');
    expect(n.comment?.author.handle).toBe('bob.bsky.social');
    expect(n.comment?.postId).toBe('at://did:plc:me/app.bsky.feed.post/orig|');
    expect(n.post?.id).toBe('at://did:plc:me/app.bsky.feed.post/orig|');
    expect(n.post?.permalink).toBe('https://bsky.app/profile/did:plc:me/post/orig');
    expect(n.comment?.permalink).toBe('https://bsky.app/profile/bob.bsky.social/post/reply1');
  });

  it('maps a mention notification kind', () => {
    expect(mapNotification({ ...replyNotif, reason: 'mention' }).kind).toBe('mention');
    expect(mapNotification({ ...replyNotif, reason: 'quote' }).kind).toBe('mention');
  });

  it('maps a like notification with a post but no comment', () => {
    const n = mapNotification({ ...replyNotif, reason: 'like', record: {} });
    expect(n.kind).toBe('like');
    expect(n.comment).toBeUndefined();
    expect(n.actor.handle).toBe('bob.bsky.social');
    expect(n.post?.id).toBe('at://did:plc:me/app.bsky.feed.post/orig|');
  });

  it('maps a repost notification kind', () => {
    expect(mapNotification({ ...replyNotif, reason: 'repost', record: {} }).kind).toBe('repost');
  });

  it('maps a follow notification with no post and no comment', () => {
    const n = mapNotification({
      uri: 'at://did:plc:bob/app.bsky.graph.follow/f1', cid: 'fc',
      author: { did: 'did:plc:bob', handle: 'bob.bsky.social' },
      reason: 'follow', record: {}, isRead: false, indexedAt: '2026-02-01T00:01:00Z',
    });
    expect(n.kind).toBe('follow');
    expect(n.post).toBeUndefined();
    expect(n.comment).toBeUndefined();
    expect(n.actor.handle).toBe('bob.bsky.social');
  });
});

describe('bluesky NotificationService', () => {
  it('unreadCount reads the count', async () => {
    const countUnreadNotifications = vi.fn().mockResolvedValue({ data: { count: 7 } });
    const svc = createNotificationService(() => ({ countUnreadNotifications }));
    expect(await svc.unreadCount()).toBe(7);
  });

  it('list fetches all reasons and maps every item', async () => {
    const followNotif = { uri: 'at://did:plc:bob/app.bsky.graph.follow/f1', cid: 'fc', author: { did: 'did:plc:bob', handle: 'bob.bsky.social' }, reason: 'follow', record: {}, isRead: false, indexedAt: '2026-02-01T00:02:00Z' };
    const listNotifications = vi.fn().mockResolvedValue({ data: { notifications: [replyNotif, followNotif], cursor: 'nc' } });
    const svc = createNotificationService(() => ({ listNotifications }));
    const page = await svc.list({ unreadOnly: false, cursor: null });
    expect(listNotifications).toHaveBeenCalledWith({ cursor: undefined, limit: 40 });
    expect(page.items.map((i) => i.kind)).toEqual(['reply', 'follow']);
    expect(page.nextCursor).toBe('nc');
  });

  it('list filters to unread when unreadOnly is set', async () => {
    const listNotifications = vi.fn().mockResolvedValue({
      data: { notifications: [replyNotif, { ...replyNotif, uri: 'at://x/app.bsky.feed.post/2', isRead: true }], cursor: null },
    });
    const svc = createNotificationService(() => ({ listNotifications }));
    const page = await svc.list({ unreadOnly: true, cursor: null });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].read).toBe(false);
  });

  it('markRead updates the seen timestamp', async () => {
    const updateSeenNotifications = vi.fn().mockResolvedValue({});
    const svc = createNotificationService(() => ({ updateSeenNotifications }));
    await svc.markRead('any-id');
    expect(updateSeenNotifications).toHaveBeenCalledTimes(1);
    expect(typeof updateSeenNotifications.mock.calls[0][0]).toBe('string');
  });
});
