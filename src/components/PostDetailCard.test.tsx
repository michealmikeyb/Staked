import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: () => ({ comments: [], commentsLoaded: true, resolvedInstanceRef: { current: '' }, resolvedTokenRef: { current: '' } }),
}));

vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return { ...actual, getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1') };
});

import PostDetailCard from './PostDetailCard';

const POST = { id: 1, name: 'A shared post', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null };
const COMMUNITY = { name: 'linux', actor_id: 'https://lemmy.world/c/linux' };
const CREATOR = { name: 'alice', display_name: null };
const COUNTS = { score: 10, comments: 2 };
const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

const mockPost = {
  id: 1,
  name: 'Test Post Title',
  ap_id: 'https://lemmy.world/post/1',
  url: null,
  body: 'Post body text',
  thumbnail_url: null,
};

const mockCommunity = {
  name: 'technology',
  actor_id: 'https://lemmy.world/c/technology',
};

const mockCreator = { name: 'alice', display_name: null };
const mockCounts = { score: 42, comments: 7 };
const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

function renderCard(overrides: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <PostDetailCard
        post={mockPost}
        community={mockCommunity}
        creator={mockCreator}
        counts={mockCounts}
        auth={mockAuth}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PostDetailCard', () => {
  it('renders without auth (anonymous mode)', () => {
    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />);
    expect(screen.getByText('A shared post')).toBeInTheDocument();
  });

  it('does not render ReplySheet when auth is absent', () => {
    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />);
    expect(screen.queryByTestId('reply-wrapper')).not.toBeInTheDocument();
  });

  it('renders with auth (authenticated mode)', () => {
    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} auth={AUTH} />);
    expect(screen.getByText('A shared post')).toBeInTheDocument();
  });

  it('renders post title', () => {
    renderCard();
    expect(screen.getByText('Test Post Title')).toBeInTheDocument();
  });

  it('renders community name', () => {
    renderCard();
    expect(screen.getByText('c/technology')).toBeInTheDocument();
  });

  it('renders post body', () => {
    renderCard();
    expect(screen.getByText('Post body text')).toBeInTheDocument();
  });

  it('renders score and comment count', () => {
    renderCard();
    expect(screen.getByText(/▲ 42/)).toBeInTheDocument();
    expect(screen.getByText(/💬 7/)).toBeInTheDocument();
  });

  it('renders image when post.url is an image', () => {
    renderCard({ post: { ...mockPost, url: 'https://example.com/photo.jpg' } });
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders link banner when post.url is not an image', () => {
    renderCard({ post: { ...mockPost, url: 'https://example.com/article' } });
    expect(screen.getByText('Tap to open link')).toBeInTheDocument();
  });

  it('does not render link banner or image when no url', () => {
    renderCard();
    expect(screen.queryByText('Tap to open link')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders share button when auth is present', () => {
    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} auth={AUTH} />);
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
  });

  it('renders share button when auth is absent (anonymous users can share)', () => {
    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />);
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
  });

  it('calls navigator.share when share button clicked and API available', () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, writable: true, configurable: true });

    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} auth={AUTH} />);
    fireEvent.click(screen.getByTestId('share-button'));

    expect(shareMock).toHaveBeenCalledWith({
      title: 'A shared post',
      url: 'https://stakswipe.com/#/post/lemmy.world/1',
    });
  });

  it('copies to clipboard when share API unavailable', () => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, writable: true, configurable: true });

    render(<PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} auth={AUTH} />);
    fireEvent.click(screen.getByTestId('share-button'));

    expect(writeTextMock).toHaveBeenCalledWith('https://stakswipe.com/#/post/lemmy.world/1');
  });
});
