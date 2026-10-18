/**
 * Straight male pin header, 2,54 mm pitch, 1 × N or 2 × N, with the black
 * plastic spacer and gold or tin pins, plus the removable jumper (shunt)
 * that shorts two adjacent pins. Dimensions from typical datasheets (Samtec
 * TSW, Harwin M20 / M7566 shunt): pins 0,64 mm square, 6 mm above the 2,5 mm
 * spacer and 3 mm below it; shunt 5,0 × 2,5 × 6,0 mm with two spring
 * contacts. On a 1 × N header the jumper spans pins `jumperAt` and
 * `jumperAt + 1`; on a 2 × N header it spans the two rows at column
 * `jumperAt`.
 */
import { Shape, type BufferGeometry } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import { addRoundedRect, extrudeUp, mergeAll } from './_em-geometry';
import { Pin } from './_em-kit';

export interface PinHeaderProps {
  /** Rows: 1 or 2. */
  rows?: number;
  /** Pins per row (2 to 20). */
  pins?: number;
  /** Jumper position (0-based), or −1 without a jumper. */
  jumperAt?: number;
  jumperColor?: 'preto' | 'vermelho' | 'azul' | 'amarelo';
  /** Jumper with an open top (pin tips visible) or closed. */
  jumperTop?: 'aberto' | 'fechado';
  plated?: 'ouro' | 'estanho';
}

export const PITCH = 2.54;
const PIN = 0.64;
const TAIL = 3;
const SPACER = 2.5;
const MATE = 6;
/** Height of the spacer bottom above the pin tips (for scenes that seat it on a board). */
export const PIN_HEADER_SEAT = TAIL;
const SHUNT = { L: 5, W: 2.5, H: 6, hole: 1.02 };

const JUMPER_COLORS = {
  preto: { color: '#1b1b1d', cut: '#0c0c0d', label: 'preto' },
  vermelho: { color: '#c3221b', cut: '#7e150f', label: 'vermelho' },
  azul: { color: '#1f53c2', cut: '#143683', label: 'azul' },
  amarelo: { color: '#f0b619', cut: '#a77c0e', label: 'amarelo' },
};

export const meta: PartMeta = {
  id: 'pin-header',
  label: 'Barra de pinos e jumper',
  category: 'conexoes',
  summary:
    'Barra de pinos de 2,54 mm (1 ou 2 fileiras) com o jumper removível que liga dois pinos vizinhos.',
  defaults: {
    rows: 1,
    pins: 3,
    jumperAt: 0,
    jumperColor: 'preto',
    jumperTop: 'aberto',
    plated: 'ouro',
  },
  controls: {
    rows: {
      kind: 'select',
      label: 'Fileiras',
      options: [
        { value: 1, label: '1 fileira' },
        { value: 2, label: '2 fileiras' },
      ],
    },
    pins: { kind: 'number', label: 'Pinos por fileira', min: 2, max: 20, step: 1 },
    jumperAt: { kind: 'number', label: 'Posição do jumper (−1 = sem)', min: -1, max: 19, step: 1 },
    jumperColor: {
      kind: 'select',
      label: 'Cor do jumper',
      options: (Object.keys(JUMPER_COLORS) as (keyof typeof JUMPER_COLORS)[]).map((c) => ({
        value: c,
        label: JUMPER_COLORS[c].label[0]!.toUpperCase() + JUMPER_COLORS[c].label.slice(1),
      })),
    },
    jumperTop: {
      kind: 'select',
      label: 'Topo do jumper',
      options: [
        { value: 'aberto', label: 'Aberto' },
        { value: 'fechado', label: 'Fechado' },
      ],
    },
    plated: {
      kind: 'select',
      label: 'Banho dos pinos',
      options: [
        { value: 'ouro', label: 'Ouro' },
        { value: 'estanho', label: 'Estanho' },
      ],
    },
  },
  annotations: (p) => {
    const g = layout(p);
    const list: PartAnnotation[] = [
      {
        at: [g.xs[g.xs.length - 1]!, TAIL + SPACER + MATE * 0.6, g.zs[0]!] as Vec3,
        text: 'Pino quadrado de 0,64 mm, passo de 2,54 mm',
        exploded: false,
      },
      {
        at: [g.xs[g.xs.length - 1]! + PITCH / 2, TAIL + SPACER / 2, 0] as Vec3,
        text: 'Espaçador plástico',
      },
    ];
    if (g.jumper)
      list.push(
        {
          at: [0, 0, 0] as Vec3,
          text: 'Jumper: liga os dois pinos que ele cobre',
          anchor: 'jumper',
        },
        { at: [0, 0, 0] as Vec3, text: 'Contato de mola dentro do jumper', anchor: 'mola' },
      );
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const g = layout(p);
    const plating = p.plated === 'estanho' ? 'estanhados' : 'dourados';
    const base = `Barra de pinos ${g.rows} × ${g.pins}, passo de 2,54 mm, pinos ${plating}`;
    if (!g.jumper) return `${base}, sem jumper.`;
    const color = JUMPER_COLORS[jumperColorOf(p.jumperColor)].label;
    const where =
      g.rows === 2
        ? `na coluna ${g.jumper.index + 1}, ligando as duas fileiras`
        : `nos pinos ${g.jumper.index + 1} e ${g.jumper.index + 2}`;
    return `${base}, com um jumper ${color} ${where}.`;
  },
  view: [0.6, 0.9, 1.45],
};

