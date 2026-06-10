import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithBackend, makePost } from '../test-utils';
import SharedPostPage from './SharedPostPage';

vi.mock('./PostDetailCard', () => ({
  default: ({ post }: { post: { name: string } }) => (
    <div data-testid="post-detail-card">{post.name}</div>
  ),
}));

const POST = makePost({ id: '42', title: 'Hello from Lemmy', permalink: 'https://lemmy.world/post/42' });

function renderAt(path: string, withPost = true) {
  return renderWithBackend(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
      </Routes>
    </MemoryRouter>,
    withPost ? { fixtures: { posts: [POST] } } : {},
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SharedPostPage', () => {
  it('renders post title after loading', async () => {
    renderAt('/post/lemmy.world/42');
    await waitFor(() => expect(screen.getByText('Hello from Lemmy')).toBeInTheDocument());
  });

  it('shows loading state initially', async () => {
    renderAt('/post/lemmy.world/42');
    expect(screen.getByTestId('shared-post-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('shared-post-loading')).not.toBeInTheDocument());
  });

  it('shows error when post is not found', async () => {
    renderAt('/post/lemmy.world/99', false);
    await waitFor(() => expect(screen.getByTestId('shared-post-error')).toBeInTheDocument());
  });
});
