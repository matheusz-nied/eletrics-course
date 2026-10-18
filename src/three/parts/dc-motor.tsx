/**
 * Small brushed DC motors with permanent magnets, the hobby sizes "130"
 * (Ø 20,4 mm, flats 15,1 mm apart, 25,1 mm long), "280" (Ø 24,4 × 18 ×
 * 30,5 mm) and "385" (Ø 27,7 × 22,5 × 38 mm), as in catalogue drawings of
 * RF-130/RF-280/RS-385 type motors: nickel-plated steel can with two flats,
 * front bearing boss with the shaft and two mounting holes, plastic end cap
 * with the brass terminal tabs and a red dot by the positive terminal.
 * Inside: two arc-shaped ferrite magnets, a 3-pole laminated rotor with its
 * windings, a 3-segment commutator and two leaf brushes.
 * The rotor turns at a viewable speed that grows with the rpm (slowly above
 * 60 rpm, so fast motors do not strobe). Exploded view: end cap and rotor
 * pulled out backwards, magnets out sideways. Cutaway: can, magnet, cap,
 * terminals and brushes cut; the rotor stays whole.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import {
  ExtrudeGeometry,
  LatheGeometry,
  Path,
  Shape,
  Vector2,
  type BufferGeometry,
  type Group,
} from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { formatNumber } from '../core/format';
import { useReducedMotion } from '../core/motion';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import type { PartAnnotation, PartMeta, PartProps } from '../types';
import {
  lathe,
  roundedRectShell,
  sharpenProfile,
  scaleUv,
  useGeometrySet,
  useLaminationTexture,
  useTurnsTexture,
} from './_power-shared';

type Size = '130' | '280' | '385';
type Direction = 'horario' | 'anti-horario';

export interface DcMotorProps {
  size?: Size;
  /** Speed (rpm); 0 = stopped. */
  rpm?: number;
  /** Direction seen from the shaft end. */
  direction?: Direction;
  /** Brass pinion on the shaft. */
  pinion?: boolean;
}

/** Diameter, distance between the flats, length (can + cap), shaft, front boss, mounting holes (mm). */
const SIZES: Record<
  Size,
  {
    D: number;
    F: number;
    L: number;
    shaft: number;
    shaftLen: number;
    boss: number;
    bossH: number;
    holes: number;
    volts: string;
    cap: string;
  }
> = {
  '130': {
    D: 20.4,
    F: 15.1,
    L: 25.1,
    shaft: 2,
    shaftLen: 9.5,
    boss: 6.15,
    bossH: 1.6,
    holes: 12,
    volts: '1,5 a 6 V',
    cap: '#ece6d6',
  },
  '280': {
    D: 24.4,
    F: 18,
    L: 30.5,
    shaft: 2,
    shaftLen: 11,
    boss: 6.9,
    bossH: 1.8,
    holes: 15,
    volts: '3 a 6 V',
    cap: '#ece6d6',
  },
  '385': {
    D: 27.7,
    F: 22.5,
    L: 38,
    shaft: 2.3,
    shaftLen: 12,
    boss: 9,
    bossH: 2,
    holes: 17,
    volts: '6 a 12 V',
    cap: '#232325',
  },
};

function sizeOf(p: PartProps): Size {
  const s = String(p.size);
  return s === '280' || s === '385' ? s : '130';
}

/** Proportions of the inside, from the outside size. */
function inside(size: Size) {
  const { D, L, shaft } = SIZES[size];
  const R = D / 2;
  const t = 0.022 * D;
  const tm = 0.12 * D;
  const rmIn = R - t - tm;
  const rr = rmIn - 0.35;
  return {
    R,
    t,
    rmIn,
    rr,
    rs: rr - 0.07 * D,
    rh: shaft / 2 + 0.9,
    w: 0.06 * D,
    build: 0.045 * D,
    stack: 0.4 * L,
    xr: 0.08 * L,
    magnetLen: 0.5 * L,
    xm: 0.06 * L,
    capLen: 0.24 * L,
    capOut: 0.14 * L,
    rc: shaft / 2 + 0.9,
    commLen: 0.1 * L,
  };
}

