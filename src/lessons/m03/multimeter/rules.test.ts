import { describe, expect, it } from 'vitest';
import { displayValue, read, TARGETS, FUNCTIONS, type MeterState } from './rules';

const base: MeterState = {
  fn: 'vdc',
  red: 'vohm',
  target: 'pilha',
  blown: { ma: false, '10a': false },
};

describe('multimeter display', () => {
  it('shows four digits with the right prefix', () => {
    expect(displayValue(1.58, 'V')).toEqual({ digits: ' 1.580', unit: 'V' });
    expect(displayValue(127, 'V')).toEqual({ digits: ' 127.0', unit: 'V' });
    expect(displayValue(4700, 'Ω')).toEqual({ digits: ' 4.700', unit: 'kΩ' });
    expect(displayValue(0.02, 'A')).toEqual({ digits: ' 20.00', unit: 'mA' });
    expect(displayValue(0.417, 'A', true)).toEqual({ digits: ' 0.417', unit: 'A' });
  });
});

describe('multimeter rules', () => {
  it('measures a battery in V⎓ with the red lead in VΩ', () => {
    const r = read(base);
    expect(r.status).toBe('ok');
    expect(r.digits).toBe(' 1.580');
  });

  it('reads the outlet only in V~', () => {
    expect(read({ ...base, target: 'tomada', fn: 'vac' }).digits).toBe(' 127.0');
    expect(read({ ...base, target: 'tomada', fn: 'vdc' }).status).toBe('warn');
  });

  it('blows the mA fuse when the red lead in mA touches a battery, even in V⎓', () => {
    const r = read({ ...base, red: 'ma', target: 'bateria9' });
    expect(r.status).toBe('danger');
    expect(r.blows).toBe('ma');
  });

  it('blows the 10 A fuse on the outlet', () => {
    expect(read({ ...base, red: '10a', target: 'tomada', fn: 'a' }).blows).toBe('10a');
  });

  it('reads nothing through a blown fuse', () => {
    const r = read({
      ...base,
      fn: 'ma',
      red: 'ma',
      target: 'serie-led',
      blown: { ma: true, '10a': false },
    });
    expect(r.digits).toBe(' 0.000');
    expect(r.loadOn).toBeFalsy();
  });

  it('measures current in series on the right jack', () => {
    expect(read({ ...base, fn: 'ma', red: 'ma', target: 'serie-led' }).digits).toBe(' 20.00');
    const lamp = read({ ...base, fn: 'a', red: '10a', target: 'serie-lampada' });
    expect(lamp.digits).toBe(' 0.417');
    expect(lamp.loadOn).toBe(true);
  });

  it('shows OL above the mA jack limit', () => {
    expect(read({ ...base, fn: 'ma', red: 'ma', target: 'serie-lampada' }).digits).toBe(' OL');
  });

  it('beeps on a whole wire, not on a 4,7 kΩ resistor', () => {
    expect(read({ ...base, fn: 'cont', target: 'fio' }).beep).toBe(true);
    expect(read({ ...base, fn: 'cont', target: 'resistor' }).beep).toBe(false);
    expect(read({ ...base, fn: 'ohm', target: 'resistor' }).digits).toBe(' 4.700');
  });

  it('a voltmeter in series reads the source and leaves the load off', () => {
    const r = read({ ...base, target: 'serie-lampada' });
    expect(r.digits).toBe(' 12.00');
    expect(r.loadOn).toBeFalsy();
  });

  it('reads phase–ground like phase–neutral and almost nothing between neutral and ground', () => {
    expect(read({ ...base, target: 'tomada-ft', fn: 'vac' }).digits).toBe(' 127.4');
    expect(read({ ...base, target: 'tomada-nt', fn: 'vac' }).digits).toBe(' 400.0');
    expect(read({ ...base, target: 'tomada-nt', fn: 'vac' }).unit).toBe('mV');
    expect(read({ ...base, target: 'tomada-ft', fn: 'ohm' }).status).toBe('danger');
  });

  it('warns without blowing a fuse for a current jack between neutral and ground', () => {
    const r = read({ ...base, red: '10a', target: 'tomada-nt' });
    expect(r.status).toBe('danger');
    expect(r.blows).toBeUndefined();
  });

  it('measures a car battery and blows the 10 A fuse across it', () => {
    expect(read({ ...base, target: 'bateria-carro' }).digits).toBe(' 12.62');
    expect(read({ ...base, red: '10a', fn: 'a', target: 'bateria-carro' }).blows).toBe('10a');
  });

  it('has a pt-BR message for every combination', () => {
    for (const f of FUNCTIONS)
      for (const red of ['10a', 'ma', 'vohm'] as const)
        for (const t of TARGETS) {
          const r = read({ fn: f.id, red, target: t.id, blown: { ma: false, '10a': false } });
          expect(r.message.length, `${f.id}/${red}/${t.id}`).toBeGreaterThan(20);
        }
  });
});
