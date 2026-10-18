/**
 * Hall-effect switch in the flat 3-lead SIP package (UA / TO-92S, as on the
 * 3144 and 1881): body 4,06 × 3,02 × 1,52 mm with chamfered top corners and
 * bevelled back edges, leads 0,41 mm wide at 1,27 mm. Dimensions from
 * typical datasheets (package "UA"); the Hall plate sits about 0,5 mm behind
 * the printed face. Optionally a small neodymium magnet in front of it.
 */
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { bondWires, extrudeOutline, filletInset, loft, mergeAll, type Pt } from './_semi-geometry';
import { SiliconDie, usePrintedTop } from './_semi-parts';

export interface HallSensorProps {
  code?: string;
  dateCode?: string;
  /** A magnet's south pole faces the printed side: the output switches on. */
  detecting?: boolean;
  leadLength?: number;
}

const W = 4.06;
const H = 3.02;
const D = 1.52;
const CHAMFER = 0.55;
const LEAD_W = 0.41;
const LEAD_T = 0.38;
/** Die position: active surface 0,5 mm behind the face. */
const DIE_T = 0.22;
const DIE_TOP = D / 2 - 0.5;
const FRAME_Z = DIE_TOP - DIE_T - LEAD_T / 2 - 0.02;
const DIE_Y = 1.75;
const DIE: [number, number] = [1.3, 1.1];
const PINS = ['VCC', 'GND', 'saída'];

export const meta: PartMeta = {
  id: 'hall-sensor',
  label: 'Sensor de efeito Hall',
  category: 'sensores',
  summary:
    'Sensor Hall de três terminais (como o 3144): liga a saída quando o polo sul de um ímã se aproxima da face marcada.',
  defaults: { code: '3144', dateCode: 'E23', detecting: false, leadLength: 14 },
  controls: {
    code: { kind: 'text', label: 'Código impresso', maxLength: 6 },
    dateCode: { kind: 'text', label: 'Código de data', maxLength: 5 },
    detecting: { kind: 'toggle', label: 'Ímã perto (detectando)' },
    leadLength: { kind: 'number', label: 'Terminais', min: 4, max: 20, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const y0 = Number(p.leadLength);
    const list = [
      {
        at: [0, y0 + H * 0.45, D / 2] as Vec3,
        text: 'Face marcada: o lado que sente o ímã',
        exploded: false,
      },
      ...PINS.map((name, i) => ({
        at: [(i - 1) * 1.27, Math.min(3, y0 * 0.25), 0] as Vec3,
        text: `${i + 1}: ${name}`,
        exploded: false,
      })),
      { at: [0, 0, 0] as Vec3, text: 'Elemento Hall, 0,5 mm atrás da face', anchor: 'plate' },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Amplificador e comparador no mesmo chip',
        anchor: 'logic',
        exploded: true,
      },
    ];
    if (p.detecting) {
      list.push({
        at: [0, 0, 0] as Vec3,
        text: 'Ímã com o polo sul virado para o sensor',
        anchor: 'magnet',
        exploded: false,
      });
    }
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) =>
    `Sensor de efeito Hall ${String(p.code)} de três terminais: 1 alimentação (VCC), 2 terra (GND), 3 saída, vistos com a face marcada de frente. ${
      p.detecting
        ? 'Há um ímã com o polo sul virado para a face marcada: a saída está ligada (vai para 0 V).'
        : 'Sem ímã por perto, a saída fica desligada.'
    }`,
  view: [1.15, 0.55, 1.25],
};

