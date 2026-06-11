import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SettingsProvider } from '../lib/SettingsContext';
import { renderWithBackend, makePost, makeSource, makeUser } from '../test-utils';
import type { RenderWithBackendOptions } from '../test-utils';

vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return {
    ...actual,
    getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
    buildShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
  };
});

vi.mock('../lib/lemmy', () => ({
  reportPost: vi.fn().mockResolvedValue(undefined),
  reportComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import PostCardShell from './PostCardShell';
import { buildShareUrl } from '../lib/urlUtils';

const SOURCE = makeSource({ handle: 'linux@lemmy.world', name: 'linux' });
const AUTHOR = makeUser({ handle: 'alice@lemmy.world' });
const POST = makePost({
  id: '1|https://lemmy.world/post/1',
  title: 'Test Post',
  permalink: 'https://lemmy.world/post/1',
  externalUrl: undefined,
  body: undefined,
  mediaUrl: undefined,
  counts: { score: 42, comments: 7 },
  source: SOURCE,
  author: AUTHOR,
  viewer: { vote: 0, saved: false },
});

type ShellProps = Partial<React.ComponentProps<typeof PostCardShell>>;

function renderShell(props: ShellProps = {}, opts: RenderWithBackendOptions = {}) {
  return renderWithBackend(
    <SettingsProvider>
      <PostCardShell
        post={POST}
        comments={[]}
        commentsLoaded={true}
        activeSort="Top"
        onSortChange={vi.fn()}
        {...props}
      />
    </SettingsProvider>,
    opts,
  );
}

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });

describe('PostCardShell', () => {
  it('renders post title and community name', () => {
    renderShell();
    expect(screen.getByText('Test Post')).toBeInTheDocument();
    expect(screen.getByText('c/linux')).toBeInTheDocument();
  });

  it('renders score and comment count in metaStats (top of card)', () => {
    renderShell();
    expect(screen.getByTestId('meta-score')).toHaveTextContent('▲ 42');
    expect(screen.getByTestId('meta-comments')).toHaveTextContent('💬 7');
  });

  it('renders Share button without auth', () => {
    renderShell({}, { anonymous: true });
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
  });

  it('hides Save and Comment buttons without auth', () => {
    renderShell({}, { anonymous: true });
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-button')).not.toBeInTheDocument();
  });

  it('shows Save and Comment buttons when logged in', () => {
    renderShell();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('comment-button')).toBeInTheDocument();
  });

  it('clicking Save calls backend.posts.save with save=true', async () => {
    const { backend } = renderShell();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(backend.state.saves[POST.id]).toBe(true));
  });

  it('shows Saved toast after save button is clicked', async () => {
    renderShell();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('save button shows "🔖 Save" when post.viewer.saved is false', () => {
    renderShell({ post: { ...POST, viewer: { vote: 0, saved: false } } });
    expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Save');
  });

  it('save button shows "🔖 Saved" when post.viewer.saved is true', () => {
    renderShell({ post: { ...POST, viewer: { vote: 0, saved: true } } });
    expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Saved');
  });

  it('clicking Saved button calls backend.posts.save with save=false', async () => {
    const { backend } = renderShell({ post: { ...POST, viewer: { vote: 0, saved: true } } });
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(backend.state.saves[POST.id]).toBe(false));
  });

  it('save button toggles to Saved optimistically after clicking Save', async () => {
    renderShell({ post: { ...POST, viewer: { vote: 0, saved: false } } });
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Saved'));
  });

  it('save button reverts to Save when backend.posts.save throws', async () => {
    const { backend } = renderShell({ post: { ...POST, viewer: { vote: 0, saved: false } } });
    backend.posts.save = vi.fn().mockRejectedValueOnce(new Error('fail'));
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Save'));
  });

  it('renders image when externalUrl is an image', () => {
    renderShell({ post: { ...POST, externalUrl: 'https://example.com/photo.jpg' } });
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders link banner when externalUrl is not an image', () => {
    renderShell({ post: { ...POST, externalUrl: 'https://example.com/article' } });
    expect(screen.getByTestId('link-banner')).toBeInTheDocument();
    expect(screen.getByText('Tap to open link')).toBeInTheDocument();
  });

  it('shows NSFW blur overlay for nsfw post with blurNsfw=true', () => {
    renderShell({
      post: { ...POST, externalUrl: 'https://example.com/photo.jpg', nsfw: true },
      blurNsfw: true,
    });
    expect(screen.getByTestId('nsfw-blur-overlay')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('reveals image when NSFW overlay is tapped', () => {
    renderShell({
      post: { ...POST, externalUrl: 'https://example.com/photo.jpg', nsfw: true },
      blurNsfw: true,
    });
    fireEvent.click(screen.getByTestId('nsfw-blur-overlay'));
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows image directly when blurNsfw=false for nsfw post', () => {
    renderShell({
      post: { ...POST, externalUrl: 'https://example.com/photo.jpg', nsfw: true },
      blurNsfw: false,
    });
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('navigates to community page when community name is clicked', () => {
    renderShell();
    fireEvent.click(screen.getByText('c/linux'));
    expect(mockNavigate).toHaveBeenCalledWith('/community/lemmy.world/linux');
  });

  it('navigates to user profile when creator with instance is clicked', () => {
    renderShell({ post: { ...POST, author: makeUser({ handle: 'alice@lemmy.world' }) } });
    fireEvent.click(screen.getByText('alice'));
    expect(mockNavigate).toHaveBeenCalledWith('/user/lemmy.world/alice');
  });

  it('renders creator as plain text when handle has no instance', () => {
    renderShell({ post: { ...POST, author: makeUser({ handle: 'alice' }) } });
    const el = screen.getByText('alice');
    expect(el.tagName).not.toBe('BUTTON');
  });

  it('renders reply-wrapper when logged in', () => {
    renderShell();
    expect(screen.getByTestId('reply-wrapper')).toBeInTheDocument();
  });

  it('does not render reply-wrapper when not logged in', () => {
    renderShell({}, { anonymous: true });
    expect(screen.queryByTestId('reply-wrapper')).not.toBeInTheDocument();
  });

  it('renders community icon image when source.icon is provided', () => {
    const iconSrc = makeSource({ handle: 'linux@lemmy.world', name: 'linux', icon: 'https://lemmy.world/pictrs/image/icon.png' });
    renderShell({ post: { ...POST, source: iconSrc } });
    const img = document.querySelector('[data-testid="community-avatar-img"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://lemmy.world/pictrs/image/icon.png');
  });

  it('renders first-letter fallback when source.icon is absent', () => {
    renderShell();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="community-avatar-img"]')).toBeNull();
  });

  describe('share link format', () => {
    beforeEach(() => {
      localStorage.clear();
      Object.defineProperty(navigator, 'share', {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true,
      });
    });

    it('calls buildShareUrl with stakswipe format by default', () => {
      renderShell();
      fireEvent.click(screen.getByTestId('share-button'));
      expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith(
        'stakswipe',
        { id: 1, ap_id: 'https://lemmy.world/post/1' },
        expect.anything(),
        'https://lemmy.world/c/linux',
      );
    });

    it('calls buildShareUrl with source format when shareLinkFormat=source', () => {
      localStorage.setItem('stakswipe_settings', JSON.stringify({ shareLinkFormat: 'source' }));
      renderShell();
      fireEvent.click(screen.getByTestId('share-button'));
      expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith(
        'source',
        expect.objectContaining({ ap_id: 'https://lemmy.world/post/1' }),
        expect.anything(),
        expect.any(String),
      );
    });

    it('calls buildShareUrl with home format when shareLinkFormat=home', () => {
      localStorage.setItem('stakswipe_settings', JSON.stringify({ shareLinkFormat: 'home' }));
      renderShell();
      fireEvent.click(screen.getByTestId('share-button'));
      expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith(
        'home',
        expect.objectContaining({ ap_id: 'https://lemmy.world/post/1' }),
        expect.anything(),
        expect.any(String),
      );
    });

    it('passes null auth when not authenticated', () => {
      renderShell({}, { anonymous: true });
      fireEvent.click(screen.getByTestId('share-button'));
      expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith(
        'stakswipe',
        expect.objectContaining({ ap_id: 'https://lemmy.world/post/1' }),
        null,
        expect.any(String),
      );
    });
  });

  describe('sort bar', () => {
    beforeEach(() => { localStorage.clear(); });

    it('renders sort pills when showCommentSortBar is true (default)', () => {
      renderShell();
      expect(screen.getByRole('button', { name: /^top$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^new$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^hot$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^old$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^controversial$/i })).toBeInTheDocument();
    });

    it('hides sort pills when showCommentSortBar is false', () => {
      localStorage.setItem('stakswipe_settings', JSON.stringify({ showCommentSortBar: false }));
      renderShell();
      expect(screen.queryByRole('button', { name: /^top$/i })).not.toBeInTheDocument();
    });

    it('active sort pill has orange background', () => {
      renderShell({ activeSort: 'New' });
      expect(screen.getByRole('button', { name: /^new$/i })).toHaveStyle({ background: '#ff6b35' });
    });

    it('clicking a pill calls onSortChange with that sort', () => {
      const onSortChange = vi.fn();
      renderShell({ onSortChange });
      fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
      expect(onSortChange).toHaveBeenCalledWith('Hot');
    });
  });

  it('shows Report button when logged in', () => {
    renderShell();
    expect(screen.getByTestId('report-button')).toBeInTheDocument();
  });

  it('hides Report button when not logged in', () => {
    renderShell({}, { anonymous: true });
    expect(screen.queryByTestId('report-button')).not.toBeInTheDocument();
  });

  it('clicking Report button opens the report sheet', () => {
    renderShell();
    fireEvent.click(screen.getByTestId('report-button'));
    expect(screen.getByText('Report post')).toBeInTheDocument();
  });

  it('calls onLoadMore when sentinel scrolls into view', async () => {
    const onLoadMore = vi.fn();
    // jsdom IntersectionObserver mock
    let observeCallback: IntersectionObserverCallback = () => {};
    const mockObserver = { observe: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal('IntersectionObserver', vi.fn((cb: IntersectionObserverCallback) => {
      observeCallback = cb;
      return mockObserver;
    }));

    renderShell({ onLoadMore, loadingMore: false });

    // Simulate sentinel entering viewport
    await act(async () => {
      observeCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
