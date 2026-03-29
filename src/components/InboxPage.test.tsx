import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InboxPage from './InboxPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  fetchReplies: vi.fn().mockResolvedValue([
    {
      comment_reply: { id: 10, read: false, published: '2026-03-29T10:00:00Z' },
      comment: { id: 5, content: 'Nice post!' },
      post: { id: 1, name: 'Best programming languages for 2025?' },
      community: { id: 1, name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
      creator: { id: 2, name: 'alice', display_name: null },
      counts: { score: 1 },
    },
  ]),
  fetchMentions: vi.fn().mockResolvedValue([]),
  fetchUnreadCount: vi.fn().mockResolvedValue(1),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };
const mockSetUnreadCount = vi.fn();

function renderInbox() {
  return render(
    <MemoryRouter initialEntries={['/inbox']}>
      <InboxPage auth={mockAuth} setUnreadCount={mockSetUnreadCount} />
    </MemoryRouter>,
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

  it('refetches with unread_only=false when All is selected', async () => {
    const { fetchReplies } = await import('../lib/lemmy');
    renderInbox();
    await waitFor(() => screen.getByText('Nice post!'));
    fireEvent.click(screen.getByText('All'));
    await waitFor(() =>
      expect(fetchReplies).toHaveBeenCalledWith('lemmy.world', 'tok', false),
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
    const { fetchReplies } = await import('../lib/lemmy');
    (fetchReplies as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        comment_reply: { id: 10, read: true, published: '2026-03-29T10:00:00Z' },
        comment: { id: 5, content: 'Read notification' },
        post: { id: 1, name: 'Test Post' },
        community: { id: 1, name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
        creator: { id: 2, name: 'alice', display_name: null },
        counts: { score: 1 },
      },
    ]);
    renderInbox();
    await waitFor(() => screen.getByText('Read notification'));
    expect(screen.queryByTestId('unread-dot')).not.toBeInTheDocument();
  });
});
