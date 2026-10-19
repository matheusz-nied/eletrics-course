import { describe, expect, it } from 'vitest';
import {
  directionWords,
  fieldAt,
  fieldLines,
  insideMagnet,
  MAGNET_LENGTH,
  PRESETS,
  strength,
} from './campo-magnetico';

const one = PRESETS.um.magnets;
const north = one[0]!.x + MAGNET_LENGTH / 2;
const south = one[0]!.x - MAGNET_LENGTH / 2;

describe('campo de ímãs em barra', () => {
  it('is 1 right next to the north face of a lone magnet', () => {
    expect(strength(fieldAt(one, { x: north + 1, y: 30 }))).toBeCloseTo(1, 6);
  });

  it('leaves the north pole and enters the south pole', () => {
    expect(fieldAt(one, { x: north + 5, y: 30 }).x).toBeGreaterThan(0);
    expect(fieldAt(one, { x: south - 5, y: 30 }).x).toBeGreaterThan(0);
    // Beside the middle of the magnet it runs back, from the north end to the south end.
    expect(fieldAt(one, { x: 50, y: 15 }).x).toBeLessThan(0);
    expect(directionWords(fieldAt(one, { x: north + 5, y: 30 }))).toBe('para a direita');
    expect(directionWords(fieldAt(one, { x: 50, y: 15 }))).toBe('para a esquerda');
  });

  it('is strongest at the poles and weakens with distance', () => {
    const atPole = strength(fieldAt(one, { x: north + 2, y: 30 }));
    const beside = strength(fieldAt(one, { x: 50, y: 30 - 5.5 }));
    expect(atPole).toBeGreaterThan(3 * beside);
    let last = Infinity;
    for (const d of [1, 2, 4, 8, 16]) {
      const b = strength(fieldAt(one, { x: north + d, y: 30 }));
      expect(b).toBeLessThan(last);
      last = b;
    }
    // Far away it falls like a dipole: doubling the distance divides it by about 8.
    const b16 = strength(fieldAt(one, { x: 50 + 160, y: 30 }));
    const b32 = strength(fieldAt(one, { x: 50 + 320, y: 30 }));
    expect(b16 / b32).toBeGreaterThan(7);
    expect(b16 / b32).toBeLessThan(9);
  });

  it('cancels halfway between two north poles', () => {
    const rep = PRESETS.repelem.magnets;
    expect(strength(fieldAt(rep, { x: 50, y: 30 }))).toBeLessThan(1e-9);
    // Off the axis it is not zero.
    expect(strength(fieldAt(rep, { x: 50, y: 20 }))).toBeGreaterThan(0.005);
  });

  it('runs across the gap from north to south between opposite poles', () => {
    const att = PRESETS.atraem.magnets;
    const b = fieldAt(att, { x: 50, y: 30 });
    expect(b.x).toBeGreaterThan(0);
    expect(Math.abs(b.y)).toBeLessThan(1e-9);
    // Two magnets facing each other make the gap stronger than one alone at the same spot.
    const lone = fieldAt([att[0]!], { x: 50, y: 30 });
    expect(strength(b)).toBeGreaterThan(1.8 * strength(lone));
  });

  it('draws lines from a north face to a south face', () => {
    const lines = fieldLines(one);
    expect(lines.length).toBeGreaterThan(10);
    let closed = 0;
    for (const line of lines) {
      const start = line[0]!;
      const end = line[line.length - 1]!;
      const fromNorth = insideMagnet(one, start, 1.5) && start.x > north - 1;
      const toSouth = insideMagnet(one, end, 1.5) && end.x < south + 2;
      // Every line touches the magnet at one end at least, and only at the right pole.
      expect(fromNorth || toSouth).toBe(true);
      if (fromNorth && toSouth) closed += 1;
    }
    // Some close around the magnet; the others leave the drawing and come back in.
    expect(closed).toBeGreaterThanOrEqual(4);
  });

  it('names eight directions', () => {
    expect(directionWords({ x: 0, y: -1 })).toBe('para cima');
    expect(directionWords({ x: -1, y: 1 })).toBe('para a esquerda e para baixo');
  });
});
