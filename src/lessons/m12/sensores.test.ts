import { describe, expect, it } from 'vitest';
import { PirSim } from './pir-sim';
import {
  ACS712,
  LSB,
  PIR,
  PIR_INICIAL,
  alcanceIR,
  amostrar,
  analisarCorrente,
  correnteDaCarga,
  correntePorPasso,
  distanciaDoPrograma,
  infravermelho,
  luzRefletida,
  pirDetecta,
  pirPasso,
  rmsDoPrograma,
  tensaoNoPino,
  ultrassom,
  velocidadeSom,
  zonaPir,
  type PirEstado,
  type PirModo,
} from './sensores';

/** Runs the PIR timer for `seconds` with detections at the given times. */
function pir(seconds: number, deteccoes: number[], tempo: number, modo: PirModo) {
  let s: PirEstado = PIR_INICIAL;
  const dt = 0.05;
  const out: boolean[] = [];
  for (let k = 1; k <= Math.round(seconds / dt); k++) {
    const t = k * dt;
    const det = deteccoes.some((d) => Math.abs(d - t) < dt / 2);
    s = pirPasso(s, dt, det, tempo, modo);
    out.push(s.saida);
  }
  return { s, alto: (t: number) => out[Math.round(t / dt) - 1] };
}

describe('PIR (HC-SR501 style)', () => {
  it('only sees changes between the zones of the lens', () => {
    expect(zonaPir(0.05)).toBeNull();
    expect(zonaPir(0.1)).toBe(0);
    expect(zonaPir(0.9)).toBe(7);
    expect(pirDetecta(0.05, 0.12)).toBe(true);
    expect(pirDetecta(0.12, 0.14)).toBe(false);
    expect(pirDetecta(0.19, 0.21)).toBe(true);
    expect(pirDetecta(0.5, 0.5)).toBe(false);
  });

  it('holds the output for the trimpot time, then blocks about 2,5 s', () => {
    const r = pir(12, [1, 8], 5, 'H');
    expect(r.alto(1)).toBe(true);
    expect(r.alto(5.9)).toBe(true);
    expect(r.alto(6.1)).toBe(false);
    // The movement at 8 s falls in the blocking time (6 s to 8,5 s): ignored.
    expect(r.alto(9)).toBe(false);
    expect(PIR.bloqueio).toBe(2.5);
    expect(PIR.saida).toBe(3.3);
  });

  it('restarts the time in mode H and not in mode L', () => {
    const h = pir(12, [1, 4], 5, 'H');
    expect(h.alto(8.9)).toBe(true);
    expect(h.alto(9.1)).toBe(false);
    const l = pir(12, [1, 4], 5, 'L');
    expect(l.alto(5.9)).toBe(true);
    expect(l.alto(6.1)).toBe(false);
  });

  it('stops detecting a person who stands still', () => {
    const sim = new PirSim(5, 'H');
    sim.setX(0.5);
    sim.advance(1);
    expect(sim.getSnapshot().estado.saida).toBe(true);
    sim.advance(5);
    expect(sim.getSnapshot().estado.saida).toBe(false);
    sim.advance(10);
    expect(sim.getSnapshot().estado.saida).toBe(false);
  });

  it('keeps the output high while the person walks across', () => {
    const sim = new PirSim(5, 'H');
    sim.passar();
    sim.advance(3.2);
    const s = sim.getSnapshot();
    expect(s.andando).toBe(false);
    expect(s.x).toBeCloseTo(0.96);
    expect(s.estado.saida).toBe(true);
    expect(s.deteccoes.length).toBe(9);
  });
});

