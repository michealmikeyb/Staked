import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithBackend } from '../test-utils';
import { makeComment } from '../lib/api/backends/mock/fixtures';

vi.mock('../lib/lemmy', () => ({
  reportPost: vi.fn().mockResolvedValue(undefined),
  reportComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return { ...actual, getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/mock.test/1') };
});

import PostDetailCard from './PostDetailCard';
import { SettingsProvider } from '../lib/SettingsContext';

const POST = { id: 1, name: 'A shared post', ap_id: 'https://lemmy.world/post/1', url: null, body: null, thumbnail_url: null };
const COMMUNITY = { name: 'linux', actor_id: 'https://lemmy.world/c/linux' };
const CREATOR = { name: 'alice', display_name: null };
const COUNTS = { score: 10, comments: 2 };

const mockPost = { id: 1, name: 'Test Post Title', ap_id: 'https://lemmy.world/post/1', url: null, body: 'Post body text', thumbnail_url: null };
const mockCommunity = { name: 'technology', actor_id: 'https://lemmy.world/c/technology' };
const mockCreator = { name: 'alice', display_name: null };
const mockCounts = { score: 42, comments: 7 };

function renderCard(props: Record<string, unknown> = {}, anonymous = false) {
  return renderWithBackend(
    <SettingsProvider>
      <PostDetailCard
        post={mockPost}
        community={mockCommunity}
        creator={mockCreator}
        counts={mockCounts}
        {...props}
      />
    </SettingsProvider>,
    { anonymous },
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PostDetailCard', () => {
  it('renders without auth (anonymous mode)', () => {
    renderWithBackend(
      <SettingsProvider>
        <PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />
      </SettingsProvider>,
      { anonymous: true },
    );
    expect(screen.getByText('A shared post')).toBeInTheDocument();
  });

  it('does not render ReplySheet when not logged in', () => {
    renderCard({}, true);
    expect(screen.queryByTestId('reply-wrapper')).not.toBeInTheDocument();
  });

  it('renders with auth (authenticated mode)', () => {
    renderWithBackend(
      <SettingsProvider>
        <PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />
      </SettingsProvider>,
    );
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

  it('renders share button in all cases', () => {
    renderCard({}, true);
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
  });

  it('calls navigator.share when share button clicked and API available', () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, writable: true, configurable: true });
    renderWithBackend(
      <SettingsProvider>
        <PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />
      </SettingsProvider>,
    );
    fireEvent.click(screen.getByTestId('share-button'));
    expect(shareMock).toHaveBeenCalledWith({
      title: 'A shared post',
      url: 'https://stakswipe.com/#/post/mock.test/1',
    });
  });

  it('copies to clipboard when share API unavailable', () => {
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, writable: true, configurable: true });
    renderWithBackend(
      <SettingsProvider>
        <PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} />
      </SettingsProvider>,
    );
    fireEvent.click(screen.getByTestId('share-button'));
    expect(writeTextMock).toHaveBeenCalledWith('https://stakswipe.com/#/post/mock.test/1');
  });

  it('does not show Save or Comment buttons without auth', () => {
    renderCard({}, true);
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-button')).not.toBeInTheDocument();
  });

  it('shows Save and Comment buttons when logged in', () => {
    renderCard();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('comment-button')).toBeInTheDocument();
  });

  it('score and comment count are in metaStats (top)', () => {
    renderCard();
    expect(screen.getByTestId('meta-score')).toHaveTextContent('▲ 42');
    expect(screen.getByTestId('meta-comments')).toHaveTextContent('💬 7');
  });

  it('renders comments from initial load', async () => {
    // neutralPost.id is composed as `${post.id}|${post.ap_id}` = '1|https://lemmy.world/post/1'
    const POST_KEY = `${mockPost.id}|${mockPost.ap_id}`;
    const comments = [
      makeComment({ id: 'c1', body: 'First comment' }),
      makeComment({ id: 'c2', body: 'Second comment' }),
    ];
    renderWithBackend(
      <SettingsProvider>
        <PostDetailCard post={mockPost} community={mockCommunity} creator={mockCreator} counts={mockCounts} />
      </SettingsProvider>,
      { fixtures: { comments: { [POST_KEY]: comments } } },
    );
    await waitFor(() => expect(screen.getByText('First comment')).toBeInTheDocument());
    expect(screen.getByText('Second comment')).toBeInTheDocument();
  });
});
