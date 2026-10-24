/**
 * Didactic alternating-current generator on a wooden base, turned by a hand
 * crank, in the size of a school demonstration set (base 180 × 110 mm, shaft
 * 75 mm above the board). Two layouts:
 *
 * - phases: 1, the textbook generator (the same as lesson 5.3): a coil turns
 *   between the poles of a magnet (north painted red, south blue, as the
 *   course colours them). Each end of the coil goes to its own slip ring, and
 *   two carbon brushes take the voltage to the output terminals without
 *   twisting the wires. One turn gives one cycle of the sine.
 * - phases: 3, the layout of real alternators: the magnet turns (rotor) and
 *   three fixed coils on a laminated steel ring (stator), 120° apart, give
 *   three sines shifted by a third of a turn. No sliding contact carries the
 *   output: each coil goes straight to its terminal (L1, L2, L3) and the
 *   other three ends are joined (star point) at the neutral terminal (N).
 *
 * The rotor turns slowly enough to follow (`rpm`, true speed up to 120 rpm).
 * Exploded view: the poles (or the stator) pull away from the rotor.
 * Cutaway: cuts the stator ring and the coils so the turning magnet shows.
 */
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type { BufferGeometry, Group } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { formatNumber } from '../core/format';
import { useReducedMotion } from '../core/motion';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { roundedPath, tube } from '../shapes/geometry';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { Decal } from './_em-kit';
import {
  lathe,
  roundedRectShell,
  roundedRectSlab,
  scaleUv,
  useGeometrySet,
  useLaminationTexture,
  useTurnsTexture,
} from './_power-shared';

export interface AcGeneratorProps {
  /** 1: coil turning between two poles, with slip rings; 3: magnet turning inside three coils. */
  phases?: 1 | 3;
  /** The crank turns on its own. */
  running?: boolean;
  /** Turning speed (rpm). */
  rpm?: number;
}

/* Base board, shaft height and bearing posts (mm). */
const BASE = { x: 180, z: 110, y: 12 };
const H = 75;
const SHAFT_R = 3;
const SHAFT_X: [number, number] = [-66, 64];
const POSTS = [-58, 44];
const POST = { x: 8, z: 18 };
const CRANK_X = 52;
const CRANK_ARM = 32;

/* phases: 1. Magnet yoke, poles and the turning coil. */
/** Horseshoe magnet: arm thickness, gap from the shaft to each arm, back and front edges (z). */
const POLE = { x: 48, t: 14, gap: 26, back: -32, front: 20, web: 8 };
const LOOP = { x: 56, z: 40, h: 4, t: 3 };
const RINGS = [-38, -46];
const RING_R = 8;
const RING_W = 4;
const BRUSH = { x: 4, y: 7, z: 6 };

/* phases: 3. Stator ring, teeth, coils and the magnet rotor. */
const STATOR = { rOut: 44, rIn: 34, half: 14 };
const TOOTH = { rTip: 24, w: 12 };
const COIL = { r0: 25, r1: 33, t: 4 };
const ROTOR = { r: 20, w: 14, half: 12 };
const ANGLES = [90, 210, 330].map((a) => (a * Math.PI) / 180);
/** Star point of the three coils, under the ring at its back end. */
const STAR: Vec3 = [-20, 25, 0];

/* Terminals on the front edge of the board. */
const TERM_Z = 44;
const TERMINALS_1 = [-72, -54];
const TERMINALS_3 = [-78, -64, -50, -36];

const WOOD = '#c39d72';
const RED = '#c4262b';
const BLUE = '#1d4e9e';

const N_UP: Vec3 = [0, 0, 0];
const ROTOR_OUT: Vec3 = [0, 0, 62];
/** The rotor starts a little turned, so the coil is not seen edge-on. */
const START_ANGLE: Vec3 = [-0.6, 0, 0];

function phasesOf(p: PartProps): 1 | 3 {
  return Number(p.phases) === 3 ? 3 : 1;
}

/** Turns per second on screen: the true speed, capped so it never strobes. */
export function visualRps(rpm: number, reduced = false): number {
  const rps = Math.min(Math.max(rpm, 0), 120) / 60;
  return reduced ? Math.min(rps, 0.25) : rps;
}

