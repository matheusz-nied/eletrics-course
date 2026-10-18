/**
 * Pen-type soldering iron (40–60 W) with an optional spring stand and a
 * spool of solder wire.
 *
 * Real sizes: pen irons of 40–60 W measure 210–250 mm without the cable,
 * grip Ø 20–24 mm, stainless barrel Ø 7–9 mm, slide-in tip Ø 4–6 mm. Stands
 * have a 130–150 × 80–100 mm steel base, a conical spring Ø 16–30 mm and a
 * cellulose sponge of about 55 × 35 mm. Solder spools: Ø 50 mm, wire 1 mm.
 *
 * `temperature` (°C) changes the tinned tip (dull when cold, mirror-like
 * once the solder on it melts, above ~200 °C) and the heat tint of the
 * stainless barrel (straw, brown, blue near the tip). Changes are eased
 * over a couple of seconds. The tip only glows (black body) above ~480 °C,
 * beyond the slider range.
 *
 * Exploded view: tip, heater element, barrel and grip come apart along the
 * axis. Cutaway: the barrel and the handle are cut lengthwise.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  Curve,
  ExtrudeGeometry,
  Matrix4,
  Shape,
  TubeGeometry,
  Vector3,
  type Mesh,
  type MeshPhysicalMaterial,
} from 'three';
import { damp } from '../core/motion';
import { Anchor, Explode, useView } from '../core/view';
import { blackbodyColor, celsiusToKelvin, glowIntensity } from '../fx/blackbody';
import { Material } from '../materials/Material';
import { FONT_SANS, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { AssembledOnly, ribbedCircleShape, roundedSlab, smooth } from './_kit';

export type IronTip = 'conica' | 'chanfrada';

export interface SolderingIronProps {
  /** Tip temperature (°C). */
  temperature?: number;
  tip?: IronTip;
  /** Resting in a spring stand with a sponge (otherwise lying on the bench). */
  stand?: boolean;
  /** A spool of solder wire beside it. */
  solderWire?: boolean;
}

const T_MIN = 20;
const T_MAX = 600;

const clampT = (t: unknown) => Math.min(Math.max(Number(t) || 25, T_MIN), T_MAX);
const celsius = (t: number) => `${Math.round(t)} °C`;

function temperatureWords(t: number): string {
  if (t < 60) return `frio (${celsius(t)})`;
  if (t < 180) return `esquentando (${celsius(t)}): ainda não derrete a solda`;
  if (t < 260)
    return `a ${celsius(t)}, no limite para derreter solda 60/40 (que funde a 183 °C), com pouca folga`;
  if (t < 390) return `a ${celsius(t)}, na faixa usual de trabalho (300 a 370 °C)`;
  return `a ${celsius(t)}, muito quente: a ponta oxida mais depressa e as placas podem se danificar`;
}

