import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuDrawer from './MenuDrawer';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => { vi.clearAllMocks(); });

function renderDrawer(props: Partial<React.ComponentProps<typeof MenuDrawer>> = {}) {
  return render(
    <MemoryRouter>
      <MenuDrawer onNavigate={mockNavigate} {...props} />
    </MemoryRouter>,
  );
}

describe('MenuDrawer', () => {
  it('renders the HeaderBar', () => {
    renderDrawer();
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('drawer is closed by default', () => {
    renderDrawer();
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('opens drawer when menu button is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inbox/i })).toBeInTheDocument();
  });

  it('closes drawer when menu button is clicked again', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('closes drawer when overlay is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByTestId('drawer-overlay'));
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('calls onNavigate with /saved and closes drawer when Saved is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /saved/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/saved');
    expect(screen.queryByRole('button', { name: /saved/i })).not.toBeInTheDocument();
  });

  it('calls onNavigate with /inbox and closes drawer when Inbox is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /inbox/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/inbox');
    expect(screen.queryByRole('button', { name: /inbox/i })).not.toBeInTheDocument();
  });

  it('calls onNavigate with /profile and closes drawer when Profile is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /profile/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
    expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
  });

  it('shows unread badge on Inbox button when unreadCount > 0', () => {
    renderDrawer({ unreadCount: 3 });
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByTestId('inbox-badge')).toBeInTheDocument();
  });

  it('hides inbox badge when unreadCount is 0', () => {
    renderDrawer({ unreadCount: 0 });
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByTestId('inbox-badge')).not.toBeInTheDocument();
  });

  it('renders centerContent via HeaderBar', () => {
    renderDrawer({ centerContent: <span>Custom Center</span> });
    expect(screen.getByText('Custom Center')).toBeInTheDocument();
  });

  it('calls onLogoClick when logo is clicked', () => {
    const spy = vi.fn();
    renderDrawer({ onLogoClick: spy });
    fireEvent.click(screen.getByRole('button', { name: /stakswipe home/i }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('renders Settings button when drawer is open', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('calls onNavigate with /settings and closes drawer when Settings is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
  });

  it('renders Post button when drawer is open', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /^post$/i })).toBeInTheDocument();
  });

  it('calls onNavigate with /create-post and closes drawer when Post is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/create-post');
    expect(screen.queryByRole('button', { name: /^post$/i })).not.toBeInTheDocument();
  });

  it('renders Search button when drawer is open', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('calls onNavigate with /search and closes drawer when Search is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/search');
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument();
  });
});
