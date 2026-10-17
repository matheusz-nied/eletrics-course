/**
 * 12 V lead-acid car battery, European (DIN/EN) box with recessed tapered
 * posts: 60 Ah is 242 × 175 × 175 mm (EN 50342-2 L2; 45 Ah L1 207 mm, 70 Ah
 * L3 278 mm, 95 Ah L5 353 × 175 × 190 mm). Posts per EN 50342-2 / DIN 72311:
 * Ø 19,5 mm (+) and Ø 17,9 mm (−) at the top, taper 1:9. Polypropylene box
 * with hold-down ledges, lid with vent caps or sealed with the charge
 * indicator ("olho mágico"), generic label with the usual safety pictograms.
 * Cutaway: the six 2 V cells with their plate stacks, separators, straps,
 * inter-cell connectors and the electrolyte level.
 */
import { useMemo } from 'react';
import { BoxGeometry, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { formatNumber } from '../core/format';
import { Anchor, Explode, useView } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { roundedPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import { lathe, merge, roundedRectShell, roundedRectSlab, useGeometrySet } from './_power-shared';

type Capacity = 45 | 60 | 70 | 95;

export interface CarBatteryProps {
  /** Capacity (Ah): sets the box length (EN 50342-2 L1, L2, L3, L5). */
  capacity?: Capacity;
  /** Lid: sealed with charge indicator, or with screw vent caps. */
  lid?: 'selada' | 'tampas';
  /** State of charge 0..1: the indicator is green above about 65 %. */
  charge?: number;
  /** Red and black covers over the posts. */
  terminalCovers?: boolean;
  /** Clamps with the car's red (+) and black (−) cables. */
  cablesConnected?: boolean;
}

const MODELS: Record<Capacity, { l: number; h: number; cca: number }> = {
  45: { l: 207, h: 175, cca: 360 },
  60: { l: 242, h: 175, cca: 450 },
  70: { l: 278, h: 175, cca: 550 },
  95: { l: 353, h: 190, cca: 750 },
};

/** Width over the hold-down ledges, and of the walls. */
const WIDTH = 175;
const WALL_D = 163;
const WALL = 3;
const LID_H = 25;
const WELL = 19;
const POST_H = 18;
const POST_Z = 52;
const POST_IN = 27;

export const meta: PartMeta = {
  id: 'car-battery',
  label: 'Bateria automotiva',
  category: 'energia',
  summary:
    'Bateria de carro de 12 V e 60 Ah, com polos cônicos, tampa selada ou com bujões e, em corte, as seis células de placas de chumbo.',
  defaults: {
    capacity: 60,
    lid: 'selada',
    charge: 1,
    terminalCovers: false,
    cablesConnected: false,
  },
  controls: {
    capacity: {
      kind: 'select',
      label: 'Capacidade',
      options: [
        { value: 45, label: '45 Ah' },
        { value: 60, label: '60 Ah' },
        { value: 70, label: '70 Ah' },
        { value: 95, label: '95 Ah' },
      ],
    },
    lid: {
      kind: 'select',
      label: 'Tampa',
      options: [
        { value: 'selada', label: 'Selada, com indicador de carga' },
        { value: 'tampas', label: 'Com bujões (tampas das células)' },
      ],
    },
    charge: { kind: 'number', label: 'Carga', min: 0, max: 1, step: 0.05 },
    terminalCovers: { kind: 'toggle', label: 'Capas dos polos' },
    cablesConnected: { kind: 'toggle', label: 'Cabos ligados' },
  },
  annotations: (p) => {
    const m = modelOf(p);
    const x = m.l / 2 - POST_IN;
    const top = m.h;
    const list = [
      {
        at: [x, top, POST_Z] as Vec3,
        text: 'Polo positivo (+): mais grosso',
        exploded: false,
      },
      {
        at: [-x, top, POST_Z] as Vec3,
        text: 'Polo negativo (−): vai à carroceria',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Seis células de 2 V em série', anchor: 'cells' },
      { at: [0, 0, 0] as Vec3, text: 'Placa positiva: dióxido de chumbo', anchor: 'pos' },
      { at: [0, 0, 0] as Vec3, text: 'Placa negativa: chumbo esponjoso', anchor: 'neg' },
      { at: [0, 0, 0] as Vec3, text: 'Ligação entre células', anchor: 'link' },
      { at: [0, 0, 0] as Vec3, text: 'Eletrólito: ácido sulfúrico diluído', anchor: 'acid' },
    ];
    if (p.lid !== 'tampas') {
      list.push({
        at: [m.l / 2 - 80, top + 1, -12] as Vec3,
        text: 'Indicador: verde = carregada',
        exploded: false,
      } as (typeof list)[number]);
    }
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const m = modelOf(p);
    const cap = Number(p.capacity) as Capacity;
    const charge = Math.min(Math.max(Number(p.charge), 0), 1);
    const lid =
      p.lid === 'tampas'
        ? 'com bujões para completar a água'
        : `selada, com indicador ${eyeState(charge).name}`;
    const cables = p.cablesConnected
      ? ' Cabos ligados: vermelho no positivo, preto no negativo. Para soltar, tire primeiro o negativo; para ligar, o positivo primeiro.'
      : '';
    return `Bateria automotiva de 12 V, ${cap} Ah, ${m.cca} A de partida a frio (CCA), ${m.l} × 175 × ${m.h} mm, ${lid}.${cables}`;
  },
  view: [0.55, 0.65, 1.3],
};

function modelOf(p: PartProps) {
  return MODELS[(Number(p.capacity) as Capacity) in MODELS ? (Number(p.capacity) as Capacity) : 60];
}

/** Colour of the built-in hydrometer ("magic eye") for a state of charge. */
function eyeState(charge: number) {
  if (charge >= 0.65) return { color: '#1fae4b', name: 'verde (carregada)' };
  if (charge >= 0.2) return { color: '#141416', name: 'escuro (precisa recarregar)' };
  return { color: '#e8d36b', name: 'claro (eletrólito baixo: substituir)' };
}

/** Lead post: tapered 1:9, with a collar where it leaves the lid. */
function postProfile(topD: number): [number, number][] {
  const top = topD / 2;
  const base = top + POST_H / 18;
  return [
    [0, -26],
    [8, -26],
    [8, -2],
    [base + 3.2, -2],
    [base + 3.2, 0.6],
    [base + 0.6, 1.4],
    [base, 2],
    [top, POST_H - 0.8],
    [top - 0.8, POST_H],
    [0, POST_H],
  ];
}

export default function CarBattery(props: CarBatteryProps) {
  const p = { ...meta.defaults, ...props } as Required<CarBatteryProps>;
  const m = modelOf(p as unknown as PartProps);
  const L = m.l;
  const H = m.h;
  const boxH = H - LID_H;
  const wellY = H - WELL;
  const postX = L / 2 - POST_IN;
  const { cutaway } = useView();
  const noise = getNoiseTexture();
  const charge = Math.min(Math.max(p.charge, 0), 1);
  const capped = p.lid === 'tampas';

  const geometry = useBoxGeometry(L, H);
  const cells = useCellGeometry(L, boxH);
  const posPost = useDisposable(() => lathe(postProfile(19.5), 40), []);
  const negPost = useDisposable(() => lathe(postProfile(17.9), 40), []);
  const maps = useBatteryMaps(p.capacity, m.cca, capped);
  const cellX = cells.centers;

  return (
    <group>
      {/* Box: walls, floor with hold-down ledges, partitions, ribs, label. */}
      <Explode offset={[0, 0, -WIDTH * 1.25]} delay={0.2}>
        <mesh geometry={geometry.walls}>
          <Material
            preset="absBlack"
            color="#1b1c1e"
            roughness={0.6}
            roughnessMap={noise}
            clip
            cutColor="#2a2b2e"
          />
        </mesh>
        <mesh geometry={geometry.base}>
          <Material preset="absBlack" color="#1b1c1e" roughness={0.62} clip cutColor="#2a2b2e" />
        </mesh>
        <mesh geometry={geometry.partitions}>
          <Material preset="absBlack" color="#202124" roughness={0.6} clip cutColor="#34363a" />
        </mesh>
        <mesh position={[0, boxH * 0.52, WALL_D / 2 + 0.25]}>
          <planeGeometry args={[Math.min(L - 30, 230), boxH * 0.78]} />
          <Material
            color="#ffffff"
            map={maps.front}
            roughness={0.38}
            clearcoat={0.5}
            metalness={0.25}
            transparent
            alphaTest={0.5}
            clip
          />
        </mesh>
      </Explode>

      {/* Plates, separators, straps, connectors and post stems. */}
      <group>
        <mesh geometry={cells.positive}>
          <Material color="#4a2216" roughness={0.9} />
        </mesh>
        <mesh geometry={cells.negative}>
          <Material color="#55585d" roughness={0.75} metalness={0.25} />
        </mesh>
        <mesh geometry={cells.separators}>
          <Material color="#d8d5cc" roughness={0.95} />
        </mesh>
        <mesh geometry={cells.lead}>
          <Material color="#8c8f94" roughness={0.5} metalness={0.75} />
        </mesh>
        <Anchor name="cells" position={[cellX[1] ?? 0, boxH * 0.55, WALL_D / 2 - 6]} />
        <Anchor name="pos" position={[(cellX[2] ?? 0) - 1.2, boxH * 0.3, 72]} />
        <Anchor name="neg" position={[(cellX[3] ?? 0) + 1.2, boxH * 0.42, 72]} />
        <Anchor name="link" position={[((cellX[2] ?? 0) + (cellX[3] ?? 0)) / 2, boxH - 8, 55]} />
        {cutaway && (
          <mesh geometry={cells.electrolyte}>
            <Material
              color="#dfe7e5"
              roughness={0.06}
              transmission={0.95}
              thickness={4}
              ior={1.36}
              specularIntensity={0.55}
              attenuationColor="#d9e6e2"
              attenuationDistance={400}
            />
          </mesh>
        )}
        <Anchor name="acid" position={[cellX[4] ?? 0, boxH - 22, WALL_D / 2 - 4]} />

        {/* Posts with their stems down to the straps. */}
        <group position={[postX, wellY, POST_Z]}>
          <mesh geometry={posPost}>
            <Material color="#9a9ca0" roughness={0.55} metalness={0.7} />
          </mesh>
        </group>
        <group position={[-postX, wellY, POST_Z]}>
          <mesh geometry={negPost}>
            <Material color="#9a9ca0" roughness={0.55} metalness={0.7} />
          </mesh>
        </group>
        {p.terminalCovers && !p.cablesConnected && (
          <>
            <TerminalCover position={[postX, wellY, POST_Z]} color="#c8221b" sign="+" />
            <TerminalCover position={[-postX, wellY, POST_Z]} color="#1c1c1e" sign="−" />
          </>
        )}
        {p.cablesConnected && (
          <>
            <Clamp position={[postX, wellY, POST_Z]} postD={19.5} side={1} cable="#c8221b" />
            <Clamp position={[-postX, wellY, POST_Z]} postD={17.9} side={-1} cable="#1c1c1e" />
          </>
        )}
      </group>

      {/* Lid with wells, polarity marks, indicator or vent caps, and the handle. */}
      <Explode offset={[0, H * 0.7, 0]}>
        <mesh geometry={geometry.lid}>
          <Material
            preset="absBlack"
            color="#232427"
            roughness={0.5}
            roughnessMap={noise}
            clip
            cutColor="#303236"
          />
        </mesh>
        <mesh position={[0, H + 0.05, capped ? 32 : 18]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.min(L * 0.5, 150), 52]} />
          <Material
            color="#ffffff"
            map={maps.top}
            roughness={0.4}
            transparent
            alphaTest={0.5}
            clip
          />
        </mesh>
        {([1, -1] as const).map((side) => (
          <mesh key={side} position={[side * postX, H + 0.06, 14]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[22, 22]} />
            <Material
              color="#ffffff"
              map={side > 0 ? maps.plus : maps.minus}
              roughness={0.5}
              transparent
              alphaTest={0.5}
              clip
            />
          </mesh>
        ))}
        {capped ? (
          cellX.map((x, i) => <VentCap key={i} position={[x, H, -28]} />)
        ) : (
          <MagicEye position={[L / 2 - 80, H, -12]} color={eyeState(charge).color} />
        )}
        <Handle L={L} H={H} boxH={boxH} />
      </Explode>
    </group>
  );
}

/** Box walls, floor with ledges, partitions and lid (geometries in mm). */
function useBoxGeometry(L: number, H: number) {
  const boxH = H - LID_H;
  const walls = useDisposable(() => {
    const shell = roundedRectShell(L - 2, WALL_D, 6, 0, boxH, WALL, 6);
    // Vertical stiffening ribs on the end walls.
    const ribs: BufferGeometry[] = [];
    for (const side of [-1, 1])
      for (const z of [-52, 0, 52]) {
        const g = new RoundedBoxGeometry(4, boxH - 22, 7, 2, 1.2);
        g.translate(side * (L / 2 - 0.5), 9 + (boxH - 22) / 2, z);
        ribs.push(g);
      }
    // Moulded band under the lid.
    const band = roundedRectShell(L + 0.6, WALL_D + 2.6, 7, boxH - 9, boxH, 1.6, 6);
    return merge([shell, band, ...ribs]);
  }, [L, boxH]);
  const base = useDisposable(() => roundedRectSlab(L, WIDTH, 5, 0, 9, 1.2), [L]);
  const partitions = useDisposable(() => {
    const inner = L - 2 - WALL * 2;
    const cell = (inner - 5 * 2) / 6;
    const parts: BufferGeometry[] = [];
    for (let i = 1; i < 6; i++) {
      const g = new BoxGeometry(2, boxH - 9, WALL_D - WALL * 2);
      g.translate(-inner / 2 + i * (cell + 2) - 1, 9 + (boxH - 9) / 2, 0);
      parts.push(g);
    }
    return merge(parts);
  }, [L, boxH]);
  const lid = useDisposable(() => {
    const plate = roundedRectSlab(L + 1.4, WALL_D + 3.4, 7, boxH, H - WELL, 1.2);
    const wellW = POST_IN * 2;
    const middle = new RoundedBoxGeometry(L - wellW * 2 + 6, WELL + 1, WALL_D + 2, 3, 2.5);
    middle.translate(0, H - (WELL + 1) / 2, 0);
    const backDepth = WALL_D + 2 - (WALL_D / 2 + 1 - (POST_Z - wellW / 2 + 2));
    const sides = [-1, 1].map((side) => {
      const g = new RoundedBoxGeometry(wellW + 2, WELL + 1, backDepth, 3, 2.5);
      g.translate(
        side * (L / 2 - wellW / 2 - 0.3),
        H - (WELL + 1) / 2,
        -(WALL_D / 2 + 1) + backDepth / 2,
      );
      return g;
    });
    return merge([plate, middle, ...sides]);
  }, [L, H, boxH]);
  return { walls, base, partitions, lid };
}

/** Plate stacks of the six cells (merged by material). */
function useCellGeometry(L: number, boxH: number) {
  const inner = L - 2 - WALL * 2;
  const cell = (inner - 5 * 2) / 6;
  const centers = useMemo(
    () => Array.from({ length: 6 }, (_, i) => -inner / 2 + cell / 2 + i * (cell + 2)),
    [inner, cell],
  );
  const plateTop = boxH - 30;
  const plateBottom = 20;
  const depth = WALL_D - WALL * 2 - 10;
  const count = Math.max(9, Math.round(cell / 2.45) | 1);
  const pitch = (cell - 1.5) / count;
  const key = [L, boxH];
  const built = useGeometrySet(() => {
    const pos: BufferGeometry[] = [];
    const neg: BufferGeometry[] = [];
    const sep: BufferGeometry[] = [];
    const lead: BufferGeometry[] = [];
    const strapZ = 55;
    const strapY = plateTop + 6;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = new BoxGeometry(w, h, d);
      g.translate(x, y, z);
      return g;
    };
    centers.forEach((cx, ci) => {
      // Odd cells have their positive plates' lugs at the front, even cells at the back.
      const posZ = ci % 2 === 1 ? strapZ : -strapZ;
      for (let k = 0; k < count; k++) {
        const x = cx + (k - (count - 1) / 2) * pitch;
        const positive = k % 2 === 1;
        const h = plateTop - plateBottom;
        (positive ? pos : neg).push(
          box(positive ? 1.7 : 1.35, h, depth, x, plateBottom + h / 2, 0),
        );
        const lugZ = positive ? posZ : -posZ;
        lead.push(box(1.2, 7, 10, x, plateTop + 3, lugZ));
        if (k < count - 1) {
          sep.push(box(0.4, h + 3, depth - 7, x + pitch / 2, plateBottom + h / 2 + 0.5, 0));
        }
      }
      // Straps across the lugs.
      const span = (count - 1) * pitch + 2;
      lead.push(box(span, 5, 12, cx, strapY, posZ));
      lead.push(box(span, 5, 12, cx, strapY, -posZ));
      // Mud space ribs under the plates.
      for (const z of [-40, 40]) lead.push(box(cell - 4, 2, 3, cx, plateBottom - 6, z));
    });
    // Inter-cell connectors through the partitions.
    for (let i = 0; i < 5; i++) {
      const z = i % 2 === 0 ? -strapZ : strapZ;
      const a = centers[i]!;
      const b = centers[i + 1]!;
      lead.push(box(b - a - 4, 9, 10, (a + b) / 2, strapY + 1, z));
    }
    // Post stems from the end straps up into the lid.
    for (const side of [-1, 1]) {
      const x = side * (L / 2 - POST_IN);
      lead.push(
        box(
          15,
          boxH + LID_H - WELL - strapY + 2,
          15,
          x,
          (strapY + boxH + LID_H - WELL) / 2,
          POST_Z,
        ),
      );
    }
    const electrolyte = centers.map((cx) => {
      // Level about 9 mm over the plates.
      const h = plateTop + 9 - 10;
      return box(cell - 0.4, h, WALL_D - WALL * 2 - 0.4, cx, 10 + h / 2, 0);
    });
    return {
      positive: merge(pos),
      negative: merge(neg),
      separators: merge(sep),
      lead: merge(lead),
      electrolyte: merge(electrolyte),
    };
  }, key);
  return { centers, ...built };
}

/** Red or black insulating cover over a post. */
function TerminalCover({ position, color, sign }: { position: Vec3; color: string; sign: string }) {
  const geometry = useDisposable(
    () =>
      lathe(
        [
          [0, 19],
          [12.6, 3],
          [12.6, 0],
          [14.4, 0],
          [14.2, 0.4],
          [13.4, 4],
          [12.4, 17.5],
          [10.6, 20.2],
          [6, 21.5],
          [0, 21.5],
        ],
        40,
        { angle: 35 },
      ),
    [],
  );
  const mark = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      fitText(ctx, sign, w / 2, h / 2 + 4, w * 0.8, h * 0.9, { weight: 800 });
    },
    `cover|${sign}`,
    { width: 128, height: 128, fonts: [`800 40px ${FONT_SANS}`] },
  );
  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <Material preset="rubber" color={color} roughness={0.55} clip />
      </mesh>
      <mesh position={[0, 21.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 9]} />
        <Material color="#ffffff" map={mark} transparent alphaTest={0.5} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Battery clamp (tinned brass) with bolt and nut, and the car's cable. */
