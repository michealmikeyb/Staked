import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/lemmy', () => ({
  fetchPersonDetails: vi.fn(),
  blockPerson: vi.fn().mockResolvedValue(undefined),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };

const mockPost = {
  post: { id: 1, name: 'My Terminal Setup', ap_id: 'https://lemmy.world/post/1', url: null, thumbnail_url: null, body: null, published: '2026-03-29T15:30:00Z' },
  community: { name: 'linux', actor_id: 'https://lemmy.world/c/linux' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 42, comments: 7 },
};

const mockComment = {
  comment: { id: 5, content: 'Great post!', ap_id: 'https://lemmy.world/comment/5', path: '0.5', published: '2026-03-28T10:00:00Z' },
  post: { id: 2, name: 'Ask Lemmy: best editors?', ap_id: 'https://lemmy.world/post/2', url: null, body: null, thumbnail_url: null },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'alice', display_name: null },
  counts: { score: 8 },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <ProfilePage auth={mockAuth} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { fetchPersonDetails } = await import('../lib/lemmy');
  (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
    posts: [mockPost],
    comments: [mockComment],
    personId: null,
  });
});

describe('ProfilePage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders username and instance', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByText('u/alice@lemmy.world')).toBeInTheDocument();
  });

  it('All tab is active by default and shows both post and comment', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByText('My Terminal Setup')).toBeInTheDocument();
    expect(screen.getByText('Great post!')).toBeInTheDocument();
  });

  it('Posts tab shows only post rows', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: 'Posts' }));
    expect(screen.getByText('My Terminal Setup')).toBeInTheDocument();
    expect(screen.queryByText('Great post!')).not.toBeInTheDocument();
  });

  it('Comments tab shows only comment rows', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: 'Comments' }));
    expect(screen.queryByText('My Terminal Setup')).not.toBeInTheDocument();
    expect(screen.getByText('Great post!')).toBeInTheDocument();
  });

  it('navigates to post detail on post row click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByText('My Terminal Setup'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/1', { state: { post: mockPost } });
  });

  it('navigates to post detail with commentApId on comment row click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    fireEvent.click(screen.getByText('Great post!'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/2', {
      state: {
        postId: mockComment.post.id,
        commentApId: 'https://lemmy.world/comment/5',
      },
    });
  });

  it('shows empty state when no posts or comments', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ posts: [], comments: [], personId: null });
    renderPage();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
  });

  it('shows error when fetch fails', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });
});

describe('ProfilePage with target prop', () => {
  it('fetches via auth.instance using user@instance format when target is provided', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ posts: [], comments: [], personId: null });
    render(
      <MemoryRouter initialEntries={['/user/beehaw.org/bob']}>
        <ProfilePage auth={mockAuth} target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(fetchPersonDetails).toHaveBeenCalledWith('lemmy.world', 'tok', 'bob@beehaw.org', 1);
  });

  it('shows target username and instance in header', async () => {
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ posts: [], comments: [], personId: null });
    render(
      <MemoryRouter initialEntries={['/user/beehaw.org/bob']}>
        <ProfilePage auth={mockAuth} target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.getByText('u/bob@beehaw.org')).toBeInTheDocument();
  });
});

describe('ProfilePage block functionality', () => {
  const targetAuth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };

  function renderTarget() {
    return render(
      <MemoryRouter initialEntries={['/user/beehaw.org/bob']}>
        <ProfilePage auth={targetAuth} target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
    );
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const { fetchPersonDetails } = await import('../lib/lemmy');
    (fetchPersonDetails as ReturnType<typeof vi.fn>).mockResolvedValue({
      posts: [],
      comments: [],
      personId: 77,
    });
  });

  it('does not show hamburger menu button when viewing own profile', async () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage auth={targetAuth} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /profile menu/i })).not.toBeInTheDocument();
  });

  it('does not show hamburger menu button when target matches own username and instance', async () => {
    render(
      <MemoryRouter initialEntries={['/user/lemmy.world/alice']}>
        <ProfilePage auth={targetAuth} target={{ username: 'alice', instance: 'lemmy.world' }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /profile menu/i })).not.toBeInTheDocument();
  });

  it('shows hamburger menu button when same username but different instance', async () => {
    render(
      <MemoryRouter initialEntries={['/user/beehaw.org/alice']}>
        <ProfilePage auth={targetAuth} target={{ username: 'alice', instance: 'beehaw.org' }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /profile menu/i })).toBeInTheDocument();
  });

  it('shows hamburger menu button when viewing another user', async () => {
    renderTarget();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /profile menu/i })).toBeInTheDocument();
  });

  it('clicking hamburger opens menu panel with Block button', async () => {
    renderTarget();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    expect(screen.getByRole('button', { name: /^block$/i })).toBeInTheDocument();
  });

  it('clicking Block in menu shows confirmation panel', async () => {
    renderTarget();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    expect(screen.getByText('Block u/bob?')).toBeInTheDocument();
  });

  it('Cancel closes the confirmation panel', async () => {
    renderTarget();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Block u/bob?')).not.toBeInTheDocument();
  });

  it('confirming block calls blockPerson and navigates with toast', async () => {
    const { blockPerson } = await import('../lib/lemmy');
    renderTarget();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(blockPerson).toHaveBeenCalledWith('lemmy.world', 'tok', 77, true));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { toast: 'Blocked u/bob' } });
  });

  it('shows inline error when blockPerson rejects', async () => {
    const { blockPerson } = await import('../lib/lemmy');
    (blockPerson as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Server error'));
    renderTarget();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(screen.getByText('Failed to block. Try again.')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalledWith('/', expect.anything());
  });
});
