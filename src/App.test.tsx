import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./lib/store', () => ({
  loadAuth: vi.fn().mockReturnValue(null),
  clearAuth: vi.fn(),
}));

vi.mock('./components/LoginPage', () => ({
  default: (_props: { onLogin: unknown }) => <div>LoginPage</div>,
}));

vi.mock('./components/FeedStack', () => ({
  default: () => <div>FeedStack</div>,
}));

vi.mock('./components/InboxPage', () => ({
  default: () => <div>InboxPage</div>,
}));

vi.mock('./components/PostDetailPage', () => ({
  default: () => <div>PostDetailPage</div>,
}));

vi.mock('./components/SavedPage', () => ({
  default: () => <div>SavedPage</div>,
}));

vi.mock('./components/SavedPostDetailPage', () => ({
  default: () => <div>SavedPostDetailPage</div>,
}));

vi.mock('./components/ProfilePage', () => ({
  default: () => <div>ProfilePage</div>,
}));

vi.mock('./components/ProfilePostDetailPage', () => ({
  default: () => <div>ProfilePostDetailPage</div>,
}));

describe('App routing', () => {
  it('shows LoginPage when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  it('shows FeedStack when authenticated', async () => {
    const { loadAuth } = await import('./lib/store');
    vi.mocked(loadAuth).mockReturnValue({
      token: 'tok',
      instance: 'lemmy.world',
      username: 'alice',
    });
    render(<App />);
    expect(screen.getByText('FeedStack')).toBeInTheDocument();
  });
});
