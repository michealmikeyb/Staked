import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../lib/SettingsContext';
import SettingsPage from './SettingsPage';
import type React from 'react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function renderPage(props: Partial<React.ComponentProps<typeof SettingsPage>> = {}) {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <SettingsPage isAuthenticated={true} {...props} />
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  it('renders all three setting sections', () => {
    renderPage();
    expect(screen.getByText('Left Swipe')).toBeInTheDocument();
    expect(screen.getByText('Blur NSFW')).toBeInTheDocument();
    expect(screen.getByText('Default Sort')).toBeInTheDocument();
  });

  it('back button navigates to /', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('Dismiss pill updates leftSwipe setting', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.leftSwipe).toBe('dismiss');
  });

  it('Off pill updates blurNsfw setting', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^off$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.blurNsfw).toBe(false);
  });

  it('sort pill updates defaultSort setting', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.defaultSort).toBe('Hot');
  });

  it('active sort pill has distinct styling (orange background)', () => {
    renderPage();
    // TopTwelveHour is default — its button should have orange background
    const topBtn = screen.getByRole('button', { name: /top 12h/i });
    expect(topBtn).toHaveStyle({ background: '#ff6b35' });
  });

  it('renders the Anonymous Feed section', () => {
    renderPage();
    expect(screen.getByText('Anonymous Feed')).toBeInTheDocument();
  });

  it('anon instance input is empty by default', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Auto (top-ranked per sort)')).toHaveValue('');
  });

  it('typing in anon instance input persists to settings', () => {
    renderPage();
    const input = screen.getByPlaceholderText('Auto (top-ranked per sort)');
    fireEvent.change(input, { target: { value: 'lemmy.ml' } });
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.anonInstance).toBe('lemmy.ml');
  });

  describe('Notifications section', () => {
    it('shows Enable button when permission is default', () => {
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
        writable: true, configurable: true,
      });
      renderPage();
      expect(screen.getByRole('button', { name: /enable notifications/i })).toBeInTheDocument();
    });

    it('shows On state when permission is granted', () => {
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'granted', requestPermission: vi.fn() },
        writable: true, configurable: true,
      });
      renderPage();
      expect(screen.getByText(/notifications on/i)).toBeInTheDocument();
    });

    it('shows Blocked message when permission is denied', () => {
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'denied', requestPermission: vi.fn() },
        writable: true, configurable: true,
      });
      renderPage();
      expect(screen.getByText(/blocked in browser settings/i)).toBeInTheDocument();
    });

    it('shows Log in message when not authenticated', () => {
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'default', requestPermission: vi.fn() },
        writable: true, configurable: true,
      });
      renderPage({ isAuthenticated: false });
      expect(screen.getByText(/log in to enable notifications/i)).toBeInTheDocument();
    });

    it('calls requestPermission when Enable is clicked', async () => {
      const requestPermission = vi.fn().mockResolvedValue('granted');
      Object.defineProperty(global, 'Notification', {
        value: { permission: 'default', requestPermission },
        writable: true, configurable: true,
      });
      renderPage();
      await act(async () => {
        await userEvent.click(screen.getByRole('button', { name: /enable notifications/i }));
      });
      expect(requestPermission).toHaveBeenCalled();
    });
  });
});