function Clamp({
  position,
  postD,
  side,
  cable,
}: {
  position: Vec3;
  postD: number;
  side: 1 | -1;
  cable: string;
}) {
  const r = postD / 2 + POST_H / 18 / 2;
  const ring = useDisposable(
    () =>
      lathe(
        [
          [r + 0.1, 3],
          [r + 4, 3],
          [r + 4.2, 3.6],
          [r + 4.2, 15.4],
          [r + 4, 16],
          [r - 0.4, 16],
          [r + 0.1, 3],
        ],
        40,
        { angle: 35 },
      ),
    [r],
  );
  const cablePath = useDisposable(
    () =>
      tube(
        roundedPath(
          [
            [side * (r + 18), 9.5, 0],
            [side * (r + 34), 9.5, 0],
            [side * (r + 52), 4, -6],
            [side * (r + 60), -30, -14],
            [side * (r + 62), -90, -18],
          ],
          14,
        ),
        5.5,
        { radial: 18 },
      ),
    [r, side],
  );
  return (
    <group position={position}>
      <mesh geometry={ring}>
        <Material preset="tin" color="#c9c6bc" roughness={0.42} />
      </mesh>
      {/* Ears with the clamping bolt, on the back of the ring. */}
      {[-1, 1].map((e) => (
        <mesh key={e} position={[e * 3.2, 9.5, -(r + 7)]}>
          <boxGeometry args={[3.2, 12, 8]} />
          <Material preset="tin" color="#c9c6bc" roughness={0.42} />
        </mesh>
      ))}
      <mesh position={[0, 9.5, -(r + 8)]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[3.9, 3.9, 20, 16]} />
        <Material preset="steel" roughness={0.35} />
      </mesh>
      <mesh position={[11.5, 9.5, -(r + 8)]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6.4, 6.4, 6.5, 6]} />
        <Material preset="zinc" roughness={0.38} />
      </mesh>
      <mesh position={[-11, 9.5, -(r + 8)]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6.2, 6.2, 4.5, 6]} />
        <Material preset="zinc" roughness={0.38} />
      </mesh>
      {/* Tongue and crimped lug. */}
      <mesh position={[side * (r + 9), 9.5, 0]}>
        <boxGeometry args={[14, 7, 12]} />
        <Material preset="tin" color="#c9c6bc" roughness={0.42} />
      </mesh>
      <mesh position={[side * (r + 18), 9.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6.4, 6.4, 12, 20]} />
        <Material preset="copper" color="#d6a77c" roughness={0.35} />
      </mesh>
      <mesh geometry={cablePath}>
        <Material preset="pvc" color={cable} roughness={0.45} />
      </mesh>
    </group>
  );
}