/** Viewable turns per second: true speed up to 60 rpm, then slowly growing. */
function visualRps(rpm: number): number {
  const r = Math.abs(rpm);
  if (r <= 60) return r / 60;
  return 1 + 0.9 * Math.log10(r / 60);
}

export const meta: PartMeta = {
  id: 'dc-motor',
  label: 'Motor CC',
  category: 'saidas',
  summary:
    'Motorzinho de corrente contínua com ímãs permanentes (tamanhos 130, 280 e 385): carcaça, ímãs, rotor com três bobinas, comutador e escovas.',
  defaults: { size: '130', rpm: 0, direction: 'horario', pinion: false },
  controls: {
    size: {
      kind: 'select',
      label: 'Tamanho',
      options: [
        { value: '130', label: '130 (Ø 20 mm, 1,5 a 6 V)' },
        { value: '280', label: '280 (Ø 24 mm, 3 a 6 V)' },
        { value: '385', label: '385 (Ø 28 mm, 6 a 12 V)' },
      ],
    },
    rpm: { kind: 'number', label: 'Rotação', min: 0, max: 15000, step: 100, unit: 'rpm' },
    direction: {
      kind: 'select',
      label: 'Sentido (visto pelo eixo)',
      options: [
        { value: 'horario', label: 'Horário' },
        { value: 'anti-horario', label: 'Anti-horário' },
      ],
    },
    pinion: { kind: 'toggle', label: 'Engrenagem no eixo' },
  },
  annotations: (p) => {
    const size = sizeOf(p);
    const { L, F, bossH, shaftLen } = SIZES[size];
    const { R, t, capOut } = inside(size);
    const zt = R - t - 2.2;
    const list: PartAnnotation[] = [
      {
        at: [-L / 2 - 2.5, F / 2, zt],
        text: 'Terminais: invertendo os fios, o motor gira ao contrário',
        exploded: false,
      },
      {
        at: [-L / 2, F / 2 + F * 0.25, zt],
        text: 'Ponto vermelho: terminal positivo',
        exploded: false,
      },
      {
        at: [L * 0.1, F, R * 0.5],
        text: 'Carcaça de aço: fecha o caminho do campo dos ímãs',
        exploded: false,
      },
      {
        at: [L / 2 + bossH + shaftLen * 0.6, F / 2, 0],
        text: p.pinion ? 'Engrenagem (pinhão) no eixo' : 'Eixo: gira com o rotor',
        exploded: false,
      },
      {
        at: [-L / 2 + capOut * 0.5, F * 0.85, -R * 0.4],
        text: 'Tampa de plástico com as escovas',
        exploded: false,
      },
      { at: [0, 0, 0], text: 'Ímãs de ferrite', anchor: 'magnet', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Rotor: três bobinas em chapas de aço',
        anchor: 'rotor',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Comutador: troca a bobina ligada enquanto o rotor gira',
        anchor: 'commutator',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Escovas: levam a corrente ao comutador',
        anchor: 'brush',
        exploded: true,
      },
    ];
    return list;
  },
  explode: true,
  cutaway: true,
  animated: (p) => Number(p.rpm) > 0,
  describe: (p) => {
    const size = sizeOf(p);
    const { D, F, L, volts } = SIZES[size];
    const rpm = Number(p.rpm) || 0;
    const sense = p.direction === 'anti-horario' ? 'anti-horário' : 'horário';
    const state =
      rpm > 0
        ? ` Girando a ${formatNumber(rpm)} rpm no sentido ${sense}, visto pelo lado do eixo (a animação mostra uma rotação bem mais lenta).`
        : ' Parado.';
    const pinion = p.pinion ? ', com uma engrenagem de latão no eixo' : '';
    return `Motor de corrente contínua tamanho ${size} (Ø ${formatNumber(D)} mm, lados achatados a ${formatNumber(F)} mm, ${formatNumber(L)} mm de comprimento), para ${volts}${pinion}. Carcaça de aço niquelado com dois ímãs de ferrite por dentro, rotor de três polos com bobinas de fio esmaltado, comutador de cobre e duas escovas ligadas aos terminais da tampa.${state}`;
  },
  view: [0.85, 0.55, 1.15],
};

