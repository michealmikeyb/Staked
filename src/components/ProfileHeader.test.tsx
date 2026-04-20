import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileHeader from './ProfileHeader';

describe('ProfileHeader', () => {
  const onBack = vi.fn();

  it('renders u/username@instance', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} />);
    expect(screen.getByText('u/alice@lemmy.world')).toBeInTheDocument();
  });

  it('does not show hamburger when onBlock is undefined', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} />);
    expect(screen.queryByRole('button', { name: /profile menu/i })).not.toBeInTheDocument();
  });

  it('shows hamburger when onBlock is provided', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={vi.fn()} />);
    expect(screen.getByRole('button', { name: /profile menu/i })).toBeInTheDocument();
  });

  it('clicking hamburger opens menu panel with Block button', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    expect(screen.getByRole('button', { name: /^block$/i })).toBeInTheDocument();
  });

  it('clicking Block in menu opens confirm panel', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    expect(screen.getByText('Block u/alice?')).toBeInTheDocument();
  });

  it('confirm panel shows correct username', () => {
    render(<ProfileHeader username="bob" instance="beehaw.org" onBack={onBack} onBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    expect(screen.getByText('Block u/bob?')).toBeInTheDocument();
  });

  it('cancel closes confirm panel', () => {
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Block u/alice?')).not.toBeInTheDocument();
  });

  it('successful block calls onBlock and closes confirm panel', async () => {
    const onBlock = vi.fn().mockResolvedValue(undefined);
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={onBlock} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(onBlock).toHaveBeenCalledOnce());
    expect(screen.queryByText('Block u/alice?')).not.toBeInTheDocument();
  });

  it('failed block shows error and keeps panel open', async () => {
    const onBlock = vi.fn().mockRejectedValue(new Error('fail'));
    render(<ProfileHeader username="alice" instance="lemmy.world" onBack={onBack} onBlock={onBlock} />);
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(screen.getByText('Failed to block. Try again.')).toBeInTheDocument());
    expect(screen.getByText('Block u/alice?')).toBeInTheDocument();
  });
});
