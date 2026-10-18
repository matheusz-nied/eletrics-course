/**
 * Small-signal transistor in a TO-92 package (BC548, BC558, 2N2222 style):
 * half-round epoxy body with the printed flat face, three leads either
 * straight at 1,27 mm or formed to 2,54 mm. Dimensions from JEDEC TO-92
 * (TO-226AA): body 4,6 mm wide, 4,5 mm tall, 3,6 mm deep; leads 0,46 ×
 * 0,38 mm. Inside: the collector lead carries the die, gold wires go to the
 * emitter and base posts.
 */
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import {
  bondWires,
  extrudeOutline,
  filletInset,
  loft,
  mergeAll,
  roundCorners,
  stripOutline,
  type Pt,
} from './_semi-geometry';
import { SiliconDie, usePrintedTop } from './_semi-parts';

type Pinout = 'EBC' | 'CBE' | 'ECB';

export interface TransistorTo92Props {
  /** Part number printed on the flat face. */
  code?: string;
  /** Lead order seen from the flat face, left to right. */
  pinout?: Pinout;
  type?: 'npn' | 'pnp';
  /** Lead spacing below the body: 1,27 mm straight or 2,54 mm formed. */
  pitch?: number;
  dateCode?: string;
  burned?: boolean;
  /** Lead length below the body (mm). */
  leadLength?: number;
}

const W = 4.6;
const H = 4.5;
const D = 3.6;
/** Back radius and distance from the circle centre to the flat face. */
const R = W / 2;
const FLAT = D - R;
/** Circle centre on Z (the body is centred on z = 0). */
const ZC = D / 2 - FLAT;
const LEAD_W = 0.46;
const LEAD_T = 0.38;
const NAMES: Record<string, string> = { E: 'emissor', B: 'base', C: 'coletor' };

export const meta: PartMeta = {
  id: 'transistor-to92',
  label: 'Transistor TO-92',
  category: 'semicondutores',
  summary:
    'Transistor bipolar de baixa potência no encapsulamento TO-92 (como o BC548), com a face plana impressa e, por dentro, o chip sobre o terminal do coletor.',
  defaults: {
    code: 'BC548',
    pinout: 'EBC',
    type: 'npn',
    pitch: 2.54,
    dateCode: 'C23',
    burned: false,
    leadLength: 12,
  },
  controls: {
    code: { kind: 'text', label: 'Código impresso', maxLength: 8 },
    pinout: {
      kind: 'select',
      label: 'Ordem dos terminais',
      options: [
        { value: 'EBC', label: 'E B C (BC548, 2N2222)' },
        { value: 'CBE', label: 'C B E (BC337, BD139)' },
        { value: 'ECB', label: 'E C B' },
      ],
    },
    type: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'npn', label: 'NPN' },
        { value: 'pnp', label: 'PNP' },
      ],
    },
    pitch: {
      kind: 'select',
      label: 'Terminais',
      options: [
        { value: 2.54, label: 'Dobrados (2,54 mm)' },
        { value: 1.27, label: 'Retos (1,27 mm)' },
      ],
    },
    dateCode: { kind: 'text', label: 'Código de data', maxLength: 5 },
    burned: { kind: 'toggle', label: 'Queimado' },
    leadLength: { kind: 'number', label: 'Terminais', min: 4, max: 20, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const pins = pinsOf(p);
    const spread = Number(p.pitch) >= 2 ? 2.54 : 1.27;
    const list = pins.map((letter, i) => ({
      at: [(i - 1) * spread, Math.min(2.5, Number(p.leadLength) * 0.2), 0] as Vec3,
      text: `${letter}: ${NAMES[letter]}`,
      exploded: false,
    }));
    return [
      ...list,
      {
        at: [0, Number(p.leadLength) + H * 0.6, D / 2] as Vec3,
        text: 'Face plana: código e lado de referência',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Chip de silício com as duas junções', anchor: 'die' },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Fios de ouro até o emissor e a base',
        anchor: 'wires',
        exploded: true,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Terminal do coletor segura o chip',
        anchor: 'frame',
        exploded: true,
      },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const pins = pinsOf(p);
    const order = pins.map((l) => `${l} (${NAMES[l]})`).join(', ');
    const type = p.type === 'pnp' ? 'PNP' : 'NPN';
    const flow =
      p.type === 'pnp'
        ? 'a corrente entra pelo emissor e sai pelo coletor'
        : 'a corrente entra pelo coletor e sai pelo emissor';
    return `Transistor ${type} ${String(p.code)} em TO-92${p.burned ? ', queimado' : ''}. Com a face plana de frente e os terminais para baixo, da esquerda para a direita: ${order}. Quando a base é acionada, ${flow}.`;
  },
  view: [0.45, 0.5, 1.6],
};

