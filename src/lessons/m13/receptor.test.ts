import { describe, expect, it } from 'vitest';
import { Simulator } from '../../engine/analysis/simulator';
import type { SimEvent } from '../../engine/contract';
import circuit from './receptor-rele.circuit';

/** Drives the receiver board like the student does, step by step. */
function bench() {
  const sim = new Simulator(circuit);
  sim.refresh();
  const events: SimEvent[] = [];
  const run = (seconds: number) => {
    const end = sim.t + seconds;
    while (sim.t < end - sim.dt * 1e-6) {
      sim.step();
      events.push(...sim.frame({ samples: false }).events);
    }
    return sim.frame().readouts;
  };
  const tap = (el: string, param: string, hold = 0.1) => {
    sim.setParam(el, param, true);
    run(hold);
    sim.setParam(el, param, false);
    return run(0.3);
  };
  const messages = () => events.map((e) => e.message);
  return { sim, run, tap, messages };
}

describe('lesson 13.3: receiver board with a relay', () => {
  it('ignores a remote it does not know, learns it and then toggles the lamp', () => {
    const b = bench();
    b.run(0.2);
    let r = b.tap('RX', 'press');
    expect(r['U1.rele']).toBe(false);
    expect(b.messages().some((m) => m.includes('não cadastrado'))).toBe(true);

    r = b.tap('SW1', 'pressed');
    expect(r['U1.cadastro']).toBe(true);
    r = b.tap('RX', 'press');
    expect(r['U1.memoria']).toBe(1);
    expect(r['U1.cadastro']).toBe(false);

    r = b.tap('RX', 'press');
    expect(r['U1.rele']).toBe(true);
    expect(r['K1.closed']).toBe(true);
    expect(r['L1.brightness'] as number).toBeGreaterThan(0.9);

    r = b.tap('RX', 'press');
    expect(r['U1.rele']).toBe(false);
    expect(r['K1.closed']).toBe(false);
  });

  it('refuses a copied rolling code but obeys a copied fixed code', () => {
    const rolling = bench();
    rolling.tap('SW1', 'pressed');
    rolling.tap('RX', 'press');
    rolling.tap('RX', 'press');
    let r = rolling.tap('RX', 'replay');
    expect(r['U1.rele']).toBe(true);
    expect(r['U1.recusados']).toBe(1);
    expect(rolling.messages().some((m) => m.includes('Código repetido recusado'))).toBe(true);

    const fixed = bench();
    fixed.sim.setParam('RX', 'rolling', false);
    fixed.tap('SW1', 'pressed');
    fixed.tap('RX', 'press');
    fixed.tap('RX', 'press');
    r = fixed.tap('RX', 'replay');
    // The copy is accepted: the relay toggles back off.
    expect(r['U1.rele']).toBe(false);
    expect(r['U1.recusados']).toBe(0);
  });

  it('erases every remote when APRENDER is held 5 s, and waits only 10 s to learn', () => {
    const b = bench();
    b.tap('SW1', 'pressed');
    b.tap('RX', 'press');
    b.tap('SW1', 'pressed');
    b.sim.setParam('RX', 'remote', '9E04B7');
    let r = b.tap('RX', 'press');
    expect(r['U1.memoria']).toBe(2);

    r = b.tap('SW1', 'pressed', 5.2);
    expect(r['U1.memoria']).toBe(0);
    expect(r['U1.cadastro']).toBe(false);

    b.tap('SW1', 'pressed');
    r = b.run(10.5);
    expect(r['U1.cadastro']).toBe(false);
    expect(b.messages().some((m) => m.includes('Tempo de cadastro esgotado'))).toBe(true);
  });
});