/** Screw vent cap with grip ribs. */
function VentCap({ position }: { position: Vec3 }) {
  const geometry = useDisposable(() => {
    const g = lathe(
      [
        [0, 0],
        [12.5, 0],
        [12.5, 1.6],
        [10.2, 2.2],
        [10.2, 6.6],
        [9.6, 7.2],
        [0, 7.2],
      ],
      72,
      { angle: 35 },
    );
    const position = g.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      if (y < 2.3) continue;
      const x = position.getX(i);
      const z = position.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 9) continue;
      const a = Math.atan2(x, z);
      const k = (r + 0.7 * Math.max(0, Math.cos(a * 12))) / r;
      position.setX(i, x * k);
      position.setZ(i, z * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} position={position}>
      <Material preset="absBlack" color="#2a2b2e" roughness={0.5} clip />
    </mesh>
  );
}

/** Built-in hydrometer: a coloured ball seen through a clear window. */
function MagicEye({ position, color }: { position: Vec3; color: string }) {
  const bezel = useDisposable(
    () =>
      lathe(
        [
          [7.2, 0],
          [11, 0],
          [11, 1.2],
          [9.6, 2.0],
          [7.2, 2.0],
        ],
        48,
        { angle: 35 },
      ),
    [],
  );
  return (
    <group position={position}>
      <mesh geometry={bezel}>
        <Material preset="absBlack" color="#111113" roughness={0.35} clip />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7.3, 40]} />
        <Material color="#0b0b0c" roughness={0.3} clip />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 32]} />
        <Material color={color} roughness={0.25} clearcoat={1} clip />
      </mesh>
      <mesh position={[0, 0.9, 0]} scale={[1, 0.18, 1]}>
        <sphereGeometry args={[7.3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Material
          color="#ffffff"
          roughness={0.04}
          transparent
          opacity={0.25}
          clearcoat={1}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Folding carry handle, pivoting on the end walls. */
function Handle({ L, H, boxH }: { L: number; H: number; boxH: number }) {
  const z = -64;
  const geometry = useDisposable(
    () =>
      tube(
        roundedPath(
          [
            [-(L / 2 + 5.5), boxH - 12, z],
            [-(L / 2 + 5.5), H + 4.5, z],
            [L / 2 + 5.5, H + 4.5, z],
            [L / 2 + 5.5, boxH - 12, z],
          ],
          14,
        ),
        4.2,
        { radial: 14 },
      ),
    [L, H, boxH],
  );
  return (
    <group>
      <mesh geometry={geometry}>
        <Material preset="absBlack" color="#151517" roughness={0.45} clip />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (L / 2 + 2.5), boxH - 12, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[7, 7, 6, 24]} />
          <Material preset="absBlack" color="#1b1c1e" roughness={0.5} clip />
        </mesh>
      ))}
    </group>
  );
}

