import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithBackend, makeNotification, makeComment } from '../test-utils';
import { createMockBackend } from '../lib/api/backends/mock';
import { BackendProvider } from '../lib/api/context';
import PostDetailPage from './PostDetailPage';

vi.mock('./PostDetailCard', () => ({
  default: ({ post }: { post: { name: string } }) => (
    <div data-testid="post-detail-card">{post.name}</div>
  ),
}));

const mockSetUnreadCount = vi.fn();

const NOTIF_POST = {
  id: '1',
  title: 'Best programming languages for 2025?',
  permalink: 'https://lemmy.world/post/1',
};

const REPLY_NOTIF = makeNotification({
  id: 'reply-10',
  kind: 'reply',
  comment: makeComment({ permalink: 'https://lemmy.world/comment/5' }),
  post: NOTIF_POST,
});

const MENTION_NOTIF = makeNotification({
  id: 'mention-20',
  kind: 'mention',
  comment: makeComment({ body: 'Mentioned you!', permalink: 'https://lemmy.world/comment/6' }),
  post: { id: '1', title: 'Post title', permalink: 'https://lemmy.world/post/1' },
});

function renderDetail(notif = REPLY_NOTIF) {
  return renderWithBackend(
    <MemoryRouter initialEntries={[{ pathname: '/inbox/reply-10', state: { notification: notif } }]}>
      <Routes>
        <Route
          path="/inbox/:notifId"
          element={<PostDetailPage setUnreadCount={mockSetUnreadCount} />}
        />
      </Routes>
    </MemoryRouter>,
    { fixtures: { notifications: [notif], unreadCount: 1 } },
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PostDetailPage', () => {
  it('renders post title', () => {
    renderDetail();
    expect(screen.getByText('Best programming languages for 2025?')).toBeInTheDocument();
  });

  it('calls backend.notifications.markRead on mount for reply notification', async () => {
    const backend = createMockBackend({ notifications: [REPLY_NOTIF], unreadCount: 1 });
    vi.spyOn(backend.notifications, 'markRead');
    render(
      <BackendProvider value={backend}>
        <MemoryRouter initialEntries={[{ pathname: '/inbox/reply-10', state: { notification: REPLY_NOTIF } }]}>
          <Routes>
            <Route path="/inbox/:notifId" element={<PostDetailPage setUnreadCount={mockSetUnreadCount} />} />
          </Routes>
        </MemoryRouter>
      </BackendProvider>,
    );
    await waitFor(() => expect(backend.notifications.markRead).toHaveBeenCalledWith('reply-10'));
  });

  it('shows "Navigate to Inbox" if router state is missing', () => {
    renderWithBackend(
      <MemoryRouter initialEntries={['/inbox/reply-10']}>
        <Routes>
          <Route path="/inbox/:notifId" element={<PostDetailPage setUnreadCount={mockSetUnreadCount} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/navigate to inbox/i)).toBeInTheDocument();
  });

  it('calls backend.notifications.markRead on mount for mention notification', async () => {
    const backend = createMockBackend({ notifications: [MENTION_NOTIF], unreadCount: 1 });
    vi.spyOn(backend.notifications, 'markRead');
    render(
      <BackendProvider value={backend}>
        <MemoryRouter initialEntries={[{ pathname: '/inbox/mention-20', state: { notification: MENTION_NOTIF } }]}>
          <Routes>
            <Route path="/inbox/:notifId" element={<PostDetailPage setUnreadCount={mockSetUnreadCount} />} />
          </Routes>
        </MemoryRouter>
      </BackendProvider>,
    );
    await waitFor(() => expect(backend.notifications.markRead).toHaveBeenCalledWith('mention-20'));
  });

  it('decrements unread count after marking as read', async () => {
    renderDetail();
    await waitFor(() => expect(mockSetUnreadCount).toHaveBeenCalled());
    const updater = mockSetUnreadCount.mock.calls[0][0];
    expect(updater(3)).toBe(2);
    expect(updater(0)).toBe(0);
  });
});
