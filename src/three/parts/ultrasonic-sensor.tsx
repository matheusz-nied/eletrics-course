/**
 * Ultrasonic distance sensor module (the HC-SR04 type), standing up on its
 * pins: 45 × 20 mm blue board, 1,6 mm. On the front, the two 40 kHz
 * transducers (16 mm diameter, 12 mm tall aluminium cans with the mesh
 * face, 25,8 mm apart; T transmits, R receives), the HC-49/S 4 MHz crystal
 * between them and the 4-pin right-angle 2,54 mm header (VCC, TRIG, ECHO,
 * GND) on the bottom edge. On the back, the microcontroller (SOIC-8), the
 * transmitter driver (SOIC-16) and the quad op-amp of the receiver
 * (SOIC-14) with their chip parts. Mounting holes of 1 mm in the corners.
 * Dimensions from the common module drawings (45 × 20 × 15 mm overall).
 *
 * Built lying flat (front = board top, +Y) and stood up by turning the
 * group 90° about X: board +Y faces the viewer (+Z) and the layout's
 * "down" (+Z on the board) points down. Inside each can: the base, the
 * piezo disc on its post and the aluminium cone, seen in the cutaway.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { CircleGeometry, DoubleSide, type Mesh, type MeshBasicMaterial } from 'three';
import { useReducedMotion } from '../core/motion';
import { Anchor } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { boardPoint, type PcbLayout, type PcbPad, type PcbSilk, type Point } from '../pcb/layout';
import { PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { BakeBlock, BakeLayer, BakePart, BatchRoot } from './_gate-batch';
import { mergeAll } from './_em-geometry';
import { box, ChipParts, CRYSTAL, CrystalHc49, pinRow, Sot23, type ChipItem } from './_mcu-parts';
import IcQfp from './ic-qfp';

export interface UltrasonicSensorProps {
  /** Shows the sound pulses leaving the transmitter. */
  pulse?: boolean;
}

const W = 45;
const H = 20;
const T = 1.6;
const BOARD = { width: W, height: H, thickness: T };

/** Transducer can: radius, height above the board. */
const CAN_R = 8;
const CAN_H = 12;
const TX: Point = [W / 2 - 12.9, H / 2];
const RX: Point = [W / 2 + 12.9, H / 2];
/** Transducer leads, 5 mm apart across the can. */
const CAN_LEAD = 2.5;
const XTAL: Point = [W / 2, 4.6];
const HEADER_Y = 18.6;
const PINS = ['VCC', 'TRIG', 'ECHO', 'GND'].map((label, i) => ({
  label,
  x: W / 2 + pinRow(4)[i]!,
}));
/** The pins run past the bottom edge: the module stands on their tips. */
const PIN_REACH = 6.5;
const PIN_TIP = H / 2 + PIN_REACH;
/** Height of the bent pins above the front face. */
const PIN_UP = 1.27;

const U1: Point = [11.5, 15.6];
const U2: Point = [22.5, 11.4];
const U3: Point = [33.5, 15.6];
const Q1: Point = [6.0, 5.0];
const Q2: Point = [39.0, 5.0];
const CHIPS: { at: Point; deg?: number; size: ChipItem['size']; kind: ChipItem['kind'] }[] = [
  { at: [4.2, 11.0], deg: 90, size: '0603', kind: 'r' },
  { at: [15.0, 5.0], size: '0603', kind: 'c' },
  { at: [15.5, 7.4], size: '0603', kind: 'r' },
  { at: [29.5, 5.0], size: '0603', kind: 'r' },
  { at: [29.5, 7.6], size: '0805', kind: 'c' },
  { at: [41.0, 11.0], deg: 90, size: '0603', kind: 'r' },
  { at: [42.5, 15.5], deg: 90, size: '0603', kind: 'c' },
  { at: [17.6, 16.2], deg: 90, size: '0603', kind: 'r' },
  { at: [27.6, 16.4], deg: 90, size: '0805', kind: 'c' },
  { at: [3.0, 16.0], deg: 90, size: '0805', kind: 'c' },
  { at: [10.0, 3.0], size: '0603', kind: 'r' },
  { at: [35.0, 3.0], size: '0603', kind: 'r' },
];

