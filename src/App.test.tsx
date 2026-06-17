import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

vi.mock('./lib/store', () => {
  const DEFAULT_SETTINGS = {
    nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: true,
    defaultFeedId: 'Active', activeStakId: 'all', lemmy: { anonInstance: '' },
  };
  return {
    loadSettings: vi.fn().mockReturnValue(DEFAULT_SETTINGS),
    saveSettings: vi.fn(),
    DEFAULT_SETTINGS,
  };
});

vi.mock('./lib/lemmy', () => ({
  fetchPost: vi.fn().mockResolvedValue({
    post: { id: 5, name: 'Shared Post', ap_id: 'https://lemmy.world/post/5', url: null, body: null, thumbnail_url: null },
    community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
    creator: { name: 'carol', display_name: null },
    counts: { score: 10, comments: 0 },
  }),
}));

vi.mock('./components/DynamicLoginPage', () => ({ default: () => <div>DynamicLoginPage</div> }));
vi.mock('./components/BackendSelectPage', () => ({ default: () => <div>BackendSelectPage</div> }));
vi.mock('./components/AccountsPage', () => ({ default: () => <div>AccountsPage</div> }));

vi.mock('./components/FeedStack', () => ({
  default: () => <div>FeedStack</div>,
}));

vi.mock('./components/InboxPage', () => ({
  default: () => <div>InboxPage</div>,
}));

vi.mock('./components/PostDetailPage', () => ({
  default: () => <div>PostDetailPage</div>,
}));

vi.mock('./components/SavedPage', () => ({
  default: () => <div>SavedPage</div>,
}));

vi.mock('./components/SavedPostDetailPage', () => ({
  default: () => <div>SavedPostDetailPage</div>,
}));

vi.mock('./components/ProfilePage', () => ({
  default: () => <div>ProfilePage</div>,
}));

vi.mock('./components/ProfilePostDetailPage', () => ({
  default: () => <div>ProfilePostDetailPage</div>,
}));

vi.mock('./components/SharedPostPage', () => ({
  default: () => <div>Shared Post</div>,
}));

vi.mock('./components/SettingsPage', () => ({
  default: () => <div>SettingsPage</div>,
}));

vi.mock('./components/CreatePostPage', () => ({
  default: () => <div>CreatePostPage</div>,
}));

vi.mock('./hooks/useNotificationPolling', () => ({
  useNotificationPolling: vi.fn(),
}));

import { useNotificationPolling } from './hooks/useNotificationPolling';

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  function seedLoggedIn() {
    localStorage.setItem('stakswipe_accounts', JSON.stringify([
      { session: { id: 'lemmy:alice@lemmy.world', backendId: 'lemmy', viewer: { id: 'alice', handle: 'alice@lemmy.world', profileUrl: 'https://lemmy.world/u/alice' }, data: { instance: 'lemmy.world', token: 'tok' } }, addedAt: 1 },
    ]));
    localStorage.setItem('stakswipe_active', JSON.stringify({ sessionId: 'lemmy:alice@lemmy.world', stakId: 'all' }));
  }

  it('shows FeedStack at / when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
  });

  it('redirects /login to the add-account flow', () => {
    window.location.hash = '#/login';
    render(<App />);
    expect(screen.getByText('BackendSelectPage')).toBeInTheDocument();
  });

  it('shows FeedStack when authenticated', () => {
    seedLoggedIn();
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
  });

  it('renders SharedPostPage at /post/:instance/:postId without auth', async () => {
    localStorage.clear();
    window.location.hash = '#/post/lemmy.world/5';

    render(<App />);

    await waitFor(() => expect(screen.getByText('Shared Post')).toBeInTheDocument());
  });

  it('does not render auth-gated page when unauthenticated', () => {
    window.location.hash = '#/create-post';
    render(<App />);
    expect(screen.queryByText('CreatePostPage')).not.toBeInTheDocument();
  });

  it('renders ProfilePage at /user/:instance/:username when authenticated', async () => {
    seedLoggedIn();
    window.location.hash = '#/user/beehaw.org/bob';
    render(<App />);
    await waitFor(() => expect(screen.getByText('ProfilePage')).toBeInTheDocument());
  });

  it('renders CreatePostPage at /create-post when authenticated', async () => {
    seedLoggedIn();
    window.location.hash = '#/create-post';
    render(<App />);
    await waitFor(() => expect(screen.getByText('CreatePostPage')).toBeInTheDocument());
  });

  it('renders SettingsPage at /settings without auth', () => {
    window.location.hash = '#/settings';
    render(<App />);
    expect(screen.getByText('SettingsPage')).toBeInTheDocument();
  });

  it('calls useNotificationPolling with the active backend', () => {
    seedLoggedIn();
    render(<App />);
    expect(useNotificationPolling).toHaveBeenCalledWith(
      expect.objectContaining({ backendId: 'lemmy' }),
      expect.any(Function),
      expect.any(String),
    );
  });
});
