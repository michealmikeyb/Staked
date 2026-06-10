import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithBackend, makePost, makeComment } from '../test-utils';
import CommentsPanel from './CommentsPanel';

const MOCK_POST = makePost({ id: '1', title: 'Test Post', counts: { score: 847, comments: 2 } });
const COMMENTS = [
  makeComment({ id: '10', postId: '1', body: 'Great article!', depth: 1 }),
  makeComment({ id: '11', postId: '1', body: 'I disagree.', depth: 2 }),
];

function renderPanel() {
  return renderWithBackend(
    <CommentsPanel post={MOCK_POST} onClose={vi.fn()} onSave={vi.fn()} />,
    { fixtures: { comments: { '1': COMMENTS } } },
  );
}

describe('CommentsPanel', () => {
  it('shows post title in pinned header', () => {
    renderPanel();
    expect(screen.getByText('Test Post')).toBeInTheDocument();
  });

  it('loads and renders comments', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Great article!')).toBeInTheDocument();
      expect(screen.getByText('I disagree.')).toBeInTheDocument();
    });
  });

  it('indents replies based on depth', async () => {
    const { container } = renderPanel();
    await waitFor(() => screen.getByText('I disagree.'));
    const comments = container.querySelectorAll('[data-depth]');
    expect(Number(comments[0].getAttribute('data-depth'))).toBe(1);
    expect(Number(comments[1].getAttribute('data-depth'))).toBe(2);
  });
});
