import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithBackend, makeSource } from '../test-utils';
import CreatePostPage from './CreatePostPage';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockNavigate = vi.fn();

function renderPage(locationState: unknown = null) {
  return renderWithBackend(
    <MemoryRouter initialEntries={[{ pathname: '/create-post', state: locationState }]}>
      <Routes>
        <Route path="/create-post" element={<CreatePostPage />} />
      </Routes>
    </MemoryRouter>,
    { fixtures: { sources: [makeSource({ handle: 'programming@lemmy.world', name: 'programming' })] } },
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

  it('calls backend.posts.create and navigates back on success', async () => {
    const { backend } = renderPage({ community: 'programming@lemmy.world' });
    const spy = vi.spyOn(backend.posts, 'create').mockResolvedValue({} as never);
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'My post' } });
    fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({
      sourceHandle: 'programming@lemmy.world',
      title: 'My post',
      url: 'https://example.com',
      body: undefined,
    }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('omits url and body when empty', async () => {
    const { backend } = renderPage({ community: 'tech@lemmy.world' });
    const spy = vi.spyOn(backend.posts, 'create').mockResolvedValue({} as never);
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'Title only' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({
      sourceHandle: 'tech@lemmy.world',
      title: 'Title only',
      url: undefined,
      body: undefined,
    }));
  });

  it('shows error message when submit fails', async () => {
    const { backend } = renderPage({ community: 'bad@lemmy.world' });
    vi.spyOn(backend.posts, 'create').mockRejectedValue(new Error('Community not found'));
    fireEvent.change(screen.getByPlaceholderText('Post title'), { target: { value: 'My post' } });
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    await waitFor(() => expect(screen.getByText('Community not found')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows upload error when image upload fails', async () => {
    const { backend } = renderPage();
    vi.spyOn(backend.media, 'uploadImage').mockRejectedValue(new Error('Upload failed: 413'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Upload failed: 413')).toBeInTheDocument());
  });

  it('auto-fills URL field after successful image upload', async () => {
    const { backend } = renderPage();
    vi.spyOn(backend.media, 'uploadImage').mockResolvedValue({ url: 'https://lemmy.world/pictrs/image/abc.jpg' });
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
