/**
 * Typical Brazilian electric shower (chuveiro elétrico), 220 V, 5.500 W in
 * the winter position. Real-ish sizes from catalogue photos and the usual
 * construction of these showers (assumptions, not one model): white
 * plastic body Ø 113 × 106 mm, ½" water inlet (G ½ thread, Ø 20,96 mm,
 * pitch 1,814 mm) on top with the three 6 mm² leads beside it, round
 * spreader Ø 98,6 mm with about 300 holes of Ø 1,5 mm.
 *
 * Inside, from the bottom: the heating chamber with the bare nickel-chrome
 * resistance (Ø 0,9 mm wire wound into a coil of Ø 5,2 mm, laid as a flat
 * spiral) and its three terminals (comum, verão, inverno); the rubber
 * diaphragm on top of the chamber; the contact plate that the diaphragm
 * lifts when the water pressure arrives; the support with the fixed
 * contacts; the top cover and the selector lever.
 *
 * Wiring (simplified from the real thing): lead 1 (preto) → fixed contact
 * F1 → inner copper ring of the plate → contact C → comum; lead 2
 * (vermelho) → contact F2 → outer copper bridge → contact V (verão) or I
 * (inverno). The lever turns the plate, and so the outer bridge: verão
 * puts the whole coil (≈ 16 Ω, ≈ 3.000 W) across 220 V, inverno only 55 %
 * of it (≈ 8,8 Ω, 5.500 W), desligado leaves F2 alone. No water, no
 * pressure: the plate stays down and nothing heats.
 *
 * Y up, spreader resting on y = 0; the cutaway removes the right half (x > 0).
 */
import { useMemo, useRef } from 'react';
import {
  Color,
  Curve,
  Float32BufferAttribute,
  LatheGeometry,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Group,
  type Mesh,
} from 'three';
import { Anchor, Explode } from '../core/view';
import { blackbodyColor } from '../fx/blackbody';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { roundedPath, tube } from '../shapes/geometry';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import { extrudeUp, mergeAll, threadedRodGeometry } from './_em-geometry';
import { useSmooth } from './_em-kit';
import { leadGeometry, PVC, useEarthStripeTexture } from './_home-kit';
import { lathe, shellProfile, useGeometrySet } from './_power-shared';

type Mode = 'desligado' | 'verao' | 'inverno';

export interface ElectricShowerProps {
  /** Selector position. */
  mode?: Mode;
  /** Water open: the pressure lifts the diaphragm and closes the contacts. */
  water?: boolean;
  /** 0..1: how hot the resistance is drawn (only with water and the selector on). */
  heating?: number;
}

const MODES: Record<Mode, { label: string; watts: string }> = {
  desligado: { label: 'desligado', watts: '0 W' },
  verao: { label: 'verão', watts: 'cerca de 3.000 W' },
  inverno: { label: 'inverno', watts: '5.500 W' },
};

const deg = Math.PI / 180;
/** Angle φ around the axis: x = r cos φ, z = r sin φ (φ = 90° is the front). */
const polar = (r: number, phi: number, y: number): Vec3 => [
  r * Math.cos(phi * deg),
  y,
  r * Math.sin(phi * deg),
];

/** Heights (mm). */
const H = {
  spreaderTop: 7,
  chamberBottom: 7,
  rim: 45,
  coil: 22,
  diaphragm: 45,
  diaphragmT: 1.5,
  plateT: 3,
  bridgeT: 0.6,
  supportBottom: 55,
  supportTop: 58,
  top: 106,
  nippleTop: 128,
};
/** Diaphragm lift with water (mm). */
const LIFT = 2.5;
const PLATE_BOTTOM = H.diaphragm + H.diaphragmT;
const BRIDGE_TOP = PLATE_BOTTOM + H.plateT + H.bridgeT;
/** Contact buttons touch the bridges once the plate is lifted. */
const BUTTON_BOTTOM = BRIDGE_TOP + LIFT;

