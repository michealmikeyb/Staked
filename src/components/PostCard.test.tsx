import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PostCard from './PostCard';
import { type PostView } from '../lib/lemmy';

const MOCK_POST = {
  post: { id: 1, name: 'Rust post', body: null, url: 'https://example.com', thumbnail_url: null },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'bob' },
  counts: { score: 200, comments: 15 },
} as unknown as PostView;

describe('PostCard', () => {
  it('renders post title', () => {
    render(
      <PostCard
        post={MOCK_POST}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onOpenComments={vi.fn()}
      />
    );
    expect(screen.getByText('Rust post')).toBeInTheDocument();
  });

  it('renders community name', () => {
    render(
      <PostCard
        post={MOCK_POST}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onOpenComments={vi.fn()}
      />
    );
    expect(screen.getByText(/programming/i)).toBeInTheDocument();
  });
});
