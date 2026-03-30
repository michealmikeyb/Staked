import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SavedPostDetailPage from './SavedPostDetailPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn(),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: vi.fn().mockReturnValue({
    comments: [],
    commentsLoaded: true,
    resolvedInstanceRef: { current: 'lemmy.world' },
    resolvedTokenRef: { current: 'tok' },
  }),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockPostView = {
  post: {
    id: 1,
    name: 'Saved Post Title',
    ap_id: 'https://lemmy.world/post/1',
    url: null,
    body: 'Some body text',
    thumbnail_url: null,
  },
  community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 55, child_count: 3 },
};

function renderPage(withState = true) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/saved/1', state: withState ? { post: mockPostView } : undefined }]}>
      <Routes>
        <Route path="/saved/:postId" element={<SavedPostDetailPage auth={mockAuth} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SavedPostDetailPage', () => {
  it('renders post title when state is present', () => {
    renderPage();
    expect(screen.getByText('Saved Post Title')).toBeInTheDocument();
  });

  it('renders community name', () => {
    renderPage();
    expect(screen.getByText('c/technology')).toBeInTheDocument();
  });

  it('shows fallback when no route state', () => {
    renderPage(false);
    expect(screen.getByText('Navigate to Saved to view this post.')).toBeInTheDocument();
  });
});
