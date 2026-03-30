import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  fetchPersonDetails: vi.fn(),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };

const mockPost = {
  post: { id: 1, name: 'My Terminal Setup', ap_id: 'https://lemmy.world/post/1', url: null, thumbnail_url: null, body: null },
  community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 42, comments: 7 },
};

const mockComment = {
  comment: { id: 5, content: 'Great post!', ap_id: 'https://lemmy.world/comment/5', path: '0.5', published: '2026-03-28T10:00:00Z' },
  post: { id: 2, name: 'Ask Lemmy: best editors?', ap_id: 'https://lemmy.world/post/2', url: null, body: null, thumbnail_url: null },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 8 },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <ProfilePage auth={mockAuth} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { fetchPersonDetails } = await import('../lib/lemmy');
  (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
    posts: [mockPost],
    comments: [mockComment],
  });
});

describe('ProfilePage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders username and instance', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByText('u/alice')).toBeInTheDocument();
    expect(screen.getByText('lemmy.world')).toBeInTheDocument();
  });

  it('All tab is active by default and shows both post and comment', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByText('My Terminal Setup')).toBeInTheDocument();
    expect(screen.getByText('Great post!')).toBeInTheDocument();
  });

  it('Posts tab shows only post rows', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    expect(screen.getByText('My Terminal Setup')).toBeInTheDocument();
    expect(screen.queryByText('Great post!')).not.toBeInTheDocument();
  });

  it('Comments tab shows only comment rows', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: 'Comments' }));
    expect(screen.queryByText('My Terminal Setup')).not.toBeInTheDocument();
    expect(screen.getByText('Great post!')).toBeInTheDocument();
  });

  it('navigates to post detail on post row click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByText('My Terminal Setup'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/1', { state: { post: mockPost } });
  });

  it('navigates to post detail with commentApId on comment row click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    fireEvent.click(screen.getByText('Great post!'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/2', {
      state: {
        post: {
          post: mockComment.post,
          community: mockComment.community,
          creator: mockComment.creator,
          counts: { score: 0, comments: 0 },
        },
        commentApId: 'https://lemmy.world/comment/5',
      },
    });
  });

  it('shows empty state when no posts or comments', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ posts: [], comments: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
  });

  it('shows error when fetch fails', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });
});
