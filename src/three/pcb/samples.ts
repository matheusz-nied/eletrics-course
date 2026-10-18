/**
 * Example layouts for the gallery and the lessons: a small LED board, a
 * perforated prototyping board (placa ilhada) and a double-sided SMD board
 * with a ground plane. They also document how to write a layout.
 */
import type { PcbLayout, PcbPad, PcbSilk, PcbTrace, PcbVia, Point } from './layout';

/** 1/4 W resistor lead pitch (0,4") and LED pitch (0,1"). */
export const LED_BOARD = {
  r1: [20, 12.5] as Point,
  d1: [32, 12.5] as Point,
  j1: [6, 12.5] as Point,
  resistorPitch: 10.16,
};

/**
 * 40 × 25 mm board: 2-way terminal (J1), resistor (R1) and LED (D1), top
 * traces and a ground plane on the bottom. `soldered` adds solder fillets
 * where the components are mounted.
 */
export function ledBoard(soldered = false): PcbLayout {
  const { r1, d1, j1, resistorPitch } = LED_BOARD;
  const r1a: Point = [r1[0] - resistorPitch / 2, r1[1]];
  const r1b: Point = [r1[0] + resistorPitch / 2, r1[1]];
  const anode: Point = [d1[0] - 1.27, d1[1]];
  const cathode: Point = [d1[0] + 1.27, d1[1]];
  const jPlus: Point = [j1[0], j1[1] - 2.54];
  const jMinus: Point = [j1[0], j1[1] + 2.54];
  const th = (id: string, at: Point, drill: number, size: number, extra: Partial<PcbPad> = {}) =>
    ({ id, at, drill, size, solder: soldered, ...extra }) satisfies PcbPad;
  return {
    width: 40,
    height: 25,
    corner: 1,
    pads: [
      th('J1.1', jPlus, 1.3, 2.6, { shape: 'square', solder: false }),
      th('J1.2', jMinus, 1.3, 2.6, { net: 'GND', solder: false }),
      th('R1.1', r1a, 0.8, 1.8),
      th('R1.2', r1b, 0.8, 1.8),
      th('D1.A', anode, 0.9, 1.8, { shape: 'square', lead: 0.5 }),
      th('D1.K', cathode, 0.9, 1.8, { net: 'GND', lead: 0.5 }),
    ],
    traces: [
      { points: [jPlus, [jPlus[0] + 6.38, jPlus[1]], r1a], width: 1, side: 'top' },
      { points: [r1b, anode], width: 0.8, side: 'top' },
    ],
    pours: [
      {
        outline: [
          [0, 0],
          [40, 0],
          [40, 25],
          [0, 25],
        ],
        side: 'bottom',
        net: 'GND',
        clearance: 0.5,
      },
    ],
    vias: [
      { at: [12, 21.5], net: 'GND' },
      { at: [28, 21.5], net: 'GND' },
      { at: [28, 3.5], net: 'GND' },
    ],
    holes: [
      { at: [3.5, 3.5], drill: 3.2 },
      { at: [36.5, 3.5], drill: 3.2 },
      { at: [3.5, 21.5], drill: 3.2 },
      { at: [36.5, 21.5], drill: 3.2 },
    ],
    silk: [
      { kind: 'rect', at: j1, size: [7.6, 10.4], width: 0.2 },
      { kind: 'text', at: [j1[0] + 4.9, jPlus[1]], text: '+', size: 1.6 },
      { kind: 'text', at: [j1[0] + 4.9, jMinus[1]], text: '−', size: 1.6 },
      { kind: 'text', at: [j1[0], j1[1] + 7], text: 'J1', size: 1.1 },
      { kind: 'rect', at: r1, size: [6.8, 2.6], width: 0.18 },
      { kind: 'text', at: [r1[0], r1[1] - 3], text: 'R1  470R', size: 1.1 },
      // LED outline: circle with the flat on the cathode side.
      {
        kind: 'line',
        points: Array.from({ length: 33 }, (_, i): Point => {
          const a = -Math.PI * 0.39 + (Math.PI * 1.78 * i) / 32;
          return [d1[0] - Math.cos(a) * 3, d1[1] - Math.sin(a) * 3];
        }),
        width: 0.18,
      },
      {
        kind: 'line',
        points: [
          [d1[0] + 2.81, d1[1] - 1.05],
          [d1[0] + 2.81, d1[1] + 1.05],
        ],
        width: 0.18,
      },
      { kind: 'text', at: [d1[0] - 4.1, d1[1] - 2.6], text: '+', size: 1.2 },
      { kind: 'text', at: [d1[0], d1[1] + 4.3], text: 'D1', size: 1.1 },
      { kind: 'text', at: [20, 3.4], text: 'LED 9 V · REV A', size: 1.2 },
      { kind: 'text', at: [20, 21.6], text: 'CURSO DE ELETRÔNICA', size: 1, side: 'bottom' },
      { kind: 'text', at: [20, 3.4], text: 'GND', size: 1.1, side: 'bottom' },
    ],
  };
}

