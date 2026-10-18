/**
 * Wire-to-board connectors: a male header soldered to the board and the
 * female housing with crimped terminals on coloured wires.
 * - `kk`: 2,54 mm pitch, open header with the rear friction-lock wall and
 *   ramp (Molex KK 254 style: header 6373/6410, housing 2695, terminal
 *   2759); pins 0,64 mm square.
 * - `jst-xh`: 2,50 mm pitch, shrouded header with the lock window and the
 *   polarising notches (JST XH style: B·B-XH-A header, XHP housing, SXH
 *   terminal; header (n − 1) × 2,5 + 4,9 mm long, 5,75 mm deep, 7,0 mm tall).
 * - `jst-ph`: 2,00 mm pitch, the smaller shrouded version (JST PH style:
 *   B·B-PH-K-S, PHR, SPH; header (n − 1) × 2 + 3,9 mm long, 4,5 mm deep,
 *   6,0 mm tall); pins 0,5 mm square.
 * Dimensions from the manufacturers' public drawings, rounded; housings are
 * plain (no brand marks). Pin tips at y = 0, board surface at
 * `CONNECTOR_SEAT`. Unmating slides the plug up smoothly.
 */
import { useRef } from 'react';
import {
  BoxGeometry,
  CircleGeometry,
  Curve,
  CylinderGeometry,
  Path,
  RingGeometry,
  Shape,
  Vector3,
  type BufferGeometry,
  type Group,
} from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import { addRoundedRect, extrudeAlongX, extrudeAlongZ, extrudeUp, mergeAll } from './_em-geometry';
import { Decal, Pin, shade, useSmooth } from './_em-kit';

type Family = 'kk' | 'jst-xh' | 'jst-ph';

export interface ConnectorKkProps {
  family?: Family;
  /** Number of ways (2 to 12). */
  pins?: number;
  /** Plug pushed onto the header. */
  mated?: boolean;
  /** Wire colours, comma separated (preto, vermelho, azul…). Empty: a default sequence. */
  wireColors?: string;
}

interface Spec {
  label: string;
  pitch: number;
  pin: number;
  /** Pin below the board. */
  tail: number;
  /** Pin top above the board. */
  pinTop: number;
  /** Header: length for n ways, depth, height (base for KK, shroud for the others). */
  headerL: (n: number) => number;
  headerD: number;
  headerH: number;
  /** Shroud wall and floor (shrouded headers). */
  wall: number;
  floor: number;
  /** Lock window in the front wall (y from the board) and its width. */
  window: [number, number, number];
  /** Plug housing: length for n ways, depth, height; cavity size. */
  plugL: (n: number) => number;
  plugD: number;
  plugH: number;
  cavity: [number, number];
  /** Terminal receptacle (x, z) and its length. */
  receptacle: [number, number, number];
  /** Wire: insulation and copper diameters. */
  wire: number;
  core: number;
  wireName: string;
}

const SPECS: Record<Family, Spec> = {
  kk: {
    label: 'KK 2,54 mm',
    pitch: 2.54,
    pin: 0.64,
    tail: 3.3,
    pinTop: 9.1,
    headerL: (n) => n * 2.54,
    headerD: 6.2,
    headerH: 3.2,
    wall: 1,
    floor: 3.2,
    window: [9.3, 10.8, 0],
    plugL: (n) => n * 2.54 - 0.15,
    plugD: 4.6,
    plugH: 12,
    cavity: [1.9, 2.4],
    receptacle: [1.5, 1.8, 5.8],
    wire: 1.6,
    core: 0.64,
    wireName: '22 AWG (0,3 mm²)',
  },
  'jst-xh': {
    label: 'XH 2,5 mm',
    pitch: 2.5,
    pin: 0.64,
    tail: 3.4,
    pinTop: 6,
    headerL: (n) => (n - 1) * 2.5 + 4.9,
    headerD: 5.75,
    headerH: 7,
    wall: 0.6,
    floor: 1.2,
    window: [4.6, 6.2, 2.4],
    plugL: (n) => (n - 1) * 2.5 + 3.6,
    plugD: 4.4,
    plugH: 9.8,
    cavity: [1.7, 2.2],
    receptacle: [1.4, 1.7, 4.4],
    wire: 1.3,
    core: 0.5,
    wireName: '26 AWG (0,13 mm²)',
  },
  'jst-ph': {
    label: 'PH 2,0 mm',
    pitch: 2,
    pin: 0.5,
    tail: 3.4,
    pinTop: 4.5,
    headerL: (n) => (n - 1) * 2 + 3.9,
    headerD: 4.5,
    headerH: 6,
    wall: 0.5,
    floor: 1,
    window: [3.6, 4.8, 2],
    plugL: (n) => (n - 1) * 2 + 2.8,
    plugD: 3.4,
    plugH: 7.4,
    cavity: [1.4, 1.8],
    receptacle: [1.2, 1.4, 3.2],
    wire: 1,
    core: 0.38,
    wireName: '28 AWG (0,08 mm²)',
  },
};