function pinsOf(p: PartProps): ['E' | 'B' | 'C', 'E' | 'B' | 'C', 'E' | 'B' | 'C'] {
  const order = ['EBC', 'CBE', 'ECB'].includes(String(p.pinout)) ? String(p.pinout) : 'EBC';
  return order.split('') as ['E' | 'B' | 'C', 'E' | 'B' | 'C', 'E' | 'B' | 'C'];
}

/** D-shaped section: half circle at the back, flat face at +Z, inset by `i`. */
function dShape(i: number): Pt[] {
  const r = R - i;
  const zf = ZC + FLAT - i;
  const rc = Math.max(0.45 - i, 0.03);
  const out: Pt[] = [[0, zf]];
  const arc = (cx: number, cz: number, rr: number, a0: number, a1: number, n: number) => {
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n;
      out.push([cx + rr * Math.cos(a), cz + rr * Math.sin(a)]);
    }
  };
  arc(-(r - rc), zf - rc, rc, Math.PI / 2, Math.PI, 5);
  arc(0, ZC, r, Math.PI, Math.PI * 2, 32);
  arc(r - rc, zf - rc, rc, 0, Math.PI / 2, 5);
  return out;
}

export default function TransistorTo92(props: TransistorTo92Props) {
  const p = { ...meta.defaults, ...props } as Required<TransistorTo92Props>;
  const pins = pinsOf(p as unknown as PartProps);
  const spread = p.pitch >= 2 ? 2.54 : 1.27;
  const y0 = Math.max(p.leadLength, 4); // body bottom
  const leadZ = ZC + 0.1;

  const body = useDisposable(() => {
    const top = 0.45;
    const bottom = 0.12;
    const ys = new Set<number>([0, bottom, H - top, H]);
    for (let k = 1; k < 6; k++) {
      ys.add((bottom * k) / 6);
      ys.add(H - top + (top * k) / 6);
    }
    const rings = [...ys]
      .sort((a, b) => a - b)
      .map((y) => {
        const inset =
          (y < bottom ? filletInset(bottom, y) : 0) + (y > H - top ? filletInset(top, H - y) : 0);
        return { y, pts: dShape(inset) };
      });
    return loft(rings, { topGroup: true });
  }, []);

  // External leads (tinned), formed outwards to 2,54 mm when asked.
  const leads = useDisposable(() => {
    const parts = [-1, 0, 1].map((s) => {
      const x0 = s * 1.27;
      const x1 = s * spread;
      const center: Pt[] =
        s !== 0 && spread > 1.5
          ? [
              [x0, y0 + 0.3],
              [x0, y0 - 1.6],
              [x1, y0 - 3.1],
              [x1, 0],
            ]
          : [
              [x0, y0 + 0.3],
              [x0, 0],
            ];
      const g = extrudeOutline(stripOutline(roundCorners(center, 0.7, 6), LEAD_W), LEAD_T, 0.05);
      g.translate(0, 0, leadZ);
      return g;
    });
    return mergeAll(parts);
  }, [spread, leadZ]);

  // Lead frame inside: the collector lead climbs and carries the die paddle.
  const collector = pins.indexOf('C');
  const paddleY = y0 + 2.75;
  const frame = useDisposable(() => {
    const parts = [-1, 0, 1].map((s, i) => {
      const x = s * 1.27;
      if (i === collector) {
        const center: Pt[] =
          s === 0
            ? [
                [0, y0 + 0.25],
                [0, paddleY - 0.4],
              ]
            : [
                [x, y0 + 0.25],
                [x, y0 + 1.4],
                [s * 0.25, paddleY - 0.9],
                [s * 0.25, paddleY - 0.4],
              ];
        return extrudeOutline(stripOutline(roundCorners(center, 0.3, 4), 0.5), LEAD_T);
      }
      // Emitter and base: short posts with a wider bonding pad.
      const top = s === 0 ? y0 + 1.25 : y0 + 1.75;
      const outline: Pt[] = [
        [x - LEAD_W / 2, y0 + 0.25],
        [x + LEAD_W / 2, y0 + 0.25],
        [x + LEAD_W / 2, top - 0.6],
        [x + 0.38, top - 0.45],
        [x + 0.38, top],
        [x - 0.38, top],
        [x - 0.38, top - 0.45],
        [x - LEAD_W / 2, top - 0.6],
      ];
      return extrudeOutline(outline, LEAD_T);
    });
    const paddle = extrudeOutline(
      [
        [-0.65, paddleY - 0.55],
        [0.65, paddleY - 0.55],
        [0.65, paddleY + 0.55],
        [-0.65, paddleY + 0.55],
      ],
      LEAD_T,
    );
    parts.push(paddle);
    const merged = mergeAll(parts);
    merged.translate(0, 0, leadZ);
    return merged;
  }, [collector, leadZ, paddleY]);

  const dieZ = leadZ + LEAD_T / 2 + 0.02;
  const dieT = 0.2;
  const posts = [-1, 0, 1].map((s, i) => ({
    i,
    x: s * 1.27 * 0.82,
    y: (s === 0 ? y0 + 1.25 : y0 + 1.75) - 0.22,
  }));
  const wires = useDisposable(() => {
    const targets = posts.filter((q) => q.i !== collector);
    // Emitter pad on the die's left half, base pad on the right.
    return bondWires(
      targets.map((t, k) => ({
        from: [k === 0 ? -0.12 : 0.12, paddleY + 0.08, dieZ + dieT] as Vec3,
        to: [t.x, t.y, leadZ + LEAD_T / 2] as Vec3,
        loop: 0.5,
      })),
      0.022,
      [0, 0, 1],
    );
  }, [posts, collector, dieZ, paddleY]);

  // Printed flat face: an opaque decal over the planar part of the face.
  const textLines = (() => {
    const m = /^([A-Z]{2})(\d.*)$/.exec(p.code);
    const lines = m ? [m[1]!, m[2]!] : [p.code];
    return [
      ...lines.map((text) => ({ text, size: 0.72, weight: 600 })),
      { text: p.dateCode, size: 0.5, mono: true },
    ];
  })();
  const face = usePrintedTop({
    width: 3.5,
    height: H - 0.9,
    lines: textLines,
    offset: [0, -0.1],
    burned: p.burned,
  });
  const noise = getNoiseTexture();
  const epoxy = p.burned ? '#151312' : '#1b1b1d';

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
              color={epoxy}
              cutColor="#2a2a2c"
            />
          </mesh>
          <mesh position={[0, H / 2 - 0.12, ZC + FLAT + 0.004]}>
            <planeGeometry args={[3.5, H - 0.9]} />
            <Material
              preset="epoxyBlack"
              clip
              color="#ffffff"
              map={face.map}
              roughness={1}
              roughnessMap={face.roughnessMap}
              bumpMap={face.bumpMap}
              bumpScale={0.6}
              specularIntensity={0.6}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
          <Anchor name="body" position={[R * 0.7, H, -0.5]} />
        </group>
      </Explode>

      <mesh geometry={frame}>
        <Material preset="copper" color="#c98a64" roughness={0.35} />
      </mesh>
      <Anchor name="frame" position={[(collector - 1) * 1.27, y0 + 0.5, leadZ + 0.2]} />
      <SiliconDie
        size={[0.55, 0.55]}
        thickness={dieT}
        kind="bjt"
        seed={5}
        position={[0, paddleY, dieZ]}
        rotation={[Math.PI / 2, 0, 0]}
        burned={p.burned}
      />
      <Anchor name="die" position={[0.2, paddleY + 0.25, dieZ + dieT]} />
      <mesh geometry={wires}>
        <Material preset="gold" />
      </mesh>
      <Anchor
        name="wires"
        position={[posts[collector === 0 ? 2 : 0]!.x * 0.7, y0 + 1.9, dieZ + 0.4]}
      />
      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.32} />
      </mesh>
    </group>
  );
}
