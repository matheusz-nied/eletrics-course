/**
 * Automotive blade fuse: standard (ATO/ATC, 19,1 × 18,5 × 5,2 mm) and mini
 * (ATM, 10,9 × 16,3 × 3,8 mm), with the translucent housing coloured by
 * the rated current (ISO 8820-3 / SAE J1284 colour code) and the zinc
 * element visible inside: two blades joined by the narrow fuse link, test
 * points on top. Dimensions from typical datasheets (Littelfuse ATO 257 and
 * ATM 297 series: blades 0,65 mm thick). `blown` melts the link.
 */
import { Shape, type BufferGeometry } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { addRoundedRect, extrudeAlongZ, extrudeUp, mergeAll, roundedBox } from './_em-geometry';
import { Decal, shade } from './_em-kit';

type BladeSize = 'padrao' | 'mini';

export interface FuseBladeProps {
  /** Rated current (A). */
  amps?: number;
  size?: BladeSize;
  /** Link melted by an overload. */
  blown?: boolean;
}

/** Colour code (housing colour, attenuation strength). */
export const BLADE_COLORS: Record<string, { color: string; name: string; opacity: number }> = {
  '1': { color: '#1d1d1f', name: 'preto', opacity: 0.85 },
  '2': { color: '#8f949a', name: 'cinza', opacity: 0.55 },
  '3': { color: '#7b3fb0', name: 'violeta', opacity: 0.4 },
  '4': { color: '#f08bb4', name: 'rosa', opacity: 0.4 },
  '5': { color: '#c9a77a', name: 'bege (tan)', opacity: 0.55 },
  '7.5': { color: '#7a4a24', name: 'marrom', opacity: 0.6 },
  '10': { color: '#d8241c', name: 'vermelho', opacity: 0.35 },
  '15': { color: '#1f5fd0', name: 'azul', opacity: 0.35 },
  '20': { color: '#f2c40f', name: 'amarelo', opacity: 0.3 },
  '25': { color: '#eef0f2', name: 'transparente (natural)', opacity: 0.08 },
  '30': { color: '#1f9b46', name: 'verde', opacity: 0.35 },
  '40': { color: '#ef7a12', name: 'laranja', opacity: 0.35 },
};

const AMPS = [1, 2, 3, 4, 5, 7.5, 10, 15, 20, 25, 30, 40];

interface Dims {
  W: number;
  H: number;
  T: number;
  bladeW: number;
  gap: number;
  bladeT: number;
  exposed: number;
  headH: number;
  bodyW: number;
  bodyT: number;
  k: number;
}

const DIMS: Record<BladeSize, Dims> = {
  padrao: {
    W: 19.1,
    H: 18.5,
    T: 5.2,
    bladeW: 5.2,
    gap: 4.1,
    bladeT: 0.65,
    exposed: 6.5,
    headH: 3.9,
    bodyW: 18.2,
    bodyT: 3.9,
    k: 1,
  },
  mini: {
    W: 10.9,
    H: 16.3,
    T: 3.8,
    bladeW: 2.8,
    gap: 3,
    bladeT: 0.6,
    exposed: 7.5,
    headH: 3.3,
    bodyW: 10.3,
    bodyT: 3,
    k: 0.6,
  },
};

