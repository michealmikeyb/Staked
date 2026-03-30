import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PostDetailCard from './PostDetailCard';

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'reply', ap_id: 'https://lemmy.world/comment/99', path: '0.99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 0 },
  }),
}));

vi.mock('../hooks/useCommentLoader', () => ({
  useCommentLoader: vi.fn().mockReturnValue({
    comments: [],
    commentsLoaded: true,
    resolvedInstanceRef: { current: 'lemmy.world' },
    resolvedTokenRef: { current: 'tok' },
  }),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

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

function renderCard(overrides = {}) {
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
});
