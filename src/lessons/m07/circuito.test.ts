import { describe, expect, it } from 'vitest';
import {
  BREAKERS,
  CAPACITY,
  capacityOf,
  designCurrent,
  MAX_DROP,
  protects,
  RHO_COPPER,
  sizeCircuit,
  voltageDrop,
} from './circuito';
import { RHO_COPPER as RHO_M01 } from '../m01/extensao';

describe('a tabela da calculadora (aula 7.4)', () => {
  it('uses the NBR 5410 capacities quoted in the lesson (copper, PVC, method B1, 30 °C)', () => {
    expect(CAPACITY.map((r) => [r.section, r.two, r.three])).toEqual([
      [1.5, 17.5, 15.5],
      [2.5, 24, 21],
      [4, 32, 28],
      [6, 41, 36],
      [10, 57, 50],
      [16, 76, 68],
    ]);
    expect(capacityOf(4, 2)).toBe(32);
    expect(() => capacityOf(3, 2)).toThrow();
  });

  it('uses the same copper as lesson 1.4 and the 4 % limit', () => {
    expect(RHO_COPPER).toBe(RHO_M01);
    expect(MAX_DROP).toBe(0.04);
    expect([...BREAKERS]).toEqual([10, 16, 20, 25, 32, 40, 50, 63]);
  });
});

describe('o chuveiro de 7.500 W (exemplo resolvido)', () => {
  it('at 220 V and 15 m: 34,1 A, 6 mm², 40 A breaker, 2,93 V (1,33 %)', () => {
    const r = sizeCircuit({ watts: 7500, volts: 220, meters: 15, kind: 'especifico', loaded: 2 });
    expect(r.current).toBeCloseTo(34.09, 2);
    expect(r.byCapacity).toBe(6);
    expect(r.minimum).toBe(2.5);
    expect(r.breaker).toBe(40);
    expect(r.section).toBe(6);
    expect(r.capacity).toBe(41);
    expect(r.drop.volts).toBeCloseTo(2.93, 2);
    expect(r.drop.fraction * 100).toBeCloseTo(1.33, 2);
    expect(r.grewForDrop).toBe(false);
    expect(r.outOfRange).toBe(false);
  });

  it('at 127 V: 59,1 A, 16 mm² and a 63 A breaker', () => {
    const r = sizeCircuit({ watts: 7500, volts: 127, meters: 15, kind: 'especifico', loaded: 2 });
    expect(r.current).toBeCloseTo(59.06, 2);
    expect(r.byCapacity).toBe(16);
    expect(r.breaker).toBe(63);
    expect(r.section).toBe(16);
    expect(r.drop.volts).toBeCloseTo(1.9, 2);
    expect(r.drop.fraction * 100).toBeCloseTo(1.5, 2);
  });

  it('the old 5.500 W shower: 25 A fits 4 mm², with a 25 A or a 32 A breaker', () => {
    const r = sizeCircuit({ watts: 5500, volts: 220, meters: 15, kind: 'especifico', loaded: 2 });
    expect(r.current).toBeCloseTo(25, 6);
    expect(r.section).toBe(4);
    expect(r.breaker).toBe(25);
    expect(protects(r.current, 32, 4, 2)).toMatchObject({ loadFits: true, wireProtected: true });
  });
});

describe('o chuveiro novo no fio velho (caso real)', () => {
  it('the 40 A breaker does not protect the 4 mm² wire, which carries 34 A over its 32 A', () => {
    const i = designCurrent(7500, 220, 2);
    const check = protects(i, 40, 4, 2);
    expect(check.capacity).toBe(32);
    expect(check.loadFits).toBe(true);
    expect(check.wireProtected).toBe(false);
    expect(check.wireOverloaded).toBe(true);
  });

  it('with 6 mm² the same 40 A breaker protects the wire', () => {
    const check = protects(designCurrent(7500, 220, 2), 40, 6, 2);
    expect(check.wireProtected).toBe(true);
    expect(check.wireOverloaded).toBe(false);
  });

  it('a 32 A breaker on 4 mm² protects the wire but is smaller than the load', () => {
    const check = protects(designCurrent(7500, 220, 2), 32, 4, 2);
    expect(check.wireProtected).toBe(true);
    expect(check.loadFits).toBe(false);
  });
});

