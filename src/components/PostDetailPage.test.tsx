import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostDetailPage from './PostDetailPage';

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: () => ({
    comments: [
      {
        comment: { id: 5, content: 'Nice post!', path: '0.5', ap_id: 'https://lemmy.world/comment/5' },
        creator: { name: 'alice', display_name: null },
        counts: { score: 1 },
      },
    ],
    commentsLoaded: true,
    resolvedInstanceRef: { current: 'lemmy.world' },
    resolvedTokenRef: { current: 'tok' },
  }),
}));

vi.mock('../lib/lemmy', () => ({
  markReplyAsRead: vi.fn().mockResolvedValue(undefined),
  markMentionAsRead: vi.fn().mockResolvedValue(undefined),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'new', path: '0.5.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me' },
    counts: { score: 0 },
  }),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

vi.mock('./CommentList', () => ({
  default: ({ highlightCommentId }: { highlightCommentId?: number }) => (
    <div data-testid="comment-list" data-highlight={highlightCommentId} />
  ),
}));

vi.mock('./ReplySheet', () => ({ default: () => null }));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };
const mockSetUnreadCount = vi.fn();

const notificationState = {
  type: 'reply' as const,
  data: {
    comment_reply: { id: 10, read: false, published: '2026-03-29T10:00:00Z' },
    comment: {
      id: 5, content: 'Nice post!', path: '0.5',
      ap_id: 'https://lemmy.world/comment/5',
    },
    post: {
      id: 1, name: 'Best programming languages for 2025?',
      ap_id: 'https://lemmy.world/post/1',
      url: null, body: null, thumbnail_url: null,
    },
    community: { id: 1, name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
    creator: { id: 2, name: 'alice', display_name: null, actor_id: 'https://lemmy.world/u/alice' },
    counts: { score: 5, comments: 12 },
  },
};

function renderDetail(state = notificationState) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/inbox/reply-10', state: { notification: state } }]}>
      <Routes>
        <Route
          path="/inbox/:notifId"
          element={<PostDetailPage auth={mockAuth} setUnreadCount={mockSetUnreadCount} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PostDetailPage', () => {
  it('renders post title', () => {
    renderDetail();
    expect(screen.getByText('Best programming languages for 2025?')).toBeInTheDocument();
  });

  it('passes correct highlightCommentId to CommentList', () => {
    renderDetail();
    expect(screen.getByTestId('comment-list')).toHaveAttribute('data-highlight', '5');
  });

  it('calls markReplyAsRead on mount for reply notification', async () => {
    const { markReplyAsRead } = await import('../lib/lemmy');
    renderDetail();
    await waitFor(() => expect(markReplyAsRead).toHaveBeenCalledWith('lemmy.world', 'tok', 10));
  });

  it('shows "No notification data" if router state is missing', () => {
    render(
      <MemoryRouter initialEntries={['/inbox/reply-10']}>
        <Routes>
          <Route
            path="/inbox/:notifId"
            element={<PostDetailPage auth={mockAuth} setUnreadCount={mockSetUnreadCount} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/navigate to inbox/i)).toBeInTheDocument();
  });
});
