/**
 * Ceramic capacitors with radial leads: the orange-brown dipped disc (a
 * ceramic disc with fired silver electrodes on both faces) and the blue
 * dipped multilayer chip ("monolítico", MLCC). Body sizes, pitches (2,54 or
 * 5,08 mm) and the 3-digit pF code follow typical datasheets (e.g. Vishay
 * K-series/D-series discs, Kemet C315–C330 Goldmax radial MLCC).
 */
import { capacitorCode, formatFarads, formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { blobBottom, blobDecalGeometry, blobGeometry, type BlobShape } from './_passive-common';

export type CeramicVariant = 'disco' | 'multicamada';

export interface CeramicCapacitorProps {
  /** Capacitance in farads (1e-7 = 100 nF, code 104). */
  farads?: number;
  /** Rated voltage (V). */
  voltage?: number;
  variant?: CeramicVariant;
  /** Lead length below the body (mm). */
  leadLength?: number;
}

const LEAD = 0.5;

interface Geometry {
  shape: BlobShape;
  pitch: number;
  /** Ceramic disc (or chip) inside. */
  core: { r: number; t: number };
}

/** Body of a dipped disc by value and voltage (mm). */
function discGeometry(farads: number, voltage: number): Geometry {
  const pf = farads * 1e12;
  let d =
    pf <= 100
      ? 4
      : pf <= 1000
        ? 5
        : pf <= 10_000
          ? 5.5
          : pf <= 47_000
            ? 6.5
            : pf <= 100_000
              ? 7
              : 8.5;
  const hv = voltage >= 1000;
  if (hv) d *= 1.35;
  else if (voltage >= 500) d *= 1.15;
  d = Math.min(d, 12);
  const t = hv ? 1.1 : 0.6;
  const c = t / 2 + 0.04 + LEAD + 0.35;
  return {
    shape: { a: d / 2, b: d / 2, c, e1: 0.5, e2: 1, drip: 0.16, bottom: 0.25, taper: 0.18 },
    pitch: d >= 5.5 ? 5.08 : 2.54,
    core: { r: d / 2 - 0.65, t },
  };
}

function mlccGeometry(farads: number): Geometry {
  const big = farads >= 1e-6;
  return {
    shape: {
      a: big ? 2.6 : 2.15,
      b: big ? 2.4 : 1.9,
      c: big ? 1.6 : 1.25,
      e1: 0.35,
      e2: 0.32,
      drip: 0.14,
      bottom: 0.12,
      taper: 0.06,
    },
    pitch: 5.08,
    core: { r: big ? 1.6 : 1.6, t: big ? 1.6 : 1.25 },
  };
}

function geometryOf(p: PartProps): Geometry {
  return p.variant === 'multicamada'
    ? mlccGeometry(Number(p.farads))
    : discGeometry(Number(p.farads), Number(p.voltage));
}

/** Voltage marking: `50V`, `500V`, `1KV`. */
function voltageMark(v: number): string {
  return v >= 1000 ? `${formatNumber(v / 1000)}KV`.replace(',', '.') : `${v}V`;
}

export const meta: PartMeta = {
  id: 'ceramic-capacitor',
  label: 'Capacitor cerâmico',
  category: 'passivos',
  summary:
    'Capacitor cerâmico de disco (laranja) e multicamada (azul), com o código em pF e, por dentro, o dielétrico de cerâmica entre as placas.',
  defaults: { farads: 1e-7, voltage: 50, variant: 'disco', leadLength: 16 },
  controls: {
    farads: { kind: 'number', label: 'Capacitância', min: 1e-12, max: 1e-5, log: true, unit: 'F' },
    voltage: {
      kind: 'select',
      label: 'Tensão máxima',
      options: [50, 100, 500, 1000, 2000].map((v) => ({
        value: v,
        label: `${formatNumber(v)} V`,
      })),
    },
    variant: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'disco', label: 'Disco' },
        { value: 'multicamada', label: 'Multicamada (monolítico)' },
      ],
    },
    leadLength: { kind: 'number', label: 'Terminais', min: 3, max: 25, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const g = geometryOf(p);
    const { shape: s } = g;
    const lift = Number(p.leadLength);
    const cy = lift - blobBottom(s);
    const code = capacitorCode(Number(p.farads));
    const notes: PartAnnotation[] = [
      {
        at: [s.a * 0.35, cy + s.b * 0.3, s.c] as Vec3,
        text: `Código ${code}: ${formatFarads(Number(p.farads))}`,
        exploded: false,
      },
      {
        at: [g.pitch / 2, lift * 0.45, 0] as Vec3,
        text: 'Terminais iguais: não tem polaridade',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Revestimento de epóxi', anchor: 'shell', exploded: true },
    ];
    if (p.variant === 'multicamada') {
      notes.push(
        {
          at: [0, 0, 0],
          text: 'Placas intercaladas, ligadas uma de cada lado',
          anchor: 'plates',
        },
        {
          at: [0, 0, 0],
          text: 'Cerâmica entre as placas (dielétrico)',
          anchor: 'ceramic',
          exploded: true,
        },
      );
    } else {
      notes.push(
        { at: [0, 0, 0], text: 'Disco de cerâmica: o dielétrico', anchor: 'ceramic' },
        {
          at: [0, 0, 0],
          text: 'Placa de prata em cada face',
          anchor: 'electrode',
          exploded: true,
        },
      );
    }
    return notes;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const kind = p.variant === 'multicamada' ? 'multicamada (monolítico)' : 'de disco';
    return `Capacitor cerâmico ${kind} de ${formatFarads(Number(p.farads))}, código ${capacitorCode(Number(p.farads))}, ${formatNumber(Number(p.voltage))} V. Não tem polaridade.`;
  },
  view: [0.55, 0.45, 1.6],
};

