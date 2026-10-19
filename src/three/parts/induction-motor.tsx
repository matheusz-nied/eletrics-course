/**
 * Small squirrel-cage induction motor, IEC frame 80 (about 0,75 kW / 1 CV,
 * 4 poles, 1.720 rpm at 60 Hz), the size sold everywhere in Brazil for
 * pumps, compressors and machine tools. Main dimensions from IEC 60072-1 and
 * the catalogue drawings of frame 80 cast-iron motors (B3 mounting): shaft
 * height H = 80, foot holes A = 125 × B = 100, C = 50 from the shaft
 * shoulder, K = 10; shaft end D = 19 × E = 40 with a 6 × 6 × 32 key
 * (GA = 21,5); finned frame Ø 160 over the fins; overall length about 300
 * and height to the top of the terminal box about 215. Bearings 6204 (front)
 * and 6203 (rear). Inside, typical proportions of this size: stator core
 * Ø 124 × 80 with 36 slots and a Ø 78 bore, rotor Ø 77,4 with 28 cast
 * aluminium bars skewed by one stator slot and two short-circuit rings with
 * cast fins, a plastic radial fan under the stamped, perforated fan cover.
 * Generic paint and nameplate, no brand.
 *
 * Single phase (`phases: 'monofasico'`): start capacitor in a housing on top,
 * behind the terminal box, and the centrifugal switch inside the rear end.
 * Exploded view: terminal box lid up, fan cover, fan and rear shield
 * backwards, rotor with shaft and bearings forward, front shield beyond it.
 * Cutaway (plane z = 0): frame, end shields, stator, windings and terminal
 * box cut; rotor, shaft, bearings, fan and terminals stay whole.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  PlaneGeometry,
  type Shape,
  type BufferGeometry,
  type Group,
} from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { formatNumber } from '../core/format';
import { useReducedMotion } from '../core/motion';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { roundedPath, tube } from '../shapes/geometry';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import {
  ballBearingGeometry,
  circlePoints,
  extrudeX,
  keyGeometry,
  latheX,
  mirrorProfile,
  polygonPath,
  polygonShape,
  visualRps,
} from './_machine-shared';
import {
  fixLatheSeam,
  lathe,
  merge,
  roundedRectShell,
  roundedRectSlab,
  scaleUv,
  shellProfile,
  useGeometrySet,
  useLaminationTexture,
  useTurnsTexture,
} from './_power-shared';

type Phases = 'trifasico' | 'monofasico';
type Direction = 'horario' | 'anti-horario';
type Paint = 'cinza' | 'verde' | 'azul';

export interface InductionMotorProps {
  phases?: Phases;
  /** Speed (rpm); 0 = stopped. */
  rpm?: number;
  /** Direction seen from the shaft end. */
  direction?: Direction;
  /** Paint of the frame. */
  color?: Paint;
}

/** Shaft height (IEC frame 80): the axis is at y = H. */
const H = 80;
/** Frame: core radius, radius over the fins, bore, half length, number of fins. */
const R_CORE = 68;
const R_FIN = 80;
const R_FRAME_IN = 62;
const FRAME_X = 85;
const FINS = 32;
/** Stator core. */
const R_STATOR = 61.9;
const R_BORE = 39;
const STACK = 40;
const SLOTS = 36;
/** Rotor core and cage. */
const R_ROTOR = 38.7;
const R_SHAFT = 12.5;
const BARS = 28;
/** Shaft end (D = 19, E = 40) and key. */
const SHAFT_TIP = 150;
const KEY_X = 128;
/** Terminal box (centre X, size, height of the floor and of the rim). */
const BOX_X = 30;
const BOX_W = 84;
const BOX_D = 96;
const BOX_Y0 = 85;
const BOX_Y1 = 130;
const LID_T = 6;
/** Top of the terminal block (it stands on two feet, the leads run under it). */
const BLOCK_TOP = BOX_Y0 + 13;
/** Terminal studs: X offsets in a row, Z of the two rows; labels as in Brazilian motors. */
const STUD_X = [-18, 0, 18];
const STUD_Z = 11;
const LABELS_BACK = ['6', '4', '5'];
const LABELS_FRONT = ['1', '2', '3'];
/** Capacitor housing (single phase): X range, radius, axis height. */
const CAP_X0 = -84;
const CAP_X1 = -18;
const CAP_R = 26;
const CAP_Y = 100;

const PAINT: Record<Paint, string> = {
  cinza: '#3b4147',
  verde: '#33503f',
  azul: '#2c4a72',
};

