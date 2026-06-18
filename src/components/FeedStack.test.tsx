import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { makePost, makeSource } from '../test-utils';
import type { MockFixtures } from '../lib/api/backends/mock/fixtures';
import type { Capabilities } from '../lib/api/capabilities';
import { createMockBackend, type MockBackend } from '../lib/api/backends/mock';
import { addSeen } from '../lib/store';
import { SettingsProvider } from '../lib/SettingsContext';
import { AccountsProvider } from '../lib/AccountsContext';
import { clearRegistry, registerBackend } from '../lib/api/registry';
import type { Session } from '../lib/api/types';
import FeedStack, { pickFeedId } from './FeedStack';

describe('pickFeedId', () => {
  const opts = [{ id: 'following' }, { id: 'at://x/app.bsky.feed.generator/sci' }];

  it('keeps the desired feed when it is a valid option', () => {
    expect(pickFeedId(opts, 'following', false)).toBe('following');
  });

  it('falls back to the first option when the desired feed is invalid', () => {
    expect(pickFeedId(opts, 'Active', false)).toBe('following');
  });

  it('returns Active for community feeds regardless of options', () => {
    expect(pickFeedId(opts, 'following', true)).toBe('Active');
  });

  it('returns the desired value when there are no options', () => {
    expect(pickFeedId([], 'Active', false)).toBe('Active');
  });
});

vi.mock('./PostCard', () => ({
  default: ({ post, onSwipeRight, onSwipeLeft, onUndo, isReturning }: any) => (
    <div
      data-testid="post-card"
      data-post-id={post.id}
      data-is-returning={isReturning ? 'true' : undefined}
    >
      <span>{post.title}</span>
      <button onClick={onSwipeRight}>swipe-right</button>
      <button onClick={onSwipeLeft}>swipe-left</button>
      <button onClick={onUndo}>undo</button>
    </div>
  ),
}));

vi.mock('./CommunityHeader', () => ({
  default: ({ name, instance, onBlock, onSubscribeToggle }: any) => (
    <div>
      <span>{`c/${name}`}</span>
      {onBlock && <button onClick={onBlock}>block-community</button>}
      {onSubscribeToggle && <button onClick={onSubscribeToggle}>subscribe-community</button>}
    </div>
  ),
}));

const mockNavigate = vi.fn();
const mockLocation = { state: null as unknown };
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

const FEED_OPTIONS = [
  { id: 'Active', label: 'Active' },
  { id: 'Hot', label: 'Hot' },
  { id: 'New', label: 'New' },
  { id: 'TopTwelveHour', label: 'Top 12h' },
  { id: 'TopDay', label: 'Top Day' },
];

const SOURCE = makeSource({ handle: 'technology@lemmy.world', name: 'technology' });
const RUST_SOURCE = makeSource({ id: 'src-rust', handle: 'rust@lemmy.world', name: 'rust' });

const POST_1 = makePost({ id: '1', title: 'Test Post Title', source: SOURCE });
const COMMUNITY_POST = makePost({ id: '2', title: 'Community Post', source: RUST_SOURCE });

const ALICE_SESSION: Session = {
  id: 'lemmy:alice@x',
  backendId: 'lemmy',
  viewer: { id: 'alice', handle: 'alice@x', profileUrl: 'https://x/u/alice' },
  data: { instance: 'x', token: 't' },
};

function seedLoggedIn(stakId = 'all') {
  localStorage.setItem('stakswipe_accounts', JSON.stringify([
    { session: ALICE_SESSION, addedAt: 1 },
  ]));
  localStorage.setItem('stakswipe_active', JSON.stringify({ sessionId: 'lemmy:alice@x', stakId }));
}

// Registry-backed render. AccountsProvider builds the active backend from the
// registry, so the `lemmy` factory must return a mock seeded with the fixtures.
// We cache one mock per session id so spies attach to the instance FeedStack uses.
interface RenderFeedOpts {
  fixtures?: MockFixtures;
  capabilities?: Partial<Capabilities>;
}

