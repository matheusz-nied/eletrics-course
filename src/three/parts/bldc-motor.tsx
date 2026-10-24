/**
 * Brushless outrunner motor of the 2207 size used on 5" racing drones
 * (catalogue drawings of 2207 motors): stator 22 mm across and 7 mm tall,
 * 12 teeth (12N14P), bell Ø 27,8 mm with 14 arc magnets glued inside
 * (alternating N and S, shown red and blue), air gap of about 0,25 mm,
 * Ø 4 mm shaft in two MR84 bearings (4 × 8 × 3) in the base tube, M5
 * threaded top with a flanged nylon-insert prop nut, base Ø 27,6 mm with
 * four M3 holes on a 16 × 16 mm square and a slot for the three enamelled
 * phase wires (no brushes: the ESC switches the phases). About 32 mm tall
 * with the shaft.
 * The bell turns at a viewable speed that grows with the rpm (slowly above
 * 60 rpm). Exploded view: bell (with shaft, magnets and nut) lifted off the
 * stator, the nut off the shaft, the stator off the base tube and the top
 * bearing out of it. Cutaway: bell and magnets cut, showing the stator
 * teeth and coils inside and the air gap; the stator stays whole.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Path, Shape, type BufferGeometry, type Group } from 'three';
import { formatNumber } from '../core/format';
import { useReducedMotion } from '../core/motion';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { fitText, FONT_SANS, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { roundedPath, tube } from '../shapes/geometry';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { hexNutGeometry } from './_em-geometry';
import {
  arc,
  circle,
  creased,
  deg,
  extrudeY,
  polar,
  polygon,
  ringSector,
  toothCoil,
  type Pt,
} from './_motor-geometry';
import {
  lathe,
  merge,
  scaleUv,
  useGeometrySet,
  useLaminationTexture,
  useTurnsTexture,
} from './_power-shared';

type Direction = 'horario' | 'anti-horario';

export interface BldcMotorProps {
  /** Speed (rpm); 0 = stopped. */
  rpm?: number;
  /** Velocity constant (rpm per volt), only for the description and the label. */
  kv?: number;
  /** Direction seen from the prop side. */
  direction?: Direction;
}

/** Base (mm). */
const BASE_R = 13.8;
const BASE_H = 2.6;
const HOLE_PATTERN = 16;
/** Stator: 12 teeth, 22 × 7 mm. */
const TEETH = 12;
const STATOR_R = 11;
const STATOR = { y0: 4.4, y1: 11.4 };
const HUB_R = 5.5;
const YOKE_R = 7;
const STEM = 1;
const SHOE_IN = 10.1;
const SHOE = 12;
/** Rotor: 14 magnets inside the bell. */
const POLES = 14;
const MAG = { rIn: 11.25, rOut: 12.5, y0: 4.2, y1: 11.8 };
const BELL = { rIn: 12.5, rOut: 13.9, y0: 3.6, y1: 15.6, top: 17 };
const SHAFT = { r: 2, rThread: 2.5, y0: 0.6, yThread: 18.4, y1: 31.4 };
const NUT = { y0: 25.4, flange: 26.4, hex: 29.8, y1: 31.1 };
const BEARINGS = [3.2, 8.4];
const N_COLOR = '#c9473e';
const S_COLOR = '#3b66c9';

/** Viewable turns per second: true speed up to 60 rpm, then slowly growing. */
function visualRps(rpm: number): number {
  const r = Math.abs(rpm);
  if (r <= 60) return r / 60;
  return 1 + 0.9 * Math.log10(r / 60);
}

const kvOf = (p: PartProps) => Math.min(Math.max(Number(p.kv) || 2300, 300), 5000);

/** World (x, z) of a polar point (rotation.y convention). */
const xz = (r: number, a: number): [number, number] => [r * Math.cos(a), -r * Math.sin(a)];

/** The side the default camera looks at. */
const FRONT = deg(-60);