/** Bottom-side point of a part placed at `at`, turned `deg` (seen from the front). */
function backLocal(at: Point, deg: number, [lx, lz]: readonly [number, number]): Point {
  const a = (deg * Math.PI) / 180;
  const z = -lz;
  return [at[0] + lx * Math.cos(a) + z * Math.sin(a), at[1] - lx * Math.sin(a) + z * Math.cos(a)];
}

function smd(at: Point, deg: number, list: [number, number, number, number][]): PcbPad[] {
  return list.map(([x, z, w, h]) => ({
    at: backLocal(at, deg, [x, z]),
    size: [w, h] as Point,
    rotation: -deg,
    shape: 'rect' as const,
    side: 'bottom' as const,
  }));
}

const soicPads = (pins: number): [number, number, number, number][] =>
  [-1, 1].flatMap((s) =>
    pinRow(pins / 2, 1.27).map((x): [number, number, number, number] => [x, s * 2.7, 0.6, 1.55]),
  );

const text = (
  at: Point,
  value: string,
  size = 1,
  extra: Partial<Extract<PcbSilk, { kind: 'text' }>> = {},
): PcbSilk => ({ kind: 'text', at, text: value, size, ...extra });

const CHIP_PAD = {
  '0402': [0.5, 0.6, 0.6],
  '0603': [0.8, 0.9, 0.95],
  '0805': [0.95, 1.0, 1.4],
  '1206': [1.5, 1.2, 1.8],
  '1812': [2.1, 1.2, 3.4],
} as const;

