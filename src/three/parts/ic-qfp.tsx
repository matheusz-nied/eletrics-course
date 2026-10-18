/**
 * Surface-mount ICs: QFP/TQFP/LQFP (32, 44, 64 or 100 gull-wing leads,
 * 0,8 or 0,5 mm pitch) and SOIC (8, 14 or 16 leads, 1,27 mm pitch), loose or
 * soldered on a small piece of board. Dimensions from JEDEC MS-026 (TQFP
 * 7 × 7 × 1,0 mm and 10 × 10 × 1,0 mm; LQFP 10 × 10 × 1,4 mm and 14 × 14 ×
 * 1,4 mm, leads 1 mm beyond the body) and MS-012 (SOIC 3,9 mm wide, 1,45 mm
 * thick, 6,0 mm tip to tip). Inside: die on a down-set paddle, lead
 * fingers and gold bond wires.
 */
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import {
  bentStrip,
  bondWires,
  extrudeOutline,
  mergeAll,
  mergeAt,
  moldedBlock,
  placed,
  stripOutline,
  type Pt,
} from './_semi-geometry';
import { icPads, SiliconDie, usePrintedTop } from './_semi-parts';

export interface IcQfpProps {
  package?: 'qfp' | 'soic';
  /** QFP: 32, 44, 64 or 100. SOIC: 8, 14 or 16. */
  pins?: number;
  code?: string;
  dateCode?: string;
  /** Soldered on a small piece of green board. */
  onBoard?: boolean;
}

interface Spec {
  /** Body length (X) and width (Z), thickness, stand-off (mm). */
  length: number;
  width: number;
  thick: number;
  standoff: number;
  pitch: number;
  leadW: number;
  leadT: number;
  /** Lead tip beyond the body edge. */
  reach: number;
  sides: 2 | 4;
  die: [number, number];
  name: string;
}

function specOf(p: PartProps): { spec: Spec; pins: number } {
  if (p.package === 'soic') {
    const pins = [8, 14, 16].includes(Number(p.pins)) ? Number(p.pins) : 8;
    const length = pins === 8 ? 4.9 : pins === 14 ? 8.65 : 9.9;
    const die: [number, number] = pins === 8 ? [1.5, 1.2] : pins === 14 ? [1.8, 1.4] : [2.0, 1.5];
    return {
      pins,
      spec: {
        length,
        width: 3.9,
        thick: 1.45,
        standoff: 0.15,
        pitch: 1.27,
        leadW: 0.41,
        leadT: 0.2,
        reach: 1.05,
        sides: 2,
        die,
        name: `SOIC-${pins}`,
      },
    };
  }
  const pins = [32, 44, 64, 100].includes(Number(p.pins)) ? Number(p.pins) : 32;
  const table: Record<number, [number, number, number, [number, number], string]> = {
    32: [7, 0.8, 1.0, [3, 3], 'TQFP-32'],
    44: [10, 0.8, 1.0, [3.6, 3.6], 'TQFP-44'],
    64: [10, 0.5, 1.4, [4.4, 4.4], 'LQFP-64'],
    100: [14, 0.5, 1.4, [5.4, 5.4], 'LQFP-100'],
  };
  const [size, pitch, thick, die, name] = table[pins]!;
  return {
    pins,
    spec: {
      length: size,
      width: size,
      thick,
      standoff: 0.1,
      pitch,
      leadW: pitch === 0.8 ? 0.37 : 0.22,
      leadT: 0.15,
      reach: 1.0,
      sides: 4,
      die,
      name,
    },
  };
}

/** Board patch thickness, copper pad and solder heights (mm). */
const BOARD_T = 1.6;
const PAD_T = 0.035;
const SOLDER_T = 0.04;