function renderFeed(
  props: Partial<React.ComponentProps<typeof FeedStack>> = {},
  opts: RenderFeedOpts = {},
) {
  const caps = { feedOptions: FEED_OPTIONS, ...opts.capabilities };
  const cache = new Map<string, MockBackend>();
  registerBackend('lemmy', (session) => {
    const existing = cache.get(session.id);
    if (existing) return existing;
    const anonymous = !session.viewer;
    const backend = createMockBackend(opts.fixtures, caps, anonymous);
    cache.set(session.id, backend);
    return backend;
  });

  const result = render(
    <SettingsProvider>
      <AccountsProvider>
        <FeedStack unreadCount={0} setUnreadCount={vi.fn()} {...props} />
      </AccountsProvider>
    </SettingsProvider>,
  );

  // The backend FeedStack uses: active account's session, else the anonymous one.
  const activeRaw = localStorage.getItem('stakswipe_active');
  const activeId = activeRaw ? (JSON.parse(activeRaw) as { sessionId: string }).sessionId : 'anon';
  const backend = cache.get(activeId) ?? cache.get('anon')!;
  return { ...result, backend, cache };
}

describe('FeedStack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
  });

  it('shows a loading state initially', () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders a post title after loading', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await waitFor(() => {
      expect(screen.getByText('Test Post Title')).toBeInTheDocument();
    });
  });

  it('does not render a post whose id is in the seen list', async () => {
    addSeen('1');
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await waitFor(() => {
      expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument();
    });
  });
});

describe('FeedStack empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
  });

  it('shows reset button when feed is exhausted', async () => {
    renderFeed({}, { fixtures: { posts: [] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset seen history/i })).toBeInTheDocument();
    });
  });

  it('calls clearSeen and reloads when reset button is clicked', async () => {
    const reloadMock = vi.fn();
    vi.stubGlobal('location', { reload: reloadMock });
    addSeen('99');

    renderFeed({}, { fixtures: { posts: [] } });
    const btn = await screen.findByRole('button', { name: /reset seen history/i });
    fireEvent.click(btn);

    expect(localStorage.getItem('stakswipe_seen')).toBeNull();
    expect(reloadMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('FeedStack header and sort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
  });

  it('renders the header bar', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('shows TopTwelveHour as the default sort label', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    expect(screen.getByRole('button', { name: /top 12h/i })).toBeInTheDocument();
  });

  it('passes correct sort to feed on initial load', async () => {
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1] } });
    const spy = vi.spyOn(backend.feed, 'getTimeline');
    await screen.findByText('Test Post Title');
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ feedId: 'TopTwelveHour', stakId: 'all' })),
    );
  });

  it('re-fetches with new sort when sort changes', async () => {
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    const spy = vi.spyOn(backend.feed, 'getTimeline');

    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ feedId: 'Hot' }));
    });
  });
});

describe('FeedStack keyboard shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
    seedLoggedIn();
  });

  it('ArrowDown with empty undo stack does nothing', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByText('Test Post Title')).toBeInTheDocument();
  });

  it('ArrowDown restores the last dismissed post', async () => {
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByText('Test Post Title')).toBeInTheDocument());
  });

  it('ArrowDown can undo multiple times', async () => {
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    const POST_3 = makePost({ id: '3', title: 'Third Post', source: SOURCE });
    renderFeed({}, { fixtures: { posts: [POST_1, POST_2, POST_3] } });
    await screen.findByText('Test Post Title');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('Second Post')).not.toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByText('Second Post')).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByText('Test Post Title')).toBeInTheDocument());
  });

  it('restored card renders without error after undo', async () => {
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByText('Test Post Title')).toBeInTheDocument());
  });
});

describe('FeedStack menu drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
    seedLoggedIn();
  });

  it('opens the drawer when menu button is clicked', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inbox/i })).toBeInTheDocument();
  });

  it('closes the drawer when a tile is clicked', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /saved/i }));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('closes the drawer when the hamburger is clicked again', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });
});

describe('unread badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
    seedLoggedIn();
  });

  it('shows unread count badge on Inbox button when unreadCount > 0', async () => {
    renderFeed({ unreadCount: 5 }, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByLabelText('Menu'));
    expect(screen.getByTestId('inbox-badge')).toBeInTheDocument();
  });

  it('hides badge when unreadCount is 0', async () => {
    renderFeed({ unreadCount: 0 }, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByLabelText('Menu'));
    expect(screen.queryByTestId('inbox-badge')).not.toBeInTheDocument();
  });
});