export const meta: PartMeta = {
  id: 'induction-motor',
  label: 'Motor de indução',
  category: 'saidas',
  summary:
    'Motor de indução trifásico ou monofásico com rotor gaiola de esquilo, carcaça 80 (0,75 kW, 1 CV, 4 polos): carcaça com aletas, estator com bobinas, rotor, rolamentos, ventilador e caixa de ligação.',
  defaults: { phases: 'trifasico', rpm: 0, direction: 'horario', color: 'cinza' },
  controls: {
    phases: {
      kind: 'select',
      label: 'Alimentação',
      options: [
        { value: 'trifasico', label: 'Trifásico' },
        { value: 'monofasico', label: 'Monofásico (com capacitor)' },
      ],
    },
    rpm: { kind: 'number', label: 'Rotação', min: 0, max: 1800, step: 10, unit: 'rpm' },
    direction: {
      kind: 'select',
      label: 'Sentido (visto pelo eixo)',
      options: [
        { value: 'horario', label: 'Horário' },
        { value: 'anti-horario', label: 'Anti-horário' },
      ],
    },
    color: {
      kind: 'select',
      label: 'Pintura',
      options: [
        { value: 'cinza', label: 'Cinza' },
        { value: 'verde', label: 'Verde' },
        { value: 'azul', label: 'Azul' },
      ],
    },
  },
  annotations: (p) => {
    const list: PartAnnotation[] = [
      {
        at: [-45, H + R_FIN * Math.cos(Math.PI / 16), -R_FIN * Math.sin(Math.PI / 16)],
        text: 'Carcaça com aletas: dissipa o calor',
      },
      { at: [BOX_X + BOX_W / 2, H + 112, -20], text: 'Caixa de ligação: seis terminais (1 a 6)' },
      { at: [-20, H + 58.5, 0], text: 'Estator: núcleo de chapas de aço' },
      { at: [STACK + 13, H + 54, 0], text: 'Enrolamentos de cobre (cabeças de bobina)' },
      { at: [0, 0, 0], anchor: 'rotor', text: 'Rotor gaiola de esquilo' },
      {
        at: [0, 0, 0],
        anchor: 'cage',
        text: 'Barras e anéis de curto-circuito (alumínio)',
      },
      { at: [0, 0, 0], anchor: 'bearing', text: 'Rolamentos de esferas' },
      { at: [0, 0, 0], anchor: 'fan', text: 'Ventilador: sopra ar sobre as aletas' },
      { at: [0, 0, 0], anchor: 'shaft', text: 'Eixo com chaveta: transmite o torque' },
    ];
    if (p.phases === 'monofasico')
      list.push(
        {
          at: [(CAP_X0 + CAP_X1) / 2, H + CAP_Y + CAP_R, -6],
          text: 'Capacitor de partida',
        },
        {
          at: [0, 0, 0],
          anchor: 'switch',
          text: 'Chave centrífuga: desliga o capacitor depois da partida',
        },
      );
    return list;
  },
  explode: true,
  cutaway: true,
  cut: { normal: [0, 0, -1], through: [0, 0, 0] },
  animated: (p) => Number(p.rpm) > 0,
  describe: (p) => {
    const mono = p.phases === 'monofasico';
    const rpm = Math.max(Number(p.rpm) || 0, 0);
    const sense = p.direction === 'anti-horario' ? 'anti-horário' : 'horário';
    const state =
      rpm > 0
        ? ` Girando a ${formatNumber(rpm, 4)} rpm no sentido ${sense}, visto pelo lado do eixo (a animação mostra uma rotação bem mais lenta).`
        : ' Parado.';
    const kind = mono
      ? 'Motor de indução monofásico com capacitor de partida'
      : 'Motor de indução trifásico';
    const extra = mono
      ? ' No alto, atrás da caixa de ligação, fica o alojamento do capacitor de partida; dentro da tampa traseira, a chave centrífuga que o desliga quando o motor ganha velocidade.'
      : '';
    return `${kind}, rotor gaiola de esquilo, carcaça 80 de ferro fundido com aletas (0,75 kW, 1 CV, 4 polos, ${mono ? '1.730' : '1.720'} rpm em 60 Hz), com pés de fixação, eixo de 19 mm com chaveta, ventilador sob a tampa traseira perfurada e caixa de ligação no alto com seis terminais numerados de 1 a 6. Por dentro: estator de chapas de aço com 36 ranhuras e as cabeças de bobina de cobre, rotor de chapas com barras de alumínio inclinadas unidas por dois anéis de curto-circuito, e dois rolamentos de esferas.${extra}${state}`;
  },
  view: [0.95, 0.5, 1.05],
};

type P2 = [number, number];

/** A point at radius r and angle ψ (from +Y towards +Z) in shape coordinates (−z, y). */
const polar = (r: number, psi: number): P2 => [-r * Math.sin(psi), r * Math.cos(psi)];

/**
 * Finned frame: the core tube and the axial fins (none at the bottom, where
 * the feet are), each fin a plate with chamfered ends, as cast.
 */
function frameGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [
    latheX(
      [
        [R_FRAME_IN, -FRAME_X],
        [R_CORE, -FRAME_X],
        [R_CORE, FRAME_X],
        [R_FRAME_IN, FRAME_X],
        [R_FRAME_IN, -FRAME_X],
      ],
      96,
    ),
  ];
  const plate = polygonShape([
    [-FRAME_X, R_CORE - 1],
    [-FRAME_X, R_CORE + 4],
    [-FRAME_X + 6, R_FIN],
    [FRAME_X - 6, R_FIN],
    [FRAME_X, R_CORE + 4],
    [FRAME_X, R_CORE - 1],
  ]);
  for (let k = 0; k < FINS; k++) {
    const psi = (k * 2 * Math.PI) / FINS;
    if (Math.abs(psi - Math.PI) < 0.8) continue;
    const fin = new ExtrudeGeometry(plate, { depth: 2.4, bevelEnabled: false });
    fin.translate(0, 0, -1.2);
    scaleUv(fin, 1 / 40, 1 / 40);
    parts.push(fin.rotateX(psi));
  }
  return merge(parts);
}

/** Cast foot with its web up to the frame, on the side `s` (+1 = +Z). Points (z, y). */
function footSection(s: 1 | -1): Shape {
  const pts: P2[] = [
    [38, -H],
    [77.5, -H],
    [77.5, -H + 10],
    [57, -H + 10],
    [49.5, -45.5],
    [30, -58],
    [32, -H + 8],
  ];
  return polygonShape(pts.map(([z, y]) => [-s * z, y]));
}

/** A boss on top of the frame (terminal box seat, capacitor saddle): flat top, bottom in the frame wall. */
function seatSection(halfZ: number, top: number): Shape {
  const r = R_FRAME_IN + 2;
  const a = Math.asin(halfZ / r);
  const zy: P2[] = [
    [-halfZ, top],
    [halfZ, top],
  ];
  for (let i = 0; i <= 12; i++) {
    const psi = a - (2 * a * i) / 12;
    zy.push([r * Math.sin(psi), r * Math.cos(psi)]);
  }
  return polygonShape(zy.map(([z, y]) => [-z, y]));
}

/** Stator lamination: outer circle, bore with 36 semi-closed slots (one centred on the top). */
function statorSection(): Shape {
  const shape = polygonShape(circlePoints(R_STATOR, 96));
  const slot: P2[] = [
    [R_BORE - 0.01, -1.3],
    [40.6, -1.3],
    [41.6, -2.3],
    [54.2, -3.6],
    [55.4, -2.6],
    [55.9, 0],
  ];
  const outline = [
    ...slot,
    ...slot
      .slice(0, -1)
      .reverse()
      .map(([r, t]) => [r, -t] as P2),
  ];
  const hole: P2[] = [];
  const step = (2 * Math.PI) / SLOTS;
  for (let k = 0; k < SLOTS; k++) {
    const c = k * step;
    for (const [r, t] of outline) hole.push(atSlot(r, t, c));
    const a0 = c + 1.3 / R_BORE;
    const a1 = c + step - 1.3 / R_BORE;
    for (let i = 0; i <= 3; i++) hole.push(polar(R_BORE, a0 + ((a1 - a0) * i) / 3));
  }
  shape.holes.push(polygonPath(hole));
  return shape;
}

/** Point at radial distance r and tangential offset t (towards growing ψ) from a slot centred at ψ = c. */
function atSlot(r: number, t: number, c: number): P2 {
  const [x, y] = polar(r, c);
  // d/dψ of (−r sin ψ, r cos ψ), normalised.
  return [x - t * Math.cos(c), y - t * Math.sin(c)];
}

/** Copper filling the slots (slightly inside the slot outline). */
function slotCopperShapes(): Shape[] {
  const step = (2 * Math.PI) / SLOTS;
  const half: P2[] = [
    [42.4, -1.9],
    [53.8, -3.0],
    [55.2, -1.6],
    [55.4, 0],
  ];
  const outline = [
    ...half,
    ...half
      .slice(0, -1)
      .reverse()
      .map(([r, t]) => [r, -t] as P2),
  ];
  return Array.from({ length: SLOTS }, (_, k) =>
    polygonShape(outline.map(([r, t]) => atSlot(r, t, k * step))),
  );
}

/** One coil head (end turns of the stator winding), with a bulge per coil group. */
function coilHead(side: 1 | -1): BufferGeometry {
  const front: P2[] = [
    [41.6, STACK - 0.5],
    [55.6, STACK - 0.5],
    [57.6, 46],
    [57.2, 55],
    [54.4, 62.5],
    [49.5, 66],
    [44.6, 64.6],
    [42, 58],
    [41, 48],
    [41.6, STACK - 0.5],
  ];
  const profile = side === 1 ? front : mirrorProfile(front);
  const segments = 120;
  const g = lathe(profile, segments, { angle: 50 });
  scaleUv(g, 1, 26.5 / 4.8);
  g.rotateZ(-Math.PI / 2);
  const pos = g.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const phi = Math.atan2(z, y);
    const bump = 0.5 + 0.5 * Math.cos(12 * phi);
    const d = side * x - STACK;
    if (d > 0) pos.setX(i, side * (STACK + d * (1 + 0.12 * bump)));
    const k = 1 + (0.012 * bump * Math.max(d, 0)) / 26;
    pos.setY(i, y * k);
    pos.setZ(i, z * k);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  fixLatheSeam(g, pos.count / (segments + 1), segments);
  return g;
}

