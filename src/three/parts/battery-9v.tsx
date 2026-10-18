/**
 * 9 V battery (IEC 6LR61 / PP3: 26,5 × 17,5 × 48,5 mm with the snaps, which
 * sit 12,7 mm apart): steel jacket with a printed sleeve, the small round
 * positive snap and the larger hexagonal negative snap. Optional snap clip
 * with red and black leads. Cutaway: the six 1,5 V flat cells stacked in
 * series and the strip that brings the negative end up to the top.
 */
import { useMemo } from 'react';
import { LatheGeometry, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { Lead, lathe, merge, roundedRectShell, roundedRectSlab } from './_power-shared';

export interface Battery9vProps {
  /** Snap clip with red and black leads fitted on the terminals. */
  clip?: boolean;
  type?: 'alcalina' | 'recarregavel';
}

const W = 26.5;
const D = 17.5;
const BODY_H = 46.0;
const CORNER = 2.9;
const PITCH = 12.7;
const POS_X = PITCH / 2;
const NEG_X = -PITCH / 2;
const CELL_H = 6.55;
const CELLS_FROM = 1.6;

export const meta: PartMeta = {
  id: 'battery-9v',
  label: 'Bateria de 9 V',
  category: 'energia',
  summary:
    'Bateria de 9 V com os terminais de pressão (o redondo é o positivo), o clipe com fios e, em corte, as seis células de 1,5 V em série.',
  defaults: { clip: false, type: 'alcalina' },
  controls: {
    clip: { kind: 'toggle', label: 'Clipe com fios' },
    type: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'alcalina', label: 'Alcalina' },
        { value: 'recarregavel', label: 'Recarregável NiMH (8,4 V)' },
      ],
    },
  },
  annotations: (p) => [
    {
      at: [POS_X, BODY_H + 2.5, 0],
      text: 'Positivo (+): terminal redondo, menor',
      exploded: false,
    },
    {
      at: [NEG_X, BODY_H + 2.5, 0],
      text: 'Negativo (−): terminal sextavado, maior',
      exploded: false,
    },
    { at: [0, 0, 0], text: 'Seis células de 1,5 V em série', anchor: 'cells' },
    { at: [0, 0, 0], text: 'Lâmina leva o negativo até o topo', anchor: 'strip' },
    ...(p.clip
      ? [
          {
            at: [0, 0, 0] as Vec3,
            text: 'Clipe: vermelho no +, preto no −',
            anchor: 'clip',
            exploded: false,
          },
        ]
      : []),
  ],
  explode: true,
  cutaway: true,
  describe: (p) => {
    const nimh = p.type === 'recarregavel';
    const base = nimh
      ? 'Bateria recarregável de 9 V (na verdade 8,4 V: sete células de 1,2 V)'
      : 'Bateria alcalina de 9 V (seis células de 1,5 V em série)';
    const clip = p.clip
      ? ', com o clipe encaixado: fio vermelho no positivo e preto no negativo'
      : '';
    return `${base}, 26,5 × 17,5 × 48,5 mm${clip}. O terminal redondo e menor é o positivo; o sextavado, o negativo.`;
  },
  view: [0.55, 0.55, 1.5],
};