/** Height of the board surface above the pin tips (for scenes that seat it on a board). */
export const CONNECTOR_SEAT = SPECS.kk.tail;

const WIRE_COLORS: Record<string, string> = {
  preto: '#1d1d1f',
  vermelho: '#c8231b',
  amarelo: '#f0c419',
  azul: '#1f56c9',
  verde: '#21893f',
  branco: '#ecebe6',
  laranja: '#ec7a16',
  marrom: '#6b3b1c',
  cinza: '#8a8d91',
  violeta: '#6c3fa8',
  roxo: '#6c3fa8',
  'azul-claro': '#3d8fe0',
};
const DEFAULT_WIRES = [
  'vermelho',
  'preto',
  'amarelo',
  'azul',
  'verde',
  'branco',
  'laranja',
  'marrom',
  'cinza',
  'violeta',
  'azul-claro',
  'preto',
];

export const meta: PartMeta = {
  id: 'connector-kk',
  label: 'Conector placa-fio (KK, XH, PH)',
  category: 'conexoes',
  summary:
    'Conector macho com trava soldado na placa e plugue fêmea com terminais crimpados nos fios coloridos.',
  defaults: { family: 'kk', pins: 3, mated: true, wireColors: '' },
  controls: {
    family: {
      kind: 'select',
      label: 'Família',
      options: [
        { value: 'kk', label: 'KK 2,54 mm (rampa de trava)' },
        { value: 'jst-xh', label: 'XH 2,5 mm (tipo JST)' },
        { value: 'jst-ph', label: 'PH 2,0 mm (tipo JST)' },
      ],
    },
    pins: { kind: 'number', label: 'Vias', min: 2, max: 12, step: 1 },
    mated: { kind: 'toggle', label: 'Plugue encaixado' },
    wireColors: { kind: 'text', label: 'Cores dos fios (separadas por vírgula)', maxLength: 120 },
  },
  annotations: (p) => {
    const s = SPECS[familyOf(p.family)];
    const n = pinsOf(p.pins);
    const L = s.headerL(n);
    const list: PartAnnotation[] = [
      {
        at: [L / 2, s.tail + Math.min(s.headerH, 3.2) * 0.5, s.headerD / 2 - 0.4],
        text: 'Conector macho soldado na placa',
        exploded: false,
      },
      {
        at: [0, 0, 0],
        text:
          familyOf(p.family) === 'kk'
            ? 'Rampa de trava: segura o plugue'
            : 'Janela da trava: o plugue estala aqui',
        anchor: 'trava',
      },
      { at: [0, 0, 0], text: 'Plugue (carcaça fêmea)', anchor: 'carcaca' },
      {
        at: [0, 0, 0],
        text: 'Terminal fêmea: abraça o pino',
        anchor: 'terminal',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Crimpagem: aperta o cobre e a isolação',
        anchor: 'crimpagem',
        exploded: true,
      },
    ];
    if (p.mated === false)
      list.push({
        at: [(-(n - 1) / 2) * s.pitch, s.tail + s.pinTop, 0],
        text: `Pinos de ${fmt(s.pin)} mm, passo de ${fmt(s.pitch)} mm`,
        exploded: false,
      });
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const s = SPECS[familyOf(p.family)];
    const n = pinsOf(p.pins);
    const colors = wireColorsOf(p.wireColors, n).map((c) => c.name);
    const list =
      colors.length > 1
        ? `${colors.slice(0, -1).join(', ')} e ${colors[colors.length - 1]}`
        : colors[0];
    return `Conector placa-fio ${s.label} de ${n} vias, ${p.mated === false ? 'com o plugue solto acima dos pinos' : 'com o plugue encaixado e travado'}; fios ${s.wireName} nas cores ${list}.`;
  },
  view: [0.75, 0.85, 1.4],
};

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 1 });
}
function familyOf(v: unknown): Family {
  return v === 'jst-xh' || v === 'jst-ph' ? v : 'kk';
}
function pinsOf(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, 2), 12) : 3;
}
function wireColorsOf(v: unknown, n: number): { name: string; color: string }[] {
  const names = String(v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from({ length: n }, (_, i) => {
    const name = names[i] && names[i] in WIRE_COLORS ? names[i] : DEFAULT_WIRES[i % 12]!;
    return { name, color: WIRE_COLORS[name]! };
  });
}

/** Wire route: up, a quarter bend towards −Z, then straight back. Parametrised by length. */
class WireRoute extends Curve<Vector3> {
  constructor(
    public rise: number,
    public radius: number,
    public run: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new Vector3()): Vector3 {
    const arc = (Math.PI / 2) * this.radius;
    const s = t * (this.rise + arc + this.run);
    if (s <= this.rise) return target.set(0, s, 0);
    if (s <= this.rise + arc) {
      const a = (s - this.rise) / this.radius;
      return target.set(0, this.rise + Math.sin(a) * this.radius, -(1 - Math.cos(a)) * this.radius);
    }
    return target.set(0, this.rise + this.radius, -this.radius - (s - this.rise - arc));
  }
}

/** Side profile (z, y) → shape for `extrudeAlongX` (shape X is −Z). */
function profile(points: [number, number][]): Shape {
  const s = new Shape();
  points.forEach(([z, y], i) => (i === 0 ? s.moveTo(-z, y) : s.lineTo(-z, y)));
  s.closePath();
  return s;
}

/** Open KK header: base and the rear wall with the friction-lock ramp, one profile. */
function kkHeaderGeometry(s: Spec, n: number): BufferGeometry {
  const front = s.headerD / 2 - 0.65;
  const back = front - s.headerD;
  const wallFront = back + s.wall;
  const [r0, r1] = s.window;
  const top = r1 + 0.8;
  const shape = profile([
    [front, 0],
    [front, s.headerH - 0.25],
    [front - 0.25, s.headerH],
    [wallFront, s.headerH],
    [wallFront, r0],
    [wallFront + 0.4, r0 + (r1 - r0) * 0.68],
    [wallFront + 0.4, r1 - 0.2],
    [wallFront, r1],
    [wallFront, top - 0.2],
    [wallFront - 0.2, top],
    [back + 0.2, top],
    [back, top - 0.2],
    [back, 0],
  ]);
  return extrudeAlongX(shape, s.headerL(n), 0.12, { curveSegments: 1, bevelSegments: 1 });
}

/** Shrouded header (XH, PH): floor and four walls, lock window in front, polarising notches behind. */
function shroudGeometry(s: Spec, n: number): BufferGeometry {
  const L = s.headerL(n);
  const D = s.headerD;
  const H = s.headerH;
  const w = s.wall;
  const [w0, w1, ww] = s.window;
  const front = new Shape();
  front.moveTo(-L / 2, 0);
  front.lineTo(L / 2, 0);
  front.lineTo(L / 2, H);
  front.lineTo(-L / 2, H);
  front.closePath();
  const win = new Path();
  addRoundedRect(win, ww, w1 - w0, 0.15, 0, (w0 + w1) / 2, true);
  front.holes.push(win);
  const fg = extrudeAlongZ(front, w, 0.08, { curveSegments: 3, bevelSegments: 1 });
  fg.translate(0, 0, D / 2 - w / 2);

  const nx = L / 2 - 1.6;
  const notchW = 0.9;
  const notchD = 2;
  const back = new Shape();
  back.moveTo(-L / 2, 0);
  back.lineTo(L / 2, 0);
  back.lineTo(L / 2, H);
  for (const x of [nx, -nx]) {
    back.lineTo(x + notchW / 2, H);
    back.lineTo(x + notchW / 2, H - notchD);
    back.lineTo(x - notchW / 2, H - notchD);
    back.lineTo(x - notchW / 2, H);
  }
  back.lineTo(-L / 2, H);
  back.closePath();
  const bg = extrudeAlongZ(back, w, 0.08, { curveSegments: 1, bevelSegments: 1 });
  bg.translate(0, 0, -D / 2 + w / 2);

  const parts: BufferGeometry[] = [fg, bg];
  for (const side of [-1, 1]) {
    const b = new BoxGeometry(w, H, D - 2 * w);
    b.translate(side * (L / 2 - w / 2), H / 2, 0);
    parts.push(b);
  }
  const floor = new BoxGeometry(L - 2 * w, s.floor, D - 2 * w);
  floor.translate(0, s.floor / 2, 0);
  parts.push(floor);
  return mergeAll(parts);
}

/** Plug housing: honeycomb of cavities open at the top, bottom plugs with the pin holes, lock features. */
function plugGeometry(s: Spec, n: number, family: Family): BufferGeometry {
  const L = s.plugL(n);
  const D = s.plugD;
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * s.pitch);
  const [cx, cz] = s.cavity;
  const outer = new Shape();
  addRoundedRect(outer, L, D, 0.3);
  for (const x of xs) {
    const hole = new Path();
    addRoundedRect(hole, cx, cz, 0.15, x, 0, true);
    outer.holes.push(hole);
  }
  const parts: BufferGeometry[] = [
    extrudeUp(outer, s.plugH, 0.18, { curveSegments: 3, bevelSegments: 2 }),
  ];
  const bottom = 0.45;
  for (const x of xs) {
    const plug = new Shape();
    addRoundedRect(plug, cx + 0.02, cz + 0.02, 0.15, x, 0);
    const hole = new Path();
    addRoundedRect(hole, s.pin + 0.35, s.pin + 0.35, 0.05, x, 0, true);
    plug.holes.push(hole);
    parts.push(extrudeUp(plug, bottom, 0, { curveSegments: 2 }));
  }
  if (family === 'kk') {
    // Friction ramp on the back, below the header ramp when mated.
    const z = -D / 2;
    const ramp = profile([
      [z + 0.02, 4.6],
      [z - 0.4, 5.5],
      [z - 0.4, 5.8],
      [z + 0.02, 6.0],
    ]);
    parts.push(extrudeAlongX(ramp, Math.max(L - 2.4, 2), 0.05, { bevelSegments: 1 }));
  } else {
    // Latch ramp on the front (clicks into the window) and polarising ribs behind.
    const [w0, w1, ww] = s.window;
    const y0 = w0 - s.floor + 0.1;
    const y1 = w1 - s.floor - 0.1;
    const z = D / 2;
    const ramp = profile([
      [z - 0.02, y0],
      [z + 0.45, y1 - 0.2],
      [z + 0.45, y1],
      [z - 0.02, y1],
    ]);
    parts.push(extrudeAlongX(ramp, ww - 0.4, 0.05, { bevelSegments: 1 }));
    const ribTop = s.plugH - 0.4;
    const ribBottom = s.headerH - 2 - s.floor + 0.15;
    const nx = s.headerL(n) / 2 - 1.6;
    for (const x of [-nx, nx]) {
      const rib = new BoxGeometry(0.6, ribTop - ribBottom, 0.55);
      rib.translate(x, (ribTop + ribBottom) / 2, -D / 2 - 0.27);
      parts.push(rib);
    }
  }
  return mergeAll(parts);
}

