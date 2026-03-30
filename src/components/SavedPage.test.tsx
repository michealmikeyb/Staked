import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SavedPage from './SavedPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockPost = {
  post: {
    id: 1,
    name: 'A Saved Post',
    ap_id: 'https://lemmy.world/post/1',
    url: null,
    thumbnail_url: null,
    body: null,
  },
  community: { name: 'technology', actor_id: 'https://lemmy.world/c/technology' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 100, comments: 5, child_count: 5 },
};

vi.mock('../lib/lemmy', () => ({
  fetchSavedPosts: vi.fn(),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/saved']}>
      <SavedPage auth={mockAuth} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { fetchSavedPosts } = await import('../lib/lemmy');
  (fetchSavedPosts as ReturnType<typeof vi.fn>).mockResolvedValue([mockPost]);
});

describe('SavedPage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders saved post title after loading', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('A Saved Post')).toBeInTheDocument(),
    );
  });

  it('renders community name', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('c/technology')).toBeInTheDocument(),
    );
  });

  it('renders score and comment count', async () => {
    renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    expect(screen.getByText(/▲ 100/)).toBeInTheDocument();
    expect(screen.getByText(/💬 5/)).toBeInTheDocument();
  });

  it('shows empty state when no saved posts', async () => {
    const { fetchSavedPosts } = await import('../lib/lemmy');
    (fetchSavedPosts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('No saved posts')).toBeInTheDocument(),
    );
  });

  it('navigates to saved post detail on click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    fireEvent.click(screen.getByText('A Saved Post'));
    expect(mockNavigate).toHaveBeenCalledWith('/saved/1', { state: { post: mockPost } });
  });

  it('shows error message when fetch fails', async () => {
    const { fetchSavedPosts } = await import('../lib/lemmy');
    (fetchSavedPosts as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Network error')).toBeInTheDocument(),
    );
  });
});