/** Front end shield (drive end) in [r, x]: spigot, flange, cone, bearing boss and cap. */
const FRONT_SHIELD: P2[] = [
  [62, 80],
  [62, FRAME_X],
  [70, FRAME_X],
  [70, 90],
  [66, 92],
  [40, 99.5],
  [36, 101],
  [36, 106],
  [11.2, 106],
  [11.2, 104],
  [23.6, 104],
  [23.6, 90],
  [32, 89.5],
  [58, 86],
  [58, 80],
  [62, 80],
];

/** Rear end shield (drawn on the +X side, then mirrored). */
const REAR_SHIELD: P2[] = [
  [62, 80],
  [62, FRAME_X],
  [70, FRAME_X],
  [70, 90],
  [66, 92],
  [34, 98],
  [31, 99],
  [31, 104],
  [10, 104],
  [10, 102],
  [20.1, 102],
  [20.1, 90],
  [28, 89.5],
  [58, 86],
  [58, 80],
  [62, 80],
];

/** Shaft in [r, x]: fan seat Ø 14, rear bearing Ø 17, body Ø 25, front bearing Ø 20, end Ø 19 × 40. */
const SHAFT: P2[] = [
  [0, -128],
  [6.6, -128],
  [7, -127.6],
  [7, -102],
  [8.5, -102],
  [8.5, -90],
  [R_SHAFT, -90],
  [R_SHAFT, 88],
  [10, 88],
  [10, 104],
  [9.5, 104],
  [9.5, SHAFT_TIP - 0.6],
  [8.9, SHAFT_TIP],
  [0, SHAFT_TIP],
];

