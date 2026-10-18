/**
 * Cylindrical cells AA, AAA, C and D (IEC 60086-2: R6 Ø 14,5 × 50,5 mm,
 * R03 Ø 10,5 × 44,5 mm, R14 Ø 26,2 × 50 mm, R20 Ø 34,2 × 61,5 mm), alkaline
 * (1,5 V) or nickel-metal hydride rechargeable (1,2 V). Steel can with the
 * positive nub, flat negative cap with its insulating ring, printed sleeve
 * with a generic label. Cutaway: MnO₂ cathode, separator, zinc gel anode and
 * the brass collector nail (alkaline) or the wound electrodes (NiMH).
 */
import { IcosahedronGeometry } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps } from '../types';
import { CutDecal, lathe, merge, seeded, shellProfile } from './_power-shared';

type Size = 'AA' | 'AAA' | 'C' | 'D';
type Chemistry = 'alcalina' | 'recarregavel';

export interface BatteryAaProps {
  size?: Size;
  type?: Chemistry;
  /** State of charge, 0..1 (not visible from outside: only a meter tells). */
  charge?: number;
  /** Leaked electrolyte: white potassium carbonate crust at the positive end. */
  leaking?: boolean;
}

/** Diameter, length, nub diameter and height (mm), IEC names and Brazilian nickname. */
const SIZES: Record<
  Size,
  {
    d: number;
    l: number;
    nub: number;
    nubH: number;
    iec: string;
    nimh: string;
    nick: string;
    mah: number;
  }
> = {
  AAA: {
    d: 10.5,
    l: 44.5,
    nub: 3.8,
    nubH: 0.8,
    iec: 'LR03',
    nimh: 'HR03',
    nick: 'palito',
    mah: 800,
  },
  AA: {
    d: 14.5,
    l: 50.5,
    nub: 5.5,
    nubH: 1.0,
    iec: 'LR6',
    nimh: 'HR6',
    nick: 'pequena',
    mah: 2000,
  },
  C: { d: 26.2, l: 50.0, nub: 7.5, nubH: 1.5, iec: 'LR14', nimh: 'HR14', nick: 'média', mah: 3500 },
  D: {
    d: 34.2,
    l: 61.5,
    nub: 9.5,
    nubH: 1.5,
    iec: 'LR20',
    nimh: 'HR20',
    nick: 'grande',
    mah: 8000,
  },
};

const LABEL = {
  alcalina: {
    base: '#173d86',
    dark: '#0d2457',
    band: '#c9ced6',
    text: '#ffffff',
    accent: '#f2c230',
  },
  recarregavel: {
    base: '#16794a',
    dark: '#0b4a2c',
    band: '#c9ced6',
    text: '#ffffff',
    accent: '#bff07a',
  },
} as const;

