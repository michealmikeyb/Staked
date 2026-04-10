import { describe, it, expect, vi } from 'vitest';
import { Semaphore } from '../lib/semaphore.js';

describe('Semaphore', () => {
  it('runs tasks up to concurrency limit simultaneously', async () => {
    const sem = new Semaphore(2);
    const order: string[] = [];

    const task = (id: string, delay: number) =>
      sem.run(async () => {
        order.push(`start:${id}`);
        await new Promise((r) => setTimeout(r, delay));
        order.push(`end:${id}`);
      });

    await Promise.all([task('a', 10), task('b', 10), task('c', 10)]);

    // a and b start before c (concurrency=2)
    expect(order[0]).toBe('start:a');
    expect(order[1]).toBe('start:b');
    // c starts only after a or b finishes
    expect(order.indexOf('start:c')).toBeGreaterThan(order.indexOf('end:a'));
  });

  it('resolves the return value of the task', async () => {
    const sem = new Semaphore(1);
    const result = await sem.run(async () => 42);
    expect(result).toBe(42);
  });

  it('propagates errors from tasks', async () => {
    const sem = new Semaphore(1);
    await expect(
      sem.run(async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');
  });

  it('releases slot after error so subsequent tasks can run', async () => {
    const sem = new Semaphore(1);
    await sem.run(async () => { throw new Error('oops'); }).catch(() => {});
    const result = await sem.run(async () => 'ok');
    expect(result).toBe('ok');
  });
});
