import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReplySheet from './ReplySheet';

const mockTarget = {
  comment: { id: 5, content: 'Parent comment', path: '0.5' },
  creator: { name: 'alice' },
  counts: { score: 3 },
};

describe('ReplySheet', () => {
  it('is not visible when target is null', () => {
    render(<ReplySheet target={null} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('shows the target author when open', () => {
    render(<ReplySheet target={mockTarget as never} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('calls onSubmit with textarea content when Send is clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReplySheet target={mockTarget as never} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onSubmit).toHaveBeenCalledWith('My reply');
  });

  it('clears textarea and calls onClose after successful submit', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReplySheet target={mockTarget as never} onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/write a reply/i)).toHaveValue('');
  });

  it('shows error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<ReplySheet target={mockTarget as never} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('Send button is disabled when textarea is empty', () => {
    render(<ReplySheet target={mockTarget as never} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ReplySheet target={mockTarget as never} onSubmit={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
