/**
 * Radial aluminium electrolytic capacitor (5 × 11 mm to 22 × 40 mm), with
 * the printed PET sleeve (value, voltage, 105 °C, minus stripe over the
 * negative lead), the scored vent on the top, the rubber bung and the wound
 * element inside (anode foil, paper with electrolyte, cathode foil).
 * Can sizes and lead pitches follow the usual general-purpose 105 °C series
 * tables (e.g. Nichicon PW/VZ, Panasonic FC, Rubycon YXF datasheets).
 * `bulged` shows the classic failure: domed top, split vent, dried electrolyte.
 */
import { Color } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta } from '../types';
import {
  arc,
  domedDiscGeometry,
  drawWoundSection,
  ExplodeReveal,
  peelPath,
  ribbonGeometry,
  SectionFace,
  seeded,
  thicken,
  type Path2,
} from './_passive-common';

export type SleeveColor = 'preto' | 'azul';

export interface ElectrolyticCapacitorProps {
  /** Capacitance in farads (1e-4 = 100 µF). */
  farads?: number;
  /** Rated voltage (V). */
  voltage?: number;
  sleeve?: SleeveColor;
  /** Failed capacitor: domed top, split vent, dried electrolyte. */
  bulged?: boolean;
  /** Length of the negative lead below the body (mm); the positive one is 4 mm longer. */
  leadLength?: number;
}

interface CanSize {
  D: number;
  L: number;
  lead: number;
  pitch: number;
}

/** Can size by the CV product (µF × V), corrected for high-voltage series. */
const SIZES: (CanSize & { cv: number })[] = [
  { cv: 800, D: 5, L: 11, lead: 0.5, pitch: 2 },
  { cv: 1700, D: 6.3, L: 11, lead: 0.5, pitch: 2.5 },
  { cv: 3600, D: 8, L: 12, lead: 0.6, pitch: 3.5 },
  { cv: 8500, D: 10, L: 16, lead: 0.6, pitch: 5 },
  { cv: 26000, D: 10, L: 20, lead: 0.6, pitch: 5 },
  { cv: 38000, D: 12.5, L: 25, lead: 0.6, pitch: 5 },
  { cv: 62000, D: 16, L: 25, lead: 0.8, pitch: 7.5 },
  { cv: 130000, D: 18, L: 35, lead: 0.8, pitch: 7.5 },
  { cv: Infinity, D: 22, L: 40, lead: 0.8, pitch: 10 },
];

export function electrolyticSize(farads: number, voltage: number): CanSize {
  const uf = farads * 1e6;
  const hv = voltage > 100 ? 1 + (voltage - 100) / 150 : 1;
  const cv = uf * voltage * hv;
  return SIZES.find((s) => cv <= s.cv) ?? SIZES[SIZES.length - 1]!;
}

const LEAD_EXTRA = 4;

const SLEEVES: Record<
  SleeveColor,
  { body: string; text: string; stripe: string; mark: string; metallic: boolean }
> = {
  preto: { body: '#17171a', text: '#d8b56a', stripe: '#c8c8c2', mark: '#1b1b1e', metallic: true },
  azul: { body: '#1f4fa8', text: '#f2f4f8', stripe: '#dfe7f4', mark: '#1f4fa8', metallic: false },
};

/** `1000µF`, `4,7µF`, `0,47µF` as printed on sleeves (no thousands separator). */
export function microfaradsLabel(farads: number): string {
  const uf = Number((farads * 1e6).toPrecision(3));
  return `${String(uf).replace('.', ',')}µF`;
}

/** `1.000 µF` for text read by the student. */
export function microfaradsText(farads: number): string {
  return `${formatNumber(farads * 1e6)} µF`;
}

const voltageLabel = (v: number) => `${String(v).replace('.', ',')}V`;

