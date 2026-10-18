/**
 * Solenoid: a coil of enamelled copper wire on a nylon bobbin, with a steel
 * plunger and a return spring, as in the open-frame 12 V pull solenoids used
 * in locks and valves (JF-0530 class: 30 mm coil, Ø 7 mm plunger, 10 mm
 * stroke). Turns, coil length and bore are parameters: the wire gets thinner
 * as the turns go up (0,3 to 1,2 mm) and the coil fills layer after layer;
 * the outer layer is drawn wire by wire. With current the plunger is pulled
 * in; the field lines (optional) are computed for the coil.
 * Exploded view: winding up, plunger and spring out. Cutaway: the bobbin,
 * the layers of wire in cross-section and the solid plunger.
 */
import { useRef } from 'react';
import {
  CylinderGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  TubeGeometry,
  type BufferGeometry,
  type Group,
} from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import {
  HelixCurve,
  lathe,
  Lead,
  PartField,
  scaleUv,
  useFollow,
  useGeometrySet,
  useTurnsTexture,
  WireSection,
} from './_power-shared';

export interface SolenoidProps {
  /** Number of turns. */
  turns?: number;
  /** Length of the winding (mm). */
  length?: number;
  /** Bore of the bobbin (mm). */
  diameter?: number;
  /** Steel plunger and return spring. */
  plunger?: boolean;
  /** Current through the coil: the plunger is pulled in. */
  energized?: boolean;
  /** Field lines of the coil (only with current). */
  fieldLines?: boolean;
}

const WALL = 0.8;
const FLANGE_T = 1.5;

/** Everything the shape depends on, from the props. */
function layout(p: PartProps) {
  const turns = Math.round(Math.min(Math.max(Number(p.turns) || 300, 5), 2000));
  const L = Math.min(Math.max(Number(p.length) || 30, 10), 80);
  const bore = Math.min(Math.max(Number(p.diameter) || 8, 3), 25);
  const wire = Math.min(Math.max((0.7 * L) / turns, 0.3), 1.2);
  const perLayer = Math.max(1, Math.floor(L / wire));
  const layers = Math.max(1, Math.ceil(turns / perLayer));
  const outerTurns = turns - (layers - 1) * perLayer;
  const ri = bore / 2;
  const rb = ri + WALL;
  const rw = rb + layers * wire;
  const half = Math.max(rw + 1.6, rb + 3);
  // The flanges (bevel included) rest on the bench.
  const axis = half + 0.2;
  const stroke = Math.min(Math.max(L * 0.33, 4), 15);
  const rp = Math.max(ri - 0.35, 1);
  return { turns, L, bore, wire, perLayer, layers, outerTurns, ri, rb, rw, half, axis, stroke, rp };
}

export const meta: PartMeta = {
  id: 'solenoid',
  label: 'Solenoide',
  category: 'magnetismo',
  summary:
    'Bobina de fio de cobre esmaltado num carretel, com núcleo móvel de aço e mola: com corrente, o campo magnético puxa o núcleo para dentro.',
  defaults: {
    turns: 300,
    length: 30,
    diameter: 8,
    plunger: true,
    energized: false,
    fieldLines: false,
  },
  controls: {
    turns: { kind: 'number', label: 'Espiras', min: 5, max: 1200, step: 1, log: true },
    length: {
      kind: 'number',
      label: 'Comprimento da bobina',
      min: 12,
      max: 60,
      step: 1,
      unit: 'mm',
    },
    diameter: { kind: 'number', label: 'Furo do carretel', min: 4, max: 16, step: 0.5, unit: 'mm' },
    plunger: { kind: 'toggle', label: 'Núcleo móvel e mola' },
    energized: { kind: 'toggle', label: 'Com corrente' },
    fieldLines: { kind: 'toggle', label: 'Linhas de campo' },
  },
  annotations: (p) => {
    const { L, half, axis, rw, rp, layers } = layout(p);
    const list: PartAnnotation[] = [
      {
        at: [-L * 0.15, axis + rw, 0],
        text:
          layers > 1
            ? `Fio de cobre esmaltado: ${layers} camadas de espiras`
            : 'Fio de cobre esmaltado: cada volta é uma espira',
        exploded: false,
      },
      {
        at: [-L / 2 - FLANGE_T, axis + half * 0.7, half * 0.5],
        text: 'Carretel isolante',
        exploded: false,
      },
      {
        at: [-L / 2 - 14, 0.4, half + 12],
        text: 'Pontas raspadas: o esmalte isola o fio',
        exploded: false,
      },
    ];
    if (p.plunger) {
      list.push(
        {
          at: [L / 2 + FLANGE_T + 4, axis + rp, 0],
          text: p.energized ? 'Com corrente, o êmbolo é puxado' : 'Êmbolo de aço (núcleo móvel)',
          exploded: false,
        },
        { at: [0, 0, 0], text: 'Êmbolo de aço', anchor: 'plunger', exploded: true },
        {
          at: [0, 0, 0],
          text: 'Mola: devolve o êmbolo sem corrente',
          anchor: 'spring',
          exploded: true,
        },
      );
    }
    list.push(
      { at: [0, 0, 0], text: 'Bobina', anchor: 'winding', exploded: true },
      { at: [0, 0, 0], text: 'Carretel de náilon', anchor: 'bobbin', exploded: true },
    );
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const { turns, L, bore, wire, layers } = layout(p);
    const plunger = p.plunger ? ', núcleo móvel de aço e mola de retorno' : '';
    const state = p.plunger
      ? p.energized
        ? ' Com corrente, o campo magnético da bobina puxa o êmbolo para dentro.'
        : ' Sem corrente não há campo: a mola mantém o êmbolo para fora.'
      : p.energized
        ? ' Há corrente na bobina: ela vira um eletroímã.'
        : ' Sem corrente na bobina.';
    const lines =
      p.fieldLines && p.energized
        ? ' As linhas de campo atravessam a bobina por dentro e se fecham por fora, como num ímã em barra.'
        : '';
    return `Solenoide com ${turns} espiras de fio esmaltado de ${formatNumber(wire, 2)} mm em ${layers} ${layers > 1 ? 'camadas' : 'camada'}, bobina de ${formatNumber(L)} mm de comprimento com furo de ${formatNumber(bore)} mm${plunger}.${state}${lines}`;
  },
  view: [0.8, 0.55, 1.25],
};

