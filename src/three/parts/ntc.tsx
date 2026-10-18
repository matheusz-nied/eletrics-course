/**
 * NTC thermistors. "disco": an epoxy-dipped ceramic disc with radial leads,
 * either the small 5 mm sensing type (MF11 style, body ≤ 5,5 × 3,5 mm,
 * leads 0,5 mm, printed with a 3-digit code such as 103) or the 9 mm
 * inrush-limiting power type (body ≤ 11,5 × 5 mm, leads 0,65 mm at 7,5 mm,
 * printed "10D-9"). "gota": the MF52 style epoxy bead (≤ 2,5 mm, 3,5 mm
 * long) on enamelled copper wires. Dimensions from typical MF11, MF72
 * (5D-9/10D-9) and MF52 datasheets; B constant 3950 K (sensing) or
 * 3000 K (power).
 */
import { formatNumber, formatOhms, smdResistorCode } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material, type MaterialProps } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe, roundedCylinderProfile } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { loft, type Pt } from './_semi-geometry';

type Variant = 'disco' | 'gota';
type Coat = 'verde' | 'preto' | 'azul';

export interface NtcProps {
  variant?: Variant;
  /** Resistance at 25 °C (Ω). 47 Ω or less on a disc = power (inrush) thermistor. */
  ohms25?: number;
  /** Temperature (°C): changes the resistance in the description and tints the body. */
  temperature?: number;
  color?: Coat;
  leadLength?: number;
}

const COATS: Record<Coat, { color: string; cut: string }> = {
  verde: { color: '#215a38', cut: '#173f27' },
  preto: { color: '#1c1c1e', cut: '#2a2a2d' },
  azul: { color: '#1f4d8a', cut: '#163764' },
};

interface DiscSpec {
  /** Coated body diameter and thickness (mm). */
  d: number;
  t: number;
  pitch: number;
  lead: number;
  /** Coating run-down below the round body, around the leads. */
  neck: number;
  /** Ceramic disc inside. */
  core: number;
  coreT: number;
}

const SMALL: DiscSpec = { d: 5.4, t: 3.2, pitch: 2.54, lead: 0.5, neck: 0.9, core: 4, coreT: 0.7 };
const POWER: DiscSpec = { d: 10.8, t: 4.8, pitch: 7.5, lead: 0.65, neck: 1.4, core: 9, coreT: 1.6 };

/** Bead (gota): head radius, height of the widest point, neck radius, wire spacing. */
const BEAD = { r: 1.25, waist: 2.3, neck: 0.95, spacing: 1.2, wire: 0.35 };

/** Edge rounding: rings shrink to this fraction of the outline at the flat faces. */
const CAP = 0.6;

function isPower(p: PartProps) {
  return p.variant !== 'gota' && Number(p.ohms25) <= 47;
}

function codeOf(p: PartProps): string {
  const ohms = Number(p.ohms25);
  if (p.variant === 'gota') return '';
  if (ohms <= 47) {
    const n = Number.isInteger(ohms) ? String(ohms) : formatNumber(ohms, 2).replace(',', 'R');
    return `${n}D-9`;
  }
  return smdResistorCode(ohms);
}

/** Beta model: R(T) = R25 · e^(B · (1/T − 1/298,15 K)). */
export function ntcResistance(ohms25: number, celsius: number, beta = 3950): number {
  return ohms25 * Math.exp(beta * (1 / (celsius + 273.15) - 1 / 298.15));
}

/** A faint warm (hot) or cool (cold) tint: a visual hint only. */
function thermalTint(celsius: number): MaterialProps {
  if (celsius > 60) {
    return { emissive: '#ff4a12', emissiveIntensity: Math.min((celsius - 60) / 90, 1) * 0.3 };
  }
  if (celsius < 5) {
    return { emissive: '#3d8bff', emissiveIntensity: Math.min((5 - celsius) / 25, 1) * 0.22 };
  }
  return {};
}

