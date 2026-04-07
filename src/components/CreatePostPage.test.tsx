import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CreatePostPage from './CreatePostPage';
import * as lemmy from '../lib/lemmy';

vi.mock('../lib/lemmy', () => ({
  resolveCommunityId: vi.fn(),
  createPost: vi.fn(),
  uploadImage: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const auth = { instance: 'lemmy.world', token: 'tok', username: 'user' };

function renderPage(locationState: unknown = null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/create-post', state: locationState }]}>
      <Routes>
        <Route path="/create-post" element={<CreatePostPage auth={auth} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('CreatePostPage', () => {
  it('renders all form fields', () => {
    renderPage();
    expect(screen.getByPlaceholderText('communityname@instance.tld')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Post title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Optional text body…')).toBeInTheDocument();
  });

  it('pre-fills community from location state', () => {
    renderPage({ community: 'programming@lemmy.world' });
    expect(screen.getByPlaceholderText('communityname@instance.tld')).toHaveValue('programming@lemmy.world');
  });

  it('disables Post button when title is empty', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('communityname@instance.tld'), {
      target: { value: 'programming@lemmy.world' },
    });
    expect(screen.getByRole('button', { name: /^post$/i })).toBeDisabled();
  });

  it('disables Post button when community is empty', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'Hello world' } });
    expect(screen.getByRole('button', { name: /^post$/i })).toBeDisabled();
  });

  it('enables Post button when title and community are both filled', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('communityname@instance.tld'), {
      target: { value: 'programming@lemmy.world' },
    });
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'Hello world' } });
    expect(screen.getByRole('button', { name: /^post$/i })).toBeEnabled();
  });

  it('resolves community id, calls createPost, and navigates back on success', async () => {
    vi.mocked(lemmy.resolveCommunityId).mockResolvedValue(42);
    vi.mocked(lemmy.createPost).mockResolvedValue(undefined);
    renderPage({ community: 'programming@lemmy.world' });
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'My post' } });
    fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() =>
      expect(lemmy.resolveCommunityId).toHaveBeenCalledWith('lemmy.world', 'tok', 'programming@lemmy.world'),
    );
    expect(lemmy.createPost).toHaveBeenCalledWith('lemmy.world', 'tok', {
      name: 'My post',
      community_id: 42,
      url: 'https://example.com',
      body: undefined,
    });
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('omits url and body when empty', async () => {
    vi.mocked(lemmy.resolveCommunityId).mockResolvedValue(1);
    vi.mocked(lemmy.createPost).mockResolvedValue(undefined);
    renderPage({ community: 'tech@lemmy.world' });
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'Title only' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() => expect(lemmy.createPost).toHaveBeenCalled());
    expect(lemmy.createPost).toHaveBeenCalledWith('lemmy.world', 'tok', {
      name: 'Title only',
      community_id: 1,
      url: undefined,
      body: undefined,
    });
  });

  it('shows error message when submit fails', async () => {
    vi.mocked(lemmy.resolveCommunityId).mockRejectedValue(new Error('Community not found'));
    renderPage({ community: 'bad@lemmy.world' });
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'My post' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() => expect(screen.getByText('Community not found')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows upload error when image upload fails', async () => {
    vi.mocked(lemmy.uploadImage).mockRejectedValue(new Error('Upload failed: 413'));
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Upload failed: 413')).toBeInTheDocument());
  });

  it('auto-fills URL field after successful image upload', async () => {
    vi.mocked(lemmy.uploadImage).mockResolvedValue('https://lemmy.world/pictrs/image/abc.jpg');
    renderPage();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('https://...')).toHaveValue('https://lemmy.world/pictrs/image/abc.jpg'),
    );
  });

  it('navigates back when back button is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
