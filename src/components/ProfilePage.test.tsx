import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  renderWithBackend, makePost, makeComment, makeUser, makeSource,
} from '../test-utils';
import { createMockBackend } from '../lib/api/backends/mock';
import { BackendProvider } from '../lib/api/context';
import ProfilePage from './ProfilePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Default mock viewer handle from createMockBackend
const VIEWER = makeUser({ handle: 'viewer@mock.test' });
const BOB = makeUser({ id: 'bob-id', handle: 'bob@beehaw.org' });

const LINUX_SOURCE = makeSource({ name: 'linux', id: 'https://lemmy.world/c/linux', handle: 'linux@lemmy.world' });

const mockPost = makePost({
  id: '1',
  title: 'My Terminal Setup',
  author: VIEWER,
  source: LINUX_SOURCE,
  publishedAt: '2026-03-29T15:30:00Z',
  permalink: 'https://lemmy.world/post/1',
  externalUrl: null,
  counts: { score: 42, comments: 7 },
});

const mockComment = makeComment({
  id: 'c-5',
  body: 'Great post!',
  author: VIEWER,
  postId: '2',
  permalink: 'https://lemmy.world/comment/5',
  publishedAt: '2026-03-28T10:00:00Z',
  counts: { score: 8 },
});

const DEFAULT_FIXTURES = {
  users: [VIEWER],
  posts: [mockPost],
  comments: { '2': [mockComment] },
};