function buildLayout(): PcbLayout {
  const pads: PcbPad[] = [];
  for (const p of PINS)
    pads.push({
      at: [p.x, HEADER_Y],
      drill: 1.0,
      size: 1.7,
      solder: true,
      ...(p.label === 'GND' ? { net: 'GND' } : {}),
      ...(p.label === 'VCC' ? { shape: 'square' as const } : {}),
    });
  for (const c of [TX, RX])
    for (const s of [-1, 1])
      pads.push({ at: [c[0] + s * CAN_LEAD, c[1]], drill: 0.9, size: 1.7, solder: true });
  for (const s of [-1, 1])
    pads.push({
      at: [XTAL[0] + (s * CRYSTAL.pitch) / 2, XTAL[1]],
      drill: 0.8,
      size: 1.5,
      solder: true,
    });
  pads.push(...smd(U1, 0, soicPads(8)), ...smd(U2, 0, soicPads(16)), ...smd(U3, 0, soicPads(14)));
  for (const q of [Q1, Q2])
    pads.push(
      ...smd(q, 0, [
        [-0.95, -1.05, 0.8, 0.9],
        [0.95, -1.05, 0.8, 0.9],
        [0, 1.05, 0.8, 0.9],
      ]),
    );
  for (const c of CHIPS) {
    const [x, w, h] = CHIP_PAD[c.size];
    pads.push(
      ...smd(c.at, c.deg ?? 0, [
        [-x, 0, w, h],
        [x, 0, w, h],
      ]),
    );
  }

  const front: PcbSilk[] = [
    text([2.7, 4.6], 'T', 1.4),
    text([W - 2.7, 4.6], 'R', 1.4),
    ...PINS.map((p) => text([p.x, 15.4], p.label, 0.62, { rotation: 90 })),
    text([XTAL[0], 7.9], 'Y1', 0.7),
    { kind: 'circle', at: TX, r: CAN_R + 0.35, width: 0.15 },
    { kind: 'circle', at: RX, r: CAN_R + 0.35, width: 0.15 },
  ];
  const back: PcbSilk[] = [
    ...[
      [U1, 'U1'],
      [U2, 'U2'],
      [U3, 'U3'],
    ].map(([at, label]) =>
      text([(at as Point)[0], (at as Point)[1] - 4.0], label as string, 0.7, { side: 'bottom' }),
    ),
    ...PINS.map((p) => text([p.x, 16.4], p.label, 0.55, { rotation: 90, side: 'bottom' })),
    text([TX[0], 2.0], 'T', 1.0, { side: 'bottom' }),
    text([RX[0], 2.0], 'R', 1.0, { side: 'bottom' }),
  ];

  return {
    width: W,
    height: H,
    thickness: T,
    corner: 0.5,
    copper: 'both',
    mask: 'azul',
    finish: 'hasl',
    pads,
    holes: [
      { at: [1.5, 1.5], drill: 1.0 },
      { at: [W - 1.5, 1.5], drill: 1.0 },
      { at: [1.5, H - 1.5], drill: 1.0 },
      { at: [W - 1.5, H - 1.5], drill: 1.0 },
    ],
    traces: [
      // Front: crystal to the microcontroller side, transducers to the back circuits.
      {
        points: [
          [XTAL[0] - CRYSTAL.pitch / 2, XTAL[1]],
          [18.4, 7.0],
          [18.4, 12.6],
        ],
        width: 0.3,
      },
      {
        points: [
          [XTAL[0] + CRYSTAL.pitch / 2, XTAL[1]],
          [26.6, 7.0],
          [26.6, 12.6],
        ],
        width: 0.3,
      },
      // Back.
      {
        points: [[PINS[1]!.x, HEADER_Y], backLocal(U1, 0, [1.905, 2.7])],
        width: 0.3,
        side: 'bottom',
      },
      {
        points: [[PINS[2]!.x, HEADER_Y], [23.77, 16.2], backLocal(U2, 0, [0.635, -2.7])],
        width: 0.3,
        side: 'bottom',
      },
      {
        points: [
          [PINS[0]!.x, HEADER_Y],
          [16.2, 18.4],
          [16.2, 9.2],
          backLocal(U2, 0, [-4.445, -2.7]),
        ],
        width: 0.5,
        side: 'bottom',
      },
      {
        points: [[TX[0] + CAN_LEAD, TX[1]], [16.6, 10.0], backLocal(U2, 0, [-4.445, 2.7])],
        width: 0.4,
        side: 'bottom',
      },
      {
        points: [[RX[0] - CAN_LEAD, RX[1]], backLocal(U3, 0, [-3.81, 2.7])],
        width: 0.3,
        side: 'bottom',
      },
      {
        points: [
          backLocal(U1, 0, [-1.905, -2.7]),
          [XTAL[0] - CRYSTAL.pitch / 2, 7.4],
          [XTAL[0] - CRYSTAL.pitch / 2, XTAL[1]],
        ],
        width: 0.25,
        side: 'bottom',
      },
    ],
    pours: [
      {
        outline: [
          [0.5, 0.5],
          [W - 0.5, 0.5],
          [W - 0.5, H - 0.5],
          [0.5, H - 0.5],
        ],
        side: 'bottom',
        net: 'GND',
        clearance: 0.4,
      },
    ],
    silk: [...front, ...back],
  };
}

const LAYOUT = buildLayout();

/** Layout point → BatchRoot space (board lying flat, back face at y = 0). */
const on = ([x, y]: Point, up = 0): Vec3 => {
  const [px, py, pz] = boardPoint(BOARD, [x, y]);
  return [px, py + up, pz];
};
/** On the back, hanging: the part's top faces away from the board. */
const behind = ([x, y]: Point, deg = 0) => {
  const [px, , pz] = boardPoint(BOARD, [x, y], 'bottom');
  return { position: [px, 0, pz] as Vec3, rotation: [Math.PI, (-deg * Math.PI) / 180, 0] as Vec3 };
};
const back = ([x, y]: Point, down = 0): Vec3 => {
  const [px, , pz] = boardPoint(BOARD, [x, y], 'bottom');
  return [px, -down, pz];
};

/** Chip parts on the back: the BakePart turns them over (z flips). */
const BACK_CHIPS: ChipItem[] = CHIPS.map((c) => {
  const [x, , z] = back(c.at);
  return { at: [x, -z], rot: c.deg ?? 0, size: c.size, kind: c.kind };
});

/** Cut along the transducers' axes (board z = 0), keeping the lower half. */
const CUT_THROUGH_WORLD_Y = PIN_TIP - (TX[1] - H / 2);

const resolve = (props: PartProps) => ({ pulse: { ...meta.defaults, ...props }.pulse === true });