export default function Battery9v(props: Battery9vProps) {
  const p = { ...meta.defaults, ...props } as Required<Battery9vProps>;
  const nimh = p.type === 'recarregavel';

  const jacket = useDisposable(
    () => roundedRectShell(W - 0.24, D - 0.24, CORNER - 0.12, 0.35, BODY_H - 0.35, 0.3, 8),
    [],
  );
  const sleeve = useDisposable(
    () => roundedRectShell(W, D, CORNER, 0.7, BODY_H - 0.9, 0.12, 8),
    [],
  );
  const topCap = useDisposable(
    () => roundedRectSlab(W - 0.1, D - 0.1, CORNER, BODY_H - 1.3, BODY_H, 0.45),
    [],
  );
  const bottomCap = useDisposable(() => roundedRectSlab(W - 0.1, D - 0.1, CORNER, 0, 1.0, 0.4), []);
  const insulator = useDisposable(
    () => roundedRectSlab(W - 4.6, D - 5.2, 3.6, BODY_H - 0.05, BODY_H + 0.3, 0.12),
    [],
  );

  const label = useLabel(nimh);

  return (
    <group>
      {/* Steel jacket with crimped top and bottom. */}
      <Explode offset={[W * 1.25, 0, 0]} delay={0.15}>
        <mesh geometry={jacket}>
          <Material preset="nickel" color="#cfcdc7" roughness={0.3} clip cutColor="#8c8e90" />
        </mesh>
        <mesh geometry={sleeve}>
          <Material
            preset="pvc"
            color="#ffffff"
            map={label.color}
            metalness={1}
            metalnessMap={label.metal}
            roughness={0.3}
            clearcoat={0.8}
            clearcoatRoughness={0.15}
            clip
            cutColor="#0d2457"
          />
        </mesh>
        <mesh geometry={bottomCap}>
          <Material preset="nickel" color="#cfcdc7" roughness={0.3} clip cutColor="#8c8e90" />
        </mesh>
      </Explode>

      {/* Stack of flat cells and the negative strip. */}
      <CellStack nimh={nimh} />

      {/* Top cover with the snaps. */}
      <Explode offset={[0, 30, 0]}>
        <mesh geometry={topCap}>
          <Material preset="nickel" color="#cfcdc7" roughness={0.28} clip cutColor="#8c8e90" />
        </mesh>
        <mesh geometry={insulator}>
          <Material preset="absBlack" roughness={0.55} clip cutColor="#2a2a2c" />
        </mesh>
        <group position={[POS_X, BODY_H + 0.3, 0]}>
          <MaleSnap />
        </group>
        <group position={[NEG_X, BODY_H + 0.3, 0]}>
          <FemaleSnap />
        </group>
      </Explode>

      {p.clip && (
        <Explode offset={[0, 46, 0]} delay={0.1}>
          <SnapClip />
        </Explode>
      )}
    </group>
  );
}

/** Positive terminal: a drawn steel stud with a snap bulge. */
function MaleSnap() {
  const geometry = useDisposable(
    () =>
      lathe(
        [
          [0, 0],
          [3.7, 0],
          [3.7, 0.3],
          [2.75, 0.45],
          [2.62, 0.9],
          [2.95, 1.6],
          [2.9, 2.0],
          [2.55, 2.35],
          [1.4, 2.45],
          [1.1, 2.3],
          [0, 2.3],
        ],
        40,
        { angle: 35 },
      ),
    [],
  );
  return (
    <mesh geometry={geometry}>
      <Material preset="nickel" color="#dcdad4" roughness={0.18} />
    </mesh>
  );
}

/** Negative terminal: a hexagonal socket with six spring fingers. */
function FemaleSnap() {
  const base = useDisposable(() => {
    // Hexagonal flange: a 6-sided lathe.
    const g = new LatheGeometry(
      [
        [2.9, 0.0],
        [4.4, 0.0],
        [4.4, 0.55],
        [2.9, 0.55],
        [2.9, 0.0],
      ].map(([r, y]) => new Vector2(r, y)),
      6,
    );
    g.computeVertexNormals();
    return g;
  }, []);
  const fingers = useDisposable(() => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const g = new LatheGeometry(
        [
          [3.15, 0.4],
          [3.45, 0.4],
          [3.25, 1.6],
          [3.0, 2.3],
          [2.7, 2.4],
          [2.85, 1.6],
          [3.15, 0.4],
        ].map(([r, y]) => new Vector2(r, y)),
        5,
        (i / 6) * Math.PI * 2 + 0.1,
        (Math.PI * 2) / 6 - 0.2,
      );
      parts.push(g);
    }
    const merged = merge(parts);
    merged.computeVertexNormals();
    return merged;
  }, []);
  return (
    <group>
      <mesh geometry={base} rotation={[0, Math.PI / 6, 0]}>
        <Material preset="nickel" color="#dcdad4" roughness={0.22} side={2} />
      </mesh>
      <mesh geometry={fingers}>
        <Material preset="nickel" color="#dcdad4" roughness={0.2} side={2} />
      </mesh>
    </group>
  );
}