describe('drawer navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
    seedLoggedIn();
  });

  it('navigates to /inbox when Inbox button is clicked', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByLabelText('Menu'));
    fireEvent.click(screen.getByText('Inbox'));
    expect(mockNavigate).toHaveBeenCalledWith('/inbox');
  });

  it('navigates to /saved when Saved button is clicked', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
    fireEvent.click(screen.getByLabelText('Menu'));
    fireEvent.click(screen.getByText('Saved'));
    expect(mockNavigate).toHaveBeenCalledWith('/saved');
  });
});

describe('FeedStack settings — defaultSort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
  });

  it('uses defaultSort from settings for initial fetch', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: true, defaultSort: 'Hot',
    }));
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1] } });
    const spy = vi.spyOn(backend.feed, 'getTimeline');
    await screen.findByText('Test Post Title');
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ feedId: 'Hot' })));
  });
});

describe('FeedStack settings — gestures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
    seedLoggedIn();
  });

  it('votes -1 on ArrowLeft when nonUpvoteSwipeAction is downvote (default)', async () => {
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(backend.state.votes['1']).toBe(-1));
  });

  it('does not vote on ArrowLeft when nonUpvoteSwipeAction is dismiss', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      nonUpvoteSwipeAction: 'dismiss', swapGestures: false, blurNsfw: true, defaultSort: 'TopTwelveHour',
    }));
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument());
    expect(backend.state.votes['1']).toBeUndefined();
  });

  it('votes 1 on ArrowLeft when swapGestures is true', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      nonUpvoteSwipeAction: 'downvote', swapGestures: true, blurNsfw: true, defaultSort: 'TopTwelveHour',
    }));
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(backend.state.votes['1']).toBe(1));
  });

  it('votes -1 on ArrowRight when swapGestures is true and nonUpvoteSwipeAction is downvote', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      nonUpvoteSwipeAction: 'downvote', swapGestures: true, blurNsfw: true, defaultSort: 'TopTwelveHour',
    }));
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(backend.state.votes['1']).toBe(-1));
  });

  it('does not vote on ArrowRight when swapGestures is true and nonUpvoteSwipeAction is dismiss', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      nonUpvoteSwipeAction: 'dismiss', swapGestures: true, blurNsfw: true, defaultSort: 'TopTwelveHour',
    }));
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument());
    expect(backend.state.votes['1']).toBeUndefined();
  });
});

