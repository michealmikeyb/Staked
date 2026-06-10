import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithBackend, makePost, makeSource, makeUser } from '../test-utils';
import SavedPostDetailPage from './SavedPostDetailPage';

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

// Neutral Post fixture (sent by SavedPage via navigation state)
const mockNeutralPost = makePost({
  id: '1',
  title: 'Saved Post Title',
  permalink: 'https://lemmy.world/post/1',
  source: makeSource({ name: 'technology', id: 'https://lemmy.world/c/technology' }),
  author: makeUser({ handle: 'alice@lemmy.world' }),
  body: 'Some body text',
  counts: { score: 55, comments: 3 },
});

function renderPage(withState = true) {
  return renderWithBackend(
    <MemoryRouter initialEntries={[{ pathname: '/saved/1', state: withState ? { post: mockNeutralPost } : undefined }]}>
      <Routes>
        <Route path="/saved/:postId" element={<SavedPostDetailPage />} />
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
