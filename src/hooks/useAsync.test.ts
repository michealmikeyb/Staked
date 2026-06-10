import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  it('returns data on success', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []));
    await waitFor(() => expect(result.current.data).toBe(42));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns error on failure', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('nope')), []));
    await waitFor(() => expect(result.current.error?.message).toBe('nope'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