/** Six (alkaline) or seven (NiMH) flat cells in plastic cups, stacked in series. */
function CellStack({ nimh }: { nimh: boolean }) {
  const count = nimh ? 7 : 6;
  const h = (CELL_H * 6) / count;
  const cellGeometry = useDisposable(
    () => new RoundedBoxGeometry(W - 1.6, h - 0.35, D - 1.7, 2, 0.6),
    [h],
  );
  const plate = useDisposable(() => new RoundedBoxGeometry(W - 2.6, 0.25, D - 2.8, 1, 0.1), []);
  const side = useCanvasTexture(
    (ctx, w, hh) => {
      // From the bottom: zinc anode, separator, MnO₂ cathode, carbon/nickel plate (canvas top = cell top).
      const band = (from: number, to: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, (1 - to) * hh, w, (to - from) * hh);
      };
      if (nimh) {
        band(0, 1, '#2a3a30');
        for (let i = 0; i < 6; i++) band(0.1 + i * 0.14, 0.13 + i * 0.14, '#e8e4da');
      } else {
        band(0, 0.08, '#b8bbbe');
        band(0.08, 0.44, '#8c8f94');
        band(0.44, 0.5, '#ece6d6');
        band(0.5, 0.92, '#26262a');
        band(0.92, 1, '#55585c');
      }
      // Plastic cup edge.
      ctx.fillStyle = 'rgba(40,90,170,0.85)';
      ctx.fillRect(0, hh * 0.0, w * 0.04, hh);
      ctx.fillRect(w * 0.96, 0, w * 0.04, hh);
    },
    `9v-cell|${nimh}`,
    { width: 64, height: 128 },
  );
  const strip: Vec3[] = [
    [NEG_X, BODY_H - 1.0, 0],
    [NEG_X - 2, BODY_H - 1.4, 0],
    [-(W / 2 - 1.0), BODY_H - 2.6, 0],
    [-(W / 2 - 1.0), CELLS_FROM - 0.3, 0],
    [-(W / 2 - 3), CELLS_FROM - 0.3, 0],
  ];
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Explode key={i} offset={[0, i * 3.6, 0]}>
          <mesh geometry={cellGeometry} position={[0, CELLS_FROM + h * (i + 0.5), 0]}>
            <Material color="#ffffff" map={side} roughness={0.6} />
          </mesh>
          <mesh geometry={plate} position={[0, CELLS_FROM + h * (i + 1) - 0.12, 0]}>
            <Material preset="nickel" roughness={0.3} />
          </mesh>
          {i === 2 && <Anchor name="cells" position={[W / 2 - 0.9, CELLS_FROM + h * 2.5, 2]} />}
        </Explode>
      ))}
      {/* Positive contact from the top cell to the round snap. */}
      <Explode offset={[0, (count - 1) * 3.6, 0]}>
        <mesh position={[POS_X, (CELLS_FROM + h * count + BODY_H - 1.2) / 2, 0]}>
          <boxGeometry args={[3.2, BODY_H - 1.2 - CELLS_FROM - h * count, 0.3]} />
          <Material preset="nickel" roughness={0.3} />
        </mesh>
      </Explode>
      <mesh>
        <StripGeometry points={strip} />
        <Material preset="nickel" color="#d2d0ca" roughness={0.3} />
      </mesh>
      <Anchor name="strip" position={[-(W / 2 - 1.0), BODY_H * 0.55, 1]} />
    </group>
  );
}

/** A flat nickel strip (3 mm wide) following a path in the XY plane. */
function StripGeometry({ points }: { points: Vec3[] }) {
  const geometry = useDisposable(() => {
    const parts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i]!;
      const [x1, y1] = points[i + 1]!;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const g = new RoundedBoxGeometry(len + 0.3, 0.3, 3, 1, 0.1);
      g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
      parts.push(g);
    }
    return merge(parts);
  }, [points]);
  return <primitive object={geometry} attach="geometry" />;
}

