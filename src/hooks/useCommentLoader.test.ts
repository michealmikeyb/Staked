import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCommentLoader } from './useCommentLoader';
import { fetchComments } from '../lib/lemmy';
import type { CommentSortType } from '../lib/lemmy';

vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([
    { comment: { id: 1, content: 'hi', path: '0.1', ap_id: 'https://lemmy.world/comment/1' } },
  ]),
  resolvePostId: vi.fn().mockResolvedValue(null),
}));

const mockAuth = { instance: 'lemmy.world', token: 'tok', username: 'alice' };
const mockPost = { ap_id: 'https://lemmy.world/post/42', id: 42 };
const mockCommunity = { actor_id: 'https://lemmy.world/c/programming' };

beforeEach(() => { vi.clearAllMocks(); });

describe('useCommentLoader', () => {
  it('returns commentsLoaded=false initially', () => {
    const { result } = renderHook(() =>
      useCommentLoader(mockPost, mockCommunity, mockAuth),
    );
    expect(result.current.commentsLoaded).toBe(false);
  });

  it('loads comments and sets commentsLoaded=true', async () => {
    const { result } = renderHook(() =>
      useCommentLoader(mockPost, mockCommunity, mockAuth),
    );
    await waitFor(() => expect(result.current.commentsLoaded).toBe(true));
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].comment.id).toBe(1);
  });

  it('exposes resolvedInstanceRef and resolvedTokenRef', async () => {
    const { result } = renderHook(() =>
      useCommentLoader(mockPost, mockCommunity, mockAuth),
    );
    await waitFor(() => expect(result.current.commentsLoaded).toBe(true));
    expect(result.current.resolvedInstanceRef.current).toBe('lemmy.world');
    expect(result.current.resolvedTokenRef.current).toBeDefined();
  });

  it('re-fetches with new sort when sort param changes', async () => {
    const { rerender } = renderHook(
      ({ sort }: { sort: CommentSortType }) =>
        useCommentLoader(mockPost, mockCommunity, mockAuth, sort),
      { initialProps: { sort: 'Top' as CommentSortType } },
    );
    await waitFor(() => expect(vi.mocked(fetchComments)).toHaveBeenCalledWith(
      'lemmy.world', 'tok', 42, 'Top',
    ));
    vi.clearAllMocks();
    rerender({ sort: 'New' });
    await waitFor(() => expect(vi.mocked(fetchComments)).toHaveBeenCalledWith(
      'lemmy.world', 'tok', 42, 'New',
    ));
  });
});
