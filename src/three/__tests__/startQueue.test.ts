import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TURN_MS, resetStartQueue, takeTurn } from '../core/startQueue';

describe('canvas start queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    resetStartQueue();
    vi.useRealTimers();
  });

  it('grants the first view at once and the next one when it is done', () => {
    const order: string[] = [];
    const endA = takeTurn(() => order.push('a'));
    takeTurn(() => order.push('b'));
    expect(order).toEqual(['a']);
    endA();
    expect(order).toEqual(['a', 'b']);
  });

  it('moves on when a view takes too long', () => {
    const order: string[] = [];
    takeTurn(() => order.push('a'));
    takeTurn(() => order.push('b'));
    vi.advanceTimersByTime(MAX_TURN_MS - 1);
    expect(order).toEqual(['a']);
    vi.advanceTimersByTime(1);
    expect(order).toEqual(['a', 'b']);
  });

  it('skips a view that left before its turn', () => {
    const order: string[] = [];
    const endA = takeTurn(() => order.push('a'));
    const leaveB = takeTurn(() => order.push('b'));
    takeTurn(() => order.push('c'));
    leaveB();
    endA();
    expect(order).toEqual(['a', 'c']);
  });

  it('ignores a second end call', () => {
    const order: string[] = [];
    const endA = takeTurn(() => order.push('a'));
    takeTurn(() => order.push('b'));
    takeTurn(() => order.push('c'));
    endA();
    endA();
    expect(order).toEqual(['a', 'b']);
  });
});