export const meta: PartMeta = {
  id: 'bldc-motor',
  label: 'Motor sem escovas (brushless)',
  category: 'saidas',
  summary:
    'Motor brushless de rotor externo, tamanho 2207 (de drone): sino com 14 ímãs girando em volta de um estator de 12 dentes com as bobinas de três fases.',
  defaults: { rpm: 0, kv: 2300, direction: 'horario' },
  controls: {
    rpm: { kind: 'number', label: 'Rotação', min: 0, max: 35000, step: 100, unit: 'rpm' },
    kv: { kind: 'number', label: 'Constante KV', min: 1000, max: 3000, step: 50, unit: 'rpm/V' },
    direction: {
      kind: 'select',
      label: 'Sentido (visto de cima)',
      options: [
        { value: 'horario', label: 'Horário' },
        { value: 'anti-horario', label: 'Anti-horário' },
      ],
    },
  },
  annotations: () => {
    const front = xz(BELL.rOut, FRONT);
    const list: PartAnnotation[] = [
      {
        at: [0, 0, 0],
        text: 'Sino (rotor externo) com 14 ímãs colados por dentro',
        anchor: 'bell',
      },
      {
        at: [0, 0, 0],
        text: 'Eixo M5 com a porca da hélice: gira junto com o sino',
        anchor: 'nut',
      },
      {
        at: [BASE_R + 14, 0.4, 0],
        text: 'Três fios das fases A, B e C: sem escovas, quem comuta é o ESC',
      },
      {
        at: [front[0] * 0.8, BASE_H, front[1] * 0.8],
        text: 'Base com 4 furos M3 a 16 × 16 mm',
        exploded: false,
      },
      {
        at: [0, 0, 0],
        text: 'Estator com 12 dentes, cada um com sua bobina',
        anchor: 'stator',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Rolamentos (dois, dentro do tubo da base)',
        anchor: 'bearing',
        exploded: true,
      },
    ];
    return list;
  },
  explode: true,
  cutaway: true,
  animated: (p) => Number(p.rpm) > 0,
  describe: (p) => {
    const kv = kvOf(p);
    const rpm = Number(p.rpm) || 0;
    const sense = p.direction === 'anti-horario' ? 'anti-horário' : 'horário';
    const state =
      rpm > 0
        ? ` Girando a ${formatNumber(rpm)} rpm no sentido ${sense}, visto de cima (a animação mostra uma rotação bem mais lenta).`
        : ' Parado.';
    return `Motor sem escovas (brushless) de rotor externo, tamanho 2207: estator de 22 mm de diâmetro e 7 mm de altura com 12 dentes enrolados em três fases, sino de 27,8 mm com 14 ímãs alternando N e S, eixo de 4 mm em dois rolamentos com rosca M5 e porca para a hélice, base com furos M3 a 16 × 16 mm. ${formatNumber(kv)} KV: com 4 células (14,8 V) giraria cerca de ${formatNumber(kv * 14.8, 2)} rpm sem carga.${state}`;
  },
  view: [0.62, 0.8, 1.15],
};

/** Outline of the 12-tooth lamination (without the hub hole). */
function statorOutline(): Pt[] {
  const pts: Pt[] = [];
  const pitch = (Math.PI * 2) / TEETH;
  const dYoke = Math.sqrt(YOKE_R * YOKE_R - STEM * STEM);
  const aYoke = Math.asin(STEM / YOKE_R);
  for (let k = 0; k < TEETH; k++) {
    const c = k * pitch;
    const u: Pt = [Math.cos(c), Math.sin(c)];
    const v: Pt = [-Math.sin(c), Math.cos(c)];
    const at = (d: number, s: number): Pt => [u[0] * d + v[0] * s, u[1] * d + v[1] * s];
    pts.push(at(dYoke, -STEM), at(SHOE_IN, -STEM), polar(SHOE_IN, c - deg(SHOE)));
    pts.push(...arc(STATOR_R, c - deg(SHOE), c + deg(SHOE), 6));
    pts.push(polar(SHOE_IN, c + deg(SHOE)), at(SHOE_IN, STEM), at(dYoke, STEM));
    pts.push(...arc(YOKE_R, c + aYoke, c + pitch - aYoke, 4).slice(1, -1));
  }
  return pts;
}

/** Outline of the base: a disc with a slot for the wires at +X. */
function baseOutline(): Pt[] {
  const half = 1.7;
  const a0 = Math.asin(half / BASE_R);
  return [[7.6, half], ...arc(BASE_R, a0, Math.PI * 2 - a0, 72), [7.6, -half]];
}

/** Profile of an M5 thread (0,8 mm pitch) for a lathe. */
function threadProfile(y0: number, y1: number): [number, number][] {
  const pitch = 0.8;
  const out: [number, number][] = [
    [0, SHAFT.y0],
    [SHAFT.r - 0.2, SHAFT.y0],
    [SHAFT.r, SHAFT.y0 + 0.2],
    [SHAFT.r, y0],
  ];
  for (let y = y0; y + pitch <= y1 - 0.3; y += pitch)
    out.push([SHAFT.rThread - 0.45, y + 0.05], [SHAFT.rThread, y + pitch / 2]);
  out.push([SHAFT.rThread - 0.45, y1 - 0.3], [SHAFT.rThread - 0.6, y1], [0, y1]);
  return out;
}

