import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

// ── Lemmy mock ────────────────────────────────────────────────────────────────
vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'My reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
  editComment: vi.fn().mockResolvedValue({
    comment: { id: 1, content: 'Edited', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
    creator: { name: 'alice', display_name: null },
    counts: { score: 1 },
  }),
  savePost: vi.fn().mockResolvedValue(undefined),
}));

// ── Gesture mock ──────────────────────────────────────────────────────────────
// @use-gesture/react's useDrag doesn't work in jsdom (no real pointer capture).
// We capture the handler so tests can invoke it directly.
let capturedDragHandler: ((state: object) => void) | null = null;

vi.mock('@use-gesture/react', () => ({
  useDrag: (handler: (state: object) => void) => {
    capturedDragHandler = handler;
    return () => ({
      onPointerDown: (e: PointerEvent) => void e,
    });
  },
}));

// ── urlUtils mock ─────────────────────────────────────────────────────────────
vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return { ...actual, getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1') };
});

// ── React Router mock ─────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// ── Framer Motion mock ────────────────────────────────────────────────────────
// animate() is async in the real library; we call onComplete immediately so
// onSwipeRight/Left fires synchronously in tests.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    animate: (_target: unknown, _value: unknown, opts: { onComplete?: () => void } = {}) => {
      opts.onComplete?.();
      return { stop: () => {} };
    },
  };
});

import PostCard from './PostCard';
import { type PostView, savePost } from '../lib/lemmy';
import { SettingsProvider } from '../lib/SettingsContext';

const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

const MOCK_POST = {
  post: { id: 1, name: 'Rust post', body: null, url: 'https://example.com', thumbnail_url: null },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'bob', actor_id: 'https://lemmy.world/u/bob', avatar: undefined },
  counts: { score: 200, comments: 15 },
} as unknown as PostView;

describe('PostCard', () => {
  it('renders post title', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    expect(screen.getByText('Rust post')).toBeInTheDocument();
  });

  it('renders community name', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    expect(screen.getByText(/programming/i)).toBeInTheDocument();
  });

  it('navigates to user profile when creator name is tapped', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('bob'));
    expect(mockNavigate).toHaveBeenCalledWith('/user/lemmy.world/bob');
  });

  it('navigates to community feed when community name is clicked', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('c/programming'));
    expect(mockNavigate).toHaveBeenCalledWith('/community/lemmy.world/programming');
  });

  it('calls navigator.share when share button is tapped and share API available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, writable: true, configurable: true });

    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('share-button'));
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Rust post',
      url: 'https://stakswipe.com/#/post/lemmy.world/1',
    });
  });

  it('copies to clipboard when share API unavailable', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, writable: true, configurable: true });

    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('share-button'));
    expect(writeTextMock).toHaveBeenCalledWith('https://stakswipe.com/#/post/lemmy.world/1');
  });

  it('renders a Comment button in the footer', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    expect(screen.getByTestId('comment-button')).toBeInTheDocument();
  });

  it('clicking Comment button shows Commenting on post header in sheet', async () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('comment-button'));
    expect(screen.getByText(/commenting on post/i)).toBeInTheDocument();
  });

  it('clicking edit button on own comment opens edit sheet and calls editComment on submit', async () => {
    const { fetchComments, editComment } = await import('../lib/lemmy');
    vi.mocked(fetchComments).mockResolvedValueOnce([
      {
        comment: { id: 7, content: 'My comment', path: '0.7', ap_id: 'https://lemmy.world/comment/7' },
        creator: { name: 'alice', actor_id: 'https://lemmy.world/u/alice', avatar: undefined, display_name: null },
        counts: { score: 1 },
      } as never,
    ]);
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByText(/editing your comment/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Edited text' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(editComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 'Edited text');
  });

  it('submitting a new comment calls createComment without parentId and adds it locally', async () => {
    const { createComment } = await import('../lib/lemmy');
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('comment-button'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Top level comment' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(createComment).toHaveBeenCalledWith('lemmy.world', 'tok', 1, 'Top level comment', undefined);
  });
});