export default function CeramicCapacitor(props: CeramicCapacitorProps) {
  const p = { ...meta.defaults, ...props } as Required<CeramicCapacitorProps>;
  const mlcc = p.variant === 'multicamada';
  const g = geometryOf(p as PartProps);
  const s = g.shape;
  const lift = p.leadLength;
  const cy = -blobBottom(s); // body centre above the bottom of the coating
  const code = capacitorCode(p.farads);
  const pf = p.farads * 1e12;
  const tolerance = mlcc ? 'K' : pf < 1000 ? 'J' : 'Z';
  const volts = voltageMark(p.voltage);

  const bodyGeometry = useDisposable(() => blobGeometry(s), [s]);
  const frontGeometry = useDisposable(
    () => blobDecalGeometry(s, { uw: s.a * 1.7, uh: s.b * 1.7, side: 1, reach: 0.82 }),
    [s],
  );
  const backGeometry = useDisposable(
    () => blobDecalGeometry(s, { uw: s.a * 1.7, uh: s.b * 1.7, side: -1, reach: 0.82 }),
    [s],
  );

  const ink = '#16120f';
  const front = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = ink;
      const big = h * (mlcc ? 0.3 : 0.34);
      fitText(ctx, code, w / 2, h * 0.43, w * 0.62, big, { weight: 700, family: FONT_SANS });
      fitText(ctx, mlcc ? '' : tolerance, w / 2, h * 0.72, w * 0.3, big * 0.55, {
        weight: 700,
        family: FONT_SANS,
      });
    },
    `${code}|${tolerance}|${mlcc}`,
    { width: 256, height: 256, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const back = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = ink;
      fitText(ctx, mlcc ? `${tolerance}5U` : volts, w / 2, h * 0.45, w * 0.6, h * 0.24, {
        weight: 700,
        family: FONT_SANS,
      });
    },
    `${volts}|${mlcc}`,
    { width: 256, height: 256, fonts: [`700 40px ${FONT_SANS}`] },
  );

  const noise = getNoiseTexture();
  const bodyColor = mlcc ? '#2f62c8' : '#bf6328';
  const cutColor = mlcc ? '#1f3f80' : '#8a4a1d';
  const half = g.pitch / 2;

  return (
    <group position={[0, lift, 0]}>
      {/* Dipped epoxy coating with the printed code. */}
      <Explode offset={[0, s.b * 2.4 + 3, 0]}>
        <group position={[0, cy, 0]}>
          <mesh geometry={bodyGeometry}>
            <Material
              preset="epoxyOrange"
              clip
              color={bodyColor}
              roughnessMap={noise}
              roughness={0.42}
              clearcoat={0.55}
              clearcoatRoughness={0.35}
              cutColor={cutColor}
            />
          </mesh>
          {([front, back] as const).map((map, i) => (
            <mesh key={i} geometry={i === 0 ? frontGeometry : backGeometry}>
              <Material
                preset="epoxyBlack"
                clip
                color="#ffffff"
                map={map}
                transparent
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-2}
                roughness={0.5}
              />
            </mesh>
          ))}
          <Anchor name="shell" position={[s.a * 0.75, s.b * 0.6, s.c * 0.6]} />
        </group>
      </Explode>

      <group position={[0, cy, 0]}>
        {mlcc ? (
          <MultilayerChip g={g} lift={lift + cy} half={half} />
        ) : (
          <DiscCore g={g} lift={lift + cy} half={half} />
        )}
      </group>
    </group>
  );
}

