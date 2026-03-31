import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FeedStack from './FeedStack';
import { addSeen } from '../lib/store';

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
  savePost: vi.fn().mockResolvedValue(undefined),
  fetchUnreadCount: vi.fn().mockResolvedValue(3),
  fetchCommunityPosts: vi.fn().mockResolvedValue([
    {
      post: { id: 2, name: 'Community Post', body: null, url: null, thumbnail_url: null },
      community: { name: 'rust', actor_id: 'https://lemmy.world/c/rust' },
      creator: { name: 'bob' },
      counts: { score: 10, comments: 2 },
    },
  ]),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

describe('FeedStack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows a loading state initially', () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders a post title after loading', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    });
  });

  it('does not render a post whose id is in the seen list', async () => {
    addSeen(1);
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
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

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
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
    addSeen(99);

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    const btn = await screen.findByRole('button', { name: /reset seen history/i });
    fireEvent.click(btn);

    expect(localStorage.getItem('stakswipe_seen')).toBeNull();
    expect(reloadMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('FeedStack header and sort', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 847, comments: 0 },
        },
      ])
      .mockResolvedValue([]);
  });

  it('renders the header bar', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post Title');
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('calls fetchPosts with default sort TopTwelveHour', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post Title');
    expect(fetchPosts).toHaveBeenCalledWith('lemmy.world', 'tok', 1, 'TopTwelveHour');
  });

  it('resets the feed and re-fetches when sort changes', async () => {
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        post: { id: 99, name: 'Hot Post', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/99' },
        community: { name: 'tech', actor_id: 'https://lemmy.world/c/tech' },
        creator: { name: 'bob' },
        counts: { score: 10, comments: 0 },
      },
    ]);

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post Title');

    // Open dropdown and pick Hot
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));

    await waitFor(() => {
      expect(fetchPosts).toHaveBeenCalledWith('lemmy.world', 'tok', 1, 'Hot');
    });
  });
});

describe('FeedStack keyboard shortcuts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    const { fetchPosts } = await import('../lib/lemmy');
    // Return the post on page 1, then empty so pagination stops and avoids infinite loop.
    (fetchPosts as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 847, comments: 0 },
        },
      ])
      .mockResolvedValue([]);
  });

  it('calls savePost and dismisses the top post when ArrowDown is pressed', async () => {
    const { savePost } = await import('../lib/lemmy');

    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post Title');

    fireEvent.keyDown(window, { key: 'ArrowDown' });

    expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1);
    await waitFor(() => {
      expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument();
    });
  });
});

describe('FeedStack menu drawer', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    const { fetchPosts } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
          community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
          creator: { name: 'alice' },
          counts: { score: 847, comments: 0 },
        },
      ])
      .mockResolvedValue([]);
  });

  it('opens the drawer when menu button is clicked', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inbox/i })).toBeInTheDocument();
  });

  it('closes the drawer when a tile is clicked', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /saved/i }));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('closes the drawer when the hamburger is clicked again', async () => {
    render(<FeedStack auth={AUTH} onLogout={vi.fn()} unreadCount={0} setUnreadCount={vi.fn()} />);
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });
});

describe('unread badge', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    const { fetchPosts, fetchUnreadCount } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
        community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
        creator: { name: 'alice' },
        counts: { score: 847, comments: 0 },
      },
    ]);
    (fetchUnreadCount as ReturnType<typeof vi.fn>).mockResolvedValue(3);
  });

  it('shows unread count badge on Inbox button when unreadCount > 0', async () => {
    render(
      <FeedStack auth={AUTH} onLogout={() => {}} unreadCount={5} setUnreadCount={() => {}} />,
    );
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByLabelText('Menu'));
    expect(screen.getByTestId('inbox-badge')).toBeInTheDocument();
  });

  it('hides badge when unreadCount is 0', async () => {
    render(
      <FeedStack auth={AUTH} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />,
    );
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByLabelText('Menu'));
    expect(screen.queryByTestId('inbox-badge')).not.toBeInTheDocument();
  });
});

describe('drawer navigation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    const { fetchPosts, fetchUnreadCount } = await import('../lib/lemmy');
    (fetchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        post: { id: 1, name: 'Test Post Title', body: null, url: null, thumbnail_url: null, ap_id: 'https://lemmy.world/post/1' },
        community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
        creator: { name: 'alice' },
        counts: { score: 847, comments: 0 },
      },
    ]);
    (fetchUnreadCount as ReturnType<typeof vi.fn>).mockResolvedValue(3);
  });

  it('navigates to /inbox when Inbox button is clicked', async () => {
    render(
      <FeedStack auth={AUTH} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />,
    );
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByLabelText('Menu'));
    fireEvent.click(screen.getByText('Inbox'));
    expect(mockNavigate).toHaveBeenCalledWith('/inbox');
  });

  it('navigates to /saved when Saved button is clicked', async () => {
    render(
      <FeedStack auth={AUTH} onLogout={() => {}} unreadCount={0} setUnreadCount={() => {}} />,
    );
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByLabelText('Menu'));
    fireEvent.click(screen.getByText('Saved'));
    expect(mockNavigate).toHaveBeenCalledWith('/saved');
  });
});

describe('FeedStack community mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders CommunityHeader instead of MenuDrawer when community prop is set', async () => {
    render(
      <FeedStack
        auth={AUTH}
        onLogout={vi.fn()}
        unreadCount={0}
        setUnreadCount={vi.fn()}
        community={{ name: 'rust', instance: 'lemmy.world' }}
      />
    );
    await screen.findByText('Community Post');
    expect(screen.getAllByText('c/rust').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
  });

  it('calls fetchCommunityPosts with the correct communityRef', async () => {
    const { fetchCommunityPosts } = await import('../lib/lemmy');
    render(
      <FeedStack
        auth={AUTH}
        onLogout={vi.fn()}
        unreadCount={0}
        setUnreadCount={vi.fn()}
        community={{ name: 'rust', instance: 'lemmy.world' }}
      />
    );
    await screen.findByText('Community Post');
    expect(fetchCommunityPosts).toHaveBeenCalledWith(
      'lemmy.world', 'tok', 'rust@lemmy.world', 1, 'Active',
    );
  });

  it('shows a post that is in the seen list (independent seen tracking)', async () => {
    addSeen(2); // post id 2 is the community post
    render(
      <FeedStack
        auth={AUTH}
        onLogout={vi.fn()}
        unreadCount={0}
        setUnreadCount={vi.fn()}
        community={{ name: 'rust', instance: 'lemmy.world' }}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Community Post')).toBeInTheDocument();
    });
  });

  it('shows empty state without reset button when community feed is exhausted', async () => {
    const { fetchCommunityPosts } = await import('../lib/lemmy');
    (fetchCommunityPosts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(
      <FeedStack
        auth={AUTH}
        onLogout={vi.fn()}
        unreadCount={0}
        setUnreadCount={vi.fn()}
        community={{ name: 'rust', instance: 'lemmy.world' }}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/you've seen everything/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reset seen history/i })).not.toBeInTheDocument();
    });
  });
});
