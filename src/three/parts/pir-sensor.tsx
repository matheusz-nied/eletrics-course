/**
 * PIR motion sensor module (the HC-SR501 type): 32 × 24 mm green board,
 * 1,6 mm, two 2 mm mounting holes on the short ends. On top, the white
 * Fresnel dome (23 mm diameter, on its 24 × 24 mm square base) over the
 * pyroelectric sensor (TO-5 can, 9,2 mm diameter, with the 5 × 4 mm
 * infrared window). Underneath, the signal processor (SOIC-16), the 3,3 V
 * regulator (SOT-23), the two adjustment trimmers (sensitivity, 3 to 7 m;
 * hold time, about 3 s to 5 min), the retrigger jumper (H/L) and the three
 * 2,54 mm pins (VCC, OUT, GND) pointing down. Dimensions from the common
 * module drawings.
 *
 * The real module has no LED: `detecting` is not modelled. `flip` turns the
 * module over to show the adjustments.
 */
import { BufferGeometry, Float32BufferAttribute, Path, Shape, Vector3 } from 'three';
import { Anchor } from '../core/view';
import { formatNumber } from '../core/format';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { boardPoint, type PcbLayout, type PcbPad, type PcbSilk, type Point } from '../pcb/layout';
import { PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { BakeBlock, BakeLayer, BakePart, BatchRoot } from './_gate-batch';
import { extrudeUp, invertGeometry, mergeAll } from './_em-geometry';
import { box, ChipParts, pinRow, SmaDiode, Sot23, type ChipItem } from './_mcu-parts';
import IcQfp from './ic-qfp';
import PinHeader from './pin-header';
import Trimpot from './trimpot';

export interface PirSensorProps {
  /** Detection range set on the sensitivity trimmer (m), 3 to 7. */
  sensitivity?: number;
  /** Hold time set on the time trimmer (s), 3 to 300. */
  holdTime?: number;
  /** Jumper on H (retrigger: the time restarts while there is movement) or L (single trigger). */
  retrigger?: boolean;
  /** Turned over, components up (to see the adjustments). */
  flip?: boolean;
}

const W = 32;
const H = 24;
const T = 1.6;
const BOARD = { width: W, height: H, thickness: T };

/** Dome: base plate, skirt and hemisphere (mm). */
const PLATE = { size: 24, t: 2.0 };
const DOME_R = 11.5;
const SKIRT = 1.0;
const DOME_TOP = PLATE.t + SKIRT + DOME_R;
/** Pins below the board: 2,5 mm spacer + 6 mm. */
const PIN_DROP = 8.5;

const SENSOR: Point = [W / 2, H / 2];
const PINS = [
  { label: 'VCC', x: W / 2 - 2.54 },
  { label: 'OUT', x: W / 2 },
  { label: 'GND', x: W / 2 + 2.54 },
];
const PIN_Y = 21.6;
const JUMPER: Point = [6.5, 4.0];
const TRIM_SENS: Point = [19.8, 5.8];
const TRIM_TIME: Point = [26.8, 5.8];
const IC: Point = [12.5, 12.5];
const REG: Point = [23.0, 13.5];
const DIODE: Point = [25.0, 18.0];
const CHIPS: { at: Point; deg?: number; size: ChipItem['size']; kind: ChipItem['kind'] }[] = [
  { at: [6.0, 18.0], size: '0805', kind: 'r' },
  { at: [9.0, 18.5], deg: 90, size: '0805', kind: 'c' },
  { at: [20.0, 17.5], deg: 90, size: '0805', kind: 'c' },
  { at: [20.0, 11.0], size: '0603', kind: 'r' },
  { at: [6.0, 8.5], size: '0603', kind: 'r' },
  { at: [27.0, 21.5], size: '1206', kind: 'c' },
  { at: [10.0, 21.5], size: '0603', kind: 'r' },
  { at: [17.5, 18.5], size: '0603', kind: 'c' },
];

const clamp = (v: number, a: number, b: number) =>
  Math.min(Math.max(Number.isFinite(v) ? v : a, a), b);

const resolve = (props: PartProps) => {
  const p = { ...meta.defaults, ...props };
  return {
    sensitivity: clamp(Number(p.sensitivity), 3, 7),
    holdTime: clamp(Number(p.holdTime), 3, 300),
    retrigger: p.retrigger !== false,
    flip: p.flip === true,
  };
};

/** Bottom-side pad of a part placed at `at`, turned `deg` (seen from the top). */
function bottomLocal(at: Point, deg: number, [lx, lz]: readonly [number, number]): Point {
  const a = (deg * Math.PI) / 180;
  const z = -lz;
  return [at[0] + lx * Math.cos(a) + z * Math.sin(a), at[1] - lx * Math.sin(a) + z * Math.cos(a)];
}

function smd(at: Point, deg: number, list: [number, number, number, number][]): PcbPad[] {
  return list.map(([x, z, w, h]) => ({
    at: bottomLocal(at, deg, [x, z]),
    size: [w, h] as Point,
    rotation: -deg,
    shape: 'rect' as const,
  }));
}

const text = (
  at: Point,
  value: string,
  size = 1,
  align: 'left' | 'center' | 'right' = 'center',
): PcbSilk => ({
  kind: 'text',
  at,
  text: value,
  size,
  align,
});

function buildLayout(): PcbLayout {
  const pads: PcbPad[] = [];
  for (const p of PINS)
    pads.push({
      at: [p.x, PIN_Y],
      drill: 1.0,
      size: 1.7,
      ...(p.label === 'GND' ? { net: 'GND' } : {}),
    });
  for (const x of pinRow(3)) pads.push({ at: [JUMPER[0] + x, JUMPER[1]], drill: 1.0, size: 1.7 });
  for (const t of [TRIM_SENS, TRIM_TIME])
    for (const p of [
      [-2.5, 2.5],
      [0, -2.5],
      [2.5, 2.5],
    ] as const)
      pads.push({ at: bottomLocal(t, 0, p), drill: 1.0, size: [1.8, 1.4], shape: 'oval' });
  for (const a of [Math.PI, 0, -Math.PI / 2])
    pads.push({
      at: [SENSOR[0] + 2.54 * Math.cos(a), SENSOR[1] - 2.54 * Math.sin(a)],
      drill: 0.7,
      size: 1.3,
    });
  pads.push(
    ...smd(
      IC,
      0,
      [-1, 1].flatMap((s) =>
        pinRow(8, 1.27).map((x): [number, number, number, number] => [x, s * 2.7, 0.6, 1.55]),
      ),
    ),
  );
  pads.push(
    ...smd(REG, 0, [
      [-0.95, -1.05, 0.8, 0.9],
      [0.95, -1.05, 0.8, 0.9],
      [0, 1.05, 0.8, 0.9],
    ]),
  );
  pads.push(
    ...smd(DIODE, 0, [
      [-2.1, 0, 1.8, 1.8],
      [2.1, 0, 1.8, 1.8],
    ]),
  );
  const CHIP_PAD = {
    '0402': [0.5, 0.6, 0.6],
    '0603': [0.8, 0.9, 0.95],
    '0805': [0.95, 1.0, 1.4],
    '1206': [1.5, 1.2, 1.8],
    '1812': [2.1, 1.2, 3.4],
  } as const;
  for (const c of CHIPS) {
    const [x, w, h] = CHIP_PAD[c.size];
    pads.push(
      ...smd(c.at, c.deg ?? 0, [
        [-x, 0, w, h],
        [x, 0, w, h],
      ]),
    );
  }

  const silk: PcbSilk[] = [
    ...PINS.map((p) => text([p.x, PIN_Y - 2.3], p.label, 0.85)),
    text([JUMPER[0] - 2.54, JUMPER[1] + 2.2], 'L', 1.0),
    text([JUMPER[0] + 2.54, JUMPER[1] + 2.2], 'H', 1.0),
    text([JUMPER[0], JUMPER[1] + 2.2], 'MODO', 0.6),
    text([TRIM_SENS[0], TRIM_SENS[1] + 4.6], 'SENSIB.', 0.85),
    text([TRIM_TIME[0], TRIM_TIME[1] + 4.6], 'TEMPO', 0.85),
    text([IC[0], IC[1] + 4.3], 'U1', 0.8),
    text([REG[0], REG[1] + 2.2], 'U2', 0.7),
    { kind: 'rect', at: IC, size: [10.6, 4.6], width: 0.12 },
  ];

  return {
    width: W,
    height: H,
    thickness: T,
    corner: 0.6,
    copper: 'both',
    mask: 'verde',
    finish: 'hasl',
    componentSide: 'bottom',
    pads,
    holes: [
      { at: [2.0, 12], drill: 2.0 },
      { at: [30.0, 12], drill: 2.0 },
    ],
    traces: [
      {
        points: [
          [PINS[0]!.x, PIN_Y],
          [PINS[0]!.x, 18.8],
          [REG[0] - 0.95, 15.6],
          bottomLocal(REG, 0, [-0.95, -1.05]),
        ],
        width: 0.5,
      },
      { points: [[PINS[1]!.x, PIN_Y], [16, 17.8], bottomLocal(IC, 0, [1.905, -2.7])], width: 0.3 },
      {
        points: [
          bottomLocal(TRIM_SENS, 0, [0, -2.5]),
          [19.8, 9.6],
          bottomLocal(IC, 0, [4.445, 2.7]),
        ],
        width: 0.3,
      },
      {
        points: [
          bottomLocal(TRIM_TIME, 0, [0, -2.5]),
          [26.8, 10.2],
          [18.6, 10.2],
          bottomLocal(IC, 0, [3.175, 2.7]),
        ],
        width: 0.3,
      },
      {
        points: [[JUMPER[0], JUMPER[1]], [8.2, 7.4], bottomLocal(IC, 0, [-3.175, 2.7])],
        width: 0.3,
      },
      {
        points: [[SENSOR[0] + 2.54, SENSOR[1]], [19.0, 14.0], bottomLocal(IC, 0, [4.445, -2.7])],
        width: 0.3,
        side: 'top',
      },
    ],
    pours: [
      {
        outline: [
          [0.6, 0.6],
          [W - 0.6, 0.6],
          [W - 0.6, H - 0.6],
          [0.6, H - 0.6],
        ],
        side: 'top',
        net: 'GND',
        clearance: 0.4,
      },
    ],
    silk,
  };
}

const LAYOUT = buildLayout();

const on = ([x, y]: Point, up = 0): Vec3 => {
  const [px, py, pz] = boardPoint(BOARD, [x, y]);
  return [px, py + up, pz];
};
/** Under the board, hanging down: the part's top faces down. */
const below = ([x, y]: Point, deg = 0, drop = 0) => {
  const [px, , pz] = boardPoint(BOARD, [x, y], 'bottom');
  return {
    position: [px, -drop, pz] as Vec3,
    rotation: [Math.PI, (-deg * Math.PI) / 180, 0] as Vec3,
  };
};
const under = ([x, y]: Point, down = 0): Vec3 => {
  const [px, , pz] = boardPoint(BOARD, [x, y], 'bottom');
  return [px, -down, pz];
};

/** Chip parts underneath: the BakePart turns them over (z flips). */
const BOTTOM_CHIPS: ChipItem[] = CHIPS.map((c) => {
  const [x, , z] = under(c.at);
  return { at: [x, -z], rot: c.deg ?? 0, size: c.size, kind: c.kind };
});

const sensFraction = (m: number) => (m - 3) / 4;
const timeFraction = (s: number) => Math.log(s / 3) / Math.log(100);

function formatTime(s: number): string {
  if (s < 60) return `${formatNumber(Math.round(s))} s`;
  const min = Math.floor(s / 60);
  const rest = Math.round(s - min * 60);
  return rest ? `${min} min ${rest} s` : `${min} min`;
}

export const meta: PartMeta = {
  id: 'pir-sensor',
  label: 'Sensor de presença PIR',
  category: 'sensores',
  summary:
    'Módulo sensor de movimento PIR (tipo HC-SR501): lente de Fresnel sobre o sensor piroelétrico, trimpots de sensibilidade e de tempo, jumper de modo e os pinos VCC, OUT e GND.',
  defaults: { sensitivity: 5, holdTime: 5, retrigger: true, flip: false },
  controls: {
    sensitivity: {
      kind: 'number',
      label: 'Sensibilidade (alcance)',
      min: 3,
      max: 7,
      step: 0.5,
      unit: 'm',
    },
    holdTime: {
      kind: 'number',
      label: 'Tempo com a saída ligada',
      min: 3,
      max: 300,
      log: true,
      unit: 's',
    },
    retrigger: { kind: 'toggle', label: 'Jumper em H (repetição)' },
    flip: { kind: 'toggle', label: 'Virado (ver os ajustes)' },
  },
  annotations: (props) => {
    const p = resolve(props);
    const pin = (anchor: string, text: string, exploded?: boolean): PartAnnotation => ({
      at: [0, 0, 0],
      anchor,
      text,
      ...(exploded === undefined ? {} : { exploded }),
    });
    return [
      pin(
        'pir-lente',
        'Lente de Fresnel: cada gomo enxerga uma faixa do ambiente e concentra o calor (infravermelho) no sensor',
      ),
      pin(
        'pir-sensor',
        'Sensor piroelétrico: percebe a mudança de calor quando uma pessoa passa de uma faixa para outra',
      ),
      pin(
        'pir-sensib',
        `Trimpot de sensibilidade: ajusta a distância de detecção, de 3 a 7 m (agora ${formatNumber(p.sensitivity, 1)} m)`,
      ),
      pin(
        'pir-tempo',
        `Trimpot de tempo: quanto tempo a saída fica ligada, de uns 3 s a 5 min (agora ${formatTime(p.holdTime)})`,
      ),
      pin(
        'pir-jumper',
        'Jumper de modo: em H o tempo recomeça enquanto houver movimento (repetição); em L dispara uma vez só',
      ),
      pin('pir-pinos', 'Pinos: VCC (5 a 20 V), OUT (3,3 V quando detecta movimento) e GND'),
      pin('pir-ci', 'Circuito integrado: amplifica o sinal do sensor e controla o tempo da saída'),
    ];
  },
  explode: true,
  cutaway: true,
  describe: (props) => {
    const p = resolve(props);
    return [
      'Módulo sensor de movimento PIR (32 × 24 mm): a cúpula branca facetada da lente de Fresnel cobre o sensor piroelétrico, uma lata metálica com uma janela escura. Embaixo da placa ficam o circuito integrado, os trimpots de sensibilidade e de tempo, o jumper de modo (H e L) e os pinos VCC, OUT e GND.',
      `Sensibilidade em ${formatNumber(p.sensitivity, 1)} m, tempo de ${formatTime(p.holdTime)}, jumper em ${p.retrigger ? 'H (repetição)' : 'L (disparo único)'}.`,
      p.flip ? 'Módulo virado, com os ajustes para cima.' : '',
    ]
      .filter(Boolean)
      .join(' ');
  },
  view: [0.6, 0.85, 1.1],
};

export default function PirSensor(props: PirSensorProps) {
  const p = resolve(props as PartProps);
  const flip = p.flip;
  // Not flipped: resting on the pins. Flipped: resting on the top of the dome.
  const group = flip
    ? { position: [0, T + DOME_TOP, 0] as Vec3, rotation: [Math.PI, 0, 0] as Vec3 }
    : { position: [0, PIN_DROP, 0] as Vec3, rotation: [0, 0, 0] as Vec3 };
  const cutNormal: Vec3 = flip ? [0, 0, 1] : [0, 0, -1];
  return (
    <group position={group.position} rotation={group.rotation}>
      <BatchRoot blocks={['all']} cutNormal={cutNormal} cutThrough={[0, 0, 0]}>
        <PrintedCircuitBoard layout={LAYOUT} />

        {/* Pyroelectric sensor. */}
        <BakeLayer
          lift={[0, 22, -4]}
          delay={0.05}
          extras={<Anchor name="pir-sensor" position={on(SENSOR, 5.6)} />}
        >
          <BakeBlock id="all">
            <BakePart position={on(SENSOR)}>
              <PyroSensor />
            </BakePart>
          </BakeBlock>
        </BakeLayer>

        {/* Fresnel dome. */}
        <BakeLayer
          lift={[0, 40, -8]}
          delay={0.1}
          extras={
            <Anchor
              name="pir-lente"
              position={on([SENSOR[0] + 6.5, SENSOR[1] - 4], DOME_TOP - 3.2)}
            />
          }
        >
          <BakeBlock id="all">
            <BakePart position={on(SENSOR)}>
              <FresnelDome />
            </BakePart>
          </BakeBlock>
        </BakeLayer>

        {/* Underneath: pins, jumper, trimmers, chips. */}
        <BakeLayer
          lift={[0, -20, 6]}
          extras={
            <>
              <Anchor name="pir-pinos" position={under([PINS[1]!.x, PIN_Y], 8.5)} />
              <Anchor name="pir-jumper" position={under(JUMPER, 8.6)} />
              <Anchor name="pir-sensib" position={under(TRIM_SENS, 3.2)} />
              <Anchor name="pir-tempo" position={under(TRIM_TIME, 3.2)} />
              <Anchor name="pir-ci" position={under(IC, 1.7)} />
            </>
          }
        >
          <BakeBlock id="all">
            <BakePart position={[0, 3, PIN_Y - H / 2]} rotation={[Math.PI, 0, 0]}>
              <PinHeader rows={1} pins={3} jumperAt={-1} plated="estanho" />
            </BakePart>
            <BakePart
              position={[JUMPER[0] - W / 2, 3, JUMPER[1] - H / 2]}
              rotation={[Math.PI, 0, 0]}
            >
              <PinHeader rows={1} pins={3} jumperAt={p.retrigger ? 1 : 0} jumperColor="amarelo" />
            </BakePart>
            <BakePart {...below(TRIM_SENS, 0, -3.5)}>
              <Trimpot variant="aberto" ohms={1_000_000} rotation={sensFraction(p.sensitivity)} />
            </BakePart>
            <BakePart {...below(TRIM_TIME, 0, -3.5)}>
              <Trimpot variant="aberto" ohms={1_000_000} rotation={timeFraction(p.holdTime)} />
            </BakePart>
            <BakePart {...below(IC)}>
              <IcQfp package="soic" pins={16} code="PIR CTRL" dateCode="2406" />
            </BakePart>
            <BakePart {...below(REG)}>
              <Sot23 />
            </BakePart>
            <BakePart {...below(DIODE)}>
              <SmaDiode />
            </BakePart>
            <BakePart position={[0, 0, 0]} rotation={[Math.PI, 0, 0]}>
              <ChipParts items={BOTTOM_CHIPS} />
            </BakePart>
          </BakeBlock>
        </BakeLayer>
      </BatchRoot>
    </group>
  );
}

/**
 * Pyroelectric sensor in a TO-5 can: header disc with the tab, nickel can,
 * the dark infrared window on top, three leads through the board.
 */
function PyroSensor() {
  const can = useDisposable(() => {
    const r = 4.6;
    const base = 1.0;
    const top = 4.6;
    const profile: [number, number][] = [
      [0, base],
      [4.75, base],
      [4.75, base + 0.45],
      [r, base + 0.45],
      [r, top - 0.3],
      [r - 0.3, top],
      [0, top],
    ];
    return axialLathe(profile, 40);
  }, []);
  const tab = useDisposable(() => box(1.0, 0.45, 0.9, 0, 1.0, 5.0).rotateY(Math.PI / 4), []);
  const window = useDisposable(() => box(5.0, 0.08, 4.0, 0, 4.6, 0), []);
  const leads = useDisposable(
    () =>
      mergeAll(
        [Math.PI, 0, -Math.PI / 2].map((a) =>
          box(0.45, 3.4, 0.45, 2.54 * Math.cos(a), -2.4, 2.54 * Math.sin(a)),
        ),
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={can}>
        <Material preset="nickel" color="#d9d9d4" roughness={0.24} clip cutColor="#7a7872" />
      </mesh>
      <mesh geometry={tab}>
        <Material preset="nickel" color="#d9d9d4" roughness={0.24} />
      </mesh>
      <mesh geometry={window}>
        <Material
          color="#1d2621"
          roughness={0.06}
          metalness={0.25}
          clearcoat={1}
          clearcoatRoughness={0.03}
        />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" />
      </mesh>
    </group>
  );
}

/**
 * Faceted lens: rings of lenslets on a hemisphere. Each facet keeps its own
 * vertices and its normals bend towards its edges, so every lenslet catches
 * the light on its own, like the moulded Fresnel segments.
 */
function facetedDome(R: number, y0: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const bands = [
    { from: 0, to: 0.26, n: 18 },
    { from: 0.26, to: 0.52, n: 16 },
    { from: 0.52, to: 0.8, n: 14 },
    { from: 0.8, to: 1.06, n: 10 },
    { from: 1.06, to: 1.3, n: 6 },
  ];
  const sub = 3;
  const bulge = 2.2;
  const point = (phi: number, theta: number) =>
    new Vector3(Math.cos(phi) * Math.cos(theta), Math.sin(phi), Math.cos(phi) * Math.sin(theta));
  const pushFacet = (corner: (u: number, v: number) => Vector3) => {
    const centre = corner(0.5, 0.5).normalize();
    const grid: { p: Vector3; n: Vector3 }[][] = [];
    for (let i = 0; i <= sub; i++) {
      const row: { p: Vector3; n: Vector3 }[] = [];
      for (let j = 0; j <= sub; j++) {
        const dir = corner(i / sub, j / sub).normalize();
        const n = centre.clone().add(dir.clone().sub(centre).multiplyScalar(bulge)).normalize();
        row.push({ p: dir.clone().multiplyScalar(R), n });
      }
      grid.push(row);
    }
    for (let i = 0; i < sub; i++) {
      for (let j = 0; j < sub; j++) {
        const a = grid[i]![j]!;
        const b = grid[i + 1]![j]!;
        const c = grid[i + 1]![j + 1]!;
        const d = grid[i]![j + 1]!;
        for (const v of [a, b, d, d, b, c]) {
          positions.push(v.p.x, v.p.y + y0, v.p.z);
          normals.push(v.n.x, v.n.y, v.n.z);
        }
      }
    }
  };
  bands.forEach((band, k) => {
    const offset = k % 2 ? Math.PI / band.n : 0;
    for (let s = 0; s < band.n; s++) {
      const t0 = offset + (s / band.n) * Math.PI * 2;
      const t1 = offset + ((s + 1) / band.n) * Math.PI * 2;
      pushFacet((u, v) => point(band.from + (band.to - band.from) * u, t0 + (t1 - t0) * v));
    }
  });
  // Top lenslet: a cap of its own.
  const cap = bands[bands.length - 1]!.to;
  for (let s = 0; s < 6; s++) {
    const t0 = (s / 6) * Math.PI * 2;
    const t1 = ((s + 1) / 6) * Math.PI * 2;
    pushFacet((u, v) => point(cap + (Math.PI / 2 - cap) * u, t0 + (t1 - t0) * v));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  return g;
}

/** The Fresnel dome on its square base, open underneath. */
function FresnelDome() {
  const noise = getNoiseTexture();
  const shell = useDisposable(() => {
    const plate = new Shape();
    const h = PLATE.size / 2;
    plate.moveTo(-h, -h);
    plate.lineTo(h, -h);
    plate.lineTo(h, h);
    plate.lineTo(-h, h);
    plate.closePath();
    const hole = new Path();
    hole.absarc(0, 0, DOME_R - 0.6, 0, Math.PI * 2, true);
    plate.holes.push(hole);
    const base = extrudeUp(plate, PLATE.t, 0.25, { curveSegments: 40, bevelSegments: 2 });
    const skirt = axialLathe(
      [
        [DOME_R, PLATE.t - 0.1],
        [DOME_R, PLATE.t + SKIRT],
      ],
      54,
    );
    const inner = invertGeometry(
      axialLathe(
        [
          [DOME_R - 0.6, PLATE.t],
          ...Array.from({ length: 13 }, (_, i): [number, number] => {
            const a = (Math.PI / 2) * (i / 12);
            return [(DOME_R - 0.6) * Math.cos(a), PLATE.t + SKIRT + (DOME_R - 0.6) * Math.sin(a)];
          }),
        ],
        48,
      ),
    );
    return mergeAll([base, skirt, inner, facetedDome(DOME_R, PLATE.t + SKIRT)]);
  }, []);
  return (
    <mesh geometry={shell}>
      <Material
        color="#f3f1ea"
        roughness={0.42}
        roughnessMap={noise}
        sheen={0.3}
        clip
        cutColor="#d6d3c9"
      />
    </mesh>
  );
}
