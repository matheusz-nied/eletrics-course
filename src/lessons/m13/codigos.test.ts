import { describe, expect, it } from 'vitest';
import {
  emptyReceiver,
  fieldsOf,
  frameDuration,
  makeFrame,
  receive,
  segmentsOf,
  WINDOW,
  type Receiver,
} from './codigos';

const learn = (rx: Receiver): Receiver => ({ ...rx, learning: true });

describe('frames', () => {
  it('sends 24 bits in about 45 ms with fixed code', () => {
    const f = makeFrame('fixo', 'a', 1);
    expect(fieldsOf(f).reduce((n, x) => n + x.bits.length, 0)).toBe(24);
    expect(segmentsOf(f).reduce((n, s) => n + s.units, 0)).toBe(128);
    expect(frameDuration(f) * 1000).toBeCloseTo(44.8, 6);
    // Every press of a fixed-code remote is the same frame.
    expect(makeFrame('fixo', 'a', 1)).toEqual(f);
  });

  it('sends 66 bits in about 92 ms with rolling code, and the encrypted part changes', () => {
    const f1 = makeFrame('rolling', 'a', 1, 101);
    const f2 = makeFrame('rolling', 'a', 1, 102);
    expect(fieldsOf(f1).reduce((n, x) => n + x.bits.length, 0)).toBe(66);
    expect(frameDuration(f1) * 1000).toBeCloseTo(92.4, 6);
    expect(f1.serial).toBe(f2.serial);
    expect(f1.hop).not.toBe(f2.hop);
    // About half of the 32 encrypted bits flip from one press to the next.
    const flipped = ((f1.hop! ^ f2.hop!) >>> 0).toString(2).replace(/0/g, '').length;
    expect(flipped).toBeGreaterThan(8);
  });
});

describe('receiver', () => {
  it('learns a fixed-code remote and then accepts a copy forever', () => {
    let rx = emptyReceiver();
    const f = makeFrame('fixo', 'a', 1);
    expect(receive(rx, f, 'fixo').verdict).toBe('desconhecido');
    rx = receive(learn(rx), f, 'fixo').rx;
    expect(rx.memory).toHaveLength(1);
    expect(receive(rx, f, 'fixo').verdict).toBe('aceito');
    expect(receive(rx, { ...f }, 'fixo').verdict).toBe('aceito');
    expect(receive(rx, makeFrame('fixo', 'a', 2), 'fixo').verdict).toBe('desconhecido');
    expect(receive(rx, makeFrame('fixo', 'b', 1), 'fixo').verdict).toBe('desconhecido');
  });

  it('refuses a replayed rolling code and accepts the next press', () => {
    let rx = receive(learn(emptyReceiver()), makeFrame('rolling', 'a', 1, 101), 'rolling').rx;
    const f = makeFrame('rolling', 'a', 1, 102);
    const out = receive(rx, f, 'rolling');
    expect(out.verdict).toBe('aceito');
    rx = out.rx;
    expect(receive(rx, f, 'rolling').verdict).toBe('repetido');
    expect(receive(rx, makeFrame('rolling', 'a', 1, 103), 'rolling').verdict).toBe('aceito');
  });

  it('accepts a jump inside the window and refuses one beyond it', () => {
    const rx = receive(learn(emptyReceiver()), makeFrame('rolling', 'a', 1, 100), 'rolling').rx;
    expect(receive(rx, makeFrame('rolling', 'a', 1, 100 + WINDOW), 'rolling').verdict).toBe(
      'aceito',
    );
    expect(receive(rx, makeFrame('rolling', 'a', 1, 101 + WINDOW), 'rolling').verdict).toBe(
      'fora-da-janela',
    );
  });

  it('does not understand the other code family', () => {
    expect(receive(learn(emptyReceiver()), makeFrame('rolling', 'a', 1, 1), 'fixo').verdict).toBe(
      'formato',
    );
  });
});
