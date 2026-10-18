import { describe, expect, it } from 'vitest';
import {
  HOLES,
  SCENARIOS,
  connected,
  hole,
  holeName,
  move,
  netOf,
  partsOnNet,
  sameNet,
} from './board';

describe('breadboard strips', () => {
  it('has 300 terminal holes and four rails of 20', () => {
    expect(HOLES).toHaveLength(300 + 80);
  });

  it('connects a column of five, not across the channel', () => {
    expect(connected('c12', false).sort()).toEqual(['a12', 'b12', 'c12', 'd12', 'e12']);
    expect(sameNet('e12', 'f12', false)).toBe(false);
    expect(sameNet('a12', 'a13', false)).toBe(false);
  });

  it('runs the rails end to end unless they are split', () => {
    expect(sameNet('T+3', 'T+28', false)).toBe(true);
    expect(sameNet('T+3', 'T+28', true)).toBe(false);
    expect(sameNet('T+3', 'T+13', true)).toBe(true);
    expect(sameNet('T+3', 'T-3', false)).toBe(false);
    expect(connected('B-20', false)).toHaveLength(20);
  });

  it('names holes in pt-BR', () => {
    expect(holeName('c12')).toBe('furo C12');
    expect(holeName('T+3')).toBe('trilho + de cima, coluna 3');
  });

  it('moves with the arrow keys and snaps to rail holes', () => {
    expect(move('a1', 0, -1)).toBe('a1');
    expect(move('a8', -1, 0)).toBe('T+7');
    expect(move('a1', -1, 0)).toBe('T+3');
    expect(move('T+13', 0, 1)).toBe('T+18');
    expect(move('e5', 1, 0)).toBe('f5');
    expect(hole(move('j30', 1, 0)).row).toBe('B+');
  });
});

describe('find-the-error layouts', () => {
  const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
  const part = (s: string, p: string) => byId[s]!.parts.find((x) => x.id === p)!;

  it('every layout uses existing holes and has one right answer', () => {
    for (const s of SCENARIOS) {
      for (const p of s.parts) for (const leg of p.legs) expect(() => hole(leg)).not.toThrow();
      expect(s.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('a resistor with both legs in one column is bypassed', () => {
    const r = part('resistor-mesma-coluna', 'R1');
    expect(sameNet(r.legs[0]!, r.legs[1]!, false)).toBe(true);
    // the LED anode is on the supply strip
    const d = part('resistor-mesma-coluna', 'D1');
    expect(sameNet(d.legs[0]!, 'a8', false)).toBe(true);
  });

  it('a split rail leaves the right half without the supply', () => {
    const s = byId['trilho-dividido']!;
    expect(sameNet('T+3', part(s.id, 'J1').legs[0]!, s.split)).toBe(false);
    expect(sameNet('T+3', part(s.id, 'J1').legs[0]!, false)).toBe(true);
  });

  it('a jumper one column off misses the resistor', () => {
    const s = byId['jumper-coluna-errada']!;
    expect(sameNet(part(s.id, 'J1').legs[1]!, part(s.id, 'R1').legs[0]!, false)).toBe(false);
  });

  it('lists the legs on a strip', () => {
    const s = byId['resistor-mesma-coluna']!;
    expect(partsOnNet(s.parts, netOf('c8', false), false)).toEqual([
      'ponta do jumper vermelho J1',
      'perna do resistor de 330 Ω',
      'perna do resistor de 330 Ω',
      'ânodo do LED (perna longa)',
    ]);
  });
});
