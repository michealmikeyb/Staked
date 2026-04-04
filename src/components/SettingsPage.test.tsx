import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsProvider } from '../lib/SettingsContext';
import SettingsPage from './SettingsPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <SettingsPage />
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
});