export const meta: PartMeta = {
  id: 'battery-aa',
  label: 'Pilha',
  category: 'energia',
  summary:
    'Pilhas AA, AAA, C e D, alcalinas ou recarregáveis, com o polo positivo saliente, o negativo plano e o interior em corte.',
  defaults: { size: 'AA', type: 'alcalina', charge: 1, leaking: false },
  controls: {
    size: {
      kind: 'select',
      label: 'Tamanho',
      options: [
        { value: 'AA', label: 'AA (pequena)' },
        { value: 'AAA', label: 'AAA (palito)' },
        { value: 'C', label: 'C (média)' },
        { value: 'D', label: 'D (grande)' },
      ],
    },
    type: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'alcalina', label: 'Alcalina 1,5 V' },
        { value: 'recarregavel', label: 'Recarregável NiMH 1,2 V' },
      ],
    },
    charge: { kind: 'number', label: 'Carga', min: 0, max: 1, step: 0.05 },
    leaking: { kind: 'toggle', label: 'Vazando' },
  },
  annotations: (p) => {
    const s = SIZES[sizeOf(p)];
    const r = s.d / 2;
    const nimh = p.type === 'recarregavel';
    const list: PartAnnotation[] = [
      {
        at: [s.l / 2 + 0.3, r, 0],
        text: 'Polo positivo (+): o ressalto',
        exploded: false,
      },
      {
        at: [-s.l / 2 - 0.2, r * 0.6, 0],
        text: 'Polo negativo (−): a base plana',
        exploded: false,
      },
      {
        at: [-s.l / 2 + 0.3, r * 1.75, 0],
        text: 'Anel isolante separa os polos',
        exploded: false,
      },
      {
        at: [0, 0, 0],
        text: 'Rótulo plástico: isola a lata',
        anchor: 'label',
        exploded: true,
      },
    ];
    if (nimh) {
      list.push({
        at: [0, 0, 0],
        text: 'Eletrodos enrolados em espiral com separador',
        anchor: 'core',
      });
    } else {
      list.push(
        { at: [0, 0, 0], text: 'Cátodo: dióxido de manganês e grafite', anchor: 'cathode' },
        { at: [0, 0, 0], text: 'Ânodo: zinco em gel com hidróxido de potássio', anchor: 'anode' },
        { at: [0, 0, 0], text: 'Prego de latão coleta a corrente do zinco', anchor: 'nail' },
      );
    }
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const s = SIZES[sizeOf(p)];
    const nimh = p.type === 'recarregavel';
    const charge = Math.round(Math.min(Math.max(Number(p.charge), 0), 1) * 100);
    const kind = nimh
      ? `Pilha recarregável ${sizeOf(p)} (${s.nick}) de níquel-metal-hidreto, 1,2 V, ${formatNumber(s.mah, 4)} mAh`
      : `Pilha alcalina ${sizeOf(p)} (${s.nick}), 1,5 V`;
    const leak = p.leaking
      ? ' Está vazando: a crosta branca é corrosiva, não toque sem luvas.'
      : '';
    return `${kind}, Ø ${formatNumber(s.d)} × ${formatNumber(s.l)} mm, com ${charge} % de carga (por fora não dá para ver: só medindo a tensão).${leak}`;
  },
  view: [0.45, 0.6, 1.5],
};

function sizeOf(p: PartProps): Size {
  const s = String(p.size);
  return s === 'AAA' || s === 'C' || s === 'D' ? s : 'AA';
}