/** Outline of the can section in (y, z): a circle cut by the two flats. Shape coordinates are (−z, y). */
function canOutline<T extends Path>(shape: T, r: number, flat: number, steps = 18): T {
  const a0 = Math.acos(Math.min(flat / r, 0.999));
  const arcs: [number, number][] = [
    [a0, Math.PI - a0],
    [Math.PI + a0, 2 * Math.PI - a0],
  ];
  let first = true;
  for (const [from, to] of arcs)
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      const y = r * Math.cos(a);
      const z = r * Math.sin(a);
      if (first) shape.moveTo(-z, y);
      else shape.lineTo(-z, y);
      first = false;
    }
  shape.closePath();
  return shape;
}

/** Extrusion of a section in (−z, y) along +X from x0 to x1. */
function alongX(shape: Shape, x0: number, x1: number, curveSegments = 12) {
  const g = new ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
}

/** The 3-pole lamination outline (y, z) → shape (−z, y). */
function armatureShape(rr: number, rs: number, rh: number, w: number, phi: number) {
  const pts: [number, number][] = [];
  const P = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
  const dh = Math.sqrt(rh * rh - w * w);
  const ds = Math.sqrt(rs * rs - w * w);
  const sh = Math.asin(w / rh);
  const ss = Math.asin(w / rs);
  for (let k = 0; k < 3; k++) {
    const th = Math.PI / 2 + (k * 2 * Math.PI) / 3;
    const u: [number, number] = [Math.cos(th), Math.sin(th)];
    const v: [number, number] = [-Math.sin(th), Math.cos(th)];
    const edge = (d: number, s: number): [number, number] => [
      u[0] * d + v[0] * w * s,
      u[1] * d + v[1] * w * s,
    ];
    // Minus edge of the stem, out to the shoe.
    pts.push(edge(dh, -1), edge(ds, -1));
    // Inner side of the shoe, backwards to its tip.
    for (let i = 1; i <= 4; i++) pts.push(P(rs, th - ss - ((phi - ss) * i) / 4));
    // Pole face.
    for (let i = 0; i <= 10; i++) pts.push(P(rr, th - phi + (2 * phi * i) / 10));
    // Other tip, inner side back to the stem.
    for (let i = 0; i < 4; i++) pts.push(P(rs, th + phi - ((phi - ss) * i) / 4));
    pts.push(edge(ds, 1), edge(dh, 1));
    // Hub arc to the next pole.
    const a0 = th + sh;
    const a1 = th + (2 * Math.PI) / 3 - sh;
    for (let i = 1; i < 6; i++) pts.push(P(rh, a0 + ((a1 - a0) * i) / 6));
  }
  const shape = new Shape();
  pts.forEach(([y, z], i) => (i === 0 ? shape.moveTo(-z, y) : shape.lineTo(-z, y)));
  shape.closePath();
  return shape;
}

