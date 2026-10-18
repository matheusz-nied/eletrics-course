/**
 * Glass cartridge fuse 5 × 20 mm (IEC 60127-2) and the 6 × 30 mm size,
 * fast-acting (F: thin straight wire) or time-delay (T: wire wound in a spiral
 * around a fibre core), with the rating stamped on a cap. Dimensions from
 * typical datasheets (Littelfuse 5×20 series 215/235, Bel Fuse 5MF/5ST):
 * caps 5,2 mm × 4,8 mm, glass tube 4,9 mm. `blown` breaks the element, curls
 * the ends back and leaves a metal deposit inside the glass. Optional PCB
 * clips (5×20 fuse clip, two pins each).
 */
import { Shape, SphereGeometry, type BufferGeometry } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { axialLathe, roundedPath, smoothPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { extrudeAlongX, HelixCurve, mergeAll } from './_em-geometry';
import { Pin } from './_em-kit';

type FuseType = 'rapido' | 'retardo';
type FuseSize = '5x20' | '6x30';

export interface FuseGlassProps {
  /** Rated current (A). */
  amps?: number;
  /** Fast-acting (F) or time-delay (T). */
  type?: FuseType;
  size?: FuseSize;
  /** Element melted by an overload. */
  blown?: boolean;
  /** PCB clips holding the fuse. */
  holder?: 'nenhum' | 'clip-pcb';
}

const SIZES: Record<
  FuseSize,
  { r: number; length: number; cap: number; glass: number; wall: number }
> = {
  '5x20': { r: 2.6, length: 20, cap: 4.8, glass: 2.45, wall: 0.42 },
  '6x30': { r: 3.15, length: 30, cap: 6.4, glass: 2.95, wall: 0.5 },
};

const CLIP_T = 0.3;
const CLIP_PIN = 3.5;

export const meta: PartMeta = {
  id: 'fuse-glass',
  label: 'Fusível de vidro',
  category: 'passivos',
  summary:
    'Fusível de vidro 5 × 20 mm (ou 6 × 30 mm), rápido ou retardado, com o elo fusível à vista; pode aparecer queimado.',
  defaults: { amps: 2, type: 'retardo', size: '5x20', blown: false, holder: 'nenhum' },
  controls: {
    amps: {
      kind: 'select',
      label: 'Corrente nominal',
      options: [0.5, 1, 1.6, 2, 3.15, 5, 10].map((a) => ({ value: a, label: ampsLabel(a) })),
    },
    type: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'rapido', label: 'Rápido (F)' },
        { value: 'retardo', label: 'Retardado (T)' },
      ],
    },
    size: {
      kind: 'select',
      label: 'Tamanho',
      options: [
        { value: '5x20', label: '5 × 20 mm' },
        { value: '6x30', label: '6 × 30 mm' },
      ],
    },
    blown: { kind: 'toggle', label: 'Queimado' },
    holder: {
      kind: 'select',
      label: 'Suporte',
      options: [
        { value: 'nenhum', label: 'Solto' },
        { value: 'clip-pcb', label: 'Clipes de placa' },
      ],
    },
  },
  annotations: (p) => {
    const s = SIZES[sizeOf(p.size)];
    const list = [
      {
        at: [-(s.length / 2 - s.cap / 2), s.r * 2.1, 0] as Vec3,
        text: 'Marcação: T = retardado, F = rápido, corrente e tensão',
        exploded: false,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Tampa metálica: é por ela que a corrente entra',
        anchor: 'tampa',
      },
      { at: [0, 0, 0] as Vec3, text: 'Tubo de vidro: deixa ver o elo', anchor: 'vidro' },
      {
        at: [0, 0, 0] as Vec3,
        text:
          p.type === 'rapido'
            ? 'Elo fusível: fio fino que derrete com excesso de corrente'
            : 'Elo em espiral: aguenta o pico de partida e derrete se o excesso durar',
        anchor: 'elo',
      },
    ];
    if (p.blown)
      list.push({
        at: [0, 0, 0] as Vec3,
        text: 'Fio rompido e vidro manchado: fusível queimado',
        anchor: 'queima',
      });
    if (p.holder === 'clip-pcb')
      list.push({
        at: [0, 0, 0] as Vec3,
        text: 'Clipe de placa: segura e liga a tampa',
        anchor: 'clipe',
      });
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const kind = p.type === 'rapido' ? 'rápido (F)' : 'retardado (T)';
    const size = sizeOf(p.size) === '6x30' ? '6 × 30 mm' : '5 × 20 mm';
    const base = `Fusível de vidro ${size}, ${kind}, ${ampsLabel(Number(p.amps))}, 250 V, marcado ${marking(Number(p.amps), p.type as FuseType)}`;
    const state = p.blown
      ? 'Queimado: o elo está rompido e o vidro, manchado por dentro.'
      : 'Inteiro: o elo liga uma tampa à outra.';
    const holder = p.holder === 'clip-pcb' ? ' Preso em dois clipes de placa.' : '';
    return `${base}. ${state}${holder}`;
  },
  view: [0.55, 0.75, 1.5],
};

