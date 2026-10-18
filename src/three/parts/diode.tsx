/**
 * Axial diodes: rectifier DO-41 (1N4007), small-signal glass DO-35
 * (1N4148), power rectifier DO-201AD (1N5408) and glass zener DO-35 (printed
 * with its voltage, such as 5V1). Dimensions from the JEDEC outlines in
 * typical datasheets: DO-41 body 5,0 × 2,6 mm with 0,8 mm leads; DO-35 3,8 ×
 * 1,8 mm with 0,5 mm leads; DO-201AD 9,0 × 5,1 mm with 1,25 mm leads. The
 * cathode band sits on the +X end. Inside: the silicon die soldered between
 * the nail-head leads (epoxy) or between the two dumet plugs (glass).
 */
import { Color } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import {
  FONT_MONO,
  FONT_SANS,
  fitText,
  getNoiseTexture,
  useCanvasTexture,
} from '../materials/textures';
import { axialLathe, roundedCylinderProfile } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import { drawSoot, SiliconDie } from './_semi-parts';

type Variant = 'retificador' | 'sinal' | 'potencia' | 'zener';

export interface DiodeProps {
  variant?: Variant;
  /** Printed part number; empty = the usual one for the variant. */
  code?: string;
  /** Zener voltage (V), printed on zener diodes as 5V1, 12V… */
  zenerVoltage?: number;
  leads?: 'retos' | 'dobrados';
  burned?: boolean;
}

interface Body {
  length: number;
  diameter: number;
  lead: number;
  /** Lead spacing when bent for a board (mm). */
  pitch: number;
  glass: boolean;
  band: number;
  code: string;
  die: number;
  name: string;
}

const BODIES: Record<Variant, Body> = {
  retificador: {
    length: 5.0,
    diameter: 2.6,
    lead: 0.8,
    pitch: 10.16,
    glass: false,
    band: 0.9,
    code: '1N4007',
    die: 1.1,
    name: 'DO-41',
  },
  sinal: {
    length: 3.8,
    diameter: 1.8,
    lead: 0.5,
    pitch: 7.62,
    glass: true,
    band: 0.6,
    code: '1N4148',
    die: 0.45,
    name: 'DO-35',
  },
  potencia: {
    length: 9.0,
    diameter: 5.1,
    lead: 1.25,
    pitch: 15.24,
    glass: false,
    band: 1.4,
    code: '1N5408',
    die: 2.2,
    name: 'DO-201AD',
  },
  zener: {
    length: 3.8,
    diameter: 1.8,
    lead: 0.5,
    pitch: 7.62,
    glass: true,
    band: 0.6,
    code: '',
    die: 0.45,
    name: 'DO-35',
  },
};

const LEAD_LENGTH = 14;