export const meta: PartMeta = {
  id: 'ac-generator',
  label: 'Gerador de corrente alternada',
  category: 'energia',
  summary:
    'Gerador didático de manivela: uma bobina girando entre os polos de um ímã, com anéis coletores e escovas, ou um ímã girando dentro de três bobinas a 120° (gerador trifásico).',
  defaults: { phases: 1, running: true, rpm: 30 },
  controls: {
    phases: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 1, label: 'Monofásico (bobina girando)' },
        { value: 3, label: 'Trifásico (ímã girando)' },
      ],
    },
    running: { kind: 'toggle', label: 'Girando' },
    rpm: { kind: 'number', label: 'Rotação', min: 5, max: 120, step: 5, unit: 'rpm' },
  },
  annotations: (p) => {
    const crank: PartAnnotation = {
      at: [CRANK_X + 4, H + CRANK_ARM * 0.6, 8],
      text: 'Manivela: quem gira dá a energia',
      exploded: false,
    };
    if (phasesOf(p) === 1) {
      return [
        {
          at: [0, H + POLE.gap + POLE.t, POLE.front - 6],
          text: 'Polo norte (N) do ímã',
          exploded: false,
        },
        {
          at: [0, H - POLE.gap - POLE.t / 2, POLE.front],
          text: 'Polo sul (S)',
          exploded: false,
        },
        {
          at: [LOOP.x / 2, H, LOOP.z / 2],
          text: 'Bobina: gira no campo do ímã',
          exploded: false,
        },
        {
          at: [RINGS[0]! - 4, H + RING_R + 2, 0],
          text: 'Anéis coletores: um para cada ponta da bobina',
          exploded: false,
        },
        {
          at: [RINGS[1]!, H - RING_R - BRUSH.y, BRUSH.z / 2 + 2],
          text: 'Escovas de carvão: levam a tensão para fora sem torcer os fios',
          exploded: false,
        },
        {
          at: [(TERMINALS_1[0]! + TERMINALS_1[1]!) / 2, BASE.y + 14, TERM_Z],
          text: 'Saída CA: um ciclo da senoide a cada volta',
          exploded: false,
        },
        crank,
        { at: [0, 0, 0], text: 'Polos do ímã', anchor: 'pole', exploded: true },
        {
          at: [0, 0, 0],
          text: 'Bobina, eixo e anéis coletores (o rotor)',
          anchor: 'rotor',
          exploded: true,
        },
      ];
    }
    return [
      {
        at: [0, H + STATOR.rOut, 0],
        text: 'Estator: anel de chapas de aço com três bobinas fixas',
        exploded: false,
      },
      {
        at: [STATOR.half, H, 0],
        text: 'Rotor: ímã que gira dentro das bobinas',
        exploded: false,
      },
      {
        at: [-STATOR.half, H - 26, 24],
        text: 'Bobinas a 120°: cada uma dá uma senoide, atrasada um terço de volta',
        exploded: false,
      },
      {
        at: [(TERMINALS_3[0]! + TERMINALS_3[2]!) / 2, BASE.y + 14, TERM_Z],
        text: 'Saídas L1, L2 e L3: as três fases',
        exploded: false,
      },
      {
        at: [TERMINALS_3[3]!, BASE.y + 14, TERM_Z],
        text: 'Neutro (N): as outras pontas das três bobinas, unidas',
        exploded: false,
      },
      crank,
      { at: [0, 0, 0], text: 'Estator com as três bobinas', anchor: 'stator', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Rotor: ímã com polo norte (vermelho) e sul (azul)',
        anchor: 'magnet',
        exploded: true,
      },
    ];
  },
  explode: true,
  cutaway: true,
  animated: (p) => p.running === true && Number(p.rpm) > 0,
  describe: (p) => {
    const rpm = Number(p.rpm) || 0;
    const state =
      p.running === true && rpm > 0
        ? ` Girando a ${formatNumber(rpm)} rpm: ${formatNumber(rpm / 60, 2)} volta${rpm === 60 ? '' : 's'} por segundo, ${formatNumber(rpm / 60, 2)} Hz na saída.`
        : ' Parado.';
    if (phasesOf(p) === 1)
      return `Gerador monofásico didático numa base de madeira: uma bobina de fio de cobre gira, presa ao eixo, entre o polo norte (vermelho) e o polo sul (azul) de um ímã. Cada ponta da bobina vai para um anel coletor no eixo; duas escovas de carvão encostadas nos anéis levam a tensão aos dois bornes da saída CA. Uma manivela gira o eixo.${state}`;
    return `Gerador trifásico didático numa base de madeira: um ímã (polo norte vermelho, polo sul azul) gira no eixo dentro de um anel de chapas de aço com três bobinas fixas, a 120° uma da outra. Cada bobina vai a um borne (L1, L2 e L3); as outras três pontas se unem no borne do neutro (N). Uma manivela gira o eixo.${state}`;
  },
  view: [0.8, 0.6, 1.05],
};

