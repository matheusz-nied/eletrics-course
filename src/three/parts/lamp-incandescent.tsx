/**
 * Incandescent lamp: A60 household bulb with E27 cap (IEC 60064: Ø 60 mm,
 * about 105 mm long) and the automotive P21W bulb with BA15s bayonet cap
 * (IEC 60809: Ø 26 mm glass, about 52 mm long). Inside: the coiled tungsten
 * filament, molybdenum support hooks on a glass arbor, lead-in wires sealed
 * in the glass pinch and the exhaust tube. The filament glows with the colour
 * of a black body at its temperature; a burned lamp has a broken filament.
 */
import { useMemo } from 'react';
import { Curve, SplineCurve, TubeGeometry, Vector2, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { blackbodyColor, glowIntensity } from '../fx/blackbody';
import { emission, GLOW, GlowSprite } from '../fx/glow';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import { E27Base } from './_power-e27';
import { ClearGlass, lathe, shellProfile } from './_power-shared';

type Variant = 'a60' | 'automotiva';

export interface LampIncandescentProps {
  variant?: Variant;
  /** Rated power printed on the glass (W). */
  watts?: number;
  /** Rated voltage (V): 127 or 220 for A60; the automotive bulb is always 12 V. */
  voltage?: number;
  /** Electrical power relative to the rating: 0 = off, 1 = rated. */
  brightness?: number;
  /** Filament temperature (K); 0 = follow `brightness`. */
  temperatureK?: number;
  /** Broken filament. */
  burned?: boolean;
}

/** Rated filament temperature of general-service and signal lamps (K). */
const RATED_K = 2700;

/** A60 filament: a horizontal arc around the arbor, held by three hooks. */
const ARC_R = 10.5;
const ARC_FROM = (-25 * Math.PI) / 180;
const ARC_TO = (205 * Math.PI) / 180;
const FILAMENT_Y = 65;
const SUPPORTS = [0, 0.25, 0.5, 0.75, 1];

export const meta: PartMeta = {
  id: 'lamp-incandescent',
  label: 'Lâmpada incandescente',
  category: 'saidas',
  summary:
    'Lâmpada incandescente A60 com rosca E27 e lâmpada automotiva de 12 V, com o filamento de tungstênio que brilha conforme a temperatura.',
  defaults: {
    variant: 'a60',
    watts: 60,
    voltage: 127,
    brightness: 1,
    temperatureK: 0,
    burned: false,
  },
  controls: {
    variant: {
      kind: 'select',
      label: 'Modelo',
      options: [
        { value: 'a60', label: 'Bulbo A60, rosca E27' },
        { value: 'automotiva', label: 'Automotiva 12 V (P21W, baioneta)' },
      ],
    },
    watts: {
      kind: 'select',
      label: 'Potência',
      options: [
        { value: 25, label: '25 W' },
        { value: 40, label: '40 W' },
        { value: 60, label: '60 W' },
        { value: 100, label: '100 W' },
        { value: 21, label: '21 W (automotiva)' },
        { value: 5, label: '5 W (automotiva)' },
      ],
    },
    voltage: {
      kind: 'select',
      label: 'Tensão',
      options: [
        { value: 127, label: '127 V' },
        { value: 220, label: '220 V' },
        { value: 12, label: '12 V' },
      ],
    },
    brightness: { kind: 'number', label: 'Potência aplicada', min: 0, max: 1.3, step: 0.01 },
    temperatureK: {
      kind: 'number',
      label: 'Temperatura do filamento (0 = automática)',
      min: 0,
      max: 3400,
      step: 50,
      unit: 'K',
    },
    burned: { kind: 'toggle', label: 'Queimada (filamento rompido)' },
  },
  annotations: (p) => {
    if (p.variant === 'automotiva') {
      return [
        { at: [0, 37, 0], text: 'Filamento de tungstênio em espiral', anchor: 'filament' },
        { at: [0, 30, 0], text: 'Hastes de suporte: levam a corrente', anchor: 'lead' },
        { at: [7.6, 8, 0], text: 'Pinos da baioneta: encaixe e trava', exploded: false },
        { at: [0, 0, 0], text: 'Contato da base: positivo (+12 V)', exploded: false },
        { at: [7.5, 14, 0], text: 'Corpo metálico: negativo (massa)', exploded: false },
        { at: [0, 0, 0], text: 'Bulbo de vidro', anchor: 'glass', exploded: true },
      ];
    }
    return [
      { at: [0, 0, 0], text: 'Filamento de tungstênio enrolado', anchor: 'filament' },
      { at: [0, 0, 0], text: 'Ganchos de molibdênio seguram o filamento', anchor: 'hook' },
      { at: [0, 0, 0], text: 'Fios de entrada: levam a corrente', anchor: 'lead' },
      { at: [0, 0, 0], text: 'Haste de vidro com o tubo de exaustão', anchor: 'stem' },
      { at: [0, 0, 0], text: 'Bulbo de vidro com gás inerte', anchor: 'glass' },
      { at: [13, 15, 0], text: 'Rosca E27: ligar ao neutro', exploded: false },
      { at: [0, 0, 0], text: 'Contato central: fase, pelo interruptor', exploded: false },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const auto = p.variant === 'automotiva';
    const watts = Number(p.watts);
    const volts = auto ? 12 : Number(p.voltage);
    const kind = auto
      ? `Lâmpada automotiva de ${formatNumber(volts)} V e ${formatNumber(watts)} W com base baioneta`
      : `Lâmpada incandescente A60 de ${formatNumber(watts)} W e ${formatNumber(volts)} V com rosca E27`;
    if (p.burned) return `${kind}, queimada: o filamento está rompido e não passa corrente.`;
    const k = filamentKelvin(p);
    if (k < 800) return `${kind}, apagada.`;
    return `${kind}, acesa, com o filamento a cerca de ${formatNumber(Math.round(k / 50) * 50, 4)} K.`;
  },
  view: [0.55, 0.42, 1.5],
};

/** Filament temperature from the applied power: radiated power grows as T⁴. */
function filamentKelvin(p: PartProps): number {
  const forced = Number(p.temperatureK);
  if (forced > 0) return forced;
  const b = Math.max(Number(p.brightness) || 0, 0);
  if (b <= 0) return 293;
  return Math.max(293, RATED_K * Math.pow(b, 0.25));
}

export default function LampIncandescent(props: LampIncandescentProps) {
  const p = { ...meta.defaults, ...props } as Required<LampIncandescentProps>;
  const kelvin = p.burned ? 293 : filamentKelvin(p as unknown as PartProps);
  const glow = glowIntensity(kelvin);
  if (p.variant === 'automotiva') return <AutomotiveBulb {...p} kelvin={kelvin} glow={glow} />;
  return <A60Bulb {...p} kelvin={kelvin} glow={glow} />;
}

interface LitProps extends Required<LampIncandescentProps> {
  kelvin: number;
  glow: number;
}

/** Sag of a filament strung between supports: 0 at the supports, 1 midway. */
function sagBetween(s: number, supports: number[]): number {
  for (let i = 0; i < supports.length - 1; i++) {
    const a = supports[i]!;
    const b = supports[i + 1]!;
    if (s >= a && s <= b) return Math.sin(((s - a) / (b - a)) * Math.PI);
  }
  return 0;
}

/**
 * A coiled filament around an axis curve `axis(s)`, s in [s0, s1]:
 * `radius` of the coil, `turns` over the whole axis length.
 */
class CoilCurve extends Curve<Vector3> {
  constructor(
    private axis: (s: number, target: Vector3) => Vector3,
    private s0: number,
    private s1: number,
    private radius: number,
    private turns: number,
  ) {
    super();
  }

  private a = new Vector3();
  private b = new Vector3();
  private n = new Vector3();
  private bi = new Vector3();

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const s = this.s0 + (this.s1 - this.s0) * t;
    this.axis(s, target);
    this.axis(Math.min(s + 1e-3, 1), this.a);
    this.axis(Math.max(s - 1e-3, 0), this.b);
    const tangent = this.a.sub(this.b).normalize();
    this.n.set(0, 1, 0).addScaledVector(tangent, -tangent.y).normalize();
    this.bi.crossVectors(tangent, this.n);
    const angle = s * this.turns * Math.PI * 2;
    return target
      .addScaledVector(this.n, Math.cos(angle) * this.radius)
      .addScaledVector(this.bi, Math.sin(angle) * this.radius);
  }
}

/** Faint etched marking on the top of the glass ("127V 60W"). */
function GlassPrint({
  text,
  radius,
  y,
  cap,
}: {
  text: string;
  radius: number;
  y: number;
  cap: number;
}) {
  const map = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = 'rgba(236,240,242,0.9)';
      fitText(ctx, text, w / 2, h / 2, w * 0.8, h * 0.2, { weight: 600, family: FONT_SANS });
    },
    `glassprint|${text}`,
    { width: 512, height: 512, fonts: [`600 40px ${FONT_SANS}`] },
  );
  const geometry = useDisposable(() => {
    // Spherical cap just outside the glass, with UVs projected from above.
    const profile: [number, number][] = [];
    const steps = 12;
    const a0 = Math.asin(Math.min(cap / radius, 1));
    for (let i = 0; i <= steps; i++) {
      const a = a0 * (1 - i / steps);
      profile.push([Math.sin(a) * radius, y + Math.cos(a) * radius]);
    }
    const g = lathe(profile, 48, { angle: 89 });
    const position = g.attributes.position!;
    const uv = g.attributes.uv!;
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, position.getX(i) / (2 * cap) + 0.5, 0.5 - position.getZ(i) / (2 * cap));
    }
    uv.needsUpdate = true;
    return g;
  }, [radius, y, cap]);
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <Material
        color="#ffffff"
        map={map}
        transparent
        opacity={0.55}
        depthWrite={false}
        roughness={0.7}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

