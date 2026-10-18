import { describe, expect, it } from 'vitest';
import { fatorLimite, nivelForca, tempoPausa } from '../central/controller';
import { GATE_PARAMS } from '../central/plant';
import { CentralController, type CentralOptions } from '../ui/central-controller';

/**
 * What lesson 16.8 (src/content/aulas/m16-portao/08-ajustes-e-testes.mdx)
 * tells the student to see in its central virtual: a rough spot from 2 m to
 * 3 m (80 N more) stops the gate with FORÇA at 25 % (TRIAC 55 %), it gets
 * through from about TRIAC 58 %, and the obstacle and photocell tests still
 * reverse the closing gate with the FORÇA raised. Plus the numbers of the
 * worked example.
 */

const ROUGH = { atritoExtra: { de: 2, ate: 3, forca: 80 } };
const pos = (ctl: CentralController) => ctl.getSnapshot().abertura * GATE_PARAMS.imaFca;

function central(opts: CentralOptions): CentralController {
  const ctl = new CentralController(opts);
  ctl.advance(0.2);
  return ctl;
}

function command(ctl: CentralController): void {
  ctl.remote();
  ctl.advance(0.1);
}

/** Runs while the central stays in `state` (at most `limit` s). */
function whileIn(ctl: CentralController, state: string, limit = 45): void {
  let t = 0;
  while (t < limit && ctl.getSnapshot().estado === state) {
    ctl.advance(0.05);
    t += 0.05;
  }
}

describe('aula 16.8: ajustes e testes', () => {
  it('shows the FORÇA and PAUSA the text quotes', () => {
    expect(nivelForca(0.25)).toBeCloseTo(0.55);
    expect(nivelForca(0.3)).toBeCloseTo(0.58);
    expect(nivelForca(0.4)).toBeCloseTo(0.64);
    expect(nivelForca(0.5)).toBeCloseTo(0.7);
    expect(fatorLimite(0.5)).toBeCloseTo(1.75);
    expect(tempoPausa(0.25)).toBeCloseTo(30);
    expect(tempoPausa(45 / 120)).toBeCloseTo(45);
    expect(tempoPausa(0.01)).toBe(0);
  });

  it('with FORÇA low, the rough spot stops the opening gate near 2 m', () => {
    const ctl = central({ faults: ROUGH, settings: { forca: 0.25 } });
    command(ctl);
    whileIn(ctl, 'ABRINDO');
    expect(ctl.getSnapshot().estado).toBe('PARADO');
    expect(pos(ctl)).toBeGreaterThan(1.95);
    expect(pos(ctl)).toBeLessThan(2.15);
    expect(ctl.getSnapshot().eventos[0]?.message).toMatch(/Obstáculo na abertura/);
    // The next command closes it back home.
    command(ctl);
    whileIn(ctl, 'FECHANDO');
    expect(ctl.getSnapshot().estado).toBe('FECHADO');
  });

  it('with FORÇA low, the closing gate turns back at the rough spot', () => {
    const ctl = central({ faults: ROUGH, settings: { forca: 0.25 }, abertura: 1 });
    command(ctl);
    whileIn(ctl, 'FECHANDO');
    expect(ctl.getSnapshot().estado).toBe('ABRINDO');
    expect(pos(ctl)).toBeGreaterThan(2.8);
  });

  it('gets through from about TRIAC 58 %, in both directions', () => {
    for (const forca of [0.3, 0.4]) {
      const ctl = central({ faults: ROUGH, settings: { forca, j2: false } });
      command(ctl);
      whileIn(ctl, 'ABRINDO');
      expect(ctl.getSnapshot().estado, `forca ${forca}`).toBe('ABERTO');
      command(ctl);
      whileIn(ctl, 'FECHANDO');
      expect(ctl.getSnapshot().estado, `forca ${forca}`).toBe('FECHADO');
    }
    const short = central({ faults: ROUGH, settings: { forca: 0.28, j2: false } });
    command(short);
    whileIn(short, 'ABRINDO');
    expect(short.getSnapshot().estado).toBe('PARADO');
  });

  it('raising FORÇA in the middle of the exercise also works', () => {
    const ctl = central({ faults: ROUGH, settings: { forca: 0.25 } });
    command(ctl);
    whileIn(ctl, 'ABRINDO');
    expect(ctl.getSnapshot().estado).toBe('PARADO');
    ctl.setSetting('forca', 0.4);
    command(ctl); // closes back from the rough spot
    whileIn(ctl, 'FECHANDO');
    expect(ctl.getSnapshot().estado).toBe('FECHADO');
    command(ctl);
    whileIn(ctl, 'ABRINDO');
    expect(ctl.getSnapshot().estado).toBe('ABERTO');
  });

  it('still reverses on an obstacle and on the photocell with FORÇA raised', () => {
    const obst = central({ faults: ROUGH, settings: { forca: 0.4, j2: false }, abertura: 1 });
    command(obst);
    obst.advance(2);
    obst.setObstacle(true);
    whileIn(obst, 'FECHANDO');
    expect(obst.getSnapshot().estado).toBe('ABRINDO');
    expect(pos(obst)).toBeCloseTo(1.5, 1);

    const beam = central({ faults: ROUGH, settings: { forca: 0.4, j2: false }, abertura: 1 });
    command(beam);
    beam.advance(2);
    beam.setBeam(true);
    beam.advance(0.1);
    expect(beam.getSnapshot().estado).toBe('ABRINDO');
    expect(beam.getSnapshot().eventos[0]?.message).toMatch(/fotocélula/i);
  });

  it('closes by itself after the PAUSA set on the trimpot (J2 fitted)', () => {
    const ctl = central({ abertura: 1, settings: { j2: true, pausa: 10 / 120 } });
    expect(ctl.getSnapshot().pausaRestante).toBeCloseTo(10, 0);
    ctl.advance(9.5);
    expect(ctl.getSnapshot().estado).toBe('ABERTO');
    ctl.advance(1);
    expect(ctl.getSnapshot().estado).toBe('FECHANDO');
  });

  it('runs at about 1,4 A with FORÇA in the middle, so the obstacle limit is about 2,5 A', () => {
    const ctl = central({ settings: { forca: 0.5, j2: false } });
    command(ctl);
    ctl.advance(5);
    const s = ctl.getSnapshot();
    expect(s.corrente).toBeGreaterThan(1.35);
    expect(s.corrente).toBeLessThan(1.5);
    expect(s.limiteCorrente).toBeGreaterThan(2.4);
    expect(s.limiteCorrente).toBeLessThan(2.6);
  });
});
