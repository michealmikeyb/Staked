import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithBackend, makeSource } from '../test-utils';
import { createMockBackend } from '../lib/api/backends/mock';
import { BackendProvider } from '../lib/api/context';
import type { Source } from '../lib/api/types';
import CommunityAboutPage from './CommunityAboutPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const INFO: Source = makeSource({
  id: '42',
  handle: 'linux@lemmy.world',
  name: 'linux',
  description: 'Hello community',
  counts: { members: 12400, posts: 3200 },
});

function renderPage(locationState?: object) {
  return renderWithBackend(
    <MemoryRouter
      initialEntries={[{ pathname: '/community/lemmy.world/linux/about', state: locationState }]}
    >
      <Routes>
        <Route
          path="/community/:instance/:name/about"
          element={<CommunityAboutPage />}
        />
      </Routes>
    </MemoryRouter>,
    { fixtures: { sources: [INFO] } },
  );
}

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });

describe('CommunityAboutPage', () => {
  it('renders title and community info from location state without fetching', async () => {
    const backend = createMockBackend({ sources: [INFO] });
    const spy = vi.spyOn(backend.sources, 'get');
    render(
      <BackendProvider value={backend}>
        <MemoryRouter initialEntries={[{ pathname: '/community/lemmy.world/linux/about', state: { communityInfo: INFO } }]}>
          <Routes>
            <Route path="/community/:instance/:name/about" element={<CommunityAboutPage />} />
          </Routes>
        </MemoryRouter>
      </BackendProvider>,
    );
    expect(screen.getByText('About c/linux')).toBeInTheDocument();
    expect(screen.getByText(/12,400 members/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches community info when no location state is provided', async () => {
    const backend = createMockBackend({ sources: [INFO] });
    const spy = vi.spyOn(backend.sources, 'get');
    render(
      <BackendProvider value={backend}>
        <MemoryRouter initialEntries={[{ pathname: '/community/lemmy.world/linux/about' }]}>
          <Routes>
            <Route path="/community/:instance/:name/about" element={<CommunityAboutPage />} />
          </Routes>
        </MemoryRouter>
      </BackendProvider>,
    );
    await screen.findByText(/12,400 members/);
    expect(spy).toHaveBeenCalledWith('linux@lemmy.world');
  });

  it('shows error message when fetch fails', async () => {
    const backend = createMockBackend({});
    vi.spyOn(backend.sources, 'get').mockRejectedValue(new Error('Network error'));
    render(
      <BackendProvider value={backend}>
        <MemoryRouter initialEntries={[{ pathname: '/community/lemmy.world/linux/about' }]}>
          <Routes>
            <Route path="/community/:instance/:name/about" element={<CommunityAboutPage />} />
          </Routes>
        </MemoryRouter>
      </BackendProvider>,
    );
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
