import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import { type CommentView } from '../lib/lemmy';

vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'My reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', actor_id: 'https://lemmy.world/u/me' },
    counts: { score: 1 },
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockComments = [
  {
    comment: { id: 1, content: 'First comment', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
    creator: { name: 'alice', actor_id: 'https://lemmy.world/u/alice' },
    counts: { score: 5 },
  },
  {
    comment: { id: 2, content: 'Second comment', path: '0.2', ap_id: 'https://lemmy.world/comment/2' },
    creator: { name: 'bob', actor_id: 'https://lemmy.world/u/bob' },
    counts: { score: 3 },
  },
] as unknown as CommentView[];

function makeComment({ id, path }: { id: number; path: string }): CommentView {
  return {
    comment: { id, content: `Comment ${id}`, path, ap_id: `https://lemmy.world/comment/${id}` },
    creator: { name: `user${id}`, actor_id: `https://lemmy.world/u/user${id}` },
    counts: { score: id * 2 },
  } as unknown as CommentView;
}

// Wraps CommentList + ReplySheet together holding the lifted state — mirrors what PostCard does.
function Wrapper({ onSubmit = vi.fn() }: { onSubmit?: (content: string) => Promise<void> }) {
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [localReplies] = useState<CommentView[]>([]);
  return (
    <>
      <CommentList
        comments={mockComments}
        localReplies={localReplies}
        auth={mockAuth}
        onSetReplyTarget={setReplyTarget}
      />
      <ReplySheet
        target={replyTarget}
        onSubmit={onSubmit}
        onClose={() => setReplyTarget(null)}
      />
    </>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('CommentList', () => {
  it('renders all comments', () => {
    render(<Wrapper />);
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });

  it('opens reply sheet when Reply is clicked on a comment', () => {
    render(<Wrapper />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('calls onSubmit and closes sheet on send', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<Wrapper onSubmit={onSubmit} />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onSubmit).toHaveBeenCalledWith('My reply');
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('closes the reply sheet when Cancel is clicked', () => {
    render(<Wrapper />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('passes isHighlighted=true only to the comment matching highlightCommentId', async () => {
    const comments = [
      makeComment({ id: 1, path: '0.1' }),
      makeComment({ id: 2, path: '0.2' }),
    ];
    render(
      <CommentList
        comments={comments}
        localReplies={[]}
        auth={mockAuth}
        onSetReplyTarget={() => {}}
        highlightCommentId={2}
      />,
    );
    // comment id=2 should have the orange border, id=1 should not
    const items = screen.getAllByTestId('comment-item');
    const item1 = items.find(el => el.getAttribute('data-comment-id') === '1')!;
    const item2 = items.find(el => el.getAttribute('data-comment-id') === '2')!;
    expect(item1).not.toHaveStyle({ border: '2px solid #ff6b35' });
    expect(item2).toHaveStyle({ border: '2px solid #ff6b35' });
  });
});