export const meta: PartMeta = {
  id: 'diode',
  label: 'Diodo',
  category: 'semicondutores',
  summary:
    'Diodos axiais em tamanho real: retificador 1N4007, de sinal 1N4148 em vidro, de potência 1N5408 e zener, com a faixa do cátodo e o chip por dentro.',
  defaults: { variant: 'retificador', code: '', zenerVoltage: 5.1, leads: 'retos', burned: false },
  controls: {
    variant: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'retificador', label: 'Retificador (1N4007, DO-41)' },
        { value: 'sinal', label: 'Sinal (1N4148, vidro)' },
        { value: 'potencia', label: 'Potência (1N5408, DO-201AD)' },
        { value: 'zener', label: 'Zener (vidro)' },
      ],
    },
    code: { kind: 'text', label: 'Código impresso (vazio = o típico)', maxLength: 10 },
    zenerVoltage: {
      kind: 'number',
      label: 'Tensão zener',
      min: 2.4,
      max: 47,
      step: 0.1,
      unit: 'V',
    },
    leads: {
      kind: 'select',
      label: 'Terminais',
      options: [
        { value: 'retos', label: 'Retos' },
        { value: 'dobrados', label: 'Dobrados para a placa' },
      ],
    },
    burned: { kind: 'toggle', label: 'Queimado' },
  },
  annotations: (p) => {
    const b = bodyOf(p);
    const r = b.diameter / 2;
    const lift = p.leads === 'dobrados' ? 9 : r;
    const bandX = b.length / 2 - b.band / 2 - (b.glass ? 0.6 : 0.25);
    const list = [
      {
        at: [bandX, lift + r, 0] as Vec3,
        text: 'Faixa: cátodo (K), o terminal negativo',
        exploded: false,
      },
      {
        at: [
          p.leads === 'dobrados' ? -b.pitch / 2 : -b.length / 2 - 6,
          p.leads === 'dobrados' ? 3 : lift,
          0,
        ] as Vec3,
        text: 'Ânodo (A): o terminal positivo',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Chip de silício: a junção PN', anchor: 'die' },
      {
        at: [0, 0, 0] as Vec3,
        text: b.glass ? 'Corpo de vidro selado' : 'Corpo de epóxi moldado',
        anchor: 'shell',
        exploded: true,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: b.glass ? 'Pinos de dumet prensam o chip' : 'Cabeça do terminal soldada ao chip',
        anchor: 'head',
        exploded: true,
      },
    ];
    if (printedText(p)) {
      list.push({
        at: [-b.length * 0.15, lift + r * 0.8, r * 0.7] as Vec3,
        text: 'Código impresso no corpo',
        exploded: false,
      });
    }
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const b = bodyOf(p);
    const variant = String(p.variant) as Variant;
    const kind =
      variant === 'zener'
        ? `Diodo zener de ${formatNumber(Number(p.zenerVoltage), 2)} V`
        : variant === 'sinal'
          ? `Diodo de sinal ${codeOf(p)}`
          : variant === 'potencia'
            ? `Diodo retificador de potência ${codeOf(p)}`
            : `Diodo retificador ${codeOf(p)}`;
    const body = b.glass ? 'corpo de vidro' : 'corpo de epóxi preto';
    const band = b.glass ? 'faixa preta' : 'faixa cinza';
    return `${kind} (${b.name}), ${body}${p.burned ? ', queimado' : ''}. A ${band} marca o cátodo; a corrente passa do ânodo para o cátodo.`;
  },
  view: [0.45, 0.85, 1.5],
};

function variantOf(p: PartProps): Variant {
  const v = String(p.variant);
  return v === 'sinal' || v === 'potencia' || v === 'zener' ? v : 'retificador';
}

function bodyOf(p: PartProps): Body {
  return BODIES[variantOf(p)];
}

function codeOf(p: PartProps): string {
  const custom = String(p.code ?? '').trim();
  return custom || bodyOf(p).code;
}

/** Zener marking: 5.1 → "5V1", 12 → "12V". */
function zenerText(volts: number): string {
  const v = Math.round(volts * 10) / 10;
  const [int, dec] = v.toFixed(1).split('.');
  return dec === '0' ? `${int}V` : `${int}V${dec}`;
}

function printedText(p: PartProps): string {
  const variant = variantOf(p);
  const custom = String(p.code ?? '').trim();
  if (variant === 'zener') return custom || zenerText(Number(p.zenerVoltage));
  if (variant === 'sinal') return custom; // usually only the band
  return codeOf(p);
}

/**
 * Lathe along Y turned to lie along X, rotated so that U = 0,5 faces up and
 * to the front (where the text is printed) and V grows towards +X.
 */
function latheX(profile: [number, number][], segments = 48) {
  const g = axialLathe(profile, segments);
  g.rotateY((Math.PI * 3) / 4);
  g.rotateZ(-Math.PI / 2);
  return g;
}