/** Printed label (front), top sticker and polarity marks. */
function useBatteryMaps(capacity: number, cca: number, capped: boolean) {
  const front = useCanvasTexture(
    (ctx, w, h) => {
      const r = h * 0.05;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, r);
      ctx.clip();
      // Brushed silver background with a dark header and a red stripe.
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#d9dcdf');
      g.addColorStop(0.5, '#eef0f2');
      g.addColorStop(1, '#c9cdd1');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1e2126';
      ctx.fillRect(0, 0, w, h * 0.2);
      ctx.fillStyle = '#c8221b';
      ctx.fillRect(0, h * 0.2, w, h * 0.025);
      ctx.fillStyle = '#ffffff';
      fitText(ctx, 'BATERIA AUTOMOTIVA', w * 0.04, h * 0.1, w * 0.6, h * 0.1, {
        weight: 800,
        align: 'left',
      });
      ctx.fillStyle = '#c8221b';
      ctx.fillRect(w * 0.76, h * 0.03, w * 0.2, h * 0.14);
      ctx.fillStyle = '#ffffff';
      fitText(ctx, '12V', w * 0.86, h * 0.1, w * 0.18, h * 0.12, { weight: 800 });
      // Ratings.
      ctx.fillStyle = '#1e2126';
      fitText(ctx, `${capacity}Ah`, w * 0.05, h * 0.42, w * 0.4, h * 0.22, {
        weight: 800,
        align: 'left',
      });
      fitText(ctx, `${formatNumber(cca, 4)}A`, w * 0.52, h * 0.38, w * 0.3, h * 0.13, {
        weight: 800,
        align: 'left',
      });
      ctx.fillStyle = '#4a4f57';
      fitText(ctx, 'partida a frio (CCA)', w * 0.52, h * 0.48, w * 0.4, h * 0.05, {
        weight: 600,
        align: 'left',
      });
      ctx.fillStyle = '#1e2126';
      fitText(
        ctx,
        capped ? 'COM BUJÕES · VERIFIQUE O NÍVEL DA SOLUÇÃO' : 'SELADA · LIVRE DE MANUTENÇÃO',
        w * 0.05,
        h * 0.6,
        w * 0.9,
        h * 0.05,
        { weight: 700, align: 'left' },
      );
      // Safety pictograms.
      const icons = [drawGoggles, drawNoFlame, drawAcid, drawChild, drawManual, drawExplosion];
      const size = h * 0.14;
      const stepX = size * 1.22;
      icons.forEach((draw, i) => draw(ctx, w * 0.07 + i * stepX, h * 0.77, size / 2));
      drawRecycle(ctx, w * 0.07 + 6 * stepX + size * 0.2, h * 0.77, size / 2);
      drawBin(ctx, w * 0.07 + 7 * stepX + size * 0.2, h * 0.77, size / 2);
      ctx.fillStyle = '#30343a';
      fitText(
        ctx,
        'Contém ácido sulfúrico e chumbo. Gases explosivos: nada de chamas ou faíscas perto da bateria.',
        w * 0.05,
        h * 0.9,
        w * 0.9,
        h * 0.032,
        { weight: 500, align: 'left' },
      );
      fitText(
        ctx,
        'Devolva a bateria usada ao revendedor para reciclagem (Resolução CONAMA 401/2008).',
        w * 0.05,
        h * 0.945,
        w * 0.9,
        h * 0.032,
        { weight: 500, align: 'left' },
      );
      ctx.restore();
    },
    `car-front|${capacity}|${cca}|${capped}`,
    {
      width: 1024,
      height: 640,
      fonts: [`800 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`, `500 40px ${FONT_SANS}`],
    },
  );
  const top = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#e6e8ea';
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, h * 0.12);
      ctx.fill();
      ctx.fillStyle = '#1e2126';
      fitText(
        ctx,
        `12V  ${capacity}Ah  ${formatNumber(cca, 4)}A`,
        w / 2,
        h * 0.3,
        w * 0.86,
        h * 0.26,
        {
          weight: 800,
        },
      );
      ctx.fillStyle = '#4a4f57';
      fitText(
        ctx,
        capped
          ? 'Complete só com água destilada, até a marca.'
          : 'Indicador: verde carregada · escuro recarregar · claro substituir',
        w / 2,
        h * 0.68,
        w * 0.9,
        h * 0.13,
        { weight: 600 },
      );
    },
    `car-top|${capacity}|${cca}|${capped}`,
    { width: 768, height: 266, fonts: [`800 40px ${FONT_SANS}`, `600 40px ${FONT_SANS}`] },
  );
  const sign =
    (text: string, color: string) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      fitText(ctx, text, w / 2, h / 2 + 3, w * 0.7, h * 0.8, { weight: 800 });
    };
  const plus = useCanvasTexture(sign('+', '#c8221b'), 'car-plus', {
    width: 128,
    height: 128,
    fonts: [`800 40px ${FONT_SANS}`],
  });
  const minus = useCanvasTexture(sign('−', '#3a3d42'), 'car-minus', {
    width: 128,
    height: 128,
    fonts: [`800 40px ${FONT_SANS}`],
  });
  return { front, top, plus, minus };
}