/** Ceramic disc with a silver electrode fired on each face, one lead per face. */
function DiscCore({ g, lift, half }: { g: Geometry; lift: number; half: number }) {
  const { r, t } = g.core;
  const zFace = t / 2 + 0.02;
  const leadZ = zFace + 0.04 + LEAD / 2;
  const reach = r * 0.35;
  const leadPoints = (side: 1 | -1): Vec3[] => [
    [side * half, -lift, 0],
    [side * half, -r - 1.4, 0],
    [side * half * 0.55, -r * 0.75, side * leadZ],
    [side * half * 0.4, reach, side * leadZ],
  ];
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, t, 64]} />
        <Material preset="ceramicTan" color="#cbc3b0" roughness={0.75} />
      </mesh>
      <Anchor name="ceramic" position={[-r * 0.85, r * 0.3, 0]} />
      {([1, -1] as const).map((side) => (
        <Explode key={side} offset={[side * 2.4, 0, side * 3]}>
          <mesh position={[0, 0, side * (t / 2 + 0.02)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[r - 0.3, r - 0.3, 0.04, 64]} />
            <Material preset="aluminum" color="#d8d8d4" roughness={0.55} />
          </mesh>
          <Wire points={leadPoints(side)} radius={LEAD / 2} bend={0.8} />
          {/* Solder joint where the lead meets the electrode. */}
          <mesh position={[side * half * 0.42, reach * 0.4, side * leadZ]} scale={[1, 1.8, 0.6]}>
            <sphereGeometry args={[0.42, 16, 12]} />
            <Material preset="solder" />
          </mesh>
          {side === 1 && <Anchor name="electrode" position={[r * 0.45, -r * 0.3, zFace]} />}
        </Explode>
      ))}
    </>
  );
}

/** Multilayer chip: stacked silver plates in ceramic, joined at the two ends. */
function MultilayerChip({ g, lift, half }: { g: Geometry; lift: number; half: number }) {
  const { r: halfLength, t: width } = g.core;
  const L = halfLength * 2;
  const H = width * 1.1;
  const plates = 9;
  const term = 0.35;
  return (
    <>
      <Explode offset={[0, 0, -3]}>
        <mesh>
          <boxGeometry args={[L - term * 2, H, width]} />
          <Material preset="ceramicTan" clip color="#cfc4ad" roughness={0.75} cutColor="#b7ab92" />
        </mesh>
        <Anchor name="ceramic" position={[-L * 0.2, H / 2, -width / 2]} />
      </Explode>
      {Array.from({ length: plates }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const y = -H / 2 + (H * (i + 1)) / (plates + 1);
        return (
          <mesh key={i} position={[(side * term) / 2, y, 0]}>
            <boxGeometry args={[L - term * 2.4, 0.035, width * 0.8]} />
            <Material preset="nickel" color="#d6d3cc" roughness={0.4} />
          </mesh>
        );
      })}
      <Anchor name="plates" position={[0, H * 0.3, width * 0.4]} />
      {([1, -1] as const).map((side) => (
        <Explode key={side} offset={[side * 0.9, 0, 0]}>
          <mesh position={[side * (L / 2 - term / 2), 0, 0]}>
            <boxGeometry args={[term, H + 0.05, width + 0.05]} />
            <Material preset="tin" roughness={0.45} />
          </mesh>
          <Wire
            points={[
              [side * half, -lift, 0],
              [side * half, -H / 2 - 1.4, 0],
              [side * (L / 2 + LEAD / 2), -H / 2 - 0.2, 0],
              [side * (L / 2 + LEAD / 2), H * 0.3, 0],
            ]}
            radius={LEAD / 2}
            bend={0.6}
          />
        </Explode>
      ))}
    </>
  );
}
