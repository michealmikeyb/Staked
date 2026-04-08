import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/lemmy', () => ({
  savePost: vi.fn().mockResolvedValue(undefined),
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
  return { ...actual, getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1') };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import PostCardShell from './PostCardShell';
import { savePost } from '../lib/lemmy';

const POST = {
  id: 1, name: 'Test Post', ap_id: 'https://lemmy.world/post/1',
  url: null, body: null, thumbnail_url: null,
};
const COMMUNITY = { name: 'linux', actor_id: 'https://lemmy.world/c/linux' };
const CREATOR = { name: 'alice', display_name: null };
const COUNTS = { score: 42, comments: 7 };
const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

function renderShell(overrides: Record<string, unknown> = {}) {
  return render(
    <PostCardShell
      post={POST}
      community={COMMUNITY}
      creator={CREATOR}
      counts={COUNTS}
      comments={[]}
      commentsLoaded={true}
      auth={AUTH}
      {...overrides}
    />,
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

  it('clicking Save calls savePost with correct args', async () => {
    renderShell();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1));
  });

  it('shows Saved toast after save button is clicked', async () => {
    renderShell();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
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
    const img = document.querySelector('[data-testid="community-icon-img"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://lemmy.world/pictrs/image/icon.png');
  });

  it('renders first-letter fallback when community.icon is absent', () => {
    renderShell({ community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' } });
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="community-icon-img"]')).toBeNull();
  });
});