export default function Solenoid(props: SolenoidProps) {
  const p = { ...meta.defaults, ...props } as Required<SolenoidProps>;
  const { turns, L, wire, layers, outerTurns, ri, rb, rw, half, axis, stroke, rp } = layout(
    p as unknown as PartProps,
  );
  const noise = getNoiseTexture();
  const inner = rb + (layers - 1) * wire;
  const outerLength = Math.min(outerTurns * wire, L);
  const single = layers === 1;
  // One layer with few turns: spread them over the whole length.
  const helixLength = single ? L - wire : outerLength - wire;
  const helixTurns = single ? turns : outerTurns;
  // Wire thinner than this would only shimmer on screen: the outer layer is
  // then a textured shell like the inner ones.
  const drawn = wire >= 0.45;
  const xStop = -L / 2 + 2;
  const plungerLength = L + FLANGE_T - 2 + 11.5;
  // The spring runs from the flange to the washer: 5,3 mm when fully compressed.
  const springRest = stroke + 5.3;
  const xFlange = L / 2 + FLANGE_T;

  const geo = useGeometrySet(() => {
    // Lathes are built around +Y and laid along +X.
    const alongX = (g: BufferGeometry) => g.rotateZ(-Math.PI / 2).translate(0, axis, 0);
    const tube = alongX(
      lathe(
        [
          [ri, -L / 2 - FLANGE_T],
          [rb, -L / 2 - FLANGE_T],
          [rb, L / 2 + FLANGE_T],
          [ri, L / 2 + FLANGE_T],
          [ri, -L / 2 - FLANGE_T],
        ],
        40,
      ),
    );
    // Square flange with the bore.
    const flangeShape = new Shape();
    const h = half;
    const r = 1.2;
    flangeShape.moveTo(-h + r, -h);
    flangeShape.lineTo(h - r, -h);
    flangeShape.quadraticCurveTo(h, -h, h, -h + r);
    flangeShape.lineTo(h, h - r);
    flangeShape.quadraticCurveTo(h, h, h - r, h);
    flangeShape.lineTo(-h + r, h);
    flangeShape.quadraticCurveTo(-h, h, -h, h - r);
    flangeShape.lineTo(-h, -h + r);
    flangeShape.quadraticCurveTo(-h, -h, -h + r, -h);
    const hole = new Path();
    hole.absarc(0, 0, ri, 0, Math.PI * 2, true);
    flangeShape.holes.push(hole);
    const flange = new ExtrudeGeometry(flangeShape, {
      depth: FLANGE_T,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.2,
      bevelSegments: 2,
      curveSegments: 16,
    });
    // Shape (z, y), depth along +X from 0.
    flange.rotateY(Math.PI / 2);
    flange.translate(0, axis, 0);

    // Inner layers: a solid shell carrying the texture of the turns.
    const layersGeo =
      layers > 1
        ? alongX(
            scaleUv(
              lathe(
                [
                  [rb, -L / 2],
                  [inner, -L / 2],
                  [inner, L / 2],
                  [rb, L / 2],
                  [rb, -L / 2],
                ],
                48,
              ),
              1,
              L / (wire * 8),
            ),
          )
        : new CylinderGeometry(0.001, 0.001, 0.001);

    // Outer layer, wire by wire. It starts and ends on top (phase π).
    const radius = inner + wire / 2;
    const curve = new HelixCurve(
      radius,
      helixLength / Math.max(helixTurns, 1),
      helixTurns,
      Math.PI,
    );
    const perTurn = helixTurns > 60 ? 12 : 24;
    const helix = drawn
      ? new TubeGeometry(curve, Math.ceil(helixTurns * perTurn), wire * 0.48, 6, false)
          .rotateZ(-Math.PI / 2)
          .translate(-L / 2 + wire / 2, axis, 0)
      : alongX(
          scaleUv(
            lathe(
              [
                [inner, -L / 2],
                [inner + wire, -L / 2],
                [inner + wire, -L / 2 + outerLength],
                [inner, -L / 2 + outerLength],
                [inner, -L / 2],
              ],
              48,
            ),
            1,
            outerLength / (wire * 8),
          ),
        );

    // Plunger along +X from its inner end, with a groove for the E-clip.
    const Lp = plungerLength;
    const plunger = lathe(
      [
        [0, 0],
        [rp - 0.6, 0],
        [rp, 0.6],
        [rp, Lp - 5.6],
        [rp - 0.45, Lp - 5.6],
        [rp - 0.45, Lp - 4.8],
        [rp, Lp - 4.8],
        [rp, Lp - 0.5],
        [rp - 0.5, Lp],
        [0, Lp],
      ],
      36,
    ).rotateZ(-Math.PI / 2);
    // Return spring: rest length, scaled along X as it is compressed.
    const springTurns = 6;
    const spring = new TubeGeometry(
      new HelixCurve(rp + 0.9, springRest / springTurns, springTurns, 0),
      springTurns * 20,
      0.32,
      6,
      false,
    ).rotateZ(-Math.PI / 2);
    // Washer and E-clip.
    const washer = lathe(
      [
        [rp + 0.1, 0],
        [rp + 2.2, 0],
        [rp + 2.2, 0.6],
        [rp + 0.1, 0.6],
        [rp + 0.1, 0],
      ],
      36,
    ).rotateZ(-Math.PI / 2);
    const clipShape = new Shape();
    clipShape.absarc(0, 0, rp + 1.6, 0.5, Math.PI * 2 - 0.5, false);
    clipShape.absarc(0, 0, rp - 0.45, Math.PI * 2 - 0.6, 0.6, true);
    const clip = new ExtrudeGeometry(clipShape, {
      depth: 0.6,
      bevelEnabled: false,
      curveSegments: 24,
    });
    clip.rotateY(Math.PI / 2).rotateX(Math.PI / 2);
    return { tube, flange, layers: layersGeo, helix, plunger, spring, washer, clip };
  }, [
    L,
    ri,
    rb,
    half,
    layers,
    inner,
    wire,
    helixLength,
    helixTurns,
    drawn,
    outerLength,
    rp,
    plungerLength,
    springRest,
  ]);

  const turnsMap = useTurnsTexture('color', '#b4582c');
  const turnsBump = useTurnsTexture('bump');

  // Plunger travel: pulled in with current, pushed out by the spring.
  const slide = useRef<Group>(null);
  const spring = useRef<Group>(null);
  useFollow(
    p.plunger && p.energized ? 0 : stroke,
    (x) => {
      if (slide.current) slide.current.position.x = xStop + x;
      if (spring.current) spring.current.scale.x = (5.3 + x) / springRest;
    },
    7,
  );

  // Lead-outs: from the start of the winding (left) and the end of the outer layer.
  const top = axis + half;
  const endX = single ? L / 2 - wire / 2 : -L / 2 + outerLength - wire / 2;
  const leadStart: Vec3[] = [
    [-L / 2 + wire, axis + rb + wire / 2, 0],
    [-L / 2 + 0.5, axis + rb + 1.2, 0.4],
    [-L / 2 + 0.45, top - 0.4, 0.8],
    [-L / 2 + 0.3, top + 1.4, 1.6],
    [-L / 2 - 3, top + 2.4, half * 0.5],
    [-L / 2 - 7, top * 0.55, half + 4],
    [-L / 2 - 10, 0.4, half + 9],
    [-L / 2 - 14, 0.4, half + 15],
  ];
  const leadEnd: Vec3[] = [
    [endX, axis + inner + wire / 2, 0],
    [endX + 0.6, axis + rw + 0.4, 0.6],
    [L / 2 - 0.6, axis + rw + 0.5, 1],
    [L / 2 - 0.45, top - 0.4, 1.2],
    [L / 2 - 0.3, top + 1.4, 2],
    [L / 2 + 2, top + 2.4, half * 0.6],
    [L / 2 + 6, top * 0.55, half + 5],
    [L / 2 + 9, 0.4, half + 10],
    [L / 2 + 13, 0.4, half + 16],
  ];

  const bobbinMaterial = (
    <Material preset="nylonNatural" roughness={0.55} roughnessMap={noise} clip cutColor="#d9d2bf" />
  );
  const wireMaterial = <Material preset="magnetWire" clip cutColor="#c4703d" />;
  const turnsMaterial = (
    <Material
      preset="magnetWire"
      color="#ffffff"
      map={turnsMap}
      bumpMap={turnsBump}
      bumpScale={0.5}
      clip
      cutColor="#9c4a22"
    />
  );

  return (
    <group>
      {/* Bobbin. */}
      <mesh geometry={geo.tube}>{bobbinMaterial}</mesh>
      <mesh geometry={geo.flange} position={[-L / 2 - FLANGE_T, 0, 0]}>
        {bobbinMaterial}
      </mesh>
      <mesh geometry={geo.flange} position={[L / 2, 0, 0]}>
        {bobbinMaterial}
      </mesh>
      <Anchor name="bobbin" position={[-L / 2 - FLANGE_T, axis + half * 0.6, half * 0.6]} />

      {/* Winding and its leads. */}
      <Explode offset={[0, half * 2.6, 0]}>
        {layers > 1 && <mesh geometry={geo.layers}>{turnsMaterial}</mesh>}
        <mesh geometry={geo.helix}>{drawn ? wireMaterial : turnsMaterial}</mesh>
        {!drawn &&
          ([1, -1] as const).map((s) => (
            <WireSection
              key={s}
              width={outerLength}
              height={wire}
              wire={wire}
              position={[-L / 2 + outerLength / 2, axis + s * (inner + wire / 2), 0.02]}
            />
          ))}
        {layers > 1 &&
          ([1, -1] as const).map((s) => (
            <WireSection
              key={s}
              width={L}
              height={inner - rb}
              wire={wire}
              position={[0, axis + s * ((rb + inner) / 2), 0.02]}
            />
          ))}
        <Lead
          points={leadStart}
          radius={wire * 0.48}
          color="#b4582c"
          strip={4}
          tip="cobre"
          bend={1.2}
          clip
          material={{ preset: 'magnetWire' }}
        />
        <Lead
          points={leadEnd}
          radius={wire * 0.48}
          color="#b4582c"
          strip={4}
          tip="cobre"
          bend={1.2}
          clip
          material={{ preset: 'magnetWire' }}
        />
        <Anchor name="winding" position={[L * 0.2, axis + rw, rw * 0.5]} />
      </Explode>

      {/* Plunger, washer, E-clip and spring. */}
      {p.plunger && (
        <Explode offset={[L * 1.1, 0, 0]} delay={0.15}>
          <group ref={slide} position={[xStop + stroke, axis, 0]}>
            <mesh geometry={geo.plunger}>
              <Material
                preset="steel"
                color="#c9ccd0"
                roughness={0.28}
                roughnessMap={noise}
                clip
                cutColor="#73767a"
              />
            </mesh>
            <mesh geometry={geo.washer} position={[plungerLength - 5.6 - 0.6, 0, 0]}>
              <Material preset="zinc" roughness={0.3} clip />
            </mesh>
            <mesh geometry={geo.clip} position={[plungerLength - 5.5, 0, 0]}>
              <Material preset="steel" color="#3b3d40" roughness={0.45} clip />
            </mesh>
            <Anchor name="plunger" position={[plungerLength - 2, rp, 0]} />
          </group>
          <group ref={spring} position={[xFlange, axis, 0]}>
            <mesh geometry={geo.spring}>
              <Material preset="steel" color="#d4d6d9" roughness={0.25} clip />
            </mesh>
          </group>
          <Anchor name="spring" position={[xFlange + springRest / 2, axis + rp + 1.2, 0]} />
        </Explode>
      )}

      {p.fieldLines && p.energized && (
        <PartField
          sources={[
            {
              kind: 'solenoid',
              radius: (rb + rw) / 2,
              length: L,
              turns,
              axis: [1, 0, 0],
              position: [0, axis, 0],
            },
          ]}
          plane={[0, 1, 0]}
          center={[0, axis, 0]}
          extent={Math.max(L, rw * 2) * 1.5}
          count={12}
        />
      )}
    </group>
  );
}
