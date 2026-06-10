import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithBackend, makePost, makeSource } from '../test-utils';
import { createMockBackend } from '../lib/api/backends/mock';
import { BackendProvider } from '../lib/api/context';
import { render } from '@testing-library/react';
import SavedPage from './SavedPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const TECH_SOURCE = makeSource({ name: 'technology', handle: 'technology@lemmy.world' });
const savedPost = makePost({
  id: '1',
  title: 'A Saved Post',
  source: TECH_SOURCE,
  counts: { score: 100, comments: 5 },
});

function renderPage(fixtures = {}) {
  return renderWithBackend(
    <MemoryRouter initialEntries={['/saved']}>
      <SavedPage />
    </MemoryRouter>,
    { fixtures: { savedPosts: [savedPost], ...fixtures } },
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SavedPage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders saved post title after loading', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('A Saved Post')).toBeInTheDocument());
  });

  it('renders community name', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('c/technology')).toBeInTheDocument());
  });

  it('renders score and comment count', async () => {
    renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    expect(screen.getByText(/▲ 100/)).toBeInTheDocument();
    expect(screen.getByText(/💬 5/)).toBeInTheDocument();
  });

  it('shows empty state when no saved posts', async () => {
    renderWithBackend(
      <MemoryRouter initialEntries={['/saved']}><SavedPage /></MemoryRouter>,
      { fixtures: {} },
    );
    await waitFor(() => expect(screen.getByText('No saved posts')).toBeInTheDocument());
  });

  it('navigates to saved post detail on click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    fireEvent.click(screen.getByText('A Saved Post'));
    expect(mockNavigate).toHaveBeenCalledWith('/saved/1', { state: { post: savedPost } });
  });

  it('shows error message when fetch fails', async () => {
    const backend = createMockBackend({});
    vi.spyOn(backend.feed, 'getSavedPosts').mockRejectedValue(new Error('Network error'));
    render(
      <BackendProvider value={backend}>
        <MemoryRouter><SavedPage /></MemoryRouter>
      </BackendProvider>,
    );
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('renders an Unsave button on each post card', async () => {
    renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    expect(screen.getByRole('button', { name: /unsave/i })).toBeInTheDocument();
  });

  it('clicking Unsave calls backend.posts.save with false', async () => {
    const { backend } = renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    const spy = vi.spyOn(backend.posts, 'save');
    fireEvent.click(screen.getByRole('button', { name: /unsave/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1', false));
  });

  it('clicking Unsave removes the post from the list', async () => {
    renderPage();
    await waitFor(() => screen.getByText('A Saved Post'));
    fireEvent.click(screen.getByRole('button', { name: /unsave/i }));
    await waitFor(() => expect(screen.queryByText('A Saved Post')).not.toBeInTheDocument());
  });
});
