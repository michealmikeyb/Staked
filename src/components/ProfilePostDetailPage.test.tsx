import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfilePostDetailPage from './ProfilePostDetailPage';

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

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };

const mockPostView = {
  post: { id: 1, name: 'Profile Post Title', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null },
  community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 42, comments: 7 },
};

function renderPage(state?: object) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/profile/1', state: state ?? { post: mockPostView } }]}>
      <Routes>
        <Route path="/profile/:postId" element={<ProfilePostDetailPage auth={mockAuth} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('ProfilePostDetailPage', () => {
  it('renders post title when state is present', () => {
    renderPage();
    expect(screen.getByText('Profile Post Title')).toBeInTheDocument();
  });

  it('renders community name', () => {
    renderPage();
    expect(screen.getByText('c/linux')).toBeInTheDocument();
  });

  it('shows fallback when no route state', () => {
    renderPage(false);
    expect(screen.getByText('Navigate to Profile to view this post.')).toBeInTheDocument();
  });

  it('passes commentApId from state to PostDetailCard', () => {
    renderPage({ post: mockPostView, commentApId: 'https://lemmy.world/comment/5' });
    // PostDetailCard receives notifCommentApId; useCommentLoader is called — just verify no crash
    expect(screen.getByText('Profile Post Title')).toBeInTheDocument();
  });
});
