import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import type { Comment } from '../lib/api/types';
import { renderWithBackend, makeComment, makeUser } from '../test-utils';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockComments = [
  makeComment({ id: '1', author: makeUser({ handle: 'alice@lemmy.world' }), body: 'First comment' }),
  makeComment({ id: '2', author: makeUser({ handle: 'bob@lemmy.world' }), body: 'Second comment' }),
];

function Wrapper({ onSubmit = vi.fn() }: { onSubmit?: (content: string) => Promise<void> }) {
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [localReplies] = useState<Comment[]>([]);
  return (
    <>
      <CommentList
        comments={mockComments}
        localReplies={localReplies}
        onSetReplyTarget={setReplyTarget}
        onEdit={vi.fn()}
        localEdits={{}}
      />
      <ReplySheet
        mode={replyTarget ? 'reply' : null}
        target={replyTarget ?? undefined}
        onSubmit={onSubmit}
        onClose={() => setReplyTarget(null)}
      />
    </>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('CommentList', () => {
  it('renders all comments', () => {
    renderWithBackend(<Wrapper />);
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
  });

  it('opens reply sheet when Reply is clicked on a comment', () => {
    renderWithBackend(<Wrapper />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('calls onSubmit and closes sheet on send', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithBackend(<Wrapper onSubmit={onSubmit} />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onSubmit).toHaveBeenCalledWith('My reply');
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('closes the reply sheet when Cancel is clicked', () => {
    renderWithBackend(<Wrapper />);
    const replyButtons = screen.getAllByRole('button', { name: /reply/i });
    fireEvent.click(replyButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('passes isHighlighted=true only to the comment matching highlightCommentId', () => {
    const comments = [
      makeComment({ id: '1' }),
      makeComment({ id: '2' }),
    ];
    renderWithBackend(
      <CommentList
        comments={comments}
        localReplies={[]}
        onSetReplyTarget={() => {}}
        onEdit={vi.fn()}
        localEdits={{}}
        highlightCommentId={'2'}
      />,
    );
    const items = screen.getAllByTestId('comment-item');
    const item1 = items.find(el => el.getAttribute('data-comment-id') === '1')!;
    const item2 = items.find(el => el.getAttribute('data-comment-id') === '2')!;
    expect(item1).not.toHaveStyle({ border: '2px solid #ff6b35' });
    expect(item2).toHaveStyle({ border: '2px solid #ff6b35' });
  });

  it('passes onEdit down to CommentItems', () => {
    const onEdit = vi.fn();
    const ownComment = makeComment({ id: '3', body: 'My comment', author: makeUser({ handle: 'viewer@mock.test' }) });
    renderWithBackend(
      <CommentList
        comments={[...mockComments, ownComment]}
        localReplies={[]}
        onSetReplyTarget={() => {}}
        onEdit={onEdit}
        localEdits={{}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(ownComment);
  });

  it('passes overrideContent from localEdits to the matching CommentItem', () => {
    renderWithBackend(
      <CommentList
        comments={mockComments}
        localReplies={[]}
        onSetReplyTarget={() => {}}
        onEdit={vi.fn()}
        localEdits={{ '1': 'Edited first comment' }}
      />,
    );
    expect(screen.getByText('Edited first comment')).toBeInTheDocument();
    expect(screen.queryByText('First comment')).not.toBeInTheDocument();
  });
});