export const meta: PartMeta = {
  id: 'ic-qfp',
  label: 'Circuito integrado SMD (QFP e SOIC)',
  category: 'semicondutores',
  summary:
    'Circuito integrado de montagem em superfície, QFP com terminais nos quatro lados ou SOIC com duas fileiras, solto ou soldado numa placa.',
  defaults: { package: 'qfp', pins: 32, code: 'ATMEGA328P', dateCode: '2318', onBoard: false },
  controls: {
    package: {
      kind: 'select',
      label: 'Encapsulamento',
      options: [
        { value: 'qfp', label: 'QFP (quatro lados)' },
        { value: 'soic', label: 'SOIC (duas fileiras)' },
      ],
    },
    pins: {
      kind: 'select',
      label: 'Terminais',
      options: [
        { value: 8, label: '8 (SOIC)' },
        { value: 14, label: '14 (SOIC)' },
        { value: 16, label: '16 (SOIC)' },
        { value: 32, label: '32 (TQFP, passo 0,8 mm)' },
        { value: 44, label: '44 (TQFP, passo 0,8 mm)' },
        { value: 64, label: '64 (LQFP, passo 0,5 mm)' },
        { value: 100, label: '100 (LQFP, passo 0,5 mm)' },
      ],
    },
    code: { kind: 'text', label: 'Código impresso', maxLength: 14 },
    dateCode: { kind: 'text', label: 'Código de data', maxLength: 6 },
    onBoard: { kind: 'toggle', label: 'Soldado na placa' },
  },
  annotations: (p) => {
    const { spec } = specOf(p);
    const base = p.onBoard ? BOARD_T + PAD_T + SOLDER_T : 0;
    const top = base + spec.standoff + spec.thick;
    const hx = spec.length / 2;
    const hz = spec.width / 2;
    const pin1: Vec3 = spec.sides === 4 ? [-hx + 0.9, top, -hz + 0.9] : [-hx + 0.7, top, hz - 0.6];
    const list = [
      { at: pin1, text: 'Marca do pino 1', exploded: false },
      {
        at: [hx + spec.reach - 0.3, base + 0.1, spec.sides === 4 ? 0 : hz * 0.4] as Vec3,
        text: 'Terminal em asa de gaivota: solda na superfície',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Chip de silício', anchor: 'die' },
      { at: [0, 0, 0] as Vec3, text: 'Fios de ouro de 25 µm', anchor: 'wires', exploded: true },
      { at: [0, 0, 0] as Vec3, text: 'Corpo de epóxi moldado', anchor: 'body', exploded: true },
    ];
    if (p.onBoard) {
      list.push({
        at: [
          -(hx + spec.reach) - 0.2,
          base - SOLDER_T,
          spec.sides === 4 ? hz * 0.3 : -hz - 0.3,
        ] as Vec3,
        text: 'Ilha de cobre com solda',
        exploded: false,
      });
    }
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const { spec, pins } = specOf(p);
    const kind =
      spec.sides === 4
        ? `${spec.name}, ${pins} terminais nos quatro lados com passo de ${String(spec.pitch).replace('.', ',')} mm`
        : `${spec.name}, duas fileiras de ${pins / 2} terminais com passo de 1,27 mm`;
    return `Circuito integrado SMD ${kind}, marcado ${String(p.code)}${p.onBoard ? ', soldado numa placa' : ''}. O pino 1 fica junto da marca redonda e a contagem segue no sentido anti-horário.`;
  },
  view: [0.5, 1.15, 1.25],
};

/** Outward normal angle (rotation about Y) of each side, in pin order. */
const SIDE_ANGLES: Record<2 | 4, number[]> = {
  4: [Math.PI, -Math.PI / 2, 0, Math.PI / 2],
  2: [-Math.PI / 2, Math.PI / 2],
};

interface PinPlace {
  /** Outward rotation, half-size of the body on that side, offset along the side. */
  angle: number;
  half: number;
  along: number;
}

function pinPlaces(spec: Spec, pins: number): PinPlace[] {
  const perSide = pins / spec.sides;
  const out: PinPlace[] = [];
  SIDE_ANGLES[spec.sides].forEach((angle) => {
    const facesX = Math.abs(Math.cos(angle)) > 0.5;
    const half = facesX ? spec.length / 2 : spec.width / 2;
    for (let j = 0; j < perSide; j++) {
      out.push({ angle, half, along: (j - (perSide - 1) / 2) * spec.pitch });
    }
  });
  return out;
}

/** Point at `out` from the centre along the side's normal and `along` its tangent. */
function sidePoint(angle: number, out: number, along: number): [number, number] {
  const nx = Math.cos(angle);
  const nz = -Math.sin(angle);
  const tx = -Math.sin(angle);
  const tz = -Math.cos(angle);
  return [nx * out + tx * along, nz * out + tz * along];
}

export default function IcQfp(props: IcQfpProps) {
  const p = { ...meta.defaults, ...props } as Required<IcQfpProps>;
  const { spec, pins } = specOf(p);
  const places = pinPlaces(spec, pins);
  const base = p.onBoard ? BOARD_T + PAD_T + SOLDER_T : 0;
  const bodyY = spec.standoff;
  const leadY = bodyY + spec.thick / 2; // lead frame plane
  const quad = spec.sides === 4;

  const body = useDisposable(
    () =>
      moldedBlock({
        width: spec.length,
        depth: spec.width,
        height: spec.thick,
        corner: quad ? 0.35 : 0.15,
        fillet: 0.12,
        bottomFillet: 0.08,
        draft: 0.09,
        parting: spec.thick / 2,
        chamferFront: quad ? 0 : 0.3,
      }),
    [spec],
  );

  // Gull-wing lead, drawn for the +X side: out of the body, down, the foot.
  const leads = useDisposable(() => {
    const t = spec.leadT;
    const one = bentStrip(
      [
        [-0.25, leadY],
        [0.22, leadY],
        [0.48, t / 2],
        [spec.reach, t / 2],
      ],
      t,
      spec.leadW,
      0.22,
    );
    const matrices = places.map((pl) => {
      const [x, z] = sidePoint(pl.angle, pl.half, pl.along);
      return placed([x, 0, z], [0, pl.angle, 0]);
    });
    const all = mergeAt(one, matrices);
    one.dispose();
    return all;
  }, [spec, pins]);

  // Inner lead fingers converging on the die, and the down-set paddle.
  const [dieW, dieD] = spec.die;
  const paddleHalf: [number, number] = [dieW / 2 + 0.25, dieD / 2 + 0.25];
  const tips = places.map((pl) => {
    const facesX = Math.abs(Math.cos(pl.angle)) > 0.5;
    const ringOut = (facesX ? paddleHalf[0] : paddleHalf[1]) + 0.35;
    const ringAlong = (facesX ? paddleHalf[1] : paddleHalf[0]) + 0.2;
    const k = pl.along / Math.max(quad ? pl.half : pl.half * 1.15, 1);
    return sidePoint(pl.angle, ringOut, k * ringAlong);
  });
  const frame = useDisposable(() => {
    const parts = places.map((pl, i) => {
      const start = sidePoint(pl.angle, pl.half - 0.2, pl.along);
      const outline = stripOutline([start, tips[i]!] as Pt[], [
        spec.leadW,
        Math.min(spec.leadW * 0.7, 0.22),
      ]);
      const g = extrudeOutline(outline, spec.leadT);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const merged = mergeAll(parts);
    merged.translate(0, leadY, 0);
    return merged;
  }, [spec, pins]);

  const downset = Math.min(0.2, spec.thick * 0.15);
  const paddleY = leadY - downset;
  const dieY = paddleY + spec.leadT / 2 + 0.02;
  const dieT = Math.min(0.25, spec.thick * 0.22);
  const dieTop = dieY + dieT;
  const padInset = Math.min(dieW, dieD) * 0.1;
  const padStart = quad ? 0 : (dieD - 2 * padInset) / 2 / (2 * (dieW + dieD - 4 * padInset));
  const pads = icPads(dieW, dieD, pins, padStart);
  const wires = useDisposable(
    () =>
      bondWires(
        pads.map(([x, z], i) => ({
          from: [x, dieTop, z] as Vec3,
          to: [tips[i]![0], leadY + spec.leadT / 2, tips[i]![1]] as Vec3,
          loop: Math.min(0.22, spec.thick * 0.16),
        })),
        0.02,
        [0, 1, 0],
        { radial: 5, segments: pins > 50 ? 14 : 20 },
      ),
    [pads, tips, dieTop, leadY],
  );

  // Marking: the top cap's canvas is the parting-line footprint.
  const marking = usePrintedTop({
    width: spec.length,
    height: spec.width,
    lines: quad
      ? [
          { text: p.code, size: spec.length * 0.085, weight: 600 },
          { text: p.dateCode, size: spec.length * 0.065, mono: true },
          { text: 'TWN', size: spec.length * 0.05, mono: true },
        ]
      : [
          { text: p.code, size: 0.62, weight: 600 },
          { text: p.dateCode, size: 0.5, mono: true },
        ],
    dimple: quad
      ? { x: 1.0 + spec.length * 0.02, y: 1.0 + spec.width * 0.02, d: spec.length > 8 ? 1.0 : 0.8 }
      : { x: 0.8, y: spec.width - 0.75, d: 0.55 },
    ejectors: quad
      ? [{ x: spec.length - 1.6, y: spec.width - 1.6, d: spec.length > 8 ? 1.6 : 1.1 }]
      : [],
    offset: quad ? [0, 0] : [0.2, -0.15],
  });
  const noise = getNoiseTexture();

  const chip = (
    <group>
      <Explode offset={[0, spec.thick * 2.5 + 2.5, 0]}>
        <mesh geometry={body} position={[0, bodyY, 0]}>
          <Material
            attach="material-0"
            preset="epoxyBlack"
            clip
            roughnessMap={noise}
            roughness={0.6}
            color="#1b1b1d"
            cutColor="#2a2a2c"
          />
          <Material
            attach="material-1"
            preset="epoxyBlack"
            clip
            color="#ffffff"
            map={marking.map}
            roughness={1}
            roughnessMap={marking.roughnessMap}
            bumpMap={marking.bumpMap}
            bumpScale={0.8}
            specularIntensity={0.55}
            cutColor="#2a2a2c"
          />
        </mesh>
        <Anchor
          name="body"
          position={[spec.length * 0.35, bodyY + spec.thick, -spec.width * 0.3]}
        />
      </Explode>
      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.38} />
      </mesh>
      <mesh geometry={frame}>
        <Material preset="copper" color="#c98a64" roughness={0.35} />
      </mesh>
      <mesh position={[0, paddleY, 0]}>
        <boxGeometry args={[paddleHalf[0] * 2, spec.leadT, paddleHalf[1] * 2]} />
        <Material preset="copper" color="#c98a64" roughness={0.35} />
      </mesh>
      <SiliconDie
        size={[dieW, dieD]}
        thickness={dieT}
        kind="ic"
        pads={pins}
        padStart={padStart}
        seed={pins * 7 + p.code.length}
        position={[0, dieY, 0]}
      />
      <Anchor name="die" position={[0, dieTop, 0]} />
      <mesh geometry={wires}>
        <Material preset="gold" />
      </mesh>
      <Anchor
        name="wires"
        position={[
          (pads[pins - 1]![0] + tips[pins - 1]![0]) / 2,
          dieTop + 0.2,
          (pads[pins - 1]![1] + tips[pins - 1]![1]) / 2,
        ]}
      />
    </group>
  );

  if (!p.onBoard) return chip;
  return (
    <group>
      <Explode offset={[0, -2.5, 0]}>
        <BoardPatch spec={spec} pins={pins} places={places} />
      </Explode>
      <Explode offset={[0, 2.5, 0]}>
        <group position={[0, base, 0]}>{chip}</group>
      </Explode>
    </group>
  );
}

/** Piece of FR-4 with solder mask, silkscreen, tinned pads and solder fillets. */
function BoardPatch({ spec, pins, places }: { spec: Spec; pins: number; places: PinPlace[] }) {
  const margin = 2;
  const bw = spec.length + 2 * (spec.reach + margin);
  const bd = spec.width + 2 * (spec.reach + margin);
  const quad = spec.sides === 4;
  const board = useDisposable(
    () =>
      moldedBlock({
        width: bw,
        depth: bd,
        height: BOARD_T,
        corner: 0.4,
        fillet: 0.05,
        bottomFillet: 0.05,
        draft: 0,
      }),
    [bw, bd],
  );
  const k = Math.min(1024 / bw, 1024 / bd);
  const silk = useCanvasTexture(
    (ctx, cw, ch) => {
      ctx.fillStyle = '#1d6b3f';
      ctx.fillRect(0, 0, cw, ch);
      // Silkscreen outline with a gap around the leads and the pin-1 dot.
      ctx.strokeStyle = '#f2f2ec';
      ctx.fillStyle = '#f2f2ec';
      ctx.lineWidth = 0.15 * k;
      const x0 = (bw / 2 - spec.length / 2 - spec.reach - 0.5) * k;
      const z0 = (bd / 2 - spec.width / 2 - spec.reach - 0.5) * k;
      const x1 = cw - x0;
      const z1 = ch - z0;
      const c = 0.8 * k;
      ctx.beginPath();
      if (quad) {
        for (const [ax, az, bx, bz] of [
          [x0, z0, x0 + c, z0],
          [x0, z0, x0, z0 + c],
          [x1, z0, x1 - c, z0],
          [x1, z0, x1, z0 + c],
          [x0, z1, x0 + c, z1],
          [x0, z1, x0, z1 - c],
          [x1, z1, x1 - c, z1],
          [x1, z1, x1, z1 - c],
        ] as const) {
          ctx.moveTo(ax, az);
          ctx.lineTo(bx, bz);
        }
      } else {
        // Lines along the ends of the body, between the pad rows.
        const ex = (spec.length / 2 + 0.25) * k;
        const ez = (spec.width / 2 - 0.25) * k;
        for (const sx of [-1, 1]) {
          ctx.moveTo(cw / 2 + sx * ex, ch / 2 - ez);
          ctx.lineTo(cw / 2 + sx * ex, ch / 2 + ez);
        }
      }
      ctx.stroke();
      const dot = quad
        ? [x0 - 0.5 * k, z0 + 0.6 * k]
        : [cw / 2 - (spec.length / 2 + 0.7) * k, ch / 2 + (spec.width / 2 + spec.reach + 0.1) * k];
      ctx.beginPath();
      ctx.arc(dot[0]!, dot[1]!, 0.35 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `600 ${1.1 * k}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      if (quad) ctx.fillText('U1', x1 + 0.2 * k, z0 - 0.2 * k);
      else
        ctx.fillText(
          'U1',
          cw / 2 + (spec.length / 2 + 0.5) * k,
          ch / 2 - (spec.width / 2 + spec.reach + 0.3) * k,
        );
    },
    `${bw}|${bd}|${quad}`,
    { width: Math.round(bw * k), height: Math.round(bd * k) },
  );

  // Pad (land) and its solder fillet, drawn for the +X side.
  const padLen = spec.reach + 0.6;
  const padW = spec.leadW + (spec.pitch >= 0.8 ? 0.15 : 0.08);
  const matrices = places.map((pl) => {
    const [x, z] = sidePoint(pl.angle, pl.half, pl.along);
    return placed([x, 0, z], [0, pl.angle, 0]);
  });
  const padGeometry = useDisposable(() => {
    const pad = extrudeOutline(
      [
        [-padLen / 2, -padW / 2],
        [padLen / 2, -padW / 2],
        [padLen / 2, padW / 2],
        [-padLen / 2, padW / 2],
      ],
      PAD_T,
    );
    pad.rotateX(Math.PI / 2);
    pad.translate(spec.reach - padLen / 2 + 0.3, BOARD_T + PAD_T / 2, 0);
    const all = mergeAt(pad, matrices);
    pad.dispose();
    return all;
  }, [spec, pins]);
  const solderGeometry = useDisposable(() => {
    // Fillet profile: wetted heel up the bend, thin under the foot, toe meniscus.
    const t = spec.leadT;
    const y0 = BOARD_T + PAD_T;
    const heel = 0.44;
    const toe = spec.reach + 0.22;
    const profile: Pt[] = [[heel - 0.32, y0]];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      profile.push([
        heel - 0.32 * Math.cos(a) + 0.02,
        y0 + SOLDER_T + (t + 0.12) * (1 - Math.cos(a)) * 0.9,
      ]);
    }
    profile.push([spec.reach - 0.05, y0 + SOLDER_T + t * 0.55]);
    for (let i = 1; i <= 5; i++) {
      const a = (i / 5) * (Math.PI / 2);
      profile.push([
        spec.reach - 0.05 + (toe - spec.reach + 0.05) * Math.sin(a),
        y0 + (SOLDER_T + t * 0.55) * Math.cos(a),
      ]);
    }
    const solder = extrudeOutline(profile, spec.leadW + 0.04);
    const all = mergeAt(solder, matrices);
    solder.dispose();
    return all;
  }, [spec, pins]);

  return (
    <group>
      <mesh geometry={board}>
        <Material attach="material-0" preset="fr4" clip />
        <Material
          attach="material-1"
          preset="solderMask"
          color="#ffffff"
          map={silk}
          clip
          cutColor="#8f8458"
        />
      </mesh>
      <mesh geometry={padGeometry}>
        <Material preset="tin" roughness={0.25} />
      </mesh>
      <mesh geometry={solderGeometry}>
        <Material preset="solder" />
      </mesh>
    </group>
  );
}