export const meta: PartMeta = {
  id: 'electrolytic-capacitor',
  label: 'Capacitor eletrolítico',
  category: 'passivos',
  summary:
    'Capacitor eletrolítico radial com capa impressa, respiro no topo e as folhas enroladas por dentro; também na versão estufada.',
  defaults: {
    farads: 0.001,
    voltage: 25,
    sleeve: 'preto',
    bulged: false,
    leadLength: 15,
  },
  controls: {
    farads: { kind: 'number', label: 'Capacitância', min: 1e-7, max: 0.01, log: true, unit: 'F' },
    voltage: {
      kind: 'select',
      label: 'Tensão máxima',
      options: [6.3, 10, 16, 25, 35, 50, 63, 100, 160, 250, 400, 450].map((v) => ({
        value: v,
        label: `${formatNumber(v)} V`,
      })),
    },
    sleeve: {
      kind: 'select',
      label: 'Cor da capa',
      options: [
        { value: 'preto', label: 'Preta (letras douradas)' },
        { value: 'azul', label: 'Azul (letras brancas)' },
      ],
    },
    bulged: { kind: 'toggle', label: 'Estufado (com defeito)' },
    leadLength: { kind: 'number', label: 'Terminais', min: 3, max: 30, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const s = electrolyticSize(Number(p.farads), Number(p.voltage));
    const lift = Number(p.leadLength) + LEAD_EXTRA;
    const R = s.D / 2;
    return [
      {
        at: [-R * 0.98, lift + s.L * 0.62, R * 0.15],
        text: 'Faixa com sinais de menos: lado do terminal negativo',
        exploded: false,
      },
      {
        at: [-R * 0.42, lift + s.L * 0.45, R * 0.92],
        text: 'Capacitância, tensão máxima e temperatura',
        exploded: false,
      },
      p.bulged
        ? {
            at: [0, lift + s.L + s.D * 0.1, 0],
            text: 'Topo estufado e respiro rompido: capacitor condenado',
            exploded: false,
          }
        : {
            at: [0, lift + s.L, 0],
            text: 'Respiro: as ranhuras abrem antes de a lata estourar',
            exploded: false,
          },
      {
        at: [s.pitch / 2, Math.min(4, lift * 0.3), 0],
        text: 'Terminal positivo (+): o mais longo',
        exploded: false,
      },
      {
        at: [-s.pitch / 2, LEAD_EXTRA + Math.min(4, lift * 0.3), 0],
        text: 'Terminal negativo (−): o mais curto',
        exploded: false,
      },
      { at: [0, 0, 0], text: 'Capa plástica impressa', anchor: 'sleeve', exploded: true },
      { at: [0, 0, 0], text: 'Lata de alumínio', anchor: 'can', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Folhas de alumínio e papel com eletrólito, enrolados',
        anchor: 'element',
      },
      { at: [0, 0, 0], text: 'Borracha de vedação', anchor: 'bung', exploded: true },
      { at: [0, 0, 0], text: 'Folha de alumínio (placa) e papel', anchor: 'foil', exploded: true },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const s = electrolyticSize(Number(p.farads), Number(p.voltage));
    const base = `Capacitor eletrolítico de ${microfaradsText(Number(p.farads))} e ${formatNumber(Number(p.voltage))} V, 105 °C, lata de ${formatNumber(s.D)} × ${formatNumber(s.L)} mm. O terminal negativo é o mais curto e fica sob a faixa com sinais de menos.`;
    return p.bulged
      ? `${base} Está estufado: topo abaulado e respiro rompido, com eletrólito seco vazando. Precisa ser trocado.`
      : base;
  },
  view: [-0.75, 0.6, 1.5],
};

/** Groove rolled into the can to hold the bung. */
function grooveRadius(r: number, y: number, g: { y: number; depth: number; width: number }) {
  const d = Math.abs(y - g.y) / (g.width / 2);
  if (d >= 1) return r;
  return r - g.depth * 0.5 * (1 + Math.cos(Math.PI * d));
}

/** Side wall from y0 to y1 at radius r with the groove, as points. */
function wall(r: number, y0: number, y1: number, g: { y: number; depth: number; width: number }) {
  const out: Path2 = [];
  const steps = 18;
  const ys = new Set<number>([y0, y1]);
  for (let i = 0; i <= steps; i++) ys.add(g.y - g.width / 2 + (g.width * i) / steps);
  [...ys]
    .filter((y) => y >= y0 && y <= y1)
    .sort((a, b) => a - b)
    .forEach((y) => out.push([grooveRadius(r, y, g), y]));
  return out;
}

export default function ElectrolyticCapacitor(props: ElectrolyticCapacitorProps) {
  const p = { ...meta.defaults, ...props } as Required<ElectrolyticCapacitorProps>;
  const size = electrolyticSize(p.farads, p.voltage);
  const { D, L, lead, pitch } = size;
  const R = D / 2;
  const sleeve = SLEEVES[p.sleeve] ?? SLEEVES.preto;
  const bulged = !!p.bulged;
  const lift = p.leadLength + LEAD_EXTRA;

  // Dimensions of the inner pieces.
  const tS = 0.09; // sleeve film
  const tC = 0.26; // aluminium wall
  const Rc = R - tS - 0.02; // can centre line
  const groove = { y: Math.min(1.1 + 0.05 * L, 2.6), depth: 0.25 + 0.03 * D, width: 1.1 };
  const topY = L - 0.25; // centre line of the can top
  const dome = bulged ? D * 0.13 : 0;
  const filletC = Math.min(0.55, R * 0.12);
  const rTop = Rc - filletC;
  const domeY = (r: number) => topY + dome * (1 - (r / rTop) ** 2);
  const bungTop = groove.y + groove.width / 2 + 0.35;
  const Re = Rc - tC / 2 - 0.22; // wound element radius
  const elemBottom = bungTop + 0.6;
  const elemTop = topY - tC / 2 - 0.35;

  const sleeveGeometry = useDisposable(() => {
    const f = 0.45;
    const path: Path2 = [
      [R - 0.85, 0.06],
      ...arc(R - f, 0.06 + f, f, -Math.PI / 2, 0),
      ...wall(R, 0.06 + f + 0.01, L - f - 0.01, groove),
      ...arc(R - f, L - f, f, 0, Math.PI / 2),
      [R - 0.7, L],
      [R - 0.78, L - 0.04],
    ];
    return axialLathe(thicken(path, tS), 72);
  }, [R, L, groove]);

  const canGeometry = useDisposable(() => {
    const path: Path2 = [
      [Rc - 0.45, 0.16],
      [Rc - 0.12, 0.3],
      ...wall(Rc, 0.5, topY - filletC - 0.01, groove),
      ...arc(Rc - filletC, topY - filletC, filletC, 0, Math.PI / 2),
    ];
    for (let i = 1; i <= 12; i++) {
      const r = rTop * (1 - i / 12);
      path.push([r, domeY(r)]);
    }
    return axialLathe(thicken(path, tC), 64);
  }, [Rc, topY, filletC, dome, groove]);

  // Top of the can with the scored vent: planar UVs for the drawing.
  const ventGeometry = useDisposable(() => {
    return domedDiscGeometry(rTop * 0.999, 48, 10, (r) => domeY(r) + tC / 2);
  }, [rTop, dome, topY]);

  const bungGeometry = useDisposable(() => {
    const rIn = (y: number) => grooveRadius(Rc, y, groove) - tC / 2 - 0.02;
    const path: Path2 = [[0, 0.32]];
    path.push([rIn(0.3) - 0.5, 0.32], [rIn(0.4) - 0.1, 0.42]);
    for (let i = 0; i <= 12; i++) {
      const y = 0.5 + ((bungTop - 0.5) * i) / 12;
      path.push([rIn(y), y]);
    }
    path.push([rIn(bungTop) - 0.25, bungTop], [0, bungTop]);
    return axialLathe(path, 48);
  }, [Rc, groove, bungTop]);

  const elementGeometry = useDisposable(() => {
    const f = 0.35;
    const path: Path2 = [
      [0, elemBottom],
      ...arc(Re - f, elemBottom + f, f, -Math.PI / 2, 0, 4),
      ...arc(Re - f, elemTop - f, f, 0, Math.PI / 2, 4),
      [0, elemTop],
    ];
    return axialLathe(path, 64);
  }, [Re, elemBottom, elemTop]);

  // Unrolled foil and paper in the exploded view.
  const ribbonLength = Math.max(D * 1.4, 9);
  const paperGeometry = useDisposable(
    () => ribbonGeometry(peelPath(Re + 0.01, 0.15, 0.9, ribbonLength), elemBottom, elemTop),
    [Re, elemBottom, elemTop, ribbonLength],
  );
  const foilGeometry = useDisposable(
    () =>
      ribbonGeometry(
        peelPath(Re + 0.06, 0.2, 0.85, ribbonLength * 0.92),
        elemBottom + 0.35,
        elemTop - 0.35,
      ),
    [Re, elemBottom, elemTop, ribbonLength],
  );

  // Printed sleeve: wraps the circumference (u) along the height (v).
  const circ = Math.PI * D;
  const texW = 1024;
  const texH = Math.round(Math.min(Math.max((texW * L) / circ, 256), 2048));
  const label = microfaradsLabel(p.farads);
  const volts = voltageLabel(p.voltage);
  const drawSleeve = (ctx: CanvasRenderingContext2D, w: number, h: number, metal: boolean) => {
    const mm = w / circ;
    ctx.fillStyle = metal ? '#000000' : sleeve.body;
    ctx.fillRect(0, 0, w, h);
    // u of a world direction (the mesh is turned 180° around Y).
    const uOf = (angle: number) => ((((angle - Math.PI) / (2 * Math.PI)) % 1) + 1) % 1;
    const top = 1.0 * mm;
    const bottom = h - (groove.y + groove.width) * mm;
    if (!metal) {
      // Minus stripe over the negative lead (−X).
      const su = uOf(-Math.PI / 2) * w;
      const sw = Math.min(0.17 * w, 6 * mm);
      ctx.fillStyle = sleeve.stripe;
      ctx.fillRect(su - sw / 2, top, sw, bottom - top);
      ctx.fillStyle = sleeve.mark;
      const dash = Math.min(sw * 0.5, 2.4 * mm);
      const step = Math.max(dash * 1.35, 2.2 * mm);
      for (let y = top + step * 0.7; y < bottom - step * 0.4; y += step) {
        ctx.fillRect(su - dash / 2, y - dash * 0.13, dash, dash * 0.26);
      }
    }
    ctx.fillStyle = metal ? '#ffffff' : sleeve.text;
    const big = Math.min(Math.max(D * 0.3, 1.55), 4.4) * mm;
    const small = big * 0.72;
    const usable = (bottom - top) * 0.86;
    const mid = (top + bottom) / 2;
    const column = (u: number, text: string, size: number, weight = 700) => {
      ctx.save();
      ctx.translate(u * w, mid);
      ctx.rotate(-Math.PI / 2);
      fitText(ctx, text, 0, 0, usable, size, { weight, family: FONT_SANS });
      ctx.restore();
    };
    const front = uOf(-0.28);
    const gap = (big * 1.12) / w;
    column(front - gap / 2, label, big);
    column(front + gap / 2, volts, big * 0.92);
    const back = uOf(1.9);
    column(back - gap / 2, '105°C', small, 600);
    column(back + gap / 2, `${volts} ${label}`, small, 600);
    if (bulged && !metal) {
      // Dried electrolyte that ran over the top edge, on one side.
      const random = seeded(11);
      for (let i = 0; i < 4; i++) {
        const u = (0.64 + i * 0.035 + random() * 0.02) * w;
        const len = (0.6 + random() * 2.2) * mm;
        const width = (0.25 + random() * 0.35) * mm;
        ctx.fillStyle = `rgba(${70 + Math.round(random() * 25)},40,16,0.92)`;
        ctx.beginPath();
        ctx.moveTo(u - width, 0);
        ctx.quadraticCurveTo(u - width * 0.7, len * 0.7, u, len);
        ctx.quadraticCurveTo(u + width * 0.7, len * 0.7, u + width, 0);
        ctx.fill();
      }
    }
  };
  const sleeveMap = useCanvasTexture(
    (ctx, w, h) => drawSleeve(ctx, w, h, false),
    `${label}|${volts}|${p.sleeve}|${bulged}|${D}|${L}`,
    { width: texW, height: texH, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const sleeveMetal = useCanvasTexture(
    (ctx, w, h) => drawSleeve(ctx, w, h, true),
    `${label}|${volts}|${D}|${L}|metal`,
    { width: texW, height: texH, color: false, fonts: [`700 40px ${FONT_SANS}`] },
  );

  // Vent: scored pattern (+, K or Y), lathe-turned rings; split open when bulged.
  const ventKind = D < 6 ? 'nenhum' : D <= 8 ? '+' : D <= 12.5 ? 'K' : 'Y';
  const segments = ventSegments(ventKind);
  const paintVent = (
    ctx: CanvasRenderingContext2D,
    w: number,
    mode: 'color' | 'bump' | 'metal' | 'rough',
  ) => {
    const c = w / 2;
    const r = w * 0.36;
    const base = { color: '#cfd2d6', bump: '#9a9a9a', metal: '#ffffff', rough: '#4d4d4d' }[mode];
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, w);
    if (mode === 'color') {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0.06)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    }
    if (mode === 'color' || mode === 'bump') {
      // Lathe-turned rings.
      ctx.strokeStyle = mode === 'color' ? 'rgba(70,74,80,0.12)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      for (let rr = 6; rr < c; rr += 5) {
        ctx.beginPath();
        ctx.arc(c, c, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const stroke = (style: string, width: number) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [x0, y0, x1, y1] of segments) {
        ctx.moveTo(c + x0 * r, c + y0 * r);
        ctx.lineTo(c + x1 * r, c + y1 * r);
      }
      ctx.stroke();
    };
    if (!bulged) {
      if (mode === 'color') stroke('#8a8e94', w * 0.012);
      if (mode === 'bump') {
        ctx.filter = 'blur(1.5px)';
        stroke('#202020', w * 0.014);
        ctx.filter = 'none';
      }
      return;
    }
    // Dried electrolyte crust along the split score lines.
    const random = seeded(7);
    const crust =
      mode === 'color'
        ? null
        : mode === 'bump'
          ? '#e8e8e8'
          : mode === 'metal'
            ? '#000000'
            : '#ffffff';
    for (const [x0, y0, x1, y1] of segments) {
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = c + (x0 + (x1 - x0) * t) * r + (random() - 0.5) * w * 0.05;
        const y = c + (y0 + (y1 - y0) * t) * r + (random() - 0.5) * w * 0.05;
        const rad = w * (0.012 + random() * 0.03);
        const tone = 70 + Math.round(random() * 60);
        ctx.fillStyle =
          crust ?? `rgb(${tone + 15},${Math.round(tone * 0.58)},${Math.round(tone * 0.24)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * (0.6 + random() * 0.5), random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The opened split: dark gap.
    if (mode === 'color') stroke('#0d0906', w * 0.016);
    if (mode === 'bump') stroke('#000000', w * 0.02);
    if (mode === 'metal') stroke('#000000', w * 0.02);
    if (mode === 'rough') stroke('#ffffff', w * 0.02);
  };
  const ventKey = `${ventKind}|${bulged}`;
  const ventMap = useCanvasTexture((ctx, w) => paintVent(ctx, w, 'color'), ventKey, {
    width: 512,
    height: 512,
  });
  const ventBump = useCanvasTexture((ctx, w) => paintVent(ctx, w, 'bump'), ventKey, {
    width: 512,
    height: 512,
    color: false,
  });
  const ventMetal = useCanvasTexture((ctx, w) => paintVent(ctx, w, 'metal'), ventKey, {
    width: 512,
    height: 512,
    color: false,
  });
  const ventRough = useCanvasTexture((ctx, w) => paintVent(ctx, w, 'rough'), ventKey, {
    width: 512,
    height: 512,
    color: false,
  });

  // Section of the winding: foil, paper, foil, paper (paper wider than foil).
  const sectionMap = useCanvasTexture(
    (ctx, w, h) =>
      drawWoundSection(ctx, w, h, {
        layers: Math.round(Math.min(Math.max(Re * 3.2, 8), 26)),
        colors: ['#e3e6ea', '#5e4126', '#b4b8be', '#6b4b2c'],
        weights: [0.7, 1.4, 0.6, 1.4],
        core: 0.05,
        coreColor: '#1a1612',
        margin: 0.045,
        marginColor: '#6b4b2c',
      }),
    `${Re}`,
    { width: 1024, height: 256 },
  );

  const foilMap = useCanvasTexture(
    (ctx, w, h) => {
      // Etched anode foil: matte grey with a faint rolling texture.
      ctx.fillStyle = '#c9ccd1';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % w, 0, 2, h);
    },
    'foil',
    { width: 256, height: 64 },
  );

  const noise = getNoiseTexture();
  const sleeveCut = `#${new Color(sleeve.body).multiplyScalar(0.7).getHexString()}`;
  const tabX = pitch / 2;
  const elemMid = (elemBottom + elemTop) / 2;

  return (
    <group position={[0, lift, 0]}>
      {/* Printed sleeve. */}
      <Explode offset={[-(D + 4), 0, 0]} delay={0.1}>
        <mesh geometry={sleeveGeometry} rotation={[0, Math.PI, 0]}>
          <Material
            preset="sleeve"
            clip
            color="#ffffff"
            map={sleeveMap}
            metalness={sleeve.metallic ? 1 : 0}
            metalnessMap={sleeve.metallic ? sleeveMetal : null}
            roughnessMap={noise}
            roughness={0.38}
            cutColor={sleeveCut}
          />
        </mesh>
        <Anchor name="sleeve" position={[-R, L * 0.7, 0]} />
      </Explode>

      {/* Aluminium can with the vent on top. */}
      <Explode offset={[0, L + 6, 0]}>
        <mesh geometry={canGeometry}>
          <Material preset="aluminum" clip roughness={0.32} cutColor="#8f9398" />
        </mesh>
        <mesh geometry={ventGeometry}>
          <Material
            preset="aluminum"
            clip
            color="#ffffff"
            map={ventMap}
            bumpMap={ventBump}
            bumpScale={1.5}
            metalnessMap={ventMetal}
            roughnessMap={ventRough}
            roughness={1}
            polygonOffset
            polygonOffsetFactor={-2}
            cutColor="#8f9398"
          />
        </mesh>
        <Anchor name="can" position={[R * 0.8, L * 0.5, 0]} />
      </Explode>

      {/* Wound element with its tabs; the foil and paper peel off when exploded. */}
      <Explode offset={[0, 3.5, 0]}>
        <mesh geometry={elementGeometry}>
          <Material
            preset="paper"
            clip
            color="#a98a5c"
            roughnessMap={noise}
            roughness={0.9}
            cutColor="#7a5f3c"
          />
        </mesh>
        {/* Adhesive tape that holds the winding closed. */}
        <mesh position={[0, elemMid, 0]}>
          <cylinderGeometry
            args={[Re + 0.03, Re + 0.03, (elemTop - elemBottom) * 0.42, 64, 1, true]}
          />
          <Material
            preset="paper"
            clip
            color="#c9a24a"
            roughness={0.45}
            clearcoat={0.4}
            cutColor="#7a5f3c"
          />
        </mesh>
        <SectionFace
          width={Re * 2}
          height={elemTop - elemBottom - 0.1}
          center={[0, elemMid]}
          map={sectionMap}
        />
        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[side * tabX * 0.9, elemBottom - 0.2, 0]}>
            <boxGeometry args={[Math.min(1.1, D * 0.12), 1.4, 0.1]} />
            <Material preset="aluminum" roughness={0.45} />
          </mesh>
        ))}
        <Anchor name="element" position={[Re * 0.5, elemTop - 1, 0]} />
        <ExplodeReveal from={0.45} axis="all">
          <mesh geometry={paperGeometry}>
            <Material preset="paper" color="#b09163" roughness={0.9} side={2} />
          </mesh>
          <mesh geometry={foilGeometry}>
            <Material preset="aluminum" color="#ffffff" map={foilMap} roughness={0.38} side={2} />
          </mesh>
          <Anchor name="foil" position={[Re + ribbonLength * 0.55, elemMid, Re * 0.6]} />
        </ExplodeReveal>
      </Explode>

      {/* Rubber bung with the lead rivets. */}
      <mesh geometry={bungGeometry}>
        <Material preset="rubber" clip color="#2a2a2c" roughness={0.85} cutColor="#3a3a3e" />
      </mesh>
      <Anchor name="bung" position={[R * 0.7, 1, R * 0.5]} />
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * tabX * 0.9, bungTop / 2 + 0.1, 0]}>
            <cylinderGeometry args={[lead * 0.95, lead * 0.95, bungTop, 16]} />
            <Material preset="aluminum" roughness={0.4} />
          </mesh>
          <Wire
            points={[
              [side * tabX * 0.9, 0.4, 0],
              [side * tabX * 0.9, -0.2, 0],
              [side * tabX, -1.2, 0],
              [side * tabX, side === 1 ? -lift : -p.leadLength, 0],
            ]}
            radius={lead / 2}
            bend={0.6}
          />
        </group>
      ))}
    </group>
  );
}

type Segment = [number, number, number, number];

/** Score lines of the vent, in units of the vent radius (y down, as drawn). */
function ventSegments(kind: string): Segment[] {
  if (kind === '+') {
    return [
      [-1, 0, 1, 0],
      [0, -1, 0, 1],
    ];
  }
  if (kind === 'Y') {
    return [0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + ((2 * Math.PI) / 3) * i;
      return [0, 0, Math.cos(a), Math.sin(a)] as Segment;
    });
  }
  if (kind === 'K') {
    return [
      [-0.3, -1, -0.3, 1],
      [-0.3, 0, 0.62, -0.8],
      [-0.3, 0, 0.62, 0.8],
    ];
  }
  return [];
}
