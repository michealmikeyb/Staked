import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostViewPage from './PostViewPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  fetchPost: vi.fn(),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: () => ({
    comments: [],
    commentsLoaded: true,
    resolvedInstanceRef: { current: '' },
    resolvedTokenRef: { current: '' },
  }),
}));

vi.mock('./CommentList', () => ({
  default: ({ highlightCommentId }: { highlightCommentId?: number }) => (
    <div data-testid="comment-list" data-highlight={highlightCommentId} />
  ),
}));

vi.mock('./ReplySheet', () => ({ default: () => null }));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockPostView = {
  post: {
    id: 1,
    name: 'A Great Post',
    ap_id: 'https://lemmy.world/post/1',
    url: null,
    thumbnail_url: null,
    body: 'Post body content',
    nsfw: false,
  },
  community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
  creator: { name: 'alice', display_name: null, actor_id: 'https://lemmy.world/u/alice' },
  counts: { score: 42, comments: 3, child_count: 3 },
};

function renderPage(instance = 'lemmy.world', postId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/view/${instance}/${postId}`]}>
      <Routes>
        <Route path="/view/:instance/:postId" element={<PostViewPage auth={mockAuth} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { fetchPost } = await import('../lib/lemmy');
  (fetchPost as ReturnType<typeof vi.fn>).mockResolvedValue(mockPostView);
});

describe('PostViewPage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders post title after loading', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('A Great Post')).toBeInTheDocument(),
    );
  });

  it('shows error state when fetch fails', async () => {
    const { fetchPost } = await import('../lib/lemmy');
    (fetchPost as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Not found'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Post not found')).toBeInTheDocument(),
    );
  });

  it('shows error state for non-numeric postId', async () => {
    renderPage('lemmy.world', 'not-a-number');
    await waitFor(() =>
      expect(screen.getByText('Post not found')).toBeInTheDocument(),
    );
  });
});