/** Opaque stand-in for the small glass pieces inside the bulb (they must show through the envelope). */
const STEM_GLASS = {
  color: '#b4c4bf',
  roughness: 0.05,
  metalness: 0.35,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
} as const;

function useFilamentGlow(kelvin: number, glow: number) {
  return useMemo(() => {
    const color = blackbodyColor(kelvin);
    const e = emission(color, glow, GLOW);
    return { color, ...e };
  }, [kelvin, glow]);
}

function A60Bulb(p: LitProps) {
  const thick = 0.07 + Math.min(Math.max(p.watts, 15), 150) / 1500;
  const glowState = useFilamentGlow(p.kelvin, p.glow);
  const filamentY = FILAMENT_Y;
  const arcR = ARC_R;
  const a0 = ARC_FROM;
  const a1 = ARC_TO;

  const glass = useDisposable(() => {
    const lower = new SplineCurve(
      [
        [12.0, 21.0],
        [12.45, 25.0],
        [12.9, 28.0],
        [14.6, 33.0],
        [17.6, 39.0],
        [21.4, 45.5],
        [25.0, 52.5],
        [27.8, 59.5],
        [29.4, 66.5],
        [30.0, 74.5],
      ].map(([r, y]) => new Vector2(r, y)),
    ).getPoints(40);
    const outer: [number, number][] = lower.map((v) => [v.x, v.y]);
    for (let i = 1; i <= 28; i++) {
      const a = (i / 28) * (Math.PI / 2);
      outer.push([30 * Math.cos(a), 74.5 + 30 * Math.sin(a)]);
    }
    return lathe(shellProfile(outer, 0.55), 64, { angle: 60 });
  }, []);

  // Axis of the filament: a horizontal arc around the arbor, sagging between hooks.
  const axis = useMemo(
    () => (s: number, target: Vector3) => {
      const a = ARC_FROM + (ARC_TO - ARC_FROM) * s;
      let y = FILAMENT_Y - 0.9 * sagBetween(s, SUPPORTS);
      if (p.burned) {
        if (s < 0.5 && s > 0.3) y -= 5 * ((s - 0.3) / 0.17) ** 2;
        if (s > 0.5 && s < 0.7) y -= 3.5 * ((0.7 - s) / 0.17) ** 2;
      }
      return target.set(Math.cos(a) * ARC_R, y, Math.sin(a) * ARC_R);
    },
    [p.burned],
  );
  const arcLength = arcR * (a1 - a0);
  const turns = arcLength / 0.3;
  const coilA = useDisposable(() => {
    const curve = new CoilCurve(axis, 0, p.burned ? 0.47 : 1, 0.55, turns);
    const segments = Math.ceil(turns * (p.burned ? 0.47 : 1) * 9);
    return new TubeGeometry(curve, segments, thick, 5, false);
  }, [p.burned, thick, turns]);
  const coilB = useDisposable(() => {
    const curve = new CoilCurve(axis, 0.53, 1, 0.55, turns);
    return new TubeGeometry(curve, Math.ceil(turns * 0.47 * 9), thick, 5, false);
  }, [p.burned, thick, turns]);

  const flare = useDisposable(
    () =>
      lathe(
        shellProfile(
          [
            [10.4, 22.6],
            [9.6, 23.8],
            [7.4, 26.4],
            [5.0, 29.4],
            [3.7, 31.8],
            [3.4, 33.2],
          ],
          0.55,
        ),
        40,
        { angle: 70 },
      ),
    [],
  );
  const pinch = useDisposable(() => new RoundedBoxGeometry(8.6, 7.2, 3.0, 3, 1.1), []);
  const cement = useDisposable(
    () =>
      lathe(
        [
          [12.4, 24.9],
          [13.0, 25.15],
          [12.95, 25.55],
          [12.6, 25.85],
          [12.4, 25.85],
        ],
        48,
      ),
    [],
  );

  const end = (a: number): Vec3 => [Math.cos(a) * arcR, filamentY, Math.sin(a) * arcR];
  const leadIn = (side: 1 | -1): Vec3[] => {
    const tip = end(side === 1 ? a0 : a1);
    return [
      [side * 2.6, 26, 0],
      [side * 2.6, 34, 0],
      [side * 2.8, 41, 0],
      [side * 4.2, 50, -1.4],
      [tip[0] * 0.92, filamentY - 2.6, tip[2] * 0.92],
      [tip[0], filamentY + 0.25, tip[2]],
    ];
  };
  const hookAngles = SUPPORTS.slice(1, -1).map((s) => a0 + (a1 - a0) * s);
  const buttonY = 60.5;
  const printText = `${formatNumber(p.voltage)}V ${formatNumber(p.watts)}W`;
  const lightAt: Vec3 = [0, filamentY, 3];

  return (
    <group>
      <E27Base finish="aluminum" clip />
      {/* Basing cement between glass and cap. */}
      <mesh geometry={cement}>
        <Material color="#cfcac0" roughness={0.9} />
      </mesh>

      {/* Glass envelope. */}
      <Explode offset={[0, 46, 0]}>
        <mesh geometry={glass}>
          <ClearGlass
            thickness={0.6}
            roughness={0.02}
            specularIntensity={0.75}
            depthWrite={false}
            color={p.burned ? '#b9bcbd' : '#ffffff'}
            emissive={glowState.color}
            emissiveIntensity={p.glow * 0.05}
          />
        </mesh>
        <GlassPrint text={printText} radius={30.06} y={74.5} cap={11} />
        <Anchor name="glass" position={[-21, 88, 0]} />
      </Explode>

      {/* Mount: flare, exhaust tube, pinch, arbor, button. */}
      <group>
        <mesh geometry={flare}>
          <Material {...STEM_GLASS} />
        </mesh>
        <mesh position={[0, 30, 0]}>
          <cylinderGeometry args={[1.25, 1.25, 12, 20]} />
          <Material {...STEM_GLASS} color="#dfe8e5" />
        </mesh>
        <mesh geometry={pinch} position={[0, 36.6, 0]}>
          <Material {...STEM_GLASS} />
        </mesh>
        <mesh position={[0, (40 + buttonY) / 2, 0]}>
          <cylinderGeometry args={[0.75, 0.8, buttonY - 40, 16]} />
          <Material {...STEM_GLASS} />
        </mesh>
        <mesh position={[0, buttonY, 0]} scale={[1, 0.75, 1]}>
          <sphereGeometry args={[1.9, 20, 14]} />
          <Material {...STEM_GLASS} />
        </mesh>
        <Anchor name="stem" position={[-3.4, 32, 0]} />

        {/* Molybdenum support hooks from the button to the filament. */}
        {hookAngles.map((a, i) => {
          const tip: Vec3 = [Math.cos(a) * arcR, filamentY - 0.25, Math.sin(a) * arcR];
          return (
            <Wire
              key={i}
              points={[
                [Math.cos(a) * 1.4, buttonY + 0.2, Math.sin(a) * 1.4],
                [Math.cos(a) * arcR * 0.55, buttonY + 2.2, Math.sin(a) * arcR * 0.55],
                [tip[0], tip[1] + 0.9, tip[2]],
                [tip[0] * 1.06, tip[1] - 0.2, tip[2] * 1.06],
              ]}
              radius={0.11}
              bend={0.6}
              material={{ preset: 'steel', color: '#c8c9cb', roughness: 0.25 }}
            />
          );
        })}
        <Anchor
          name="hook"
          position={[
            Math.cos(hookAngles[0]!) * arcR * 0.55,
            buttonY + 2.2,
            Math.sin(hookAngles[0]!) * arcR * 0.55,
          ]}
        />

        {/* Lead-in wires, sealed in the pinch. */}
        {([1, -1] as const).map((side) => (
          <group key={side}>
            <Wire
              points={leadIn(side)}
              radius={0.24}
              bend={2}
              material={{ preset: 'nickel', roughness: 0.25 }}
            />
          </group>
        ))}
        <Anchor name="lead" position={[-4.2, 50, -1.4]} />

        {/* Coiled tungsten filament. */}
        <mesh geometry={coilA}>
          <Material
            preset="steel"
            color="#8f9194"
            roughness={0.35}
            emissive={glowState.emissive}
            emissiveIntensity={glowState.emissiveIntensity}
          />
        </mesh>
        {p.burned && (
          <mesh geometry={coilB}>
            <Material preset="steel" color="#8f9194" roughness={0.35} />
          </mesh>
        )}
        <Anchor
          name="filament"
          position={[Math.cos(2.8) * arcR, filamentY + 0.6, Math.sin(2.8) * arcR]}
        />
      </group>

      {p.glow > 0.002 && (
        <>
          <pointLight
            position={lightAt}
            color={glowState.color}
            intensity={p.glow * 1200}
            decay={2}
          />
          <GlowSprite
            always
            color={glowState.color}
            intensity={Math.min(p.glow, 1.2) * 0.55}
            size={95}
            position={lightAt}
          />
          <GlowSprite
            always
            color={glowState.color}
            intensity={Math.min(p.glow, 1.2) * 0.9}
            size={30}
            position={lightAt}
          />
        </>
      )}
    </group>
  );
}