describe('FeedStack community mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
    seedLoggedIn();
  });

  it('renders CommunityHeader instead of MenuDrawer when community prop is set', async () => {
    renderFeed(
      { community: { name: 'rust', instance: 'lemmy.world' } },
      { fixtures: { posts: [COMMUNITY_POST], sources: [RUST_SOURCE] } },
    );
    await screen.findByText('Community Post');
    expect(screen.getAllByText('c/rust')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^menu$/i })).not.toBeInTheDocument();
  });

  it('fetches from getSourceFeed with the correct handle', async () => {
    const { backend } = renderFeed(
      { community: { name: 'rust', instance: 'lemmy.world' } },
      { fixtures: { posts: [COMMUNITY_POST], sources: [RUST_SOURCE] } },
    );
    const spy = vi.spyOn(backend.feed, 'getSourceFeed');
    await screen.findByText('Community Post');
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('rust@lemmy.world', expect.objectContaining({ feedId: 'Active' })),
    );
  });

  it('shows a post that is in the seen list (community uses independent seen tracking)', async () => {
    addSeen('2');
    renderFeed(
      { community: { name: 'rust', instance: 'lemmy.world' } },
      { fixtures: { posts: [COMMUNITY_POST], sources: [RUST_SOURCE] } },
    );
    await waitFor(() => {
      expect(screen.getByText('Community Post')).toBeInTheDocument();
    });
  });

  it('shows empty state without reset button when community feed is exhausted', async () => {
    renderFeed(
      { community: { name: 'rust', instance: 'lemmy.world' } },
      { fixtures: { posts: [], sources: [RUST_SOURCE] } },
    );
    await waitFor(() => {
      expect(screen.getByText(/you've seen everything/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reset seen history/i })).not.toBeInTheDocument();
    });
  });

  it('fetches community source info on mount', async () => {
    // Pre-create the active backend and spy BEFORE render, since sources.get
    // fires in the mount effect.
    const backend = createMockBackend(
      { posts: [COMMUNITY_POST], sources: [RUST_SOURCE] },
      { feedOptions: FEED_OPTIONS },
    );
    const spy = vi.spyOn(backend.sources, 'get');
    registerBackend('lemmy', (session) =>
      session.id === ALICE_SESSION.id ? backend : createMockBackend(undefined, { feedOptions: FEED_OPTIONS }, true),
    );
    render(
      <SettingsProvider>
        <AccountsProvider>
          <FeedStack
            unreadCount={0}
            setUnreadCount={vi.fn()}
            community={{ name: 'rust', instance: 'lemmy.world' }}
          />
        </AccountsProvider>
      </SettingsProvider>,
    );
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('rust@lemmy.world');
    });
  });

  it('blocks community and navigates to / with toast when block is clicked', async () => {
    const { backend } = renderFeed(
      { community: { name: 'rust', instance: 'lemmy.world' } },
      { fixtures: { posts: [COMMUNITY_POST], sources: [RUST_SOURCE] } },
    );
    await screen.findByText('Community Post');
    fireEvent.click(screen.getByRole('button', { name: /block-community/i }));
    await waitFor(() => expect(backend.state.blockedSources.has('src-rust')).toBe(true));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { toast: 'Blocked c/rust' } });
  });
});

describe('FeedStack anonymous mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
    // no seeded account/active → AccountsContext.active is null → anonymous mode
  });

  it('renders posts when logged out', async () => {
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await screen.findByText('Test Post Title');
  });

  it('does not vote on ArrowRight when logged out', async () => {
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument());
    expect(backend.state.votes['1']).toBeUndefined();
  });

  it('does not vote on ArrowLeft when logged out', async () => {
    const POST_2 = makePost({ id: '2', title: 'Second Post', source: SOURCE });
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1, POST_2] } });
    await screen.findByText('Test Post Title');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.queryByText('Test Post Title')).not.toBeInTheDocument());
    expect(backend.state.votes['1']).toBeUndefined();
  });

  it('shows empty state without log out / browse anonymously button when logged out', async () => {
    renderFeed({}, { fixtures: { posts: [] } });
    await waitFor(() => {
      expect(screen.getByText(/you've seen everything/i)).toBeInTheDocument();
      // error-screen "Browse anonymously" button is not present in the empty state
      expect(screen.queryByRole('button', { name: /browse anonymously/i })).not.toBeInTheDocument();
    });
  });

  it('offers an Anonymous stak pill in the empty state', async () => {
    renderFeed({}, { fixtures: { posts: [] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /anonymous/i })).toBeInTheDocument();
    });
  });
});