/** Stations of the crimp terminal along y, from the bottom of the plug. */
function terminalStations(s: Spec) {
  const recBottom = 0.5;
  const recTop = recBottom + s.receptacle[2];
  const c0 = recTop + (s.plugH > 9 ? 0.75 : 0.5);
  const c1 = c0 + (s.plugH > 9 ? 1.3 : 1);
  const i0 = c1 + 0.45;
  const i1 = i0 + (s.plugH > 9 ? 1.7 : 1.2);
  return { recBottom, recTop, c0, c1, i0, i1 };
}

/** Female crimp terminal: box receptacle with the spring tongue, strap, conductor and insulation crimps. */
function terminalGeometry(s: Spec): BufferGeometry {
  const [rx, rz, len] = s.receptacle;
  const t = terminalStations(s);
  const sheet = 0.15;
  const ring = new Shape();
  addRoundedRect(ring, rx, rz, 0.1);
  const inner = new Path();
  addRoundedRect(inner, rx - 2 * sheet, rz - 2 * sheet, 0.05, 0, 0, true);
  ring.holes.push(inner);
  const box = extrudeUp(ring, len, 0, { curveSegments: 2 });
  box.translate(0, t.recBottom, 0);
  // Spring tongue pressing the pin from the front.
  const tongue = new BoxGeometry(rx - 0.5, len * 0.62, 0.12);
  tongue.rotateX(0.12);
  tongue.translate(0, t.recBottom + len * 0.42, s.pin / 2 + 0.08);
  // Strap from the box to the crimps, along the back.
  const strap = new BoxGeometry(Math.min(rx, 0.9), t.c0 - t.recTop + 0.2, sheet);
  strap.translate(0, (t.recTop + t.c0) / 2, -rz / 2 + sheet / 2);
  // Conductor crimp (folded around the copper) and insulation crimp (two wings).
  const cr = s.core / 2 + 0.17;
  const conductor = new CylinderGeometry(cr, cr, t.c1 - t.c0, 14, 1, false);
  conductor.scale(1.12, 1, 0.82);
  conductor.translate(0, (t.c0 + t.c1) / 2, -0.05);
  const ir = s.wire / 2 + 0.13;
  const insulation = new CylinderGeometry(ir, ir * 1.04, t.i1 - t.i0, 16, 1, false);
  insulation.translate(0, (t.i0 + t.i1) / 2, 0);
  const seam = new BoxGeometry(0.25, t.i1 - t.i0, 0.25);
  seam.rotateY(Math.PI / 4);
  seam.translate(0, (t.i0 + t.i1) / 2, ir - 0.02);
  return mergeAll([box, tongue, strap, conductor, insulation, seam]);
}

