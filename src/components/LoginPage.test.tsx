import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';

vi.mock('../lib/lemmy', () => ({
  login: vi.fn().mockResolvedValue('mock-jwt'),
}));

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
  return render(
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
    const { login } = await import('../lib/lemmy');
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('Username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('lemmy.world', 'alice', 'secret');
      expect(mockOnLogin).toHaveBeenCalledWith({
        token: 'mock-jwt',
        instance: 'lemmy.world',
        username: 'alice',
      });
    });
  });

  it('displays an error message on login failure', async () => {
    const { login } = await import('../lib/lemmy');
    vi.mocked(login).mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLogin();
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
