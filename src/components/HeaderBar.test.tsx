import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeaderBar from './HeaderBar';

const defaultProps = {
  sortType: 'TopTwelveHour' as const,
  onSortChange: vi.fn(),
  onMenuOpen: vi.fn(),
};

beforeEach(() => { vi.clearAllMocks(); });

describe('HeaderBar', () => {
  it('renders the current sort label', () => {
    render(<HeaderBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /top 12h/i })).toBeInTheDocument();
  });

  it('shows all sort options when sort button is clicked', () => {
    render(<HeaderBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    expect(screen.getByRole('button', { name: /^active$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^hot$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^new$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /top 6h/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /top day/i })).toBeInTheDocument();
  });

  it('calls onSortChange with the selected SortType', () => {
    const onSortChange = vi.fn();
    render(<HeaderBar {...defaultProps} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(onSortChange).toHaveBeenCalledWith('Hot');
  });

  it('hides the dropdown after selecting a sort', () => {
    render(<HeaderBar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /top 12h/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(screen.queryByRole('button', { name: /^active$/i })).not.toBeInTheDocument();
  });

  it('calls onMenuOpen when the menu button is clicked', () => {
    const onMenuOpen = vi.fn();
    render(<HeaderBar {...defaultProps} onMenuOpen={onMenuOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });

  it('marks the active sort with a checkmark', () => {
    render(<HeaderBar {...defaultProps} sortType="Hot" />);
    fireEvent.click(screen.getByRole('button', { name: /hot/i }));
    // The Hot option button in the dropdown should contain the checkmark character
    const hotButtons = screen.getAllByRole('button', { name: /^hot$/i });
    expect(hotButtons[1]).toHaveTextContent('✓');
  });
});

describe('centerContent prop', () => {
  it('renders centerContent in place of the sort dropdown', () => {
    render(
      <HeaderBar onMenuOpen={() => {}} centerContent={<span>Custom Center</span>} />,
    );
    expect(screen.getByText('Custom Center')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders sort dropdown when centerContent is not provided and sortType is given', () => {
    render(
      <HeaderBar
        sortType="Hot"
        onSortChange={() => {}}
        onMenuOpen={() => {}}
      />,
    );
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('renders empty center when neither centerContent nor sortType is provided', () => {
    render(<HeaderBar onMenuOpen={() => {}} />);
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByText('Hot')).not.toBeInTheDocument();
  });
});

describe('onLogoClick prop', () => {
  it('calls onLogoClick when logo is clicked', () => {
    const spy = vi.fn();
    render(<HeaderBar onMenuOpen={() => {}} onLogoClick={spy} />);
    fireEvent.click(screen.getByRole('button', { name: /stakswipe home/i }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('stak picker', () => {
  it('does not render stak picker when onStakChange is not provided', () => {
    render(<HeaderBar onMenuOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /switch stak/i })).not.toBeInTheDocument();
  });

  it('renders stak picker button showing active stak when onStakChange is provided', () => {
    render(
      <HeaderBar
        onMenuOpen={vi.fn()}
        activeStak="All"
        onStakChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /switch stak.*all/i })).toBeInTheDocument();
  });

  it('opens stak dropdown when stak button is clicked', () => {
    render(
      <HeaderBar
        onMenuOpen={vi.fn()}
        activeStak="All"
        onStakChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    expect(screen.getByRole('button', { name: /^local$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^subscribed$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^anonymous$/i })).toBeInTheDocument();
  });

  it('calls onStakChange with selected stak', () => {
    const onStakChange = vi.fn();
    render(
      <HeaderBar
        onMenuOpen={vi.fn()}
        activeStak="All"
        onStakChange={onStakChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(screen.getByRole('button', { name: /^local$/i }));
    expect(onStakChange).toHaveBeenCalledWith('Local');
  });

  it('closes dropdown after selecting a stak', () => {
    render(
      <HeaderBar
        onMenuOpen={vi.fn()}
        activeStak="All"
        onStakChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    fireEvent.click(screen.getByRole('button', { name: /^local$/i }));
    expect(screen.queryByRole('button', { name: /^subscribed$/i })).not.toBeInTheDocument();
  });

  it('marks the active stak with a checkmark', () => {
    render(
      <HeaderBar
        onMenuOpen={vi.fn()}
        activeStak="Local"
        onStakChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch stak/i }));
    const localButton = screen.getByRole('button', { name: /^local$/i });
    expect(localButton).toHaveTextContent('✓');
  });
});