function sizeOf(v: unknown): FuseSize {
  return v === '6x30' ? '6x30' : '5x20';
}

function ampsLabel(a: number): string {
  return a < 1 ? `${formatNumber(a * 1000)} mA` : `${formatNumber(a)} A`;
}

/** Stamped marking, as on real fuses (decimal point, no spaces inside the rating). */
function marking(amps: number, type: FuseType): string {
  const letter = type === 'rapido' ? 'F' : 'T';
  const value = amps < 1 ? `${Math.round(amps * 1000)}mA` : `${amps}A`;
  return `${letter}${value} 250V`;
}

export default function FuseGlass(props: FuseGlassProps) {
  const p = { ...meta.defaults, ...props } as Required<FuseGlassProps>;
  const size = sizeOf(p.size);
  const s = SIZES[size];
  const amps = Math.max(Number(p.amps) || 1, 0.05);
  const slow = p.type !== 'rapido';
  const withHolder = p.holder === 'clip-pcb';
  const half = s.length / 2;
  const innerR = s.glass - s.wall;
  const glassHalf = half - 0.35;
  const axisY = withHolder ? CLIP_PIN + CLIP_T + s.r + 0.05 : s.r;

  // Cap: a cup with a rounded closed end, lying along +Y (turned to X below).
  const capGeometry = useDisposable(() => {
    const r = s.r;
    const t = 0.18;
    const f = 0.55;
    const pts: [number, number][] = [[0, 0]];
    for (let i = 0; i <= 6; i++) {
      const a = (Math.PI / 2) * (i / 6);
      pts.push([r - f + Math.sin(a) * f, f - Math.cos(a) * f]);
    }
    pts.push([r, s.cap - 0.25]);
    pts.push([r - 0.12, s.cap]);
    pts.push([r - t - 0.05, s.cap]);
    pts.push([r - t, s.cap - 0.2]);
    pts.push([r - t, t]);
    pts.push([0, t]);
    return axialLathe(pts, 48);
  }, [s]);

  // Glass tube: outer and inner walls.
  const glassGeometry = useDisposable(() => {
    const L = glassHalf * 2;
    return axialLathe(
      [
        [innerR, 0],
        [s.glass - 0.08, 0],
        [s.glass, 0.1],
        [s.glass, L - 0.1],
        [s.glass - 0.08, L],
        [innerR, L],
        [innerR, 0],
      ],
      48,
    );
  }, [s, glassHalf, innerR]);

  // Fuse element.
  const wireR = slow
    ? 0.035 + 0.012 * Math.sqrt(amps)
    : Math.min(0.025 + 0.03 * Math.sqrt(amps), 0.16);
  const gap = p.blown ? (slow ? 1.6 : 2.4) : 0;
  const elementGeometry = useDisposable(() => {
    const span = glassHalf - 0.1;
    if (!slow) {
      const a: Vec3 = [-span, innerR * 0.55, 0];
      const b: Vec3 = [span, -innerR * 0.55, 0];
      if (!p.blown) return tube(roundedPath([a, b]), wireR, { radial: 8 });
      // Two halves, each curled back at the break, with a melted bead at the tip.
      const pieces: BufferGeometry[] = [];
      for (const side of [-1, 1]) {
        const start: Vec3 = side < 0 ? a : b;
        const along = (x: number): Vec3 => [x, (-innerR * 0.55 * x) / span, 0];
        const xt = side * (gap / 2);
        const tip = along(xt);
        const pts: Vec3[] = [
          start,
          along(side * span * 0.5),
          along(xt + side * 0.7),
          tip,
          [xt - side * 0.2, tip[1] + 0.32, 0.05],
          [xt + side * 0.18, tip[1] + 0.5, 0.12],
          [xt + side * 0.45, tip[1] + 0.3, 0.16],
        ];
        pieces.push(tube(smoothPath(pts, 0.35), wireR, { radial: 8, segments: 90 }));
        const bead = new SphereGeometry(wireR * 2.2, 10, 8);
        bead.translate(xt + side * 0.45, tip[1] + 0.3, 0.16);
        pieces.push(bead);
      }
      return mergeAll(pieces);
    }
    // Time-delay: wire wound around a fibre core.
    const coilR = 0.36;
    const pitch = Math.max(wireR * 3.2, 0.2);
    if (!p.blown) {
      const turns = (span * 2) / pitch;
      const g = tube(new HelixCurve(coilR, span * 2, turns), wireR, {
        radial: 6,
        segments: Math.min(Math.ceil(turns * 14), 1400),
      });
      g.rotateZ(-Math.PI / 2);
      g.translate(-span, 0, 0);
      return g;
    }
    const pieces = [-1, 1].map((side) => {
      const len = span - gap / 2;
      const turns = len / pitch;
      const g = tube(new HelixCurve(coilR, len, turns), wireR, {
        radial: 6,
        segments: Math.min(Math.ceil(turns * 14), 700),
      });
      g.rotateZ(-Math.PI / 2);
      g.translate(-span, 0, 0);
      if (side > 0) g.rotateY(Math.PI);
      return g;
    });
    // Loose ends sprung away from the core.
    pieces.push(
      ...[-1, 1].map((side) =>
        tube(
          smoothPath(
            [
              [side * (gap / 2), coilR, 0],
              [side * (gap / 2 - 0.25), coilR + 0.45, 0.2],
              [side * (gap / 2 - 0.05), coilR + 0.8, 0.45],
            ],
            0.5,
          ),
          wireR,
          { radial: 6, segments: 20 },
        ),
      ),
    );
    return mergeAll(pieces);
  }, [slow, p.blown, wireR, glassHalf, innerR, gap]);

  // Rating stamped on the left cap: the text wraps around the seam at u = 0 (+Z side).
  const label = marking(amps, slow ? 'retardo' : 'rapido');
  const stamp = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5d5c58';
      for (const x of [0, w]) {
        fitText(ctx, label, x, h * 0.5, w * 0.4, h * 0.24, { weight: 700, family: FONT_SANS });
      }
    },
    label,
    { width: 1024, height: 304, fonts: [`700 40px ${FONT_SANS}`] },
  );

  // Metal deposit left on the glass by the vaporised element.
  const deposit = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (!p.blown) return;
      let seed = 7;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const blob = (x: number, y: number, r: number, color: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      const spread = slow ? 0.22 : 0.32;
      // Smoky haze around the break, then fine metal splatter.
      for (let i = 0; i < 90; i++) {
        const y = h * (0.5 + (rnd() - 0.5) * 2 * spread * Math.sqrt(rnd()));
        const x = rnd() * w;
        blob(x, y, 30 + rnd() * 60, rnd() > 0.5 ? 'rgba(70,64,58,0.22)' : 'rgba(140,140,136,0.2)');
        if (x < 90) blob(x + w, y, 30 + rnd() * 60, 'rgba(70,64,58,0.18)');
      }
      for (let i = 0; i < 160; i++) {
        const y = h * (0.5 + (rnd() - 0.5) * 2 * spread * rnd());
        blob(
          rnd() * w,
          y,
          2 + rnd() * 6,
          rnd() > 0.4 ? 'rgba(35,32,30,0.6)' : 'rgba(205,205,200,0.6)',
        );
      }
    },
    `${slow}|${p.blown}`,
    { width: 256, height: 512 },
  );

  const clipGeometry = useDisposable(() => {
    // Spring arms around the cap, open at the top, with flared lips.
    const r0 = s.r + 0.02;
    const r1 = r0 + CLIP_T;
    const a0 = (140 * Math.PI) / 180;
    const a1 = (400 * Math.PI) / 180;
    const steps = 48;
    const u = (a: number, r: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
    const lip = 0.9;
    const shape = new Shape();
    shape.moveTo(...u(a0, r1));
    for (let i = 1; i <= steps; i++) shape.lineTo(...u(a0 + ((a1 - a0) * i) / steps, r1));
    // Right lip, flared up and out.
    const [ox, oy] = u(a1, r1);
    const [ix, iy] = u(a1, r0);
    shape.lineTo(ox + lip * 0.55, oy + lip * 0.85);
    shape.lineTo(ix + lip * 0.55, iy + lip * 0.85);
    for (let i = steps; i >= 0; i--) shape.lineTo(...u(a0 + ((a1 - a0) * i) / steps, r0));
    const [lix, liy] = u(a0, r0);
    const [lox, loy] = u(a0, r1);
    shape.lineTo(lix - lip * 0.55, liy + lip * 0.85);
    shape.lineTo(lox - lip * 0.55, loy + lip * 0.85);
    shape.closePath();
    return extrudeAlongX(shape, 4.4, 0.06);
  }, [s]);

  const capCentre = half - s.cap / 2;

  return (
    <group>
      <group position={[0, axisY, 0]}>
        {/* Caps. */}
        {([-1, 1] as const).map((side) => (
          <Explode key={side} offset={[side * (s.cap + 4), 0, 0]}>
            <group
              position={[side * half, 0, 0]}
              rotation={[0, 0, side < 0 ? -Math.PI / 2 : Math.PI / 2]}
            >
              <mesh geometry={capGeometry}>
                <Material
                  preset="nickel"
                  color="#d4d2cc"
                  roughness={0.22}
                  clip
                  cutColor="#8d8b86"
                  {...(side < 0 ? { map: stamp } : {})}
                />
              </mesh>
              {/* Solder that holds the element inside the cap. */}
              <mesh position={[0, 0.18 + 0.15, 0]}>
                <cylinderGeometry args={[s.glass * 0.7, s.glass * 0.8, 0.3, 24]} />
                <Material preset="solder" roughness={0.3} />
              </mesh>
            </group>
            {side < 0 && <Anchor name="tampa" position={[-capCentre, s.r, 0]} />}
          </Explode>
        ))}

        {/* Glass tube and the deposit inside it. */}
        <Explode offset={[0, s.r * 2.8, 0]}>
          <group position={[-glassHalf, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh geometry={glassGeometry}>
              <Material
                preset="glass"
                clip
                thickness={s.wall}
                roughness={p.blown ? 0.1 : 0.02}
                color="#fbfcfd"
                map={deposit}
                cutColor="#cfe0dc"
              />
            </mesh>
          </group>
          <Anchor name="vidro" position={[glassHalf * 0.55, s.glass, 0]} />
          {p.blown && <Anchor name="queima" position={[0, s.glass, s.glass * 0.4]} />}
        </Explode>

        {/* Element (and the fibre core of time-delay fuses). */}
        <mesh geometry={elementGeometry}>
          <Material
            preset="tin"
            color={p.blown ? '#a9a49b' : slow ? '#c9c7c2' : '#dcdcd8'}
            roughness={slow ? 0.18 : 0.25}
          />
        </mesh>
        {slow && (
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.3, 0.3, glassHalf * 2 - 0.2, 12]} />
            <Material preset="paper" color={p.blown ? '#8a7f6e' : '#ece6d6'} roughness={0.9} />
          </mesh>
        )}
        <Anchor name="elo" position={[-glassHalf * 0.35, slow ? 0.5 : innerR * 0.2, 0]} />
      </group>

      {/* PCB clips. */}
      {withHolder && (
        <Explode offset={[0, -7, 0]}>
          {([-1, 1] as const).map((side) => (
            <group key={side} position={[side * capCentre, 0, 0]}>
              <mesh geometry={clipGeometry} position={[0, axisY, 0]}>
                <Material preset="tin" roughness={0.3} />
              </mesh>
              {/* Base strip and end stop. */}
              <mesh position={[0, CLIP_PIN + CLIP_T / 2, 0]}>
                <boxGeometry args={[4.4, CLIP_T, 3.2]} />
                <Material preset="tin" roughness={0.3} />
              </mesh>
              <mesh position={[side * (half + 0.3) - side * capCentre, CLIP_PIN + s.r * 0.75, 0]}>
                <boxGeometry args={[CLIP_T, s.r * 1.5, 2]} />
                <Material preset="tin" roughness={0.3} />
              </mesh>
              {[-1, 1].map((pz) => (
                <Pin
                  key={pz}
                  x={pz * 1.4}
                  z={0}
                  bottom={0}
                  top={CLIP_PIN + CLIP_T}
                  width={0.9}
                  thickness={0.4}
                />
              ))}
              {side < 0 && <Anchor name="clipe" position={[0, CLIP_PIN + 1, 1.6]} />}
            </group>
          ))}
        </Explode>
      )}
    </group>
  );
}
