import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReportSheet from './ReportSheet';

vi.mock('../lib/lemmy', () => ({
  reportPost: vi.fn().mockResolvedValue(undefined),
  reportComment: vi.fn().mockResolvedValue(undefined),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

const AUTH = { instance: 'lemmy.world', token: 'tok', username: 'alice' };
const POST_TARGET = { type: 'post' as const, postId: 42 };
const COMMENT_TARGET = { type: 'comment' as const, commentId: 7, apId: 'https://lemmy.world/comment/7' };
const onClose = vi.fn();

beforeEach(() => { vi.clearAllMocks(); });

describe('ReportSheet', () => {
  it('renders nothing when target is null', () => {
    const { container } = render(<ReportSheet target={null} auth={AUTH} onClose={onClose} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Report post" title for post target', () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    expect(screen.getByText('Report post')).toBeInTheDocument();
  });

  it('shows "Report comment" title for comment target', () => {
    render(<ReportSheet target={COMMENT_TARGET} auth={AUTH} onClose={onClose} />);
    expect(screen.getByText('Report comment')).toBeInTheDocument();
  });

  it('Submit button is disabled before a chip is selected', () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('Submit button is enabled after a chip is selected', () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
  });

  it('sends chip-only reason string when detail is empty', async () => {
    const { reportPost } = await import('../lib/lemmy');
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(reportPost).toHaveBeenCalledWith('lemmy.world', 'tok', 42, 'Spam');
  });

  it('sends chip + detail reason string when detail is filled', async () => {
    const { reportPost } = await import('../lib/lemmy');
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Harassment' }));
    fireEvent.change(screen.getByPlaceholderText(/additional details/i), { target: { value: 'repeated abuse' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(reportPost).toHaveBeenCalledWith('lemmy.world', 'tok', 42, 'Harassment — repeated abuse');
  });

  it('calls reportComment for comment target', async () => {
    const { reportComment } = await import('../lib/lemmy');
    render(<ReportSheet target={COMMENT_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'NSFW' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(reportComment).toHaveBeenCalledWith('lemmy.world', 'tok', 7, 'NSFW');
  });

  it('shows "Report submitted" after successful submit', async () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    expect(screen.getByText('Report submitted')).toBeInTheDocument();
  });

  it('calls onClose 1.5s after successful submit', async () => {
    vi.useFakeTimers();
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows inline error on API failure and does not close', async () => {
    const { reportPost } = await import('../lib/lemmy');
    vi.mocked(reportPost).mockRejectedValueOnce(new Error('Server error'));
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    expect(screen.getByText('Server error')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancel button calls onClose', () => {
    render(<ReportSheet target={POST_TARGET} auth={AUTH} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
