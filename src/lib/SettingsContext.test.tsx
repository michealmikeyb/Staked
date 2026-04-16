import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

beforeEach(() => { localStorage.clear(); });

function TestConsumer() {
  const { settings, updateSetting } = useSettings();
  return (
    <div>
      <span data-testid="non-upvote-swipe-action">{settings.nonUpvoteSwipeAction}</span>
      <span data-testid="swap-gestures">{String(settings.swapGestures)}</span>
      <span data-testid="blur-nsfw">{String(settings.blurNsfw)}</span>
      <span data-testid="default-sort">{settings.defaultSort}</span>
      <button onClick={() => updateSetting('nonUpvoteSwipeAction', 'dismiss')}>set-dismiss</button>
      <button onClick={() => updateSetting('swapGestures', true)}>set-swap</button>
      <button onClick={() => updateSetting('blurNsfw', false)}>set-no-blur</button>
      <button onClick={() => updateSetting('defaultSort', 'Hot')}>set-hot</button>
    </div>
  );
}

describe('SettingsContext', () => {
  it('provides default settings', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    expect(screen.getByTestId('non-upvote-swipe-action').textContent).toBe('downvote');
    expect(screen.getByTestId('swap-gestures').textContent).toBe('false');
    expect(screen.getByTestId('blur-nsfw').textContent).toBe('true');
    expect(screen.getByTestId('default-sort').textContent).toBe('TopTwelveHour');
  });

  it('updateSetting updates nonUpvoteSwipeAction in context', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-dismiss'));
    expect(screen.getByTestId('non-upvote-swipe-action').textContent).toBe('dismiss');
  });

  it('updateSetting updates swapGestures in context', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-swap'));
    expect(screen.getByTestId('swap-gestures').textContent).toBe('true');
  });

  it('updateSetting persists to localStorage', () => {
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    fireEvent.click(screen.getByText('set-hot'));
    const stored = JSON.parse(localStorage.getItem('stakswipe_settings')!);
    expect(stored.defaultSort).toBe('Hot');
  });

  it('initialises from localStorage on mount', () => {
    localStorage.setItem('stakswipe_settings', JSON.stringify({
      nonUpvoteSwipeAction: 'dismiss', swapGestures: true, blurNsfw: false, defaultSort: 'New',
    }));
    render(<SettingsProvider><TestConsumer /></SettingsProvider>);
    expect(screen.getByTestId('non-upvote-swipe-action').textContent).toBe('dismiss');
    expect(screen.getByTestId('swap-gestures').textContent).toBe('true');
    expect(screen.getByTestId('blur-nsfw').textContent).toBe('false');
    expect(screen.getByTestId('default-sort').textContent).toBe('New');
  });

  it('useSettings returns default context value when used outside a provider', () => {
    render(<TestConsumer />);
    expect(screen.getByTestId('non-upvote-swipe-action').textContent).toBe('downvote');
  });
});
