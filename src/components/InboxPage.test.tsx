import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithBackend, makeNotification, makeComment, makeUser } from '../test-utils';
import InboxPage from './InboxPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSetUnreadCount = vi.fn();

const AUTHOR = makeUser({ handle: 'alice@lemmy.world', displayName: 'alice' });
const UNREAD_NOTIF = makeNotification({
  id: 'reply-10',
  kind: 'reply',
  read: false,
  receivedAt: '2026-03-29T10:00:00Z',
  comment: makeComment({ id: 'c-5', body: 'Nice post!', author: AUTHOR }),
  post: { id: '1', title: 'Best programming languages for 2025?', permalink: 'https://lemmy.world/post/1' },
});

function renderInbox(notifications = [UNREAD_NOTIF]) {
  return renderWithBackend(
    <MemoryRouter initialEntries={['/inbox']}>
      <InboxPage setUnreadCount={mockSetUnreadCount} unreadCount={0} />
    </MemoryRouter>,
    { fixtures: { notifications, unreadCount: notifications.filter((n) => !n.read).length } },
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('InboxPage', () => {
  it('renders notification items after loading', async () => {
    renderInbox();
    await waitFor(() =>
      expect(screen.getByText('Best programming languages for 2025?')).toBeInTheDocument(),
    );
    expect(screen.getByText('Nice post!')).toBeInTheDocument();
  });

  it('shows REPLY badge', async () => {
    renderInbox();
    await waitFor(() => expect(screen.getByText('REPLY')).toBeInTheDocument());
  });

  it('navigates to post detail on tap', async () => {
    renderInbox();
    await waitFor(() => screen.getByText('Nice post!'));
    fireEvent.click(screen.getByText('Nice post!'));
    expect(mockNavigate).toHaveBeenCalledWith('/inbox/reply-10', expect.any(Object));
  });

  it('refetches with unreadOnly=false when All is selected', async () => {
    const { backend } = renderInbox();
    await waitFor(() => screen.getByText('Nice post!'));
    const spy = vi.spyOn(backend.notifications, 'list');
    fireEvent.click(screen.getByText('All'));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ unreadOnly: false, cursor: null }),
    );
  });
});

describe('InboxPage unread dot', () => {
  it('shows unread dot for unread notification', async () => {
    renderInbox();
    await waitFor(() => screen.getByText('REPLY'));
    expect(screen.getByTestId('unread-dot')).toBeInTheDocument();
  });

  it('hides unread dot for read notification', async () => {
    const readNotif = makeNotification({
      id: 'reply-11',
      kind: 'reply',
      read: true,
      receivedAt: '2026-03-29T10:00:00Z',
      comment: makeComment({ body: 'Read notification', author: AUTHOR }),
      post: { id: '1', title: 'Test Post', permalink: 'https://lemmy.world/post/1' },
    });
    renderInbox([readNotif]);
    // Switch to all-notifications view so the read item appears
    fireEvent.click(screen.getByText('All'));
    await waitFor(() => screen.getByText('Read notification'));
    expect(screen.queryByTestId('unread-dot')).not.toBeInTheDocument();
  });
});
