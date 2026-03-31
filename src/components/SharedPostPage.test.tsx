import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/lemmy', () => ({
  fetchPost: vi.fn().mockResolvedValue({
    post: { id: 42, name: 'Hello from Lemmy', ap_id: 'https://lemmy.world/post/42', url: null, body: 'Post body text', thumbnail_url: null },
    community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
    creator: { name: 'carol', display_name: null },
    counts: { score: 77, comments: 5 },
  }),
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: () => ({ comments: [], commentsLoaded: true, resolvedInstanceRef: { current: '' }, resolvedTokenRef: { current: '' } }),
}));

import SharedPostPage from './SharedPostPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/post/:instance/:postId" element={<SharedPostPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SharedPostPage', () => {
  it('renders post title after loading', async () => {
    renderAt('/post/lemmy.world/42');
    await waitFor(() => expect(screen.getByText('Hello from Lemmy')).toBeInTheDocument());
  });

  it('shows loading state initially', () => {
    renderAt('/post/lemmy.world/42');
    expect(screen.getByTestId('shared-post-loading')).toBeInTheDocument();
  });

  it('shows error when fetchPost rejects', async () => {
    const { fetchPost } = await import('../lib/lemmy');
    (fetchPost as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not found'));
    renderAt('/post/lemmy.world/99');
    await waitFor(() => expect(screen.getByTestId('shared-post-error')).toBeInTheDocument());
  });
});
