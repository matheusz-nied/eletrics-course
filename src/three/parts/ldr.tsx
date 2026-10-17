/**
 * LDR (CdS photocell) in the common epoxy-coated ceramic packages: Ø5 mm
 * (GL55xx: substrate 5,1 × 4,3 mm with two flats, leads 0,5 mm at 3,4 mm),
 * Ø10 mm (GL10xx: 9,8 mm, leads at 6,0 mm) and Ø12 mm (GL12xx: 11,8 mm,
 * leads at 7,6 mm). Dimensions from typical datasheets of these series.
 * On the ceramic: a cadmium sulfide film with two interdigitated electrodes,
 * whose gap is the orange zig-zag track, under a clear lacquer. Resistance
 * model from the same datasheets: R ≈ R10 · (lux / 10)^−0,7, R10 ≈ 10 kΩ,
 * dark resistance about 1 MΩ.
 */
import { formatNumber, formatOhms } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { filletInset, loft, type Pt } from './_semi-geometry';
import { random } from './_semi-parts';

type Size = 5 | 10 | 12;

export interface LdrProps {
  /** Nominal diameter (mm): 5, 10 or 12. */
  diameter?: Size;
  /** Illuminance on the face (lux); changes the resistance in the description. */
  lux?: number;
  leadLength?: number;
}

interface Spec {
  /** Substrate diameter and width across the flats (mm). */
  d: number;
  flat: number;
  /** Ceramic thickness. */
  t: number;
  pitch: number;
  lead: number;
  /** Bare ceramic rim around the film. */
  rim: number;
  /** Passes of the zig-zag track. */
  passes: number;
  /** Lacquer dome height above the ceramic. */
  dome: number;
}

const SPECS: Record<Size, Spec> = {
  5: { d: 5.1, flat: 4.3, t: 1.1, pitch: 3.4, lead: 0.5, rim: 0.26, passes: 9, dome: 0.3 },
  10: { d: 9.8, flat: 9.8, t: 1.5, pitch: 6.0, lead: 0.6, rim: 0.42, passes: 15, dome: 0.42 },
  12: { d: 11.8, flat: 11.8, t: 1.7, pitch: 7.6, lead: 0.6, rim: 0.5, passes: 17, dome: 0.48 },
};

const R10 = 10000;
const GAMMA = 0.7;
const R_DARK = 1e6;

function specOf(diameter: unknown): Spec {
  const d = Number(diameter);
  return SPECS[d === 10 || d === 12 ? d : 5];
}

/** Resistance (Ω) at an illuminance, clamped to the dark resistance. */
export function ldrResistance(lux: number): number {
  if (!(lux > 0)) return R_DARK;
  return Math.min(R_DARK, R10 * (lux / 10) ** -GAMMA);
}

export const meta: PartMeta = {
  id: 'ldr',
  label: 'LDR (fotorresistor)',
  category: 'sensores',
  summary:
    'Resistor que depende da luz: uma trilha de sulfeto de cádmio entre dois eletrodos em pente, cuja resistência cai quando a luz aumenta.',
  defaults: { diameter: 5, lux: 100, leadLength: 12 },
  controls: {
    diameter: {
      kind: 'select',
      label: 'Diâmetro',
      options: [
        { value: 5, label: '5 mm' },
        { value: 10, label: '10 mm' },
        { value: 12, label: '12 mm' },
      ],
    },
    lux: { kind: 'number', label: 'Luz sobre a face', min: 0, max: 1000, step: 10, unit: 'lx' },
    leadLength: { kind: 'number', label: 'Terminais', min: 4, max: 30, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const s = specOf(p.diameter);
    return [
      {
        at: [0, 0, 0] as Vec3,
        text: 'Trilha de sulfeto de cádmio (CdS): com luz, conduz melhor',
        anchor: 'track',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Eletrodos em pente: caminho curto e largo para a corrente',
        anchor: 'electrode',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Verniz transparente: deixa a luz passar e barra a umidade',
        anchor: 'lacquer',
        exploded: true,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Base de cerâmica isolante',
        anchor: 'ceramic',
        exploded: true,
      },
      {
        at: [s.pitch / 2, Math.min(4, Number(p.leadLength) * 0.4), 0] as Vec3,
        text: 'Dois terminais, sem polaridade',
        exploded: false,
      },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const s = specOf(p.diameter);
    const lux = Number(p.lux);
    const r = ldrResistance(lux);
    const now =
      r >= R_DARK
        ? `No escuro, a resistência passa de ${formatOhms(R_DARK)}.`
        : `Com ${formatNumber(lux)} lux sobre a face, a resistência fica perto de ${formatOhms(r)}.`;
    return `LDR de ${formatNumber(s.d, 2)} mm: disco de cerâmica com uma trilha laranja de sulfeto de cádmio em zigue-zague entre dois eletrodos em pente, coberto por verniz transparente, com dois terminais. ${now} Quanto mais luz, menor a resistência: cerca de 10 kΩ a 10 lux e poucas centenas de ohms sob luz forte.`;
  },
  view: [0.45, 1.25, 1],
};

/** Disc outline with two flats at |z| = f (a plain circle when f ≥ r). */
function discOutline(r: number, f: number, n = 96): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([r * Math.cos(a), Math.max(-f, Math.min(f, r * Math.sin(a)))]);
  }
  return pts;
}

