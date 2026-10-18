/**
 * Reed switch: two ferromagnetic (nickel-iron) reeds sealed in a glass
 * capsule with inert gas. Their flattened ends overlap with a small gap and
 * gold-plated contact faces; a magnet nearby magnetises them and they pull
 * together, closing the contact.
 * - `vidro`: the bare capsule, glass Ø 2,3 × 14 mm, leads Ø 0,55 mm, 52 mm
 *   overall (typical 14 mm reed switch datasheets).
 * - `sensor`: the surface-mount magnetic sensor used as a gate end stop or
 *   door contact: plastic case 36 × 13 × 7,5 mm with two screw ears, the
 *   capsule inside and two wires (typical catalogue sizes), paired with the
 *   magnet case.
 * `magnetNear` slides a magnet in (behind the switch) and the reeds snap
 * shut; `closed` closes them regardless.
 */
import { useRef, type RefObject } from 'react';
import { CircleGeometry, CylinderGeometry, Path, RingGeometry, Shape, type Group } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe, smoothPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import { addRoundedRect, extrudeUp, shellGeometry } from './_em-geometry';
import { Decal, useSmooth } from './_em-kit';

type Variant = 'vidro' | 'sensor';

export interface ReedSwitchProps {
  variant?: Variant;
  /** Contacts closed (reeds touching). */
  closed?: boolean;
  /** A magnet is brought close: it magnetises the reeds and closes the contact. */
  magnetNear?: boolean;
}

/** Capsule (mm): glass radius and half length, lead radius. */
const GLASS = { r: 1.15, half: 7, wall: 0.25 };
const LEAD_R = 0.275;
/** Reeds: root (inside the seal), tip overlap, blade size, open gap. */
const REED = { root: 5.6, tip: 0.85, width: 0.85, thick: 0.22, gap: 0.3 };
const REED_LENGTH = REED.root + REED.tip;
/** Rotation of each reed that closes the gap (tip moves gap / 2). */
const REED_ANGLE = REED.gap / 2 / REED_LENGTH;

/** Bare capsule lying on the table. */
const BARE = { cy: GLASS.r, lead: 19, magnetNear: -3.9, magnetFar: -22 };

/** Sensor case: flange with ears, body, capsule height, magnet case distance. */
const FLANGE = { L: 36, W: 13, T: 1.6, holeR: 1.7, holeX: 15 };
const BODY = { L: 24, W: 11, H: 5.9 };
const SENSOR = { cy: FLANGE.T + 2.3, lead: 2.3, magnetNear: -18, magnetFar: -44 };
const BODY_TOP = FLANGE.T + BODY.H;

