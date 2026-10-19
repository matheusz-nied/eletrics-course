/**
 * Hybrid stepper motor, NEMA 17 frame (NEMA ICS 16 and catalogue drawings
 * of 17HS-type motors): 42,3 mm square flange with chamfered corners, body
 * 34, 40, 48 or 60 mm long, Ø 22 × 2 mm pilot boss, four M3 holes on a
 * 31 mm square, Ø 5 mm shaft 24 mm out of the mounting face with a 0,5 mm
 * D flat on its last 15 mm. Black aluminium end caps (8 to 9 mm) with the
 * laminated stator stack between them; four flying leads (A+ black,
 * A− green, B+ red, B− blue, the most common colour code) or a 6-way
 * 2,0 mm connector on the rear cap.
 * Inside: a stator with 8 poles, 6 teeth each (7,2° pitch), wound as two
 * phases (A on the even poles, B on the odd ones, alternating polarity),
 * and a rotor of two toothed cups with 50 teeth each, offset by half a
 * tooth, with an axially magnetised ring magnet between them; two 625
 * bearings (5 × 16 × 5 mm). With phase A on, the teeth of the N cup line
 * up with the S poles and those of the S cup with the N poles; each
 * full step of the sequence A+, B+, A−, B− turns the rotor 1,8°.
 * Exploded view: front cap, rotor (cups apart from the magnet) and stator
 * lifted off the rear cap. Cutaway: a cut across the N cup, showing the
 * eight poles, the coils and the rotor teeth, with the energised poles in
 * red (N) and blue (S).
 */
