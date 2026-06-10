import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderWithBackend } from '../test-utils';
import { createMockBackend } from '../lib/api/backends/mock';
import { BackendProvider } from '../lib/api/context';
import ReportSheet from './ReportSheet';

const POST_TARGET = { type: 'post' as const, postId: '42' };
const COMMENT_TARGET = { type: 'comment' as const, commentId: '7' };
const onClose = vi.fn();

function renderSheet(target: typeof POST_TARGET | typeof COMMENT_TARGET | null) {
  return renderWithBackend(<ReportSheet target={target} onClose={onClose} />);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('ReportSheet', () => {
  it('renders nothing when target is null', () => {
    const { container } = renderSheet(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Report post" title for post target', () => {
    renderSheet(POST_TARGET);
    expect(screen.getByText('Report post')).toBeInTheDocument();
  });

  it('shows "Report comment" title for comment target', () => {
    renderSheet(COMMENT_TARGET);
    expect(screen.getByText('Report comment')).toBeInTheDocument();
  });

  it('Submit button is disabled before a chip is selected', () => {
    renderSheet(POST_TARGET);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('Submit button is enabled after a chip is selected', () => {
    renderSheet(POST_TARGET);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
  });

  it('sends chip-only reason string when detail is empty', async () => {
    const { backend } = renderSheet(POST_TARGET);
    const spy = vi.spyOn(backend.posts, 'report').mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(spy).toHaveBeenCalledWith('42', 'Spam');
  });

  it('sends chip + detail reason string when detail is filled', async () => {
    const { backend } = renderSheet(POST_TARGET);
    const spy = vi.spyOn(backend.posts, 'report').mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Harassment' }));
    fireEvent.change(screen.getByPlaceholderText(/additional details/i), { target: { value: 'repeated abuse' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(spy).toHaveBeenCalledWith('42', 'Harassment — repeated abuse');
  });

  it('calls backend.comments.report for comment target', async () => {
    const { backend } = renderSheet(COMMENT_TARGET);
    const spy = vi.spyOn(backend.comments, 'report').mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'NSFW' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    expect(spy).toHaveBeenCalledWith('7', 'NSFW');
  });

  it('shows "Report submitted" after successful submit', async () => {
    const { backend } = renderSheet(POST_TARGET);
    vi.spyOn(backend.posts, 'report').mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    expect(screen.getByText('Report submitted')).toBeInTheDocument();
  });

  it('calls onClose 1.5s after successful submit', async () => {
    vi.useFakeTimers();
    const { backend } = renderSheet(POST_TARGET);
    vi.spyOn(backend.posts, 'report').mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows inline error on API failure and does not close', async () => {
    const backend = createMockBackend({});
    vi.spyOn(backend.posts, 'report').mockRejectedValue(new Error('Server error'));
    render(<BackendProvider value={backend}><ReportSheet target={POST_TARGET} onClose={onClose} /></BackendProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Spam' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
    await act(async () => {});
    expect(screen.getByText('Server error')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancel button calls onClose', () => {
    renderSheet(POST_TARGET);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
