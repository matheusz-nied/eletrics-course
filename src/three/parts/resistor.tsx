/**
 * Resistor: carbon or metal film (1/8 W to 3 W) with colour bands, 5 W
 * cement resistor and SMD chips (0603, 0805, 1206). Real dimensions from
 * typical datasheets (Yageo CFR/MFR, KOA). Exploded view and cutaway show
 * the ceramic rod, the spiral-cut film and the end caps.
 */
import { useMemo } from 'react';
import { Color } from 'three';
import { BAND_RGB, resistorBands, resistorBodyColor } from '../core/colorCode';
import { formatOhms, formatWatts, smdResistorCode } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { blackbodyColor, celsiusToKelvin, glowIntensity } from '../fx/blackbody';
import { Material } from '../materials/Material';
import { FONT_MONO, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';

type Package = 'axial' | 'smd-0603' | 'smd-0805' | 'smd-1206';

export interface ResistorProps {
  ohms?: number;
  /** Tolerance in % (5 → gold band, 1 → brown band). */
  tolerance?: number;
  /** Rated power in W: 0.125, 0.25, 0.5, 1, 2, 3 or 5 (cement). */
  watts?: number;
  package?: Package;
  /** Lead shape of axial resistors. */
  leads?: 'retos' | 'dobrados';
  /** Height of the body axis above the lead ends when the leads are bent (mm). */
  leadDrop?: number;
  /** Body temperature in °C: discolours above 150 °C, glows above ~480 °C. */
  temperature?: number;
  /** Burned by overload: charred body. */
  burned?: boolean;
}

/** Body length, diameter and lead diameter (mm) by power rating. */
const AXIAL_SIZES: Record<
  string,
  { length: number; diameter: number; lead: number; pitch: number }
> = {
  '0.125': { length: 3.3, diameter: 1.8, lead: 0.45, pitch: 7.62 },
  '0.25': { length: 6.3, diameter: 2.4, lead: 0.6, pitch: 10.16 },
  '0.5': { length: 9, diameter: 3.2, lead: 0.6, pitch: 12.7 },
  '1': { length: 11.5, diameter: 4.5, lead: 0.8, pitch: 15.24 },
  '2': { length: 15.5, diameter: 5, lead: 0.8, pitch: 20.32 },
  '3': { length: 17.5, diameter: 6, lead: 0.8, pitch: 22.86 },
};

/** SMD chips: length, width, thickness (mm). */
const SMD_SIZES: Record<string, [number, number, number]> = {
  'smd-0603': [1.6, 0.8, 0.45],
  'smd-0805': [2, 1.25, 0.5],
  'smd-1206': [3.2, 1.6, 0.55],
};

const LEAD_LENGTH = 14;

export const meta: PartMeta = {
  id: 'resistor',
  label: 'Resistor',
  category: 'passivos',
  summary:
    'Resistor de filme com faixas de cor, resistor de cimento e resistor SMD, em tamanho real.',
  defaults: {
    ohms: 4700,
    tolerance: 5,
    watts: 0.25,
    package: 'axial',
    leads: 'retos',
    leadDrop: 9,
    temperature: 25,
    burned: false,
  },
  controls: {
    ohms: { kind: 'number', label: 'Resistência', min: 1, max: 10_000_000, log: true, unit: 'Ω' },
    tolerance: {
      kind: 'select',
      label: 'Tolerância',
      options: [
        { value: 5, label: '5 % (dourado)' },
        { value: 10, label: '10 % (prateado)' },
        { value: 2, label: '2 % (vermelho)' },
        { value: 1, label: '1 % (marrom)' },
      ],
    },
    watts: {
      kind: 'select',
      label: 'Potência',
      options: [
        { value: 0.125, label: '1/8 W' },
        { value: 0.25, label: '1/4 W' },
        { value: 0.5, label: '1/2 W' },
        { value: 1, label: '1 W' },
        { value: 2, label: '2 W' },
        { value: 3, label: '3 W' },
        { value: 5, label: '5 W (cimento)' },
      ],
    },
    package: {
      kind: 'select',
      label: 'Encapsulamento',
      options: [
        { value: 'axial', label: 'Terminais (PTH)' },
        { value: 'smd-1206', label: 'SMD 1206' },
        { value: 'smd-0805', label: 'SMD 0805' },
        { value: 'smd-0603', label: 'SMD 0603' },
      ],
    },
    leads: {
      kind: 'select',
      label: 'Terminais',
      options: [
        { value: 'retos', label: 'Retos' },
        { value: 'dobrados', label: 'Dobrados para a placa' },
      ],
    },
    leadDrop: {
      kind: 'number',
      label: 'Altura dos terminais dobrados',
      min: 3,
      max: 20,
      step: 0.5,
      unit: 'mm',
    },
    temperature: { kind: 'number', label: 'Temperatura', min: 25, max: 900, step: 5, unit: '°C' },
    burned: { kind: 'toggle', label: 'Queimado' },
  },
  annotations: (p) => {
    const kind = kindOf(p);
    if (kind === 'smd') {
      return [
        { at: [0, 0.6, 0], text: 'Código: valor em 3 dígitos', exploded: false },
        { at: [0, 0.2, 0.9], text: 'Terminal estanhado (solda)', anchor: 'term', exploded: false },
        { at: [0, 1.6, 0], text: 'Camada resistiva', anchor: 'coat', exploded: true },
        { at: [0, 0, 0], text: 'Base de cerâmica (alumina)', anchor: 'base', exploded: true },
      ];
    }
    if (kind === 'cement') {
      return [
        { at: [0, 9.5, 2], text: 'Potência, valor e tolerância impressos', exploded: false },
        { at: [12, 4.5, 0], text: 'Corpo de cerâmica: aguenta calor', exploded: false },
      ];
    }
    const size = sizeOf(p);
    return [
      {
        at: [-size.length * 0.12, size.diameter, 0],
        text: 'Faixas de cor: valor e tolerância',
        exploded: false,
      },
      { at: [size.length / 2 + 6, 0.5, 0], text: 'Terminal de cobre estanhado', exploded: false },
      { at: [0, 0, 0], text: 'Revestimento isolante (laca)', anchor: 'shell', exploded: true },
      { at: [0, 0, 0], text: 'Filme resistivo cortado em espiral', anchor: 'film', exploded: true },
      { at: [0, 0, 0], text: 'Tampa metálica soldada ao terminal', anchor: 'cap', exploded: true },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const ohms = Number(p.ohms);
    const kind = kindOf(p);
    const base =
      kind === 'smd'
        ? `Resistor SMD ${String(p.package).replace('smd-', '')} de ${formatOhms(ohms)}, marcado ${smdResistorCode(ohms)}`
        : kind === 'cement'
          ? `Resistor de cimento de ${formatOhms(ohms)}, 5 W`
          : `Resistor de ${formatOhms(ohms)}, ${formatWatts(Number(p.watts))}, tolerância de ${p.tolerance} %, faixas ${resistorBands(ohms, Number(p.tolerance), bandCountOf(p)).bands.join(', ')}`;
    return p.burned ? `${base}, queimado.` : `${base}.`;
  },
  view: [0.6, 0.9, 1.5],
};

function kindOf(p: PartProps): 'axial' | 'cement' | 'smd' {
  if (String(p.package).startsWith('smd')) return 'smd';
  return Number(p.watts) >= 5 ? 'cement' : 'axial';
}

function sizeOf(p: PartProps) {
  return AXIAL_SIZES[String(p.watts)] ?? AXIAL_SIZES['0.25']!;
}

function bandCountOf(p: PartProps): 4 | 5 {
  return Number(p.tolerance) <= 2 ? 5 : 4;
}

export default function Resistor(props: ResistorProps) {
  const p = { ...meta.defaults, ...props } as Required<ResistorProps>;
  const kind = kindOf(p);
  if (kind === 'smd') return <SmdResistor {...p} />;
  if (kind === 'cement') return <CementResistor {...p} />;
  return <AxialResistor {...p} />;
}

/** Lacquer colour darkened by heat and by burning. */
function heatedBody(base: string, temperature: number, burned: boolean): string {
  const color = new Color(base);
  if (burned) return '#1d1410';
  if (temperature > 150) {
    const t = Math.min((temperature - 150) / 350, 1);
    color.lerp(new Color('#3b2414'), t * 0.85);
  }
  return `#${color.getHexString()}`;
}

function AxialResistor(p: Required<ResistorProps>) {
  const size = sizeOf(p);
  const { length: L, diameter: D, lead } = size;
  const R = D / 2;
  const bandCount = bandCountOf(p);
  const { bands } = resistorBands(p.ohms, p.tolerance, bandCount);
  const bodyBase = p.watts >= 1 ? '#8fa8bc' : resistorBodyColor(bandCount);
  const body = heatedBody(bodyBase, p.temperature, p.burned);
  const glow = glowIntensity(celsiusToKelvin(p.temperature));

  // Dog-bone body: end caps under the lacquer are wider than the middle.
  const shellGeometry = useDisposable(() => {
    const waist = R * 0.86;
    const capLength = L * 0.24;
    const profile: [number, number][] = [];
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const y = -L / 2 + (L * i) / steps;
      const fromEnd = Math.min(y + L / 2, L / 2 - y);
      // Round ends: a quarter ellipse over the first 0.6 R.
      const end =
        fromEnd < R * 0.6 ? Math.sqrt(Math.max(0, 1 - ((R * 0.6 - fromEnd) / (R * 0.6)) ** 2)) : 1;
      // Shoulder between the cap and the waist.
      const t = Math.min(Math.max((fromEnd - capLength) / (R * 0.7), 0), 1);
      const shoulder = t * t * (3 - 2 * t);
      const r = (R - (R - waist) * shoulder) * (0.55 + 0.45 * end);
      profile.push([r, y]);
    }
    profile.unshift([0, -L / 2]);
    profile.push([0, L / 2]);
    return axialLathe(profile, 48);
  }, [L, R]);

  // Bands painted along the axis (V = height in the lathe).
  const bandMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, w, h);
      const positions = bandCount === 5 ? [0.17, 0.3, 0.42, 0.54, 0.81] : [0.19, 0.34, 0.48, 0.79];
      const bandWidth = bandCount === 5 ? 0.075 : 0.085;
      bands.forEach((band, i) => {
        const color = new Color(BAND_RGB[band]);
        if (p.burned) color.lerp(new Color('#120c09'), 0.85);
        else if (p.temperature > 150)
          color.lerp(new Color('#3b2414'), Math.min((p.temperature - 150) / 400, 0.8));
        ctx.fillStyle = `#${color.getHexString()}`;
        // V grows with height, canvas Y grows downwards.
        const y = (1 - positions[i]! - bandWidth / 2) * h;
        ctx.fillRect(0, y, w, bandWidth * h);
      });
      if (p.burned) {
        // Charred crack across the body.
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, h * 0.62, w, h * 0.012);
      }
    },
    `${body}|${bands.join(',')}|${bandCount}|${p.burned}|${Math.round(p.temperature / 10)}`,
    { width: 8, height: 512 },
  );

  // Gold and silver bands are metallic paint.
  const metalMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const positions = bandCount === 5 ? [0.17, 0.3, 0.42, 0.54, 0.81] : [0.19, 0.34, 0.48, 0.79];
      const bandWidth = bandCount === 5 ? 0.075 : 0.085;
      bands.forEach((band, i) => {
        if (p.burned || (band !== 'dourado' && band !== 'prateado')) return;
        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(0, (1 - positions[i]! - bandWidth / 2) * h, w, bandWidth * h);
      });
    },
    `${bands.join(',')}|${bandCount}|${p.burned}`,
    { width: 8, height: 512, color: false },
  );

  // Spiral cut of the film, seen in the cutaway.
  const filmMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = p.burned ? '#0e0b09' : bandCount === 5 ? '#55595e' : '#1f1b18';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e9e4d6';
      ctx.lineWidth = 3;
      const turns = 7;
      for (let i = -turns; i <= turns * 2; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i / turns) * h);
        ctx.lineTo(w, (i / turns) * h + h / turns);
        ctx.stroke();
      }
    },
    `${bandCount}|${p.burned}`,
    { width: 128, height: 256 },
  );

  const capLength = L * 0.2;
  const leadR = lead / 2;
  const bent = p.leads === 'dobrados';
  const lift = bent ? Math.max(p.leadDrop, R + 0.5) : R;
  const half = bent ? size.pitch / 2 : L / 2 + LEAD_LENGTH;
  const leadPoints = (side: 1 | -1): Vec3[] =>
    bent
      ? [
          [side * (L / 2 - 0.4), 0, 0],
          [side * half, 0, 0],
          [side * half, -lift, 0],
        ]
      : [
          [side * (L / 2 - 0.4), 0, 0],
          [side * half, 0, 0],
        ];
  const glowColor = useMemo(() => blackbodyColor(celsiusToKelvin(p.temperature)), [p.temperature]);
  const noise = getNoiseTexture();

  return (
    <group position={[0, lift, 0]}>
      {/* Lacquer shell (lathe along Y, turned to lie along X). */}
      <Explode offset={[0, D * 2.6, 0]}>
        <mesh geometry={shellGeometry} rotation={[0, 0, -Math.PI / 2]}>
          <Material
            preset="lacquer"
            clip
            color="#ffffff"
            map={bandMap}
            metalness={1}
            metalnessMap={metalMap}
            roughnessMap={noise}
            roughness={p.burned ? 0.9 : 0.42}
            clearcoat={p.burned ? 0 : 0.6}
            emissive={glow > 0 ? glowColor : '#000000'}
            emissiveIntensity={glow * 1.5}
            cutColor="#6b5a45"
          />
        </mesh>
        <Anchor name="shell" position={[0, R, 0]} />
      </Explode>

      {/* Ceramic rod with the resistive film. */}
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[R * 0.6, R * 0.6, L - capLength * 0.6, 32]} />
        <Material preset="carbonFilm" color="#ffffff" map={filmMap} roughness={0.7} />
      </mesh>
      <Anchor name="film" position={[-L * 0.1, R * 0.6, 0]} />

      {/* End caps and leads move apart in the exploded view. */}
      {([-1, 1] as const).map((side) => (
        <Explode key={side} offset={[side * Math.max(L * 0.35, 2.5), 0, 0]}>
          <mesh
            position={[side * (L / 2 - capLength / 2 - R * 0.15), 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[R * 0.7, R * 0.7, capLength, 32]} />
            <Material preset="nickel" />
          </mesh>
          <Wire points={leadPoints(side)} radius={leadR} bend={1.2} />
          {side === 1 && <Anchor name="cap" position={[L / 2 - capLength / 2, R * 0.7, 0]} />}
        </Explode>
      ))}
    </group>
  );
}

