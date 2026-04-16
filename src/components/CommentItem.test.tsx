import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommentItem from './CommentItem';
import { SettingsProvider } from '../lib/SettingsContext';

vi.mock('../lib/lemmy', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockCv = {
  comment: { id: 7, content: '**Bold** and ![img](https://example.com/img.png)', path: '0.7', ap_id: 'https://lemmy.world/comment/7' },
  creator: { name: 'alice', actor_id: 'https://beehaw.org/u/alice', avatar: undefined },
  counts: { score: 10 },
};

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); localStorage.clear(); });

function renderItem(props: Partial<React.ComponentProps<typeof CommentItem>> = {}) {
  return render(
    <SettingsProvider>
      <CommentItem cv={mockCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} {...props} />
    </SettingsProvider>
  );
}

/** Give the element a known width so clientX comparisons work in jsdom */
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

  it('right-half double-tap calls likeComment with score 1 and increments score', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 1);
    expect(screen.getByText(/11/)).toBeInTheDocument();
  });

  it('left-half double-tap calls likeComment with score -1 and decrements score', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, -1);
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });

  it('second right-half double-tap removes upvote (score 0)', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    expect(likeComment).toHaveBeenLastCalledWith('lemmy.world', 'tok', 7, 0);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('second left-half double-tap removes downvote (score 0)', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(likeComment).toHaveBeenLastCalledWith('lemmy.world', 'tok', 7, 0);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('right-half then left-half double-tap switches directly to downvote', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(likeComment).toHaveBeenLastCalledWith('lemmy.world', 'tok', 7, -1);
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });

  it('swapGestures: true — left-half double-tap upvotes', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ swapGestures: true }));
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 1);
  });

  it('swapGestures: true — right-half double-tap downvotes', async () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({ swapGestures: true }));
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    expect(likeComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, -1);
  });

  it('score indicator shows ▼ when downvoted', async () => {
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 50 });
      fireEvent.click(comment, { clientX: 50 });
    });
    expect(screen.getByText(/▼/)).toBeInTheDocument();
  });

  it('single tap does not call likeComment', async () => {
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    fireEvent.click(comment, { clientX: 150 });
    await act(async () => {});
    expect(likeComment).not.toHaveBeenCalled();
  });

  it('reverts vote state when likeComment rejects', async () => {
    const { likeComment } = await import('../lib/lemmy');
    vi.mocked(likeComment).mockRejectedValueOnce(new Error('Network error'));
    renderItem();
    const comment = screen.getByTestId('comment-item');
    mockCommentGeometry(comment);
    await act(async () => {
      fireEvent.click(comment, { clientX: 150 });
      fireEvent.click(comment, { clientX: 150 });
    });
    await act(async () => {});
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('reply button calls onReply with the comment view', () => {
    const onReply = vi.fn();
    renderItem({ onReply });
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    expect(onReply).toHaveBeenCalledWith(mockCv);
  });

  it('applies left padding proportional to depth', () => {
    render(
      <SettingsProvider>
        <CommentItem cv={mockCv as never} auth={mockAuth} depth={3} onReply={vi.fn()} />
      </SettingsProvider>
    );
    // depth 3 → 16 + (3-1)*14 = 44px
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
    const { likeComment } = await import('../lib/lemmy');
    renderItem();
    await act(async () => {
      fireEvent.click(screen.getByText(/@alice/));
      fireEvent.click(screen.getByText(/@alice/));
    });
    expect(likeComment).not.toHaveBeenCalled();
  });

  it('shows edit button for own comments', () => {
    const ownCv = {
      ...mockCv,
      creator: { name: 'me', actor_id: 'https://lemmy.world/u/me', avatar: undefined },
    };
    render(
      <SettingsProvider>
        <CommentItem cv={ownCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} onEdit={vi.fn()} />
      </SettingsProvider>
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('hides edit button for other users comments', () => {
    renderItem({ onEdit: vi.fn() });
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('clicking edit button calls onEdit with the comment view', () => {
    const onEdit = vi.fn();
    const ownCv = {
      ...mockCv,
      creator: { name: 'me', actor_id: 'https://lemmy.world/u/me', avatar: undefined },
    };
    render(
      <SettingsProvider>
        <CommentItem cv={ownCv as never} auth={mockAuth} depth={1} onReply={vi.fn()} onEdit={onEdit} />
      </SettingsProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(ownCv);
  });

  it('displays overrideContent instead of original comment content', () => {
    renderItem({ overrideContent: 'Updated text' });
    expect(screen.getByText('Updated text')).toBeInTheDocument();
    expect(screen.queryByText(/Bold/)).not.toBeInTheDocument();
  });
});