/**
 * Perforated prototyping board, 50 × 70 mm, 18 × 24 holes on a 2,54 mm grid,
 * double-sided with plated holes (the common green "placa ilhada").
 */
export function perfBoard(): PcbLayout {
  const cols = 18;
  const rows = 24;
  const pitch = 2.54;
  const width = 50;
  const height = 70;
  const x0 = (width - (cols - 1) * pitch) / 2;
  const y0 = (height - (rows - 1) * pitch) / 2;
  const pads: PcbPad[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      pads.push({ at: [x0 + c * pitch, y0 + r * pitch], drill: 1, size: 1.8 });
  const silk: PcbSilk[] = [];
  for (let c = 0; c < cols; c += 1)
    if (c % 2 === 0)
      silk.push({ kind: 'text', at: [x0 + c * pitch, y0 - 2.1], text: String(c + 1), size: 0.75 });
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWX';
  for (let r = 0; r < rows; r += 1)
    if (r % 2 === 0)
      silk.push({ kind: 'text', at: [x0 - 2.1, y0 + r * pitch], text: letters[r]!, size: 0.75 });
  return {
    width,
    height,
    corner: 0.5,
    pads,
    holes: [
      { at: [2, 2], drill: 2 },
      { at: [width - 2, 2], drill: 2 },
      { at: [2, height - 2], drill: 2 },
      { at: [width - 2, height - 2], drill: 2 },
    ],
    silk,
  };
}

/**
 * Double-sided SMD board, 45 × 30 mm: a 32-pin QFP microcontroller, an
 * SOIC-8, 0805 passives, a 4-pin header and ground planes on both sides
 * stitched with vias.
 */
export function smdBoard(): PcbLayout {
  const pads: PcbPad[] = [];
  const traces: PcbTrace[] = [];
  const vias: PcbVia[] = [];
  const silk: PcbSilk[] = [];

  // QFP-32, 7 × 7 mm body, 0,8 mm pitch.
  const u1: Point = [22, 15];
  const pitch = 0.8;
  const row = 4.25;
  for (let side = 0; side < 4; side++)
    for (let i = 0; i < 8; i++) {
      const t = (i - 3.5) * pitch;
      const n = side * 8 + i + 1;
      const [x, y, w, h]: [number, number, number, number] =
        side === 0
          ? [u1[0] - row, u1[1] + t, 1.5, 0.5]
          : side === 1
            ? [u1[0] + t, u1[1] + row, 0.5, 1.5]
            : side === 2
              ? [u1[0] + row, u1[1] - t, 1.5, 0.5]
              : [u1[0] - t, u1[1] - row, 0.5, 1.5];
      const ground = n === 5 || n === 21;
      pads.push({
        id: `U1.${n}`,
        at: [x, y],
        size: [w, h],
        shape: 'roundrect',
        net: ground ? 'GND' : undefined,
      });
      // Fan-out: a short trace and a via for half of the pins.
      if (!ground && i % 2 === 0) {
        const out = 2.2;
        const [dx, dy] = side === 0 ? [-1, 0] : side === 1 ? [0, 1] : side === 2 ? [1, 0] : [0, -1];
        const end: Point = [
          x + dx * out + (dy !== 0 ? 0.6 : 0),
          y + dy * out + (dx !== 0 ? 0.6 : 0),
        ];
        const mid: Point = [x + dx * (out - 0.6), y + dy * (out - 0.6)];
        traces.push({ points: [[x, y], mid, end], width: 0.25, side: 'top' });
        vias.push({ at: end, drill: 0.3, size: 0.6 });
      }
    }
  silk.push(
    {
      kind: 'line',
      points: [
        [u1[0] - 3.6, u1[1] - 2.8],
        [u1[0] - 3.6, u1[1] - 3.6],
        [u1[0] - 2.8, u1[1] - 3.6],
      ],
    },
    {
      kind: 'line',
      points: [
        [u1[0] + 2.8, u1[1] - 3.6],
        [u1[0] + 3.6, u1[1] - 3.6],
        [u1[0] + 3.6, u1[1] - 2.8],
      ],
    },
    {
      kind: 'line',
      points: [
        [u1[0] + 3.6, u1[1] + 2.8],
        [u1[0] + 3.6, u1[1] + 3.6],
        [u1[0] + 2.8, u1[1] + 3.6],
      ],
    },
    {
      kind: 'line',
      points: [
        [u1[0] - 2.8, u1[1] + 3.6],
        [u1[0] - 3.6, u1[1] + 3.6],
        [u1[0] - 3.6, u1[1] + 2.8],
      ],
    },
    { kind: 'circle', at: [u1[0] - 5.8, u1[1] - 4.2], r: 0.3, fill: true },
    { kind: 'text', at: [u1[0], u1[1] - 6.6], text: 'U1', size: 1 },
  );

  // SOIC-8 at the left, 1,27 mm pitch.
  const u2: Point = [7.5, 15];
  for (let i = 0; i < 4; i++) {
    const y = u2[1] + (i - 1.5) * 1.27;
    pads.push({ id: `U2.${i + 1}`, at: [u2[0] - 2.7, y], size: [1.55, 0.6], shape: 'roundrect' });
    pads.push({ id: `U2.${8 - i}`, at: [u2[0] + 2.7, y], size: [1.55, 0.6], shape: 'roundrect' });
  }
  silk.push(
    { kind: 'rect', at: u2, size: [3.2, 5.2], width: 0.15 },
    { kind: 'circle', at: [u2[0] - 1, u2[1] - 1.9], r: 0.25, fill: true },
    { kind: 'text', at: [u2[0], u2[1] - 4.2], text: 'U2', size: 1 },
  );
  traces.push(
    {
      points: [
        [u2[0] + 2.7, u2[1] - 1.905],
        [u2[0] + 5, u2[1] - 1.905],
        [u1[0] - 6.5, u1[1] - 1.2],
        [u1[0] - row, u1[1] - 1.2],
      ],
      width: 0.25,
      side: 'top',
    },
    {
      points: [
        [u2[0] + 2.7, u2[1] + 0.635],
        [u1[0] - 6.8, u2[1] + 0.635],
        [u1[0] - 6.8, u1[1] + 0.4],
        [u1[0] - row, u1[1] + 0.4],
      ],
      width: 0.25,
      side: 'top',
    },
  );

  // 0805 passives around U1.
  const passive = (id: string, at: Point, vertical: boolean, label: Point) => {
    const d = 0.95;
    const [a, b]: [Point, Point] = vertical
      ? [
          [at[0], at[1] - d],
          [at[0], at[1] + d],
        ]
      : [
          [at[0] - d, at[1]],
          [at[0] + d, at[1]],
        ];
    const size: Point = vertical ? [1.3, 1.0] : [1.0, 1.3];
    pads.push(
      { id: `${id}.1`, at: a, size, shape: 'roundrect' },
      { id: `${id}.2`, at: b, size, shape: 'roundrect', net: 'GND' },
    );
    silk.push({ kind: 'text', at: label, text: id, size: 0.8 });
  };
  passive('C1', [29.5, 9], true, [31.2, 9]);
  passive('C2', [29.5, 21], true, [31.2, 21]);
  passive('R1', [15, 22.5], false, [15, 24.3]);
  passive('C3', [15, 7.5], false, [15, 5.8]);

  // 1 × 4 header at the right edge.
  const names = ['5V', 'GND', 'RX', 'TX'];
  for (let i = 0; i < 4; i++) {
    const at: Point = [40.5, 11.19 + i * 2.54];
    pads.push({
      id: `J1.${i + 1}`,
      at,
      drill: 1,
      size: 1.7,
      shape: i === 0 ? 'square' : 'round',
      net: i === 1 ? 'GND' : undefined,
    });
    silk.push({ kind: 'text', at: [37.2, at[1]], text: names[i]!, size: 0.8, align: 'right' });
  }
  silk.push(
    { kind: 'rect', at: [40.5, 15], size: [2.8, 10.4], width: 0.15 },
    { kind: 'text', at: [40.5, 8.4], text: 'J1', size: 0.9 },
    { kind: 'text', at: [22.5, 2.4], text: 'PLACA DE CONTROLE  v1.2', size: 1 },
    {
      kind: 'text',
      at: [22.5, 27.8],
      text: 'PLANO DE TERRA · 2 CAMADAS',
      size: 0.9,
      side: 'bottom',
    },
  );
  traces.push(
    {
      points: [
        [40.5, 11.19],
        [36, 11.19],
        [32.5, 7.69],
        [29.5, 7.69],
        [29.5, 8.05],
      ],
      width: 0.5,
      side: 'top',
    },
    {
      points: [
        [40.5, 16.27],
        [35.5, 16.27],
        [u1[0] + row + 2.2, 13.6],
      ],
      width: 0.3,
      side: 'top',
    },
    {
      points: [
        [40.5, 18.81],
        [35.5, 18.81],
        [u1[0] + row + 2.2, 15.6],
      ],
      width: 0.3,
      side: 'top',
    },
  );

  // Stitching vias around the edge.
  for (let x = 7; x <= 38; x += 4.4) {
    vias.push({ at: [x, 1.4], net: 'GND' }, { at: [x, 28.6], net: 'GND' });
  }
  const full: Point[] = [
    [0, 0],
    [45, 0],
    [45, 30],
    [0, 30],
  ];
  return {
    width: 45,
    height: 30,
    corner: 1.5,
    finish: 'enig',
    pads,
    traces,
    vias,
    pours: [
      { outline: full, side: 'top', net: 'GND', clearance: 0.3 },
      { outline: full, side: 'bottom', net: 'GND', clearance: 0.3 },
    ],
    holes: [
      { at: [3, 27], drill: 2.2 },
      { at: [42, 27], drill: 2.2 },
    ],
    silk,
  };
}