export default function BatteryAa(props: BatteryAaProps) {
  const p = { ...meta.defaults, ...props } as Required<BatteryAaProps>;
  const size = sizeOf(p as unknown as PartProps);
  const s = SIZES[size];
  const nimh = p.type === 'recarregavel';
  const colors = LABEL[nimh ? 'recarregavel' : 'alcalina'];
  const R = s.d / 2;
  const L = s.l;
  const top = L - s.nubH; // shoulder of the positive end
  const inner = { bottom: 2.6, top: top - 0.7, r: R - 0.32 };

  const can = useDisposable(() => {
    const nr = s.nub / 2;
    const outer: [number, number][] = [
      [R - 0.75, 0.55],
      [R - 0.32, 0.35],
      [R - 0.06, 0.75],
      [R - 0.06, top - 0.9],
      [R - 0.3, top - 0.25],
      [R - 0.8, top],
      [nr + 0.7, top],
      [nr + 0.25, top + 0.12],
      [nr, top + 0.4],
      [nr - 0.05, L - 0.3],
      [nr - 0.4, L - 0.02],
      [nr - 0.9, L],
      [0, L],
    ];
    return lathe(shellProfile(outer, 0.25), 56, { angle: 40, seam: Math.PI });
  }, [R, L, top, s.nub]);

  const sleeve = useDisposable(() => {
    const outer: [number, number][] = [
      [R - 1.55, 0.02],
      [R - 0.55, 0.02],
      [R - 0.12, 0.25],
      [R + 0.06, 0.75],
      [R + 0.06, top - 0.9],
      [R - 0.12, top - 0.35],
      [R - 0.6, top + 0.06],
      [R - 1.25, top + 0.06],
    ];
    return lathe(shellProfile(outer, 0.1), 64, { angle: 50, seam: Math.PI });
  }, [R, top]);

  const negativeCap = useDisposable(
    () =>
      lathe(
        [
          [0, 0.18],
          [R * 0.25, 0.18],
          [R * 0.3, 0.02],
          [R - 2.0, 0.0],
          [R - 1.75, 0.2],
          [R - 1.75, 0.55],
          [0, 0.55],
        ],
        48,
        { angle: 40 },
      ),
    [R],
  );
  const ring = useDisposable(
    () =>
      lathe(
        [
          [R - 1.8, 0.1],
          [R - 0.7, 0.1],
          [R - 0.55, 0.35],
          [R - 0.6, 0.6],
          [R - 1.8, 0.6],
        ],
        48,
        { angle: 40 },
      ),
    [R],
  );
  const seal = useDisposable(
    () =>
      lathe(
        [
          [0.9, 0.6],
          [R - 0.45, 0.6],
          [R - 0.45, 1.5],
          [R - 1.4, 2.1],
          [R * 0.3, 2.1],
          [R * 0.18, 2.55],
          [0.9, 2.55],
        ],
        48,
        { angle: 40 },
      ),
    [R],
  );
  const nailR = Math.max(0.45, R * 0.075);
  const nail = useDisposable(
    () =>
      lathe(
        [
          [0, 0.5],
          [nailR * 2.2, 0.5],
          [nailR * 2.2, 0.75],
          [nailR, 0.9],
          [nailR, L * 0.74],
          [nailR * 0.6, L * 0.74 + nailR * 2],
          [0, L * 0.74 + nailR * 2.6],
        ],
        20,
        { angle: 40 },
      ),
    [L, nailR],
  );
  const contents = useDisposable(
    () =>
      lathe(
        [
          [0, inner.bottom],
          [inner.r, inner.bottom],
          [inner.r, inner.top],
          [0, inner.top],
        ],
        48,
      ),
    [inner.bottom, inner.top, inner.r],
  );

  const labelMaps = useLabelMaps(size, nimh, colors);
  const section = useSectionMap(nimh, R, inner.top - inner.bottom);
  const endFace = useEndFaceMap(nimh);

  const crust = useDisposable(() => {
    // Clusters of potassium carbonate crystals where the seal let electrolyte creep out.
    const random = seeded(31);
    const blobs = [];
    const nr = s.nub / 2;
    const k = Math.min(1.8, R / 7);
    const gauss = () => (random() + random() + random() - 1.5) / 1.5;
    const clusters: { a: number; r: number; y: number; n: number; spread: number }[] = [];
    for (let i = 0; i < 6; i++) {
      clusters.push({
        a: random() * Math.PI * 2,
        r: R - 0.5,
        y: top - 0.1,
        n: 16,
        spread: 1.1 * k,
      });
    }
    for (let i = 0; i < 3; i++) {
      clusters.push({
        a: random() * Math.PI * 2,
        r: nr + 0.4,
        y: top + 0.15,
        n: 10,
        spread: 0.7 * k,
      });
    }
    // A drip down the side.
    clusters.push({ a: Math.PI * 0.62, r: R + 0.05, y: top - 2.2 * k, n: 14, spread: 1.2 * k });
    for (const c of clusters) {
      for (let i = 0; i < c.n; i++) {
        const a = c.a + (gauss() * c.spread) / Math.max(c.r, 1);
        const y = c.y + gauss() * c.spread * (c.r > R ? 1.4 : 0.35);
        const r =
          c.r > R ? R + 0.02 : Math.min(R - 0.1, Math.max(nr, c.r + gauss() * c.spread * 0.6));
        const size = (0.16 + random() * 0.32) * k;
        const g = new IcosahedronGeometry(size, 1);
        g.scale(1 + random() * 0.7, 0.6 + random() * 0.6, 1 + random() * 0.7);
        g.rotateY(random() * Math.PI);
        g.translate(Math.sin(a) * r, y + size * 0.4, Math.cos(a) * r);
        blobs.push(g);
      }
    }
    return merge(blobs);
  }, [R, top, s.nub]);

  return (
    // Lathe space: axis along +Y from the negative end; turned to lie along X.
    <group position={[-L / 2, R, 0]} rotation={[0, 0, -Math.PI / 2]}>
      {/* Steel can: the positive terminal. */}
      <mesh geometry={can}>
        <Material preset="nickel" color="#d4d3cf" roughness={0.22} clip cutColor="#8f9194" />
      </mesh>

      {/* Contents (seen at the open end in the exploded view, and in the cut). */}
      <mesh geometry={contents}>
        <Material color="#1c1c1e" roughness={0.9} clip cutColor="#1c1c1e" />
      </mesh>
      <mesh position={[0, inner.bottom - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[inner.r, 48]} />
        <Material color="#ffffff" map={endFace} roughness={0.8} />
      </mesh>
      <CutDecal
        width={inner.r * 2}
        height={inner.top - inner.bottom}
        position={[0, (inner.top + inner.bottom) / 2, 0.02]}
        map={section}
        roughness={0.75}
      />
      {nimh ? (
        <Anchor name="core" position={[R * 0.5, L * 0.45, 0.1]} />
      ) : (
        <>
          <Anchor name="cathode" position={[-R * 0.72, L * 0.62, 0.1]} />
          <Anchor name="anode" position={[R * 0.25, L * 0.35, 0.1]} />
        </>
      )}

      {/* Printed sleeve. */}
      <Explode offset={[-R * 2.6, 0, 0]}>
        <mesh geometry={sleeve}>
          <Material
            preset="pvc"
            color="#ffffff"
            map={labelMaps.color}
            metalnessMap={labelMaps.metal}
            metalness={1}
            roughness={0.28}
            clearcoat={0.8}
            clearcoatRoughness={0.15}
            clip
            cutColor={colors.dark}
          />
        </mesh>
        <Anchor name="label" position={[-R, L * 0.3, 0]} />
      </Explode>

      {/* Negative end: cap, insulating ring, seal and the brass nail. */}
      <Explode offset={[0, -L * 0.5, 0]}>
        <mesh geometry={negativeCap}>
          <Material preset="nickel" color="#d4d3cf" roughness={0.25} clip cutColor="#8f9194" />
        </mesh>
        <mesh geometry={ring}>
          <Material color="#1d1d20" roughness={0.45} clip cutColor="#2a2a2e" />
        </mesh>
        <mesh geometry={seal}>
          <Material
            preset="nylonNatural"
            color={nimh ? '#3a3a3c' : '#f1ece0'}
            clip
            cutColor={nimh ? '#2a2a2c' : '#e2dccd'}
          />
        </mesh>
        {!nimh && (
          <>
            <mesh geometry={nail}>
              <Material preset="brass" roughness={0.3} />
            </mesh>
            <Anchor name="nail" position={[0, L * 0.5, nailR]} />
          </>
        )}
      </Explode>

      {p.leaking && (
        <mesh geometry={crust}>
          <Material color="#f1eee5" roughness={0.95} sheen={0.6} sheenColor="#ffffff" />
        </mesh>
      )}
    </group>
  );
}

/** Sleeve print: colour (sRGB) and metalness (silver band). Text runs along the cell. */
function useLabelMaps(size: Size, nimh: boolean, colors: (typeof LABEL)[keyof typeof LABEL]) {
  const s = SIZES[size];
  const key = `${size}|${nimh}`;
  const voltage = nimh ? '1,2V' : '1,5V';
  // U runs around the cell (0,25 = up, 0,5 = towards the viewer), V along the axis (+ at V = 1).
  const color = useCanvasTexture(
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, colors.dark);
      g.addColorStop(0.3, colors.base);
      g.addColorStop(0.55, colors.base);
      g.addColorStop(1, colors.dark);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Silver band at the positive end.
      ctx.fillStyle = colors.band;
      ctx.fillRect(0, 0, w, h * 0.17);
      ctx.fillStyle = colors.accent;
      ctx.fillRect(0, h * 0.17, w, h * 0.012);
      // Text along the axis (rotate: reading from the − end towards the + end).
      const along = (u: number, v: number, draw: () => void) => {
        ctx.save();
        ctx.translate(u * w, (1 - v) * h);
        ctx.rotate(-Math.PI / 2);
        draw();
        ctx.restore();
      };
      const font = (weight: number, px: number) => `${weight} ${px}px ${FONT_SANS}`;
      ctx.fillStyle = colors.text;
      ctx.textBaseline = 'middle';
      along(0.42, 0.42, () => {
        ctx.textAlign = 'center';
        ctx.font = font(800, w * 0.13);
        ctx.fillText(size, 0, 0);
      });
      along(0.53, 0.42, () => {
        ctx.textAlign = 'center';
        ctx.font = font(700, w * 0.05);
        ctx.fillText(voltage, 0, 0);
      });
      along(0.33, 0.42, () => {
        fitText(ctx, nimh ? 'RECARREGÁVEL' : 'ALCALINA', 0, 0, h * 0.6, w * 0.045, {
          weight: 700,
        });
      });
      along(0.61, 0.42, () => {
        fitText(
          ctx,
          nimh ? `Ni-MH ${formatNumber(s.mah, 4)}mAh  ${s.nimh}` : `${s.iec}  ${voltage}`,
          0,
          0,
          h * 0.6,
          w * 0.03,
          { weight: 500 },
        );
      });
      along(0.86, 0.45, () => {
        fitText(
          ctx,
          nimh
            ? 'Recarregue só em carregador de NiMH. Não jogue no lixo comum.'
            : 'Não recarregue. Não jogue no fogo. Descarte em ponto de coleta.',
          0,
          0,
          h * 0.66,
          w * 0.022,
          { weight: 500 },
        );
      });
      // Polarity marks.
      ctx.fillStyle = colors.dark;
      along(0.47, 0.915, () => {
        ctx.textAlign = 'center';
        ctx.font = font(800, w * 0.09);
        ctx.fillText('+', 0, 0);
      });
      ctx.fillStyle = colors.text;
      along(0.47, 0.06, () => {
        ctx.textAlign = 'center';
        ctx.font = font(800, w * 0.08);
        ctx.fillText('−', 0, 0);
      });
    },
    `label|${key}`,
    { width: 1024, height: 1024, fonts: [`800 40px ${FONT_SANS}`, `500 40px ${FONT_SANS}`] },
  );
  const metal = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(0, 0, w, h * 0.17);
    },
    `labelmetal|${key}`,
    { width: 64, height: 256, color: false },
  );
  return { color, metal };
}

