import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

// ── Lemmy mock ────────────────────────────────────────────────────────────────
vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'My reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
  savePost: vi.fn().mockResolvedValue(undefined),
}));

// ── Gesture mock ──────────────────────────────────────────────────────────────
// @use-gesture/react's useDrag doesn't work in jsdom (no real pointer capture).
// We capture the handler so tests can invoke it directly.
let capturedDragHandler: ((state: object) => void) | null = null;

vi.mock('@use-gesture/react', () => ({
  useDrag: (handler: (state: object) => void) => {
    capturedDragHandler = handler;
    return () => ({
      onPointerDown: (e: PointerEvent) => void e,
    });
  },
}));

// ── Framer Motion mock ────────────────────────────────────────────────────────
// animate() is async in the real library; we call onComplete immediately so
// onSwipeRight/Left fires synchronously in tests.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    animate: (_target: unknown, _value: unknown, opts: { onComplete?: () => void } = {}) => {
      opts.onComplete?.();
      return { stop: () => {} };
    },
  };
});

import PostCard from './PostCard';
import { type PostView } from '../lib/lemmy';

const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

const MOCK_POST = {
  post: { id: 1, name: 'Rust post', body: null, url: 'https://example.com', thumbnail_url: null },
  community: { name: 'programming', actor_id: 'https://lemmy.world/c/programming' },
  creator: { name: 'bob' },
  counts: { score: 200, comments: 15 },
} as unknown as PostView;

describe('PostCard', () => {
  it('renders post title', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText('Rust post')).toBeInTheDocument();
  });

  it('renders community name', () => {
    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText(/programming/i)).toBeInTheDocument();
  });
});

describe('PostCard gestures', () => {
  beforeEach(() => {
    capturedDragHandler = null;
  });

  it('calls onSwipeRight when dragged far right', () => {
    const onSwipeRight = vi.fn();
    const { container } = render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={vi.fn()}
        onSave={vi.fn()}
      />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: 200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: 200, clientY: 0 });

    capturedDragHandler!({ movement: [200, 0], velocity: [0, 0], last: true });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('calls onSwipeLeft when dragged far left', () => {
    const onSwipeLeft = vi.fn();
    const { container } = render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={onSwipeLeft}
        onSave={vi.fn()}
      />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: -200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: -200, clientY: 0 });

    capturedDragHandler!({ movement: [-200, 0], velocity: [0, 0], last: true });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('calls onSave when scroll content is pulled down 80px from the top', () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onSave={onSave}
      />
    );

    const scrollContent = getByTestId('scroll-content');
    fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(scrollContent, { touches: [{ clientY: 90 }] });
    fireEvent.touchEnd(scrollContent);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not call onSave when pull delta is below 80px', () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onSave={onSave}
      />
    );

    const scrollContent = getByTestId('scroll-content');
    fireEvent.touchStart(scrollContent, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(scrollContent, { touches: [{ clientY: 50 }] });
    fireEvent.touchEnd(scrollContent);

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('PostCard reply submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createComment with correct args when a reply is submitted', async () => {
    const { fetchComments, createComment } = await import('../lib/lemmy');
    const mockComment = {
      comment: { id: 1, content: 'Original comment', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
      creator: { name: 'alice', display_name: null },
      counts: { score: 5 },
    };
    (fetchComments as ReturnType<typeof vi.fn>).mockResolvedValue([mockComment]);

    render(
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => screen.getByText('Original comment'));

    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    fireEvent.change(screen.getByPlaceholderText(/write a reply/i), {
      target: { value: 'My reply' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });

    expect(createComment).toHaveBeenCalledWith(
      'lemmy.world', 'tok', 1, 'My reply', 1
    );
  });
});
