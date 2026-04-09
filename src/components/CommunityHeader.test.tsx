import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommunityHeader from './CommunityHeader';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const BASE_PROPS = {
  name: 'asklemmy',
  instance: 'lemmy.world',
  sortType: 'Active' as const,
  onSortChange: vi.fn(),
  onBack: vi.fn(),
};

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });

describe('CommunityHeader', () => {
  it('renders the community name', () => {
    render(<CommunityHeader {...BASE_PROPS} />);
    expect(screen.getByText('c/asklemmy')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<CommunityHeader {...BASE_PROPS} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens sort dropdown and calls onSortChange when an option is selected', () => {
    const onSortChange = vi.fn();
    render(<CommunityHeader {...BASE_PROPS} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole('button', { name: /active/i }));
    fireEvent.click(screen.getByRole('button', { name: /^hot$/i }));
    expect(onSortChange).toHaveBeenCalledWith('Hot');
  });

  it('opens community menu when hamburger is clicked', () => {
    render(<CommunityHeader {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
    expect(screen.getByRole('button', { name: /^post$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^subscribe$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^about$/i })).toBeInTheDocument();
  });

  it('navigates to create-post when Post is clicked in the menu', () => {
    render(<CommunityHeader {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/create-post',
      { state: { community: 'asklemmy@lemmy.world' } },
    );
  });

  it('navigates to about page with communityInfo state when About is clicked', () => {
    const communityInfo = {
      id: 1, icon: undefined, banner: undefined, description: 'desc',
      counts: { subscribers: 100, posts: 50, comments: 200 },
      subscribed: 'NotSubscribed' as const,
    };
    render(<CommunityHeader {...BASE_PROPS} communityInfo={communityInfo} />);
    fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^about$/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/community/lemmy.world/asklemmy/about',
      { state: { communityInfo } },
    );
  });

  it('calls onSubscribeToggle when Subscribe is clicked and communityInfo is loaded', () => {
    const onSubscribeToggle = vi.fn();
    const communityInfo = {
      id: 1, icon: undefined, banner: undefined, description: '',
      counts: { subscribers: 100, posts: 50, comments: 200 },
      subscribed: 'NotSubscribed' as const,
    };
    render(
      <CommunityHeader
        {...BASE_PROPS}
        communityInfo={communityInfo}
        onSubscribeToggle={onSubscribeToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^subscribe$/i }));
    expect(onSubscribeToggle).toHaveBeenCalledTimes(1);
  });

  it('shows "Subscribed" label and subscribe button is highlighted when already subscribed', () => {
    const communityInfo = {
      id: 1, icon: undefined, banner: undefined, description: '',
      counts: { subscribers: 100, posts: 50, comments: 200 },
      subscribed: 'Subscribed' as const,
    };
    render(<CommunityHeader {...BASE_PROPS} communityInfo={communityInfo} />);
    fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
    expect(screen.getByRole('button', { name: /^subscribed$/i })).toBeInTheDocument();
  });

  it('disables subscribe button when communityInfo is not yet loaded', () => {
    render(<CommunityHeader {...BASE_PROPS} communityInfo={null} />);
    fireEvent.click(screen.getByRole('button', { name: /community menu/i }));
    expect(screen.getByRole('button', { name: /^subscribe$/i })).toBeDisabled();
  });

  it('shows community icon image when communityInfo.icon is provided', () => {
    const communityInfo = {
      id: 1, icon: 'https://lemmy.world/icon.png', banner: undefined, description: '',
      counts: { subscribers: 100, posts: 50, comments: 200 },
      subscribed: 'NotSubscribed' as const,
    };
    render(<CommunityHeader {...BASE_PROPS} communityInfo={communityInfo} />);
    const img = document.querySelector('[data-testid="community-avatar-img"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://lemmy.world/icon.png');
  });
});