export const meta: PartMeta = {
  id: 'fuse-blade',
  label: 'Fusível de lâmina (automotivo)',
  category: 'passivos',
  summary:
    'Fusível automotivo de lâmina, padrão ou mini, com a cor da corrente nominal e o elo fusível visível no corpo transparente.',
  defaults: { amps: 10, size: 'padrao', blown: false },
  controls: {
    amps: {
      kind: 'select',
      label: 'Corrente nominal',
      options: AMPS.map((a) => ({
        value: a,
        label: `${formatNumber(a)} A (${BLADE_COLORS[String(a)]!.name})`,
      })),
    },
    size: {
      kind: 'select',
      label: 'Tamanho',
      options: [
        { value: 'padrao', label: 'Padrão (ATO)' },
        { value: 'mini', label: 'Mini (ATM)' },
      ],
    },
    blown: { kind: 'toggle', label: 'Queimado' },
  },
  annotations: (p) => {
    const d = DIMS[sizeOf(p.size)];
    const list = [
      {
        at: [0, d.H + 0.3, 0] as Vec3,
        text: `Número e cor: ${formatNumber(Number(p.amps))} A`,
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Elo fusível: a parte estreita que derrete', anchor: 'elo' },
      {
        at: [d.gap / 2 + d.bladeW / 2, d.exposed * 0.4, d.bladeT] as Vec3,
        text: 'Lâminas: encaixam na caixa de fusíveis',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Pontos de teste: medir sem tirar o fusível',
        anchor: 'teste',
        exploded: false,
      },
    ];
    if (p.blown)
      list.push({
        at: [0, 0, 0] as Vec3,
        text: 'Elo rompido: o fusível abriu o circuito',
        anchor: 'elo',
      });
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const a = ampsOf(p.amps);
    const c = BLADE_COLORS[String(a)]!;
    const size = sizeOf(p.size) === 'mini' ? 'mini' : 'padrão';
    const state = p.blown
      ? 'Queimado: o elo do meio está rompido.'
      : 'Inteiro: o elo liga as duas lâminas.';
    return `Fusível automotivo de lâmina ${size}, ${formatNumber(a)} A, corpo ${c.name}. ${state}`;
  },
  view: [0.5, 0.85, 1.4],
};

function sizeOf(v: unknown): BladeSize {
  return v === 'mini' ? 'mini' : 'padrao';
}

function ampsOf(v: unknown): number {
  const a = Number(v);
  return AMPS.includes(a) ? a : 10;
}

/** The stamped zinc element: two blades, shoulders, the link and the test tabs. */
function elementShapes(d: Dims, amps: number, blown: boolean): Shape[] {
  const xi = d.gap / 2;
  const xo = xi + d.bladeW;
  const tc = (xi + xo) / 2;
  const k = d.k;
  const linkY = d.exposed + (d.H - d.headH - d.exposed) * 0.5;
  const lw = Math.min(0.22 + 0.03 * amps, 1.5) * k;
  const shoulderTop = linkY + 1.2 * k;
  const shoulderLow = linkY - 1.3 * k;
  const linkHalf = 1.7 * k;
  const tabTop = d.H - 0.7 * k;
  const tabW = 1.0 * k;
  const ch = 0.6 * k;
  const breakHalf = blown ? 0.9 * k : 0;

  const half = (side: 1 | -1, joined: boolean): Shape => {
    // Built for the right half (side = 1) and mirrored.
    const pts: [number, number][] = [
      [xi, ch * 0.5],
      [xi + ch * 0.5, 0],
      [xo - ch, 0],
      [xo, ch],
      [xo, shoulderTop],
      [tc + tabW, shoulderTop],
      [tc + tabW, tabTop],
      [tc - tabW, tabTop],
      [tc - tabW, shoulderTop],
      [xi + 0.35 * k, shoulderTop],
      [linkHalf, linkY + lw / 2],
    ];
    if (joined) {
      pts.push([-linkHalf, linkY + lw / 2]);
      pts.push([-(xi + 0.35 * k), shoulderTop]);
      pts.push([-(tc - tabW), shoulderTop]);
      pts.push([-(tc - tabW), tabTop]);
      pts.push([-(tc + tabW), tabTop]);
      pts.push([-(tc + tabW), shoulderTop]);
      pts.push([-xo, shoulderTop]);
      pts.push([-xo, ch]);
      pts.push([-(xo - ch), 0]);
      pts.push([-(xi + ch * 0.5), 0]);
      pts.push([-xi, ch * 0.5]);
      pts.push([-xi, shoulderLow]);
      pts.push([-linkHalf, linkY - lw / 2]);
    } else {
      // Melted stub: the link ends in a rounded bead.
      const r = Math.min(lw * 0.9, 0.6 * k);
      pts.push([breakHalf + r, linkY + lw / 2]);
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI / 2 + (Math.PI * i) / 8;
        pts.push([breakHalf + r * 0.6 + r * Math.cos(a), linkY + r * Math.sin(a)]);
      }
      pts.push([breakHalf + r, linkY - lw / 2]);
    }
    pts.push([linkHalf, linkY - lw / 2]);
    pts.push([xi, shoulderLow]);
    const shape = new Shape();
    pts.forEach(([x, y], i) => {
      const px = side * x;
      if (i === 0) shape.moveTo(px, y);
      else shape.lineTo(px, y);
    });
    shape.closePath();
    return shape;
  };

  if (!blown) return [half(1, true)];
  return [half(1, false), half(-1, false)];
}