/** Resistance: flat spiral from r 35 to r 23 over 578°, starting at the comum terminal. */
const COIL = { start: 250, sweep: 578, r0: 35, r1: 23, a: 2.6, wire: 0.45, pitch: 1.6, tap: 0.55 };
const POST_R = 41;
const angleAt = (t: number) => COIL.start + COIL.sweep * t;
const radiusAt = (t: number) => COIL.r0 + (COIL.r1 - COIL.r0) * t;
/** Terminal angles. */
const POSTS = {
  comum: COIL.start,
  inverno: angleAt(COIL.tap) % 360,
  verao: angleAt(1) % 360,
};
/** Fixed contacts: inner ring (F1, C) and outer ring (V, F2, I). */
const CONTACTS = {
  f1: { r: 14, phi: 200 },
  c: { r: 14, phi: 245 },
  v: { r: 26, phi: POSTS.verao },
  f2: { r: 26, phi: POSTS.verao + 50 },
  i: { r: 26, phi: POSTS.inverno },
};
/** Outer bridge: span and centre angle for each selector position. */
const BRIDGE_SPAN = 62;
const BRIDGE_AT: Record<Mode, number> = {
  desligado: CONTACTS.v.phi - 25,
  verao: (CONTACTS.v.phi + CONTACTS.f2.phi) / 2,
  inverno: (CONTACTS.f2.phi + CONTACTS.i.phi) / 2,
};
/** The lever points this far from the bridge (desligado at front right, inverno at front left). */
const LEVER_OFFSET = -43;
const EARTH = { r: 37, phi: 300 };

function modeOf(v: unknown): Mode {
  return v === 'desligado' || v === 'verao' ? v : 'inverno';
}

export const meta: PartMeta = {
  id: 'electric-shower',
  label: 'Chuveiro elétrico',
  category: 'saidas',
  summary:
    'Chuveiro elétrico de 220 V por dentro: resistência de níquel-cromo em espiral, diafragma que só liga com água, placa de contatos e chave verão/inverno.',
  defaults: { mode: 'inverno', water: true, heating: 0.6 },
  controls: {
    mode: {
      kind: 'select',
      label: 'Chave',
      options: [
        { value: 'desligado', label: 'Desligado' },
        { value: 'verao', label: 'Verão (morno)' },
        { value: 'inverno', label: 'Inverno (quente)' },
      ],
    },
    water: { kind: 'toggle', label: 'Água aberta' },
    heating: { kind: 'number', label: 'Aquecimento', min: 0, max: 1, step: 0.01 },
  },
  annotations: (): PartAnnotation[] => [
    {
      at: [0, 0, 0],
      text: 'Chave verão/inverno: escolhe o trecho da resistência',
      anchor: 'chave',
    },
    {
      at: [0, 0, 0],
      text: 'Fio terra verde-amarelo: ligar ao condutor de proteção',
      anchor: 'terra',
    },
    {
      at: [0, 0, 0],
      text: 'Fios de alimentação (preto e vermelho): 220 V',
      anchor: 'fios',
      exploded: false,
    },
    { at: [0, 0, 0], text: 'Espalhador: divide a água em jatos', anchor: 'espalhador' },
    {
      at: [0, 0, 0],
      text: 'Resistência: fio de níquel-cromo em espiral',
      anchor: 'resistencia',
      exploded: true,
    },
    {
      at: [0, 0, 0],
      text: 'Terminais: comum, verão e inverno',
      anchor: 'terminais',
      exploded: true,
    },
    {
      at: [0, 0, 0],
      text: 'Diafragma: a pressão da água fecha os contatos',
      anchor: 'diafragma',
      exploded: true,
    },
    {
      at: [0, 0, 0],
      text: 'Placa de contatos: sobe com o diafragma e liga a resistência',
      anchor: 'placa',
      exploded: true,
    },
    {
      at: [0, 0, 0],
      text: 'Contatos fixos, ligados aos fios e aos terminais',
      anchor: 'contatos',
      exploded: true,
    },
    {
      at: [0, 0, 0],
      text: 'Câmara de aquecimento: a água passa pela resistência',
      anchor: 'camara',
      exploded: true,
    },
    { at: [0, 0, 0], text: 'Tampa (carcaça) de plástico', anchor: 'tampa', exploded: true },
  ],
  explode: true,
  cutaway: true,
  cut: { normal: [-1, 0, 0], through: [0, 0, 0] },
  describe: (p) => {
    const mode = modeOf(p.mode);
    const water = !!p.water;
    const on = water && mode !== 'desligado';
    const sel =
      mode === 'desligado'
        ? 'com a chave em desligado'
        : `com a chave em ${MODES[mode].label} (${MODES[mode].watts})`;
    const state = water
      ? on
        ? 'Água aberta: a pressão empurra o diafragma, os contatos fecham e a resistência aquece a água.'
        : 'Água aberta, mas a chave está desligada: a água sai fria.'
      : 'Água fechada: sem pressão, o diafragma não sobe e os contatos ficam abertos.';
    return `Chuveiro elétrico de 220 V ${sel}. ${state}`;
  },
  view: [0.85, 0.5, 1.25],
};

