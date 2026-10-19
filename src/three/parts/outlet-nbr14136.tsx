/**
 * Brazilian wall outlet 2P+T (ABNT NBR 14136, based on IEC 60906-1) on a
 * 4 × 2" plate: plate (73 × 116 mm), support frame with the box screws
 * (83,5 mm apart) and the outlet module (44,2 × 22,6 mm face) behind it.
 *
 * Dimensions and sources:
 * - Pin layout from IEC 60906-1 / NBR 14136: phase and neutral pins 19 mm
 *   apart (centres), earth pin in the middle, 3 mm off their line; pins
 *   19 mm long. NBR 14136 pins: Ø 4,0 mm (10 A) and Ø 4,8 mm (20 A), so a
 *   20 A plug does not enter a 10 A outlet.
 * - Plug face: flat hexagon 35,5 mm wide, 17 mm high, slanted faces 26 mm
 *   apart (IEC 60906-1). The outlet recess (rebaixo) is that outline plus
 *   0,5 mm of clearance, 10 mm deep (the IEC "10 mm recess" option).
 * - Assumptions (not from the standard text): hole diameters 4,4 mm (10 A)
 *   and 5,2 mm (20 A); earth hole below the line, as on most modules
 *   mounted horizontally; phase on the right seen from the front (a common
 *   recommendation, not a rule); module 37 mm deep; bronze fork contacts,
 *   brass screw terminals; plate, frame and module sizes as in the other
 *   4 × 2 parts of the kit (typical catalogues of Brazilian lines).
 *
 * Faces +Z, centred on the plate; the cutaway is the vertical plane x = 0
 * through the earth hole (the phase half is removed).
 */
import { BoxGeometry, Shape, ShapeGeometry, type BufferGeometry } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import {
  addRoundedRect,
  extrudeAlongZ,
  mergeAll,
  roundedRectShape,
  roundedRectSweep,
  screwHeadGeometry,
  shellGeometry,
  threadedRodGeometry,
} from './_em-geometry';
import { Decal } from './_em-kit';
import {
  circlePath,
  leadGeometry,
  polygonPath,
  polygonShape,
  PVC,
  roundedPolygon,
  useEarthStripeTexture,
  type Pt,
} from './_home-kit';
import { useGeometrySet } from './_power-shared';

type Rating = 10 | 20;
type OutletColor = 'branco' | 'preto';

export interface OutletNbr14136Props {
  /** Rated current (A): 10 or 20. Sets the pin and hole diameters. */
  rating?: Rating;
  /** A matching 3-pin plug pushed into the outlet. */
  plug?: boolean;
  color?: OutletColor;
}

const COLORS: Record<
  OutletColor,
  { color: string; cut: string; body: string; plug: string; label: string; ink: string }
> = {
  branco: {
    color: '#f1f0eb',
    cut: '#cfcdc6',
    body: '#eae7df',
    plug: '#efeee9',
    label: 'branca',
    ink: '#8d8c87',
  },
  preto: {
    color: '#1e1e20',
    cut: '#0e0e0f',
    body: '#2a2a2d',
    plug: '#202022',
    label: 'preta',
    ink: '#77777a',
  },
};

/** Wall plate (mm): width, height, skirt depth, front thickness, corner radius, edge fillet, wall. */
const P = { W: 73, H: 116, D: 7, T: 2.2, r: 5, f: 2.4, wall: 1.6 };
/** Module face (one 4 × 2 module, horizontal). */
const MOD = { W: 44.2, H: 22.6 };
/** Plate opening for the module. */
const OPENING = { W: MOD.W + 0.8, H: MOD.H + 0.8 };
/** Front of the module face, floor of the recess and back of the front piece (z). */
const FRONT = 7.8;
const RECESS_DEPTH = 10;
const FLOOR = FRONT - RECESS_DEPTH;
const FLOOR_T = 2.5;
const FRONT_BACK = FLOOR - FLOOR_T;
/** Back face of the module body (z). */
const BACK = -29;
const BODY = { W: 45, H: 23, wall: 1.2 };
/** Pins: phase (right, seen from the front), neutral (left), earth (middle, 3 mm below). */
const PIN_X = 9.5;
const EARTH_Y = -3;
const PIN_LENGTH = 19;
/** Plug face: flat hexagon (IEC 60906-1). */
/**
 * `c`: the slanted faces are the lines |x| + |y| = c (26 mm apart, so
 * c = 26 / √2); `round`: corner rounding, which brings the width to 35,5 mm.
 */
