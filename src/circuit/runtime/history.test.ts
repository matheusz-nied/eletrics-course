import { describe, expect, it } from 'vitest';
import { History } from './history';

describe('History', () => {
  it('keeps the last samples in a ring and finds times', () => {
    const h = new History(8);
    h.track('v');
    for (let i = 0; i < 12; i++) h.push(i, () => i * 10);
    expect(h.length).toBe(8);
    expect(h.firstT()).toBe(4);
    expect(h.lastT()).toBe(11);
    expect(h.lowerBound(6.5)).toBe(3);
    expect(h.valueAt('v', 0)).toBe(40);
  });

  it('starts over when time goes back (reset)', () => {
    const h = new History(8);
    h.track('v');
    h.push(1, () => 1);
    h.push(2, () => 2);
    h.push(0, () => 0);
    expect(h.length).toBe(1);
  });

  it('decimates with min/max so peaks survive', () => {
    const h = new History(4096);
    h.track('v');
    for (let i = 0; i < 4000; i++) h.push(i, () => (i === 1234 ? 100 : 0));
    const { t, values } = h.window(0, 4000, ['v'], 200);
    expect(t.length).toBeLessThanOrEqual(200);
    expect(Math.max(...values[0]!)).toBe(100);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThanOrEqual(t[i - 1]!);
  });
});
