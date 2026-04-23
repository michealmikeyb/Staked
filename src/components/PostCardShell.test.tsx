import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsProvider } from '../lib/SettingsContext';
import type { CommentSortType } from '../lib/lemmy';

vi.mock('../lib/lemmy', () => ({
  savePost: vi.fn().mockResolvedValue(undefined),
  deletePost: vi.fn().mockResolvedValue(undefined),
  deleteComment: vi.fn().mockResolvedValue(undefined),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
  editComment: vi.fn().mockResolvedValue({
    comment: { id: 1, content: 'Edited', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
    creator: { name: 'alice', display_name: null },
    counts: { score: 1 },
  }),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return {
    ...actual,
    getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
    buildShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1'),
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import PostCardShell from './PostCardShell';
import { savePost } from '../lib/lemmy';
import { buildShareUrl } from '../lib/urlUtils';

const POST = {
  id: 1, name: 'Test Post', ap_id: 'https://lemmy.world/post/1',
  url: null, body: null, thumbnail_url: null,
};
const COMMUNITY = { name: 'linux', actor_id: 'https://lemmy.world/c/linux' };
const CREATOR = { name: 'alice', display_name: null };
const COUNTS = { score: 42, comments: 7 };
const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

function renderShell(overrides: Record<string, unknown> = {}) {
  const { activeSort = 'Top', onSortChange = vi.fn(), ...rest } = overrides;
  return render(
    <SettingsProvider>
      <PostCardShell
        post={POST}
        community={COMMUNITY}
        creator={CREATOR}
        counts={COUNTS}
        comments={[]}
        commentsLoaded={true}
        auth={AUTH}
        activeSort={activeSort as CommentSortType}
        onSortChange={onSortChange as (s: CommentSortType) => void}
        {...rest}
      />
    </SettingsProvider>,
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
    renderShell({ auth: undefined });
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
  });

  it('hides Save and Comment buttons without auth', () => {
    renderShell({ auth: undefined });
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-button')).not.toBeInTheDocument();
  });

  it('shows Save and Comment buttons with auth', () => {
    renderShell();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('comment-button')).toBeInTheDocument();
  });

  it('clicking Save calls savePost with save=true', async () => {
    renderShell();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1, true));
  });

  it('shows Saved toast after save button is clicked', async () => {
    renderShell();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('save button shows "🔖 Save" when post.saved is false', () => {
    renderShell({ post: { ...POST, saved: false } });
    expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Save');
  });

  it('save button shows "🔖 Saved" when post.saved is true', () => {
    renderShell({ post: { ...POST, saved: true } });
    expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Saved');
  });

  it('clicking Saved button calls savePost with save=false', async () => {
    renderShell({ post: { ...POST, saved: true } });
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1, false));
  });

  it('save button toggles to Saved optimistically after clicking Save', async () => {
    renderShell({ post: { ...POST, saved: false } });
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Saved'));
  });

  it('save button reverts to Save when savePost throws', async () => {
    const { savePost: mockSave } = await import('../lib/lemmy');
    (mockSave as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    renderShell({ post: { ...POST, saved: false } });
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByTestId('save-button')).toHaveTextContent('🔖 Save'));
  });

  it('renders image when post.url is an image', () => {
    renderShell({ post: { ...POST, url: 'https://example.com/photo.jpg' } });
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders link banner when post.url is not an image', () => {
    renderShell({ post: { ...POST, url: 'https://example.com/article' } });
    expect(screen.getByTestId('link-banner')).toBeInTheDocument();
    expect(screen.getByText('Tap to open link')).toBeInTheDocument();
  });

  it('shows NSFW blur overlay for nsfw post with blurNsfw=true', () => {
    renderShell({
      post: { ...POST, url: 'https://example.com/photo.jpg', nsfw: true },
      blurNsfw: true,
    });
    expect(screen.getByTestId('nsfw-blur-overlay')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('reveals image when NSFW overlay is tapped', () => {
    renderShell({
      post: { ...POST, url: 'https://example.com/photo.jpg', nsfw: true },
      blurNsfw: true,
    });
    fireEvent.click(screen.getByTestId('nsfw-blur-overlay'));
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows image directly when blurNsfw=false for nsfw post', () => {
    renderShell({
      post: { ...POST, url: 'https://example.com/photo.jpg', nsfw: true },
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

  it('navigates to user profile when creator with actor_id is clicked', () => {
    renderShell({
      creator: { name: 'alice', display_name: null, actor_id: 'https://lemmy.world/u/alice' },
    });
    fireEvent.click(screen.getByText('alice'));
    expect(mockNavigate).toHaveBeenCalledWith('/user/lemmy.world/alice');
  });

  it('renders creator as plain text when no actor_id', () => {
    renderShell({ creator: { name: 'alice', display_name: null } });
    const el = screen.getByText('alice');
    expect(el.tagName).not.toBe('BUTTON');
  });

  it('renders reply-wrapper when auth is present', () => {
    renderShell();
    expect(screen.getByTestId('reply-wrapper')).toBeInTheDocument();
  });

  it('does not render reply-wrapper when auth is absent', () => {
    renderShell({ auth: undefined });
    expect(screen.queryByTestId('reply-wrapper')).not.toBeInTheDocument();
  });

  it('renders community icon image when community.icon is provided', () => {
    renderShell({
      community: {
        name: 'linux',
        actor_id: 'https://lemmy.world/c/linux',
        icon: 'https://lemmy.world/pictrs/image/icon.png',
      },
    });
    const img = document.querySelector('[data-testid="community-avatar-img"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://lemmy.world/pictrs/image/icon.png');
  });

  it('renders first-letter fallback when community.icon is absent', () => {
    renderShell({ community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' } });
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
      expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith('stakswipe', POST, AUTH, COMMUNITY.actor_id);
    });

    it('calls buildShareUrl with source format when shareLinkFormat=source', () => {
      localStorage.setItem('stakswipe_settings', JSON.stringify({ shareLinkFormat: 'source' }));
      renderShell();
      fireEvent.click(screen.getByTestId('share-button'));
      expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith('source', POST, AUTH, COMMUNITY.actor_id);
    });

    it('calls buildShareUrl with home format when shareLinkFormat=home', () => {
      localStorage.setItem('stakswipe_settings', JSON.stringify({ shareLinkFormat: 'home' }));
      renderShell();
      fireEvent.click(screen.getByTestId('share-button'));
      expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith('home', POST, AUTH, COMMUNITY.actor_id);
    });

    it('passes null auth when not authenticated', () => {
      renderShell({ auth: undefined });
      fireEvent.click(screen.getByTestId('share-button'));
      expect(vi.mocked(buildShareUrl)).toHaveBeenCalledWith('stakswipe', POST, null, COMMUNITY.actor_id);
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
});