type Icon = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => void;

/** Round blue "mandatory" disc or a yellow warning triangle behind an icon. */
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#1f5fae') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#f2c230';
  ctx.strokeStyle = '#1e2126';
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 1.05, y + r * 0.8);
  ctx.lineTo(x - r * 1.05, y + r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

const drawGoggles: Icon = (ctx, x, y, r) => {
  disc(ctx, x, y, r);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.14;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * r * 0.36, y, r * 0.28, r * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x - r * 0.08, y);
  ctx.lineTo(x + r * 0.08, y);
  ctx.stroke();
};

const drawNoFlame: Icon = (ctx, x, y, r) => {
  disc(ctx, x, y, r, '#ffffff');
  ctx.fillStyle = '#1e2126';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.55);
  ctx.quadraticCurveTo(x + r * 0.42, y - r * 0.05, x + r * 0.2, y + r * 0.45);
  ctx.quadraticCurveTo(x, y + r * 0.55, x - r * 0.2, y + r * 0.45);
  ctx.quadraticCurveTo(x - r * 0.42, y - r * 0.05, x, y - r * 0.55);
  ctx.fill();
  ctx.strokeStyle = '#c8221b';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
  ctx.moveTo(x - r * 0.6, y - r * 0.6);
  ctx.lineTo(x + r * 0.6, y + r * 0.6);
  ctx.stroke();
};

