import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithBackend } from '../test-utils';
import HeaderBar from './HeaderBar';
import type { StakOption } from '../lib/AccountsContext';

const FEED_OPTIONS = [
  { id: 'Active', label: 'Active' },
  { id: 'Hot', label: 'Hot' },
  { id: 'New', label: 'New' },
  { id: 'TopSixHour', label: 'Top 6h' },
  { id: 'TopTwelveHour', label: 'Top 12h' },
  { id: 'TopDay', label: 'Top Day' },
];

const defaultProps = {
  sortType: 'TopTwelveHour',
  onSortChange: vi.fn(),
  onMenuOpen: vi.fn(),
};

const fullCapabilities = { feedOptions: FEED_OPTIONS };

beforeEach(() => { vi.clearAllMocks(); });

describe('HeaderBar', () => {
  it('renders the current sort label', () => {
    renderWithBackend(<HeaderBar {...defaultProps} />, { capabilities: fullCapabilities });
    expect(screen.getByRole('button', { name: /top 12h/i })).toBeInTheDocument();
  });

  it('shows all sort options when sort button is clicked', () => {
    renderWithBackend(<HeaderBar {...defaultProps} />, { capabilities: fullCapabilities });
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    expect(screen.getByRole('button', { name: /^active$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^hot$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^new$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /top 6h/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /top day/i })).toBeInTheDocument();
  });

  it('calls onSortChange with the selected sort id', () => {
    const onSortChange = vi.fn();
    renderWithBackend(
      <HeaderBar {...defaultProps} onSortChange={onSortChange} />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(onSortChange).toHaveBeenCalledWith('Hot');
  });

  it('hides the dropdown after selecting a sort', () => {
    renderWithBackend(<HeaderBar {...defaultProps} />, { capabilities: fullCapabilities });
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(screen.queryByRole('button', { name: /^active$/i })).not.toBeInTheDocument();
  });

  it('calls onMenuOpen when the menu button is clicked', () => {
    const onMenuOpen = vi.fn();
    renderWithBackend(
      <HeaderBar {...defaultProps} onMenuOpen={onMenuOpen} />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });

  it('marks the active sort with a checkmark', () => {
    renderWithBackend(
      <HeaderBar {...defaultProps} sortType="Hot" />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /hot/i }));
    const hotButtons = screen.getAllByRole('button', { name: /^hot$/i });
    expect(hotButtons[1]).toHaveTextContent('✓');
  });
});

describe('centerContent prop', () => {
  it('renders centerContent in place of the sort dropdown', () => {
    renderWithBackend(
      <HeaderBar onMenuOpen={() => {}} centerContent={<span>Custom Center</span>} />,
      { capabilities: fullCapabilities },
    );
    expect(screen.getByText('Custom Center')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders sort dropdown when centerContent is not provided and sortType is given', () => {
    renderWithBackend(
      <HeaderBar sortType="Hot" onSortChange={() => {}} onMenuOpen={() => {}} />,
      { capabilities: { feedOptions: [{ id: 'Hot', label: 'Hot' }] } },
    );
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('renders empty center when neither centerContent nor sortType is provided', () => {
    renderWithBackend(
      <HeaderBar onMenuOpen={() => {}} />,
      { capabilities: fullCapabilities },
    );
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByText('Hot')).not.toBeInTheDocument();
  });
});

describe('onLogoClick prop', () => {
  it('calls onLogoClick when logo is clicked', () => {
    const spy = vi.fn();
    renderWithBackend(
      <HeaderBar onMenuOpen={() => {}} onLogoClick={spy} />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /stakswipe home/i }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

const STAKS_FIXTURE: StakOption[] = [
  { sessionId: 'lemmy:alice@lemmy.world', stakId: 'all', label: 'All', icon: '🌐', handle: 'alice@lemmy.world' },
  { sessionId: 'lemmy:alice@lemmy.world', stakId: 'subscribed', label: 'Subscribed', icon: '⭐', handle: 'alice@lemmy.world' },
  { sessionId: null, stakId: 'anonymous', label: 'Anonymous', icon: '🕵️' },
];

describe('HeaderBar stak selector', () => {
  it('opens the stak list and shows staks with their handle', () => {
    renderWithBackend(
      <HeaderBar
        onMenuOpen={vi.fn()}
        staks={STAKS_FIXTURE}
        activeStakKey="lemmy:alice@lemmy.world:all"
        onStakSelect={vi.fn()}
        onAddAccount={vi.fn()}
        onManageAccounts={vi.fn()}
      />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    expect(screen.getByRole('button', { name: /All · alice@lemmy.world/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subscribed · alice@lemmy.world/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Anonymous$/i })).toBeInTheDocument();
  });

  it('calls onStakSelect with the chosen stak option', () => {
    const onStakSelect = vi.fn();
    renderWithBackend(
      <HeaderBar onMenuOpen={vi.fn()} staks={STAKS_FIXTURE} activeStakKey="anon:anonymous"
        onStakSelect={onStakSelect} onAddAccount={vi.fn()} onManageAccounts={vi.fn()} />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(screen.getByRole('button', { name: /Subscribed · alice@lemmy.world/i }));
    expect(onStakSelect).toHaveBeenCalledWith(STAKS_FIXTURE[1]);
  });

  it('shows Add account and Manage accounts entries', () => {
    const onAddAccount = vi.fn();
    const onManageAccounts = vi.fn();
    renderWithBackend(
      <HeaderBar onMenuOpen={vi.fn()} staks={STAKS_FIXTURE} activeStakKey="anon:anonymous"
        onStakSelect={vi.fn()} onAddAccount={onAddAccount} onManageAccounts={onManageAccounts} />,
      { capabilities: fullCapabilities },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));
    expect(onAddAccount).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(screen.getByRole('button', { name: /manage accounts/i }));
    expect(onManageAccounts).toHaveBeenCalled();
  });
});