interface Meander {
  points: Pt[];
  gap: number;
  /** Middle of a pass and of a finger, for the markers. */
  track: Pt;
  finger: Pt;
}

/** Centre line of the CdS gap between the two comb electrodes (mm, x and z). */
function meander(s: Spec): Meander {
  const ra = s.d / 2 - s.rim;
  const fa = s.flat / 2 - s.rim;
  const m = s.passes;
  const zLim = Math.min(ra, fa);
  const step = (2 * zLim) / (m + 0.5);
  const gap = step * 0.5;
  const spine = ra - s.pitch / 2 + s.lead * 0.62;
  const half = (z: number) => Math.sqrt(Math.max(ra * ra - z * z, 0));
  const zs = Array.from({ length: m }, (_, k) => -zLim + 0.75 * step + k * step);
  const turn = (k: number) => {
    const za = Math.max(Math.abs(zs[k]!), Math.abs(zs[k + 1]!)) + gap / 2;
    return Math.max(half(za) - spine, 0.2);
  };
  const points: Pt[] = [[half(zs[0]!) + 0.3, zs[0]!]];
  for (let k = 0; k < m - 1; k++) {
    const x = k % 2 === 0 ? -turn(k) : turn(k);
    points.push([x, zs[k]!], [x, zs[k + 1]!]);
  }
  const last = zs[m - 1]!;
  points.push([(m - 1) % 2 === 0 ? -(half(last) + 0.3) : half(last) + 0.3, last]);
  const mid = Math.floor(m / 2);
  return {
    points,
    gap,
    track: [0, zs[mid]!],
    finger: [0, (zs[mid - 2]! + zs[mid - 1]!) / 2],
  };
}