export const meta: PartMeta = {
  id: 'reed-switch',
  label: 'Interruptor reed (ampola) e sensor magnético',
  category: 'eletromecanicos',
  summary:
    'Ampola de vidro com duas lâminas que se encostam quando um ímã chega perto, e o sensor de fim de curso em caixa plástica com dois fios.',
  defaults: { variant: 'vidro', closed: false, magnetNear: false },
  controls: {
    variant: {
      kind: 'select',
      label: 'Modelo',
      options: [
        { value: 'vidro', label: 'Ampola de vidro' },
        { value: 'sensor', label: 'Sensor em caixa (portão)' },
      ],
    },
    magnetNear: { kind: 'toggle', label: 'Ímã perto' },
    closed: { kind: 'toggle', label: 'Contato fechado' },
  },
  annotations: (p): PartAnnotation[] => {
    const near = !!p.magnetNear;
    if (p.variant === 'sensor') {
      const list: PartAnnotation[] = [
        {
          at: [BODY.L / 2 - 3, BODY_TOP, BODY.W / 2 - 1.5],
          text: 'Sensor magnético: ampola reed numa caixa plástica',
          exploded: false,
        },
        { at: [0, 0, 0], text: 'Ampola reed (contato NA)', anchor: 'ampola', exploded: true },
        { at: [-30, 1.8, 3.6], text: 'Dois fios: o contato do sensor' },
        { at: [FLANGE.holeX, FLANGE.T, 0], text: 'Furo para parafuso', exploded: false },
      ];
      if (near) list.push({ at: [0, 0, 0], text: 'Ímã preso na parte que se move', anchor: 'ima' });
      return list;
    }
    const list: PartAnnotation[] = [
      {
        at: [3.5, BARE.cy + GLASS.r, 0.5],
        text: 'Ampola de vidro com gás inerte',
        exploded: false,
      },
      { at: [0, 0, 0], text: 'Lâmina de ferro-níquel (magnética)', anchor: 'lamina' },
      { at: [0, 0, 0], text: 'Contatos banhados a ouro', anchor: 'contato' },
      { at: [-15, BARE.cy, 0], text: 'Terminal', exploded: false },
    ];
    if (near)
      list.push({ at: [0, 0, 0], text: 'Ímã: magnetiza as lâminas, que se atraem', anchor: 'ima' });
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const near = !!p.magnetNear;
    const closed = !!p.closed || near;
    const state = closed
      ? `contato fechado${near ? ' pelo ímã que está perto' : ''}: as lâminas se tocam`
      : 'contato aberto: as lâminas estão separadas por uma fresta de 0,3 mm';
    if (p.variant === 'sensor')
      return `Sensor magnético de portão em caixa plástica com dois fios e a ampola reed dentro; ${state}.`;
    return `Interruptor reed: ampola de vidro de 2,3 × 14 mm com duas lâminas de ferro-níquel e terminais longos; ${state}.`;
  },
  view: [0.55, 0.75, 1.4],
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export default function ReedSwitch(props: ReedSwitchProps) {
  const p = { ...meta.defaults, ...props } as Required<ReedSwitchProps>;
  const sensor = p.variant === 'sensor';
  const near = !!p.magnetNear;
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const magnet = useRef<Group>(null);
  const m = sensor ? SENSOR : BARE;

  useSmooth(
    [near ? 1 : 0, p.closed ? 1 : 0],
    ([v, c]) => {
      // The reeds snap shut once the magnet is close enough.
      const closure = Math.max(c!, smoothstep(0.72, 0.9, v!));
      if (left.current) left.current.rotation.z = -REED_ANGLE * closure;
      if (right.current) right.current.rotation.z = REED_ANGLE * closure;
      if (magnet.current) {
        // Hidden away it shrinks to a point inside the part, so it does not
        // widen the framing of the view.
        const shown = v! > 0.01;
        magnet.current.visible = shown;
        magnet.current.scale.setScalar(shown ? 1 : 1e-4);
        magnet.current.position.z = shown ? m.magnetFar + (m.magnetNear - m.magnetFar) * v! : 0;
      }
    },
    6,
  );

  return (
    <group>
      {sensor ? (
        <SensorCase />
      ) : (
        <Capsule left={left} right={right} cy={BARE.cy} lead={BARE.lead} />
      )}
      {sensor && (
        <Explode offset={[0, 9, 0]} delay={0.2}>
          <Capsule left={left} right={right} cy={SENSOR.cy} lead={SENSOR.lead} />
        </Explode>
      )}
      <group
        ref={magnet}
        position={[0, 0, near ? m.magnetNear : 0]}
        scale={near ? 1 : 1e-4}
        visible={near}
      >
        {sensor ? <MagnetCase /> : <BarMagnet />}
      </group>
    </group>
  );
}

/** Glass capsule with the two reeds and the leads, along X at height cy. */
function Capsule({
  left,
  right,
  cy,
  lead,
}: {
  left: RefObject<Group | null>;
  right: RefObject<Group | null>;
  cy: number;
  lead: number;
}) {
  const glass = useDisposable(() => {
    const { r, half } = GLASS;
    const g = axialLathe(
      [
        [LEAD_R + 0.03, -half],
        [0.55, -half + 0.15],
        [0.85, -half + 0.5],
        [1.05, -half + 1],
        [r, -half + 1.5],
        [r, half - 1.5],
        [1.05, half - 1],
        [0.85, half - 0.5],
        [0.55, half - 0.15],
        [LEAD_R + 0.03, half],
      ],
      36,
    );
    g.rotateZ(-Math.PI / 2);
    return g;
  }, []);
  const leadGeometry = useDisposable(() => {
    const length = lead + GLASS.half - REED.root + 0.3;
    const g = new CylinderGeometry(LEAD_R, LEAD_R, length, 12);
    g.rotateZ(Math.PI / 2);
    g.translate(0.3 - length / 2, 0, 0);
    return g;
  }, [lead]);
  const endGeometry = useDisposable(() => new CircleGeometry(LEAD_R, 12), []);

  const nife = { color: '#aeb2b7', metalness: 1, roughness: 0.32 };
  const tin = { preset: 'tin' as const, color: '#dfe2e4', roughness: 0.28 };
  const bladeY = REED.gap / 2 + REED.thick / 2;
  const goldLength = REED.tip * 2 + 0.25;
  const bladeLength = REED_LENGTH - goldLength;

  /**
   * One reed pointing to +X from its root on the axis: lead, flattening and
   * blade offset by `y` (up for one reed, down for the other), gold tip.
   */
  const reed = (y: number) => (
    <>
      <mesh geometry={leadGeometry}>
        <Material {...tin} />
      </mesh>
      <mesh
        geometry={endGeometry}
        position={[-(GLASS.half - REED.root) - lead, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Material {...tin} />
      </mesh>
      {/* Flattening from the round wire to the offset blade. */}
      <mesh
        position={[0.45, y / 2, 0]}
        rotation={[0, 0, Math.atan2(y, 0.9)]}
        scale={[1, REED.thick / (LEAD_R * 2), REED.width / (LEAD_R * 2)]}
      >
        <sphereGeometry args={[LEAD_R * 2, 12, 8]} />
        <Material {...nife} />
      </mesh>
      <mesh position={[0.9 + (bladeLength - 0.9) / 2, y, 0]}>
        <boxGeometry args={[bladeLength - 0.9, REED.thick, REED.width]} />
        <Material {...nife} />
      </mesh>
      <mesh position={[bladeLength + goldLength / 2, y, 0]}>
        <boxGeometry args={[goldLength, REED.thick + 0.01, REED.width + 0.01]} />
        <Material preset="gold" roughness={0.2} />
      </mesh>
    </>
  );

  return (
    <group position={[0, cy, 0]}>
      <Explode offset={[0, 6, 0]} delay={0.1}>
        <mesh geometry={glass} renderOrder={1}>
          <Material preset="glass" thickness={0.5} roughness={0.04} />
        </mesh>
        <Anchor name="ampola" position={[2.5, GLASS.r, 0]} />
      </Explode>
      <Explode offset={[-4, 0, 0]}>
        <group position={[-REED.root, 0, 0]}>
          <group ref={left}>
            {reed(bladeY)}
            <Anchor name="lamina" position={[2.6, bladeY + REED.thick / 2, 0]} />
            <Anchor name="contato" position={[REED_LENGTH - 0.4, bladeY + REED.thick / 2, 0]} />
          </group>
        </group>
      </Explode>
      <Explode offset={[4, 0, 0]}>
        <group position={[REED.root, 0, 0]} rotation={[0, Math.PI, 0]}>
          <group ref={right}>{reed(-bladeY)}</group>
        </group>
      </Explode>
    </group>
  );
}

/** Nickel-plated neodymium bar magnet, magnetised along X. */
function BarMagnet() {
  const poles = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#3a3c40';
      fitText(ctx, 'S', w * 0.12, h / 2, w * 0.15, h * 0.7, { weight: 700, family: FONT_SANS });
      fitText(ctx, 'N', w * 0.88, h / 2, w * 0.15, h * 0.7, { weight: 700, family: FONT_SANS });
    },
    'poles',
    { width: 512, height: 128, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const size: Vec3 = [10, 2.5, 3];
  const body = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, size[0], size[2], 0.35);
    return extrudeUp(s, size[1], 0.2, { curveSegments: 3 });
  }, []);
  return (
    <group>
      <mesh geometry={body}>
        <Material preset="nickel" roughness={0.18} clip />
      </mesh>
      <Decal
        map={poles}
        width={size[0] - 0.6}
        height={(size[0] - 0.6) / 4}
        position={[0, size[1] + 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        clip
      />
      <Anchor name="ima" position={[size[0] / 2 - 1, size[1], 0]} />
    </group>
  );
}

/** Flange with two screw ears and the hollow body on top (sensor and magnet cases). */
function useCaseGeometry() {
  const flange = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, FLANGE.L, FLANGE.W, 3);
    for (const x of [-FLANGE.holeX, FLANGE.holeX]) {
      const hole = new Path();
      hole.absarc(x, 0, FLANGE.holeR, 0, Math.PI * 2, true);
      s.holes.push(hole);
    }
    return extrudeUp(s, FLANGE.T, 0.3, { curveSegments: 16 });
  }, []);
  const body = useDisposable(() => {
    const g = shellGeometry(BODY.L, BODY.H, BODY.W, 2, 1.2, 1);
    g.translate(0, FLANGE.T, 0);
    return g;
  }, []);
  return { flange, body };
}

