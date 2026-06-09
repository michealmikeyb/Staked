// src/lib/api/context.tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { Backend } from './backend';

const BackendContext = createContext<Backend | null>(null);

export function BackendProvider({ value, children }: { value: Backend; children: ReactNode }) {
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  const backend = useContext(BackendContext);
  if (!backend) throw new Error('useBackend must be used within a BackendProvider');
  return backend;
}