function CementResistor(p: Required<ResistorProps>) {
  const [W, H, T] = [22, 9.5, 9];
  const label = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = p.burned ? '#3a302a' : '#f1ede3';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = p.burned ? '#120e0b' : '#1d1d1f';
      fitText(
        ctx,
        `5W ${formatOhms(p.ohms).replace(' ', '')} ${p.tolerance === 5 ? 'J' : p.tolerance === 10 ? 'K' : 'F'}`,
        w / 2,
        h / 2,
        w * 0.86,
        h * 0.36,
        {
          weight: 700,
          family: FONT_MONO,
        },
      );
    },
    `${p.ohms}|${p.tolerance}|${p.burned}`,
    { width: 512, height: 220, fonts: [`700 40px ${FONT_MONO}`] },
  );
  const noise = getNoiseTexture();
  return (
    <group>
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[W, H, T]} />
        <Material
          preset="ceramicWhite"
          roughnessMap={noise}
          roughness={0.8}
          clip
          color={p.burned ? '#5a4c40' : '#efebe2'}
        />
      </mesh>
      {/* Printed face. */}
      <mesh position={[0, H / 2, T / 2 + 0.01]}>
        <planeGeometry args={[W * 0.96, H * 0.9]} />
        <Material preset="ceramicWhite" map={label} roughness={0.85} color="#ffffff" />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <Wire
          key={side}
          points={[
            [side * (W / 2 - 1), H * 0.3, 0],
            [side * (W / 2 + LEAD_LENGTH), H * 0.3, 0],
          ]}
          radius={0.4}
        />
      ))}
    </group>
  );
}

