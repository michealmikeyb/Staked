import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithBackend, makePost, makeSource } from '../test-utils';
import type { MockBackend } from '../lib/api/backends/mock';
import SearchPage from './SearchPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSource = makeSource({
  id: 'https://lemmy.world/c/rust',
  name: 'rust',
  handle: 'rust@lemmy.world',
  description: 'The Rust programming language',
  counts: { members: 5000, posts: 0 },
});

const mockPost = makePost({
  id: '99',
  title: 'Rust is great',
  permalink: 'https://lemmy.world/post/99',
  source: mockSource,
  counts: { score: 50, comments: 10 },
});

function renderPage() {
  return renderWithBackend(
    <MemoryRouter initialEntries={['/search']}>
      <SearchPage />
    </MemoryRouter>,
  );
}

function setupSearchMocks(backend: MockBackend) {
  vi.spyOn(backend.search, 'sources').mockResolvedValue({ items: [mockSource], nextCursor: null });
  vi.spyOn(backend.search, 'posts').mockResolvedValue({ items: [mockPost], nextCursor: null });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SearchPage', () => {
  it('shows initial prompt before any search', () => {
    renderPage();
    expect(screen.getByText('Search communities and posts')).toBeInTheDocument();
  });

  it('shows loading state while searching', async () => {
    const { backend } = renderPage();
    vi.spyOn(backend.search, 'sources').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(backend.search, 'posts').mockImplementation(() => new Promise(() => {}));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders community results after searching', async () => {
    const { backend } = renderPage();
    setupSearchMocks(backend);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => expect(screen.getByText('c/rust')).toBeInTheDocument());
    expect(screen.getByText('5,000 subscribers')).toBeInTheDocument();
  });

  it('switches to Posts tab and shows post results', async () => {
    const { backend } = renderPage();
    setupSearchMocks(backend);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('Communities'));
    fireEvent.click(screen.getByRole('button', { name: /posts/i }));
    expect(screen.getByText('Rust is great')).toBeInTheDocument();
  });

  it('shows empty state when no community results', async () => {
    const { backend } = renderPage();
    vi.spyOn(backend.search, 'sources').mockResolvedValue({ items: [], nextCursor: null });
    vi.spyOn(backend.search, 'posts').mockResolvedValue({ items: [], nextCursor: null });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyzzy' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => expect(screen.getByText(/No results for/)).toBeInTheDocument());
  });

  it('shows error state when search fails', async () => {
    const { backend } = renderPage();
    vi.spyOn(backend.search, 'sources').mockRejectedValue(new Error('Network error'));
    vi.spyOn(backend.search, 'posts').mockRejectedValue(new Error('Network error'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('navigates to community when community result is clicked', async () => {
    const { backend } = renderPage();
    setupSearchMocks(backend);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('c/rust'));
    fireEvent.click(screen.getByText('c/rust'));
    expect(mockNavigate).toHaveBeenCalledWith('/community/lemmy.world/rust');
  });

  it('navigates to /view/:instance/:postId when post result is clicked', async () => {
    const { backend } = renderPage();
    setupSearchMocks(backend);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rust' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => screen.getByText('Communities'));
    fireEvent.click(screen.getByRole('button', { name: /posts/i }));
    fireEvent.click(screen.getByText('Rust is great'));
    expect(mockNavigate).toHaveBeenCalledWith('/view/lemmy.world/99');
  });

  it('shows "Go to post" chip when a Lemmy post URL is typed', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'https://lemmy.world/post/2395953' },
    });
    expect(screen.getByText(/Go to post/)).toBeInTheDocument();
  });

  it('shows "Go to post" chip for a URL without protocol', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'lemmy.world/post/42' },
    });
    expect(screen.getByText(/Go to post/)).toBeInTheDocument();
  });

  it('shows "Go to post" chip for a Stakswipe share URL', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'https://stakswipe.com/#/post/lemmy.world/2395953' },
    });
    expect(screen.getByText(/Go to post/)).toBeInTheDocument();
  });

  it('does not show "Go to post" chip for a plain text query', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'rust programming' },
    });
    expect(screen.queryByText(/Go to post/)).not.toBeInTheDocument();
  });

  it('chip click navigates to /view/:instance/:postId', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'https://lemmy.world/post/2395953' },
    });
    fireEvent.click(screen.getByText(/Go to post/));
    expect(mockNavigate).toHaveBeenCalledWith('/view/lemmy.world/2395953');
  });

  it('disables Search button when a URL is detected', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'https://lemmy.world/post/2395953' },
    });
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('hides chip and re-enables Search when input changes to non-URL', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'https://lemmy.world/post/2395953' },
    });
    expect(screen.getByText(/Go to post/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'rust' },
    });
    expect(screen.queryByText(/Go to post/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).not.toBeDisabled();
  });
});