export const meta: PartMeta = {
  id: 'ntc',
  label: 'Termistor NTC',
  category: 'sensores',
  summary:
    'Resistor sensível à temperatura: um disco ou uma gota de cerâmica semicondutora cuja resistência cai quando esquenta.',
  defaults: { variant: 'disco', ohms25: 10000, temperature: 25, color: 'verde', leadLength: 12 },
  controls: {
    variant: {
      kind: 'select',
      label: 'Formato',
      options: [
        { value: 'disco', label: 'Disco' },
        { value: 'gota', label: 'Gota (sonda)' },
      ],
    },
    ohms25: {
      kind: 'select',
      label: 'Resistência a 25 °C',
      options: [
        { value: 5, label: '5 Ω (potência, 5D-9)' },
        { value: 10, label: '10 Ω (potência, 10D-9)' },
        { value: 1000, label: '1 kΩ' },
        { value: 4700, label: '4,7 kΩ' },
        { value: 10000, label: '10 kΩ' },
        { value: 47000, label: '47 kΩ' },
        { value: 100000, label: '100 kΩ' },
      ],
    },
    temperature: {
      kind: 'number',
      label: 'Temperatura',
      min: -20,
      max: 150,
      step: 5,
      unit: '°C',
    },
    color: {
      kind: 'select',
      label: 'Cor do revestimento',
      options: [
        { value: 'verde', label: 'Verde' },
        { value: 'preto', label: 'Preto' },
        { value: 'azul', label: 'Azul' },
      ],
    },
    leadLength: { kind: 'number', label: 'Terminais', min: 4, max: 30, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const y0 = Number(p.leadLength);
    if (p.variant === 'gota') {
      return [
        {
          at: [0, 0, 0],
          text: 'Gota de epóxi: pequena, acompanha a temperatura em poucos segundos',
          anchor: 'coat',
        },
        {
          at: [0, 0, 0],
          text: 'Chip de cerâmica semicondutora entre os dois fios',
          anchor: 'chip',
          exploded: true,
        },
        {
          at: [BEAD.spacing / 2, Math.min(5, y0 * 0.45), 0],
          text: 'Fios de cobre esmaltado, com pontas estanhadas',
          exploded: false,
        },
      ] satisfies PartAnnotation[];
    }
    const s = isPower(p) ? POWER : SMALL;
    const code = codeOf(p);
    return [
      {
        at: [0, y0 + s.d / 2 + s.neck, s.t / 2],
        text: `${code}: ${formatOhms(Number(p.ohms25))} a 25 °C${isPower(p) ? ', disco de 9 mm' : ''}`,
        exploded: false,
      },
      {
        at: [0, 0, 0],
        text: 'Disco de óxidos metálicos: quanto mais quente, mais conduz',
        anchor: 'core',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Eletrodo de prata em cada face, soldado a um terminal',
        anchor: 'electrode',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Revestimento de epóxi: isola e protege da umidade',
        anchor: 'coat',
        exploded: true,
      },
      {
        at: [s.pitch / 2, Math.min(4, y0 * 0.4), 0],
        text: 'Dois terminais, sem polaridade',
        exploded: false,
      },
    ] satisfies PartAnnotation[];
  },
  explode: true,
  cutaway: true,
  // Discs are cut across their thickness (coating, electrodes, ceramic); beads through the wires.
  cut: (p) => (p.variant === 'gota' ? {} : { normal: [-1, 0, 0] }),
  describe: (p) => {
    const r25 = Number(p.ohms25);
    const t = Number(p.temperature);
    const power = isPower(p);
    const beta = power ? 3000 : 3950;
    const r = ntcResistance(r25, t, beta);
    const code = codeOf(p);
    const shape =
      p.variant === 'gota'
        ? 'em gota de epóxi, como as das sondas de temperatura,'
        : `em disco${code ? ` marcado ${code}` : ''},`;
    return `Termistor NTC ${shape} de ${formatOhms(r25)} a 25 °C. A ${formatNumber(t)} °C, a resistência fica perto de ${formatOhms(r)}: ela cai quando a temperatura sobe (constante B de cerca de ${formatNumber(beta)} K).${
      power ? ' Este modelo de potência limita o pico de corrente ao ligar fontes e motores.' : ''
    }`;
  },
  view: [0.95, 0.45, 1.35],
};

type V2 = [number, number];

function cubic(a: V2, b: V2, c: V2, d: V2, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

/**
 * Front outline (x, y) of the dipped body, centred on the disc: a circle
 * whose bottom runs down into the coating around the leads.
 */
function discFront(r: number, hw: number, neck: number): Pt[] {
  const a = Math.asin(Math.min(0.95, (hw + (r - hw) * 0.35) / r));
  const pts: Pt[] = [];
  const t0 = -Math.PI / 2 + a;
  const t1 = (3 * Math.PI) / 2 - a;
  const arcSteps = 44;
  for (let i = 0; i <= arcSteps; i++) {
    const t = t0 + ((t1 - t0) * i) / arcSteps;
    pts.push([r * Math.cos(t), r * Math.sin(t)]);
  }
  const yb = -r - neck;
  const rc = Math.min(0.35, neck * 0.4, hw * 0.3);
  const pl: V2 = [-r * Math.sin(a), -r * Math.cos(a)];
  const pr: V2 = [r * Math.sin(a), -r * Math.cos(a)];
  const k1 = r * 0.3;
  const k2 = (pl[1] - (yb + rc)) * 0.45;
  const bl: V2 = [-hw, yb + rc];
  const br: V2 = [hw, yb + rc];
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    pts.push(
      cubic(
        pl,
        [pl[0] + Math.cos(a) * k1, pl[1] - Math.sin(a) * k1],
        [bl[0], bl[1] + k2],
        bl,
        i / steps,
      ),
    );
  }
  for (let i = 1; i <= 3; i++) {
    const t = Math.PI + (i / 3) * (Math.PI / 2);
    pts.push([-hw + rc + rc * Math.cos(t), yb + rc + rc * Math.sin(t)]);
  }
  for (let i = 1; i <= 3; i++) pts.push([-hw + rc + (2 * (hw - rc) * i) / 4, yb]);
  for (let i = 0; i <= 3; i++) {
    const t = (3 * Math.PI) / 2 + (i / 3) * (Math.PI / 2);
    pts.push([hw - rc + rc * Math.cos(t), yb + rc + rc * Math.sin(t)]);
  }
  for (let i = 1; i < steps; i++) {
    pts.push(
      cubic(
        br,
        [br[0], br[1] + k2],
        [pr[0] - Math.cos(a) * k1, pr[1] - Math.sin(a) * k1],
        pr,
        i / steps,
      ),
    );
  }
  return pts;
}

export default function Ntc(props: NtcProps) {
  const p = { ...meta.defaults, ...props } as Required<NtcProps>;
  return p.variant === 'gota' ? <Bead {...p} /> : <Disc {...p} />;
}

function coatMaterial(p: Required<NtcProps>): MaterialProps {
  const coat = COATS[p.color] ?? COATS.verde;
  return {
    preset: 'epoxyOrange',
    color: coat.color,
    roughness: 0.42,
    clearcoat: 0.45,
    clearcoatRoughness: 0.35,
    clip: true,
    cutColor: coat.cut,
    ...thermalTint(p.temperature),
  };
}

function Disc(p: Required<NtcProps>) {
  const power = isPower(p);
  const s = power ? POWER : SMALL;
  const y0 = Math.max(p.leadLength, 2);
  const r = s.d / 2;
  const hw = s.pitch / 2 + s.lead / 2 + 0.25;
  const yc = y0 + r + s.neck;
  const code = codeOf(p);
  const coat = COATS[p.color] ?? COATS.verde;
  const key = power ? 'p' : 's';

  const body = useDisposable(() => {
    const front = discFront(r, hw, s.neck);
    const rings = [];
    const steps = 8;
    for (let i = -steps; i <= steps; i++) {
      const phi = (i / steps) * (Math.PI / 2);
      const k = CAP + (1 - CAP) * Math.cos(phi);
      rings.push({
        y: (s.t / 2) * Math.sin(phi),
        pts: front.map(([x, y]): Pt => [x * k, -y * k]),
      });
    }
    const g = loft(rings, {
      topGroup: true,
      topBounds: [-r * CAP, r * CAP, -r * CAP, (r + s.neck) * CAP],
    });
    // Loft axis (depth) becomes +Z, the outline's second coordinate becomes Y.
    g.rotateX(Math.PI / 2);
    g.translate(0, yc, 0);
    return g;
  }, [key, yc]);

  const capW = 2 * r * CAP;
  const capH = (2 * r + s.neck) * CAP;
  const cw = 512;
  const ch = Math.round((cw * capH) / capW);
  const mark = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = coat.color;
      ctx.fillRect(0, 0, w, h);
      const cy = (h * r) / (2 * r + s.neck);
      ctx.fillStyle = '#efeee6';
      fitText(ctx, code, w / 2, cy, w * (power ? 0.82 : 0.7), h * (power ? 0.26 : 0.36), {
        weight: 700,
        family: FONT_SANS,
      });
    },
    `ntc-${key}-${code}-${p.color}`,
    { width: cw, height: ch, fonts: [`700 40px ${FONT_SANS}`] },
  );

  const core = useDisposable(() => {
    const g = axialLathe(
      roundedCylinderProfile(s.core / 2, -s.coreT / 2, s.coreT / 2, 0.12, 4),
      48,
    );
    g.rotateX(Math.PI / 2);
    return g;
  }, [key]);

  const noise = getNoiseTexture();
  const coatProps = coatMaterial(p);
  const leadR = s.lead / 2;
  const elT = 0.03;
  const faceZ = s.coreT / 2 + elT;

  const leadPath = (side: number): Vec3[] => {
    const x0 = (side * s.pitch) / 2;
    const z = side * (faceZ + leadR);
    return [
      [x0, 0, 0],
      [x0, y0 + 0.2, 0],
      // Formed to the centre of each face.
      [0, yc - s.core * 0.33, z],
      [0, yc + s.core * 0.14, z],
    ];
  };

  return (
    <group>
      <Explode offset={[0, s.d + s.neck + 3, 0]}>
        <mesh geometry={body}>
          <Material attach="material-0" {...coatProps} roughnessMap={noise} />
          <Material attach="material-1" {...coatProps} color="#ffffff" map={mark} />
        </mesh>
        {[-1, 1].map((side) => (
          <Drip key={side} spec={s} side={side} y0={y0} material={coatProps} />
        ))}
        <Anchor name="coat" position={[r * 0.75, yc + r * 0.55, s.t * 0.3]} />
      </Explode>

      <group position={[0, yc, 0]}>
        <mesh geometry={core}>
          <Material color="#3a3938" roughness={0.78} roughnessMap={noise} clip cutColor="#262524" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[0, 0, side * (s.coreT / 2 + elT / 2)]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[s.core / 2 - 0.25, s.core / 2 - 0.25, elT, 48]} />
            <Material color="#dedbd3" metalness={0.9} roughness={0.42} clip cutColor="#a9a6a0" />
          </mesh>
        ))}
        <Anchor name="core" position={[-s.core / 2, s.core * 0.12, 0]} />
        <Anchor name="electrode" position={[-s.core * 0.28, s.core * 0.22, -faceZ]} />
      </group>

      {[-1, 1].map((side) => {
        const path = leadPath(side);
        const end = path[path.length - 1]!;
        return (
          <group key={side}>
            <Wire
              points={path}
              radius={leadR}
              bend={s.lead * 2.2}
              material={{ preset: 'tin', roughness: 0.3, clip: true }}
            />
            <mesh
              position={[end[0], yc - s.core * 0.06, side * (faceZ + leadR * 0.6)]}
              scale={[1, 1.5, 0.55]}
            >
              <sphereGeometry args={[leadR * 1.7, 20, 14]} />
              <Material preset="solder" roughness={0.25} clip />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Coating run down a lead, a little longer on one side. */
function Drip({
  spec,
  side,
  y0,
  material,
}: {
  spec: DiscSpec;
  side: number;
  y0: number;
  material: MaterialProps;
}) {
  const geometry = useDisposable(() => {
    const len = side < 0 ? spec.neck * 1.1 : spec.neck * 0.75;
    const top = spec.lead / 2 + spec.neck * 0.45;
    const profile: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      profile.push([spec.lead / 2 + 0.03 + (top - spec.lead / 2) * t * t, -len + (len + 0.4) * t]);
    }
    return axialLathe(profile, 20);
  }, [spec, side]);
  return (
    <mesh geometry={geometry} position={[(side * spec.pitch) / 2, y0, 0]}>
      <Material {...material} />
    </mesh>
  );
}

function Bead(p: Required<NtcProps>) {
  const y0 = Math.max(p.leadLength, 2);
  const yc = y0 + BEAD.waist - 0.1;
  const coatProps = coatMaterial(p);

  const bead = useDisposable(() => {
    const { r, waist, neck } = BEAD;
    const profile: [number, number][] = [
      [0, 0],
      [neck - 0.12, 0],
      [neck - 0.035, 0.035],
      [neck, 0.12],
    ];
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      profile.push([
        neck + (r - neck) * Math.sin((Math.PI / 2) * t) ** 2,
        0.12 + (waist - 0.12) * t,
      ]);
    }
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      profile.push([r * Math.cos(a), waist + r * 0.95 * Math.sin(a)]);
    }
    const g = axialLathe(profile, 48);
    g.scale(1, 1, 0.8);
    g.translate(0, y0, 0);
    return g;
  }, [y0]);

  const noise = getNoiseTexture();
  const tip = Math.min(3, y0 * 0.4);
  const wireR = BEAD.wire / 2;
  const chip = { w: 0.5, h: 0.5, d: 0.35, cap: 0.05 };
  const xIn = chip.w / 2 + chip.cap + wireR - 0.02;
  const enamel: MaterialProps = {
    preset: 'copper',
    color: '#c8693c',
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  };

  return (
    <group>
      <Explode offset={[0, 5, 0]}>
        <mesh geometry={bead}>
          <Material {...coatProps} roughnessMap={noise} />
        </mesh>
        <Anchor name="coat" position={[BEAD.r * 0.8, y0 + BEAD.waist + 0.4, 0.4]} />
      </Explode>

      <group position={[0, yc, 0]}>
        <mesh>
          <boxGeometry args={[chip.w, chip.h, chip.d]} />
          <Material color="#3a3938" roughness={0.75} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (chip.w / 2 + chip.cap / 2), 0, 0]}>
            <boxGeometry args={[chip.cap, chip.h + 0.02, chip.d + 0.02]} />
            <Material color="#dedbd3" metalness={0.9} roughness={0.4} />
          </mesh>
        ))}
        <Anchor name="chip" position={[0, chip.h / 2, chip.d / 2]} />
      </group>

      {[-1, 1].map((side) => {
        const x = (side * BEAD.spacing) / 2;
        return (
          <group key={side}>
            <Wire
              points={[
                [x, 0, 0],
                [x, tip + 0.2, 0],
              ]}
              radius={wireR}
              material={{ preset: 'tin', roughness: 0.3 }}
            />
            <Wire
              points={[
                [x, tip, 0],
                [x, yc - 0.75, 0],
                [side * xIn, yc - 0.3, 0],
                [side * xIn, yc + 0.2, 0],
              ]}
              radius={wireR * 0.97}
              bend={0.4}
              material={enamel}
            />
            <mesh position={[side * (xIn - 0.04), yc - 0.05, 0]} scale={[0.8, 1.4, 1]}>
              <sphereGeometry args={[0.2, 16, 12]} />
              <Material preset="solder" roughness={0.25} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
