import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommunityHeader from './CommunityHeader';

describe('CommunityHeader', () => {
  it('renders the community name', () => {
    render(
      <CommunityHeader
        name="asklemmy"
        sortType="Active"
        onSortChange={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText('c/asklemmy')).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(
      <CommunityHeader
        name="asklemmy"
        sortType="Active"
        onSortChange={vi.fn()}
        onBack={onBack}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens sort dropdown and calls onSortChange when an option is selected', () => {
    const onSortChange = vi.fn();
    render(
      <CommunityHeader
        name="asklemmy"
        sortType="Active"
        onSortChange={onSortChange}
        onBack={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /active/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(onSortChange).toHaveBeenCalledWith('Hot');
  });

  it('calls onCompose when compose button is clicked', () => {
    const onCompose = vi.fn();
    render(
      <CommunityHeader
        name="programming"
        sortType="Active"
        onSortChange={vi.fn()}
        onBack={vi.fn()}
        onCompose={onCompose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /compose/i }));
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it('does not render compose button when onCompose is not provided', () => {
    render(
      <CommunityHeader
        name="programming"
        sortType="Active"
        onSortChange={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /compose/i })).not.toBeInTheDocument();
  });
});