describe('FeedStack stak selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
  });

  it('fetches with the all stak by default when logged in', async () => {
    seedLoggedIn('all');
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1] } });
    const spy = vi.spyOn(backend.feed, 'getTimeline');
    await screen.findByText('Test Post Title');
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ stakId: 'all' })));
  });

  it('fetches with the active stak from the persisted active pointer', async () => {
    seedLoggedIn('local');
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1] } });
    const spy = vi.spyOn(backend.feed, 'getTimeline');
    await screen.findByText('Test Post Title');
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ stakId: 'local' })));
  });

  it('switches to the subscribed stak when its empty-state pill is clicked', async () => {
    seedLoggedIn('all');
    renderFeed({}, { fixtures: { posts: [] } });
    const pill = await screen.findByRole('button', { name: /subscribed/i });
    fireEvent.click(pill);
    await waitFor(() =>
      expect(localStorage.getItem('stakswipe_active')).toContain('"stakId":"subscribed"'),
    );
  });

  it('does not fire an extra getTimeline call when switching stak', async () => {
    // Regression guard: if stak is added back to the low-buffer pagination effect's
    // dep array, that effect fires an EXTRA loadMore call immediately on stak change
    // (in addition to the [backend, stak] home-reset effect that already owns reload).
    // This is detectable when the switch call returns enough posts to satisfy the
    // low-buffer threshold (>3): only the home-reset effect should call getTimeline;
    // the low-buffer effect must NOT fire an extra call because stak changed.
    //
    // We return 4 distinct subscribed posts from the mock so posts.length > 3 after
    // the switch, ensuring the low-buffer effect does NOT fire legitimately. Any extra
    // call therefore comes solely from stak being in the dep array.
    const SUB_POSTS = [
      makePost({ id: '21', title: 'Sub Post A', source: SOURCE }),
      makePost({ id: '22', title: 'Sub Post B', source: SOURCE }),
      makePost({ id: '23', title: 'Sub Post C', source: SOURCE }),
      makePost({ id: '24', title: 'Sub Post D', source: SOURCE }),
    ];

    seedLoggedIn('all');
    const { backend } = renderFeed({}, { fixtures: { posts: [POST_1] } });

    // Wait for the initial 'all' feed to settle.
    await screen.findByText('Test Post Title');

    // Intercept getTimeline and count calls from this point forward.
    let callCount = 0;
    vi.spyOn(backend.feed, 'getTimeline').mockImplementation(async () => {
      callCount++;
      return { items: SUB_POSTS, nextCursor: null };
    });

    // Open the stak dropdown and select "Subscribed".
    // The button aria-label is "Subscribed" or "Subscribed · handle" depending on the account.
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^subscribed/i }));

    // Wait for the home-reset fetch to complete (posts appear).
    await waitFor(() => expect(screen.queryByText('Sub Post A')).toBeInTheDocument());

    // Give React a tick to flush any further pending effects.
    await new Promise((r) => setTimeout(r, 50));

    // Exactly ONE getTimeline call must fire (the home-reset effect).
    // With stak in the low-buffer deps, a second call fires immediately on stak
    // change (before the home effect can set loading=true), making callCount === 2.
    expect(callCount).toBe(1);
  });
});

describe('FeedStack at-uri seen tracking regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
  });

  it('second at-uri post remains visible after swiping the first', async () => {
    const AT_POST_1 = makePost({
      id: 'at://did:plc:a/app.bsky.feed.post/p1|bafycid1',
      title: 'Bluesky Post 1',
      source: SOURCE,
    });
    const AT_POST_2 = makePost({
      id: 'at://did:plc:a/app.bsky.feed.post/p2|bafycid2',
      title: 'Bluesky Post 2',
      source: SOURCE,
    });

    renderFeed({}, { fixtures: { posts: [AT_POST_1, AT_POST_2] } });
    await screen.findByText('Bluesky Post 1');

    // Swipe the first card right
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.queryByText('Bluesky Post 1')).not.toBeInTheDocument());

    // Second card must still be visible, not filtered as seen
    expect(screen.getByText('Bluesky Post 2')).toBeInTheDocument();
  });
});

describe('FeedStack subscribed empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
  });

  it('shows subscribed empty state when the subscribed stak returns no posts', async () => {
    seedLoggedIn('subscribed');
    renderFeed({}, { fixtures: { posts: [] } });
    await waitFor(() => {
      expect(screen.getByText(/no more posts in your subscriptions/i)).toBeInTheDocument();
    });
  });

  it('shows generic empty state for the all stak', async () => {
    seedLoggedIn('all');
    renderFeed({}, { fixtures: { posts: [] } });
    await waitFor(() => {
      expect(screen.getByText(/you've seen everything/i)).toBeInTheDocument();
    });
  });
});

describe('FeedStack toast from navigation state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearRegistry();
    mockLocation.state = null;
  });

  it('shows toast when location.state.toast is set', async () => {
    mockLocation.state = { toast: 'Blocked c/rust' };
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await waitFor(() => expect(screen.getByText('Blocked c/rust')).toBeInTheDocument());
  });

  it('does not show toast when location.state has no toast', async () => {
    mockLocation.state = null;
    renderFeed({}, { fixtures: { posts: [POST_1] } });
    await waitFor(() => screen.getByText('Test Post Title'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