const PLUG = { halfHeight: 8.5, c: 13 * Math.SQRT2, round: 1.8 };
/** Recess: plug outline + 0,5 mm clearance all round. */
const RECESS = { halfHeight: 9, c: 13.5 * Math.SQRT2, round: 1.8 };
/** Plug face sits just off the recess floor. */
const PLUG_FACE = FLOOR + 0.3;
/** Terminal screws on the back (x), all at y = TERMINAL_Y; wire entries below them. */
const TERMINAL_Y = 5.5;
const ENTRY_Y = -4.5;
const TERMINALS = { fase: 14, terra: 0, neutro: -14 } as const;

const pinDiameter = (rating: Rating) => (rating === 20 ? 4.8 : 4.0);
const holeDiameter = (rating: Rating) => (rating === 20 ? 5.2 : 4.4);

function ratingOf(v: unknown): Rating {
  return Number(v) === 20 ? 20 : 10;
}
function colorOf(v: unknown): OutletColor {
  return v === 'preto' ? 'preto' : 'branco';
}

export const meta: PartMeta = {
  id: 'outlet-nbr14136',
  label: 'Tomada padrão brasileiro (NBR 14136)',
  category: 'conexoes',
  summary:
    'Tomada 2P+T do padrão brasileiro em placa 4 × 2: rebaixo, furos de 10 A ou 20 A, contatos de fase, neutro e terra e os bornes de ligação atrás.',
  defaults: { rating: 10, plug: false, color: 'branco' },
  controls: {
    rating: {
      kind: 'select',
      label: 'Corrente nominal',
      options: [
        { value: 10, label: '10 A (pinos de 4,0 mm)' },
        { value: 20, label: '20 A (pinos de 4,8 mm)' },
      ],
    },
    plug: { kind: 'toggle', label: 'Plugue encaixado' },
    color: {
      kind: 'select',
      label: 'Cor',
      options: [
        { value: 'branco', label: 'Branca' },
        { value: 'preto', label: 'Preta' },
      ],
    },
  },
  annotations: (p): PartAnnotation[] => {
    const rating = ratingOf(p.rating);
    const cy = P.H / 2;
    return [
      {
        at: [-RECESS.c + RECESS.halfHeight + 1, cy + RECESS.halfHeight, FRONT - 1],
        text: 'Rebaixo: os dedos não alcançam os pinos',
        exploded: false,
      },
      {
        at: [0, cy + EARTH_Y, FLOOR + 0.4],
        text: 'Contato de terra (pino do meio, fora da linha)',
        exploded: false,
      },
      {
        at: [0, 0, 0],
        text: 'Contato de terra (pino do meio, fora da linha)',
        anchor: 'terra',
        exploded: true,
      },
      { at: [0, 0, 0], text: 'Contatos de fase e neutro', anchor: 'contatos', exploded: true },
      { at: [0, 0, 0], text: 'Bornes de ligação', anchor: 'bornes' },
      {
        at: [0, 0, 0],
        text: rating === 20 ? '20 A: pinos de 4,8 mm' : '10 A: pinos de 4,0 mm',
        anchor: p.plug ? 'pino' : 'furo',
      },
      {
        at: [0, 0, 0],
        text: 'Suporte: parafusos na caixa 4 × 2',
        anchor: 'suporte',
        exploded: true,
      },
    ];
  },
  explode: true,
  cutaway: true,
  // Vertical cut through the earth pin: the recess depth, the earth fork in
  // section and the neutral fork whole (the phase half, x > 0, is removed).
  cut: { normal: [-1, 0, 0], through: [0, P.H / 2, 0] },
  describe: (p) => {
    const rating = ratingOf(p.rating);
    const color = COLORS[colorOf(p.color)].label;
    const pin = formatNumber(pinDiameter(rating), 2);
    const accepts =
      rating === 20
        ? 'Aceita plugues de 10 A e de 20 A.'
        : 'O plugue de 20 A, de pinos mais grossos, não entra.';
    const plug = p.plug ? ' Um plugue de 3 pinos está encaixado.' : '';
    return `Tomada 2P+T de ${rating} A do padrão brasileiro (NBR 14136), ${color}, em placa 4 × 2, para pinos de ${pin} mm. O furo de terra fica no meio, fora da linha da fase e do neutro, e os bornes de ligação ficam atrás. ${accepts}${plug}`;
  },
  view: [0.75, 0.5, 1.35],
};

