import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import CommentItem from './CommentItem';
import { SettingsProvider } from '../lib/SettingsContext';
import { renderWithBackend, makeComment, makeUser } from '../test-utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockComment = makeComment({
  id: '7',
  depth: 0,
  author: makeUser({ handle: 'alice@beehaw.org', profileUrl: 'https://beehaw.org/u/alice' }),
  body: '**Bold** and ![img](https://example.com/img.png)',
  counts: { score: 10 },
});

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); localStorage.clear(); });

function renderItem(props: Partial<React.ComponentProps<typeof CommentItem>> = {}) {
  return renderWithBackend(
    <SettingsProvider>
      <CommentItem comment={mockComment} onReply={vi.fn()} {...props} />
    </SettingsProvider>
  );
}

function mockCommentGeometry(el: HTMLElement) {
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0, width: 200, top: 0, right: 200, bottom: 100, height: 100, x: 0, y: 0,
    toJSON: () => {},
  });
}

describe('CommentItem', () => {
  it('renders the author and score', () => {
    renderItem();
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    renderItem();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.png');
    expect(screen.getByText('Bold')).toBeInTheDocument();
  });

  it('right-half double-tap votes 1 and increments score', async () => {
    const { backend } = renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 150 });
      fireEvent.click(item, { clientX: 150 });
    });
    expect(backend.state.votes[mockComment.id]).toBe(1);
    expect(screen.getByText(/11/)).toBeInTheDocument();
  });

  it('left-half double-tap votes -1 and decrements score', async () => {
    const { backend } = renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 50 });
      fireEvent.click(item, { clientX: 50 });
    });
    expect(backend.state.votes[mockComment.id]).toBe(-1);
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });

  it('second right-half double-tap removes upvote (score 0)', async () => {
    const { backend } = renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 150 });
      fireEvent.click(item, { clientX: 150 });
    });
    await act(async () => {
      fireEvent.click(item, { clientX: 150 });
      fireEvent.click(item, { clientX: 150 });
    });
    expect(backend.state.votes[mockComment.id]).toBe(0);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('second left-half double-tap removes downvote (score 0)', async () => {
    const { backend } = renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 50 });
      fireEvent.click(item, { clientX: 50 });
    });
    await act(async () => {
      fireEvent.click(item, { clientX: 50 });
      fireEvent.click(item, { clientX: 50 });
    });
    expect(backend.state.votes[mockComment.id]).toBe(0);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('right-half then left-half double-tap switches directly to downvote', async () => {
    const { backend } = renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 150 });
      fireEvent.click(item, { clientX: 150 });
    });
    await act(async () => {
      fireEvent.click(item, { clientX: 50 });
      fireEvent.click(item, { clientX: 50 });
    });
    expect(backend.state.votes[mockComment.id]).toBe(-1);
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });

  it('swapGestures: true — left-half double-tap upvotes', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ swapGestures: true }));
    const { backend } = renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 50 });
      fireEvent.click(item, { clientX: 50 });
    });
    expect(backend.state.votes[mockComment.id]).toBe(1);
  });

  it('swapGestures: true — right-half double-tap downvotes', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ swapGestures: true }));
    const { backend } = renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 150 });
      fireEvent.click(item, { clientX: 150 });
    });
    expect(backend.state.votes[mockComment.id]).toBe(-1);
  });

  it('score indicator shows ▼ when downvoted', async () => {
    renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 50 });
      fireEvent.click(item, { clientX: 50 });
    });
    expect(screen.getByText(/▼/)).toBeInTheDocument();
  });

  it('single tap does not trigger a vote', async () => {
    const { backend } = renderItem();
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    fireEvent.click(item, { clientX: 150 });
    await act(async () => {});
    expect(backend.state.votes[mockComment.id]).toBeUndefined();
  });

  it('reverts vote state when vote rejects', async () => {
    const { backend } = renderItem();
    backend.comments.vote = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    const item = screen.getByTestId('comment-item');
    mockCommentGeometry(item);
    await act(async () => {
      fireEvent.click(item, { clientX: 150 });
      fireEvent.click(item, { clientX: 150 });
    });
    await act(async () => {});
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('reply button calls onReply with the comment', () => {
    const onReply = vi.fn();
    renderItem({ onReply });
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    expect(onReply).toHaveBeenCalledWith(mockComment);
  });

  it('applies left padding proportional to depth', () => {
    // depth 2 → 16 + 2*14 = 44px
    renderItem({ comment: { ...mockComment, depth: 2 } });
    expect(screen.getByTestId('comment-item')).toHaveStyle('padding-left: 44px');
  });

  it('applies orange border when isHighlighted is true', () => {
    renderItem({ isHighlighted: true });
    expect(screen.getByTestId('comment-item')).toHaveStyle({ border: '2px solid #ff6b35' });
  });

  it('has data-comment-id attribute matching comment id', () => {
    renderItem();
    expect(screen.getByTestId('comment-item')).toHaveAttribute('data-comment-id', '7');
  });

  it('tapping the author name navigates to user profile', () => {
    renderItem();
    fireEvent.click(screen.getByText(/@alice/));
    expect(mockNavigate).toHaveBeenCalledWith('/user/beehaw.org/alice');
  });

  it('tapping the author name does not trigger the double-tap vote', async () => {
    const { backend } = renderItem();
    await act(async () => {
      fireEvent.click(screen.getByText(/@alice/));
      fireEvent.click(screen.getByText(/@alice/));
    });
    expect(backend.state.votes[mockComment.id]).toBeUndefined();
  });

  it('shows edit button for own comments', () => {
    const ownComment = makeComment({ author: makeUser({ handle: 'viewer@mock.test' }) });
    renderItem({ comment: ownComment, onEdit: vi.fn() });
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('hides edit button for other users comments', () => {
    renderItem({ onEdit: vi.fn() });
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('clicking edit button calls onEdit with the comment', () => {
    const onEdit = vi.fn();
    const ownComment = makeComment({ author: makeUser({ handle: 'viewer@mock.test' }) });
    renderItem({ comment: ownComment, onEdit });
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(ownComment);
  });

  it('displays overrideContent instead of original comment content', () => {
    renderItem({ overrideContent: 'Updated text' });
    expect(screen.getByText('Updated text')).toBeInTheDocument();
    expect(screen.queryByText(/Bold/)).not.toBeInTheDocument();
  });

  it('shows Report button on non-own comments when onReport is provided', () => {
    renderItem({ onReport: vi.fn() });
    expect(screen.getByRole('button', { name: /report/i })).toBeInTheDocument();
  });

  it('hides Report button on own comments even when onReport is provided', () => {
    const ownComment = makeComment({ author: makeUser({ handle: 'viewer@mock.test' }) });
    renderItem({ comment: ownComment, onReport: vi.fn() });
    expect(screen.queryByRole('button', { name: /report/i })).not.toBeInTheDocument();
  });

  it('clicking Report button calls onReport with the comment', () => {
    const onReport = vi.fn();
    renderItem({ onReport });
    fireEvent.click(screen.getByRole('button', { name: /report/i }));
    expect(onReport).toHaveBeenCalledWith(mockComment);
  });

  it('does not show Report button when onReport prop is absent', () => {
    renderItem();
    expect(screen.queryByRole('button', { name: /report/i })).not.toBeInTheDocument();
  });
});