describe('os exercícios da aula', () => {
  it('2.200 W at 127 V, 20 m of 2,5 mm²: 4,77 V (3,75 %)', () => {
    const i = designCurrent(2200, 127, 2);
    const d = voltageDrop(2.5, 20, i, 127, 2);
    expect(d.volts).toBeCloseTo(4.77, 2);
    expect(d.fraction * 100).toBeCloseTo(3.75, 2);
  });

  it('6.800 W at 220 V, 10 m: 30,9 A on 4 mm² with a 32 A breaker, about 1,2 %', () => {
    const r = sizeCircuit({ watts: 6800, volts: 220, meters: 10, kind: 'especifico', loaded: 2 });
    expect(r.current).toBeCloseTo(30.9, 1);
    expect(r.section).toBe(4);
    expect(r.breaker).toBe(32);
    expect(r.drop.fraction * 100).toBeCloseTo(1.2, 1);
    expect(protects(r.current, 40, 4, 2).wireProtected).toBe(false);
    expect(protects(r.current, 25, 6, 2).loadFits).toBe(false);
  });

  it('18 A on 2,5 mm²: only the 20 A breaker fits', () => {
    const ok = [16, 20, 25, 32].filter((b) => {
      const c = protects(18, b, 2.5, 2);
      return c.loadFits && c.wireProtected;
    });
    expect(ok).toEqual([20]);
  });

  it('the same wire heats a third as much at 220 V as at 127 V', () => {
    const ratio = (designCurrent(7500, 220, 2) / designCurrent(7500, 127, 2)) ** 2;
    expect(ratio).toBeCloseTo(1 / 3, 2);
  });
});

describe('outros circuitos', () => {
  it('lighting keeps the 1,5 mm² minimum and a 10 A breaker', () => {
    const r = sizeCircuit({ watts: 600, volts: 127, meters: 20, kind: 'iluminacao', loaded: 2 });
    expect(r.current).toBeCloseTo(4.72, 2);
    expect(r.section).toBe(1.5);
    expect(r.breaker).toBe(10);
    expect(r.drop.fraction * 100).toBeCloseTo(1.71, 2);
  });

  it('outlets never go below 2,5 mm², even for a small load', () => {
    const r = sizeCircuit({ watts: 300, volts: 127, meters: 10, kind: 'tomadas', loaded: 2 });
    expect(r.byCapacity).toBe(1.5);
    expect(r.minimum).toBe(2.5);
    expect(r.section).toBe(2.5);
    expect(r.breaker).toBe(10);
  });

  it('a long outlets circuit grows from 2,5 to 6 mm² because of the voltage drop', () => {
    const r = sizeCircuit({ watts: 2200, volts: 127, meters: 40, kind: 'tomadas', loaded: 2 });
    expect(r.current).toBeCloseTo(17.32, 2);
    expect(r.breaker).toBe(20);
    expect(r.byProtection).toBe(2.5);
    expect(r.dropBeforeGrowing!.fraction * 100).toBeCloseTo(7.5, 1);
    expect(voltageDrop(4, 40, r.current, 127, 2).fraction).toBeGreaterThan(MAX_DROP);
    expect(r.section).toBe(6);
    expect(r.drop.fraction * 100).toBeCloseTo(3.13, 2);
    expect(r.grewForDrop).toBe(true);
  });

  it('grows the section when no breaker fits the capacity of the first one', () => {
    // 22 A: 2,5 mm² holds 24 A, but the next breaker is 25 A: it needs 4 mm².
    const r = sizeCircuit({ watts: 22 * 220, volts: 220, meters: 5, kind: 'tomadas', loaded: 2 });
    expect(r.byCapacity).toBe(2.5);
    expect(r.breaker).toBe(25);
    expect(r.section).toBe(4);
  });

  it('a three-phase circuit uses √3 and the 3-conductor column', () => {
    const r = sizeCircuit({ watts: 10_000, volts: 220, meters: 20, kind: 'especifico', loaded: 3 });
    expect(r.current).toBeCloseTo(10_000 / (Math.sqrt(3) * 220), 6);
    expect(r.current).toBeCloseTo(26.24, 2);
    expect(r.byCapacity).toBe(4);
    expect(r.breaker).toBe(32);
    expect(r.section).toBe(6);
    expect(r.capacity).toBe(36);
    const v = (Math.sqrt(3) * RHO_COPPER * 20 * r.current) / 6e-6;
    expect(r.drop.volts).toBeCloseTo(v, 9);
  });

  it('says when the circuit is beyond the table', () => {
    const r = sizeCircuit({ watts: 20_000, volts: 127, meters: 10, kind: 'especifico', loaded: 2 });
    expect(r.outOfRange).toBe(true);
    expect(r.section).toBeNull();
    expect(r.breaker).toBeNull();
  });

  it('says when not even 16 mm² keeps the drop within 4 %', () => {
    const r = sizeCircuit({ watts: 7500, volts: 127, meters: 200, kind: 'especifico', loaded: 2 });
    expect(r.outOfRange).toBe(true);
    expect(r.breaker).toBe(63);
    expect(r.drop.fraction).toBeGreaterThan(MAX_DROP);
  });
});
