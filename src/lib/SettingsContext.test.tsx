import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

beforeEach(() => { localStorage.clear(); });

function TestConsumer() {
  const { settings, updateSetting } = useSettings();
  return (
    <div>
      <span data-testid="left-swipe">{settings.leftSwipe}</span>
      <span data-testid="blur-nsfw">{String(settings.blurNsfw)}</span>
      <span data-testid="default-sort">{settings.defaultSort}</span>
      <button onClick={() => updateSetting('leftSwipe', 'dismiss')}>set-dismiss</button>
      <button onClick={() => updateSetting('blurNsfw', false)}>set-no-blur</button>
      <button onClick={() => updateSetting('defaultSort', 'Hot')}>set-hot</button>
    </div>
  );
}

describe('SettingsContext', () => {
  it('provides default settings', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    expect(screen.getByTestId('left-swipe').textContent).toBe('downvote');
    expect(screen.getByTestId('blur-nsfw').textContent).toBe('true');
    expect(screen.getByTestId('default-sort').textContent).toBe('TopTwelveHour');
  });

  it('updateSetting updates the value in context', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-dismiss'));
    expect(screen.getByTestId('left-swipe').textContent).toBe('dismiss');
  });

  it('updateSetting persists to localStorage', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-hot'));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.defaultSort).toBe('Hot');
  });

  it('initialises from localStorage on mount', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      leftSwipe: 'dismiss', blurNsfw: false, defaultSort: 'New',
    }));
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    expect(screen.getByTestId('left-swipe').textContent).toBe('dismiss');
    expect(screen.getByTestId('blur-nsfw').textContent).toBe('false');
    expect(screen.getByTestId('default-sort').textContent).toBe('New');
  });

  it('useSettings returns default context value when used outside a provider', () => {
    render(<TestConsumer />);
    expect(screen.getByTestId('left-swipe').textContent).toBe('downvote');
  });
});