/** BA15s bayonet cap (IEC 60061-1, 7004-11): Ø 15 mm shell, two pins at 180°, one contact. */
function Ba15sBase() {
  const shell = useDisposable(
    () =>
      lathe(
        shellProfile(
          [
            [5.6, 2.2],
            [6.9, 2.5],
            [7.4, 3.3],
            [7.5, 4.2],
            [7.5, 15.4],
            [7.65, 16.2],
            [7.55, 16.9],
            [7.1, 17.2],
          ],
          0.26,
        ),
        56,
        { angle: 40 },
      ),
    [],
  );
  const insulator = useDisposable(
    () =>
      lathe(
        [
          [0, 1.0],
          [3.0, 1.0],
          [4.6, 1.6],
          [5.8, 2.4],
          [6.9, 3.6],
          [0, 3.6],
        ],
        40,
        { angle: 40 },
      ),
    [],
  );
  const contact = useDisposable(
    () =>
      lathe(
        [
          [0, 0],
          [1.4, 0.1],
          [2.2, 0.55],
          [2.5, 1.1],
          [0, 1.1],
        ],
        32,
        { angle: 50 },
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={shell}>
        <Material preset="nickel" color="#d7d2c8" roughness={0.28} clip />
      </mesh>
      <mesh geometry={insulator}>
        <Material color="#0c0c0e" roughness={0.15} clearcoat={1} clip cutColor="#1a1a1c" />
      </mesh>
      <mesh geometry={contact}>
        <Material preset="solder" clip />
      </mesh>
      {([1, -1] as const).map((side) => (
        <mesh key={side} position={[side * 8.2, 7.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.0, 1.0, 1.9, 20]} />
          <Material preset="nickel" color="#d7d2c8" roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function AutomotiveBulb(p: LitProps) {
  const glowState = useFilamentGlow(p.kelvin, p.glow);
  const watts = p.watts > 30 ? 21 : p.watts;
  const filamentY = 36.5;
  const half = watts >= 15 ? 2.9 : 2.0;

  const glass = useDisposable(() => {
    const outer: [number, number][] = [
      [6.9, 14.5],
      [7.05, 17.2],
      [7.2, 21.5],
      [7.9, 24.0],
      [9.4, 26.4],
    ];
    // Round bulb Ø 26 mm centred at y = 38.
    const cy = 38;
    const r = 13;
    const start = Math.asin((26.4 - cy) / r);
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      const a = start + ((Math.PI / 2 - start) * i) / steps;
      outer.push([r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return lathe(shellProfile(outer, 0.45), 56, { angle: 60 });
  }, []);

  const axis = useMemo(
    () => (s: number, target: Vector3) => {
      let y = filamentY;
      if (p.burned) {
        if (s < 0.5 && s > 0.25) y -= 1.6 * ((s - 0.25) / 0.22) ** 2;
        if (s > 0.5 && s < 0.75) y -= 1.1 * ((0.75 - s) / 0.22) ** 2;
      }
      return target.set(-half + 2 * half * s, y, 0);
    },
    [p.burned, half],
  );
  const turns = (2 * half) / 0.22;
  const coilA = useDisposable(() => {
    const curve = new CoilCurve(axis, 0, p.burned ? 0.46 : 1, 0.42, turns);
    return new TubeGeometry(curve, Math.ceil(turns * 10), 0.075, 5, false);
  }, [p.burned, half]);
  const coilB = useDisposable(() => {
    const curve = new CoilCurve(axis, 0.54, 1, 0.42, turns);
    return new TubeGeometry(curve, Math.ceil(turns * 5), 0.075, 5, false);
  }, [p.burned, half]);
  const bead = useDisposable(() => new RoundedBoxGeometry(6.4, 3.2, 2.4, 2, 0.9), []);

  const lightAt: Vec3 = [0, filamentY, 1];
  return (
    <group>
      <Ba15sBase />
      <Explode offset={[0, 26, 0]}>
        <mesh geometry={glass}>
          <ClearGlass
            thickness={0.5}
            roughness={0.02}
            specularIntensity={0.75}
            depthWrite={false}
            color={p.burned ? '#b9bcbd' : '#ffffff'}
            emissive={glowState.color}
            emissiveIntensity={p.glow * 0.05}
          />
        </mesh>
        <GlassPrint text={`12V ${formatNumber(watts)}W`} radius={13.03} y={38} cap={6} />
        <Anchor name="glass" position={[9, 44, 0]} />
      </Explode>

      {/* Glass bead holding the two support posts. */}
      <mesh geometry={bead} position={[0, 22.5, 0]}>
        <Material {...STEM_GLASS} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <Wire
          key={side}
          points={[
            [side * 1.6, 12, 0],
            [side * 1.6, 25, 0],
            [side * (half + 0.4), 30, 0],
            [side * (half + 0.4), filamentY + 0.5, 0],
          ]}
          radius={0.32}
          bend={1.5}
          material={{ preset: 'nickel', roughness: 0.25 }}
        />
      ))}
      <Anchor name="lead" position={[-(half + 0.4), 30, 0]} />
      <mesh geometry={coilA}>
        <Material
          preset="steel"
          color="#8f9194"
          roughness={0.35}
          emissive={glowState.emissive}
          emissiveIntensity={glowState.emissiveIntensity}
        />
      </mesh>
      {p.burned && (
        <mesh geometry={coilB}>
          <Material preset="steel" color="#8f9194" roughness={0.35} />
        </mesh>
      )}
      <Anchor name="filament" position={[0, filamentY + 0.5, 0.5]} />
      {p.glow > 0.002 && (
        <>
          <pointLight
            position={lightAt}
            color={glowState.color}
            intensity={p.glow * 300}
            decay={2}
          />
          <GlowSprite
            always
            color={glowState.color}
            intensity={Math.min(p.glow, 1.2) * 0.55}
            size={42}
            position={lightAt}
          />
          <GlowSprite
            always
            color={glowState.color}
            intensity={Math.min(p.glow, 1.2) * 0.9}
            size={12}
            position={lightAt}
          />
        </>
      )}
    </group>
  );
}