export const meta: PartMeta = {
  id: 'soldering-iron',
  label: 'Ferro de soldar',
  category: 'instrumentos',
  summary:
    'Ferro de soldar tipo caneta de 60 W, com ponta estanhada, tubo de aço inox, empunhadura isolante, suporte com mola e esponja e um carretel de fio de solda.',
  defaults: { temperature: 350, tip: 'conica', stand: true, solderWire: true },
  controls: {
    temperature: {
      kind: 'number',
      label: 'Temperatura da ponta',
      min: 25,
      max: 450,
      step: 5,
      unit: '°C',
    },
    tip: {
      kind: 'select',
      label: 'Ponta',
      options: [
        { value: 'conica', label: 'Cônica' },
        { value: 'chanfrada', label: 'Chanfrada' },
      ],
    },
    stand: { kind: 'toggle', label: 'No suporte' },
    solderWire: { kind: 'toggle', label: 'Fio de solda ao lado' },
  },
  annotations: (p) => [
    { at: [0, 0, 0], text: 'Ponta estanhada', anchor: 'ponta' },
    { at: [0, 0, 0], text: 'Tubo de aço inox (esquenta)', anchor: 'tubo' },
    { at: [0, 0, 0], text: 'Empunhadura isolante (fica fria)', anchor: 'empunhadura' },
    { at: [0, 0, 0], text: 'Resistência de aquecimento', anchor: 'resistencia', exploded: true },
    ...(p.stand
      ? [
          { at: [-15, 56, 15] as Vec3, text: 'Suporte com mola', exploded: false },
          {
            at: [-30, 16, -22] as Vec3,
            text: 'Esponja úmida para limpar a ponta',
            exploded: false,
          },
        ]
      : []),
    ...(p.solderWire
      ? [
          {
            at: [0, 0, 0] as Vec3,
            text: 'Fio de solda com fluxo',
            anchor: 'solda',
            exploded: false,
          },
        ]
      : []),
  ],
  explode: true,
  cutaway: true,
  // Lengthwise through the iron's axis.
  cut: (p) => ({ normal: [0, 0, -1], through: [0, 0, p.stand === false ? 0 : STAND_Z] }),
  animated: false,
  describe: (p) => {
    const t = clampT(p.temperature);
    const tip = p.tip === 'chanfrada' ? 'chanfrada (de lâmina)' : 'cônica';
    const shine =
      t >= 200
        ? 'A solda na ponta está derretida e brilha como espelho.'
        : 'A camada de solda na ponta está sólida e fosca.';
    const tint =
      t >= 200
        ? ' O tubo de inox perto da ponta ganhou cores de revenimento (palha, marrom, azul).'
        : '';
    const where =
      p.stand === false
        ? t >= 60
          ? ' Ele está deitado na bancada: quente assim, deveria estar no suporte, longe do cabo e das mãos.'
          : ' Ele está deitado na bancada.'
        : ' Ele descansa no suporte com mola, com a esponja úmida ao lado para limpar a ponta.';
    const solder = p.solderWire
      ? ' Ao lado, um carretel de fio de solda 60/40 de 1 mm, com fluxo no núcleo.'
      : '';
    return `Ferro de soldar tipo caneta de 60 W com ponta ${tip}, ${temperatureWords(t)}. ${shine}${tint}${where}${solder}`;
  },
  view: [0.35, 0.55, 1.2],
};

// ---------------------------------------------------------------------------
// Layout (mm). The iron is built along +X with the tip point at x = 0.
// ---------------------------------------------------------------------------

const TIP = { work: 9, shank: 60, r: 2.4 };
const BARREL = { y0: 20, y1: 80, r: 4, rIn: 3.55 };
const HEATER = { y0: 24, y1: 72, r: 3.0, rIn: 2.55 };
const NUT = { y0: 78, y1: 88, r: 6.5 };
const SLEEVE = { y0: 88, y1: 100, r: 6 };
const GRIP = { y0: 100, y1: 152 };
const HANDLE = { y0: 98, y1: 236 };
const RELIEF = { y0: 232, y1: 272 };
const CABLE_R = 2.6;
const HANDLE_COLOR = '#1f56b3';

// Stand: spring axis from P0, tilted 30° up towards +X.
const STAND_Z = 15;
const TILT = Math.PI / 6;
const SPRING = { length: 80, r0: 8, r1: 13.5, wire: 0.9, turns: 9.5 };
const P0 = new Vector3(-50, 22, STAND_Z);
const AXIS = new Vector3(Math.cos(TILT), Math.sin(TILT), 0);
const DOWN = new Vector3(Math.sin(TILT), -Math.cos(TILT), 0);
const BASE = { x: -5, w: 140, d: 92, t: 6, feet: 1.5 };
const BASE_TOP = BASE.feet + BASE.t;
const TRAY = { x: -30, z: -22, w: 64, d: 44, h: 9 };

// Table mode: resting on the grip ring and the back of the handle.
const TABLE_TILT = -0.033;
const TABLE_TIP_X = -120;

interface IronPose {
  position: Vec3;
  rotation: number;
}

function ironPose(stand: boolean): IronPose {
  if (stand) {
    const p = P0.clone().addScaledVector(AXIS, 1).addScaledVector(DOWN, 5);
    return { position: [p.x, p.y, p.z], rotation: TILT };
  }
  return { position: [TABLE_TIP_X, 14.97, 0], rotation: TABLE_TILT };
}

function ironToWorld(pose: IronPose, x: number, y = 0, z = 0): Vector3 {
  const m = new Matrix4().makeRotationZ(pose.rotation).setPosition(new Vector3(...pose.position));
  return new Vector3(x, y, z).applyMatrix4(m);
}

