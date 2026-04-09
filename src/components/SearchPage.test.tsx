import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchPage from './SearchPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  searchCommunities: vi.fn(),
  searchPosts: vi.fn(),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'me' };

const mockCommunity = {
  community: {
    id: 10,
    name: 'rust',
    actor_id: 'https://lemmy.world/c/rust',
    icon: undefined,
    description: 'The Rust programming language',
  },
  counts: { subscribers: 5000 },
  subscribed: 'NotSubscribed',
  blocked: false,
  banned_from_community: false,
};

const mockPost = {
  post: {
    id: 99,
    name: 'Rust is great',
    ap_id: 'https://lemmy.world/post/99',
    url: null,
    thumbnail_url: null,
    body: null,
  },
  community: { name: 'rust', actor_id: 'https://lemmy.world/c/rust' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 50, comments: 10, child_count: 10 },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <SearchPage auth={mockAuth} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { searchCommunities, searchPosts } = await import('../lib/lemmy');
  (searchCommunities as ReturnType<typeof vi.fn>).mockResolvedValue([mockCommunity]);
  (searchPosts as ReturnType<typeof vi.fn>).mockResolvedValue([mockPost]);
});

describe('SearchPage', () => {
  it('shows initial prompt before any search', () => {
    renderPage();
    expect(screen.getByText('Search communities and posts')).toBeInTheDocument();
  });

  it('shows loading state while searching', async () => {
    const { searchCommunities } = await import('../lib/lemmy');
    (searchCommunities as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}),
    );
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders community results after searching', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() =>
      expect(screen.getByText('c/rust')).toBeInTheDocument(),
    );
    expect(screen.getByText('5,000 subscribers')).toBeInTheDocument();
  });

  it('switches to Posts tab and shows post results', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('Communities'));
    fireEvent.click(screen.getByRole('button', { name: /posts/i }));
    expect(screen.getByText('Rust is great')).toBeInTheDocument();
  });

  it('shows empty state when no community results', async () => {
    const { searchCommunities } = await import('../lib/lemmy');
    (searchCommunities as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyzzy' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() =>
      expect(screen.getByText(/No results for/)).toBeInTheDocument(),
    );
  });

  it('shows error state when search fails', async () => {
    const { searchCommunities } = await import('../lib/lemmy');
    (searchCommunities as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() =>
      expect(screen.getByText('Network error')).toBeInTheDocument(),
    );
  });

  it('navigates to community when community result is clicked', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('c/rust'));
    fireEvent.click(screen.getByText('c/rust'));
    expect(mockNavigate).toHaveBeenCalledWith('/community/lemmy.world/rust');
  });

  it('navigates to /view/:instance/:postId when post result is clicked', async () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('Communities'));
    fireEvent.click(screen.getByRole('button', { name: /posts/i }));
    fireEvent.click(screen.getByText('Rust is great'));
    expect(mockNavigate).toHaveBeenCalledWith('/view/lemmy.world/99');
  });
});