import { useRef } from 'react';
import { Path, Shape, type BufferGeometry, type Group } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { fitText, FONT_SANS, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { Decal } from './_em-kit';
import {
  arc,
  chamferedSquare,
  circle,
  creased,
  deg,
  extrudeY,
  polar,
  polygon,
  teethOutline,
  toothCoil,
  type Pt,
} from './_motor-geometry';
import {
  lathe,
  Lead,
  merge,
  scaleUv,
  useFollow,
  useGeometrySet,
  useLaminationTexture,
  useTurnsTexture,
} from './_power-shared';

type Phase = 'nenhuma' | 'A' | 'B' | 'A-' | 'B-' | 'auto';
type LeadKind = 'fios' | 'conector';

export interface StepperMotorProps {
  /** Rotor position in full steps (1,8° each); halves are half steps. */
  position?: number;
  /** Phase with current: one of them, none, or the one the position calls for. */
  energized?: Phase;
  /** Body length (mm): 34, 40, 48 or 60. */
  length?: number;
  /** Four flying leads or a 6-way connector on the rear cap. */
  lead?: LeadKind;
}

/** Flange (mm). */
const W = 42.3;
const H = W / 2;
const CHAMFER = 4.6;
const HOLES = 31;
const PILOT = 22;
const PILOT_H = 2;
const SHAFT_R = 2.5;
const SHAFT_OUT = 24;
const FLAT_LEN = 15;
const FLAT_DEPTH = 0.5;
/** Stator bore and rotor (mm). */
const BORE = 11.05;
const SLOT = 0.5;
const ROTOR_R = 10.95;
const ROTOR_TOOTH = 0.55;
const ROTOR_TEETH = 50;
const STEP = 1.8;
const PITCH = 360 / ROTOR_TEETH;
/** Pole: half span of the shoe, shoe tip radius, stem half width, depth of the slots. */
const SHOE = 19.8;
const SHOE_R = 12.7;
const STEM = 2.3;
const YOKE_R = 16.8;
const MAGNET_H = 2.6;
/** Hollow of the end caps, around the coil ends. */
const CAVITY = 18.3;
/** The stack stands a hair above the rear cap, so its cut face never fights the cap's top. */
const SEAT = 0.12;
const BEARING = { r: 8, rIn: 2.5, w: 5 };

const LENGTHS = [34, 40, 48, 60] as const;
/** Holding torque typical of each length (N·m). */
const TORQUE: Record<number, number> = { 34: 0.28, 40: 0.42, 48: 0.55, 60: 0.65 };

const N_COLOR = '#d4473d';
const S_COLOR = '#3b6fd4';
const WIRES = [
  { color: '#1b1b1d', name: 'preto' },
  { color: '#2f8f3a', name: 'verde' },
  { color: '#c62a22', name: 'vermelho' },
  { color: '#2357c4', name: 'azul' },
];

function lengthOf(p: PartProps): number {
  const v = Number(p.length);
  return (LENGTHS as readonly number[]).includes(v) ? v : 40;
}

/** Heights of the stack: rear cap 0..cap, stator cap..cap + S, front cap up to L. */
function layout(p: PartProps) {
  const L = lengthOf(p);
  const cap = L < 38 ? 8 : 9;
  const S = L - 2 * cap;
  const y0 = cap;
  const y1 = cap + S;
  const rotorLen = S - 0.6;
  const cup = (rotorLen - MAGNET_H) / 2;
  const sCup: [number, number] = [y0 + 0.3, y0 + 0.3 + cup];
  const nCup: [number, number] = [y1 - 0.3 - cup, y1 - 0.3];
  const magnet: [number, number] = [sCup[1], nCup[0]];
  return { L, cap, S, y0, y1, cup, sCup, nCup, magnet, yCut: (nCup[0] + nCup[1]) / 2 };
}

/** Currents of the two phases (−1, 0, 1) for a position in full steps. */
function currents(p: PartProps): { a: number; b: number } {
  const e = String(p.energized) as Phase;
  if (e === 'A') return { a: 1, b: 0 };
  if (e === 'A-') return { a: -1, b: 0 };
  if (e === 'B') return { a: 0, b: 1 };
  if (e === 'B-') return { a: 0, b: -1 };
  if (e === 'nenhuma') return { a: 0, b: 0 };
  // Full steps: A+, B+, A−, B−; half steps add the next phase.
  const seq = [
    { a: 1, b: 0 },
    { a: 0, b: 1 },
    { a: -1, b: 0 },
    { a: 0, b: -1 },
  ];
  const half = Math.round((Number(p.position) || 0) * 2);
  const s = (((half % 8) + 8) % 8) / 2;
  if (Number.isInteger(s)) return seq[s]!;
  const lo = seq[Math.floor(s)]!;
  const hi = seq[(Math.floor(s) + 1) % 4]!;
  return { a: lo.a + hi.a, b: lo.b + hi.b };
}

/** Polarity of pole k (0..7): +1 north, −1 south, 0 off. */
function polarity(k: number, { a, b }: { a: number; b: number }): number {
  if (k % 2 === 0) return a * (k % 4 === 0 ? 1 : -1);
  return b * (k % 4 === 1 ? 1 : -1);
}

function phaseText({ a, b }: { a: number; b: number }): string {
  const name = (ph: string, i: number) => (i > 0 ? `${ph}+` : `${ph}−`);
  const on = [a ? name('A', a) : '', b ? name('B', b) : ''].filter(Boolean);
  if (on.length === 0) return 'sem corrente nas bobinas (o ímã ainda segura o rotor de leve)';
  if (on.length === 2) return `fases ${on[0]} e ${on[1]} ligadas juntas (meio passo)`;
  return `fase ${on[0]} ligada`;
}

const leadOf = (p: PartProps): LeadKind => (p.lead === 'conector' ? 'conector' : 'fios');

/** World (x, z) of a polar point (rotation.y convention). */
const xz = (r: number, a: number): [number, number] => [r * Math.cos(a), -r * Math.sin(a)];

/** Angle of the side the default camera looks at (for anchors). */
const FRONT = deg(-50);

export const meta: PartMeta = {
  id: 'stepper-motor',
  label: 'Motor de passo',
  category: 'saidas',
  summary:
    'Motor de passo híbrido NEMA 17 (flange de 42,3 mm): estator com 8 polos dentados, duas bobinas e rotor de 50 dentes com ímã; anda 1,8° por passo.',
  defaults: { position: 0, energized: 'auto', length: 40, lead: 'fios' },
  controls: {
    position: {
      kind: 'number',
      label: 'Posição do rotor',
      min: 0,
      max: 200,
      step: 0.5,
      unit: 'passos',
    },
    energized: {
      kind: 'select',
      label: 'Bobina ligada',
      options: [
        { value: 'auto', label: 'Conforme a posição (sequência A+, B+, A−, B−)' },
        { value: 'A', label: 'Fase A (A+)' },
        { value: 'B', label: 'Fase B (B+)' },
        { value: 'A-', label: 'Fase A invertida (A−)' },
        { value: 'B-', label: 'Fase B invertida (B−)' },
        { value: 'nenhuma', label: 'Nenhuma' },
      ],
    },
    length: {
      kind: 'select',
      label: 'Comprimento do corpo',
      options: LENGTHS.map((l) => ({
        value: l,
        label: `${l} mm (≈ ${formatNumber(TORQUE[l]!)} N·m)`,
      })),
    },
    lead: {
      kind: 'select',
      label: 'Ligação',
      options: [
        { value: 'fios', label: '4 fios soltos' },
        { value: 'conector', label: 'Conector de 6 vias' },
      ],
    },
  },
  annotations: (p) => {
    const { L, cap, y0, S } = layout(p);
    const list: PartAnnotation[] = [
      {
        at: [0, L + SHAFT_OUT - FLAT_LEN / 2, 0],
        text: 'Eixo de 5 mm com face plana: o parafuso da polia aperta nela',
        exploded: false,
      },
      {
        at: [HOLES / 2, L, HOLES / 2],
        text: 'Guia de 22 mm e 4 furos M3 a 31 mm (padrão NEMA 17)',
        exploded: false,
      },
      {
        at: [-H * 0.45, y0 + S * 0.5, H],
        text: 'Estator: pacote de chapas com 8 polos dentados por dentro',
        exploded: false,
      },
      {
        at: leadOf(p) === 'conector' ? [0, cap / 2, H + 0.6] : [3.5, 0.7, H + 20],
        text:
          leadOf(p) === 'conector'
            ? 'Conector de 6 vias: só 4 são usadas, 2 por bobina'
            : '4 fios, duas bobinas: A (preto e verde) e B (vermelho e azul)',
      },
      {
        at: [0, 0, 0],
        text: 'Estator com 8 polos dentados (6 dentes cada)',
        anchor: 'stator',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Bobinas das fases A e B, em polos alternados',
        anchor: 'coil',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Rotor: dois copos de 50 dentes, defasados de meio dente',
        anchor: 'rotor',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Ímã permanente entre os copos: um copo é N, o outro S',
        anchor: 'magnet',
        exploded: true,
      },
      { at: [0, 0, 0], text: 'Rolamentos do eixo', anchor: 'bearing', exploded: true },
    ];
    return list;
  },
  explode: true,
  cutaway: true,
  cut: (p) => ({ normal: [0, -1, 0], through: [0, layout(p).yCut, 0] }),
  describe: (p) => {
    const L = lengthOf(p);
    const pos = Number(p.position) || 0;
    const angle = pos * STEP;
    const lead =
      leadOf(p) === 'conector'
        ? 'conector de 6 vias na tampa traseira (4 vias usadas)'
        : 'quatro fios: fase A preto e verde, fase B vermelho e azul';
    return `Motor de passo híbrido NEMA 17 com corpo de ${L} mm (flange de 42,3 mm, guia de 22 mm, furos M3 a 31 mm, eixo de 5 mm com face plana), torque de retenção típico de ${formatNumber(TORQUE[L]!)} N·m e ${lead}. Dentro, o estator tem 8 polos com 6 dentes cada e duas bobinas; o rotor tem dois copos de 50 dentes, defasados de meio dente, com um ímã entre eles, e anda 1,8° por passo (200 passos por volta). Rotor na posição de ${formatNumber(pos)} passos (${formatNumber(angle, 4)}°), ${phaseText(currents(p))}.`;
  },
  view: [0.75, 0.95, 1.1],
  animated: false,
};

/** Outline of pole k (centre angle c): stem from the yoke, shoe with six teeth. */
function poleOutline(c: number): Pt[] {
  const u: Pt = [Math.cos(c), Math.sin(c)];
  const v: Pt = [-Math.sin(c), Math.cos(c)];
  const at = (d: number, s: number): Pt => [u[0] * d + v[0] * s, u[1] * d + v[1] * s];
  const pts: Pt[] = [at(YOKE_R, -STEM), at(13.3, -STEM), polar(SHOE_R, c - deg(SHOE))];
  // Shoe face: six teeth at ±3,6°, ±10,8°, ±18° (7,2° pitch).
  for (let m = 0; m < 6; m++) {
    const o = c + deg((m - 2.5) * PITCH);
    pts.push(
      polar(BORE + SLOT, o - deg(PITCH * 0.25)),
      polar(BORE, o - deg(PITCH * 0.21)),
      polar(BORE, o + deg(PITCH * 0.21)),
      polar(BORE + SLOT, o + deg(PITCH * 0.25)),
    );
  }
  pts.push(polar(SHOE_R, c + deg(SHOE)), at(13.3, STEM), at(YOKE_R, STEM));
  return pts;
}

/** Ring of a 625 bearing (5 × 16 × 5) from y0, with its shields. */
function bearing(y0: number) {
  const { r, rIn, w } = BEARING;
  return lathe(
    [
      [rIn, y0],
      [3.6, y0],
      [3.6, y0 + 0.3],
      [6.9, y0 + 0.3],
      [6.9, y0],
      [r, y0],
      [r, y0 + w],
      [6.9, y0 + w],
      [6.9, y0 + w - 0.3],
      [3.6, y0 + w - 0.3],
      [3.6, y0 + w],
      [rIn, y0 + w],
      [rIn, y0],
    ],
    40,
  );
}

export default function StepperMotor(props: StepperMotorProps) {
  const p = { ...meta.defaults, ...props } as Required<StepperMotorProps>;
  const pp = p as unknown as PartProps;
  const { L, cap, S, y0, y1, sCup, nCup, magnet } = layout(pp);
  const lead = leadOf(pp);
  const noise = getNoiseTexture();
  const now = currents(pp);
  const poles = Array.from({ length: 8 }, (_, k) => polarity(k, now));
  const polesKey = poles.join(',');

  const geo = useGeometrySet(() => {
    const capOutline = chamferedSquare(H, CHAMFER);
    // Front cap: solid block with the bearing seat, the M3 holes and the pilot boss.
    const front = polygon(new Shape(), capOutline);
    front.holes.push(circle(new Path(), BEARING.r, 0, 0, 40));
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const)
      front.holes.push(circle(new Path(), 1.5, (sx * HOLES) / 2, (sz * HOLES) / 2, 16));
    const frontCap = merge([
      scaleUv(creased(extrudeY(front, y1, L, { bevel: 0.5, curveSegments: 2 }), 0.3), 0.15, 0.15),
      lathe(
        [
          [BEARING.r, L - 0.01],
          [PILOT / 2, L - 0.01],
          [PILOT / 2, L + PILOT_H - 0.25],
          [PILOT / 2 - 0.25, L + PILOT_H],
          [BEARING.r, L + PILOT_H],
          [BEARING.r, L - 0.01],
        ],
        56,
      ),
    ]);
    // Rear cap: hollow (the coil ends sit in it), with a plate and the bearing boss.
    const rearWall = polygon(new Shape(), capOutline);
    rearWall.holes.push(circle(new Path(), CAVITY, 0, 0, 64));
    const rearPlate = polygon(new Shape(), capOutline);
    rearPlate.holes.push(circle(new Path(), BEARING.r, 0, 0, 40));
    const rearCap = merge([
      scaleUv(
        creased(extrudeY(rearWall, 0, cap, { bevel: 0.5, curveSegments: 2 }), 0.3),
        0.15,
        0.15,
      ),
      scaleUv(
        creased(extrudeY(rearPlate, 0, 1.8, { bevel: 0.5, curveSegments: 2 }), 0.3),
        0.15,
        0.15,
      ),
      lathe(
        [
          [BEARING.r, 1.7],
          [BEARING.r + 1.8, 1.7],
          [BEARING.r + 1.8, cap - 0.6],
          [BEARING.r, cap - 0.6],
          [BEARING.r, 1.7],
        ],
        48,
      ),
    ]);

    // Stator yoke: the square stack with the bore of the poles and four bolt holes.
    const yokeShape = polygon(new Shape(), chamferedSquare(H - 0.12, CHAMFER + 0.1));
    // Slots with flat bottoms: an octagon whose sides meet the poles square on.
    const slotBottom = YOKE_R / Math.cos(deg(22.5));
    yokeShape.holes.push(
      polygon(
        new Path(),
        Array.from({ length: 8 }, (_, k) => polar(slotBottom, deg(22.5 + k * 45))),
      ),
    );
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const)
      yokeShape.holes.push(circle(new Path(), 1.6, (sx * HOLES) / 2, (sz * HOLES) / 2, 14));
    const yoke = scaleUv(
      creased(extrudeY(yokeShape, y0 + SEAT, y1, { curveSegments: 2 })),
      0.05,
      1 / (0.35 * 8),
    );

    // Rotor cups: 50 teeth; the S cup's teeth sit half a tooth (3,6°) from the N cup's.
    const cupGeo = (phase: number, [a, b]: [number, number]) => {
      const shape = polygon(
        new Shape(),
        teethOutline(ROTOR_TEETH, ROTOR_R, ROTOR_R - ROTOR_TOOTH, { phase, top: 0.42, base: 0.5 }),
      );
      shape.holes.push(circle(new Path(), SHAFT_R + 0.05, 0, 0, 24));
      return scaleUv(
        creased(extrudeY(shape, a, b, { curveSegments: 2 }), Math.PI / 5),
        0.05,
        1 / 2.8,
      );
    };
    const nCupGeo = cupGeo(0, nCup);
    const sCupGeo = cupGeo(deg(PITCH / 2), sCup);
    // A hair shorter than the gap between the cups, so the cut face of a cup does not flicker against it.
    const ring = (a: number, b: number) =>
      lathe(
        [
          [SHAFT_R + 0.1, a],
          [9.4, a],
          [9.4, b],
          [SHAFT_R + 0.1, b],
          [SHAFT_R + 0.1, a],
        ],
        56,
      );
    const mid = (magnet[0] + magnet[1]) / 2;

    // Shaft: round from the rear bearing to the start of the D flat, then a D section.
    const sb = cap - BEARING.w + 0.3;
    const tip = L + SHAFT_OUT;
    const round = lathe(
      [
        [0, sb],
        [SHAFT_R - 0.3, sb],
        [SHAFT_R, sb + 0.3],
        [SHAFT_R, tip - FLAT_LEN + 0.02],
        [0, tip - FLAT_LEN + 0.02],
      ],
      28,
    );
    const a0 = Math.acos((SHAFT_R - FLAT_DEPTH) / SHAFT_R);
    const dShape = polygon(new Shape(), arc(SHAFT_R, a0, Math.PI * 2 - a0, 26));
    const flat = creased(extrudeY(dShape, tip - FLAT_LEN, tip, { bevel: 0.3, curveSegments: 2 }));
    const shaft = merge([round, flat]);

    return {
      frontCap,
      rearCap,
      yoke,
      nCup: nCupGeo,
      sCup: sCupGeo,
      magnetN: ring(mid, magnet[1] - 0.06),
      magnetS: ring(magnet[0] + 0.06, mid),
      shaft,
      frontBearing: bearing(L + PILOT_H - BEARING.w),
      rearBearing: bearing(cap - BEARING.w),
    };
  }, [L]);

  // Poles and coils, grouped by state so each group is one draw call.
  const parts = useGeometrySet(() => {
    const pick = (want: number) => {
      const list: BufferGeometry[] = [];
      poles.forEach((pol, k) => {
        if (pol !== want) return;
        const shape = polygon(new Shape(), poleOutline(deg(k * 45)));
        list.push(creased(extrudeY(shape, y0 + SEAT, y1, { curveSegments: 2 }), Math.PI / 6));
      });
      return list.length ? merge(list) : null;
    };
    const coils = (active: boolean) => {
      const list = poles.flatMap((_, k) => {
        const on = k % 2 === 0 ? now.a !== 0 : now.b !== 0;
        if (on !== active) return [];
        return [
          toothCoil({
            width: 2 * STEM + 0.3,
            length: S + 0.4,
            build: 2,
            r0: 13.45,
            r1: YOKE_R - 0.15,
            angle: deg(k * 45),
            y: (y0 + y1) / 2,
            taper: 1.6,
            wire: 0.25,
          }),
        ];
      });
      return list.length ? merge(list) : null;
    };
    const out: Record<string, BufferGeometry> = {};
    const idle = pick(0);
    const north = pick(1);
    const south = pick(-1);
    if (idle) out.idle = idle;
    if (north) out.north = north;
    if (south) out.south = south;
    const coilsOn = coils(true);
    const coilsOff = coils(false);
    if (coilsOn) out.coilsOn = coilsOn;
    if (coilsOff) out.coilsOff = coilsOff;
    return out;
  }, [L, polesKey]);

  const lamColor = useLaminationTexture('color');
  const lamRough = useLaminationTexture('rough');
  const turnsMap = useTurnsTexture('color', '#b4582c');
  const turnsBump = useTurnsTexture('bump');
  const label = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#e9e7e1';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#26282c';
      fitText(ctx, 'MOTOR DE PASSO', w / 2, h * 0.24, w * 0.86, 62, { weight: 700 });
      ctx.fillStyle = '#3a3d42';
      fitText(ctx, '1,8° por passo · 200 passos/volta', w / 2, h * 0.52, w * 0.9, 36, {
        weight: 500,
      });
      fitText(ctx, 'Bipolar · 2 fases · NEMA 17', w / 2, h * 0.76, w * 0.9, 36, {
        weight: 500,
      });
      ctx.fillStyle = '#26282c';
      ctx.fillRect(w * 0.06, h * 0.9, w * 0.88, 3);
    },
    'stepper-label',
    { width: 512, height: 256, fonts: [`700 62px ${FONT_SANS}`] },
  );

  // Rotor angle follows the position.
  const rotor = useRef<Group>(null);
  useFollow(
    deg((Number(p.position) || 0) * STEP),
    (a) => {
      if (rotor.current) rotor.current.rotation.y = a;
    },
    9,
  );

  const capMaterial = (
    <Material
      color="#1e1f22"
      metalness={0.55}
      roughness={0.42}
      roughnessMap={noise}
      clip
      cutColor="#34363a"
    />
  );
  const steel = (
    <Material preset="steel" color="#c9ccd0" roughness={0.22} clip cutColor="#8d9095" />
  );
  const polesMaterial = (color: string, glow: number) => (
    <Material
      preset="siliconSteel"
      color={color}
      metalness={0.55}
      roughness={0.42}
      emissive={color}
      emissiveIntensity={glow}
      clip
      cutColor={color}
    />
  );

  const yw = cap / 2 + 0.3;
  const wireAt = [-2.4, -0.8, 0.8, 2.4];
  const statorAt = xz(BORE + 1, deg(-45));
  const coilAt = xz(15, deg(-90));
  const rotorAt = xz(ROTOR_R, FRONT);
  const magnetAt = xz(9.4, FRONT);
  const bearingAt = xz(7.5, FRONT);
  const labelH = Math.min(S - 4, 17);

  return (
    <group>
      {/* Rear cap, its bearing and the leads or the connector. */}
      <mesh geometry={geo.rearCap}>{capMaterial}</mesh>
      <mesh geometry={geo.rearBearing}>{steel}</mesh>
      {lead === 'fios' ? (
        <group>
          <mesh position={[0, yw, H + 0.35]}>
            <boxGeometry args={[8.6, 2.6, 1.2]} />
            <Material preset="rubber" roughness={0.8} />
          </mesh>
          {WIRES.map((w, i) => {
            const x = wireAt[i]!;
            const points: Vec3[] = [
              [x, yw, H - 1.5],
              [x, yw, H + 3],
              [x * 1.25, 0.66, H + 9],
              [x * 2.1, 0.66, H + 34],
            ];
            return <Lead key={w.name} points={points} radius={0.62} color={w.color} strip={3.5} />;
          })}
        </group>
      ) : (
        <group position={[0, yw, H]}>
          <mesh position={[0, 0, -0.9]}>
            <boxGeometry args={[13, 5.2, 3]} />
            <Material preset="nylonNatural" color="#ecebe4" roughness={0.6} />
          </mesh>
          {[-5, -3, -1, 1, 3, 5].map((x) => (
            <group key={x} position={[x, -0.2, 0.62]}>
              <mesh>
                <boxGeometry args={[1.5, 2.2, 0.06]} />
                <Material color="#18181a" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0, 0.04]}>
                <boxGeometry args={[0.5, 0.5, 0.1]} />
                <Material preset="tin" roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Stator: yoke, poles (energised ones in colour) and coils. */}
      <Explode offset={[0, 6, 0]} delay={0.3}>
        <mesh geometry={geo.yoke}>
          <Material
            attach="material-0"
            preset="siliconSteel"
            color="#9a9ea4"
            roughness={0.4}
            clip
            cutColor="#a8acb2"
          />
          <Material
            attach="material-1"
            preset="siliconSteel"
            color="#ffffff"
            map={lamColor}
            roughnessMap={lamRough}
            metalness={0.5}
            roughness={0.5}
            clip
            cutColor="#a8acb2"
          />
        </mesh>
        {parts.idle && (
          <mesh geometry={parts.idle}>
            <Material
              preset="siliconSteel"
              color="#9a9ea4"
              roughness={0.4}
              clip
              cutColor="#b4b8be"
            />
          </mesh>
        )}
        {parts.north && <mesh geometry={parts.north}>{polesMaterial(N_COLOR, 0.35)}</mesh>}
        {parts.south && <mesh geometry={parts.south}>{polesMaterial(S_COLOR, 0.35)}</mesh>}
        {parts.coilsOff && (
          <mesh geometry={parts.coilsOff}>
            <Material
              preset="magnetWire"
              color="#ffffff"
              map={turnsMap}
              bumpMap={turnsBump}
              bumpScale={0.4}
              clip
              cutColor="#a8562c"
            />
          </mesh>
        )}
        {parts.coilsOn && (
          <mesh geometry={parts.coilsOn}>
            <Material
              preset="magnetWire"
              color="#ffffff"
              map={turnsMap}
              bumpMap={turnsBump}
              bumpScale={0.4}
              emissive="#ff7a2e"
              emissiveIntensity={0.35}
              clip
              cutColor="#d0743c"
            />
          </mesh>
        )}
        <Decal
          map={label}
          width={28}
          height={labelH}
          position={[H - 0.12 + 0.03, (y0 + y1) / 2, 0]}
          rotation={[0, Math.PI / 2, 0]}
          roughness={0.6}
          clip
        />
        <Anchor name="stator" position={[statorAt[0], y1, statorAt[1]]} />
        <Anchor name="coil" position={[coilAt[0], y1 + 2, coilAt[1]]} />
      </Explode>

      {/* Rotor: shaft, the two toothed cups and the magnet (turns to the position). */}
      <Explode offset={[0, S + 16, 0]} delay={0.15}>
        <group ref={rotor}>
          <mesh geometry={geo.shaft}>
            <Material preset="steel" color="#d5d7da" roughness={0.18} />
          </mesh>
          <Explode offset={[0, 3, 0]} delay={0.5}>
            <mesh geometry={geo.nCup}>
              <Material
                attach="material-0"
                preset="siliconSteel"
                color="#a3a7ad"
                roughness={0.38}
                clip
                cutColor="#b9bdc3"
              />
              <Material
                attach="material-1"
                preset="siliconSteel"
                color="#ffffff"
                map={lamColor}
                roughnessMap={lamRough}
                metalness={0.5}
                roughness={0.5}
                clip
                cutColor="#b9bdc3"
              />
            </mesh>
          </Explode>
          <Explode offset={[0, -3, 0]} delay={0.5}>
            <mesh geometry={geo.sCup}>
              <Material
                attach="material-0"
                preset="siliconSteel"
                color="#a3a7ad"
                roughness={0.38}
                clip
                cutColor="#b9bdc3"
              />
              <Material
                attach="material-1"
                preset="siliconSteel"
                color="#ffffff"
                map={lamColor}
                roughnessMap={lamRough}
                metalness={0.5}
                roughness={0.5}
                clip
                cutColor="#b9bdc3"
              />
            </mesh>
          </Explode>
          <mesh geometry={geo.magnetN}>
            <Material color={N_COLOR} metalness={0.3} roughness={0.45} clip />
          </mesh>
          <mesh geometry={geo.magnetS}>
            <Material color={S_COLOR} metalness={0.3} roughness={0.45} clip />
          </mesh>
        </group>
        <Anchor name="rotor" position={[rotorAt[0], (nCup[0] + nCup[1]) / 2 + 3, rotorAt[1]]} />
        <Anchor name="magnet" position={[magnetAt[0], (magnet[0] + magnet[1]) / 2, magnetAt[1]]} />
      </Explode>

      {/* Front cap with the pilot boss and its bearing. */}
      <Explode offset={[0, S + 32, 0]}>
        <mesh geometry={geo.frontCap}>{capMaterial}</mesh>
        <mesh geometry={geo.frontBearing}>{steel}</mesh>
        <Anchor name="bearing" position={[bearingAt[0], L + PILOT_H, bearingAt[1]]} />
      </Explode>
    </group>
  );
}