function SmdResistor(p: Required<ResistorProps>) {
  const [L, W, T] = SMD_SIZES[p.package] ?? SMD_SIZES['smd-0805']!;
  const term = L * 0.2;
  const code = smdResistorCode(p.ohms, p.tolerance <= 1);
  const marking = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = p.burned ? '#0b0a09' : '#151414';
      ctx.fillRect(0, 0, w, h);
      if (p.package === 'smd-0603') return; // too small to be marked
      ctx.fillStyle = '#e9e9e4';
      fitText(ctx, code, w / 2, h / 2 + 4, w * 0.8, h * 0.62, { weight: 500, family: FONT_MONO });
    },
    `${code}|${p.package}|${p.burned}`,
    { width: 256, height: 128, fonts: [`500 40px ${FONT_MONO}`] },
  );
  return (
    <group>
      <Explode offset={[0, 0, 0]}>
        <mesh position={[0, T * 0.42, 0]}>
          <boxGeometry args={[L - 0.04, T * 0.84, W]} />
          <Material preset="ceramicWhite" />
        </mesh>
        <Anchor name="base" position={[0, T * 0.4, W / 2]} />
      </Explode>
      <Explode offset={[0, T * 2.2, 0]}>
        <mesh position={[0, T * 0.84 + 0.04, 0]}>
          <boxGeometry args={[L - term * 2 + 0.1, 0.08, W * 0.94]} />
          <Material preset="epoxyBlack" color="#ffffff" map={marking} roughness={0.55} />
        </mesh>
        <Anchor name="coat" position={[0, T * 0.9, 0]} />
      </Explode>
      {([-1, 1] as const).map((side) => (
        <Explode key={side} offset={[side * L * 0.6, 0, 0]}>
          <mesh position={[side * (L / 2 - term / 2), T / 2, 0]}>
            <boxGeometry args={[term, T + 0.02, W + 0.02]} />
            <Material preset="tin" roughness={0.35} />
          </mesh>
          {side === 1 && <Anchor name="term" position={[L / 2 - term / 2, T, 0]} />}
        </Explode>
      ))}
    </group>
  );
}