const drawAcid: Icon = (ctx, x, y, r) => {
  triangle(ctx, x, y, r);
  ctx.fillStyle = '#1e2126';
  // Two drops falling on a bar (corrosion).
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.25, y - r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(x - r * 0.5, y + r * 0.35, r, r * 0.16);
};

const drawChild: Icon = (ctx, x, y, r) => {
  disc(ctx, x, y, r);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.38, r * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - r * 0.16, y - r * 0.18, r * 0.32, r * 0.42);
  ctx.fillRect(x - r * 0.16, y + r * 0.2, r * 0.12, r * 0.38);
  ctx.fillRect(x + r * 0.04, y + r * 0.2, r * 0.12, r * 0.38);
};

const drawManual: Icon = (ctx, x, y, r) => {
  disc(ctx, x, y, r);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.3);
  ctx.lineTo(x - r * 0.55, y - r * 0.4);
  ctx.lineTo(x - r * 0.55, y + r * 0.35);
  ctx.lineTo(x, y + r * 0.45);
  ctx.lineTo(x + r * 0.55, y + r * 0.35);
  ctx.lineTo(x + r * 0.55, y - r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1f5fae';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.3);
  ctx.lineTo(x, y + r * 0.45);
  ctx.stroke();
};

const drawExplosion: Icon = (ctx, x, y, r) => {
  triangle(ctx, x, y, r);
  ctx.fillStyle = '#1e2126';
  ctx.beginPath();
  const spikes = 8;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r * 0.42 : r * 0.18;
    const px = x + Math.cos(a) * rr;
    const py = y + r * 0.15 + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.fill();
};