export default function Diode(props: DiodeProps) {
  const p = { ...meta.defaults, ...props } as Required<DiodeProps>;
  const pp = p as unknown as PartProps;
  const b = bodyOf(pp);
  const text = printedText(pp);
  const L = b.length;
  const r = b.diameter / 2;
  const bent = p.leads === 'dobrados';
  const lift = bent ? 9 : r;
  const half = bent ? b.pitch / 2 : L / 2 + LEAD_LENGTH;
  // Glass: the band stays on the cylindrical part, clear of the fused ends.
  const bandEnd = b.glass ? L / 2 - 0.6 : L / 2 - 0.25;
  const bandStart = bandEnd - b.band;
  const sleeveStart = -L / 2 + 0.6;
  const sleeveEnd = bandStart - 0.12;

  // Body: moulded epoxy with domed ends, or glass with fused ends.
  const shellGeometry = useDisposable(() => {
    if (!b.glass) return latheX(roundedCylinderProfile(r, -L / 2, L / 2, r * 0.38, 8), 56);
    const profile: [number, number][] = [[0, -L / 2]];
    const neck = b.lead / 2 + 0.06;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = -L / 2 + t * 0.55;
      profile.push([neck + (r - neck) * Math.sin((t * Math.PI) / 2), y]);
    }
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = L / 2 - 0.55 + t * 0.55;
      profile.push([neck + (r - neck) * Math.cos((t * Math.PI) / 2), y]);
    }
    profile.push([0, L / 2]);
    return latheX(profile, 48);
  }, [L, r, b.glass, b.lead]);

  // Glass diodes: painted band and printed text are thin sleeves over the glass.
  const bandGeometry = useDisposable(
    () =>
      latheX(
        [
          [0, bandStart],
          [r + 0.012, bandStart],
          [r + 0.025, bandStart + 0.05],
          [r + 0.025, bandEnd - 0.05],
          [r + 0.012, bandEnd],
          [0, bandEnd],
        ],
        48,
      ),
    [r, bandStart, bandEnd],
  );
  const sleeveGeometry = useDisposable(
    () =>
      latheX(
        [
          [r + 0.008, sleeveStart],
          [r + 0.008, sleeveEnd],
        ],
        48,
      ),
    [r, sleeveStart, sleeveEnd],
  );

  // Painted epoxy: band and text along the axis (see latheX for the layout).
  const circumference = Math.PI * b.diameter;
  const pxPerMm = 1024 / circumference;
  const canvasH = Math.min(Math.round(L * pxPerMm), 2048);
  const bodyMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = p.burned ? '#151312' : '#1d1d1f';
      ctx.fillRect(0, 0, w, h);
      if (!b.glass) {
        // Cathode band (V grows towards +X; the canvas top is V = 1).
        const v0 = (bandStart + L / 2) / L;
        const v1 = (bandEnd + L / 2) / L;
        ctx.fillStyle = p.burned ? '#4c4640' : '#b9bbbd';
        ctx.fillRect(0, (1 - v1) * h, w, (v1 - v0) * h);
        if (text) {
          ctx.save();
          ctx.translate(w / 2, (1 - (-L / 2 + bandStart) / 2 / L - 0.5) * h);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = p.burned ? '#4a4440' : '#a9acaf';
          const room = (bandStart + L / 2 - r * 0.7) * pxPerMm;
          fitText(ctx, text, 0, 0, room, b.diameter * 0.26 * pxPerMm, {
            weight: 600,
            family: FONT_SANS,
          });
          ctx.restore();
        }
        if (p.burned) drawSoot(ctx, w, h, 5);
      }
    },
    `${b.name}|${text}|${p.burned}|${bandStart}`,
    { width: 1024, height: canvasH, fonts: [`600 40px ${FONT_SANS}`] },
  );
  const sleevePx = 512 / (2 * Math.PI * (r + 0.008));
  const sleeveMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (!text) return;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#121212';
      fitText(ctx, text, 0, 0, h * 0.94, 0.62 * sleevePx, { weight: 700, family: FONT_MONO });
      ctx.restore();
    },
    `${text}|${b.name}`,
    {
      width: 512,
      height: Math.max(Math.round((sleeveEnd - sleeveStart) * sleevePx), 16),
      fonts: [`700 40px ${FONT_MONO}`],
    },
  );
  const noise = getNoiseTexture();

  // Internals: nail heads (epoxy) or dumet plugs (glass) clamping the die.
  const dieT = b.glass ? 0.14 : b.die * 0.25;
  const plugR = b.glass ? r * 0.66 : b.die * 0.78;
  const plugInner = dieT / 2 + 0.03;
  const plugOuter = b.glass ? L / 2 - 0.4 : plugInner + Math.max(0.25, b.lead * 0.4);
  const leadR = b.lead / 2;
  const leadPoints = (side: 1 | -1): Vec3[] =>
    bent
      ? [
          [side * plugOuter, 0, 0],
          [side * half, 0, 0],
          [side * half, -lift, 0],
        ]
      : [
          [side * plugOuter, 0, 0],
          [side * half, 0, 0],
        ];

  const glassTint = p.burned ? '#4a2c1a' : p.variant === 'zener' ? '#ff9d5c' : '#ff7a2a';
  const plugColor = p.burned ? '#3a2a22' : '#c08060';

  return (
    <group position={[0, lift, 0]}>
      <Explode offset={[0, b.diameter * 2.4 + 1.5, 0]}>
        {b.glass ? (
          <>
            <mesh geometry={shellGeometry}>
              <Material
                preset="glass"
                clip
                color={p.burned ? '#8a7060' : '#fff3e8'}
                transmission={p.burned ? 0.55 : 1}
                roughness={p.burned ? 0.25 : 0.04}
                thickness={b.diameter}
                attenuationColor={new Color(glassTint)}
                attenuationDistance={p.burned ? 0.6 : 3.5}
                cutColor={p.burned ? '#4a3020' : '#e8a070'}
              />
            </mesh>
            <mesh geometry={bandGeometry}>
              <Material preset="epoxyBlack" color="#111112" roughness={0.45} clip />
            </mesh>
            {text && (
              <mesh geometry={sleeveGeometry}>
                <Material
                  color="#ffffff"
                  map={sleeveMap}
                  transparent
                  alphaTest={0.3}
                  roughness={0.75}
                  depthWrite={false}
                  clip
                />
              </mesh>
            )}
          </>
        ) : (
          <mesh geometry={shellGeometry}>
            <Material
              preset="epoxyBlack"
              clip
              color="#ffffff"
              map={bodyMap}
              roughness={p.burned ? 0.85 : 0.5}
              roughnessMap={noise}
              cutColor="#2a2a2c"
            />
          </mesh>
        )}
        <Anchor name="shell" position={[-L * 0.25, r, 0]} />
      </Explode>

      {/* Die between the two contacts. */}
      <SiliconDie
        size={[b.die, b.die]}
        thickness={dieT}
        kind="diode"
        seed={3}
        position={[-dieT / 2, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        burned={p.burned}
      />
      <Anchor name="die" position={[0, b.die / 2, 0]} />
      {!b.glass && (
        // Glass passivation ring around the die edge (glass-passivated rectifiers).
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[b.die * 0.62, b.die * 0.62, dieT * 0.9, 24, 1, true]} />
          <Material color="#8fa59a" roughness={0.2} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}

      {/* Contacts and leads move apart in the exploded view. */}
      {([-1, 1] as const).map((side) => (
        <Explode key={side} offset={[side * Math.max(L * 0.5, 3), 0, 0]}>
          <mesh
            position={[(side * (plugInner + plugOuter)) / 2, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[plugR, plugR, plugOuter - plugInner, 32]} />
            {b.glass ? (
              <Material preset="copper" color={plugColor} roughness={0.28} />
            ) : (
              <Material preset="copper" color={p.burned ? '#4a3a30' : '#d29a78'} roughness={0.35} />
            )}
          </mesh>
          {/* Solder between contact and die. */}
          <mesh position={[side * (plugInner - 0.015), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry
              args={[Math.min(plugR, b.die * 0.6), Math.min(plugR, b.die * 0.6), 0.03, 24]}
            />
            <Material preset="solder" roughness={0.4} />
          </mesh>
          <Wire points={leadPoints(side)} radius={leadR} bend={1.2} />
          {side === -1 && (
            <Anchor name="head" position={[-(plugInner + plugOuter) / 2, -plugR, 0]} />
          )}
        </Explode>
      ))}
    </group>
  );
}