const WIRE_R = 0.6;

/** Path of the sensor wires: from the reed leads, out through the end wall, along the table. */
function sensorWire(i: number): Vec3[] {
  const cy = SENSOR.cy;
  const z = i === 0 ? 1.8 : -1.8;
  const tail: Vec3[] = [
    [-11.6, 2.9, z],
    [-14, 2.9, z],
    [-22, 2.6, z * 1.4],
    [-30, 1.4, z * 2.2],
    [-36, WIRE_R + 0.05, z * 2.5],
    [-44, WIRE_R + 0.05, z * 2.5],
  ];
  if (i === 0) return [[-9.4, cy, 0], [-10.4, cy - 0.5, 1.1], ...tail];
  return [
    [9.4, cy, 0],
    [10.5, cy - 0.6, -1.3],
    [9.5, 2.9, -3.1],
    [0, 2.9, -3.2],
    [-9.5, 2.9, -3.1],
    ...tail,
  ];
}

const CASE_COLOR = '#f1efe9';
const CASE_CUT = '#cfcbc0';

function SensorCase() {
  const noise = getNoiseTexture();
  const { flange, body } = useCaseGeometry();
  const red = useDisposable(
    () => tube(smoothPath(sensorWire(0), 0.4), WIRE_R, { radial: 10, segments: 150 }),
    [],
  );
  const black = useDisposable(
    () => tube(smoothPath(sensorWire(1), 0.4), WIRE_R, { radial: 10, segments: 150 }),
    [],
  );
  const wires = [red, black];
  const tip = useDisposable(() => {
    const g = new CylinderGeometry(0.36, 0.36, 4, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  }, []);
  const ring = useDisposable(() => new RingGeometry(0.36, WIRE_R, 14), []);

  const mark = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#b8b3a6';
      ctx.fillRect(w * 0.1, h * 0.45, w * 0.8, h * 0.1);
      for (const x of [0.1, 0.9]) {
        ctx.beginPath();
        ctx.moveTo(w * x, h * 0.85);
        ctx.lineTo(w * x - h * 0.3, h * 0.3);
        ctx.lineTo(w * x + h * 0.3, h * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    },
    'reed-mark',
    { width: 512, height: 64 },
  );

  const plastic = {
    color: CASE_COLOR,
    roughness: 0.42,
    roughnessMap: noise,
    clearcoat: 0.15,
    clip: true,
    cutColor: CASE_CUT,
  };
  const colors = ['#c8231b', '#1d1d1f'];
  const ends: Vec3[] = [
    [-44, WIRE_R + 0.05, 4.5],
    [-44, WIRE_R + 0.05, -4.5],
  ];

  return (
    <group>
      <mesh geometry={flange}>
        <Material {...plastic} />
      </mesh>
      <Explode offset={[0, 22, 0]} delay={0.1}>
        <mesh geometry={body}>
          <Material {...plastic} />
        </mesh>
        <Decal
          map={mark}
          width={BODY.L - 6}
          height={(BODY.L - 6) / 8}
          position={[0, BODY_TOP + 0.012, -BODY.W / 2 + 2.2]}
          rotation={[-Math.PI / 2, 0, 0]}
          clip
        />
      </Explode>
      {wires.map((g, i) => (
        <group key={i}>
          <mesh geometry={g}>
            <Material color={colors[i]} roughness={0.4} clearcoat={0.2} />
          </mesh>
          <mesh geometry={ring} position={ends[i]} rotation={[0, -Math.PI / 2, 0]}>
            <Material color={colors[i]} roughness={0.6} />
          </mesh>
          <mesh geometry={tip} position={[ends[i]![0] - 2, ends[i]![1], ends[i]![2]]}>
            <Material preset="tin" color="#d9d6cf" roughness={0.35} />
          </mesh>
          {/* Solder joint on the reed lead. */}
          <mesh position={[i === 0 ? -9.6 : 9.6, SENSOR.cy, 0]}>
            <sphereGeometry args={[0.75, 14, 10]} />
            <Material preset="solder" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The magnet case: same housing, a ferrite bar inside, no wires. */
function MagnetCase() {
  const noise = getNoiseTexture();
  const { flange, body } = useCaseGeometry();
  const plastic = {
    color: CASE_COLOR,
    roughness: 0.42,
    roughnessMap: noise,
    clearcoat: 0.15,
    clip: true,
    cutColor: CASE_CUT,
  };
  return (
    <group>
      <mesh geometry={flange}>
        <Material {...plastic} />
      </mesh>
      <mesh geometry={body}>
        <Material {...plastic} />
      </mesh>
      <mesh position={[0, FLANGE.T + 2.4, 0]}>
        <boxGeometry args={[16, 3.6, 5]} />
        <Material preset="ferrite" roughness={0.75} />
      </mesh>
      <Anchor name="ima" position={[BODY.L / 2 - 2, BODY_TOP, BODY.W / 2]} />
    </group>
  );
}