/** Coil wound along the flat spiral, between fractions t0 and t1 of its length. */
class SpiralCoil extends Curve<Vector3> {
  constructor(
    private t0: number,
    private t1: number,
    private turns: number,
  ) {
    super();
  }
  override getPoint(u: number, target = new Vector3()): Vector3 {
    const t = this.t0 + (this.t1 - this.t0) * u;
    const phi = angleAt(t) * deg;
    const r = radiusAt(t);
    const psi = Math.PI * 2 * this.turns * t;
    const radial = r + COIL.a * Math.cos(psi);
    return target.set(
      radial * Math.cos(phi),
      H.coil + COIL.a * Math.sin(psi),
      radial * Math.sin(phi),
    );
  }
}

/** Point on the outside of the coil at fraction t (where a lead leaves it). */
function coilOutside(t: number, y = H.coil): Vec3 {
  return polar(radiusAt(t) + COIL.a, angleAt(t), y);
}

/** Lathe from a closed solid profile with the same vertex count for a morph target. */
function diaphragmProfile(lift: number): Vector2[] {
  const out: Vector2[] = [];
  const r0 = 9;
  const r1 = 40;
  const n = 30;
  const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const top = (r: number) => {
    const rise = smooth((r - 11) / 3) * (1 - smooth((r - 32.5) / 3.5));
    // A soft bead (the convolution) near the clamped edge.
    const bead = Math.exp(-(((r - 36.8) / 1.1) ** 2)) * 0.9;
    return H.diaphragm + H.diaphragmT + lift * rise + bead;
  };
  for (let i = 0; i <= n; i++) {
    const r = r0 + ((r1 - r0) * i) / n;
    out.push(new Vector2(r, top(r)));
  }
  for (let i = n; i >= 0; i--) {
    const r = r0 + ((r1 - r0) * i) / n;
    out.push(new Vector2(r, top(r) - H.diaphragmT));
  }
  out.push(out[0]!.clone());
  return out;
}

/** An annular sector (or full ring) extruded up, centred on φ = 0 and seen from above. */
function annularSector(r0: number, r1: number, span: number, y0: number, t: number) {
  const s = new Shape();
  if (span >= 360) {
    s.absarc(0, 0, r1, 0, Math.PI * 2, false);
    const hole = new Shape();
    hole.absarc(0, 0, r0, 0, Math.PI * 2, true);
    s.holes.push(hole);
  } else {
    const a = (span / 2) * deg;
    s.absarc(0, 0, r1, -a, a, false);
    s.absarc(0, 0, r0, a, -a, true);
    s.closePath();
  }
  // extrudeUp maps the shape's Y to −Z; the sector is symmetric, so φ = 0 stays the centre.
  const g = extrudeUp(s, t, Math.min(0.2, t / 3), { curveSegments: 48, bevelSegments: 1 });
  g.translate(0, y0, 0);
  return g;
}

/** Grip ribs on the rim of the spreader: the outer wall moves in and out around the axis. */
function knurl(g: BufferGeometry, from: number, ribs: number): BufferGeometry {
  const pos = g.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < from) continue;
    const a = Math.atan2(z, x);
    const k = 1 - 0.012 * Math.max(0, Math.cos(a * ribs)) ** 3;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** A vertical cylinder (y0..y1) at a polar position. */
function rod(r: number, phi: number, y0: number, y1: number, radius: number, seg = 12) {
  const g = lathe(
    [
      [0, y0],
      [radius, y0],
      [radius, y1],
      [0, y1],
    ],
    seg,
  );
  const [x, , z] = polar(r, phi, 0);
  g.translate(x, 0, z);
  return g as BufferGeometry;
}

