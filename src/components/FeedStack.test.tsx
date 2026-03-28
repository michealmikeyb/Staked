import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FeedStack from './FeedStack';

vi.mock('../lib/lemmy', () => ({
  fetchPosts: vi.fn().mockResolvedValue([
    {
      post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null },
      community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
      creator: { name: 'alice' },
      counts: { score: 847, comments: 42 },
    },
  ]),
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  upvotePost: vi.fn().mockResolvedValue(undefined),
  downvotePost: vi.fn().mockResolvedValue(undefined),
}));

const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

describe('FeedStack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows a loading state initially', () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders a post title after loading', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    });
  });

  it('does not render a post whose id is in the seen list', async () => {
    localStorage.setItem('stakswipe_seen', JSON.stringify([1]));
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument();
    });
  });
});

describe('FeedStack empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows reset and logout buttons when feed is exhausted', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset seen history/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });
  });

  it('calls clearSeen and reloads when reset button is clicked', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const reloadMock = vi.fn();
    vi.stubGlobal('location', { reload: reloadMock });
    localStorage.setItem('stakswipe_seen', JSON.stringify([99]));

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} />);
    const btn = await screen.findByRole('button', { name: /reset seen history/i });
    fireEvent.click(btn);

    expect(localStorage.getItem('stakswipe_seen')).toBeNull();
    expect(reloadMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