export default function InductionMotor(props: InductionMotorProps) {
  const p = { ...meta.defaults, ...props } as Required<InductionMotorProps>;
  const mono = p.phases === 'monofasico';
  const paint = PAINT[p.color] ?? PAINT.cinza;
  const noise = getNoiseTexture();

  const geo = useGeometrySet(() => {
    // Cast frame: finned body, feet, terminal box seat and walls (and the capacitor housing).
    const frameParts: BufferGeometry[] = [
      frameGeometry(),
      extrudeX([footSection(1), footSection(-1)], -52.5, 72.5),
      extrudeX(seatSection(BOX_D / 2, BOX_Y0), BOX_X - BOX_W / 2, BOX_X + BOX_W / 2),
      scaleUv(roundedRectShell(BOX_W, BOX_D, 6, BOX_Y0 - 0.5, BOX_Y1, 5, 4), 3, 1).translate(
        BOX_X,
        0,
        0,
      ),
    ];
    if (mono) {
      frameParts.push(extrudeX(seatSection(19, CAP_Y - 18), CAP_X0 + 6, CAP_X1 - 6));
      const housing: P2[] = [
        [0, CAP_X0],
        [12, CAP_X0 + 0.6],
        [19, CAP_X0 + 2.6],
        [24, CAP_X0 + 6],
        [CAP_R, CAP_X0 + 11],
        [CAP_R, CAP_X1 - 11],
        [24, CAP_X1 - 6],
        [19, CAP_X1 - 2.6],
        [12, CAP_X1 - 0.6],
        [0, CAP_X1],
      ];
      frameParts.push(latheX(shellProfile(housing, 2), 48).translate(0, CAP_Y, 0));
    }
    const frame = merge(frameParts);

    // Foot holes (K = 10) at the IEC positions, as dark discs on the feet.
    const holes = merge(
      [60, -40].flatMap((x) =>
        [1, -1].map((s) =>
          new CircleGeometry(5, 20).rotateX(-Math.PI / 2).translate(x, -H + 10.05, s * 62.5),
        ),
      ),
    );

    const lid = roundedRectSlab(BOX_W + 4, BOX_D + 4, 8, BOX_Y1, BOX_Y1 + LID_T, 1.2).translate(
      BOX_X,
      0,
      0,
    );
    scaleUv(lid, 1 / 40, 1 / 40);
    const lidScrews = merge(
      [1, -1].flatMap((sx) =>
        [1, -1].map((sz) =>
          new CylinderGeometry(3.4, 3.4, 2, 16).translate(
            BOX_X + sx * (BOX_W / 2 - 5),
            BOX_Y1 + LID_T + 1,
            sz * (BOX_D / 2 - 5),
          ),
        ),
      ),
    );

    // End shields with the four bolts that hold them to the frame.
    const bolts = (side: 1 | -1) =>
      [0, 1, 2, 3].map((k) => {
        const psi = Math.PI / 4 + (k * Math.PI) / 2;
        return new CylinderGeometry(5.8, 5.8, 4.5, 6)
          .rotateZ(-Math.PI / 2)
          .translate(side * 93.6, 62.5 * Math.cos(psi), 62.5 * Math.sin(psi));
      });
    const frontShield = merge([latheX(FRONT_SHIELD, 72), ...bolts(1)]);
    const rearShield = merge([latheX(mirrorProfile(REAR_SHIELD), 72), ...bolts(-1)]);

    // Fan cover: stamped sheet with a rounded end; the perforated end is a separate disc.
    const coverOuter: P2[] = [
      [61, -150],
      [67.5, -149.6],
      [71.4, -148],
      [73.4, -145.5],
      [74, -141],
      [74, -93],
    ];
    const cover = latheX(shellProfile(coverOuter, 1.5), 72);
    const grille = new CircleGeometry(62.5, 64).rotateY(-Math.PI / 2).translate(-149.2, 0, 0);

    // Fan: hub, disc and ten straight radial blades.
    const fanParts: BufferGeometry[] = [
      latheX(
        [
          [7, -141],
          [14, -141],
          [14, -112],
          [7, -112],
          [7, -141],
        ],
        32,
      ),
      latheX(
        [
          [13.5, -115.5],
          [62, -115.5],
          [62, -113],
          [13.5, -113],
          [13.5, -115.5],
        ],
        64,
      ),
    ];
    for (let k = 0; k < 10; k++)
      fanParts.push(
        new BoxGeometry(23, 47, 2.6).translate(-127, 38.5, 0).rotateX((k * 2 * Math.PI) / 10),
      );
    const fan = merge(fanParts);

    // Stator core: caps (group 0) and laminated sides (group 1).
    const statorRaw = new ExtrudeGeometry(statorSection(), {
      depth: 2 * STACK,
      bevelEnabled: false,
      curveSegments: 4,
    });
    statorRaw.rotateY(Math.PI / 2);
    statorRaw.translate(-STACK, 0, 0);
    scaleUv(statorRaw, 0.05, 1 / 4);
    const stator = toCreasedNormals(statorRaw, Math.PI / 7);

    const slots = extrudeX(slotCopperShapes(), -STACK - 0.5, STACK + 0.5, { uv: 4.8 });
    const coils = merge([coilHead(1), coilHead(-1)]);

    // Winding leads from the front coil head, through the floor, to the studs under the block.
    const studs: Vec3[] = [];
    STUD_X.forEach((x) => [-1, 1].forEach((s) => studs.push([BOX_X + x, BLOCK_TOP, s * STUD_Z])));
    const yRun = BOX_Y0 + 2.4;
    const leads = merge(
      studs.map(([x, , z], i) => {
        const zRun = z + (Math.floor(i / 2) - 1) * 2.7;
        return tube(
          roundedPath(
            [
              [STACK + 12, 50, z * 0.25],
              [STACK + 22, 57, z * 0.3],
              [BOX_X + 24, 80, zRun * 0.8],
              [BOX_X + 24, yRun, zRun],
              [x, yRun, zRun],
              [x, yRun, z],
              [x, BLOCK_TOP - 7.5, z],
            ],
            4,
          ),
          1.1,
          { radial: 8 },
        );
      }),
    );

    // Terminal block on two feet, studs, nuts and washers.
    const block = merge([
      roundedRectSlab(64, 44, 3, BLOCK_TOP - 8, BLOCK_TOP, 0.6).translate(BOX_X, 0, 0),
      new BoxGeometry(6, BLOCK_TOP - 8 - BOX_Y0 + 0.5, 30).translate(BOX_X - 28, BOX_Y0 + 2.4, 0),
      new BoxGeometry(6, BLOCK_TOP - 8 - BOX_Y0 + 0.5, 30).translate(BOX_X + 28, BOX_Y0 + 2.4, 0),
    ]);
    const labelPlane = new PlaneGeometry(62, 42)
      .rotateX(-Math.PI / 2)
      .translate(BOX_X, BLOCK_TOP + 0.03, 0);
    const studGeo = merge(
      studs.flatMap(([x, , z]) => [
        new CylinderGeometry(4.5, 4.5, 1, 20).translate(x, BLOCK_TOP + 0.5, z),
        new CylinderGeometry(2.5, 2.5, 10, 16).translate(x, BLOCK_TOP + 5, z),
        new CylinderGeometry(4.5, 4.5, 0.8, 20).translate(x, BLOCK_TOP + 3.2, z),
        new CylinderGeometry(4.6, 4.6, 4, 6).translate(x, BLOCK_TOP + 5.6, z),
        new CylinderGeometry(3.6, 3.6, 2, 6).translate(x, BLOCK_TOP - 9, z),
      ]),
    );
    // Cable gland on the +Z wall.
    const gland = merge([
      new CylinderGeometry(10.5, 10.5, 6, 6).rotateX(Math.PI / 2).translate(BOX_X, 108, 51),
      lathe(
        [
          [0, 0],
          [8.6, 0],
          [8.6, 4],
          [7.4, 7.6],
          [5.4, 9],
          [0, 9],
        ],
        28,
      )
        .rotateX(Math.PI / 2)
        .translate(BOX_X, 108, 54),
      new CylinderGeometry(4.6, 4.6, 14, 20).rotateX(Math.PI / 2).translate(BOX_X, 108, 68),
    ]);

    const nameplate = new PlaneGeometry(66, 40).translate(8, 4, R_FIN + 0.6);

    // Rotor: laminated core with the bars on its surface, end rings with cast fins.
    const rotorCore = lathe(
      [
        [R_SHAFT, -STACK],
        [R_ROTOR, -STACK],
        [R_ROTOR, STACK],
        [R_SHAFT, STACK],
        [R_SHAFT, -STACK],
      ],
      72,
    ).rotateZ(-Math.PI / 2);
    const ring: P2[] = [
      [25, STACK - 0.2],
      [37.6, STACK - 0.2],
      [37.6, STACK + 6.5],
      [36.6, STACK + 7.5],
      [25, STACK + 7.5],
      [25, STACK - 0.2],
    ];
    const cageParts: BufferGeometry[] = [latheX(ring, 64), latheX(mirrorProfile(ring), 64)];
    for (const s of [1, -1])
      for (let k = 0; k < 8; k++)
        cageParts.push(
          new BoxGeometry(6, 9.5, 2.4)
            .translate(s * (STACK + 10.5), 31, 0)
            .rotateX(((k + 0.5) * 2 * Math.PI) / 8),
        );
    const cage = merge(cageParts);

    const shaft = merge([latheX(SHAFT, 40), keyGeometry(32, 6, 6).translate(KEY_X, 6, 0)]);
    const seal = latheX(
      [
        [9.5, 106.2],
        [14.5, 106.2],
        [14.5, 108],
        [12.5, 109.6],
        [9.5, 109.6],
        [9.5, 106.2],
      ],
      40,
    );
    const bearings = merge([
      ballBearingGeometry(20, 47, 14, { balls: 8 })
        .rotateZ(-Math.PI / 2)
        .translate(97, 0, 0),
      ballBearingGeometry(17, 40, 12, { balls: 7 })
        .rotateZ(-Math.PI / 2)
        .translate(-96, 0, 0),
    ]);

    const set: Record<string, BufferGeometry> = {
      frame,
      holes,
      lid,
      lidScrews,
      frontShield,
      rearShield,
      cover,
      grille,
      fan,
      stator,
      slots,
      coils,
      leads,
      block,
      labelPlane,
      studGeo,
      gland,
      nameplate,
      rotorCore,
      cage,
      shaft,
      seal,
      bearings,
    };
    if (mono) {
      set.capacitor = latheX(
        [
          [0, CAP_X0 + 7],
          [21, CAP_X0 + 7],
          [22, CAP_X0 + 8],
          [22, CAP_X1 - 9],
          [21, CAP_X1 - 8],
          [0, CAP_X1 - 8],
        ],
        40,
      ).translate(0, CAP_Y, 0);
      // Centrifugal switch: rotating disc with two flyweights and a sliding collar; fixed contact block.
      set.switchRotor = merge([
        latheX(
          [
            [R_SHAFT, -77],
            [22, -77],
            [22, -75],
            [R_SHAFT, -75],
            [R_SHAFT, -77],
          ],
          40,
        ),
        latheX(
          [
            [R_SHAFT, -83],
            [16, -83],
            [16, -79],
            [R_SHAFT, -79],
            [R_SHAFT, -83],
          ],
          32,
        ),
        new BoxGeometry(5, 7, 10).translate(-72.5, 18.5, 0),
        new BoxGeometry(5, 7, 10).translate(-72.5, -18.5, 0),
      ]);
      set.switchBlock = new BoxGeometry(6, 15, 18).translate(-84, 25, 0);
    }
    return set;
  }, [mono]);

  const lamColor = useLaminationTexture('color');
  const lamRough = useLaminationTexture('rough');
  const turnsMap = useTurnsTexture('color', '#b4582c');
  const turnsBump = useTurnsTexture('bump');

  // Rotor surface: laminations and the skewed aluminium bars (u around, v along the axis).
  const skew = 1 / SLOTS;
  const drawRotor = (ctx: CanvasRenderingContext2D, w: number, h: number, rough: boolean) => {
    for (let y = 0; y < h; y += 4) {
      const shade = (y / 4) % 2 === 0;
      ctx.fillStyle = rough ? (shade ? '#8c8c8c' : '#a0a0a0') : shade ? '#7e848a' : '#737980';
      ctx.fillRect(0, y, w, 4);
    }
    ctx.fillStyle = rough ? '#4a4a4a' : '#c9cdd1';
    const width = (0.3 / BARS) * w;
    for (let k = 0; k < BARS; k++)
      for (const shift of [-w, 0, w]) {
        const u = ((k + 0.5) / BARS) * w + shift;
        ctx.beginPath();
        ctx.moveTo(u + (skew * w) / 2 - width / 2, 0);
        ctx.lineTo(u + (skew * w) / 2 + width / 2, 0);
        ctx.lineTo(u - (skew * w) / 2 + width / 2, h);
        ctx.lineTo(u - (skew * w) / 2 - width / 2, h);
        ctx.closePath();
        ctx.fill();
      }
  };
  const rotorMap = useCanvasTexture((c, w, h) => drawRotor(c, w, h, false), 'motor-rotor|1', {
    width: 1024,
    height: 256,
  });
  const rotorRough = useCanvasTexture((c, w, h) => drawRotor(c, w, h, true), 'motor-rotor|r1', {
    width: 1024,
    height: 256,
    color: false,
  });

  // Perforated end of the fan cover (alpha: white = sheet, black = hole).
  const grilleAlpha = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const mm = w / 125;
      ctx.fillStyle = '#000000';
      const pitch = 8;
      for (let row = -8; row <= 8; row++)
        for (let col = -9; col <= 9; col++) {
          const x = (col + (row % 2 ? 0.5 : 0)) * pitch;
          const y = row * pitch * 0.866;
          const r = Math.hypot(x, y);
          if (r > 56 || r < 11) continue;
          ctx.beginPath();
          ctx.arc(w / 2 + x * mm, h / 2 + y * mm, 3 * mm, 0, Math.PI * 2);
          ctx.fill();
        }
    },
    'motor-grille|1',
    { width: 512, height: 512, color: false },
  );

  const labelMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#26272a';
      ctx.fillRect(0, 0, w, h);
      const mm = w / 62;
      ctx.fillStyle = '#f2f0ea';
      const put = (text: string, x: number, z: number) =>
        fitText(ctx, text, (x + 31) * mm, (z + 21) * mm, 8 * mm, 4.4 * mm, { weight: 700 });
      STUD_X.forEach((x, i) => {
        put(LABELS_BACK[i]!, x, -STUD_Z - 7.2);
        put(LABELS_FRONT[i]!, x, STUD_Z + 7.2);
      });
    },
    'motor-terminals|1',
    { width: 496, height: 336, fonts: [`700 40px ${FONT_SANS}`] },
  );

  const plateMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#cfd2d5';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2a2c2f';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#1d1f22';
      const lines = mono
        ? [
            'MOTOR DE INDUÇÃO MONOFÁSICO',
            'CARCAÇA 80 · 4 POLOS · 60 Hz',
            '0,75 kW (1 CV) · 1.730 rpm',
            '110/220 V · 11,6/5,8 A',
            'CAPACITOR DE PARTIDA · IP55',
          ]
        : [
            'MOTOR DE INDUÇÃO TRIFÁSICO',
            'CARCAÇA 80 · 4 POLOS · 60 Hz',
            '0,75 kW (1 CV) · 1.720 rpm',
            '220/380 V · 3,02/1,75 A',
            'IP55 · ISOL. F · FS 1,15',
          ];
      lines.forEach((text, i) =>
        fitText(ctx, text, w / 2, 52 + i * 54, w - 60, i === 0 ? 38 : 34, {
          weight: i === 0 ? 800 : 600,
        }),
      );
    },
    `motor-plate|${mono ? 1 : 3}`,
    { width: 512, height: 310, fonts: [`800 38px ${FONT_SANS}`, `600 34px ${FONT_SANS}`] },
  );

  // Rotor and fan speed.
  const reduced = useReducedMotion();
  const rotor = useRef<Group>(null);
  const fan = useRef<Group>(null);
  const rpm = Math.max(Number(p.rpm) || 0, 0);
  const rps = Math.min(visualRps(rpm), reduced ? 0.25 : Infinity);
  const sense = p.direction === 'anti-horario' ? 1 : -1;
  useFrame((_, dt) => {
    if (rps === 0) return;
    const step = sense * 2 * Math.PI * rps * Math.min(dt, 0.05);
    if (rotor.current) rotor.current.rotation.x += step;
    if (fan.current) fan.current.rotation.x += step;
  });

  const paintMaterial = (
    <Material
      color={paint}
      metalness={0}
      roughness={0.62}
      roughnessMap={noise}
      clearcoat={0.12}
      clearcoatRoughness={0.5}
      clip
      cutColor="#47494d"
    />
  );
  const steel = <Material preset="steel" color="#d0d3d6" roughness={0.22} />;

  return (
    <group position={[0, H, 0]}>
      {/* Frame, feet, terminal box and (single phase) capacitor housing: one casting. */}
      <mesh geometry={geo.frame}>{paintMaterial}</mesh>
      <mesh geometry={geo.holes}>
        <Material color="#141517" roughness={0.9} clip />
      </mesh>
      <mesh geometry={geo.nameplate}>
        <Material color="#ffffff" map={plateMap} metalness={0.55} roughness={0.42} clip />
      </mesh>

      {/* Stator core and winding. */}
      <mesh geometry={geo.stator}>
        <Material
          attach="material-0"
          preset="siliconSteel"
          color="#8a8e93"
          roughness={0.42}
          clip
          cutColor="#55595e"
        />
        <Material
          attach="material-1"
          preset="siliconSteel"
          color="#ffffff"
          map={lamColor}
          roughnessMap={lamRough}
          roughness={0.6}
          clip
          cutColor="#55595e"
        />
      </mesh>
      <mesh geometry={geo.slots}>
        <Material preset="magnetWire" clip cutColor="#a8562e" />
      </mesh>
      <mesh geometry={geo.coils}>
        <Material
          preset="magnetWire"
          color="#ffffff"
          map={turnsMap}
          bumpMap={turnsBump}
          bumpScale={0.6}
          clip
          cutColor="#9c4a26"
        />
      </mesh>

      {/* Terminal box contents. */}
      <mesh geometry={geo.leads}>
        <Material preset="pvc" color="#e8e4da" roughness={0.5} />
      </mesh>
      <mesh geometry={geo.block}>
        <Material preset="pbtBlack" color="#26272a" />
      </mesh>
      <mesh geometry={geo.labelPlane}>
        <Material color="#ffffff" map={labelMap} roughness={0.6} />
      </mesh>
      <mesh geometry={geo.studGeo}>
        <Material preset="brass" roughness={0.3} roughnessMap={noise} />
      </mesh>
      <mesh geometry={geo.gland}>
        <Material preset="absBlack" roughness={0.55} clip />
      </mesh>
      <Explode offset={[0, 70, 0]}>
        <mesh geometry={geo.lid}>{paintMaterial}</mesh>
        <mesh geometry={geo.lidScrews}>
          <Material preset="zinc" clip />
        </mesh>
      </Explode>

      {mono && geo.capacitor && geo.switchBlock && (
        <>
          <mesh geometry={geo.capacitor}>
            <Material preset="absBlack" color="#1f2023" roughness={0.45} />
          </mesh>
          <mesh geometry={geo.switchBlock}>
            <Material preset="pbtBlack" color="#3a2c22" roughness={0.6} />
          </mesh>
        </>
      )}

      {/* Rear: shield, fan and fan cover. */}
      <Explode offset={[-38, 0, 0]} delay={0.1}>
        <mesh geometry={geo.rearShield}>{paintMaterial}</mesh>
      </Explode>
      <Explode offset={[-80, 0, 0]} delay={0.05}>
        <group ref={fan}>
          <mesh geometry={geo.fan}>
            <Material preset="absDark" color="#2a2c30" roughness={0.6} />
          </mesh>
        </group>
        <Anchor name="fan" position={[-127, 48, 26]} />
      </Explode>
      <Explode offset={[-140, 0, 0]}>
        <mesh geometry={geo.cover}>{paintMaterial}</mesh>
        <mesh geometry={geo.grille}>
          <Material
            color={paint}
            metalness={0}
            roughness={0.62}
            clearcoat={0.12}
            alphaMap={grilleAlpha}
            alphaTest={0.5}
            clip
            cutColor="#47494d"
          />
        </mesh>
      </Explode>

      {/* Rotor with shaft, key and bearings: pulled out forward; front shield beyond it. */}
      <Explode offset={[200, 0, 0]} delay={0.2}>
        <group ref={rotor}>
          <mesh geometry={geo.shaft}>{steel}</mesh>
          <mesh geometry={geo.rotorCore}>
            <Material
              color="#ffffff"
              map={rotorMap}
              roughnessMap={rotorRough}
              metalness={1}
              roughness={1}
            />
          </mesh>
          <mesh geometry={geo.cage}>
            <Material preset="aluminum" color="#c9ccd0" roughness={0.45} roughnessMap={noise} />
          </mesh>
          {mono && geo.switchRotor && (
            <mesh geometry={geo.switchRotor}>
              <Material preset="zinc" roughness={0.35} />
            </mesh>
          )}
        </group>
        <mesh geometry={geo.bearings}>
          <Material preset="chrome" color="#d9dcdf" roughness={0.18} />
        </mesh>
        <mesh geometry={geo.seal}>
          <Material preset="rubber" />
        </mesh>
        <Anchor name="rotor" position={[-12, R_ROTOR, 12]} />
        <Anchor name="cage" position={[-STACK - 4, 30, 20]} />
        <Anchor name="bearing" position={[97, 23.5, 4]} />
        <Anchor name="shaft" position={[KEY_X + 6, 12, 0]} />
        {mono && <Anchor name="switch" position={[-76, 22, 6]} />}
      </Explode>
      <Explode offset={[236, 0, 0]} delay={0.35}>
        <mesh geometry={geo.frontShield}>{paintMaterial}</mesh>
      </Explode>
    </group>
  );
}