/** Lengthwise section of the cell contents (the cut face). */
function useSectionMap(nimh: boolean, R: number, height: number) {
  return useCanvasTexture(
    (ctx, w, h) => {
      const random = seeded(5);
      const speckle = (
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        base: number,
        spread: number,
      ) => {
        for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 18; i++) {
          const v = Math.round(base + (random() - 0.5) * spread);
          ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
          ctx.fillRect(x0 + random() * (x1 - x0), y0 + random() * (y1 - y0), 2, 2);
        }
      };
      if (nimh) {
        // Wound electrodes: nickel hydroxide (dark), separator (white), metal hydride (grey).
        ctx.fillStyle = '#1f2722';
        ctx.fillRect(0, 0, w, h);
        const layer = w / (R * 2) / 3.2; // ~0,31 mm per layer
        const centre = w / 2;
        const hole = w * 0.06;
        for (let x = hole; x < centre; x += layer * 4) {
          for (const sign of [-1, 1]) {
            const px = centre + sign * x;
            ctx.fillStyle = '#e9e6dc';
            ctx.fillRect(px - layer * 0.25, h * 0.04, layer * 0.5, h * 0.92);
            ctx.fillStyle = '#7a7d80';
            ctx.fillRect(px + sign * layer * 0.6 - layer * 0.5, h * 0.04, layer, h * 0.92);
            ctx.fillStyle = '#e9e6dc';
            ctx.fillRect(px + sign * layer * 1.9 - layer * 0.25, h * 0.04, layer * 0.5, h * 0.92);
          }
        }
        ctx.fillStyle = '#0d0d0e';
        ctx.fillRect(centre - hole, 0, hole * 2, h);
        // Collector tabs top and bottom.
        ctx.fillStyle = '#b9bbbd';
        ctx.fillRect(0, 0, w, h * 0.035);
        ctx.fillRect(0, h * 0.965, w, h * 0.035);
        return;
      }
      // Alkaline: MnO₂ + graphite cathode rings, separator, zinc gel, air space.
      ctx.fillStyle = '#26262a';
      ctx.fillRect(0, 0, w, h);
      speckle(0, w, 0, h, 46, 34);
      // Cathode rings are pressed as pellets: faint joints.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let i = 1; i < 4; i++) ctx.fillRect(0, (h * i) / 4, w, 2);
      const anode = w * 0.3;
      const sepW = Math.max(3, w * 0.02);
      const anodeTop = h * 0.1;
      ctx.fillStyle = '#ece6d6';
      ctx.fillRect(w / 2 - anode - sepW, anodeTop - sepW, (anode + sepW) * 2, h - anodeTop + sepW);
      ctx.fillStyle = '#8c8f94';
      ctx.fillRect(w / 2 - anode, anodeTop, anode * 2, h - anodeTop);
      speckle(w / 2 - anode, w / 2 + anode, anodeTop, h, 150, 70);
      // Air space above the gel.
      ctx.fillStyle = '#3a3a3e';
      ctx.fillRect(w / 2 - anode, anodeTop, anode * 2, h * 0.04);
    },
    `section|${nimh}|${R.toFixed(1)}|${height.toFixed(1)}`,
    { width: 256, height: 512 },
  );
}

