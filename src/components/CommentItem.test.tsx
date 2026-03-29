import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommentItem from './CommentItem';

vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

const mockCv = {
  comment: { id: 7, content: '**Bold** and ![img](https://example.com/img.png)', path: '0.7' },
  creator: { name: 'alice' },
  counts: { score: 10 },
};

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

beforeEach(() => { vi.clearAllMocks(); });

describe('CommentItem', () => {
  it('renders the author and score', () => {
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.png');
    expect(screen.getByText('Bold')).toBeInTheDocument();
  });

  it('double-tap calls likeComment with score 1 and increments score', async () => {
    const { likeComment } = await import('../lib/lemmy');
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    const comment = screen.getByTestId('comment-item');
    await act(async () => {
      fireEvent.click(comment);
      fireEvent.click(comment);
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 1);
    expect(screen.getByText(/11/)).toBeInTheDocument();
  });

  it('second double-tap undoes the like (score 0) and decrements score', async () => {
    const { likeComment } = await import('../lib/lemmy');
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    const comment = screen.getByTestId('comment-item');
    // First double-tap: like
    await act(async () => {
      fireEvent.click(comment);
      fireEvent.click(comment);
    });
    // Second double-tap: undo
    await act(async () => {
      fireEvent.click(comment);
      fireEvent.click(comment);
    });
    expect(likeComment).toHaveBeenLastCalledWith('lemmy.world', 'tok', 7, 0);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('single tap does not call likeComment', async () => {
    const { likeComment } = await import('../lib/lemmy');
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    fireEvent.click(screen.getByTestId('comment-item'));
    await act(async () => {});
    expect(likeComment).not.toHaveBeenCalled();
  });

  it('reverts score and liked state when likeComment rejects', async () => {
    const { likeComment } = await import('../lib/lemmy');
    vi.mocked(likeComment).mockRejectedValueOnce(new Error('Network error'));
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} />);
    const comment = screen.getByTestId('comment-item');
    await act(async () => {
      fireEvent.click(comment);
      fireEvent.click(comment);
    });
    // After the rejected API call, score should revert to 10
    await act(async () => {});
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('reply button calls onReply with the comment view', () => {
    const onReply = vi.fn();
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={onReply} />);
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    expect(onReply).toHaveBeenCalledWith(mockCv);
  });

  it('applies left padding proportional to depth', () => {
    render(<CommentItem cv={mockCv as never} auth={mockAuth} depth={3} onReply={vi.fn()} />);
    const item = screen.getByTestId('comment-item');
    // depth 3 → 16 + (3-1)*14 = 44px
    expect(item).toHaveStyle('padding-left: 44px');
  });
});