function jumperColorOf(v: unknown): keyof typeof JUMPER_COLORS {
  return v === 'vermelho' || v === 'azul' || v === 'amarelo' ? v : 'preto';
}

interface Layout {
  rows: number;
  pins: number;
  xs: number[];
  zs: number[];
  jumper: { index: number; x: number; z: number; alongX: boolean } | null;
}

function layout(p: Record<string, unknown>): Layout {
  const rows = Number(p.rows) === 2 ? 2 : 1;
  const pins = Math.min(Math.max(Math.round(Number(p.pins) || 3), 2), 20);
  const xs = Array.from({ length: pins }, (_, i) => (i - (pins - 1) / 2) * PITCH);
  const zs = rows === 2 ? [PITCH / 2, -PITCH / 2] : [0];
  const at = Math.round(Number(p.jumperAt));
  let jumper: Layout['jumper'] = null;
  if (Number.isFinite(at) && at >= 0) {
    if (rows === 2 && at < pins) jumper = { index: at, x: xs[at]!, z: 0, alongX: false };
    if (rows === 1 && at < pins - 1)
      jumper = { index: at, x: (xs[at]! + xs[at + 1]!) / 2, z: 0, alongX: true };
  }
  return { rows, pins, xs, zs, jumper };
}

export default function PinHeader(props: PinHeaderProps) {
  const p = { ...meta.defaults, ...props } as Required<PinHeaderProps>;
  const g = layout(p);
  const gold = p.plated !== 'estanho';
  const jc = JUMPER_COLORS[jumperColorOf(p.jumperColor)];
  const noise = getNoiseTexture();
  const pinMaterial = gold
    ? { preset: 'gold' as const, roughness: 0.2 }
    : { preset: 'tin' as const, roughness: 0.26 };

  // Spacer: one chamfered square cell per pin, so the V notches between pins
  // (where the strip is broken to length) come out naturally.
  const spacer = useDisposable(() => {
    const cells: BufferGeometry[] = [];
    const c = 0.2;
    const h = PITCH / 2;
    for (const x of g.xs) {
      for (const z of g.zs) {
        const shape = new Shape();
        shape.moveTo(-h + c, -h);
        shape.lineTo(h - c, -h);
        shape.lineTo(h, -h + c);
        shape.lineTo(h, h - c);
        shape.lineTo(h - c, h);
        shape.lineTo(-h + c, h);
        shape.lineTo(-h, h - c);
        shape.lineTo(-h, -h + c);
        shape.closePath();
        const hole = new Shape();
        addRoundedRect(hole, PIN + 0.02, PIN + 0.02, 0.02, 0, 0, true);
        shape.holes.push(hole);
        const cell = extrudeUp(shape, SPACER, 0.1, { curveSegments: 1, bevelSegments: 2 });
        cell.translate(x, TAIL, z);
        cells.push(cell);
      }
    }
    return mergeAll(cells);
  }, [g.xs, g.zs]);

  return (
    <group>
      <mesh geometry={spacer}>
        <Material preset="pbtBlack" roughness={0.62} roughnessMap={noise} clip cutColor="#0d0d0e" />
      </mesh>
      {g.xs.map((x) =>
        g.zs.map((z) => (
          <Pin
            key={`${x}|${z}`}
            x={x}
            z={z}
            bottom={0}
            top={TAIL + SPACER + MATE}
            width={PIN}
            thickness={PIN}
            tip={0.35}
            taperTop
            material={pinMaterial}
          />
        )),
      )}
      {g.jumper && (
        <Explode offset={[0, 10, 0]}>
          <group
            position={[g.jumper.x, TAIL + SPACER, g.jumper.z]}
            rotation={[0, g.jumper.alongX ? 0 : Math.PI / 2, 0]}
          >
            <Shunt color={jc.color} cut={jc.cut} open={p.jumperTop !== 'fechado'} />
          </group>
        </Explode>
      )}
    </group>
  );
}

