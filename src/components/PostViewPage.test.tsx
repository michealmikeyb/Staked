import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithBackend, makePost } from '../test-utils';
import PostViewPage from './PostViewPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('./PostDetailCard', () => ({
  default: ({ post }: { post: { name: string } }) => (
    <div data-testid="post-detail-card">{post.name}</div>
  ),
}));

const POST = makePost({ id: '1', title: 'A Great Post', permalink: 'https://lemmy.world/post/1' });

function renderPage(instance = 'lemmy.world', postId = '1', withPost = true) {
  return renderWithBackend(
    <MemoryRouter initialEntries={[`/view/${instance}/${postId}`]}>
      <Routes>
        <Route path="/view/:instance/:postId" element={<PostViewPage />} />
      </Routes>
    </MemoryRouter>,
    withPost ? { fixtures: { posts: [POST] } } : {},
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PostViewPage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders post title after loading', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('A Great Post')).toBeInTheDocument());
  });

  it('shows error state when post is not found', async () => {
    renderPage('lemmy.world', '1', false);
    await waitFor(() => expect(screen.getByText('Post not found')).toBeInTheDocument());
  });

  it('shows error state for non-numeric postId', async () => {
    renderPage('lemmy.world', 'not-a-number');
    await waitFor(() => expect(screen.getByText('Post not found')).toBeInTheDocument());
  });
});