function renderPage(fixtureOverrides = {}) {
  return renderWithBackend(
    <MemoryRouter initialEntries={['/profile']}>
      <ProfilePage />
    </MemoryRouter>,
    { fixtures: { ...DEFAULT_FIXTURES, ...fixtureOverrides } },
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('ProfilePage', () => {
  it('shows loading state initially', () => {
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders username and instance', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByText('u/viewer@mock.test')).toBeInTheDocument();
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
    expect(mockNavigate).toHaveBeenCalledWith('/profile/view', { state: { post: mockPost } });
  });

  it('navigates to post detail with commentApId on comment row click', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    fireEvent.click(screen.getByText('Great post!'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/view', {
      state: {
        postId: mockComment.postId,
        commentApId: mockComment.permalink,
      },
    });
  });

  it('shows empty state when no posts or comments', async () => {
    renderWithBackend(
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>,
      { fixtures: { users: [VIEWER], posts: [], comments: {} } },
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
  });

  it('shows error when fetch fails', async () => {
    const backend = createMockBackend({});
    vi.spyOn(backend.users, 'get').mockRejectedValue(new Error('Network error'));
    render(
      <BackendProvider value={backend}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </BackendProvider>,
    );
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });
});

describe('ProfilePage with target prop', () => {
  it('loads profile using handle format when target is provided', async () => {
    renderWithBackend(
      <MemoryRouter>
        <ProfilePage target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
      { fixtures: { users: [BOB] } },
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
  });

  it('shows target username and instance in header', async () => {
    renderWithBackend(
      <MemoryRouter>
        <ProfilePage target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
      { fixtures: { users: [BOB] } },
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.getByText('u/bob@beehaw.org')).toBeInTheDocument();
  });
});

describe('ProfilePage block functionality', () => {
  function renderTarget() {
    return renderWithBackend(
      <MemoryRouter>
        <ProfilePage target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
      { fixtures: { users: [BOB] } },
    );
  }

  it('does not show hamburger menu button when viewing own profile', async () => {
    renderWithBackend(
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>,
      { fixtures: { users: [VIEWER] } },
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /profile menu/i })).not.toBeInTheDocument();
  });

  it('does not show hamburger menu button when target matches own handle', async () => {
    const SELF = makeUser({ handle: 'viewer@mock.test' });
    renderWithBackend(
      <MemoryRouter>
        <ProfilePage target={{ username: 'viewer', instance: 'mock.test' }} />
      </MemoryRouter>,
      { fixtures: { users: [SELF] } },
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /profile menu/i })).not.toBeInTheDocument();
  });

  it('shows hamburger menu button when same username but different instance', async () => {
    const OTHER = makeUser({ handle: 'viewer@other.org' });
    renderWithBackend(
      <MemoryRouter>
        <ProfilePage target={{ username: 'viewer', instance: 'other.org' }} />
      </MemoryRouter>,
      { fixtures: { users: [OTHER] } },
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

  it('confirming block calls backend.users.block and navigates with toast', async () => {
    const { backend } = renderTarget();
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    const spy = vi.spyOn(backend.users, 'block');
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('bob-id', true));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { toast: 'Blocked u/bob' } });
  });

  it('shows inline error when block rejects', async () => {
    const backend = createMockBackend({ users: [BOB] });
    vi.spyOn(backend.users, 'block').mockRejectedValue(new Error('Server error'));
    render(
      <BackendProvider value={backend}>
        <MemoryRouter>
          <ProfilePage target={{ username: 'bob', instance: 'beehaw.org' }} />
        </MemoryRouter>
      </BackendProvider>,
    );
    await waitFor(() => expect(screen.getByText('No activity yet')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /profile menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    await waitFor(() => expect(screen.getByText('Failed to block. Try again.')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalledWith('/', expect.anything());
  });
});

describe('ProfilePage delete (own profile)', () => {
  it('shows delete button on post card when viewing own profile', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.getByRole('button', { name: /delete post/i })).toBeInTheDocument();
  });

  it('does not show delete button when anonymous (no session)', async () => {
    renderWithBackend(
      <MemoryRouter>
        <ProfilePage target={{ username: 'viewer', instance: 'mock.test' }} />
      </MemoryRouter>,
      {
        fixtures: { users: [VIEWER], posts: [mockPost], comments: { '2': [mockComment] } },
        anonymous: true,
      },
    );
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.queryByRole('button', { name: /delete post/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete comment/i })).not.toBeInTheDocument();
  });

  it('does not show delete button when viewing another user profile', async () => {
    const bobPost = makePost({ title: 'My Terminal Setup', author: BOB, source: LINUX_SOURCE });
    renderWithBackend(
      <MemoryRouter>
        <ProfilePage target={{ username: 'bob', instance: 'beehaw.org' }} />
      </MemoryRouter>,
      { fixtures: { users: [BOB], posts: [bobPost] } },
    );
    await waitFor(() => screen.getByText('My Terminal Setup'));
    expect(screen.queryByRole('button', { name: /delete post/i })).not.toBeInTheDocument();
  });

  it('clicking delete post button shows inline confirmation strip', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: /delete post/i }));
    expect(screen.getByText('Delete post?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('clicking Cancel in post confirm strip reverts to normal card', async () => {
    renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    fireEvent.click(screen.getByRole('button', { name: /delete post/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Delete post?')).not.toBeInTheDocument();
  });

  it('confirming post delete calls backend.posts.delete and removes post from list', async () => {
    const { backend } = renderPage();
    await waitFor(() => screen.getByText('My Terminal Setup'));
    const spy = vi.spyOn(backend.posts, 'delete');
    fireEvent.click(screen.getByRole('button', { name: /delete post/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(screen.queryByText('My Terminal Setup')).not.toBeInTheDocument());
  });

  it('shows delete button on comment card when viewing own profile', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    expect(screen.getByRole('button', { name: /delete comment/i })).toBeInTheDocument();
  });

  it('clicking delete comment button shows inline confirmation strip', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    fireEvent.click(screen.getByRole('button', { name: /delete comment/i }));
    expect(screen.getByText('Delete comment?')).toBeInTheDocument();
  });

  it('confirming comment delete calls backend.comments.delete and removes comment from list', async () => {
    const { backend } = renderPage();
    await waitFor(() => screen.getByText('Great post!'));
    const spy = vi.spyOn(backend.comments, 'delete');
    fireEvent.click(screen.getByRole('button', { name: /delete comment/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('c-5'));
    await waitFor(() => expect(screen.queryByText('Great post!')).not.toBeInTheDocument());
  });
});