/** Two-position shunt, along its local X, sitting on y = 0. */
function Shunt({ color, cut, open }: { color: string; cut: string; open: boolean }) {
  const half = PITCH / 2;
  const body = useDisposable(() => {
    const shape = new Shape();
    addRoundedRect(shape, SHUNT.L, SHUNT.W, 0.35);
    for (const side of [-1, 1]) {
      const hole = new Shape();
      addRoundedRect(hole, SHUNT.hole, SHUNT.hole, 0.08, side * half, 0, true);
      shape.holes.push(hole);
    }
    const g = extrudeUp(shape, SHUNT.H, 0.22, { curveSegments: 4 });
    // Grip ribs on the long sides.
    const ribs: BufferGeometry[] = [g];
    for (const side of [-1, 1]) {
      for (const x of [-1.2, 0, 1.2]) {
        const rib = new Shape();
        addRoundedRect(rib, 0.4, 0.3, 0.08);
        const r = extrudeUp(rib, SHUNT.H * 0.55, 0.08, { curveSegments: 2, bevelSegments: 1 });
        r.translate(x, SHUNT.H * 0.38, side * (SHUNT.W / 2 + 0.05));
        ribs.push(r);
      }
    }
    return mergeAll(ribs);
  }, []);

  // Phosphor-bronze contact: a bridge over both pins and two pairs of springs.
  const contact = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const add = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const s = new Shape();
      addRoundedRect(s, sx, sz, 0.03);
      const box = extrudeUp(s, sy, 0.02, { curveSegments: 1, bevelSegments: 1 });
      box.translate(x, y, z);
      parts.push(box);
    };
    const top = SHUNT.H - (open ? 1.6 : 0.9);
    add(PITCH + SHUNT.hole + 0.3, 0.18, 1.5, 0, top, 0);
    for (const side of [-1, 1]) {
      for (const face of [-1, 1]) {
        // Spring leaf pressing on the pin from each side.
        add(0.9, top - 0.6, 0.12, side * half, 0.6, face * (PIN / 2 + 0.07));
      }
      add(SHUNT.hole + 0.2, 0.18, 0.75, side * half, top - 0.25, 0);
    }
    return mergeAll(parts);
  }, [open]);

  return (
    <group>
      <mesh geometry={body}>
        <Material color={color} roughness={0.5} clip cutColor={cut} />
      </mesh>
      {!open &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[side * half, SHUNT.H - 0.45, 0]}>
            <boxGeometry args={[SHUNT.hole + 0.02, 0.6, SHUNT.hole + 0.02]} />
            <Material color={color} roughness={0.55} clip cutColor={cut} />
          </mesh>
        ))}
      <mesh geometry={contact}>
        <Material preset="gold" color="#e7c178" roughness={0.3} />
      </mesh>
      <Anchor name="jumper" position={[0, SHUNT.H, SHUNT.W / 2]} />
      <Anchor name="mola" position={[half, SHUNT.H * 0.45, 0]} />
    </group>
  );
}