/** Flat hexagon of the plug and of the recess, rounded corners. */
function hexagon({ halfHeight: b, c, round }: typeof PLUG): Pt[] {
  return roundedPolygon(
    [
      [c - b, b],
      [-(c - b), b],
      [-c, 0],
      [-(c - b), -b],
      [c - b, -b],
      [c, 0],
    ],
    round,
  );
}

/** The plate as a thin shell (same construction as the other 4 × 2 plates), facing +Z. */
function plateGeometry(): BufferGeometry {
  const { W, H, D, T, r, f, wall } = P;
  const outer: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 2) * (i / 6);
    outer.push([-f + Math.cos(a) * f, D - f + Math.sin(a) * f]);
  }
  const face = (w: number, h: number, rr: number, y: number, up: boolean) => {
    const s = new Shape();
    addRoundedRect(s, w, h, rr);
    const hole = polygonPath(rectPoints(OPENING.W, OPENING.H, 1.4).map(([x, z]) => [x, z] as Pt));
    s.holes.push(hole);
    const g = new ShapeGeometry(s, 8);
    g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
    g.translate(0, y, 0);
    return g;
  };
  const g = mergeAll([
    roundedRectSweep(W, H, r, outer),
    face(W - 2 * f, H - 2 * f, r - f, D, true),
    roundedRectSweep(OPENING.W, OPENING.H, 1.4, [
      [0, D],
      [0, D - T],
    ]),
    face(W - 2 * wall, H - 2 * wall, r - wall, D - T, false),
    roundedRectSweep(W, H, r, [
      [-wall, D - T],
      [-wall, 0],
    ]),
    roundedRectSweep(W, H, r, [
      [-wall, 0],
      [0, 0],
    ]),
  ]);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Points of a rounded rectangle (for hole paths). */
function rectPoints(w: number, h: number, r: number): Pt[] {
  return roundedPolygon(
    [
      [w / 2, h / 2],
      [-w / 2, h / 2],
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
    ],
    r,
  );
}

/** A box at a position, turned about Z. */
function box(w: number, h: number, d: number, [x, y, z]: Vec3, rotZ = 0, rotY = 0) {
  const g = new BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return g;
}

/** Bar in the XY plane from a to b (width w, thickness t) at depth z. */
function bar(a: Pt, b: Pt, w: number, t: number, z: number) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return box(length + w, w, t, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], angle);
}

