/**
 * The classic 1-channel 5 V relay module for microcontrollers (the KY-019
 * type), 50 × 26 mm, FR-4 1,6 mm. Dimensions of the common module: sealed
 * relay 19,0 × 15,5 × 15,0 mm (the kit's `relay`, 5 V coil, ~70 Ω), 3-way
 * 5,08 mm screw terminal for the load (NA, C, NF) on the right edge, 3-pin
 * 2,54 mm header (VCC, GND, IN) on the left edge, NPN transistor in TO-92
 * driving the coil, 1N4007-type flyback diode (DO-41, 5,2 × 2,7 mm), 1 kΩ
 * base resistor, 3 mm status LED with its resistor, mounting holes of
 * 3,1 mm. The contacts are traced wide on the bottom side.
 *
 * The parts are baked into a few merged meshes (`_gate-batch.tsx`).
 */
import { GlowSprite } from '../fx/glow';
import { Anchor } from '../core/view';
import { Material } from '../materials/Material';
import { boardPoint, type PcbLayout, type PcbPad, type PcbSilk, type Point } from '../pcb/layout';
import { PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import { axialLathe, roundedPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { BakeBlock, BakeLayer, BakePart, BatchRoot } from './_gate-batch';
import { mergeAll } from './_em-geometry';
import Led, { LED_COLORS } from './led';
import PinHeader from './pin-header';
import Relay, { RELAY_PINS } from './relay';
import Resistor from './resistor';
import ScrewTerminal from './screw-terminal';
import TransistorTo92 from './transistor-to92';

export interface RelayModuleProps {
  /** IN at high level: the transistor conducts, the coil pulls the contacts and the LED lights. */
  on?: boolean;
}

const W = 50;
const H = 26;
const T = 1.6;
const BOARD = { width: W, height: H, thickness: T };
/** Board bottom above the bench: the module rests on its solder joints. */
const BASE = 1.9;

const HEADER: Point = [2.8, 13];
const HEADER_PINS = [
  { label: 'VCC', y: 10.46 },
  { label: 'GND', y: 13 },
  { label: 'IN', y: 15.54 },
];
const Q1: Point = [12.5, 9.5];
const R1: Point = [12.5, 4.6];
const R2: Point = [13.0, 13.0];
const LED: Point = [10.5, 16.8];
const D1: Point = [12.5, 21.5];
const K1: Point = [28.5, 13];
const TERMINAL: Point = [45.9, 13];
const WAYS = [
  { label: 'NA', alt: 'NO', y: 13 - 5.08 },
  { label: 'C', alt: 'COM', y: 13 },
  { label: 'NF', alt: 'NC', y: 13 + 5.08 },
];

const relayPin = (key: keyof typeof RELAY_PINS): Point => [
  K1[0] + RELAY_PINS[key][0],
  K1[1] + RELAY_PINS[key][1],
];

const tht = (at: Point, drill: number, size: number, extra: Partial<PcbPad> = {}): PcbPad => ({
  at,
  drill,
  size,
  solder: true,
  ...extra,
});

const text = (
  at: Point,
  value: string,
  size = 1,
  extra: Partial<Extract<PcbSilk, { kind: 'text' }>> = {},
): PcbSilk => ({ kind: 'text', at, text: value, size, ...extra });

function buildLayout(): PcbLayout {
  const pads: PcbPad[] = [];
  for (const p of HEADER_PINS)
    pads.push(
      tht([HEADER[0], p.y], 1.0, 1.7, {
        ...(p.label === 'GND' ? { net: 'GND' } : {}),
        ...(p.label === 'VCC' ? { shape: 'square' as const } : {}),
      }),
    );
  for (const dx of [-2.54, 0, 2.54]) pads.push(tht([Q1[0] + dx, Q1[1]], 0.8, 1.5));
  for (const [c, pitch] of [
    [R1, 10.16],
    [R2, 10.16],
    [D1, 10.16],
  ] as const)
    for (const s of [-1, 1])
      pads.push(
        tht([c[0] + (s * pitch) / 2, c[1]], 0.9, 1.7, s > 0 && c === D1 ? { shape: 'square' } : {}),
      );
  for (const s of [-1, 1])
    pads.push(tht([LED[0] + s * 1.27, LED[1]], 0.8, 1.5, s < 0 ? { shape: 'square' } : {}));
  for (const key of Object.keys(RELAY_PINS) as (keyof typeof RELAY_PINS)[])
    pads.push(
      tht(
        relayPin(key),
        1.3,
        2.6,
        key === 'com' || key === 'no' || key === 'nc' ? { size: 3.2 } : {},
      ),
    );
  for (const w of WAYS) pads.push(tht([TERMINAL[0] - 1.75, w.y], 1.3, 2.8, { size: 3.0 }));

  const silk: PcbSilk[] = [
    ...HEADER_PINS.map((p) => text([5.0, p.y], p.label, 1.0, { align: 'left' })),
    ...WAYS.flatMap((w) => [
      text([40.2, w.y - 0.45], w.label, 1.3),
      text([40.2, w.y + 1.25], w.alt, 0.55),
    ]),
    text([12.5, 2.3], 'R1 1K', 0.8),
    text([16.4, 9.5], 'Q1', 0.9, { align: 'left' }),
    text([13.2, 16.8], 'LED', 0.8, { align: 'left' }),
    text([12.5, 24.0], 'D1', 0.8),
    text([28.5, 3.4], 'K1  5 V', 1.0),
    text([30.8, 23.4], 'REDE 127/220 V', 0.95, { align: 'left' }),
    {
      kind: 'line',
      points: [
        [26.6, 24.2],
        [28.2, 21.6],
        [29.8, 24.2],
      ],
      width: 0.2,
      closed: true,
    },
    text([28.2, 23.45], '!', 1.1),
    { kind: 'rect', at: K1, size: [19.6, 16.1], width: 0.18 },
    { kind: 'circle', at: LED, r: 1.9, width: 0.15 },
  ];

  return {
    width: W,
    height: H,
    thickness: T,
    corner: 1,
    copper: 'both',
    mask: 'azul',
    finish: 'hasl',
    pads,
    holes: [
      { at: [3.2, 3.2], drill: 3.1 },
      { at: [3.2, 22.8], drill: 3.1 },
    ],
    traces: [
      // Load side, on the bottom: wide traces from the contacts to the terminal.
      { points: [relayPin('com'), [TERMINAL[0] - 1.75, 13]], width: 2.6, side: 'bottom' },
      {
        points: [relayPin('no'), [39.5, 7], [TERMINAL[0] - 1.75, WAYS[0]!.y]],
        width: 2.4,
        side: 'bottom',
      },
      {
        points: [relayPin('nc'), [39.5, 19], [TERMINAL[0] - 1.75, WAYS[2]!.y]],
        width: 2.4,
        side: 'bottom',
      },
      // Coil, transistor and diode.
      {
        points: [relayPin('coil2'), [17.6, 7.0], [Q1[0] + 2.54, Q1[1]]],
        width: 0.8,
        side: 'bottom',
      },
      {
        points: [relayPin('coil1'), [19.6, 19], [D1[0] + 5.08, D1[1]]],
        width: 0.8,
        side: 'bottom',
      },
      {
        points: [
          [R1[0] + 5.08, R1[1]],
          [Q1[0], 6.4],
          [Q1[0], Q1[1]],
        ],
        width: 0.5,
        side: 'bottom',
      },
      {
        points: [
          [HEADER[0], 15.54],
          [5.4, 15.54],
          [5.4, 6.0],
          [R1[0] - 5.08, R1[1]],
        ],
        width: 0.5,
        side: 'bottom',
      },
      {
        points: [
          [R2[0] + 5.08, R2[1]],
          [18.6, 15.2],
          [18.6, 19.0],
        ],
        width: 0.5,
        side: 'bottom',
      },
      {
        points: [
          [LED[0] + 1.27, LED[1]],
          [R2[0] - 5.08, R2[1] + 2.4],
          [R2[0] - 5.08, R2[1]],
        ],
        width: 0.5,
      },
      {
        points: [
          [HEADER[0], 10.46],
          [6.4, 8.0],
          [6.4, 7.2],
        ],
        width: 0.6,
      },
    ],
    pours: [
      {
        outline: [
          [0.6, 0.6],
          [20, 0.6],
          [20, 25.4],
          [0.6, 25.4],
        ],
        side: 'bottom',
        net: 'GND',
        clearance: 0.4,
      },
    ],
    silk,
  };
}

const LAYOUT = buildLayout();

/** Layout point → BatchRoot space (board bottom at y = 0). */
const on = ([x, y]: Point, up = 0): Vec3 => {
  const [px, py, pz] = boardPoint(BOARD, [x, y]);
  return [px, py + up, pz];
};
const place = (at: Point, deg = 0, up = 0) => ({
  position: on(at, up),
  rotation: [0, (deg * Math.PI) / 180, 0] as Vec3,
});

/** Cut through the relay, the terminal and the header (the middle of the board). */
const CUT_Z = K1[1] - H / 2;

const LIFT_LOW: Vec3 = [0, 26, -13];
const LIFT_MID: Vec3 = [0, 33, -16];
const LIFT_TALL: Vec3 = [0, 42, -21];

const resolve = (props: PartProps) => ({ on: { ...meta.defaults, ...props }.on === true });

export const meta: PartMeta = {
  id: 'relay-module',
  label: 'Módulo relé',
  category: 'placas',
  summary:
    'Módulo relé de 1 canal para microcontroladores (tipo KY-019): o pino IN liga um transistor que aciona a bobina de 5 V; os contatos NA, C e NF podem ligar cargas de 127/220 V.',
  defaults: { on: false },
  controls: { on: { kind: 'toggle', label: 'Relé ligado (IN em nível alto)' } },
  annotations: () => {
    const pin = (anchor: string, text: string, exploded?: boolean): PartAnnotation => ({
      at: [0, 0, 0],
      anchor,
      text,
      ...(exploded === undefined ? {} : { exploded }),
    });
    return [
      pin(
        'rm-bobina',
        'Relé: a bobina de 5 V, dentro da caixa azul, puxa os contatos quando recebe corrente',
      ),
      pin(
        'rm-contatos',
        'Contatos para a carga: NA (normalmente aberto), C (comum) e NF (normalmente fechado). Podem estar em 127/220 V',
      ),
      pin('rm-transistor', 'Transistor NPN: com IN em nível alto, conduz e liga a bobina'),
      pin('rm-diodo', 'Diodo de roda livre: absorve o pico de tensão da bobina quando ela desliga'),
      pin('rm-resistor', 'Resistor de base: limita a corrente tirada do pino do microcontrolador'),
      pin('rm-led', 'LED indicador: acende quando o relé está ligado'),
      pin('rm-pinos', 'Pinos de comando: VCC (5 V), GND e IN (sinal do microcontrolador)'),
      pin('pcb-copper-bottom', 'Trilhas largas do lado de baixo: levam a corrente da carga', true),
      pin('pcb-substrate', 'Placa de FR-4 de 1,6 mm', true),
    ];
  },
  explode: true,
  cutaway: true,
  cut: { normal: [0, 0, -1], through: [0, 0, CUT_Z] },
  describe: (props) => {
    const p = resolve(props);
    return [
      'Módulo relé de 1 canal (50 × 26 mm), placa azul. À esquerda, os pinos VCC, GND e IN; no meio, o transistor, o diodo de roda livre, os resistores, o LED e o relé azul de 5 V; à direita, o borne de parafuso com os contatos NA, C e NF, que podem estar na tensão da rede (127/220 V).',
      p.on
        ? 'Relé ligado: IN em nível alto, LED aceso, bobina energizada e o comum (C) encostado no contato NA.'
        : 'Relé desligado: LED apagado e o comum (C) encostado no contato NF.',
    ].join(' ');
  },
  view: [0.55, 0.95, 1.1],
};

export default function RelayModule(props: RelayModuleProps) {
  const p = resolve(props as PartProps);
  return (
    <group position={[0, BASE, 0]}>
      <BatchRoot blocks={['all']} cutNormal={[0, 0, -1]} cutThrough={[0, 0, CUT_Z]}>
        <PrintedCircuitBoard layout={LAYOUT} />

        {/* Low tier: header, resistors, transistor, diode. */}
        <BakeLayer
          lift={LIFT_LOW}
          extras={
            <>
              <Anchor name="rm-pinos" position={on(HEADER, 9)} />
              <Anchor name="rm-transistor" position={on(Q1, 7.5)} />
              <Anchor name="rm-resistor" position={on([R1[0] - 2, R1[1]], 2.6)} />
              <Anchor name="rm-diodo" position={on(D1, 2.9)} />
            </>
          }
        >
          <BakeBlock id="all">
            <BakePart {...place(HEADER, 90, -3)}>
              <PinHeader rows={1} pins={3} jumperAt={-1} />
            </BakePart>
            <BakePart {...place(Q1, 0, -3)}>
              <TransistorTo92 code="8050" type="npn" pinout="EBC" dateCode="" leadLength={5.5} />
            </BakePart>
            <BakePart {...place(R1, 0, -4.6 + 1.2 + 0.2)}>
              <Resistor ohms={1000} watts={0.25} leads="dobrados" leadDrop={4.6} />
            </BakePart>
            <BakePart {...place(R2, 0, -4.6 + 1.2 + 0.2)}>
              <Resistor ohms={1000} watts={0.25} leads="dobrados" leadDrop={4.6} />
            </BakePart>
            <BakePart {...place(D1)}>
              <AxialDiode />
            </BakePart>
          </BakeBlock>
        </BakeLayer>

        {/* LED (its own layer: it changes with the state). */}
        <BakeLayer
          lift={LIFT_LOW}
          extras={
            <>
              <GlowSprite
                color={LED_COLORS.vermelho.light}
                intensity={p.on ? 0.75 : 0}
                size={8}
                position={on(LED, 4.4)}
              />
              <Anchor name="rm-led" position={on(LED, 6.5)} />
            </>
          }
        >
          <BakeBlock id="all">
            <BakePart {...place(LED, 0, -3)}>
              <Led size={3} color="vermelho" brightness={p.on ? 1 : 0} leadLength={2} />
            </BakePart>
          </BakeBlock>
        </BakeLayer>

        {/* Middle tier: the terminal. */}
        <BakeLayer
          lift={LIFT_MID}
          delay={0.08}
          extras={<Anchor name="rm-contatos" position={on([TERMINAL[0], WAYS[0]!.y], 10.5)} />}
        >
          <BakeBlock id="all">
            <BakePart {...place(TERMINAL, 90, -3.5)}>
              <ScrewTerminal
                ways={3}
                pitch={5.08}
                color="azul"
                screwTurns={0}
                labels={WAYS.map((w) => w.label)
                  .reverse()
                  .join(',')}
              />
            </BakePart>
          </BakeBlock>
        </BakeLayer>

        {/* Tall tier: the relay (its own layer: the armature moves). */}
        <BakeLayer
          lift={LIFT_TALL}
          delay={0.16}
          extras={<Anchor name="rm-bobina" position={on([K1[0] - 4, K1[1] - 4], 15.6)} />}
        >
          <BakeBlock id="all">
            <BakePart {...place(K1, 0, -3.5)}>
              <Relay coilVoltage={5} energized={p.on} />
            </BakePart>
          </BakeBlock>
        </BakeLayer>
      </BatchRoot>
    </group>
  );
}

/**
 * 1N4007-type rectifier diode (DO-41: 5,2 × 2,7 mm) lying on the board, leads
 * bent down into holes 10,16 mm apart, cathode band towards +X.
 */
function AxialDiode() {
  const L = 5.2;
  const R = 1.35;
  const y = R + 0.3;
  const body = useDisposable(() => {
    const profile: [number, number][] = [[0, -L / 2]];
    const f = 0.35;
    for (let i = 0; i <= 4; i++) {
      const a = (Math.PI / 2) * (i / 4);
      profile.push([R - f + Math.sin(a) * f, -L / 2 + f - Math.cos(a) * f]);
    }
    for (let i = 0; i <= 4; i++) {
      const a = (Math.PI / 2) * (i / 4);
      profile.push([R - f + Math.cos(a) * f, L / 2 - f + Math.sin(a) * f]);
    }
    profile.push([0, L / 2]);
    return axialLathe(profile, 28)
      .rotateZ(-Math.PI / 2)
      .translate(0, y, 0);
  }, []);
  const band = useDisposable(
    () =>
      axialLathe(
        [
          [R + 0.012, 0],
          [R + 0.012, 0.75],
        ],
        28,
      )
        .rotateZ(-Math.PI / 2)
        .translate(L / 2 - 1.25, y, 0),
    [],
  );
  const leads = useDisposable(
    () =>
      mergeAll(
        [-1, 1].map((s) =>
          tube(
            roundedPath(
              [
                [s * (L / 2 - 0.2), y, 0],
                [s * 5.08, y, 0],
                [s * 5.08, -3.2, 0],
              ],
              0.9,
            ),
            0.4,
            { radial: 8 },
          ),
        ),
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={body}>
        <Material preset="epoxyBlack" roughness={0.45} clearcoat={0.3} clip cutColor="#202022" />
      </mesh>
      <mesh geometry={band}>
        <Material color="#c9ccd0" roughness={0.5} clip />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" />
      </mesh>
    </group>
  );
}
