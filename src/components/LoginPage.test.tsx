import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { renderWithBackend } from '../test-utils';
import LoginPage from './LoginPage';

vi.mock('../lib/store', () => ({
  saveAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockOnLogin = vi.fn();

beforeEach(() => { vi.clearAllMocks(); });

function renderLogin() {
  return renderWithBackend(
    <MemoryRouter>
      <LoginPage onLogin={mockOnLogin} />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('renders the Stakswipe title', () => {
    renderLogin();
    expect(screen.getByRole('img', { name: /stakswipe/i })).toBeInTheDocument();
  });

  it('shows the instance dropdown with popular instances', () => {
    renderLogin();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'lemmy.world' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'beehaw.org' })).toBeInTheDocument();
  });

  it('reveals custom input when "custom" option is selected', async () => {
    renderLogin();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'custom');
    expect(screen.getByPlaceholderText('your.instance.com')).toBeInTheDocument();
  });

  it('calls onLogin with instance and username after successful login', async () => {
    const { backend } = renderLogin();
    vi.spyOn(backend.auth, 'login').mockResolvedValue({
      id: 'mock-session', backendId: 'mock',
      viewer: { id: '1', handle: 'alice@lemmy.world', profileUrl: '' },
      data: { token: 'mock-jwt' },
    });

    await userEvent.type(screen.getByPlaceholderText('Username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(backend.auth.login).toHaveBeenCalledWith({
        instance: 'lemmy.world',
        usernameOrEmail: 'alice',
        password: 'secret',
      });
      expect(mockOnLogin).toHaveBeenCalledWith({
        token: 'mock-jwt',
        instance: 'lemmy.world',
        username: 'alice',
      });
    });
  });

  it('displays an error message on login failure', async () => {
    const { backend } = renderLogin();
    vi.spyOn(backend.auth, 'login').mockRejectedValueOnce(new Error('Invalid credentials'));

    await userEvent.type(screen.getByPlaceholderText('Username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('renders "Continue without account" button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /continue without account/i })).toBeInTheDocument();
  });

  it('navigates to / when "Continue without account" is clicked', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /continue without account/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
