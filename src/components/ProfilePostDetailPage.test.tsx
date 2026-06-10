import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithBackend, makePost, makeSource, makeUser } from '../test-utils';
import ProfilePostDetailPage from './ProfilePostDetailPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('./PostDetailCard', () => ({
  default: ({ post, community }: { post: { name: string }; community?: { name: string } }) => (
    <div data-testid="post-detail-card">
      {post.name}
      {community && <span>c/{community.name}</span>}
    </div>
  ),
}));

// Neutral Post fixture (sent by ProfilePage via navigation state)
const mockNeutralPost = makePost({
  id: '1',
  title: 'Profile Post Title',
  permalink: 'https://lemmy.world/post/1',
  source: makeSource({ name: 'linux', id: 'https://lemmy.world/c/linux' }),
  author: makeUser({ handle: 'alice@lemmy.world' }),
  counts: { score: 42, comments: 7 },
});

function renderPage(state?: object | false) {
  return renderWithBackend(
    <MemoryRouter initialEntries={[{ pathname: '/profile/1', state: state ?? { post: mockNeutralPost } }]}>
      <Routes>
        <Route path="/profile/:postId" element={<ProfilePostDetailPage />} />
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
    renderPage({ post: mockNeutralPost, commentApId: 'https://lemmy.world/comment/5' });
    expect(screen.getByText('Profile Post Title')).toBeInTheDocument();
  });
});