export default function BldcMotor(props: BldcMotorProps) {
  const p = { ...meta.defaults, ...props } as Required<BldcMotorProps>;
  const kv = kvOf(p as unknown as PartProps);
  const noise = getNoiseTexture();

  const geo = useGeometrySet(() => {
    // Base: plate with the holes, the stator seat and the tube with the bearings.
    const plate = polygon(new Shape(), baseOutline());
    for (let k = 0; k < 4; k++) {
      const [x, y] = polar((HOLE_PATTERN / 2) * Math.SQRT2, deg(45 + k * 90));
      plate.holes.push(circle(new Path(), 1.6, x, y, 18));
    }
    for (const a of [90, 180, 270])
      plate.holes.push(
        polygon(new Path(), [
          ...arc(10.2, deg(a - 24), deg(a + 24), 8),
          ...arc(6.9, deg(a + 24), deg(a - 24), 6),
        ]),
      );
    plate.holes.push(circle(new Path(), 4, 0, 0, 32));
    const base = merge([
      scaleUv(creased(extrudeY(plate, 0, BASE_H, { bevel: 0.4, curveSegments: 2 }), 0.3), 0.1, 0.1),
      lathe(
        [
          [4, BASE_H - 0.05],
          [7, BASE_H - 0.05],
          [7, STATOR.y0 - 0.25],
          [6.7, STATOR.y0],
          [HUB_R - 0.05, STATOR.y0],
          [HUB_R - 0.05, STATOR.y1 + 0.2],
          [4, STATOR.y1 + 0.2],
          [4, BASE_H - 0.05],
        ],
        48,
      ),
    ]);
    const bearing = (y0: number) =>
      lathe(
        [
          [SHAFT.r, y0],
          [2.7, y0],
          [2.7, y0 + 0.2],
          [3.4, y0 + 0.2],
          [3.4, y0],
          [4, y0],
          [4, y0 + 3],
          [3.4, y0 + 3],
          [3.4, y0 + 2.8],
          [2.7, y0 + 2.8],
          [2.7, y0 + 3],
          [SHAFT.r, y0 + 3],
          [SHAFT.r, y0],
        ],
        32,
      );

    // Stator lamination and its twelve coils.
    const lam = polygon(new Shape(), statorOutline());
    lam.holes.push(circle(new Path(), HUB_R, 0, 0, 40));
    const stator = scaleUv(
      creased(extrudeY(lam, STATOR.y0, STATOR.y1, { curveSegments: 2 }), Math.PI / 6),
      0.05,
      1 / (0.2 * 8),
    );
    const coils = merge(
      Array.from({ length: TEETH }, (_, k) =>
        toothCoil({
          width: 2 * STEM + 0.2,
          length: STATOR.y1 - STATOR.y0 + 0.3,
          build: 0.68,
          r0: YOKE_R + 0.2,
          r1: SHOE_IN - 0.12,
          angle: (k * Math.PI * 2) / TEETH,
          y: (STATOR.y0 + STATOR.y1) / 2,
          taper: 1.9,
          wire: 0.22,
        }),
      ),
    );

    // Bell: wall (with the printed band), top with six openings, hub.
    const wall = lathe(
      [
        [BELL.rIn, BELL.y0],
        [BELL.rOut - 0.3, BELL.y0],
        [BELL.rOut, BELL.y0 + 0.3],
        [BELL.rOut, BELL.y1 + 0.05],
        [BELL.rIn, BELL.y1 + 0.05],
        [BELL.rIn, BELL.y0],
      ],
      72,
    );
    const top = new Shape();
    circle(top, BELL.rOut, 0, 0, 72);
    for (let k = 0; k < 6; k++) {
      const c = deg(k * 60 + 30);
      top.holes.push(
        polygon(new Path(), [
          ...arc(BELL.rIn - 1.2, c - deg(20), c + deg(20), 8),
          ...arc(5.2, c + deg(15), c - deg(15), 4),
        ]),
      );
    }
    const bellTop = merge([
      scaleUv(
        creased(extrudeY(top, BELL.y1, BELL.top, { bevel: 0.45, curveSegments: 2 }), 0.3),
        0.1,
        0.1,
      ),
      lathe(
        [
          [SHAFT.r, BELL.y1 - 0.6],
          [4.2, BELL.y1 - 0.6],
          [4.2, BELL.top + 1],
          [3.6, BELL.top + 1.4],
          [SHAFT.r, BELL.top + 1.4],
          [SHAFT.r, BELL.y1 - 0.6],
        ],
        36,
      ),
    ]);

    // Fourteen arc magnets, alternating N and S.
    const span = (Math.PI * 2) / POLES;
    const magnets = (north: boolean) =>
      merge(
        Array.from({ length: POLES / 2 }, (_, i) =>
          ringSector(
            MAG.rIn,
            MAG.rOut - 0.02,
            (2 * i + (north ? 0 : 1)) * span,
            span - deg(3.2),
            MAG.y0,
            MAG.y1,
            6,
          ),
        ),
      );

    // Shaft with the M5 thread, and the flanged prop nut.
    const shaft = lathe(threadProfile(SHAFT.yThread, SHAFT.y1), 24, { angle: 50 });
    const nutHex = merge([
      hexNutGeometry(8, NUT.hex - NUT.flange, SHAFT.rThread, 0.35).translate(0, NUT.flange, 0),
      lathe(
        [
          [SHAFT.rThread, NUT.y0],
          [5.4, NUT.y0],
          [5.6, NUT.y0 + 0.3],
          [5.6, NUT.flange - 0.3],
          [4.4, NUT.flange + 0.05],
          [SHAFT.rThread, NUT.flange + 0.05],
          [SHAFT.rThread, NUT.y0],
        ],
        40,
      ),
    ]);
    const nutRing = lathe(
      [
        [SHAFT.rThread, NUT.hex - 0.05],
        [3.6, NUT.hex - 0.05],
        [3.6, NUT.y1 - 0.4],
        [3.2, NUT.y1],
        [SHAFT.rThread, NUT.y1],
      ],
      32,
    );

    // Three enamelled phase wires out of the slot in the base, tinned at the ends.
    const wires: BufferGeometry[] = [];
    const tips: BufferGeometry[] = [];
    [-0.9, 0, 0.9].forEach((z, i) => {
      const fan = (i - 1) * 2.6;
      const a = deg(-8 + i * 8);
      const start: Vec3 = [8.7 * Math.cos(a), STATOR.y0 - 0.9, -8.7 * Math.sin(a)];
      const pts: Vec3[] = [
        start,
        [8.7, 1.2, z],
        [BASE_R + 2, 1.2, z],
        [BASE_R + 6, 0.42, z * 1.4],
        [BASE_R + 26, 0.42, fan],
        [BASE_R + 30, 0.42, fan],
      ];
      wires.push(tube(roundedPath(pts.slice(0, -1), 1.6), 0.4, { radial: 8 }));
      tips.push(
        tube(roundedPath([pts[pts.length - 2]!, pts[pts.length - 1]!], 1), 0.36, { radial: 8 }),
      );
    });

    return {
      base,
      bearingLow: bearing(BEARINGS[0]!),
      bearingHigh: bearing(BEARINGS[1]!),
      stator,
      coils,
      wall,
      bellTop,
      north: magnets(true),
      south: magnets(false),
      shaft,
      nutHex,
      nutRing,
      wires: merge(wires),
      tips: merge(tips),
    };
  }, []);

  const lamColor = useLaminationTexture('color');
  const lamRough = useLaminationTexture('rough');
  const turnsMap = useTurnsTexture('color', '#b4582c');
  const turnsBump = useTurnsTexture('bump');
  // Bell wall map: anodised colour with the size and KV printed twice around.
  const bellMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#2a2c31';
      ctx.fillRect(0, 0, w, h);
      // V runs with the height of the wall profile (BELL.y0 … BELL.y1).
      const v = (y: number) => (1 - (y - BELL.y0) / (BELL.y1 + 0.05 - BELL.y0)) * h;
      ctx.fillStyle = '#e6e7ea';
      for (const u of [0.25, 0.75])
        fitText(ctx, `2207 · ${formatNumber(kv)} KV`, u * w, v(9.6), w * 0.3, 54, {
          weight: 700,
        });
      ctx.fillStyle = '#c9473e';
      ctx.fillRect(0, v(BELL.y1 - 0.9), w, Math.max(2, h * 0.03));
    },
    `bldc-bell|${kv}`,
    { width: 1024, height: 128, fonts: [`700 54px ${FONT_SANS}`] },
  );

  // Rotor speed.
  const reduced = useReducedMotion();
  const rotor = useRef<Group>(null);
  const rpm = Math.max(Number(p.rpm) || 0, 0);
  const rps = Math.min(visualRps(rpm), reduced ? 0.25 : Infinity);
  const sense = p.direction === 'anti-horario' ? 1 : -1;
  useFrame((_, dt) => {
    if (!rotor.current || rps === 0) return;
    rotor.current.rotation.y += sense * 2 * Math.PI * rps * Math.min(dt, 0.05);
  });

  const aluminum = (
    <Material preset="aluminum" color="#d4d7db" roughness={0.38} roughnessMap={noise} />
  );
  const bellAt = xz(BELL.rOut, FRONT);
  const statorAt = xz(STATOR_R, FRONT);
  const bearingAt = xz(4, FRONT);
  const nutAt = xz(4.6, FRONT);

  return (
    <group>
      {/* Base with the tube; the lower bearing stays in it. */}
      <mesh geometry={geo.base}>{aluminum}</mesh>
      <mesh geometry={geo.bearingLow}>
        <Material preset="steel" color="#c8cbcf" roughness={0.22} />
      </mesh>
      <Explode offset={[0, 6, 0]} delay={0.35}>
        <mesh geometry={geo.bearingHigh}>
          <Material preset="steel" color="#c8cbcf" roughness={0.22} />
        </mesh>
        <Anchor name="bearing" position={[bearingAt[0], BEARINGS[1]! + 3, bearingAt[1]]} />
      </Explode>

      {/* Phase wires. */}
      <mesh geometry={geo.wires}>
        <Material preset="magnetWire" />
      </mesh>
      <mesh geometry={geo.tips}>
        <Material preset="solder" roughness={0.25} />
      </mesh>

      {/* Stator and coils (not cut). */}
      <Explode offset={[0, 14, 0]} delay={0.25}>
        <mesh geometry={geo.stator}>
          <Material attach="material-0" preset="siliconSteel" color="#a2a6ac" roughness={0.4} />
          <Material
            attach="material-1"
            preset="siliconSteel"
            color="#ffffff"
            map={lamColor}
            roughnessMap={lamRough}
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
        <mesh geometry={geo.coils}>
          <Material
            preset="magnetWire"
            color="#ffffff"
            map={turnsMap}
            bumpMap={turnsBump}
            bumpScale={0.4}
          />
        </mesh>
        <Anchor name="stator" position={[statorAt[0], STATOR.y1, statorAt[1]]} />
      </Explode>

      {/* Rotor: bell with the magnets, shaft and nut (turns). */}
      <Explode offset={[0, 30, 0]} delay={0.1}>
        <group ref={rotor}>
          <mesh geometry={geo.wall}>
            <Material
              color="#ffffff"
              map={bellMap}
              metalness={0.65}
              roughness={0.38}
              clip
              cutColor="#9aa0a8"
            />
          </mesh>
          <mesh geometry={geo.bellTop}>
            <Material
              color="#2a2c31"
              metalness={0.65}
              roughness={0.36}
              roughnessMap={noise}
              clip
              cutColor="#9aa0a8"
            />
          </mesh>
          <mesh geometry={geo.north}>
            <Material color={N_COLOR} metalness={0.35} roughness={0.4} clip />
          </mesh>
          <mesh geometry={geo.south}>
            <Material color={S_COLOR} metalness={0.35} roughness={0.4} clip />
          </mesh>
          <mesh geometry={geo.shaft}>
            <Material preset="steel" color="#cfd2d6" roughness={0.22} />
          </mesh>
          <Explode offset={[0, 8, 0]} delay={0.5}>
            <mesh geometry={geo.nutHex}>
              <Material preset="aluminum" color="#c9473e" metalness={0.7} roughness={0.32} />
            </mesh>
            <mesh geometry={geo.nutRing}>
              <Material preset="nylonNatural" color="#2d4fa8" roughness={0.6} />
            </mesh>
          </Explode>
        </group>
        <Anchor name="bell" position={[bellAt[0], (BELL.y0 + BELL.y1) / 2, bellAt[1]]} />
        <Explode offset={[0, 8, 0]} delay={0.5}>
          <Anchor name="nut" position={[nutAt[0], NUT.hex - 1.5, nutAt[1]]} />
        </Explode>
      </Explode>
    </group>
  );
}