/** End face of the contents, seen when the negative end is pulled out. */
function useEndFaceMap(nimh: boolean) {
  return useCanvasTexture(
    (ctx, w, h) => {
      const c = w / 2;
      ctx.fillStyle = nimh ? '#1f2722' : '#2a2a2e';
      ctx.fillRect(0, 0, w, h);
      if (nimh) {
        ctx.lineWidth = 3;
        for (const [color, offset] of [
          ['#e9e6dc', 0],
          ['#7a7d80', 0.33],
          ['#e9e6dc', 0.66],
        ] as const) {
          ctx.strokeStyle = color;
          ctx.beginPath();
          for (let t = 0; t <= 1; t += 0.002) {
            const a = (t * 9 + offset) * Math.PI * 2;
            const r = c * (0.1 + 0.88 * t);
            const x = c + Math.cos(a) * r;
            const y = c + Math.sin(a) * r;
            if (t === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        return;
      }
      ctx.fillStyle = '#ece6d6';
      ctx.beginPath();
      ctx.arc(c, c, c * 0.64, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8c8f94';
      ctx.beginPath();
      ctx.arc(c, c, c * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b08d3c';
      ctx.beginPath();
      ctx.arc(c, c, c * 0.08, 0, Math.PI * 2);
      ctx.fill();
    },
    `endface|${nimh}`,
    { width: 256, height: 256 },
  );
}
