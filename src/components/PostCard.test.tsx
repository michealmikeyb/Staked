import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act, waitFor, fireEvent } from '@testing-library/react';
import { renderWithBackend, makeComment, makeUser } from '../test-utils';
import type { RenderWithBackendOptions } from '../test-utils';
import { SettingsProvider } from '../lib/SettingsContext';

// ── Gesture mock ──────────────────────────────────────────────────────────────
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
  return {
    ...actual,
    getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
    buildShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
  };
});

// ── React Router mock ─────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// ── Framer Motion mock ────────────────────────────────────────────────────────
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

// ── lib/lemmy mock for ReportSheet ────────────────────────────────────────────
vi.mock('../lib/lemmy', () => ({
  reportPost: vi.fn().mockResolvedValue(undefined),
  reportComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

import PostCard from './PostCard';
import { makePost, makeSource, makeUser } from '../test-utils';

const NEUTRAL_POST_ID = '1|https://lemmy.world/post/1';
const SOURCE = makeSource({ handle: 'programming@lemmy.world', name: 'programming' });
const AUTHOR = makeUser({ handle: 'bob@lemmy.world' });
const MOCK_POST = makePost({
  id: NEUTRAL_POST_ID,
  title: 'Rust post',
  source: SOURCE,
  author: AUTHOR,
  externalUrl: 'https://example.com',
  counts: { score: 200, comments: 15 },
});

function renderCard(props: Partial<Parameters<typeof PostCard>[0]> = {}, opts: RenderWithBackendOptions = {}) {
  return renderWithBackend(
    <SettingsProvider>
      <PostCard
        post={MOCK_POST}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
        {...props}
      />
    </SettingsProvider>,
    opts,
  );
}

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });

describe('PostCard', () => {
  it('renders post title', () => {
    renderCard();
    expect(screen.getByText('Rust post')).toBeInTheDocument();
  });

  it('renders community name', () => {
    renderCard();
    expect(screen.getByText(/programming/i)).toBeInTheDocument();
  });

  it('navigates to user profile when creator name is tapped', () => {
    renderCard();
    fireEvent.click(screen.getByText('bob'));
    expect(mockNavigate).toHaveBeenCalledWith('/user/lemmy.world/bob');
  });

  it('navigates to community feed when community name is clicked', () => {
    renderCard();
    fireEvent.click(screen.getByText('c/programming'));
    expect(mockNavigate).toHaveBeenCalledWith('/community/lemmy.world/programming');
  });

  it('calls navigator.share when share button is tapped and share API available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, writable: true, configurable: true });
    renderCard();
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
    renderCard();
    fireEvent.click(screen.getByTestId('share-button'));
    expect(writeTextMock).toHaveBeenCalledWith('https://stakswipe.com/#/post/lemmy.world/1');
  });

  it('renders a Comment button in the footer', () => {
    renderCard();
    expect(screen.getByTestId('comment-button')).toBeInTheDocument();
  });

  it('clicking Comment button shows Commenting on post header in sheet', async () => {
    renderCard();
    fireEvent.click(screen.getByTestId('comment-button'));
    expect(screen.getByText(/commenting on post/i)).toBeInTheDocument();
  });

  it('clicking edit button on own comment opens edit sheet and calls backend.comments.edit on submit', async () => {
    const ownComment = makeComment({
      id: '7|https://lemmy.world/comment/7',
      body: 'My comment',
      author: makeUser({ handle: 'viewer@mock.test' }),
    });
    const { backend } = renderCard({}, {
      fixtures: { comments: { [NEUTRAL_POST_ID]: [ownComment] } },
    });
    const editSpy = vi.spyOn(backend.comments, 'edit').mockResolvedValueOnce({ ...ownComment, body: 'Edited text' });

    await waitFor(() => expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByText(/editing your comment/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Edited text' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(editSpy).toHaveBeenCalledWith(ownComment.id, 'Edited text');
  });

  it('submitting a new comment calls backend.comments.create without parentId', async () => {
    const { backend } = renderCard();
    const createSpy = vi.spyOn(backend.comments, 'create');
    fireEvent.click(screen.getByTestId('comment-button'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Top level comment' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(createSpy).toHaveBeenCalledWith({
      postId: NEUTRAL_POST_ID,
      parentId: undefined,
      body: 'Top level comment',
    });
  });
});

describe('PostCard gestures', () => {
  beforeEach(() => {
    capturedDragHandler = null;
  });

  it('calls onSwipeRight when dragged far right', () => {
    const onSwipeRight = vi.fn();
    const { container } = renderCard({ onSwipeRight });
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: 200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: 200, clientY: 0 });
    capturedDragHandler!({ movement: [200, 0], velocity: [0, 0], last: true });
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('calls onSwipeLeft when dragged far left', () => {
    const onSwipeLeft = vi.fn();
    const { container } = renderCard({ onSwipeLeft });
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: -200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: -200, clientY: 0 });
    capturedDragHandler!({ movement: [-200, 0], velocity: [0, 0], last: true });
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('calls onUndo when scroll content is pulled down 80px from the top', () => {
    const onUndo = vi.fn();
    renderCard({ onUndo });
    const scrollContent = screen.getByTestId('scroll-content');
    fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(scrollContent, { touches: [{ clientY: 90 }] });
    fireEvent.touchEnd(scrollContent);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('does not call onUndo when pull delta is below 80px', () => {
    const onUndo = vi.fn();
    renderCard({ onUndo });
    const scrollContent = screen.getByTestId('scroll-content');
    fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(scrollContent, { touches: [{ clientY: 50 }] });
    fireEvent.touchEnd(scrollContent);
    expect(onUndo).not.toHaveBeenCalled();
  });
});

describe('PostCard save button', () => {
  it('renders a Save button in the footer', () => {
    renderCard();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('clicking save button calls backend.posts.save', async () => {
    const { backend } = renderCard();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(backend.state.saves[NEUTRAL_POST_ID]).toBe(true));
  });

  it('shows Saved toast after save button is tapped', async () => {
    renderCard();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });
});

describe('PostCard header stats', () => {
  it('renders score in the meta header', () => {
    renderCard();
    expect(screen.getByTestId('meta-score')).toHaveTextContent('▲ 200');
  });

  it('renders comment count in the meta header', () => {
    renderCard();
    expect(screen.getByTestId('meta-comments')).toHaveTextContent('💬 15');
  });
});

describe('PostCard reply submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls backend.comments.create with parentId when a reply is submitted', async () => {
    const mockComment = makeComment({
      id: '1|https://lemmy.world/comment/1',
      body: 'Original comment',
      author: makeUser({ handle: 'alice@lemmy.world' }),
    });
    const { backend } = renderCard({}, {
      fixtures: { comments: { [NEUTRAL_POST_ID]: [mockComment] } },
    });
    const createSpy = vi.spyOn(backend.comments, 'create');

    await waitFor(() => screen.getByText('Original comment'));
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My reply' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    expect(createSpy).toHaveBeenCalledWith({
      postId: NEUTRAL_POST_ID,
      parentId: mockComment.id,
      body: 'My reply',
    });
  });
});

describe('PostCard reply keyboard offset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const mockComment = makeComment({
      id: '1|https://lemmy.world/comment/1',
      body: 'Test comment',
      author: makeUser({ handle: 'alice@lemmy.world' }),
    });
    renderCard({}, {
      fixtures: { comments: { [NEUTRAL_POST_ID]: [mockComment] } },
    });

    await waitFor(() => screen.getByText('Test comment'));
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));

    const replyWrapper = screen.getByTestId('reply-wrapper');
    expect(replyWrapper).toHaveStyle('bottom: 0px');

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

  const LINK_POST = makePost({ title: 'Link post', externalUrl: 'https://techcrunch.com/article' });
  const IMAGE_POST = makePost({ title: 'Image post', externalUrl: 'https://example.com/photo.jpg' });
  const TEXT_POST = makePost({ title: 'Text post', body: 'Hello world' });

  it('renders the link banner for a link post', () => {
    renderCard({ post: LINK_POST });
    expect(screen.getByTestId('link-banner')).toBeInTheDocument();
  });

  it('shows the extracted domain in the banner', () => {
    renderCard({ post: LINK_POST });
    expect(screen.getByText('techcrunch.com')).toBeInTheDocument();
  });

  it('does not render the banner for an image URL post', () => {
    renderCard({ post: IMAGE_POST });
    expect(screen.queryByTestId('link-banner')).not.toBeInTheDocument();
  });

  it('does not render the banner for a text post', () => {
    renderCard({ post: TEXT_POST });
    expect(screen.queryByTestId('link-banner')).not.toBeInTheDocument();
  });

  it('opens the link in a new tab when the banner is clicked', () => {
    renderCard({ post: LINK_POST });
    fireEvent.click(screen.getByTestId('link-banner'));
    expect(window.open).toHaveBeenCalledWith(
      'https://techcrunch.com/article',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('renders a link in the post body as an anchor tag', () => {
    const MARKDOWN_POST = makePost({ title: 'Markdown post', body: 'Visit [example](https://example.com)' });
    renderCard({ post: MARKDOWN_POST });
    const link = screen.getByRole('link', { name: 'example' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

const NSFW_POST = makePost({ title: 'NSFW Post', mediaUrl: 'https://example.com/thumb.jpg', nsfw: true });

describe('PostCard NSFW blur', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows blur overlay on image when post is nsfw and blurNsfw is true (default)', () => {
    renderCard({ post: NSFW_POST });
    expect(screen.getByTestId('nsfw-blur-overlay')).toBeInTheDocument();
    expect(screen.getByText(/tap to reveal nsfw/i)).toBeInTheDocument();
  });

  it('hides image behind blur before reveal', () => {
    renderCard({ post: NSFW_POST });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('removes overlay and shows image when tapped', () => {
    renderCard({ post: NSFW_POST });
    fireEvent.click(screen.getByTestId('nsfw-blur-overlay'));
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('reveals image when Enter key is pressed on overlay', () => {
    renderCard({ post: NSFW_POST });
    fireEvent.keyDown(screen.getByTestId('nsfw-blur-overlay'), { key: 'Enter' });
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('does not show blur overlay on non-nsfw posts', () => {
    renderCard({ post: MOCK_POST });
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
  });

  it('does not show blur overlay when blurNsfw setting is off', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      nonUpvoteSwipeAction: 'downvote', swapGestures: false, blurNsfw: false, defaultSort: 'TopTwelveHour',
    }));
    renderCard({ post: NSFW_POST });
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
