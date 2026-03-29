import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommentList from './CommentList';

vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'My reply', path: '0.1.99' },
    creator: { name: 'me' },
    counts: { score: 1 },
  }),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockComments = [
  {
    comment: { id: 1, content: 'First comment', path: '0.1' },
    creator: { name: 'alice' },
    counts: { score: 5 },
  },
  {
    comment: { id: 2, content: 'Second comment', path: '0.2' },
    creator: { name: 'bob' },
    counts: { score: 3 },
  },
];

beforeEach(() => { vi.clearAllMocks(); });

describe('CommentList', () => {
  it('renders all comments', () => {
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });

  it('opens reply sheet when Reply is clicked on a comment', () => {
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('calls createComment and appends the new comment on submit', async () => {
    const { createComment } = await import('../lib/lemmy');
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    // Open reply sheet for first comment
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    // Fill in reply
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(createComment).toHaveBeenCalledWith('lemmy.world', 'tok', 10, 'My reply', 1);
    expect(screen.getByText('My reply')).toBeInTheDocument();
  });

  it('closes the reply sheet after submit', async () => {
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('closes the reply sheet when Cancel is clicked', () => {
    render(
      <CommentList
        comments={mockComments as never}
        auth={mockAuth}
        postId={10}
        instance="lemmy.world"
        token="tok"
      />
    );
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });
});