export const meta: PartMeta = {
  id: 'ultrasonic-sensor',
  label: 'Sensor ultrassônico',
  category: 'sensores',
  summary:
    'Módulo sensor de distância por ultrassom (tipo HC-SR04): o transmissor emite pulsos de 40 kHz, o receptor capta o eco e o pino ECHO devolve o tempo de ida e volta do som.',
  defaults: { pulse: false },
  controls: { pulse: { kind: 'toggle', label: 'Mostrar o pulso de som' } },
  annotations: () => {
    const pin = (anchor: string, text: string, exploded?: boolean): PartAnnotation => ({
      at: [0, 0, 0],
      anchor,
      text,
      ...(exploded === undefined ? {} : { exploded }),
    });
    return [
      pin(
        'us-transmissor',
        'Transmissor (T): emite uma rajada de ultrassom de 40 kHz, alto demais para o nosso ouvido',
      ),
      pin('us-receptor', 'Receptor (R): capta o eco que volta depois de bater num objeto'),
      pin(
        'us-pinos',
        'Pinos: VCC (5 V), TRIG (um pulso de 10 µs dispara a medição), ECHO (fica em nível alto pelo tempo de ida e volta do som) e GND',
      ),
      pin('us-cristal', 'Cristal de 4 MHz: o relógio que marca o tempo do circuito'),
      pin(
        'us-ci',
        'Atrás da placa: o microcontrolador, o circuito que gera a rajada do transmissor e o amplificador do eco',
        true,
      ),
    ];
  },
  explode: true,
  cutaway: true,
  cut: { normal: [0, -1, 0], through: [0, CUT_THROUGH_WORLD_Y, 0] },
  describe: (props) => {
    const p = resolve(props);
    return [
      'Módulo sensor ultrassônico (45 × 20 mm), placa azul em pé sobre os quatro pinos VCC, TRIG, ECHO e GND. Na frente, dois cilindros de alumínio com tela: o transmissor (T) à esquerda e o receptor (R) à direita, com um cristal metálico entre eles. Dentro de cada cilindro há um disco piezoelétrico com um cone, que vibra a 40 kHz. Atrás, três circuitos integrados.',
      'A distância é a metade do tempo do eco vezes a velocidade do som (cerca de 343 m/s): de 2 cm a uns 4 m.',
      p.pulse ? 'Animação: ondas de som saindo do transmissor.' : '',
    ]
      .filter(Boolean)
      .join(' ');
  },
  view: [0.5, 0.55, 1.1],
  animated: (props) => resolve(props).pulse,
};