const drawRecycle: Icon = (ctx, x, y, r) => {
  ctx.strokeStyle = '#1e2126';
  ctx.lineWidth = r * 0.14;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, a + 0.25, a + 1.75);
    ctx.stroke();
    const tip = a + 1.85;
    ctx.fillStyle = '#1e2126';
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(tip) * r * 0.62, y + Math.sin(tip) * r * 0.62);
    ctx.lineTo(x + Math.cos(tip - 0.35) * r * 0.85, y + Math.sin(tip - 0.35) * r * 0.85);
    ctx.lineTo(x + Math.cos(tip - 0.35) * r * 0.4, y + Math.sin(tip - 0.35) * r * 0.4);
    ctx.fill();
  }
  fitText(ctx, 'Pb', x, y + 1, r * 0.8, r * 0.5, { weight: 800 });
};

const drawBin: Icon = (ctx, x, y, r) => {
  ctx.strokeStyle = '#1e2126';
  ctx.fillStyle = '#1e2126';
  ctx.lineWidth = r * 0.1;
  ctx.strokeRect(x - r * 0.38, y - r * 0.45, r * 0.76, r * 0.95);
  ctx.fillRect(x - r * 0.5, y - r * 0.6, r, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.75, y - r * 0.8);
  ctx.lineTo(x + r * 0.75, y + r * 0.8);
  ctx.moveTo(x + r * 0.75, y - r * 0.8);
  ctx.lineTo(x - r * 0.75, y + r * 0.8);
  ctx.stroke();
};
