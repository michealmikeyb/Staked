import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountsPage from './AccountsPage';
import { AccountsProvider } from '../lib/AccountsContext';
import { clearRegistry, registerBackend } from '../lib/api/registry';
import { createMockBackend } from '../lib/api/backends/mock';
import { saveAccounts, saveActive } from '../lib/accounts';
import type { Session } from '../lib/api/types';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

function session(id: string, handle: string): Session {
  return { id, backendId: 'lemmy', viewer: { id: handle, handle, profileUrl: `https://x/u/${handle}` }, data: { instance: 'x', token: 't' } };
}

beforeEach(() => {
  localStorage.clear();
  navigate.mockReset();
  clearRegistry();
  registerBackend('lemmy', (s) => ({ ...createMockBackend(), session: s }));
  saveAccounts([
    { session: session('lemmy:a@x', 'a@x'), addedAt: 1 },
    { session: session('lemmy:b@x', 'b@x'), addedAt: 2 },
  ]);
  saveActive({ sessionId: 'lemmy:a@x', stakId: 'all' });
});

function renderPage() {
  return render(<MemoryRouter><AccountsProvider><AccountsPage /></AccountsProvider></MemoryRouter>);
}

describe('AccountsPage', () => {
  it('lists all accounts with an active indicator', () => {
    renderPage();
    expect(screen.getByText('a@x')).toBeInTheDocument();
    expect(screen.getByText('b@x')).toBeInTheDocument();
    expect(screen.getByTestId('active-lemmy:a@x')).toBeInTheDocument();
  });

  it('removes an account', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /remove b@x/i }));
    expect(screen.queryByText('b@x')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('stakswipe_accounts')!).map((a: { session: Session }) => a.session.id)).toEqual(['lemmy:a@x']);
  });

  it('moves an account down', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /move a@x down/i }));
    expect(JSON.parse(localStorage.getItem('stakswipe_accounts')!).map((a: { session: Session }) => a.session.id)).toEqual(['lemmy:b@x', 'lemmy:a@x']);
  });

  it('navigates to add-account flow', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));
    expect(navigate).toHaveBeenCalledWith('/accounts/add');
  });
});
