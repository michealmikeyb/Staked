import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountsProvider, useAccounts } from './AccountsContext';
import { useBackend } from './api/context';
import { clearRegistry, registerBackend } from './api/registry';
import { createMockBackend } from './api/backends/mock';
import type { Session } from './api/types';
import { saveAccounts } from './accounts';

function mockSession(id: string, handle: string): Session {
  return { id, backendId: 'mock', viewer: { id: handle, handle, profileUrl: `https://x/u/${handle}` }, data: {} };
}

beforeEach(() => {
  localStorage.clear();
  clearRegistry();
  // every session resolves to a mock backend whose listStaks() returns all/local/subscribed
  registerBackend('mock', (s) => {
    const b = createMockBackend();
    return { ...b, session: s, listStaks: () => b.listStaks().map((st) => ({ ...st, sessionId: s.id })) };
  });
});

function Probe() {
  const { accounts, active, allStaks, setActive, addAccount, removeAccount } = useAccounts();
  const backend = useBackend();
  return (
    <div>
      <div data-testid="count">{accounts.length}</div>
      <div data-testid="active">{active ? `${active.sessionId}:${active.stakId}` : 'anon'}</div>
      <div data-testid="staks">{allStaks.map((s) => `${s.sessionId ?? 'anon'}:${s.stakId}`).join(',')}</div>
      <div data-testid="viewer">{backend.session?.viewer?.handle ?? 'none'}</div>
      <button onClick={() => addAccount(mockSession('mock:a@x', 'a@x'))}>add</button>
      <button onClick={() => setActive(null)}>anon</button>
      <button onClick={() => removeAccount('mock:a@x')}>remove</button>
    </div>
  );
}

function renderProbe() {
  return render(<AccountsProvider><Probe /></AccountsProvider>);
}

describe('AccountsContext', () => {
  it('starts anonymous with no accounts', () => {
    renderProbe();
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('active').textContent).toBe('anon');
    expect(screen.getByTestId('viewer').textContent).toBe('none');
    expect(screen.getByTestId('staks').textContent).toContain('anon:anonymous');
  });

  it('adds an account, makes it active, and aggregates its staks', () => {
    renderProbe();
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('active').textContent).toBe('mock:a@x:all');
    expect(screen.getByTestId('viewer').textContent).toBe('a@x');
    const staks = screen.getByTestId('staks').textContent!;
    expect(staks).toContain('mock:a@x:all');
    expect(staks).toContain('mock:a@x:subscribed');
    expect(staks).toContain('anon:anonymous');
  });

  it('falls back to anonymous when the active account is removed', () => {
    renderProbe();
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('active').textContent).toBe('anon');
  });

  it('hydrates persisted accounts on mount', () => {
    saveAccounts([{ session: mockSession('mock:b@x', 'b@x'), addedAt: 1 }]);
    renderProbe();
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