export default function Ldr(props: LdrProps) {
  const p = { ...meta.defaults, ...props } as Required<LdrProps>;
  const s = specOf(p.diameter);
  const y0 = Math.max(p.leadLength, 2);
  const yTop = y0 + s.t;
  const r = s.d / 2;
  const f = s.flat / 2;
  const ra = r - s.rim;
  const fa = f - s.rim;
  const key = String(s.d);

  const ceramic = useDisposable(() => {
    const fillet = 0.1;
    const ts = [0, 0.25, 0.5, 0.75, 1].map((k) => k * fillet);
    const rings = [
      ...ts.map((t) => ({ y: y0 + t, inset: filletInset(fillet, t) })),
      ...ts.reverse().map((t) => ({ y: yTop - t, inset: filletInset(fillet, t) })),
    ].map(({ y, inset }) => ({ y, pts: discOutline(r - inset, f - inset) }));
    return loft(rings);
  }, [key, y0]);

  // The CdS film with the electrodes: a thin slab whose top carries the pattern.
  const film = useDisposable(() => {
    const pts = discOutline(ra, fa);
    return loft(
      [
        { y: yTop - 0.004, pts },
        { y: yTop + 0.012, pts },
      ],
      { topGroup: true, topBounds: [-ra, ra, -fa, fa] },
    );
  }, [key, yTop]);

  // Clear lacquer: a shallow dome over the face that wraps the top edge.
  const lacquer = useDisposable(() => {
    const rl = r + 0.035;
    const fl = Math.min(f + 0.035, rl);
    const ring = (y: number, k: number) => ({ y, pts: discOutline(rl * k, fl * k) });
    const base = yTop - 0.11;
    const rings = [ring(base - 0.03, 0.985), ring(base, 1)];
    const n = 2.6;
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2) * 0.985;
      const k = Math.cos(a) ** (2 / n);
      rings.push(ring(base + (s.dome + 0.11) * Math.sin(a) ** (2 / n), k));
    }
    return loft(rings);
  }, [key, yTop]);

  const track = meander(s);
  const pxPerMm = 1024 / (2 * ra);
  const cw = 1024;
  const ch = Math.round(2 * fa * pxPerMm);
  const toPx = (pt: Pt): Pt => [(pt[0] + ra) * pxPerMm, (pt[1] + fa) * pxPerMm];

  const tracePath = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    track.points.forEach((pt, i) => {
      const [x, y] = toPx(pt);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  };
  const outlinePath = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    discOutline(ra, fa, 160).forEach((pt, i) => {
      const [x, y] = toPx(pt);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  const faceMap = useCanvasTexture(
    (ctx, w, h) => {
      const rand = random(7 + s.passes);
      // Fired electrode paste: warm silver with some grain.
            ctx.fillStyle = '#a9a294';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(215,209,196,0.45)' : 'rgba(150,143,130,0.4)';
        ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
      }
      // The exposed CdS track, painted on its own layer so the grain stays inside it.
      const layer = document.createElement('canvas');
      layer.width = w;
      layer.height = h;
      const l = layer.getContext('2d')!;
      l.lineJoin = 'miter';
      l.lineCap = 'butt';
      l.lineWidth = track.gap * pxPerMm;
            l.strokeStyle = '#86391a';
      tracePath(l);
      l.stroke();
      l.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 9000; i++) {
        const v = rand();
        l.fillStyle =
                    v > 0.66
            ? 'rgba(176,82,32,0.55)'
            : v > 0.33
              ? 'rgba(104,40,12,0.5)'
              : 'rgba(150,64,24,0.4)';
        const sz = 1 + rand() * 2.2;
        l.fillRect(rand() * w, rand() * h, sz, sz);
      }
      l.lineWidth = track.gap * pxPerMm * 0.35;
            l.strokeStyle = 'rgba(196,96,44,0.25)';
      tracePath(l);
      l.stroke();
      // Thin dark border where the electrode paste meets the film.
      l.globalCompositeOperation = 'source-over';
      ctx.drawImage(layer, 0, 0);
      ctx.save();
      ctx.lineJoin = 'miter';
      ctx.lineWidth = track.gap * pxPerMm + 3;
      ctx.strokeStyle = 'rgba(70,52,38,0.35)';
      ctx.globalCompositeOperation = 'destination-over';
      tracePath(ctx);
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(96,82,66,0.6)';
      outlinePath(ctx);
      ctx.stroke();
    },
    `ldr-face-${key}`,
    { width: cw, height: ch },
  );

  // G = roughness, B = metalness.
  const surfaceMap = useCanvasTexture(
    (ctx, w, h) => {
      const rand = random(11 + s.passes);
      ctx.fillStyle = 'rgb(255,92,235)';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const g = 70 + Math.floor(rand() * 50);
        ctx.fillStyle = `rgb(${235 + Math.floor(rand() * 20)},${g},235)`;
        ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
      }
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      ctx.lineWidth = track.gap * pxPerMm;
      ctx.strokeStyle = 'rgb(110,196,0)';
      tracePath(ctx);
      ctx.stroke();
    },
    `ldr-surface-${key}`,
    { width: cw, height: ch, color: false },
  );

  const noise = getNoiseTexture();
  const yFilm = yTop + 0.012;
  const toWorld = ([x, z]: Pt): Vec3 => [x, yFilm, z];

  return (
    <group>
      <mesh geometry={ceramic}>
        <Material
          preset="ceramicWhite"
          clip
          color="#ece6d7"
          roughness={0.62}
          roughnessMap={noise}
          cutColor="#d8d0bf"
        />
      </mesh>
      <Anchor name="ceramic" position={[r, y0 + s.t / 2, 0]} />

      {[-1, 1].map((side) => (
        <group key={side}>
          <Wire
            points={[
              [(side * s.pitch) / 2, 0, 0],
              [(side * s.pitch) / 2, yTop - 0.02, 0],
            ]}
            radius={s.lead / 2}
            material={{ preset: 'tin', roughness: 0.3 }}
          />
          <mesh position={[(side * s.pitch) / 2, yFilm - 0.01, 0]} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[s.lead * 0.62, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Material preset="solder" roughness={0.22} />
          </mesh>
        </group>
      ))}

      <Explode offset={[0, s.d * 0.4 + 1, 0]}>
        <mesh geometry={film}>
          <Material attach="material-0" clip color="#7d4a2a" roughness={0.6} />
          <Material
            attach="material-1"
            clip
            color="#ffffff"
            map={faceMap}
            metalness={0.85}
            metalnessMap={surfaceMap}
            roughness={1}
            roughnessMap={surfaceMap}
            cutColor="#7d4a2a"
          />
        </mesh>
        <Anchor name="track" position={toWorld(track.track)} />
        <Anchor name="electrode" position={toWorld(track.finger)} />
      </Explode>

      <Explode offset={[0, s.d * 1.1 + 2.5, 0]}>
        <mesh geometry={lacquer}>
          <Material
            preset="glass"
            clip
            color="#fffbf0"
            roughness={0.06}
            thickness={0.3}
            attenuationColor="#f3e6bf"
            attenuationDistance={5}
            cutColor="#ddd2a8"
          />
        </mesh>
        <Anchor name="lacquer" position={[r * 0.45, yTop + s.dome * 0.9, -r * 0.2]} />
      </Explode>
    </group>
  );
}
