import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DynamicLoginPage from './DynamicLoginPage';
import { AccountsProvider } from '../lib/AccountsContext';
import { clearRegistry, registerBackend } from '../lib/api/registry';
import { createMockBackend } from '../lib/api/backends/mock';
import type { Session } from '../lib/api/types';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
  useParams: () => ({ backendId: 'lemmy' }),
}));

const loginFields = [
  { key: 'instance', label: 'Instance', type: 'instance' as const, required: true, suggestions: ['lemmy.world'] },
  { key: 'usernameOrEmail', label: 'Username or email', type: 'text' as const, required: true },
  { key: 'password', label: 'Password', type: 'password' as const, required: true },
];

const loggedInSession: Session = {
  id: 'lemmy:alice@lemmy.world', backendId: 'lemmy',
  viewer: { id: 'alice', handle: 'alice@lemmy.world', profileUrl: 'https://lemmy.world/u/alice' },
  data: { instance: 'lemmy.world', token: 'tok' },
};

let loginImpl: (creds: Record<string, string>) => Promise<Session>;

beforeEach(() => {
  localStorage.clear();
  navigate.mockReset();
  clearRegistry();
  loginImpl = vi.fn().mockResolvedValue(loggedInSession);
  registerBackend('lemmy', () => {
    const b = createMockBackend(undefined, { displayName: 'Lemmy', loginFields });
    return { ...b, auth: { ...b.auth, login: (creds: Record<string, string>) => loginImpl(creds) } };
  });
});

function renderPage() {
  return render(
    <MemoryRouter><AccountsProvider><DynamicLoginPage /></AccountsProvider></MemoryRouter>,
  );
}

describe('DynamicLoginPage', () => {
  it('renders a field per loginField', () => {
    renderPage();
    expect(screen.getByLabelText('Instance')).toBeInTheDocument();
    expect(screen.getByLabelText('Username or email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('submits collected credentials and stores the account', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Instance'), { target: { value: 'lemmy.world' } });
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(loginImpl).toHaveBeenCalledWith({ instance: 'lemmy.world', usernameOrEmail: 'alice', password: 'pw' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(JSON.parse(localStorage.getItem('stakswipe_accounts')!)[0].session.id).toBe('lemmy:alice@lemmy.world');
  });

  it('shows an error message when login fails', async () => {
    loginImpl = vi.fn().mockRejectedValue(new Error('Bad password'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Instance'), { target: { value: 'lemmy.world' } });
    fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText('Bad password')).toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalledWith('/');
  });
});