/** A lathe around the iron's axis (+X), seam turned to the underside. */
function ironLathe(profile: [number, number][], segments = 48) {
  const g = axialLathe(profile, segments);
  g.rotateY(Math.PI / 2);
  g.rotateZ(-Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

/** Heat tint of stainless steel, strongest at the front end (v = 0). */
function drawHeatTint(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  // Canvas bottom = front of the barrel.
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, 'rgba(58, 74, 150, 0.9)');
  g.addColorStop(0.12, 'rgba(96, 70, 128, 0.85)');
  g.addColorStop(0.26, 'rgba(128, 82, 44, 0.8)');
  g.addColorStop(0.42, 'rgba(176, 128, 58, 0.6)');
  g.addColorStop(0.6, 'rgba(206, 178, 110, 0.3)');
  g.addColorStop(0.78, 'rgba(206, 190, 150, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Handle print: wattage and voltage along the axis. */
function drawHandle(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = HANDLE_COLOR;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  // u = 0.66: between the top and the camera-facing side.
  ctx.translate(w * 0.66, h * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#eef2f8';
  ctx.font = `800 ${w * 0.045}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('60 W  ·  127 V~', 0, 0);
  ctx.restore();
}

function drawSlots(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1b1d';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.roundRect((i + 0.3) * (w / 8), h * 0.2, (w / 8) * 0.4, h * 0.6, w * 0.02);
    ctx.fill();
  }
}

function drawSponge(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 1400; i++) {
    const r = 1 + rnd() * 3.5;
    ctx.fillStyle = `rgba(0,0,0,${0.35 + rnd() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * h, r, r * (0.6 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpoolLabel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f4f1e8';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2);
  ctx.arc(w / 2, h / 2, w * 0.2, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.font = `800 ${w * 0.11}px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SOLDA', w / 2, h * 0.17);
  ctx.fillStyle = '#2b2b2b';
  ctx.font = `700 ${w * 0.075}px ${FONT_SANS}`;
  ctx.fillText('Sn60 Pb40', w / 2, h * 0.84);
  ctx.font = `600 ${w * 0.06}px ${FONT_SANS}`;
  ctx.fillText('Ø 1,0 mm', w * 0.17, h / 2);
  ctx.fillText('fluxo', w * 0.83, h / 2);
}

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

/** Conical helix along +X (spring, heater winding). */
class HelixX extends Curve<Vector3> {
  constructor(
    readonly x0: number,
    readonly x1: number,
    readonly r0: number,
    readonly r1: number,
    readonly turns: number,
  ) {
    super();
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * this.turns * Math.PI * 2;
    const r = this.r0 + (this.r1 - this.r0) * t;
    return target.set(this.x0 + (this.x1 - this.x0) * t, Math.cos(a) * r, Math.sin(a) * r);
  }
}

// ---------------------------------------------------------------------------
// Iron
// ---------------------------------------------------------------------------

function tipGeometry(kind: IronTip) {
  const work =
    kind === 'conica'
      ? ironLathe(
          [
            [0, 0],
            [0.45, 0.12],
            [0.72, 0.6],
            [1.6, 4.6],
            [TIP.r, TIP.work],
            [0, TIP.work],
          ],
          40,
        )
      : ironLathe(
          [
            [0, 0],
            [1.75, 0],
            [1.95, 0.35],
            [TIP.r, TIP.work],
            [0, TIP.work],
          ],
          40,
        );
  if (kind === 'chanfrada') {
    // Flatten into a wedge: about 1 mm thick at the edge.
    const pos = work.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const f = 0.24 + 0.76 * Math.pow(Math.min(Math.max(x / TIP.work, 0), 1), 0.85);
      pos.setY(i, pos.getY(i) * f);
    }
    work.computeVertexNormals();
  }
  return work;
}

function Iron({ temperature, tip, pose }: { temperature: number; tip: IronTip; pose: IronPose }) {
  const noise = getNoiseTexture();
  const work = useDisposable(() => tipGeometry(tip), [tip]);
  const shank = useDisposable(
    () =>
      ironLathe(
        [
          [0, TIP.work],
          [TIP.r, TIP.work],
          [TIP.r, TIP.shank],
          [TIP.r - 0.3, TIP.shank + 0.4],
          [0, TIP.shank + 0.4],
        ],
        32,
      ),
    [],
  );
  const barrel = useDisposable(
    () =>
      ironLathe(
        [
          [3.0, BARREL.y0],
          [3.9, BARREL.y0 + 0.2],
          [BARREL.r, BARREL.y0 + 1],
          [BARREL.r, BARREL.y1],
          [BARREL.rIn, BARREL.y1],
          [BARREL.rIn, BARREL.y0 + 1.5],
          [3.0, BARREL.y0 + 0.6],
          [3.0, BARREL.y0],
        ],
        40,
      ),
    [],
  );
  const tintShell = useDisposable(
    () =>
      ironLathe(
        [
          [BARREL.r + 0.03, BARREL.y0 + 1],
          [BARREL.r + 0.03, BARREL.y1],
        ],
        40,
      ),
    [],
  );
  const heaterCore = useDisposable(
    () =>
      ironLathe(
        [
          [HEATER.rIn, HEATER.y0],
          [HEATER.r - 0.3, HEATER.y0],
          [HEATER.r - 0.3, HEATER.y1],
          [HEATER.rIn, HEATER.y1],
          [HEATER.rIn, HEATER.y0],
        ],
        32,
      ),
    [],
  );
  const winding = useDisposable(
    () =>
      new TubeGeometry(
        new HelixX(HEATER.y0 + 2, HEATER.y1 - 2, HEATER.r - 0.05, HEATER.r - 0.05, 34),
        34 * 16,
        0.22,
        5,
        false,
      ),
    [],
  );
  const nut = useDisposable(() => {
    const shape = ribbedCircleShape(NUT.r, 26, 0.3);
    const hole = new Shape();
    hole.absarc(0, 0, BARREL.r + 0.05, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new ExtrudeGeometry(shape, {
      depth: NUT.y1 - NUT.y0 - 1,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.3,
      bevelSegments: 2,
      curveSegments: 4,
    });
    g.translate(0, 0, 0.5);
    g.rotateY(Math.PI / 2);
    g.translate(NUT.y0, 0, 0);
    return smooth(g);
  }, []);
  const sleeve = useDisposable(
    () =>
      ironLathe(
        [
          [4.6, SLEEVE.y0],
          [SLEEVE.r, SLEEVE.y0],
          [SLEEVE.r, SLEEVE.y1],
          [4.6, SLEEVE.y1],
          [4.6, SLEEVE.y0],
        ],
        40,
      ),
    [],
  );
  const grip = useDisposable(() => {
    const outer: [number, number][] = [
      [8.2, GRIP.y0],
      [11.0, GRIP.y0 + 0.8],
      [11.6, GRIP.y0 + 2.4],
      [11.2, GRIP.y0 + 4],
      [10.4, GRIP.y0 + 6],
    ];
    for (let y = GRIP.y0 + 8; y <= GRIP.y1 - 4; y += 1.5) {
      const k = (y - GRIP.y0 - 8) / (GRIP.y1 - GRIP.y0 - 12);
      outer.push([10.15 + 0.32 * Math.cos(k * Math.PI * 12), y]);
    }
    outer.push([10.3, GRIP.y1 - 2], [9.7, GRIP.y1], [8.15, GRIP.y1], [8.15, GRIP.y0]);
    return ironLathe(outer, 48);
  }, []);
  const handle = useDisposable(
    () =>
      ironLathe(
        [
          [7.0, HANDLE.y0],
          [8.1, HANDLE.y0],
          [8.1, GRIP.y1],
          [9.6, GRIP.y1 + 1],
          [9.8, 172],
          [9.4, 196],
          [8.4, 214],
          [7.0, 226],
          [6.2, HANDLE.y1],
          [3.8, HANDLE.y1],
          [4.6, 210],
          [6.0, 180],
          [6.4, HANDLE.y0 + 4],
          [7.0, HANDLE.y0],
        ],
        48,
      ),
    [],
  );
  const relief = useDisposable(() => {
    const outer: [number, number][] = [[CABLE_R + 0.1, RELIEF.y0]];
    for (let i = 0; i <= 10; i++) {
      const y = RELIEF.y0 + (i / 10) * (RELIEF.y1 - RELIEF.y0);
      const r = 5.9 - 2.4 * (i / 10);
      outer.push([r, y - 0.8], [r - 0.45, y]);
    }
    outer.push([CABLE_R + 0.6, RELIEF.y1], [CABLE_R + 0.1, RELIEF.y1]);
    return ironLathe(outer, 32);
  }, []);
  const tintMap = useCanvasTexture(drawHeatTint, 'iron-heat-tint', { width: 16, height: 256 });
  const handleMap = useCanvasTexture(drawHandle, 'iron-handle-print-v1', {
    width: 1024,
    height: 512,
    fonts: [`800 40px ${FONT_SANS}`],
  });
  const slots = useCanvasTexture(drawSlots, 'iron-sleeve-slots', { width: 256, height: 64 });

  // Eased temperature: tip shine, barrel tint, glow above ~480 °C.
  const workRef = useRef<Mesh>(null);
  const tintRef = useRef<Mesh>(null);
  const windingRef = useRef<Mesh>(null);
  const eased = useRef<number | null>(null);
  const glow = useMemo(() => new Color(), []);
  const { cutaway, cutPlanes } = useView();
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [temperature, invalidate]);
  useFrame((state, dt) => {
    const from = eased.current ?? temperature;
    let t = damp(from, temperature, 2.2, Math.min(dt, 0.05));
    if (Math.abs(t - temperature) < 0.3) t = temperature;
    const changed = t !== eased.current;
    eased.current = t;
    if (!changed) return;
    const melt = Math.min(Math.max((t - 170) / 60, 0), 1);
    const tint = Math.min(Math.max((t - 140) / 280, 0), 1);
    const k = celsiusToKelvin(t);
    const g = glowIntensity(k);
    blackbodyColor(k, glow);
    const work = workRef.current?.material as MeshPhysicalMaterial | undefined;
    if (work) {
      work.roughness = 0.42 - 0.36 * melt;
      if (g > 0) work.emissive.copy(glow);
      else work.emissive.setRGB(0, 0, 0);
      work.emissiveIntensity = g * 40;
    }
    const shell = tintRef.current?.material as MeshPhysicalMaterial | undefined;
    if (shell) shell.opacity = 0.92 * tint;
    const wire = windingRef.current?.material as MeshPhysicalMaterial | undefined;
    if (wire) {
      if (g > 0) wire.emissive.copy(glow);
      else wire.emissive.setRGB(0, 0, 0);
      wire.emissiveIntensity = g * 60;
    }
    if (t !== temperature) state.invalidate();
  });

  return (
    <group position={pose.position} rotation={[0, 0, pose.rotation]}>
      {/* Slide-in tip: tinned working end and plated shank. */}
      <Explode offset={[-160, 0, 0]}>
        <mesh ref={workRef} geometry={work}>
          <Material preset="solder" roughness={0.3} />
        </mesh>
        <mesh geometry={shank}>
          <Material preset="nickel" color="#b9b2a6" roughness={0.32} />
        </mesh>
        <Anchor name="ponta" position={[3, 2, 0]} />
      </Explode>

      {/* Heater: ceramic core with a nichrome winding, leads to the handle. */}
      <Explode offset={[-50, 0, 0]}>
        <mesh geometry={heaterCore}>
          <Material preset="ceramicWhite" roughness={0.6} />
        </mesh>
        <mesh ref={windingRef} geometry={winding}>
          <Material preset="nickel" color="#8f8a82" roughness={0.45} />
        </mesh>
        {[-1, 1].map((s) => (
          <Wire
            key={s}
            points={[
              [HEATER.y1 - 1, 0, s * 1.3],
              [HEATER.y1 + 30, 0, s * 1.6],
              [118, s * 0.5, s * 2.2],
            ]}
            radius={0.35}
            material={{ preset: 'nickel', roughness: 0.35 }}
          />
        ))}
        <Anchor name="resistencia" position={[(HEATER.y0 + HEATER.y1) / 2, 3.4, 0]} />
      </Explode>

      {/* Stainless barrel with the tip set screw and the knurled nut. */}
      <Explode offset={[-100, 0, 0]}>
        <mesh geometry={barrel}>
          <Material preset="steel" color="#c4c6c8" roughness={0.22} clip cutColor="#7c7f82" />
        </mesh>
        {/* Tint overlay: clipped without the solid cut face of <Material clip>. */}
        <mesh ref={tintRef} geometry={tintShell}>
          <meshPhysicalMaterial
            color="#ffffff"
            map={tintMap}
            transparent
            opacity={0}
            depthWrite={false}
            metalness={0.8}
            roughness={0.25}
            clippingPlanes={cutaway ? cutPlanes : null}
          />
        </mesh>
        <mesh position={[26, BARREL.r + 0.6, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 1.8, 6]} />
          <Material preset="steel" roughness={0.3} />
        </mesh>
        <mesh geometry={nut}>
          <Material preset="nickel" roughness={0.28} clip />
        </mesh>
        <Anchor name="tubo" position={[50, BARREL.r, 0]} />
      </Explode>

      {/* Handle: vented heat sleeve, ABS body, strain relief. */}
      <mesh geometry={sleeve}>
        <Material preset="steel" color="#c9cbcd" map={slots} roughness={0.32} clip />
      </mesh>
      <mesh geometry={handle}>
        <Material
          preset="pvc"
          color="#ffffff"
          map={handleMap}
          roughness={0.38}
          clearcoat={0.4}
          clip
          cutColor="#163c7d"
        />
      </mesh>
      <mesh geometry={relief}>
        <Material preset="rubber" roughness={0.75} clip />
      </mesh>
      {/* Inside the handle: crimp joints and the cable conductors. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[121, s * 0.5, s * 2.2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[1.1, 1.1, 7, 12]} />
            <Material preset="brass" roughness={0.3} />
          </mesh>
          <Wire
            smooth
            points={[
              [124, s * 0.5, s * 2.2],
              [170, s * 0.3, s * 2.4],
              [225, 0, s * 1.4],
              [RELIEF.y0 + 2, 0, s * 1.1],
            ]}
            radius={0.95}
            material={{ preset: 'pvc', color: s < 0 ? '#6b3a1f' : '#2f6fd6', roughness: 0.5 }}
          />
        </group>
      ))}

      {/* Foam grip. */}
      <Explode offset={[-25, 0, 0]}>
        <mesh geometry={grip}>
          <Material
            preset="rubber"
            color="#1e1f22"
            roughness={0.9}
            bumpMap={noise}
            bumpScale={0.6}
            clip
          />
        </mesh>
        <Anchor name="empunhadura" position={[126, 10.6, 0]} />
      </Explode>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Stand
// ---------------------------------------------------------------------------

function Stand() {
  const noise = getNoiseTexture();
  const base = useDisposable(() => {
    const g = roundedSlab({ width: BASE.w, height: BASE.d, depth: BASE.t, radius: 12, bevel: 1.4 });
    g.rotateX(-Math.PI / 2);
    g.translate(BASE.x, BASE.feet, 0);
    return g;
  }, []);
  const tray = useDisposable(() => {
    const g = roundedSlab({
      width: TRAY.w,
      height: TRAY.d,
      depth: TRAY.h,
      radius: 7,
      bevel: 0.5,
      holes: [{ kind: 'rect', w: TRAY.w - 3, h: TRAY.d - 3, r: 5.5, x: 0, y: 0 }],
    });
    g.rotateX(-Math.PI / 2);
    g.translate(TRAY.x, BASE_TOP, TRAY.z);
    return g;
  }, []);
  const sponge = useDisposable(() => {
    const g = roundedSlab({
      width: TRAY.w - 5,
      height: TRAY.d - 5,
      depth: 7,
      radius: 4,
      bevel: 1.5,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(TRAY.x, BASE_TOP, TRAY.z);
    return g;
  }, []);
  const spring = useDisposable(
    () =>
      new TubeGeometry(
        new HelixX(0, SPRING.length, SPRING.r0, SPRING.r1, SPRING.turns),
        Math.ceil(SPRING.turns * 28),
        SPRING.wire,
        6,
        false,
      ),
    [],
  );
  const cup = useDisposable(
    () =>
      ironLathe(
        [
          [0, -8],
          [10, -8],
          [10, 2],
          [9.2, 2],
          [9.2, -7.2],
          [0, -7.2],
        ],
        36,
      ),
    [],
  );
  const spongeMap = useCanvasTexture(drawSponge, 'iron-sponge-pores', {
    width: 512,
    height: 512,
    color: false,
  });
  const top = P0.clone().addScaledVector(AXIS, SPRING.length);
  const lowTop = top.clone().addScaledVector(DOWN, SPRING.r1);
  const lowCup = P0.clone().addScaledVector(AXIS, -8).addScaledVector(DOWN, 10);
  const angle = TILT;

  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[BASE.x + sx * (BASE.w / 2 - 12), BASE.feet / 2, sz * (BASE.d / 2 - 12)]}
          >
            <cylinderGeometry args={[6, 6, BASE.feet, 20]} />
            <Material preset="rubber" />
          </mesh>
        )),
      )}
      <mesh geometry={base}>
        <Material
          preset="absBlack"
          color="#2a2b2e"
          metalness={0.5}
          roughness={0.55}
          roughnessMap={noise}
          clearcoat={0.3}
        />
      </mesh>
      <mesh geometry={tray}>
        <Material preset="zinc" roughness={0.38} />
      </mesh>
      <mesh geometry={sponge}>
        <Material
          color="#e2b93b"
          roughness={0.95}
          bumpMap={spongeMap}
          bumpScale={1.6}
          roughnessMap={spongeMap}
        />
      </mesh>
      {/* Conical spring with its bottom cup and the top support. */}
      <group position={[P0.x, P0.y, P0.z]} rotation={[0, 0, angle]}>
        <mesh geometry={spring}>
          <Material preset="steel" color="#cfd1d3" roughness={0.25} />
        </mesh>
        <mesh position={[SPRING.length, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[SPRING.r1, SPRING.wire, 8, 48]} />
          <Material preset="steel" color="#cfd1d3" roughness={0.25} />
        </mesh>
        <mesh geometry={cup}>
          <Material preset="nickel" roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[lowCup.x, (BASE_TOP + lowCup.y) / 2, STAND_Z]}>
        <cylinderGeometry args={[3, 3.6, lowCup.y - BASE_TOP + 1, 16]} />
        <Material preset="nickel" roughness={0.3} />
      </mesh>
      <mesh position={[lowTop.x, (BASE_TOP + lowTop.y) / 2, STAND_Z]}>
        <boxGeometry args={[2, lowTop.y - BASE_TOP, 8]} />
        <Material preset="nickel" roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Solder spool
// ---------------------------------------------------------------------------

const SPOOL = { r: 25, hub: 9, wound: 20.5, width: 26, flange: 1.8 };

function SolderSpool({ position, towards }: { position: Vec3; towards: Vector3 }) {
  const label = useCanvasTexture(drawSpoolLabel, 'iron-spool-label-v1', {
    width: 512,
    height: 512,
    fonts: [`800 40px ${FONT_SANS}`, `700 40px ${FONT_SANS}`],
  });
  const wound = useDisposable(
    () =>
      axialLathe(
        [
          [SPOOL.hub, -SPOOL.width / 2],
          [SPOOL.wound - 0.6, -SPOOL.width / 2],
          [SPOOL.wound, -SPOOL.width / 2 + 0.8],
          [SPOOL.wound, SPOOL.width / 2 - 0.8],
          [SPOOL.wound - 0.6, SPOOL.width / 2],
          [SPOOL.hub, SPOOL.width / 2],
        ],
        64,
      ),
    [],
  );
  const grooves = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9a9a9a';
      for (let i = 0; i < 26; i++) ctx.fillRect(0, (i * h) / 26, w, h / 90);
    },
    'iron-spool-grooves',
    { width: 16, height: 512, color: false },
  );
  const [x, , z] = position;
  const cy = SPOOL.r;
  // Loose end: off the top of the winding, down to the bench, towards the iron.
  const end = new Vector3(x, 0.5, z).addScaledVector(towards, 70);
  return (
    <group>
      <group position={[x, cy, z]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={wound}>
          <Material preset="solder" roughness={0.3} bumpMap={grooves} bumpScale={0.4} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, s * (SPOOL.width / 2 + SPOOL.flange / 2), 0]}>
            <cylinderGeometry args={[SPOOL.r, SPOOL.r, SPOOL.flange, 64]} />
            <Material preset="absRed" color="#c62f24" roughness={0.4} clearcoat={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[4.5, 4.5, SPOOL.width + 2 * SPOOL.flange + 0.2, 32]} />
          <Material preset="absBlack" color="#111111" roughness={0.8} />
        </mesh>
        <mesh
          position={[0, SPOOL.width / 2 + SPOOL.flange + 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[SPOOL.r - 0.5, 64]} />
          <Material color="#ffffff" map={label} transparent alphaTest={0.5} roughness={0.5} />
        </mesh>
      </group>
      <Wire
        smooth
        radius={0.5}
        points={[
          [x - 6, cy + SPOOL.wound - 0.3, z + 4],
          [x - 18, cy + SPOOL.wound + 2, z + 6],
          [x + towards.x * 30 - 2, 12, z + towards.z * 30 + 8],
          [x + towards.x * 48, 0.5, z + towards.z * 48 + 6],
          [end.x, end.y, end.z],
        ]}
        material={{ preset: 'solder', roughness: 0.3 }}
      />
      <Anchor name="solda" position={[x, cy + SPOOL.r, z]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cable and plug
// ---------------------------------------------------------------------------

function Cable({ pose, stand }: { pose: IronPose; stand: boolean }) {
  const exit = ironToWorld(pose, RELIEF.y1 - 6);
  const out = ironToWorld(pose, RELIEF.y1 + 18);
  const pts: Vec3[] = stand
    ? [
        [exit.x, exit.y, exit.z],
        [out.x, out.y, out.z],
        [out.x + 30, out.y - 40, out.z - 8],
        [out.x + 34, 30, out.z - 18],
        [out.x + 20, CABLE_R, out.z - 50],
        [out.x - 30, CABLE_R, -78],
        [out.x - 90, CABLE_R, -92],
      ]
    : [
        [exit.x, exit.y, exit.z],
        [out.x, out.y, out.z],
        [out.x + 22, CABLE_R, out.z - 18],
        [out.x + 12, CABLE_R, out.z - 56],
        [out.x - 20, CABLE_R, out.z - 96],
        [out.x - 70, CABLE_R, out.z - 104],
      ];
  const last = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  const dir = new Vector3(last[0] - prev[0], 0, last[2] - prev[2]).normalize();
  const yaw = Math.atan2(-dir.z, dir.x);
  return (
    <group>
      <Wire smooth points={pts} radius={CABLE_R} material={{ preset: 'rubber', roughness: 0.6 }} />
      {/* Two-pin plug (NBR 14136), lying on the bench. */}
      <group position={[last[0], 0, last[2]]} rotation={[0, yaw, 0]}>
        <mesh position={[14, 7.5, 0]}>
          <boxGeometry args={[28, 15, 22]} />
          <Material preset="absBlack" color="#1b1b1d" roughness={0.5} />
        </mesh>
        <mesh position={[30, 7.5, 0]}>
          <boxGeometry args={[4, 13, 20]} />
          <Material preset="absBlack" color="#1b1b1d" roughness={0.45} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[41, 7.5, s * 9.5]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[2, 2, 19, 16]} />
            <Material preset="brass" color="#d8c7a0" roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Part
// ---------------------------------------------------------------------------

export default function SolderingIron(props: SolderingIronProps) {
  const merged = { ...meta.defaults, ...props };
  const temperature = clampT(merged.temperature);
  const tip: IronTip = merged.tip === 'chanfrada' ? 'chanfrada' : 'conica';
  const stand = merged.stand !== false;
  const solderWire = !!merged.solderWire;
  const pose = useMemo(() => ironPose(stand), [stand]);
  const tipAt = useMemo(() => ironToWorld(pose, 0), [pose]);

  return (
    <group>
      {stand && <Stand />}
      <Explode offset={stand ? [0, 85, 30] : [0, 30, 0]}>
        <Iron temperature={temperature} tip={tip} pose={pose} />
      </Explode>
      <AssembledOnly>
        <Cable pose={pose} stand={stand} />
      </AssembledOnly>
      {solderWire && (
        <SolderSpool
          position={stand ? [62, 0, 66] : [40, 0, -58]}
          towards={
            stand
              ? new Vector3(-0.6, 0, 0.8)
              : new Vector3(tipAt.x - 40, 0, tipAt.z + 58).normalize()
          }
        />
      )}
    </group>
  );
}