/** A flat bar on top of the support from a to b (XZ), width w, thickness t at height y. */
function strap(a: Vec3, b: Vec3, w: number, t: number, y: number) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dz);
  const s = new Shape();
  s.moveTo(-w / 2, -w / 2);
  s.lineTo(length + w / 2, -w / 2);
  s.lineTo(length + w / 2, w / 2);
  s.lineTo(-w / 2, w / 2);
  s.closePath();
  const g = extrudeUp(s, t, 0, { curveSegments: 1 });
  // Shape X along +X, shape Y along −Z: turn to point from a to b.
  g.rotateY(-Math.atan2(dz, dx));
  g.translate(a[0], y, a[2]);
  return g;
}

export default function ElectricShower(props: ElectricShowerProps) {
  const p = { ...meta.defaults, ...props } as Required<ElectricShowerProps>;
  const mode = modeOf(p.mode);
  const water = !!p.water;
  const heating = Math.min(Math.max(Number(p.heating) || 0, 0), 1);
  const noise = getNoiseTexture();
  const stripe = useEarthStripeTexture();

  const plate = useRef<Group>(null);
  const selector = useRef<Group>(null);
  const diaphragm = useRef<Mesh>(null);

  useSmooth(
    [water ? 1 : 0, BRIDGE_AT[mode]],
    ([lift, at]) => {
      if (plate.current) {
        plate.current.position.y = lift! * LIFT;
        plate.current.rotation.y = -at! * deg;
      }
      if (selector.current) selector.current.rotation.y = -(at! + LEVER_OFFSET) * deg;
      const m = diaphragm.current;
      if (m) {
        if (!m.morphTargetInfluences) m.updateMorphTargets();
        if (m.morphTargetInfluences) m.morphTargetInfluences[0] = lift!;
      }
    },
    10,
  );

  const g = useGeometrySet(() => {
    // Top cover: bell-shaped shell, flat top around the inlet.
    const coverOuter: [number, number][] = [
      [52.4, H.spreaderTop + 0.4],
      [55, H.spreaderTop + 1],
      [56.3, H.spreaderTop + 3.4],
      [56.6, 13],
      [56.4, 27.5],
      [55.6, 28.4],
      [55.3, 29.8],
      [55.9, 31.2],
      [55.3, 40],
      [51.2, 56],
      [45.8, 72],
      [39, 87],
      [33, 99],
      [30.8, 103.4],
      [29.2, 105.4],
      [27.4, H.top],
      [12.5, H.top],
    ];
    const coverProfile = shellProfile(coverOuter, 2);
    coverProfile.push(coverProfile[0]!);
    const cover = lathe(coverProfile, 72, { angle: 40 });

    // Spreader: disc with a flat face full of holes (drawn by the decal).
    const spreader = knurl(
      lathe(
        [
          [0, 0],
          [44, 0],
          [48.4, 0.5],
          [52.6, 1.6],
          [53.4, 2.6],
          [53.4, H.spreaderTop - 0.6],
          [52.8, H.spreaderTop],
          [0, H.spreaderTop],
        ],
        180,
        { angle: 50 },
      ),
      52.5,
      60,
    );

    // Heating chamber: a cup with a wide rim that clamps the diaphragm.
    const chamber = lathe(
      [
        [0, H.chamberBottom],
        [45, H.chamberBottom],
        [46.5, H.chamberBottom + 1.5],
        [46.5, 41],
        [48.5, 41],
        [48.5, H.rim],
        [38, H.rim],
        [38, H.rim - 2],
        [44, H.rim - 2],
        [44, 9.5],
        [0, 9.5],
      ],
      72,
    );

    // Inlet tube down the middle, threaded nipple on top.
    const tubeBody = lathe(
      [
        [5, 38],
        [7, 38],
        [7, H.top + 0.5],
        [5, H.top + 0.5],
        [5, 38],
      ],
      32,
    );
    const thread = threadedRodGeometry(20.96, 1.814, H.nippleTop - H.top, 48);
    thread.translate(0, H.top, 0);
    const nippleTop = lathe(
      [
        [6.4, H.nippleTop - 3],
        [6.4, H.nippleTop],
        [9.9, H.nippleTop],
        [10.3, H.nippleTop - 0.4],
      ],
      48,
    );
    const inlet = mergeAll([tubeBody, thread, nippleTop]);

    // Resistance support ring under the coil.
    const coilSupport = lathe(
      [
        [20, 17.4],
        [38, 17.4],
        [38, 19],
        [20, 19],
        [20, 17.4],
      ],
      64,
    );

    // The coil, in two pieces: comum → inverno tap, tap → verão end.
    const length = ((COIL.r0 + COIL.r1) / 2) * COIL.sweep * deg;
    const turns = length / COIL.pitch;
    // About 10 segments per turn (the generic `tube` caps the count).
    const coilPart = (t0: number, t1: number) =>
      new TubeGeometry(
        new SpiralCoil(t0, t1, turns),
        Math.ceil(turns * (t1 - t0) * 10),
        COIL.wire,
        6,
        false,
      );
    const lead = (points: Vec3[]) => tube(roundedPath(points, 1.5), COIL.wire, { radial: 6 });
    const seg1 = mergeAll([
      coilPart(0, COIL.tap),
      lead([coilOutside(0), polar(POST_R, POSTS.comum, H.coil)]),
      lead([coilOutside(COIL.tap), polar(POST_R, POSTS.inverno, H.coil)]),
    ]);
    const vEnd = polar(radiusAt(1), angleAt(1), H.coil);
    const seg2 = mergeAll([
      coilPart(COIL.tap, 1),
      lead([vEnd, [vEnd[0], 31, vEnd[2]], polar(POST_R, POSTS.verao, 31)]),
    ]);

    // Terminal posts (brass) through the chamber rim, with nuts on top.
    const posts = mergeAll(
      Object.values(POSTS).flatMap((phi) => [
        rod(POST_R, phi, H.coil - 1.2, 61, 1.3),
        rod(POST_R, phi, 58.6, 60.2, 2.4, 6),
      ]),
    );

    // Diaphragm (flat) with the lifted shape as a morph target.
    const flat = new LatheGeometry(diaphragmProfile(0), 72);
    const lifted = new LatheGeometry(diaphragmProfile(LIFT), 72);
    flat.morphAttributes.position = [
      new Float32BufferAttribute(lifted.attributes.position!.array as Float32Array, 3),
    ];
    flat.morphAttributes.normal = [
      new Float32BufferAttribute(lifted.attributes.normal!.array as Float32Array, 3),
    ];
    lifted.dispose();

    // Contact plate (turns and lifts): plastic disc, copper ring and bridge.
    const plateBody = lathe(
      [
        [11, PLATE_BOTTOM],
        [34, PLATE_BOTTOM],
        [34, PLATE_BOTTOM + H.plateT],
        [11, PLATE_BOTTOM + H.plateT],
        [11, PLATE_BOTTOM],
      ],
      72,
    );
    const bridges = mergeAll([
      annularSector(12.2, 15.8, 360, PLATE_BOTTOM + H.plateT, H.bridgeT),
      annularSector(24, 28, BRIDGE_SPAN, PLATE_BOTTOM + H.plateT, H.bridgeT),
    ]);

    // Support of the fixed contacts.
    const support = lathe(
      [
        [13, H.supportBottom],
        [40, H.supportBottom],
        [40, H.supportTop],
        [13, H.supportTop],
        [13, H.supportBottom],
      ],
      72,
    );
    const fixed = Object.values(CONTACTS);
    const tabs = mergeAll([
      ...fixed.map((c) => rod(c.r, c.phi, BUTTON_BOTTOM + 0.6, H.supportTop + 0.6, 1.5, 10)),
      // Straps on top of the support: C, V and I to their terminal posts.
      strap(
        polar(CONTACTS.c.r, CONTACTS.c.phi, 0),
        polar(POST_R, POSTS.comum, 0),
        3,
        0.6,
        H.supportTop,
      ),
      strap(
        polar(CONTACTS.v.r, CONTACTS.v.phi, 0),
        polar(POST_R, POSTS.verao, 0),
        3,
        0.6,
        H.supportTop,
      ),
      strap(
        polar(CONTACTS.i.r, CONTACTS.i.phi, 0),
        polar(POST_R, POSTS.inverno, 0),
        3,
        0.6,
        H.supportTop,
      ),
      // Earth terminal: a lug with a screw, and the strap down to the water side.
      strap(
        polar(EARTH.r - 3, EARTH.phi, 0),
        polar(EARTH.r + 3.5, EARTH.phi, 0),
        4.5,
        0.7,
        H.supportTop,
      ),
      rod(EARTH.r + 3.2, EARTH.phi, H.rim + 1, H.supportTop + 0.7, 1.2, 8),
    ]);
    const screws = mergeAll(
      [CONTACTS.f1, CONTACTS.f2, EARTH].map((c) =>
        rod(c.r, c.phi, H.supportTop, H.supportTop + 2.4, 3, 12),
      ),
    );
    const buttons = mergeAll(
      fixed.map((c) => rod(c.r, c.phi, BUTTON_BOTTOM, BUTTON_BOTTOM + 0.6, 1.6, 16)),
    );

    // Leads: in through the top beside the inlet, down to F1, F2 and the earth lug.
    const exit = (phi: number) => polar(20, phi, 0);
    const lead6 = (from: Vec3, phi: number, bend: number) => {
      const [ex, , ez] = exit(phi);
      return leadGeometry(
        [
          [from[0], H.supportTop + 1, from[2]],
          [from[0], 68, from[2]],
          [ex, 96, ez],
          [ex, H.top + 14, ez],
          [ex * 1.15, H.top + 21, ez - 12],
          [ex * 1.15 + bend, H.top + 23, ez - 50],
        ],
        2.2,
        { bend: 7, conductor: 1.38, end: 'cut' },
      );
    };
    const preto = lead6(polar(CONTACTS.f1.r, CONTACTS.f1.phi, 0), 250, -4);
    const vermelho = lead6(polar(CONTACTS.f2.r, CONTACTS.f2.phi, 0), 270, 0);
    const terra = lead6(polar(EARTH.r, EARTH.phi, 0), 290, 4);
    const grommets = mergeAll(
      [250, 270, 290].map((phi) => {
        const [x, , z] = exit(phi);
        const r = lathe(
          [
            [2.2, H.top - 0.4],
            [3.6, H.top - 0.4],
            [3.6, H.top + 1.2],
            [3.1, H.top + 1.8],
            [2.2, H.top + 1.8],
          ],
          16,
        );
        r.translate(x, 0, z);
        return r as BufferGeometry;
      }),
    );

    // Selector: ring around the nipple, lever, and the key down to the plate.
    const ring = lathe(
      [
        [11.1, H.top + 0.2],
        [16.5, H.top + 0.2],
        [16.5, H.top + 3.4],
        [15.6, H.top + 4.4],
        [11.1, H.top + 4.4],
        [11.1, H.top + 0.2],
      ],
      48,
    );
    const arm = new Shape();
    arm.moveTo(15, -3.2);
    arm.lineTo(21.5, -2.6);
    arm.absarc(21.5, 0, 2.6, -Math.PI / 2, Math.PI / 2, false);
    arm.lineTo(15, 3.2);
    arm.closePath();
    const armGeometry = extrudeUp(arm, 3.6, 0.6, { curveSegments: 10 });
    armGeometry.translate(0, H.top + 0.6, 0);
    const grip = extrudeUp(
      (() => {
        const s = new Shape();
        s.absarc(21.5, 0, 2.4, 0, Math.PI * 2, false);
        return s;
      })(),
      6.5,
      0.8,
      { curveSegments: 16 },
    );
    grip.translate(0, H.top + 2, 0);
    const key = rod(11.6, 0, BRIDGE_TOP, H.top + 1, 0.85, 8);
    const selectorGeometry = mergeAll([ring, armGeometry, grip, key]);

    return {
      cover,
      spreader,
      chamber,
      inlet,
      coilSupport,
      seg1,
      seg2,
      posts,
      diaphragm: flat,
      plateBody,
      bridges,
      support,
      tabs,
      screws,
      buttons,
      preto: preto.insulation,
      vermelho: vermelho.insulation,
      terra: terra.insulation,
      copper: mergeAll([preto.copper, vermelho.copper, terra.copper]),
      grommets,
      selector: selectorGeometry,
    };
  }, []);

  // Hole pattern of the spreader (seen from below).
  const holes = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const R = 44;
      const s = w / (2 * R);
      const cx = w / 2;
      const cy = h / 2;
      for (let r = 6; r <= 41; r += 5) {
        const n = Math.round((2 * Math.PI * r) / 4.4);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r * 0.3;
          const x = cx + Math.cos(a) * r * s;
          const y = cy + Math.sin(a) * r * s;
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath();
          ctx.arc(x, y, 1.15 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#26292d';
          ctx.beginPath();
          ctx.arc(x, y, 0.75 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    'shower-holes',
    { width: 512, height: 512 },
  );

  // Selector markings on the flat top, read from the front.
  const marks = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const R = 29;
      const s = w / (2 * R);
      const items: [Mode, string][] = [
        ['desligado', 'DESLIGA'],
        ['verao', 'VERÃO'],
        ['inverno', 'INVERNO'],
      ];
      for (const [m, text] of items) {
        const phi = (BRIDGE_AT[m] + LEVER_OFFSET) * deg;
        const r = 26.6;
        ctx.save();
        ctx.translate(w / 2 + Math.cos(phi) * r * s, h / 2 + Math.sin(phi) * r * s);
        ctx.rotate(phi - Math.PI / 2);
        ctx.fillStyle = m === 'inverno' ? '#b8322a' : m === 'verao' ? '#2f6db3' : '#55585d';
        fitText(ctx, text, 0, 0, 15 * s, 3.1 * s, { weight: 700, family: FONT_SANS });
        ctx.restore();
        // Tick towards the lever.
        ctx.strokeStyle = '#55585d';
        ctx.lineWidth = 0.5 * s;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(phi) * 22.3 * s, h / 2 + Math.sin(phi) * 22.3 * s);
        ctx.lineTo(w / 2 + Math.cos(phi) * 23.6 * s, h / 2 + Math.sin(phi) * 23.6 * s);
        ctx.stroke();
      }
    },
    'shower-marks',
    { width: 512, height: 512, fonts: [`700 40px ${FONT_SANS}`] },
  );

  // Rating printed on the skirt.
  const rating = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#7d7f83';
      fitText(ctx, '220V~   5500W', w / 2, h / 2, w * 0.95, h * 0.8, {
        weight: 600,
        family: FONT_SANS,
      });
    },
    'shower-rating',
    { width: 512, height: 64, fonts: [`600 40px ${FONT_SANS}`] },
  );

  // Heat tint: inverno heats the first 55 % hard; verão the whole coil gently.
  const on = water && mode !== 'desligado' ? heating : 0;
  const level1 = mode === 'inverno' ? on : on * 0.3;
  const level2 = mode === 'verao' ? on * 0.3 : 0;
  const heat = useMemo(() => {
    const tint = (level: number) => ({
      emissive: level > 0 ? blackbodyColor(800 + 250 * level) : new Color('#000000'),
      emissiveIntensity: level * 0.45,
    });
    return [tint(level1), tint(level2)] as const;
  }, [level1, level2]);

  const white = {
    preset: 'absWhite' as const,
    color: '#f6f5f1',
    roughness: 0.32,
    roughnessMap: noise,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
  };
  const nichrome = { color: '#a9a7a0', metalness: 1, roughness: 0.38 };
  const brass = { preset: 'brass' as const, roughness: 0.3 };

  return (
    <group>
      {/* Spreader (turns to show its holes in the exploded view). */}
      <Explode offset={[0, -70, 52]} rotate={[-1.2, 0, 0]} delay={0.1}>
        <mesh geometry={g.spreader}>
          <Material {...white} clip cutColor="#d9d7d0" />
        </mesh>
        <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
          <circleGeometry args={[44, 64]} />
          <Material
            color="#ffffff"
            map={holes}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            roughness={0.5}
          />
        </mesh>
        <Anchor name="espalhador" position={[-40, 1, 24]} />
      </Explode>

      {/* Heating chamber and inlet tube. */}
      <Explode offset={[0, -40, 0]} delay={0.05}>
        <mesh geometry={g.chamber}>
          <Material
            preset="absWhite"
            color="#ecebe5"
            roughness={0.45}
            roughnessMap={noise}
            clip
            cutColor="#cfccc3"
          />
        </mesh>
        <Anchor name="camara" position={polar(46.5, 150, 30)} />
      </Explode>
      <mesh geometry={g.inlet}>
        <Material {...white} clip cutColor="#d9d7d0" />
      </mesh>

      {/* Resistance, its support and the terminals (stay in place). */}
      <mesh geometry={g.coilSupport}>
        <Material preset="ceramicWhite" color="#e6dfcf" roughness={0.6} clip />
      </mesh>
      <mesh geometry={g.seg1}>
        <Material {...nichrome} {...heat[0]} />
      </mesh>
      <mesh geometry={g.seg2}>
        <Material {...nichrome} {...heat[1]} />
      </mesh>
      <mesh geometry={g.posts}>
        <Material {...brass} />
      </mesh>
      <Anchor name="resistencia" position={coilOutside(0.3, H.coil + 1)} />
      <Anchor name="terminais" position={polar(POST_R, POSTS.comum, 40)} />

      {/* Diaphragm. */}
      <Explode offset={[0, 22, 0]} delay={0.1}>
        <mesh ref={diaphragm} geometry={g.diaphragm}>
          <Material preset="rubber" color="#2b2b2d" roughness={0.75} clip />
        </mesh>
        <Anchor name="diafragma" position={polar(36.8, 160, H.diaphragm + 2.2)} />
      </Explode>

      {/* Contact plate: lifted by the diaphragm, turned by the selector. */}
      <Explode offset={[0, 40, 0]} delay={0.15}>
        <group ref={plate}>
          <mesh geometry={g.plateBody}>
            <Material preset="pbtBlack" color="#3a3c40" roughness={0.55} clip />
          </mesh>
          <mesh geometry={g.bridges}>
            <Material preset="copper" roughness={0.3} clip cutColor="#a8643f" />
          </mesh>
          <Anchor name="placa" position={polar(30, 180, BRIDGE_TOP)} />
        </group>
      </Explode>

      {/* Support with the fixed contacts, straps and the earth lug. */}
      <Explode offset={[0, 58, 0]} delay={0.2}>
        <mesh geometry={g.support}>
          <Material preset="nylonNatural" roughness={0.55} clip cutColor="#c9c2ae" />
        </mesh>
        <mesh geometry={g.tabs}>
          <Material {...brass} />
        </mesh>
        <mesh geometry={g.screws}>
          <Material {...brass} color="#e0c27f" />
        </mesh>
        <mesh geometry={g.buttons}>
          <Material color="#dcdad4" metalness={1} roughness={0.25} />
        </mesh>
        <Anchor name="contatos" position={polar(CONTACTS.f2.r, CONTACTS.f2.phi, H.supportBottom)} />
      </Explode>

      {/* Top cover with the markings, and the leads through it. */}
      <Explode offset={[0, 62, -125]} delay={0.25}>
        <mesh geometry={g.cover}>
          <Material {...white} clip cutColor="#d9d7d0" />
        </mesh>
        <mesh geometry={g.grommets}>
          <Material preset="rubber" color="#2a2a2c" roughness={0.8} clip />
        </mesh>
        <mesh position={[0, H.top + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <ringGeometry args={[12.5, 29, 64]} />
          <Material
            color="#ffffff"
            map={marks}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            roughness={0.45}
            clip
          />
        </mesh>
        <mesh position={[0, 20, 0]} renderOrder={2}>
          <cylinderGeometry args={[56.65, 56.65, 4.2, 32, 1, true, -0.38, 0.76]} />
          <Material
            color="#ffffff"
            map={rating}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
            roughness={0.45}
            clip
          />
        </mesh>
        <Anchor name="tampa" position={polar(51, 150, 56)} />
        <mesh geometry={g.preto}>
          <Material preset="pvc" color={PVC.preto} />
        </mesh>
        <mesh geometry={g.vermelho}>
          <Material preset="pvc" color={PVC.vermelho} />
        </mesh>
        <mesh geometry={g.terra}>
          <Material preset="pvc" color="#ffffff" map={stripe} />
        </mesh>
        <mesh geometry={g.copper}>
          <Material preset="copper" roughness={0.35} />
        </mesh>
        <Anchor name="fios" position={[polar(20, 250, 0)[0] * 1.15 - 4, H.top + 22, -40]} />
        <Anchor name="terra" position={[polar(20, 290, 0)[0] * 1.15 + 3, H.top + 23, -48]} />
      </Explode>

      {/* Selector lever. */}
      <Explode offset={[0, 90, -125]} delay={0.3}>
        <group ref={selector}>
          <mesh geometry={g.selector}>
            <Material preset="absGray" color="#6b6f76" roughness={0.4} clearcoat={0.3} />
          </mesh>
          <Anchor name="chave" position={[21.5, H.top + 8.5, 0]} />
        </group>
      </Explode>
    </group>
  );
}
