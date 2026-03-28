import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

// ── Lemmy mock ────────────────────────────────────────────────────────────────
vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
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
      />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: -200, clientY: 0 });
    fireEvent.pointerUp(card, { clientX: -200, clientY: 0 });

    capturedDragHandler!({ movement: [-200, 0], velocity: [0, 0], last: true });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });
});
