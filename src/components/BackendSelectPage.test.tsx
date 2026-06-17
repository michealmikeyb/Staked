import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackendSelectPage from './BackendSelectPage';
import { clearRegistry, registerBackend } from '../lib/api/registry';
import { createMockBackend } from '../lib/api/backends/mock';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

beforeEach(() => {
  navigate.mockReset();
  clearRegistry();
  registerBackend('lemmy', () => createMockBackend(undefined, { displayName: 'Lemmy', icon: '🐭' }));
});

describe('BackendSelectPage', () => {
  it('lists registered backends by display name', () => {
    render(<MemoryRouter><BackendSelectPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /lemmy/i })).toBeInTheDocument();
  });

  it('navigates to the dynamic login route for the chosen backend', () => {
    render(<MemoryRouter><BackendSelectPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /lemmy/i }));
    expect(navigate).toHaveBeenCalledWith('/accounts/add/lemmy');
  });
});