export default function OutletNbr14136(props: OutletNbr14136Props) {
  const p = { ...meta.defaults, ...props } as Required<OutletNbr14136Props>;
  const rating = ratingOf(p.rating);
  const colorKey = colorOf(p.color);
  const c = COLORS[colorKey];
  const noise = getNoiseTexture();
  const stripe = useEarthStripeTexture();
  const cy = P.H / 2;
  const pinR = pinDiameter(rating) / 2;
  const holeR = holeDiameter(rating) / 2;

  const poles: { key: keyof typeof TERMINALS; at: Pt }[] = [
    { key: 'fase', at: [PIN_X, 0] },
    { key: 'neutro', at: [-PIN_X, 0] },
    { key: 'terra', at: [0, EARTH_Y] },
  ];

  const g = useGeometrySet(() => {
    const plate = plateGeometry();

    // Support frame (with the module window and the box-screw slots).
    const frameShape = roundedRectShape(66, 108, 3);
    frameShape.holes.push(polygonPath(rectPoints(BODY.W + 1, BODY.H + 1, 1)));
    for (const y of [-41.75, 41.75]) frameShape.holes.push(polygonPath(slotPoints(y)));
    const frame = extrudeAlongZ(frameShape, 1.6, 0.3, { curveSegments: 6 });
    frame.translate(0, 0, 1.2);

    // Box screws (heads and shanks).
    const screws = mergeAll(
      [-41.75, 41.75].flatMap((y) => {
        const head = screwHeadGeometry(3.4, 1.6, 'fenda', { slot: 0.9 });
        head.rotateY(0.3);
        head.rotateX(Math.PI / 2);
        head.translate(0, y, 2.8);
        const shank = threadedRodGeometry(3.5, 0.6, 20, 10);
        shank.rotateX(-Math.PI / 2);
        shank.translate(0, y, 2.8);
        return [head, shank];
      }),
    );

    // Front piece: face with the recess, and the floor with the three holes.
    const faceShape = roundedRectShape(MOD.W, MOD.H, 1.2);
    faceShape.holes.push(polygonPath(hexagon(RECESS)));
    const wall = extrudeAlongZ(faceShape, RECESS_DEPTH, 0.45, {
      curveSegments: 6,
      bevelSegments: 3,
    });
    wall.translate(0, 0, (FRONT + FLOOR) / 2);
    const floorShape = roundedRectShape(MOD.W, MOD.H, 1.2);
    for (const pole of poles) floorShape.holes.push(circlePath(pole.at[0], pole.at[1], holeR));
    const floor = extrudeAlongZ(floorShape, FLOOR_T, 0, { curveSegments: 16 });
    floor.translate(0, 0, FLOOR - FLOOR_T / 2);
    // Short bores behind the holes (lead-in to the contacts).
    const bores = poles.map((pole) => {
      const s = new Shape();
      s.absarc(pole.at[0], pole.at[1], holeR + 1.2, 0, Math.PI * 2, false);
      s.holes.push(circlePath(pole.at[0], pole.at[1], holeR + 0.15));
      const b = extrudeAlongZ(s, 2.2, 0, { curveSegments: 16 });
      b.translate(0, 0, FRONT_BACK - 1.1);
      return b;
    });
    const front = mergeAll([wall, floor, ...bores]);

    // Back body: hollow, open towards the front piece, closed at the back.
    const body = shellGeometry(BODY.W, FRONT_BACK - BACK, BODY.H, 1.2, 0.8, BODY.wall, 1.6);
    body.rotateX(-Math.PI / 2);
    body.translate(0, 0, FRONT_BACK);

    // Fork contacts (bronze): two leaves per pin, lead-in flares, the
    // bottom of the fork, a stem and the bar to the terminal.
    const leafX = pinR + 0.25;
    const contactParts: BufferGeometry[] = [];
    for (const pole of poles) {
      const [px, py] = pole.at;
      for (const s of [-1, 1]) {
        contactParts.push(box(0.5, 4.2, 13, [px + s * leafX, py, -12.5]));
        contactParts.push(box(0.5, 4.2, 1.8, [px + s * (leafX + 0.45), py, -5.4], 0, s * 0.55));
      }
      contactParts.push(box(2 * leafX + 0.5, 4.2, 0.6, [px, py, -19.3]));
      contactParts.push(box(1.4, 3.6, 2.6, [px, py, -20.9]));
      contactParts.push(bar([px, py], [TERMINALS[pole.key], TERMINAL_Y], 3.6, 0.6, -22.5));
    }
    const contacts = mergeAll(contactParts);

    // Screw terminals: brass block inside, clamp plate and screw on the back face.
    const terminalParts: BufferGeometry[] = [];
    for (const x of Object.values(TERMINALS)) {
      terminalParts.push(box(6, 6, -22.8 - (BACK + 0.3), [x, TERMINAL_Y, (BACK + 0.3 - 22.8) / 2]));
      terminalParts.push(box(6.4, 6.4, 0.7, [x, TERMINAL_Y, BACK - 0.35]));
      const head = screwHeadGeometry(2.6, 1.8, 'combinada', { slot: 0.8 });
      head.rotateY(0.5 + x * 0.05);
      head.rotateX(-Math.PI / 2);
      head.translate(x, TERMINAL_Y, BACK - 0.7);
      terminalParts.push(head);
    }
    const terminals = mergeAll(terminalParts);

    // Wire-entry holes on the back face.
    const entries = mergeAll(
      Object.values(TERMINALS).map((x) => {
        const plane = box(3.8, 3.6, 0.02, [x, ENTRY_Y, BACK - 0.02]);
        return plane;
      }),
    );

    // Wires out of the back: down towards the box.
    const wireR = 1.75; // 2,5 mm² (circuits of outlets, NBR 5410)
    const wire = (x: number, spread: number) =>
      leadGeometry(
        [
          [x, ENTRY_Y, BACK + 4],
          [x, ENTRY_Y, BACK - 9],
          [x + spread, ENTRY_Y - 8, BACK - 13],
          [x + spread * 1.6, -cy + 6, BACK - 16],
        ],
        wireR,
        { bend: 6, conductor: 0.89, end: 'cut' },
      );
    const fase = wire(TERMINALS.fase, 4);
    const neutro = wire(TERMINALS.neutro, -4);
    const terra = wire(TERMINALS.terra, 0);

    return {
      plate,
      frame,
      screws,
      front,
      body,
      contacts,
      terminals,
      entries,
      fase: fase.insulation,
      neutro: neutro.insulation,
      terra: terra.insulation,
      copper: mergeAll([fase.copper, neutro.copper, terra.copper]),
    };
  }, [rating]);

  const plugGeometry = useGeometrySet(() => {
    if (!p.plug) return {} as Record<string, BufferGeometry>;
    const front = extrudeAlongZ(polygonShape(hexagon(PLUG)), 14, 0.6, {
      curveSegments: 4,
      bevelSegments: 2,
    });
    front.translate(0, 0, PLUG_FACE + 7);
    const rearOutline = hexagon({ halfHeight: 8.1, c: PLUG.c - 0.9, round: 3 });
    const rear = extrudeAlongZ(polygonShape(rearOutline), 18, 3.2, {
      curveSegments: 4,
      bevelSegments: 4,
    });
    rear.translate(0, 0, PLUG_FACE + 12 + 9);
    const gland = axialLathe(
      [
        [0, 0],
        [6, 0],
        [6, 4],
        [4.6, 11],
        [4.1, 13],
        [0, 13],
      ],
      24,
    );
    gland.rotateX(Math.PI / 2);
    gland.translate(0, 0, PLUG_FACE + 28);
    const body = mergeAll([front, rear, gland]);

    const pins = mergeAll(
      poles.map((pole) => {
        const pin = axialLathe(
          [
            [0, 0],
            [pinR * 0.55, 0.05],
            [pinR * 0.88, 0.45],
            [pinR, 1.2],
            [pinR, PIN_LENGTH + 1],
            [0, PIN_LENGTH + 1],
          ],
          20,
        );
        pin.rotateX(Math.PI / 2);
        pin.translate(pole.at[0], pole.at[1], PLUG_FACE - PIN_LENGTH);
        return pin;
      }),
    );

    const cable = leadGeometry(
      [
        [0, 0, PLUG_FACE + 39],
        [0, 0, PLUG_FACE + 50],
        [0, -cy + 3.6, PLUG_FACE + 72],
        [0, -cy + 3.6, PLUG_FACE + 100],
      ],
      3.6,
      { bend: 16, conductor: 3.1, end: 'cut', radial: 16 },
    );
    return { body, pins, cable: cable.insulation, cableEnd: cable.copper };
  }, [rating, p.plug]);

  const faceLabel = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = c.ink;
      const opts = { weight: 600, family: FONT_SANS };
      fitText(ctx, `${rating}A`, w * 0.115, h / 2, w * 0.1, h * 0.8, opts);
      fitText(ctx, '250V~', w * 0.87, h / 2, w * 0.16, h * 0.8, opts);
    },
    `face|${rating}|${colorKey}`,
    { width: 1024, height: 56, fonts: [`600 40px ${FONT_SANS}`] },
  );
  const topLabel = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colorKey === 'preto' ? '#9a9a9c' : '#5b5b58';
      const opts = { weight: 700, family: FONT_SANS };
      fitText(ctx, `2P+T  ${rating}A  250V~`, w / 2, h * 0.3, w * 0.92, h * 0.36, opts);
      fitText(ctx, 'NBR 14136', w / 2, h * 0.74, w * 0.6, h * 0.3, { weight: 600 });
    },
    `top|${rating}|${colorKey}`,
    { width: 512, height: 128, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const backLabel = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colorKey === 'preto' ? '#a3a3a5' : '#5b5b58';
      ctx.strokeStyle = ctx.fillStyle;
      // Seen from the back, the phase terminal is on the left.
      const at = (x: number) => w / 2 - (x / 40) * w;
      fitText(ctx, 'F', at(TERMINALS.fase), h / 2, h, h * 0.8, { weight: 700 });
      fitText(ctx, 'N', at(TERMINALS.neutro), h / 2, h, h * 0.8, { weight: 700 });
      // Earth symbol.
      const x = at(TERMINALS.terra);
      ctx.lineWidth = h * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.12);
      ctx.lineTo(x, h * 0.5);
      for (const [k, half] of [
        [0.5, 0.32],
        [0.68, 0.21],
        [0.86, 0.1],
      ] as const) {
        ctx.moveTo(x - h * half, h * k);
        ctx.lineTo(x + h * half, h * k);
      }
      ctx.stroke();
    },
    `back|${colorKey}`,
    { width: 512, height: 46, fonts: [`700 40px ${FONT_SANS}`] },
  );

  const shell = {
    roughness: 0.3,
    roughnessMap: noise,
    clearcoat: 0.3,
    clip: true,
    cutColor: c.cut,
  };
  const bronze = { preset: 'brass' as const, color: '#cf9f5c', roughness: 0.34 };
  const plugExplode: Vec3 = [0, 0, 110];

  return (
    <group position={[0, cy, 0]}>
      {/* Plate. */}
      <Explode offset={[0, 0, 62]} delay={0.1}>
        <mesh geometry={g.plate}>
          <Material color={c.color} {...shell} />
        </mesh>
      </Explode>

      {/* Support frame and box screws. */}
      <Explode offset={[0, 0, 16]}>
        <mesh geometry={g.frame}>
          <Material preset="absDark" roughness={0.55} clip />
        </mesh>
        <mesh geometry={g.screws}>
          <Material preset="zinc" roughness={0.38} clip />
        </mesh>
        <Anchor name="suporte" position={[-3.4, 41.75, 4]} />
      </Explode>

      {/* Front of the outlet: face, recess and the three holes. */}
      <Explode offset={[0, 0, 36]} delay={0.05}>
        <mesh geometry={g.front}>
          <Material color={c.color} {...shell} />
        </mesh>
        <Decal
          map={faceLabel}
          width={MOD.W - 1}
          height={2.4}
          position={[0, RECESS.halfHeight + 0.15, FRONT + 0.012]}
          roughness={0.45}
          clip
        />
        <Anchor name="furo" position={[PIN_X, 0, FLOOR + 0.2]} />
      </Explode>

      {/* Fork contacts (stay in place). */}
      <mesh geometry={g.contacts}>
        <Material {...bronze} clip cutColor="#a87a3e" />
      </mesh>
      <Anchor name="contatos" position={[PIN_X + pinR + 0.6, 2.1, -9]} />
      <Anchor name="terra" position={[0, EARTH_Y - 2.1, -9]} />

      {/* Back body with the screw terminals and the wires. */}
      <Explode offset={[0, 0, -34]} delay={0.1}>
        <mesh geometry={g.body}>
          <Material
            color={c.body}
            roughness={0.5}
            roughnessMap={noise}
            clip
            cutColor={colorKey === 'preto' ? '#141415' : '#c9c6bd'}
          />
        </mesh>
        <Decal
          map={topLabel}
          width={22}
          height={5.5}
          position={[0, BODY.H / 2 + 0.012, (FRONT_BACK + BACK) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          clip
        />
        <Decal
          map={backLabel}
          width={40}
          height={3.6}
          position={[0, 0.4, BACK - 0.012]}
          rotation={[0, Math.PI, 0]}
          clip
        />
        <mesh geometry={g.entries}>
          <Material color="#121212" roughness={0.9} clip />
        </mesh>
        <mesh geometry={g.terminals}>
          <Material preset="brass" color="#e0c27f" roughness={0.3} clip cutColor="#b08a45" />
        </mesh>
        <mesh geometry={g.fase}>
          <Material preset="pvc" color={PVC.preto} clip />
        </mesh>
        <mesh geometry={g.neutro}>
          <Material preset="pvc" color={PVC.azulClaro} clip />
        </mesh>
        <mesh geometry={g.terra}>
          <Material preset="pvc" color="#ffffff" map={stripe} clip />
        </mesh>
        <mesh geometry={g.copper}>
          <Material preset="copper" roughness={0.35} clip />
        </mesh>
        <Anchor name="bornes" position={[TERMINALS.fase, TERMINAL_Y + 2.6, BACK - 1.6]} />
      </Explode>

      {/* Plug pushed in. */}
      {p.plug && plugGeometry.body && (
        <Explode offset={plugExplode} delay={0}>
          <mesh geometry={plugGeometry.body}>
            <Material
              color={c.plug}
              roughness={0.42}
              roughnessMap={noise}
              clearcoat={0.15}
              clip
              cutColor={colorKey === 'preto' ? '#111112' : '#d2d0c9'}
            />
          </mesh>
          <mesh geometry={plugGeometry.pins}>
            <Material preset="nickel" roughness={0.26} clip cutColor="#8f8c86" />
          </mesh>
          <mesh geometry={plugGeometry.cable}>
            <Material preset="pvc" color={c.plug} roughness={0.5} clip />
          </mesh>
          <mesh geometry={plugGeometry.cableEnd}>
            <Material color="#3a3a3a" roughness={0.8} clip />
          </mesh>
          <Anchor name="pino" position={[PIN_X, pinR, PLUG_FACE - 10]} />
        </Explode>
      )}
    </group>
  );
}

/** Slot for a box screw in the support frame. */
function slotPoints(y: number): Pt[] {
  return rectPoints(7.5, 3.8, 1.85).map(([x, yy]) => [x, yy + y] as Pt);
}
