import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { readNotifState, writeNotifState, clearNotifState } from './notifStore';

beforeEach(() => {
  (global as unknown as { indexedDB: unknown }).indexedDB = new IDBFactory();
});

describe('notifStore', () => {
  it('returns null when nothing has been written', async () => {
    expect(await readNotifState()).toBeNull();
  });

  it('round-trips a written state', async () => {
    await writeNotifState({ instance: 'lemmy.world', token: 'tok', lastCount: 3 });
    expect(await readNotifState()).toEqual({ instance: 'lemmy.world', token: 'tok', lastCount: 3 });
  });

  it('overwrites previous state', async () => {
    await writeNotifState({ instance: 'lemmy.world', token: 'tok', lastCount: 3 });
    await writeNotifState({ instance: 'lemmy.world', token: 'tok', lastCount: 7 });
    const state = await readNotifState();
    expect(state?.lastCount).toBe(7);
  });

  it('clearNotifState removes the record', async () => {
    await writeNotifState({ instance: 'lemmy.world', token: 'tok', lastCount: 3 });
    await clearNotifState();
    expect(await readNotifState()).toBeNull();
  });
});