export default function UltrasonicSensor(props: UltrasonicSensorProps) {
  const p = resolve(props as PartProps);
  return (
    <group position={[0, PIN_TIP, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <BatchRoot blocks={['all']} cutNormal={[0, 0, 1]} cutThrough={[0, 0, TX[1] - H / 2]}>
        <PrintedCircuitBoard layout={LAYOUT} />

        {/* Transducers. */}
        <BakeLayer
          lift={[0, 26, 0]}
          delay={0.1}
          extras={
            <>
              <Anchor name="us-transmissor" position={on([TX[0], TX[1] - 3.5], CAN_H)} />
              <Anchor name="us-receptor" position={on([RX[0], RX[1] - 3.5], CAN_H)} />
            </>
          }
        >
          <BakeBlock id="all">
            <BakePart position={on(TX)}>
              <Transducer />
            </BakePart>
            <BakePart position={on(RX)}>
              <Transducer />
            </BakePart>
          </BakeBlock>
        </BakeLayer>

        {/* Crystal and header. */}
        <BakeLayer
          lift={[0, 12, 0]}
          extras={
            <>
              <Anchor name="us-cristal" position={on(XTAL, 3.6)} />
              <Anchor name="us-pinos" position={on([W / 2, H + 3.5], PIN_UP)} />
            </>
          }
        >
          <BakeBlock id="all">
            <BakePart position={on(XTAL)}>
              <CrystalHc49 label="4.000" />
            </BakePart>
            <BakePart position={on([W / 2, HEADER_Y])}>
              <RightAngleHeader />
            </BakePart>
          </BakeBlock>
        </BakeLayer>

        {/* Back: integrated circuits and chip parts. */}
        <BakeLayer lift={[0, -14, 0]} extras={<Anchor name="us-ci" position={back(U2, 1.8)} />}>
          <BakeBlock id="all">
            <BakePart {...behind(U1)}>
              <IcQfp package="soic" pins={8} code="MCU" dateCode="2318" />
            </BakePart>
            <BakePart {...behind(U2)}>
              <IcQfp package="soic" pins={16} code="TX DRV" dateCode="2318" />
            </BakePart>
            <BakePart {...behind(U3)}>
              <IcQfp package="soic" pins={14} code="RX AMP" dateCode="2318" />
            </BakePart>
            <BakePart {...behind(Q1)}>
              <Sot23 />
            </BakePart>
            <BakePart {...behind(Q2)}>
              <Sot23 />
            </BakePart>
            <BakePart position={[0, 0, 0]} rotation={[Math.PI, 0, 0]}>
              <ChipParts items={BACK_CHIPS} />
            </BakePart>
          </BakeBlock>
        </BakeLayer>
      </BatchRoot>
      {p.pulse && <SoundRings position={on(TX, CAN_H + 0.5)} />}
    </group>
  );
}

/** Woven wire mesh, tiled over the face of the cans. */
function useMeshTexture() {
  return useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#1c1d1f';
      ctx.fillRect(0, 0, w, h);
      const n = 4;
      const s = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const over = (i + j) % 2 === 0;
          // Horizontal wire segment, lit on top.
          const gh = ctx.createLinearGradient(0, j * s + s * 0.2, 0, j * s + s * 0.8);
          gh.addColorStop(0, over ? '#c7c9cc' : '#7d8084');
          gh.addColorStop(1, over ? '#5e6165' : '#3c3e42');
          ctx.fillStyle = gh;
          ctx.fillRect(i * s, j * s + s * 0.22, s, s * 0.56);
          // Vertical wire segment.
          const gv = ctx.createLinearGradient(i * s + s * 0.2, 0, i * s + s * 0.8, 0);
          gv.addColorStop(0, over ? '#7d8084' : '#c7c9cc');
          gv.addColorStop(1, over ? '#3c3e42' : '#5e6165');
          ctx.fillStyle = gv;
          if (over) {
            ctx.fillRect(i * s + s * 0.22, j * s, s * 0.56, s * 0.22);
            ctx.fillRect(i * s + s * 0.22, j * s + s * 0.78, s * 0.56, s * 0.22);
          } else {
            ctx.fillRect(i * s + s * 0.22, j * s, s * 0.56, s);
          }
        }
      }
    },
    'ultrasonic-mesh',
    { width: 128, height: 128, repeat: true },
  );
}

/**
 * 40 kHz ultrasonic transducer, axis along +Y, base on the board: aluminium
 * can with a rolled lip, wire mesh face, and inside the plastic base, the
 * post, the piezo disc and the aluminium cone.
 */
