import { useEffect, useState, type DependencyList } from 'react';

export interface AsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncResult<T> {
  const [state, setState] = useState<AsyncResult<T>>({ data: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fn().then(
      (data) => { if (!cancelled) setState({ data, loading: false, error: null }); },
      (err: Error) => { if (!cancelled) setState({ data: null, loading: false, error: err }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