/** Snap clip: moulded vinyl cap with two snaps, red (+) and black (−) leads. */
function SnapClip() {
  const body = useDisposable(() => new RoundedBoxGeometry(25.5, 5.6, 10.5, 3, 2.2), []);
  // The clip sits on the top cover; the battery snaps disappear inside it.
  const y = BODY_H + 0.5;
  const leads = useMemo(
    () => ({
      red: [
        [POS_X - 1.4, y + 5, 0],
        [POS_X - 1.4, y + 9, 0],
        [POS_X - 6, y + 20, 2],
        [POS_X - 16, y + 25, 6],
        [POS_X - 36, y + 18, 10],
        [POS_X - 44, y + 9, 11],
      ] as Vec3[],
      black: [
        [NEG_X + 1.4, y + 5, 0],
        [NEG_X + 1.4, y + 7, 0],
        [NEG_X - 2, y + 16, 3],
        [NEG_X - 10, y + 19, 7],
        [NEG_X - 24, y + 12, 11],
        [NEG_X - 30, y + 4, 12],
      ] as Vec3[],
    }),
    [y],
  );
  return (
    <group>
      <mesh geometry={body} position={[0, y + 2.8, 0]}>
        <Material preset="absBlack" color="#151517" roughness={0.6} clip cutColor="#202022" />
      </mesh>
      <Lead points={leads.red} radius={0.65} color="#c42a1f" strip={5} bend={4} />
      <Lead points={leads.black} radius={0.65} color="#18181a" strip={5} bend={4} />
      <Anchor name="clip" position={[0, y + 5.6, 0]} />
    </group>
  );
}

/** Sleeve print (U around, 0,5 = front) and the metalness of its silver band. */
function useLabel(nimh: boolean) {
  const base = nimh ? '#16794a' : '#173d86';
  const dark = nimh ? '#0b4a2c' : '#0d2457';
  // Perimeter fractions of the front face and of the snaps.
  const perimeter = 2 * (W - 2 * CORNER) + 2 * (D - 2 * CORNER) + 2 * Math.PI * CORNER;
  const front = (W - 2 * CORNER) / perimeter;
  const color = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.35)');
      g.addColorStop(0.35, 'rgba(0,0,0,0)');
      g.addColorStop(0.65, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Silver band at the top with the polarity marks over the snaps.
      ctx.fillStyle = '#c9ced6';
      ctx.fillRect(0, 0, w, h * 0.16);
      ctx.fillStyle = nimh ? '#bff07a' : '#f2c230';
      ctx.fillRect(0, h * 0.16, w, h * 0.012);
      const ux = (x: number) => (0.5 + x / perimeter) * w;
      ctx.fillStyle = dark;
      fitText(ctx, '+', ux(POS_X), h * 0.08, w * 0.05, h * 0.1, { weight: 800 });
      fitText(ctx, '−', ux(NEG_X), h * 0.08, w * 0.05, h * 0.1, { weight: 800 });
      ctx.fillStyle = '#ffffff';
      const cx = w / 2;
      const span = front * w * 0.96;
      fitText(ctx, '9V', cx, h * 0.42, span, h * 0.24, { weight: 800 });
      fitText(ctx, nimh ? 'RECARREGÁVEL' : 'ALCALINA', cx, h * 0.6, span, h * 0.06, {
        weight: 700,
      });
      fitText(
        ctx,
        nimh ? 'Ni-MH 8,4V 200mAh  6HR61' : '6LR61  9V',
        cx,
        h * 0.7,
        span * 0.8,
        h * 0.04,
        {
          weight: 500,
        },
      );
      // Back face.
      const back = (text: string, y: number, size: number) => {
        fitText(ctx, text, w * 0.02, y, w * 0.3, size, { weight: 500, align: 'left' });
        fitText(ctx, text, w * 0.98, y, w * 0.3, size, { weight: 500, align: 'right' });
      };
      back('Não ligue os terminais em curto.', h * 0.4, h * 0.035);
      back(
        nimh ? 'Use carregador de NiMH.' : 'Não recarregue. Não jogue no fogo.',
        h * 0.47,
        h * 0.035,
      );
      back('Descarte em ponto de coleta.', h * 0.54, h * 0.035);
    },
    `9v-label|${nimh}`,
    { width: 1024, height: 560, fonts: [`800 40px ${FONT_SANS}`, `500 40px ${FONT_SANS}`] },
  );
  const metal = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(0, 0, w, h * 0.16);
    },
    '9v-label-metal',
    { width: 64, height: 256, color: false },
  );
  return { color, metal };
}