export default function FuseBlade(props: FuseBladeProps) {
  const p = { ...meta.defaults, ...props } as Required<FuseBladeProps>;
  const size = sizeOf(p.size);
  const d = DIMS[size];
  const amps = ampsOf(p.amps);
  const colour = BLADE_COLORS[String(amps)]!;
  const noise = getNoiseTexture();
  const xi = d.gap / 2;
  const tc = xi + d.bladeW / 2;
  const linkY = d.exposed + (d.H - d.headH - d.exposed) * 0.5;
  const headY = d.H - d.headH;

  const element = useDisposable(() => {
    const shapes = elementShapes(d, amps, p.blown);
    // Mirrored halves come out clockwise; ExtrudeGeometry handles either winding.
    return extrudeAlongZ(shapes, d.bladeT, 0.06 * d.k + 0.02);
  }, [d, amps, p.blown]);

  // Head with the two test-point holes, and the thinner skirt around the blades.
  const head = useDisposable(() => {
    const shape = new Shape();
    addRoundedRect(shape, d.W, d.T, 0.9 * d.k + 0.2);
    for (const side of [-1, 1]) {
      const hole = new Shape();
      addRoundedRect(hole, 1.25 * d.k + 0.35, 0.95 * d.k + 0.2, 0.3, side * tc, 0, true);
      shape.holes.push(hole);
    }
    const g = extrudeUp(shape, d.headH, 0.25, { curveSegments: 6 });
    g.translate(0, headY, 0);
    return g;
  }, [d, tc, headY]);

  const body = useDisposable(() => {
    const g = roundedBox(d.bodyW, headY - d.exposed + 0.3, d.bodyT, 0.5 * d.k + 0.2, 0.25);
    g.translate(0, d.exposed, 0);
    return g;
  }, [d, headY]);

  // Grip ribs on the ends of the head.
  const ribs = useDisposable(() => {
    const list: BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (const z of [-0.3, 0, 0.3]) {
        const rib = roundedBox(0.35 * d.k + 0.1, d.headH * 0.62, 0.45 * d.k + 0.1, 0.1, 0.06);
        rib.translate(side * (d.W / 2 + 0.05), headY + d.headH * 0.18, z * d.T);
        list.push(rib);
      }
    }
    return mergeAll(list);
  }, [d, headY]);

  // Amperage moulded on top: a darker, slightly raised figure.
  const number = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,1)';
      fitText(ctx, formatNumber(amps), w / 2, h * 0.54, w * 0.86, h * 0.86, {
        weight: 800,
        family: FONT_SANS,
      });
    },
    `${amps}`,
    { width: 256, height: 160, fonts: [`800 40px ${FONT_SANS}`] },
  );

  // Soot left inside the window by a blown link: speckled, denser at the centre.
  const soot = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      let seed = 3;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 0; i < 700; i++) {
        const a = rnd() * Math.PI * 2;
        const rr = Math.pow(rnd(), 1.6);
        const x = w / 2 + Math.cos(a) * rr * w * 0.48;
        const y = h / 2 + Math.sin(a) * rr * h * 0.46;
        const r = 1 + rnd() * 3.5 * (1 - rr);
        ctx.fillStyle = `rgba(255,255,255,${0.5 + rnd() * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    'soot',
    { width: 256, height: 128 },
  );

  const clear = amps === 25;
  const plastic = {
    color: colour.color,
    roughness: 0.16,
    transmission: 1 - colour.opacity,
    thickness: d.T,
    ior: 1.5,
    attenuationColor: colour.color,
    attenuationDistance: clear ? 100 : 4 + (1 - colour.opacity) * 10,
    roughnessMap: noise,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  };
  const numberColor = clear ? '#c9cdd2' : shade(colour.color, -0.35);
  const topSpan = Math.max(2 * (tc - (1.25 * d.k + 0.35) / 2) - 1.2 * d.k, 3);

  return (
    <group>
      <Explode offset={[0, d.H * 0.75, 0]}>
        <mesh geometry={head}>
          <Material {...plastic} clip cutColor={shade(colour.color, -0.2)} />
        </mesh>
        <mesh geometry={body}>
          <Material {...plastic} clip cutColor={shade(colour.color, -0.2)} />
        </mesh>
        <mesh geometry={ribs}>
          <Material {...plastic} />
        </mesh>
        <Decal
          map={number}
          width={topSpan}
          height={topSpan * 0.62}
          position={[0, d.H + 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          color={numberColor}
          roughness={0.35}
          clip
        />
        <Anchor name="teste" position={[tc, d.H, 0]} />
      </Explode>

      {/* Soot inside the window, around the melted link (opaque, so it shows through the housing). */}
      {p.blown &&
        [1, -1].map((side) => (
          <mesh
            key={side}
            position={[0, linkY, side * (d.bladeT / 2 + 0.08)]}
            rotation={[0, side > 0 ? 0 : Math.PI, 0]}
          >
            <planeGeometry args={[5.5 * d.k + 1, 2.8 * d.k + 0.6]} />
            <Material color="#2a221c" map={soot} alphaTest={0.3} roughness={0.8} />
          </mesh>
        ))}

      {/* Zinc element. */}
      <mesh geometry={element}>
        <Material preset="tin" color="#e2e5e7" roughness={0.42} roughnessMap={noise} />
      </mesh>
      <Anchor name="elo" position={[0, linkY + 0.5, d.bladeT / 2]} />
    </group>
  );
}