/** Box helper: centre and size. */
function Box({ at, size, children }: { at: Vec3; size: Vec3; children: ReactNode }) {
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      {children}
    </mesh>
  );
}

/** A brass binding post with a plastic knob. */
function Terminal({ x, knob }: { x: number; knob: string }) {
  return (
    <group position={[x, BASE.y, TERM_Z]}>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[4.5, 5, 6, 20]} />
        <Material preset="brass" roughness={0.3} />
      </mesh>
      <mesh position={[0, 6 + 4, 0]}>
        <cylinderGeometry args={[4, 4, 8, 6]} />
        <Material color={knob} roughness={0.45} />
      </mesh>
    </group>
  );
}

export default function AcGenerator(props: AcGeneratorProps) {
  const p = { ...meta.defaults, ...props } as Required<AcGeneratorProps>;
  const phases = phasesOf(p as unknown as PartProps);
  const noise = getNoiseTexture();

  const geo = useGeometrySet((): Record<string, BufferGeometry> => {
    const smooth = (g: BufferGeometry) => toCreasedNormals(g, Math.PI / 7);
    const base = roundedRectSlab(BASE.x, BASE.z, 6, 0, BASE.y, 1.5);
    // Shaft along X.
    const shaft = lathe(
      [
        [0, 0],
        [SHAFT_R - 0.3, 0],
        [SHAFT_R, 0.3],
        [SHAFT_R, SHAFT_X[1] - SHAFT_X[0] - 0.3],
        [SHAFT_R - 0.3, SHAFT_X[1] - SHAFT_X[0]],
        [0, SHAFT_X[1] - SHAFT_X[0]],
      ],
      20,
    )
      .rotateZ(-Math.PI / 2)
      .translate(SHAFT_X[0], 0, 0);
    // Crank grip, along +X at the end of the arm.
    const grip = lathe(
      [
        [0, 0],
        [4.5, 0],
        [5.5, 4],
        [5.5, 18],
        [4.5, 22],
        [0, 22],
      ],
      20,
    )
      .rotateZ(-Math.PI / 2)
      .translate(CRANK_X + 3, -CRANK_ARM, 0);
    const bearing = lathe(
      [
        [SHAFT_R + 0.2, 0],
        [7, 0],
        [7, 12],
        [SHAFT_R + 0.2, 12],
        [SHAFT_R + 0.2, 0],
      ],
      24,
    )
      .rotateZ(-Math.PI / 2)
      .translate(-6, 0, 0);
    const wire = (points: Vec3[], r = 0.9) => tube(roundedPath(points, 4), r, { radial: 8 });

    if (phases === 1) {
      // The coil: a bundle of turns around a rectangle in the XZ plane, turning about X.
      const loop = roundedRectShell(LOOP.x, LOOP.z, 5, -LOOP.h / 2, LOOP.h / 2, LOOP.t, 6);
      scaleUv(loop, 1, 1);
      const rings = RINGS.map((x) =>
        lathe(
          [
            [5.8, 0],
            [RING_R, 0],
            [RING_R, RING_W],
            [5.8, RING_W],
            [5.8, 0],
          ],
          32,
        )
          .rotateZ(-Math.PI / 2)
          .translate(x - RING_W / 2, 0, 0),
      );
      const insulator = lathe(
        [
          [SHAFT_R, 0],
          [6, 0],
          [6, 18],
          [SHAFT_R, 18],
          [SHAFT_R, 0],
        ],
        24,
      )
        .rotateZ(-Math.PI / 2)
        .translate(-50, 0, 0);
      // Ends of the coil to the rings (in the rotor's frame, axis at the origin).
      const xl = -LOOP.x / 2 + LOOP.t / 2;
      const lead1 = wire([
        [xl, 0, 8],
        [RINGS[0]!, 0, 8],
        [RINGS[0]!, 0, RING_R - 0.6],
      ]);
      // The far ring's lead runs buried in the insulating sleeve, under the near ring.
      const lead2 = wire([
        [xl, 0, -8],
        [-30, 0, -8],
        [-30, 0, -4.5],
        [RINGS[1]!, 0, -4.5],
        [RINGS[1]!, 0, -RING_R + 0.6],
      ]);
      // Brush springs down to the board, then wires to the output terminals.
      const out = RINGS.map((x, i) => {
        const z = i === 0 ? 36 : 30;
        const term = TERMINALS_1[1 - i]!;
        return wire([
          [x, BASE.y + 6, 3],
          [x, BASE.y + 1, 3],
          [x, BASE.y + 1, z],
          [term, BASE.y + 1, z],
          [term, BASE.y + 1, TERM_Z - 5],
        ]);
      });
      return {
        base,
        shaft,
        grip,
        bearing,
        loop: smooth(loop),
        ring0: rings[0]!,
        ring1: rings[1]!,
        insulator,
        lead1,
        lead2,
        out0: out[0]!,
        out1: out[1]!,
      };
    }

    // Stator: a laminated ring around X with three inward teeth.
    const ring = lathe(
      [
        [STATOR.rIn, 0],
        [STATOR.rOut, 0],
        [STATOR.rOut, 2 * STATOR.half],
        [STATOR.rIn, 2 * STATOR.half],
        [STATOR.rIn, 0],
      ],
      64,
    )
      .rotateZ(-Math.PI / 2)
      .translate(-STATOR.half, 0, 0);
    scaleUv(ring, 1, (2 * STATOR.half) / 4);
    const coil = (a: number) => {
      const g = roundedRectShell(
        2 * STATOR.half + 2 * COIL.t,
        TOOTH.w + 2 * COIL.t,
        COIL.t,
        COIL.r0,
        COIL.r1,
        COIL.t,
        6,
      );
      scaleUv(g, 1, (COIL.r1 - COIL.r0) / 4);
      // +Y of the shell points radially, at (y, z) = (sin a, cos a).
      g.rotateX(Math.PI / 2 - a);
      return g;
    };
    const tooth = (a: number) => {
      const g = roundedRectSlab(2 * STATOR.half, TOOTH.w, 1, TOOTH.rTip, STATOR.rIn + 1, 0.6);
      g.rotateX(Math.PI / 2 - a);
      return g;
    };
    const at = (a: number, r: number, x: number): Vec3 => [x, H + r * Math.sin(a), r * Math.cos(a)];
    // Phase ends: out past the ring, down to the board in their own lane, to L1–L3.
    const phaseLeads = ANGLES.map((a, i) => {
      const exit = at(a, STATOR.rOut + 4, -STATOR.half - 4);
      const x = -24 - 4 * i;
      const z = 14 + 5 * i;
      return wire([
        at(a, COIL.r1 - 1, -STATOR.half - COIL.t + 1),
        exit,
        [x, exit[1], exit[2]],
        [x, exit[1], z],
        [x, BASE.y + 1, z],
        [TERMINALS_3[i]!, BASE.y + 1, z],
        [TERMINALS_3[i]!, BASE.y + 1, TERM_Z - 5],
      ]);
    });
    // The other ends meet at the star point under the ring, which goes to N.
    const starLeads = ANGLES.map((a) => {
      const exit = at(a + 0.25, STATOR.rIn + 4, -STATOR.half - 6);
      return wire(
        [
          at(a + 0.25, COIL.r1 - 1, -STATOR.half - COIL.t + 1),
          exit,
          [STAR[0], exit[1], exit[2]],
          [STAR[0], STAR[1], exit[2]],
          STAR,
        ],
        0.7,
      );
    });
    const neutral = wire([
      STAR,
      [STAR[0], BASE.y + 1, 0],
      [STAR[0], BASE.y + 1, 29],
      [TERMINALS_3[3]!, BASE.y + 1, 29],
      [TERMINALS_3[3]!, BASE.y + 1, TERM_Z - 5],
    ]);
    return {
      base,
      shaft,
      grip,
      bearing,
      ring: smooth(ring),
      tooth0: tooth(ANGLES[0]!),
      tooth1: tooth(ANGLES[1]!),
      tooth2: tooth(ANGLES[2]!),
      coil0: coil(ANGLES[0]!),
      coil1: coil(ANGLES[1]!),
      coil2: coil(ANGLES[2]!),
      lead0: phaseLeads[0]!,
      lead1: phaseLeads[1]!,
      lead2: phaseLeads[2]!,
      star0: starLeads[0]!,
      star1: starLeads[1]!,
      star2: starLeads[2]!,
      neutral,
    };
  }, [phases]);

  const turnsMap = useTurnsTexture('color', '#b4582c');
  const turnsBump = useTurnsTexture('bump');
  const lamColor = useLaminationTexture('color');
  const lamRough = useLaminationTexture('rough');
  const labels = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#2a2018';
      if (phases === 1) {
        fitText(ctx, 'SAÍDA CA', w / 2, h / 2, w * 0.9, h * 0.62, { weight: 700 });
        return;
      }
      ['L1', 'L2', 'L3', 'N'].forEach((t, i) =>
        fitText(ctx, t, ((i + 0.5) * w) / 4, h / 2, w / 4 - 8, h * 0.7, {
          weight: 700,
          family: FONT_SANS,
        }),
      );
    },
    `ac-generator|labels|${phases}`,
    { width: 512, height: 96, fonts: [`700 48px ${FONT_SANS}`] },
  );

  // Rotor speed.
  const reduced = useReducedMotion();
  const rotor = useRef<Group>(null);
  const rps = p.running ? visualRps(Number(p.rpm) || 0, reduced) : 0;
  useFrame((_, dt) => {
    if (!rotor.current || rps === 0) return;
    rotor.current.rotation.x -= 2 * Math.PI * rps * Math.min(dt, 0.05);
  });

  const wood = <Material color={WOOD} roughness={0.78} roughnessMap={noise} />;
  const steel = <Material preset="steel" color="#cfd1d4" roughness={0.25} />;
  const copper = <Material preset="copper" roughness={0.3} />;
  const winding = (
    <Material
      preset="magnetWire"
      color="#ffffff"
      map={turnsMap}
      bumpMap={turnsBump}
      bumpScale={0.5}
      clip={phases === 3}
    />
  );
  const termXs = phases === 1 ? TERMINALS_1 : TERMINALS_3;
  const labelW = phases === 1 ? 40 : 58;
  const labelX = (termXs[0]! + termXs[termXs.length - 1]!) / 2;

  /** One half of the horseshoe: an arm (the pole) and half of the back web. */
  const magnetHalf = (s: 1 | -1) => {
    const paint = <Material color={s === 1 ? RED : BLUE} roughness={0.5} roughnessMap={noise} />;
    return (
      <>
        <Box
          at={[0, H + s * (POLE.gap + POLE.t / 2), (POLE.back + POLE.front) / 2]}
          size={[POLE.x, POLE.t, POLE.front - POLE.back]}
        >
          {paint}
        </Box>
        <Box
          at={[0, H + (s * POLE.gap) / 2, POLE.back + POLE.web / 2]}
          size={[POLE.x, POLE.gap, POLE.web]}
        >
          {paint}
        </Box>
      </>
    );
  };

  return (
    <group>
      {/* Base board, bearing posts, terminals and their labels. */}
      <mesh geometry={geo.base}>{wood}</mesh>
      {POSTS.map((x) => (
        <group key={x}>
          <Box at={[x, (BASE.y + H + 10) / 2, 0]} size={[POST.x, H + 10 - BASE.y, POST.z]}>
            {wood}
          </Box>
          <mesh geometry={geo.bearing} position={[x, H, 0]}>
            <Material preset="brass" roughness={0.3} />
          </mesh>
        </group>
      ))}
      {termXs.map((x, i) => (
        <Terminal
          key={x}
          x={x}
          knob={phases === 3 && i === termXs.length - 1 ? '#3a6fc4' : '#1c1c1e'}
        />
      ))}
      <Decal
        map={labels}
        width={labelW}
        height={(labelW * 96) / 512}
        position={[labelX, BASE.y + 0.05, TERM_Z + 9]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* Rotor: shaft and crank, plus the coil and rings (1) or the magnet (3). */}
      <Explode offset={phases === 1 ? ROTOR_OUT : N_UP}>
        <group position={[0, H, 0]}>
          <group ref={rotor} rotation={START_ANGLE}>
            <mesh geometry={geo.shaft}>{steel}</mesh>
            <Box at={[CRANK_X, -CRANK_ARM / 2, 0]} size={[6, CRANK_ARM + 12, 10]}>
              <Material preset="steel" color="#b8babd" roughness={0.35} />
            </Box>
            <mesh geometry={geo.grip}>
              <Material preset="absRed" roughness={0.45} />
            </mesh>
            {phases === 1 ? (
              <>
                <mesh geometry={geo.loop}>{winding}</mesh>
                {[-1, 1].map((s) => (
                  <Box key={s} at={[(s * (LOOP.x - LOOP.t)) / 2, 0, 0]} size={[5, 8, 10]}>
                    <Material preset="absBlack" roughness={0.5} />
                  </Box>
                ))}
                <mesh geometry={geo.insulator}>
                  <Material preset="absBlack" roughness={0.5} />
                </mesh>
                <mesh geometry={geo.ring0}>{copper}</mesh>
                <mesh geometry={geo.ring1}>{copper}</mesh>
                <mesh geometry={geo.lead1}>{copper}</mesh>
                <mesh geometry={geo.lead2}>{copper}</mesh>
              </>
            ) : (
              <>
                <Box at={[0, ROTOR.r / 2, 0]} size={[2 * ROTOR.half, ROTOR.r, ROTOR.w]}>
                  <Material color={RED} roughness={0.5} roughnessMap={noise} />
                </Box>
                <Box at={[0, -ROTOR.r / 2, 0]} size={[2 * ROTOR.half, ROTOR.r, ROTOR.w]}>
                  <Material color={BLUE} roughness={0.5} roughnessMap={noise} />
                </Box>
              </>
            )}
          </group>
          {phases === 1 ? (
            <Anchor name="rotor" position={[LOOP.x / 2, 0, LOOP.z / 2]} />
          ) : (
            <Anchor name="magnet" position={[0, ROTOR.r, ROTOR.w / 2]} />
          )}
        </group>
      </Explode>

      {phases === 1 ? (
        <>
          {/* Horseshoe magnet lying on its side, open to the front: north arm above the coil, south arm below. */}
          <Box
            at={[0, (BASE.y + H - POLE.gap - POLE.t) / 2, (POLE.back + POLE.front) / 2]}
            size={[POLE.x, H - POLE.gap - POLE.t - BASE.y, POLE.front - POLE.back]}
          >
            {wood}
          </Box>
          <Explode offset={[0, 36, 0]}>
            {magnetHalf(1)}
            <Anchor name="pole" position={[0, H + POLE.gap + POLE.t, POLE.front - 6]} />
          </Explode>
          {magnetHalf(-1)}
          {/* Carbon brushes pressed on the rings by brass springs. */}
          {RINGS.map((x) => (
            <group key={x}>
              <Box at={[x, H - RING_R - BRUSH.y / 2, 0]} size={[BRUSH.x, BRUSH.y, BRUSH.z]}>
                <Material color="#2b2b2d" roughness={0.9} roughnessMap={noise} />
              </Box>
              <Box
                at={[x, (BASE.y + H - RING_R - BRUSH.y) / 2, 3]}
                size={[BRUSH.x + 1, H - RING_R - BRUSH.y - BASE.y, 1]}
              >
                <Material preset="brass" roughness={0.3} />
              </Box>
            </group>
          ))}
          <mesh geometry={geo.out0}>{copper}</mesh>
          <mesh geometry={geo.out1}>{copper}</mesh>
        </>
      ) : (
        <>
          {/* Stator: laminated ring, three teeth and their coils, on two feet. */}
          <Explode offset={[0, 0, -95]}>
            <group position={[0, H, 0]}>
              <mesh geometry={geo.ring}>
                <Material
                  preset="siliconSteel"
                  color="#ffffff"
                  map={lamColor}
                  roughnessMap={lamRough}
                  roughness={0.6}
                  clip
                  cutColor="#6d7176"
                />
              </mesh>
              {[geo.tooth0, geo.tooth1, geo.tooth2].map((g, i) => (
                <mesh key={i} geometry={g}>
                  <Material preset="siliconSteel" color="#8a8e93" roughness={0.45} clip />
                </mesh>
              ))}
              {[geo.coil0, geo.coil1, geo.coil2].map((g, i) => (
                <mesh key={i} geometry={g}>
                  {winding}
                </mesh>
              ))}
              <Anchor name="stator" position={[0, STATOR.rOut, 0]} />
            </group>
          </Explode>
          {[1, -1].map((s) => (
            <Box
              key={s}
              at={[0, (BASE.y + H - 32) / 2, s * 27]}
              size={[2 * STATOR.half, H - 32 - BASE.y, 10]}
            >
              {wood}
            </Box>
          ))}
          {[geo.lead0, geo.lead1, geo.lead2].map((g, i) => (
            <mesh key={i} geometry={g}>
              {copper}
            </mesh>
          ))}
          {[geo.star0, geo.star1, geo.star2, geo.neutral].map((g, i) => (
            <mesh key={i} geometry={g}>
              <Material color="#2f5fb0" roughness={0.45} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