/** Front-view outline (x, y) with chamfered top corners, inset by `i`, sides by `sx`. */
function outline(i: number, sx: number): Pt[] {
  const x1 = W / 2 - i - sx;
  const y0 = i;
  const y1 = H - i;
  const c = Math.max(CHAMFER - i * 0.4, 0.05);
  const r = Math.max(0.12 - i, 0.02);
  const pts: Pt[] = [[0, y0]];
  // Bottom right corner (rounded), right side, chamfer, top, chamfer, left side, bottom left.
  for (let k = 0; k <= 3; k++) {
    const a = -Math.PI / 2 + (k / 3) * (Math.PI / 2);
    pts.push([x1 - r + r * Math.cos(a), y0 + r + r * Math.sin(a)]);
  }
  pts.push([x1, y1 - c], [x1 - c, y1], [-(x1 - c), y1], [-x1, y1 - c]);
  for (let k = 0; k <= 3; k++) {
    const a = Math.PI + (k / 3) * (Math.PI / 2);
    pts.push([-x1 + r + r * Math.cos(a), y0 + r + r * Math.sin(a)]);
  }
  return pts;
}

export default function HallSensor(props: HallSensorProps) {
  const p = { ...meta.defaults, ...props } as Required<HallSensorProps>;
  const y0 = Math.max(p.leadLength, 3);

  // Lofted along the depth: front face at +Z, back edges bevelled.
  const body = useDisposable(() => {
    const f = 0.12;
    const zs = new Set<number>([0, D]);
    for (let k = 1; k <= 4; k++) {
      zs.add((f * k) / 4);
      zs.add(D - (f * k) / 4);
    }
    zs.add(D * 0.45);
    const rings = [...zs]
      .sort((a, b) => a - b)
      .map((t) => {
        const inset = (t < f ? filletInset(f, t) : 0) + (t > D - f ? filletInset(f, D - t) : 0);
        const side = t > D * 0.45 ? (t - D * 0.45) * 0.4 : 0;
        return { y: t, pts: outline(inset, side) };
      });
    const g = loft(rings);
    // Loft axis (depth) becomes -Z, the outline's second coordinate becomes Y.
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, D / 2);
    return g;
  }, []);

  const leads = useDisposable(() => {
    const parts = [-1, 0, 1].map((s) => {
      const x = s * 1.27;
      const g = extrudeOutline(
        [
          [x - LEAD_W / 2, 0],
          [x + LEAD_W / 2, 0],
          [x + LEAD_W / 2, y0 + 0.2],
          [x - LEAD_W / 2, y0 + 0.2],
        ],
        LEAD_T,
        0.04,
      );
      g.translate(0, 0, FRAME_Z);
      return g;
    });
    return mergeAll(parts);
  }, [y0]);

  // Lead frame inside: the middle (ground) lead carries the paddle.
  const frame = useDisposable(() => {
    const parts = [-1, 1].map((s) =>
      extrudeOutline(
        [
          [s * 1.27 - 0.3, 0.2],
          [s * 1.27 + 0.3, 0.2],
          [s * 1.27 + 0.3, DIE_Y - 0.85],
          [s * 1.27 - 0.3, DIE_Y - 0.85],
        ],
        LEAD_T,
      ),
    );
    parts.push(
      extrudeOutline(
        [
          [-LEAD_W / 2, 0.2],
          [LEAD_W / 2, 0.2],
          [LEAD_W / 2, DIE_Y - 0.8],
          [0.85, DIE_Y - 0.75],
          [0.85, DIE_Y + 0.75],
          [-0.85, DIE_Y + 0.75],
          [-0.85, DIE_Y - 0.75],
          [-LEAD_W / 2, DIE_Y - 0.8],
        ],
        LEAD_T,
      ),
    );
    const g = mergeAll(parts);
    g.translate(0, y0, FRAME_Z);
    return g;
  }, [y0]);

  const dieZ = FRAME_Z + LEAD_T / 2 + 0.02;
  const wires = useDisposable(() => {
    const top = dieZ + DIE_T;
    const padY = y0 + DIE_Y - 0.38;
    const postY = y0 + DIE_Y - 1.0;
    const z = FRAME_Z + LEAD_T / 2;
    return bondWires(
      [
        { from: [-0.39, padY, top], to: [-1.27, postY, z], loop: 0.3 },
        { from: [0, padY, top], to: [0.35, y0 + DIE_Y - 0.65, z], loop: 0.22 },
        { from: [0.39, padY, top], to: [1.27, postY, z], loop: 0.3 },
      ],
      0.02,
      [0, 0, 1],
    );
  }, [y0, dieZ]);

  const face = usePrintedTop({
    width: W - 0.7,
    height: H - CHAMFER - 0.4,
    lines: [
      { text: p.code, size: 0.62, weight: 700 },
      { text: p.dateCode, size: 0.45, mono: true },
    ],
  });
  const noise = getNoiseTexture();

  return (
    <group>
      <Explode offset={[0, H + 4, 0]}>
        <group position={[0, y0, 0]}>
          <mesh geometry={body}>
            <Material
              preset="epoxyBlack"
              clip
              roughnessMap={noise}
              roughness={0.55}
              color="#1b1b1d"
              cutColor="#2e2e31"
            />
          </mesh>
          <mesh position={[0, (H - CHAMFER - 0.4) / 2 + 0.2, D / 2 + 0.004]}>
            <planeGeometry args={[W - 0.7, H - CHAMFER - 0.4]} />
            <Material
              preset="epoxyBlack"
              clip
              color="#ffffff"
              map={face.map}
              roughness={1}
              roughnessMap={face.roughnessMap}
              bumpMap={face.bumpMap}
              bumpScale={0.5}
              specularIntensity={0.6}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
        </group>
      </Explode>

      <mesh geometry={frame}>
        <Material preset="copper" color="#c98a64" roughness={0.35} />
      </mesh>
      <SiliconDie
        size={DIE}
        thickness={DIE_T}
        kind="hall"
        seed={9}
        position={[0, y0 + DIE_Y, dieZ]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <Anchor name="plate" position={[0, y0 + DIE_Y, dieZ + DIE_T]} />
      <Anchor name="logic" position={[-DIE[0] * 0.38, y0 + DIE_Y + 0.25, dieZ + DIE_T]} />
      <mesh geometry={wires}>
        <Material preset="gold" />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.32} />
      </mesh>

      {p.detecting && (
        <Explode offset={[0, 0, 6]}>
          <Magnet position={[0, y0 + DIE_Y, D / 2 + 4]} />
        </Explode>
      )}
    </group>
  );
}