function Transducer() {
  const noise = getNoiseTexture();
  const mesh = useMeshTexture();
  const can = useDisposable(
    () =>
      axialLathe(
        [
          [CAN_R - 0.35, 0.6],
          [CAN_R, 0.6],
          [CAN_R, CAN_H - 0.4],
          [CAN_R - 0.1, CAN_H - 0.1],
          [CAN_R - 0.35, CAN_H],
          [CAN_R - 0.75, CAN_H - 0.1],
          [CAN_R - 0.85, CAN_H - 0.35],
          [CAN_R - 0.35, CAN_H - 0.6],
          [CAN_R - 0.35, 0.6],
        ],
        56,
      ),
    [],
  );
  const base = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0],
          [CAN_R - 0.3, 0],
          [CAN_R - 0.3, 1.6],
          [CAN_R - 0.4, 1.8],
          [0, 1.8],
        ],
        40,
      ),
    [],
  );
  const face = useDisposable(() => {
    const g = new CircleGeometry(CAN_R - 0.4, 48)
      .rotateX(-Math.PI / 2)
      .translate(0, CAN_H - 0.55, 0);
    const uv = g.attributes.uv!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 22, uv.getY(i) * 22);
    uv.needsUpdate = true;
    return g;
  }, []);
  const piezo = useDisposable(
    () =>
      mergeAll([
        // Post.
        axialLathe(
          [
            [0, 1.8],
            [1.1, 1.8],
            [1.1, 5.0],
            [0, 5.0],
          ],
          20,
        ),
        // Ceramic disc under the brass one.
        axialLathe(
          [
            [0, 5.0],
            [3.6, 5.0],
            [3.6, 5.3],
            [0, 5.3],
          ],
          32,
        ),
      ]),
    [],
  );
  const brass = useDisposable(
    () =>
      axialLathe(
        [
          [0, 5.3],
          [5.0, 5.3],
          [5.0, 5.55],
          [0, 5.55],
        ],
        40,
      ),
    [],
  );
  const cone = useDisposable(
    () =>
      axialLathe(
        [
          [0.6, 5.55],
          [5.6, 9.6],
          [5.6, 9.8],
          [0.45, 5.8],
          [0.6, 5.55],
        ],
        40,
      ),
    [],
  );
  const leads = useDisposable(
    () => mergeAll([-1, 1].map((s) => box(0.6, 3.6, 0.6, s * CAN_LEAD, -3.2, 0))),
    [],
  );
  return (
    <group>
      <mesh geometry={can}>
        <Material preset="aluminum" roughness={0.32} roughnessMap={noise} clip cutColor="#9a9da1" />
      </mesh>
      <mesh geometry={base}>
        <Material preset="absBlack" roughness={0.6} clip cutColor="#18181a" />
      </mesh>
      <mesh geometry={face}>
        <Material color="#ffffff" map={mesh} roughness={0.5} metalness={0.6} clip />
      </mesh>
      <mesh geometry={piezo}>
        <Material color="#d9d4c6" roughness={0.7} clip cutColor="#bdb7a8" />
      </mesh>
      <mesh geometry={brass}>
        <Material preset="brass" clip />
      </mesh>
      <mesh geometry={cone}>
        <Material preset="aluminum" roughness={0.4} clip cutColor="#a3a6aa" />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" />
      </mesh>
    </group>
  );
}

/**
 * 4-pin right-angle header lying on the front face: the pins come through
 * the board, bend 90° and run past the bottom edge (+Z), held by the black
 * spacer on the edge.
 */
function RightAngleHeader() {
  const noise = getNoiseTexture();
  const spacerZ = H - HEADER_Y - 0.2;
  const plastic = useDisposable(() => box(10.16, 2.54, 2.5, 0, T, spacerZ), []);
  const pins = useDisposable(
    () =>
      mergeAll(
        pinRow(4).flatMap((x) => [
          // Through the board and up to the bend.
          box(0.64, T + PIN_UP + 0.32 + 1.2, 0.64, x, -1.2, 0),
          // Along the board and past the edge.
          box(
            0.64,
            0.64,
            PIN_TIP - (HEADER_Y - H / 2),
            x,
            T + PIN_UP - 0.32,
            (PIN_TIP - (HEADER_Y - H / 2)) / 2,
          ),
        ]),
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={plastic}>
        <Material preset="pbtBlack" roughness={0.5} roughnessMap={noise} clip cutColor="#121214" />
      </mesh>
      <mesh geometry={pins}>
        <Material preset="gold" />
      </mesh>
    </group>
  );
}

const RINGS = 4;

/** Sound pulses leaving the transmitter: rings that grow and fade as they travel. */
function SoundRings({ position }: { position: Vec3 }) {
  const reduced = useReducedMotion();
  const rings = useRef<(Mesh | null)[]>([]);
  const time = useRef(0);
  useFrame((_, dt) => {
    if (!reduced) time.current += Math.min(dt, 0.05);
    rings.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = (time.current * 0.55 + i / RINGS) % 1;
      const r = CAN_R - 1.5 + 9 * s;
      mesh.scale.set(r, r, r);
      mesh.position.y = 26 * s;
      (mesh.material as MeshBasicMaterial).opacity = 0.6 * (1 - s) * Math.min(s * 8, 1);
    });
  });
  return (
    <group position={position}>
      {Array.from({ length: RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            rings.current[i] = m;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={5}
        >
          <ringGeometry args={[0.9, 1, 64]} />
          <meshBasicMaterial
            color="#4f9be0"
            transparent
            opacity={0}
            depthWrite={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