describe('ultrasound (HC-SR04 style)', () => {
  it('uses about 343 m/s at 20 °C', () => {
    expect(velocidadeSom(20)).toBeCloseTo(343.42, 2);
    expect(velocidadeSom(0)).toBeCloseTo(331.3, 2);
  });

  it('gives an echo of 5.824 µs for 1 m at 20 °C', () => {
    const r = ultrassom(100, 20, 'dura');
    expect(r.eco).toBe(true);
    expect(r.larguraUs).toBeCloseTo(5823.8, 1);
    expect(r.dPrograma).toBeCloseTo(99.88, 2);
    expect(distanciaDoPrograma(5830)).toBeCloseTo(99.98, 2);
  });

  it('reads 3,5 cm too far at 0 °C when the program assumes 343 m/s', () => {
    const r = ultrassom(100, 0, 'dura');
    expect(r.larguraUs).toBeCloseTo(6036.8, 1);
    expect(r.erroCm).toBeCloseTo(3.53, 2);
  });

  it('has no echo beyond 4 m or from soft surfaces (about 38 ms timeout)', () => {
    expect(ultrassom(450, 20, 'dura')).toMatchObject({ eco: false, motivo: 'longe' });
    expect(ultrassom(100, 20, 'macia')).toMatchObject({ eco: false, motivo: 'macia' });
    expect(ultrassom(450, 20, 'dura').larguraUs).toBe(38000);
  });
});

describe('reflective infrared (FC-51 style)', () => {
  it('sees white up to 15 cm with the trimpot halfway, black only up to about 4,5 cm', () => {
    expect(alcanceIR('branco', 0.5)).toBeCloseTo(15, 6);
    expect(alcanceIR('cinza', 0.5)).toBeCloseTo(10.61, 2);
    expect(alcanceIR('preto', 0.5)).toBeCloseTo(4.47, 2);
  });

  it('pulls OUT low when it detects', () => {
    expect(infravermelho(12, 'branco', 0.5, false)).toMatchObject({ detecta: true, saidaV: 0 });
    expect(infravermelho(12, 'branco', 0.5, false).luz).toBeCloseTo(0.781, 3);
    expect(infravermelho(12, 'preto', 0.5, false)).toMatchObject({ detecta: false, saidaV: 5 });
  });

  it('falsely triggers in strong sunlight', () => {
    expect(infravermelho(30, 'preto', 0.5, true).detecta).toBe(true);
    expect(luzRefletida(1, 'branco')).toBe(1);
  });
});

describe('current sensors', () => {
  it('computes the current from the power at 127 V', () => {
    expect(correnteDaCarga(9)).toBeCloseTo(0.0709, 4);
    expect(correnteDaCarga(60)).toBeCloseTo(0.4724, 4);
    expect(correnteDaCarga(5500)).toBeCloseTo(43.31, 2);
  });

  it('gives the ACS712 resolution: 4,9 mV, about 26 mA per step', () => {
    expect(LSB * 1000).toBeCloseTo(4.883, 3);
    expect(correntePorPasso('hall') * 1000).toBeCloseTo(26.4, 1);
    expect(correntePorPasso('alicate')).toBeCloseTo(0.296, 3);
    expect(tensaoNoPino('hall', 0)).toBe(ACS712.zero);
    expect(tensaoNoPino('hall', 1)).toBeCloseTo(2.685, 3);
  });

  it('reads the 60 W fan as 0,47 A with the ACS712', () => {
    const r = analisarCorrente('hall', 60);
    expect(r.foraDaFaixa).toBe(false);
    expect(r.vpico).toBeCloseTo(0.1236, 4);
    expect(r.min).toBe(487);
    expect(r.max).toBe(537);
    expect(r.rmsPrograma).toBeCloseTo(0.472, 3);
  });

  it('cannot see a 9 W LED lamp with the 100 A clamp', () => {
    expect(analisarCorrente('alicate', 9).rmsPrograma).toBe(0);
    expect(analisarCorrente('hall', 9).rmsPrograma).toBeCloseTo(0.073, 3);
  });

  it('flags the shower as out of range for the ACS712 of 5 A, not for the clamp', () => {
    expect(analisarCorrente('hall', 5500).foraDaFaixa).toBe(true);
    expect(analisarCorrente('hall', 1000).foraDaFaixa).toBe(true);
    const clamp = analisarCorrente('alicate', 5500);
    expect(clamp.foraDaFaixa).toBe(false);
    expect(clamp.vpico).toBeCloseTo(1.011, 3);
    expect(clamp.rmsPrograma).toBeCloseTo(43.3, 1);
  });

  it('computes the RMS of 200 samples over 6 cycles', () => {
    const leituras = amostrar('hall', 1);
    expect(leituras.length).toBe(200);
    expect(rmsDoPrograma('hall', leituras)).toBeCloseTo(1, 2);
  });
});
