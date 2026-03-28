import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CommentsPanel from './CommentsPanel';
import { type PostView, type CommentView } from '../lib/lemmy';

const MOCK_POST = {
  post: { id: 1, name: 'Test Post', body: null, url: null, thumbnail_url: null },
  community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
  creator: { name: 'alice' },
  counts: { score: 847, comments: 2 },
} as unknown as PostView;

const MOCK_COMMENTS: CommentView[] = [
  {
    comment: { id: 10, content: 'Great article!', path: '0.10', published: '' },
    creator: { name: 'bob' },
    counts: { score: 42 },
  } as unknown as CommentView,
  {
    comment: { id: 11, content: 'I disagree.', path: '0.10.11', published: '' },
    creator: { name: 'carol' },
    counts: { score: 5 },
  } as unknown as CommentView,
];

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([
    {
      comment: { id: 10, content: 'Great article!', path: '0.10', published: '' },
      creator: { name: 'bob' },
      counts: { score: 42 },
    },
    {
      comment: { id: 11, content: 'I disagree.', path: '0.10.11', published: '' },
      creator: { name: 'carol' },
      counts: { score: 5 },
    },
  ]),
}));

const AUTH = { token: 't', instance: 'lemmy.world', username: 'u' };

describe('CommentsPanel', () => {
  it('shows post title in pinned header', () => {
    render(<CommentsPanel post={MOCK_POST} auth={AUTH} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText('Test Post')).toBeInTheDocument();
  });

  it('loads and renders comments', async () => {
    render(<CommentsPanel post={MOCK_POST} auth={AUTH} onClose={vi.fn()} onSave={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Great article!')).toBeInTheDocument();
      expect(screen.getByText('I disagree.')).toBeInTheDocument();
    });
  });

  it('indents replies based on path depth', async () => {
    const { container } = render(<CommentsPanel post={MOCK_POST} auth={AUTH} onClose={vi.fn()} onSave={vi.fn()} />);
    await waitFor(() => screen.getByText('I disagree.'));
    const comments = container.querySelectorAll('[data-depth]');
    expect(Number(comments[0].getAttribute('data-depth'))).toBe(1);
    expect(Number(comments[1].getAttribute('data-depth'))).toBe(2);
  });
});
