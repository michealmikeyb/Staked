import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CommunityAboutPage from './CommunityAboutPage';

vi.mock('../lib/lemmy', () => ({
  fetchCommunityInfo: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

const INFO = {
  id: 42,
  icon: undefined,
  banner: undefined,
  description: 'Hello community',
  counts: { subscribers: 12400, posts: 3200, comments: 8900 },
  subscribed: 'NotSubscribed' as const,
};

function renderPage(locationState?: object) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/community/lemmy.world/linux/about', state: locationState }]}
    >
      <Routes>
        <Route
          path="/community/:instance/:name/about"
          element={<CommunityAboutPage auth={AUTH} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });

describe('CommunityAboutPage', () => {
  it('renders title and community info from location state without fetching', async () => {
    const { fetchCommunityInfo } = await import('../lib/lemmy');
    renderPage({ communityInfo: INFO });
    expect(screen.getByText('About c/linux')).toBeInTheDocument();
    expect(screen.getByText(/12,400 members/)).toBeInTheDocument();
    expect(fetchCommunityInfo).not.toHaveBeenCalled();
  });

  it('fetches community info when no location state is provided', async () => {
    const { fetchCommunityInfo } = await import('../lib/lemmy');
    (fetchCommunityInfo as ReturnType<typeof vi.fn>).mockResolvedValueOnce(INFO);
    renderPage();
    await screen.findByText(/12,400 members/);
    expect(fetchCommunityInfo).toHaveBeenCalledWith(
      'lemmy.world', 'tok', 'linux@lemmy.world',
    );
  });

  it('shows error message when fetch fails', async () => {
    const { fetchCommunityInfo } = await import('../lib/lemmy');
    (fetchCommunityInfo as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error'),
    );
    renderPage();
    await screen.findByText('Network error');
  });

  it('calls navigate(-1) when back button is clicked', () => {
    renderPage({ communityInfo: INFO });
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders description markdown', () => {
    renderPage({ communityInfo: INFO });
    expect(screen.getByText('Hello community')).toBeInTheDocument();
  });
});