export default function ConnectorKk(props: ConnectorKkProps) {
  const p = { ...meta.defaults, ...props } as Required<ConnectorKkProps>;
  const family = familyOf(p.family);
  const s = SPECS[family];
  const n = pinsOf(p.pins);
  const mated = p.mated !== false;
  const wires = wireColorsOf(p.wireColors, n);
  const noise = getNoiseTexture();
  const plug = useRef<Group>(null);

  const board = s.tail;
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * s.pitch);
  const L = s.headerL(n);
  const PL = s.plugL(n);
  const plugBase = board + s.floor;
  const lift = s.pinTop - s.floor + 5;
  const t = terminalStations(s);
  const route = { rise: s.plugH - t.i0 + 4, radius: 4, run: 14 };

  useSmooth(
    [mated ? 0 : 1],
    ([v]) => {
      if (plug.current) plug.current.position.y = plugBase + lift * v!;
    },
    9,
  );

  const header = useDisposable(
    () => (family === 'kk' ? kkHeaderGeometry(s, n) : shroudGeometry(s, n)),
    [family, n],
  );
  const housing = useDisposable(() => plugGeometry(s, n, family), [family, n]);
  const terminal = useDisposable(() => terminalGeometry(s), [family]);
  const core = useDisposable(() => {
    const g = new CylinderGeometry(s.core / 2, s.core / 2, t.i0 + 0.4 - (t.c0 - 0.3), 10);
    g.translate(0, (t.i0 + 0.4 + t.c0 - 0.3) / 2, -0.05);
    return g;
  }, [family]);
  const wireGeometry = useDisposable(
    () =>
      tube(new WireRoute(route.rise, route.radius, route.run), s.wire / 2, {
        radial: 14,
        segments: 72,
      }),
    [family],
  );
  const wireCore = useDisposable(
    () =>
      tube(new WireRoute(route.rise, route.radius, route.run), s.core / 2, {
        radial: 8,
        segments: 72,
      }),
    [family],
  );
  const endCore = useDisposable(() => new CircleGeometry(s.core / 2, 14), [family]);
  const endRing = useDisposable(() => new RingGeometry(s.core / 2, s.wire / 2, 16), [family]);

  const mark = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#a49c88';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.82);
      ctx.lineTo(w * 0.12, h * 0.18);
      ctx.lineTo(w * 0.88, h * 0.18);
      ctx.closePath();
      ctx.fill();
    },
    'pin1',
    { width: 64, height: 64 },
  );
  const windows = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#2a2722';
      const cell = w / n;
      for (let i = 0; i < n; i++) {
        const x = cell * i + cell * 0.22;
        ctx.beginPath();
        ctx.roundRect(x, h * 0.1, cell * 0.56, h * 0.8, cell * 0.06);
        ctx.fill();
      }
    },
    `kk-windows|${n}`,
    { width: 64 * n, height: 96 },
  );

  const nylon = {
    preset: 'nylonNatural' as const,
    roughness: 0.52,
    roughnessMap: noise,
    clip: true,
    cutColor: '#d8d0bb',
  };
  const tin = { preset: 'tin' as const, color: '#e3e6e8', roughness: 0.22 };
  const last = xs[n - 1]!;
  const wireEnd: Vec3 = [0, route.rise + route.radius, -route.radius - route.run];

  return (
    <group>
      {/* Header pins and body. */}
      {xs.map((x) => (
        <Pin
          key={x}
          x={x}
          z={0}
          bottom={0}
          top={board + s.pinTop}
          width={s.pin}
          thickness={s.pin}
          taperTop
          material={tin}
        />
      ))}
      <group position={[0, board, 0]}>
        <mesh geometry={header}>
          <Material {...nylon} />
        </mesh>
        {family === 'kk' ? (
          <Decal
            map={mark}
            width={1.1}
            height={1.1}
            position={[xs[0]!, s.headerH * 0.55, s.headerD / 2 - 0.65 + 0.012]}
            clip
          />
        ) : (
          <Decal
            map={mark}
            width={1}
            height={1}
            position={[-L / 2 + 1.2, s.headerH - 1.1, s.headerD / 2 + 0.012]}
            clip
          />
        )}
        <Anchor
          name="trava"
          position={
            family === 'kk'
              ? [L / 2 - 0.6, s.window[1] - 0.6, s.headerD / 2 - 0.65 - s.headerD + s.wall + 0.4]
              : [s.window[2] / 2 - 0.2, (s.window[0] + s.window[1]) / 2, s.headerD / 2]
          }
        />
      </group>

      {/* Plug: housing, terminals and wires. */}
      <group ref={plug} position={[0, plugBase + (mated ? 0 : lift), 0]}>
        <Explode offset={[0, 8, 0]}>
          <mesh geometry={housing}>
            <Material {...nylon} />
          </mesh>
          {family === 'kk' && (
            <Decal
              map={windows}
              width={PL - 0.2}
              height={2.4}
              position={[0, 4.1, s.plugD / 2 + 0.012]}
              roughness={0.7}
              clip
            />
          )}
          <Anchor name="carcaca" position={[PL / 2, s.plugH * 0.62, s.plugD / 2 - 0.4]} />
        </Explode>
        <Explode offset={[0, 8 + s.plugH + 2, 0]} delay={0.15}>
          {xs.map((x, i) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh geometry={terminal}>
                <Material {...tin} clip />
              </mesh>
              <mesh geometry={core}>
                <Material preset="copper" roughness={0.35} />
              </mesh>
              <group position={[0, t.i0, 0]}>
                <mesh geometry={wireGeometry}>
                  <Material
                    color={wires[i]!.color}
                    roughness={0.38}
                    clearcoat={0.25}
                    clip
                    cutColor={shade(wires[i]!.color, -0.2)}
                  />
                </mesh>
                <mesh geometry={wireCore}>
                  <Material preset="copper" roughness={0.4} />
                </mesh>
                <mesh geometry={endRing} position={wireEnd} rotation={[0, Math.PI, 0]}>
                  <Material color={wires[i]!.color} roughness={0.6} />
                </mesh>
                <mesh geometry={endCore} position={wireEnd} rotation={[0, Math.PI, 0]}>
                  <Material preset="copper" roughness={0.45} />
                </mesh>
              </group>
            </group>
          ))}
          <Anchor
            name="terminal"
            position={[
              last + s.receptacle[0] / 2,
              (t.recBottom + t.recTop) / 2,
              s.receptacle[1] / 2,
            ]}
          />
          <Anchor name="crimpagem" position={[last + s.wire / 2 + 0.1, (t.i0 + t.i1) / 2, 0.2]} />
        </Explode>
      </group>
    </group>
  );
}