export default function DcMotor(props: DcMotorProps) {
  const p = { ...meta.defaults, ...props } as Required<DcMotorProps>;
  const size = sizeOf(p as unknown as PartProps);
  const { F, L, shaft, shaftLen, boss, bossH, holes, cap } = SIZES[size];
  const m = inside(size);
  const { R, t, rmIn, rr, rs, rh, w, build, stack, xr, magnetLen, xm, capLen, capOut, rc } = m;
  const noise = getNoiseTexture();
  const zt = R - t - 2.2;
  const xComm = -L / 2 + capLen * 0.55;
  const tabLen = 4.5;
  const shaftEnd = L / 2 + bossH + shaftLen;

  const geo = useGeometrySet(() => {
    const flat = F / 2;
    // Can wall (a closed ring, so the cutaway shows its thickness) and front plate.
    const wallShape = canOutline(new Shape(), R, flat);
    wallShape.holes.push(canOutline(new Path(), R - t, flat - t));
    const can = alongX(wallShape, -L / 2 + capOut, L / 2 - t);
    const front = alongX(canOutline(new Shape(), R, flat), L / 2 - t, L / 2);
    const frontBoss = lathe(
      [
        [shaft / 2 + 0.05, 0],
        [boss / 2, 0],
        [boss / 2, bossH - 0.25],
        [boss / 2 - 0.25, bossH],
        [shaft / 2 + 0.05, bossH],
        [shaft / 2 + 0.05, 0],
      ],
      36,
    )
      .rotateZ(-Math.PI / 2)
      .translate(L / 2, 0, 0);

    // End cap: wall and back plate, inside the can's open end.
    const rCap = R - t - 0.02;
    const capWallShape = canOutline(new Shape(), rCap, flat - t - 0.02);
    capWallShape.holes.push(canOutline(new Path(), rCap - 0.8, flat - t - 0.82));
    const capWall = alongX(capWallShape, -L / 2 + 1.2, -L / 2 + capLen);
    const capBack = alongX(canOutline(new Shape(), rCap, flat - t - 0.02), -L / 2, -L / 2 + 1.2);
    const rearBoss = lathe(
      [
        [0, 0],
        [2.4, 0],
        [2.4, 0.8],
        [2.1, 1.1],
        [0, 1.1],
      ],
      28,
    )
      .rotateZ(Math.PI / 2)
      .translate(-L / 2, 0, 0);

    // Arc magnets on the round sides (±Z), 110° each.
    const magnetShape = new Shape();
    // As wide as the flats allow (≤ 55° each side of the round side).
    const span = Math.min((55 * Math.PI) / 180, Math.asin((flat - t) / (R - t)) - 0.04);
    const ro = R - t - 0.02;
    const arc = (r: number, from: number, to: number, first: boolean) => {
      for (let i = 0; i <= 14; i++) {
        const a = from + ((to - from) * i) / 14;
        const y = r * Math.cos(a);
        const z = r * Math.sin(a);
        if (first && i === 0) magnetShape.moveTo(-z, y);
        else magnetShape.lineTo(-z, y);
      }
    };
    arc(ro, Math.PI / 2 - span, Math.PI / 2 + span, true);
    arc(rmIn, Math.PI / 2 + span, Math.PI / 2 - span, false);
    magnetShape.closePath();
    const magnet = alongX(magnetShape, xm - magnetLen / 2, xm + magnetLen / 2);

    // Rotor: laminated armature (caps and laminated sides as two groups).
    const armature = alongX(
      armatureShape(rr, rs, rh, w, (50 * Math.PI) / 180),
      xr - stack / 2,
      xr + stack / 2,
      6,
    );
    scaleUv(armature, 0.05, 1 / (0.35 * 8));
    const windings = [0, 1, 2].map((k) => {
      const g = roundedRectShell(
        2 * w + 2 * build,
        stack + 2 * build,
        build * 0.95,
        rh + 0.25,
        rs - 0.25,
        build,
        6,
      );
      scaleUv(g, 1, (rs - rh - 0.5) / (0.22 * 8));
      g.rotateY(Math.PI / 2);
      // Pole k points at angle π/2 + k·120° in (y, z); rotateX(α) points +Y at (cos α, sin α).
      g.rotateX(Math.PI / 2 + (k * 2 * Math.PI) / 3);
      g.translate(xr, 0, 0);
      return g;
    });
    // Commutator: three copper segments of 110° with 10° gaps.
    const ring = sharpenProfile([
      [shaft / 2, 0],
      [rc, 0],
      [rc, m.commLen],
      [shaft / 2, m.commLen],
      [shaft / 2, 0],
    ]).map(([r, y]) => new Vector2(r, y));
    const commutator = [0, 1, 2].map((k) =>
      new LatheGeometry(ring, 10, (k * 2 * Math.PI) / 3, (110 * Math.PI) / 180)
        .rotateZ(-Math.PI / 2)
        .translate(xComm - m.commLen / 2, 0, 0),
    );
    const shaftGeo = lathe(
      [
        [0, 0],
        [shaft / 2 - 0.15, 0],
        [shaft / 2, 0.15],
        [shaft / 2, shaftEnd + L / 2 + 0.6 - 0.15],
        [shaft / 2 - 0.15, shaftEnd + L / 2 + 0.6],
        [0, shaftEnd + L / 2 + 0.6],
      ],
      20,
    )
      .rotateZ(-Math.PI / 2)
      .translate(-L / 2 - 0.6, 0, 0);

    // Pinion: 10 teeth, module 0,5 (Ø 6 mm outside).
    const gear = new Shape();
    const teeth = 10;
    const rTip = 3;
    const rRoot = 2.25;
    for (let i = 0; i < teeth; i++) {
      const c = (i * 2 * Math.PI) / teeth;
      const half = Math.PI / teeth;
      const pts: [number, number][] = [
        [rRoot, c - half * 0.55],
        [rTip, c - half * 0.28],
        [rTip, c + half * 0.28],
        [rRoot, c + half * 0.55],
        [rRoot, c + half * 1.45],
      ];
      pts.forEach(([r, a], j) => {
        const y = r * Math.cos(a);
        const z = r * Math.sin(a);
        if (i === 0 && j === 0) gear.moveTo(-z, y);
        else gear.lineTo(-z, y);
      });
    }
    gear.closePath();
    const bore = new Path();
    bore.absarc(0, 0, shaft / 2, 0, Math.PI * 2, true);
    gear.holes.push(bore);
    const pinion = alongX(gear, shaftEnd - 5, shaftEnd - 0.6, 4);

    // Terminal tab (lies flat, broad face up), with its hole; at +Z, mirrored for −Z.
    const tab = new Shape();
    tab.moveTo(-L / 2 - tabLen + 0.6, zt - 1.1);
    tab.lineTo(-L / 2 + 2.2, zt - 1.1);
    tab.lineTo(-L / 2 + 2.2, zt + 1.1);
    tab.lineTo(-L / 2 - tabLen + 0.6, zt + 1.1);
    tab.quadraticCurveTo(-L / 2 - tabLen, zt + 1.1, -L / 2 - tabLen, zt + 0.5);
    tab.lineTo(-L / 2 - tabLen, zt - 0.5);
    tab.quadraticCurveTo(-L / 2 - tabLen, zt - 1.1, -L / 2 - tabLen + 0.6, zt - 1.1);
    const tabHole = new Path();
    tabHole.absarc(-L / 2 - tabLen + 1.3, zt, 0.55, 0, Math.PI * 2, true);
    tab.holes.push(tabHole);
    const terminal = new ExtrudeGeometry(tab, {
      depth: 0.3,
      bevelEnabled: false,
      curveSegments: 10,
    });
    // Shape (x, z) → extrusion along −Y after the turn.
    terminal.rotateX(Math.PI / 2);
    terminal.translate(0, 0.15, 0);
    // Extrusions have flat-shaded sides: smooth the round parts, keep the edges.
    const smooth = (g: BufferGeometry) => toCreasedNormals(g, Math.PI / 7);
    return {
      can: smooth(can),
      front,
      frontBoss,
      capWall: smooth(capWall),
      capBack: smooth(capBack),
      rearBoss,
      magnet: smooth(magnet),
      armature,
      winding0: windings[0]!,
      winding1: windings[1]!,
      winding2: windings[2]!,
      comm0: commutator[0]!,
      comm1: commutator[1]!,
      comm2: commutator[2]!,
      shaft: shaftGeo,
      pinion,
      terminal,
    };
  }, [size]);

  const lamColor = useLaminationTexture('color');
  const lamRough = useLaminationTexture('rough');
  const turnsMap = useTurnsTexture('color', '#b4582c');
  const turnsBump = useTurnsTexture('bump');

  // Rotor speed.
  const reduced = useReducedMotion();
  const rotor = useRef<Group>(null);
  const rpm = Math.max(Number(p.rpm) || 0, 0);
  const rps = Math.min(visualRps(rpm), reduced ? 0.25 : Infinity);
  const sense = p.direction === 'anti-horario' ? 1 : -1;
  useFrame((_, dt) => {
    if (!rotor.current || rps === 0) return;
    rotor.current.rotation.x += sense * 2 * Math.PI * rps * Math.min(dt, 0.05);
  });

  const canMaterial = (
    <Material
      preset="nickel"
      color="#dcdad5"
      roughness={0.24}
      roughnessMap={noise}
      clip
      cutColor="#6b6d70"
    />
  );
  const capMaterial = (
    <Material
      color={cap}
      roughness={0.55}
      roughnessMap={noise}
      clip
      cutColor={size === '385' ? '#141416' : '#d6cfbc'}
    />
  );
  const brushes = ([1, -1] as const).map((s) => (
    <group key={s}>
      {/* Leaf from the terminal to the commutator, pressing on its side. */}
      <mesh position={[xComm, 0.35 * s, s * (rc + (zt - rc) / 2)]} rotation={[s * 0.12, 0, 0]}>
        <boxGeometry args={[1.6, 0.18, zt - rc + 0.4]} />
        <Material preset="brass" color="#d6a866" roughness={0.3} clip />
      </mesh>
    </group>
  ));

  return (
    <group position={[0, F / 2, 0]}>
      {/* Can and the front with its boss and mounting holes. */}
      <mesh geometry={geo.can}>{canMaterial}</mesh>
      <mesh geometry={geo.front}>{canMaterial}</mesh>
      <mesh geometry={geo.frontBoss}>{canMaterial}</mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[L / 2 + 0.01, 0, (s * holes) / 2]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[1.1, 20]} />
          <Material color="#151517" roughness={0.9} clip />
        </mesh>
      ))}

      {/* Magnets. */}
      {([1, -1] as const).map((s) => (
        <Explode key={s} offset={[0, 0, s * R * 1.25]} delay={0.3}>
          <mesh geometry={geo.magnet} scale={[1, 1, s]}>
            <Material
              preset="ferrite"
              color="#3a3a3d"
              roughness={0.78}
              roughnessMap={noise}
              clip
              cutColor="#2b2b2d"
            />
          </mesh>
          {s === 1 && <Anchor name="magnet" position={[xm, R * 0.4, rmIn + 1]} />}
        </Explode>
      ))}

      {/* Rotor: shaft, armature, windings, commutator (and the pinion). Not cut. */}
      <Explode offset={[-L * 1.15, 0, 0]} delay={0.15}>
        <group ref={rotor}>
          <mesh geometry={geo.shaft}>
            <Material preset="steel" color="#d2d4d7" roughness={0.2} />
          </mesh>
          <mesh geometry={geo.armature}>
            <Material attach="material-0" preset="siliconSteel" color="#8a8e93" roughness={0.42} />
            <Material
              attach="material-1"
              preset="siliconSteel"
              color="#ffffff"
              map={lamColor}
              roughnessMap={lamRough}
              roughness={0.6}
            />
          </mesh>
          {[geo.winding0, geo.winding1, geo.winding2].map((g, i) => (
            <mesh key={i} geometry={g}>
              <Material
                preset="magnetWire"
                color="#ffffff"
                map={turnsMap}
                bumpMap={turnsBump}
                bumpScale={0.5}
              />
            </mesh>
          ))}
          {[geo.comm0, geo.comm1, geo.comm2].map((g, i) => (
            <mesh key={i} geometry={g}>
              <Material preset="copper" roughness={0.28} />
            </mesh>
          ))}
          {p.pinion && (
            <mesh geometry={geo.pinion}>
              <Material preset="brass" roughness={0.3} roughnessMap={noise} />
            </mesh>
          )}
        </group>
        <Anchor name="rotor" position={[xr, rr, 0]} />
        <Anchor name="commutator" position={[xComm, rc, 0]} />
      </Explode>

      {/* End cap with terminals and brushes. */}
      <Explode offset={[-L * 2.2, 0, 0]}>
        <mesh geometry={geo.capWall}>{capMaterial}</mesh>
        <mesh geometry={geo.capBack}>{capMaterial}</mesh>
        <mesh geometry={geo.rearBoss}>{capMaterial}</mesh>
        {([1, -1] as const).map((s) => (
          <mesh key={s} geometry={geo.terminal} scale={[1, 1, s]}>
            <Material preset="brass" roughness={0.26} roughnessMap={noise} clip />
          </mesh>
        ))}
        {brushes}
        <mesh position={[-L / 2 - 0.01, F * 0.24, zt]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.9, 20]} />
          <Material color="#d0231c" roughness={0.5} clip />
        </mesh>
        <Anchor name="brush" position={[xComm, 0, -(rc + zt) / 2]} />
      </Explode>
    </group>
  );
}
