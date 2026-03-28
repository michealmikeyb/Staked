import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  upvotePost: vi.fn().mockResolvedValue(undefined),
  downvotePost: vi.fn().mockResolvedValue(undefined),
  savePost: vi.fn().mockResolvedValue(undefined),
}));

const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

describe('FeedStack', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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
});