describe('PostCard gestures', () => {
  beforeEach(() => {
    capturedDragHandler = null;
  });

  it('calls onSwipeRight when dragged far right', () => {
    const onSwipeRight = vi.fn();
    const { container } = render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: 200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: 200, clientY: 0 });

    capturedDragHandler!({ movement: [200, 0], velocity: [0, 0], last: true });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('calls onSwipeLeft when dragged far left', () => {
    const onSwipeLeft = vi.fn();
    const { container } = render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={onSwipeLeft}
        onUndo={vi.fn()}
      />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: -200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: -200, clientY: 0 });

    capturedDragHandler!({ movement: [-200, 0], velocity: [0, 0], last: true });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('calls onUndo when scroll content is pulled down 80px from the top', () => {
    const onUndo = vi.fn();
    const { getByTestId } = render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={onUndo}
      />
    );
    const scrollContent = getByTestId('scroll-content');
    fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(scrollContent, { touches: [{ clientY: 90 }] });
    fireEvent.touchEnd(scrollContent);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('does not call onUndo when pull delta is below 80px', () => {
    const onUndo = vi.fn();
    const { getByTestId } = render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={onUndo}
      />
    );
    const scrollContent = getByTestId('scroll-content');
    fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(scrollContent, { touches: [{ clientY: 50 }] });
    fireEvent.touchEnd(scrollContent);
    expect(onUndo).not.toHaveBeenCalled();
  });
});

describe('PostCard save button', () => {
  it('renders a Save button in the footer', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('clicking save button calls savePost API', async () => {
    render(
      <SettingsProvider>
        <PostCard
          post={MOCK_POST}
          auth={AUTH}
          zIndex={1}
          scale={1}
          onSwipeRight={vi.fn()}
          onSwipeLeft={vi.fn()}
          onUndo={vi.fn()}
        />
      </SettingsProvider>,
    );
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1));
  });

  it('shows Saved toast after save button is tapped', async () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });
});

describe('PostCard header stats', () => {
  it('renders score in the meta header', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    expect(screen.getByTestId('meta-score')).toHaveTextContent('▲ 200');
  });

  it('renders comment count in the meta header', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    expect(screen.getByTestId('meta-comments')).toHaveTextContent('💬 15');
  });
});

describe('PostCard reply submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createComment with correct args when a reply is submitted', async () => {
    const { fetchComments, createComment } = await import('../lib/lemmy');
    const mockComment = {
      comment: { id: 1, content: 'Original comment', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
      creator: { name: 'alice', display_name: null },
      counts: { score: 5 },
    };
    (fetchComments as ReturnType<typeof vi.fn>).mockResolvedValue([mockComment]);

    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );

    await waitFor(() => screen.getByText('Original comment'));

    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    expect(createComment).toHaveBeenCalledWith(
      'lemmy.world', 'tok', 1, 'My reply', 1
    );
  });
});

describe('PostCard reply keyboard offset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock visualViewport — jsdom doesn't implement it.
    const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
    const vv = {
      height: 812,
      offsetTop: 0,
      addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners[type] = listeners[type] ?? [];
        listeners[type].push(fn);
      },
      removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
      },
      _fire: (type: string) => {
        for (const fn of listeners[type] ?? []) {
          if (typeof fn === 'function') fn(new Event(type));
          else fn.handleEvent(new Event(type));
        }
      },
    };
    vi.stubGlobal('innerHeight', 812);
    vi.stubGlobal('visualViewport', vv);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shifts the reply wrapper bottom up when the keyboard appears', async () => {
    const { fetchComments } = await import('../lib/lemmy');
    const mockComment = {
      comment: { id: 1, content: 'Test comment', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
      creator: { name: 'alice', display_name: null },
      counts: { score: 5 },
    };
    (fetchComments as ReturnType<typeof vi.fn>).mockResolvedValue([mockComment]);

    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    );

    await waitFor(() => screen.getByText('Test comment'));
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));

    const replyWrapper = screen.getByTestId('reply-wrapper');
    expect(replyWrapper).toHaveStyle('bottom: 0px');

    // Simulate keyboard appearing: visual viewport shrinks by 400px
    (window.visualViewport as any).height = 412;
    (window.visualViewport as any)._fire('resize');

    await waitFor(() => {
      expect(replyWrapper).toHaveStyle('bottom: 400px');
    });
  });
});

