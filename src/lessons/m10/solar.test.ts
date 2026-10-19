import { describe, expect, it } from 'vitest';
import { STC, panelCurve } from './solar';

/** The numbers lesson 10.4 quotes from the panel widget. */
describe('10.4 photovoltaic module', () => {
  it('at 1.000 W/m² and 25 °C matches its label: 330 W, Voc 40,6 V, Isc 10,4 A, Vmp 33,7 V, Imp 9,8 A', () => {
    const c = panelCurve(STC);
    expect(c.mpp.p).toBeCloseTo(330, -1);
    expect(c.voc).toBeCloseTo(40.6, 1);
    expect(c.isc).toBeCloseTo(10.4, 1);
    expect(c.mpp.v).toBeCloseTo(33.7, 1);
    expect(c.mpp.i).toBeCloseTo(9.8, 1);
    expect(c.peaks).toHaveLength(1);
  });

  it('half the light halves the current but barely changes the voltage', () => {
    const c = panelCurve({ ...STC, irradiance: 500 });
    expect(c.isc).toBeCloseTo(5.2, 1);
    expect(c.voc).toBeCloseTo(39.3, 1);
    expect(c.mpp.p).toBeCloseTo(162, 0);
  });

  it('a hot panel (60 °C) loses voltage and about 11 % of its power', () => {
    const c = panelCurve({ ...STC, temperature: 60 });
    expect(c.voc).toBeCloseTo(36.8, 1);
    expect(c.mpp.p).toBeCloseTo(293, 0);
    expect(1 - c.mpp.p / 330.5).toBeCloseTo(0.11, 2);
  });

  it('one cell fully shaded: its string is bypassed, the module gives about 215 W at 22 V, with a false peak of 65 W at 31,6 V', () => {
    const c = panelCurve({ ...STC, shade: 1 });
    expect(c.mpp.p).toBeCloseTo(215, 0);
    expect(c.mpp.v).toBeCloseTo(22.0, 1);
    expect(c.bypassedAtMpp).toBe(1);
    expect(c.peaks).toHaveLength(2);
    expect(c.peaks[1]!.p).toBeCloseTo(65, 0);
    expect(c.peaks[1]!.v).toBeCloseTo(31.6, 1);
    expect(c.shadedCellHeat).toBeGreaterThan(10);
    expect(c.shadedCellHeat).toBeLessThan(40);
  });

  it('half a cell shaded: two peaks, the higher one about 225 W at 37,9 V', () => {
    const c = panelCurve({ ...STC, shade: 0.5 });
    expect(c.peaks).toHaveLength(2);
    expect(c.mpp.p).toBeCloseTo(225, 0);
    expect(c.mpp.v).toBeCloseTo(37.9, 1);
  });

  it('without bypass diodes, the shaded cell heats with more than 100 W and the module gives about 174 W', () => {
    const c = panelCurve({ ...STC, shade: 1, bypass: false });
    expect(c.mpp.p).toBeCloseTo(174, 0);
    expect(c.shadedCellHeat).toBeGreaterThan(100);
  });
});
