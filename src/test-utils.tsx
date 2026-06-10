// src/test-utils.tsx
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BackendProvider } from './lib/api/context';
import { createMockBackend, type MockBackend } from './lib/api/backends/mock';
import type { MockFixtures } from './lib/api/backends/mock/fixtures';
import type { Capabilities } from './lib/api/capabilities';

export interface RenderWithBackendOptions {
  fixtures?: MockFixtures;
  capabilities?: Partial<Capabilities>;
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
}

export function renderWithBackend(ui: ReactElement, opts: RenderWithBackendOptions = {}) {
  const backend: MockBackend = createMockBackend(opts.fixtures, opts.capabilities);
  const result = render(ui, {
    ...opts.renderOptions,
    wrapper: ({ children }) => <BackendProvider value={backend}>{children}</BackendProvider>,
  });
  return { ...result, backend };
}

export * from './lib/api/backends/mock/fixtures';