describe('PostCard link banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const LINK_POST = {
    post: { id: 2, name: 'Link post', body: null, url: 'https://techcrunch.com/article', thumbnail_url: null },
    community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
    creator: { name: 'carol' },
    counts: { score: 50, comments: 5 },
  } as unknown as PostView;

  const IMAGE_POST = {
    post: { id: 3, name: 'Image post', body: null, url: 'https://example.com/photo.jpg', thumbnail_url: null },
    community: { name: 'pics', actor_id: 'https://lemmy.world/c/pics' },
    creator: { name: 'dave' },
    counts: { score: 10, comments: 0 },
  } as unknown as PostView;

  const TEXT_POST = {
    post: { id: 4, name: 'Text post', body: 'Hello world', url: null, thumbnail_url: null },
    community: { name: 'general', actor_id: 'https://lemmy.world/c/general' },
    creator: { name: 'eve' },
    counts: { score: 3, comments: 1 },
  } as unknown as PostView;

  it('renders the link banner for a link post', () => {
    render(
      <PostCard post={LINK_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onUndo={vi.fn()} />
    );
    expect(screen.getByTestId('link-banner')).toBeInTheDocument();
  });

  it('shows the extracted domain in the banner', () => {
    render(
      <PostCard post={LINK_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onUndo={vi.fn()} />
    );
    expect(screen.getByText('techcrunch.com')).toBeInTheDocument();
  });

  it('does not render the banner for an image URL post', () => {
    render(
      <PostCard post={IMAGE_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onUndo={vi.fn()} />
    );
    expect(screen.queryByTestId('link-banner')).not.toBeInTheDocument();
  });

  it('does not render the banner for a text post', () => {
    render(
      <PostCard post={TEXT_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onUndo={vi.fn()} />
    );
    expect(screen.queryByTestId('link-banner')).not.toBeInTheDocument();
  });

  it('opens the link in a new tab when the banner is clicked', () => {
    render(
      <PostCard post={LINK_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onUndo={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('link-banner'));
    expect(window.open).toHaveBeenCalledWith(
      'https://techcrunch.com/article',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('renders a link in the post body as an anchor tag', () => {
    const MARKDOWN_POST = {
      post: { id: 5, name: 'Markdown post', body: 'Visit [example](https://example.com)', url: null, thumbnail_url: null },
      community: { name: 'general', actor_id: 'https://lemmy.world/c/general' },
      creator: { name: 'frank', actor_id: 'https://lemmy.world/u/frank', avatar: undefined },
      counts: { score: 1, comments: 0 },
    } as unknown as PostView;

    render(
      <PostCard post={MARKDOWN_POST} auth={AUTH} zIndex={1} scale={1}
        onSwipeRight={vi.fn()} onSwipeLeft={vi.fn()} onUndo={vi.fn()} />,
    );
    const link = screen.getByRole('link', { name: 'example' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

const NSFW_POST = {
  post: { id: 2, name: 'NSFW Post', body: null, url: null, thumbnail_url: 'https://example.com/thumb.jpg', nsfw: true },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'bob', actor_id: 'https://lemmy.world/u/bob', avatar: undefined },
  counts: { score: 5, comments: 0 },
} as unknown as PostView;

function renderCard(post = MOCK_POST) {
  return render(
    <PostCard
      post={post}
      auth={AUTH}
      zIndex={1}
      scale={1}
      onSwipeRight={vi.fn()}
      onSwipeLeft={vi.fn()}
      onUndo={vi.fn()}
    />
  );
}

describe('PostCard NSFW blur', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows blur overlay on image when post is nsfw and blurNsfw is true (default)', () => {
    renderCard(NSFW_POST);
    expect(screen.getByTestId('nsfw-blur-overlay')).toBeInTheDocument();
    expect(screen.getByText(/tap to reveal nsfw/i)).toBeInTheDocument();
  });

  it('hides image behind blur before reveal', () => {
    renderCard(NSFW_POST);
    // The img should not be directly visible — it should be under the overlay
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('removes overlay and shows image when tapped', () => {
    renderCard(NSFW_POST);
    fireEvent.click(screen.getByTestId('nsfw-blur-overlay'));
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('reveals image when Enter key is pressed on overlay', () => {
    renderCard(NSFW_POST);
    fireEvent.keyDown(screen.getByTestId('nsfw-blur-overlay'), { key: 'Enter' });
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('does not show blur overlay on non-nsfw posts', () => {
    renderCard(MOCK_POST);
    // MOCK_POST has url but no nsfw flag — no overlay
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
  });

  it('does not show blur overlay when blurNsfw setting is off', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      leftSwipe: 'downvote', blurNsfw: false, defaultSort: 'TopTwelveHour',
    }));
    render(
      <SettingsProvider>
        <PostCard
          post={NSFW_POST}
          auth={AUTH}
          zIndex={1}
          scale={1}
          onSwipeRight={vi.fn()}
          onSwipeLeft={vi.fn()}
          onUndo={vi.fn()}
        />
      </SettingsProvider>
    );
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
