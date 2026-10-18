import { describe, expect, it } from 'vitest';
import { layoutPlot, niceScale } from './layout';

const nb = (s: string) => s.replace(/\u00a0/g, ' ');

describe('niceScale', () => {
  it('rounds the limits to nice steps', () => {
    expect(niceScale(0.3, 9.6)).toEqual({ min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10] });
    expect(niceScale(5, 5).ticks.length).toBeGreaterThan(2);
  });
});

describe('layoutPlot', () => {
  it('labels ticks in pt-BR and draws each series in the box', () => {
    const layout = layoutPlot(
      [
        {
          label: 'Corrente',
          unit: 'A',
          points: [
            [0, 0.00255],
            [0.025, 0.001],
            [0.05, 0.0001],
          ],
        },
        {
          label: 'Tensão',
          unit: 'V',
          points: [
            [0, 0],
            [0.05, 12],
          ],
        },
      ],
      { xUnit: 's', xMin: 0, xMax: 0.05 },
    );
    expect(layout.axes.map((a) => a.side)).toEqual(['left', 'right']);
    expect(layout.x.ticks.map((t) => nb(t.label))).toContain('20 ms');
    expect(layout.axes[0]!.ticks.map((t) => nb(t.label))).toContain('1 mA');
    expect(layout.series[0]!.path.startsWith('M0.0 ')).toBe(true);
    expect(layout.series[1]!.axis).toBe(1);
  });

  it('uses decades on a log axis', () => {
    const layout = layoutPlot(
      [
        {
          label: 'Ganho',
          unit: 'dB',
          points: [
            [10, 0],
            [1e5, -60],
          ],
        },
      ],
      {
        xUnit: 'Hz',
        log: true,
      },
    );
    expect(layout.x.ticks.map((t) => nb(t.label))).toEqual([
      '10 Hz',
      '100 Hz',
      '1 kHz',
      '10 kHz',
      '100 kHz',
    ]);
  });

  it('offers sparser rows of x labels for narrow charts', () => {
    const points = Array.from({ length: 11 }, (_, i): [number, number] => [i * 10, 1000 - i]);
    const layout = layoutPlot([{ label: 'R', unit: 'Ω', points }], { xUnit: '°C' });
    const rows = layout.x.rows.map((r) => r.ticks.map((t) => nb(t.label)));
    expect(rows[0]).toEqual(['0 °C', '20 °C', '40 °C', '60 °C', '80 °C', '100 °C']);
    expect(rows[1]).toEqual(['0 °C', '40 °C', '80 °C']);
    expect(rows.at(-1)).toEqual(['0 °C', '100 °C']);
    expect(layout.x.rows[0]!.ticks.map((t) => t.align)).toEqual([
      'start',
      'middle',
      'middle',
      'middle',
      'middle',
      'end',
    ]);
    // The phone of lesson 4.2 (about 270 px of plot) needs the second row.
    const fits = layout.x.rows.map((r) => r.fit);
    expect(fits[0]).toBeGreaterThan(270);
    expect(fits[1]).toBeLessThan(270);
    expect(fits.at(-1)).toBe(0);
    expect([...fits].sort((a, b) => b - a)).toEqual(fits);
  });

  it('thins decades on a log axis', () => {
    const layout = layoutPlot(
      [
        {
          label: 'Ganho',
          unit: 'dB',
          points: [
            [1, 0],
            [1e6, -60],
          ],
        },
      ],
      { xUnit: 'Hz', log: true },
    );
    expect(layout.x.rows[1]!.ticks.map((t) => nb(t.label))).toEqual([
      '1 Hz',
      '100 Hz',
      '10 kHz',
      '1 MHz',
    ]);
  });
});
