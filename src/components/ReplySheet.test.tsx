import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReplySheet from './ReplySheet';

const mockTarget = {
  comment: { id: 5, content: 'Parent comment', path: '0.5' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 3 },
};

describe('ReplySheet', () => {
  it('renders nothing when mode is null', () => {
    render(<ReplySheet mode={null} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows replying-to header in reply mode', () => {
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/replying to @alice/i)).toBeInTheDocument();
  });

  it('shows editing header in edit mode', () => {
    render(
      <ReplySheet mode="edit" target={mockTarget as never} initialContent="old text" onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/editing your comment/i)).toBeInTheDocument();
  });

  it('shows commenting-on-post header in new mode', () => {
    render(<ReplySheet mode="new" onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/commenting on post/i)).toBeInTheDocument();
  });

  it('pre-fills textarea with initialContent in edit mode', () => {
    render(
      <ReplySheet mode="edit" target={mockTarget as never} initialContent="old text" onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('old text');
  });

  it('calls onSubmit with textarea content when Send is clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={onSubmit} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My reply' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onSubmit).toHaveBeenCalledWith('My reply');
  });

  it('clears textarea and calls onClose after successful submit', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={onSubmit} onClose={onClose} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My reply' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('shows error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={onSubmit} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My reply' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('Send button is disabled when textarea is empty', () => {
    render(<ReplySheet mode="new" onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <ReplySheet mode="reply" target={mockTarget as never} onSubmit={vi.fn()} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