/** Nickel-plated neodymium disc magnet, 4 × 2 mm, axis along Z, with "N" marked outside. */
function Magnet({ position }: { position: Vec3 }) {
  const geometry = useDisposable(() => {
    const r = 2;
    const h = 2;
    const f = 0.15;
    const profile: [number, number][] = [[0, -h / 2]];
    for (let k = 0; k <= 4; k++) {
      const a = (k / 4) * (Math.PI / 2);
      profile.push([r - f + f * Math.sin(a), -h / 2 + f - f * Math.cos(a)]);
    }
    for (let k = 0; k <= 4; k++) {
      const a = (k / 4) * (Math.PI / 2);
      profile.push([r - f + f * Math.cos(a), h / 2 - f + f * Math.sin(a)]);
    }
    profile.push([0, h / 2]);
    const g = axialLathe(profile, 48);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const mark = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#c0261c';
      fitText(ctx, 'N', w / 2, h / 2 + 4, w * 0.6, h * 0.6, { weight: 800, family: FONT_SANS });
    },
    'N',
    { width: 128, height: 128, fonts: [`800 40px ${FONT_SANS}`] },
  );
  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <Material preset="nickel" color="#d4d4d0" roughness={0.18} />
      </mesh>
      <mesh position={[0, 0, 1.005]}>
        <circleGeometry args={[1, 32]} />
        <Material color="#ffffff" map={mark} transparent alphaTest={0.3} roughness={0.6} />
      </mesh>
      <Anchor name="magnet" position={[1.6, 1.2, 0]} />
    </group>
  );
}
