/**
 * Hobby micro servo "9 g" (the SG90 class, as in the usual datasheet
 * drawing): case 22,8 × 12,2 mm, 22,5 mm tall to the top cover, mounting
 * ears 2,5 mm thick spanning 32,3 mm with Ø 2 mm holes (slotted to the end),
 * round tower over the output and a small bump over the idler pin, Ø 4,8 mm
 * output spline about 29 mm above the base. Three-wire lead: brown = GND,
 * red = +5 V, orange = signal, ending in a 2,54 mm connector. Generic case
 * (blue or black), no brand.
 * Inside, as in teardowns: a Ø 9 mm brushed DC motor standing at one end,
 * a four-stage nylon gear train (module 0,24: pinion 8 teeth, 28/10, 42/10,
 * 42/10, output 42 teeth, about 260 : 1) on two axes, the potentiometer
 * under the output gear, coupled to it, and the control board at the
 * bottom. The horn turns to `angle` (0 to 180°) and every gear turns with
 * it at its own ratio.
 * Exploded view: horn, top cover and gears lifted one by one, middle case
 * and bottom cover lowered, leaving motor, potentiometer and board in
 * place. Cutaway: the case cut lengthways; the parts inside stay whole.
 */
import { useRef } from 'react';
import { Path, Shape, type BufferGeometry, type Group } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { fitText, FONT_SANS, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { Decal } from './_em-kit';
import {
  arc,
  circle,
  creased,
  deg,
  extrudeY,
  pitchRadius,
  polygon,
  spurGear,
  teethOutline,
  type Pt,
} from './_motor-geometry';
import {
  lathe,
  Lead,
  merge,
  roundedRectShell,
  roundedRectSlab,
  shellProfile,
  useFollow,
  useGeometrySet,
} from './_power-shared';

type HornKind = 'simples' | 'duplo' | 'cruz';
type CaseColor = 'azul' | 'preto';

export interface ServoMotorProps {
  /** Commanded angle of the output (0 to 180°; 90° = centre). */
  angle?: number;
  /** Horn on the spline: single arm, double arm or cross. */
  horn?: HornKind;
  /** Case colour. */
  color?: CaseColor;
}

/** Case (mm). */
const BW = 22.8;
const BD = 12.2;
const WALL = 0.8;
const BOTTOM = 4.2;
const MIDDLE = 17;
const TOP = 22.5;
const EAR = { y0: 14.4, y1: 16.9, span: 32.3, hole: 13.9 };
/** Output axis and idler pin (x), tower and spline heights. */
const XO = 5.3;
const M = 0.24;
const D = pitchRadius(42, M) + pitchRadius(10, M);
const X1 = XO - D;
const XM = X1 - (pitchRadius(28, M) + pitchRadius(8, M));
const TOWER_R = 5.9;
const TOWER_TOP = 26;
const SPLINE_TOP = 29;
/** Gear layers: [y0, y1] of each wheel. */
const G = {
  pinion: [15.3, 16.5],
  g1Big: [15.3, 16.4],
  g1Small: [16.4, 18.0],
  g2Big: [16.6, 17.6],
  g2Small: [17.6, 19.2],
  g3Big: [17.8, 18.8],
  g3Small: [18.8, 20.4],
  outBig: [19.0, 20.0],
} as const;
/** Gear ratios between each wheel and the output. */
const R3 = 42 / 10;
const R2 = R3 * R3;
const R1 = R2 * R3;
const RM = R1 * (28 / 8);
/** Horn height. */
const HORN = { y0: 26.4, arm0: 28.4, y1: 29.8 };
const PCB = { y0: 2.2, y1: 3.0, w: 19.6, d: 9.6 };
const MOTOR = { r: 4.5, y0: 4.6, y1: 14.0 };
const POT = { r: 3.6, y0: 7.5, y1: 11.5 };

const CASE_COLORS: Record<CaseColor, { color: string; cut: string }> = {
  azul: { color: '#2f62d6', cut: '#24489a' },
  preto: { color: '#1f2023', cut: '#3a3c40' },
};
const WIRES = [
  { color: '#6b3a1e', name: 'marrom' },
  { color: '#c8261d', name: 'vermelho' },
  { color: '#ef8a17', name: 'laranja' },
];

const clampAngle = (p: PartProps) => Math.min(Math.max(Number(p.angle) || 0, 0), 180);
const hornOf = (p: PartProps): HornKind =>
  p.horn === 'duplo' || p.horn === 'cruz' ? (p.horn as HornKind) : 'simples';

const HORN_TEXT: Record<HornKind, string> = {
  simples: 'braço simples',
  duplo: 'braço duplo',
  cruz: 'braço em cruz',
};

export const meta: PartMeta = {
  id: 'servo-motor',
  label: 'Servomotor (micro servo 9 g)',
  category: 'saidas',
  summary:
    'Micro servo de 9 g: motor CC, caixa de redução de quatro estágios, potenciômetro que mede o ângulo e placa de controle; o braço vai ao ângulo pedido pelo sinal.',
  defaults: { angle: 90, horn: 'simples', color: 'azul' },
  controls: {
    angle: { kind: 'number', label: 'Ângulo', min: 0, max: 180, step: 1, unit: '°' },
    horn: {
      kind: 'select',
      label: 'Braço (horn)',
      options: [
        { value: 'simples', label: 'Simples' },
        { value: 'duplo', label: 'Duplo' },
        { value: 'cruz', label: 'Em cruz' },
      ],
    },
    color: {
      kind: 'select',
      label: 'Cor da caixa',
      options: [
        { value: 'azul', label: 'Azul' },
        { value: 'preto', label: 'Preta' },
      ],
    },
  },
  annotations: () => {
    const list: PartAnnotation[] = [
      { at: [0, 0, 0], text: 'Braço (horn): vai ao ângulo pedido, de 0° a 180°', anchor: 'horn' },
      {
        at: [-BW / 2 - 8, 1.2, 0],
        text: 'Fios: laranja = sinal, vermelho = +5 V, marrom = GND',
      },
      {
        at: [-EAR.hole, EAR.y1, BD * 0.3],
        text: 'Orelhas com furos para parafusar o servo',
        exploded: false,
      },
      { at: [0, 0, 0], text: 'Motor CC (gira rápido)', anchor: 'motor', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Engrenagens de redução: cerca de 260 voltas do motor por volta do eixo',
        anchor: 'gears',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Potenciômetro: mede o ângulo do eixo de saída',
        anchor: 'pot',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Placa de controle: compara o sinal com o potenciômetro e aciona o motor',
        anchor: 'board',
        exploded: true,
      },
    ];
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const angle = clampAngle(p);
    const pulse = 1 + angle / 180;
    const color = p.color === 'preto' ? 'preta' : 'azul';
    return `Micro servo de 9 g com caixa ${color} de 22,8 × 12,2 mm, orelhas de fixação e ${HORN_TEXT[hornOf(p)]} no eixo de saída, girado a ${formatNumber(angle)}° (pulso de cerca de ${formatNumber(pulse, 3)} ms a cada 20 ms). Dentro: motor CC, quatro estágios de engrenagens de náilon (cerca de 260 : 1), potenciômetro preso ao eixo de saída e placa de controle. Fios: laranja = sinal, vermelho = +5 V, marrom = GND.`;
  },
  view: [0.85, 0.75, 1.2],
  animated: false,
};

/** Outline of one horn arm along +X: from the hub out to a rounded tip. */
function armShape(reach: number, root: number, tip: number, holes: number): Shape {
  const pts: Pt[] = [
    [-0.5, -root],
    [reach, -tip],
    ...arc(tip, -Math.PI / 2, Math.PI / 2, 10).map(([x, y]) => [x + reach, y] as Pt),
    [-0.5, root],
  ];
  const shape = polygon(new Shape(), pts);
  for (let i = 0; i < holes; i++) {
    const x = reach - i * 2;
    if (x > 4.5) shape.holes.push(circle(new Path(), 0.45, x, 0, 10));
  }
  return shape;
}

/** Ear outline (+X side): a tab with a hole slotted to the end. */
function earOutline(sign: 1 | -1): Pt[] {
  const x0 = BW / 2 - 0.4;
  const x1 = EAR.span / 2;
  const h = BD / 2;
  const r = 1;
  const slot = 0.5;
  const xs = EAR.hole + Math.sqrt(r * r - slot * slot);
  const a0 = Math.asin(slot / r);
  const pts: Pt[] = [
    [x0, -h],
    [x1 - 0.6, -h],
    [x1, -h + 0.6],
    [x1, -slot],
    [xs, -slot],
    ...arc(r, -a0, -(Math.PI * 2 - a0), 14).map(([x, y]) => [x + EAR.hole, y] as Pt),
    [xs, slot],
    [x1, slot],
    [x1, h - 0.6],
    [x1 - 0.6, h],
    [x0, h],
  ];
  return pts.map(([x, y]) => [x * sign, y]);
}

export default function ServoMotor(props: ServoMotorProps) {
  const p = { ...meta.defaults, ...props } as Required<ServoMotorProps>;
  const pp = p as unknown as PartProps;
  const angle = clampAngle(pp);
  const horn = hornOf(pp);
  const tint = CASE_COLORS[p.color === 'preto' ? 'preto' : 'azul'];
  const noise = getNoiseTexture();

  const geo = useGeometrySet(() => {
    const bottom = merge([
      // Covers stop a hair short of the middle case, so the parting lines show.
      roundedRectShell(BW, BD, 0.9, 0, BOTTOM - 0.1, WALL, 4),
      roundedRectSlab(BW, BD, 0.9, 0, WALL, 0.25),
    ]);
    const middle = merge([
      roundedRectShell(BW, BD, 0.9, BOTTOM, MIDDLE, WALL, 4),
      creased(extrudeY(polygon(new Shape(), earOutline(1)), EAR.y0, EAR.y1, { bevel: 0.2 }), 0.5),
      creased(extrudeY(polygon(new Shape(), earOutline(-1)), EAR.y0, EAR.y1, { bevel: 0.2 }), 0.5),
    ]);
    // Top cover: walls, a plate open under the tower, the tower and the bump over the idler.
    const plate = new Shape();
    const hw = BW / 2;
    const hd = BD / 2;
    const rr = 0.9;
    plate.moveTo(-hw + rr, -hd);
    plate.lineTo(hw - rr, -hd);
    plate.quadraticCurveTo(hw, -hd, hw, -hd + rr);
    plate.lineTo(hw, hd - rr);
    plate.quadraticCurveTo(hw, hd, hw - rr, hd);
    plate.lineTo(-hw + rr, hd);
    plate.quadraticCurveTo(-hw, hd, -hw, hd - rr);
    plate.lineTo(-hw, -hd + rr);
    plate.quadraticCurveTo(-hw, -hd, -hw + rr, -hd);
    plate.holes.push(circle(new Path(), TOWER_R - WALL, XO, 0, 40));
    const tower = lathe(
      shellProfile(
        [
          [TOWER_R, TOP - 0.05],
          [TOWER_R, TOWER_TOP - 0.4],
          [TOWER_R - 0.4, TOWER_TOP],
          [2.4, TOWER_TOP],
        ],
        WALL,
      ),
      48,
    ).translate(XO, 0, 0);
    const bump = lathe(
      [
        [0, TOP - 0.05],
        [2.9, TOP - 0.05],
        [2.9, TOP + 1.2],
        [2.5, TOP + 1.5],
        [0, TOP + 1.5],
      ],
      32,
    ).translate(X1, 0, 0);
    const top = merge([
      roundedRectShell(BW, BD, 0.9, MIDDLE + 0.1, TOP - WALL, WALL, 4),
      creased(extrudeY(plate, TOP - WALL, TOP, { bevel: 0.25, curveSegments: 4 }), 0.5),
      tower,
      bump,
    ]);

    // Gears (nylon), each compound wheel merged.
    const at = (g: BufferGeometry, x: number) => g.translate(x, 0, 0);
    const g1 = merge([
      spurGear(28, M, G.g1Big[0], G.g1Big[1], { bore: 0.55 }),
      spurGear(10, M, G.g1Small[0], G.g1Small[1], { bore: 0.55 }),
    ]);
    const g2 = merge([
      spurGear(42, M, G.g2Big[0], G.g2Big[1], { bore: 1.05 }),
      spurGear(10, M, G.g2Small[0], G.g2Small[1], { bore: 1.05 }),
      lathe(
        [
          [1.05, G.g2Big[0]],
          [2.2, G.g2Big[0]],
          [2.2, G.g2Big[1]],
          [1.05, G.g2Big[1]],
        ],
        24,
      ),
    ]);
    const g3 = merge([
      spurGear(42, M, G.g3Big[0], G.g3Big[1], { bore: 0.55 }),
      spurGear(10, M, G.g3Small[0], G.g3Small[1], { bore: 0.55 }),
      lathe(
        [
          [0.55, G.g3Big[0]],
          [2, G.g3Big[0]],
          [2, G.g3Big[1]],
          [0.55, G.g3Big[1]],
        ],
        24,
      ),
    ]);
    const spline = creased(
      extrudeY(
        polygon(new Shape(), teethOutline(20, 2.4, 2.15, { top: 0.4, base: 0.6 })),
        TOWER_TOP - 0.3,
        SPLINE_TOP,
        { curveSegments: 2 },
      ),
      Math.PI / 5,
    );
    const output = merge([
      spurGear(42, M, G.outBig[0], G.outBig[1]),
      lathe(
        [
          [0, 12],
          [1, 12],
          [1, G.outBig[0]],
          [2.3, G.outBig[0]],
          [2.3, TOWER_TOP - 0.3],
          [0, TOWER_TOP - 0.3],
        ],
        28,
      ),
      spline,
    ]);
    const pinion = spurGear(8, M, G.pinion[0], G.pinion[1], { bore: 0 });
    const pin = lathe(
      [
        [0, 14.8],
        [0.5, 14.8],
        [0.5, TOP - WALL],
        [0, TOP - WALL],
      ],
      14,
    );

    // Horn: hub and arms.
    const reach = horn === 'simples' ? 15.5 : horn === 'duplo' ? 13.5 : 13;
    const arms: Shape[] = [armShape(reach, 3.1, 1.9, 6)];
    if (horn !== 'simples') {
      const back = armShape(reach, 3.1, 1.9, 6);
      arms.push(back);
    }
    const armGeos = arms.map((s, i) => {
      const g = creased(extrudeY(s, HORN.arm0, HORN.y1, { bevel: 0.25, curveSegments: 4 }), 0.5);
      if (i === 1) g.rotateY(Math.PI);
      return g;
    });
    if (horn === 'cruz')
      for (const turn of [Math.PI / 2, -Math.PI / 2]) {
        const g = creased(
          extrudeY(armShape(10, 2.7, 1.6, 4), HORN.arm0, HORN.y1, {
            bevel: 0.25,
            curveSegments: 4,
          }),
          0.5,
        );
        armGeos.push(g.rotateY(turn));
      }
    const hornGeo = merge([
      ...armGeos,
      lathe(
        [
          [2.45, HORN.y0],
          [3.4, HORN.y0],
          [3.4, HORN.y1 + 0.03],
          [1.2, HORN.y1 + 0.03],
          [1.2, HORN.y1 - 0.6],
          [0, HORN.y1 - 0.6],
        ],
        40,
      ),
    ]);
    const screw = lathe(
      [
        [0, HORN.y1 - 0.6],
        [1.05, HORN.y1 - 0.6],
        [1.05, HORN.y1 + 0.2],
        [0.8, HORN.y1 + 0.45],
        [0, HORN.y1 + 0.5],
      ],
      20,
    );

    // Motor: can, end cap, terminals, shaft.
    const can = lathe(
      [
        [0, MOTOR.y0 + 0.6],
        [MOTOR.r - 0.3, MOTOR.y0 + 0.6],
        [MOTOR.r, MOTOR.y0 + 0.9],
        [MOTOR.r, MOTOR.y1 - 0.4],
        [MOTOR.r - 0.4, MOTOR.y1],
        [1.6, MOTOR.y1],
        [1.6, MOTOR.y1 + 0.6],
        [0, MOTOR.y1 + 0.6],
      ],
      40,
    ).translate(XM, 0, 0);
    const motorCap = lathe(
      [
        [0, MOTOR.y0 - 1],
        [MOTOR.r - 0.5, MOTOR.y0 - 1],
        [MOTOR.r - 0.3, MOTOR.y0 - 0.6],
        [MOTOR.r - 0.3, MOTOR.y0 + 0.8],
        [0, MOTOR.y0 + 0.8],
      ],
      36,
    ).translate(XM, 0, 0);
    const motorShaft = lathe(
      [
        [0, MOTOR.y1],
        [0.5, MOTOR.y1],
        [0.5, G.pinion[1] + 0.2],
        [0, G.pinion[1] + 0.2],
      ],
      12,
    ).translate(XM, 0, 0);

    // Potentiometer: body and metal top, under the output.
    const potBody = lathe(
      [
        [0, POT.y0],
        [POT.r, POT.y0],
        [POT.r, POT.y1 - 1],
        [0, POT.y1 - 1],
      ],
      32,
    ).translate(XO, 0, 0);
    const potTop = lathe(
      [
        [1.05, POT.y1 - 1],
        [POT.r - 0.2, POT.y1 - 1],
        [POT.r - 0.2, POT.y1 - 0.6],
        [2, POT.y1],
        [1.05, POT.y1],
      ],
      32,
    ).translate(XO, 0, 0);

    return {
      bottom,
      middle,
      top,
      g1: at(g1, X1),
      g2: at(g2, XO),
      g3: at(g3, X1),
      output,
      pinion,
      pin: pin.translate(X1, 0, 0),
      horn: hornGeo,
      screw,
      can,
      motorCap,
      motorShaft,
      potBody,
      potTop,
    };
  }, [horn]);

  const label = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#f1f0ec';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d2a4a';
      fitText(ctx, 'MICRO SERVO 9 g', w / 2, h * 0.3, w * 0.86, 70, { weight: 700 });
      ctx.fillStyle = '#3b4253';
      fitText(ctx, '4,8 a 6 V · 0,1 s/60° · 1,8 kgf·cm', w / 2, h * 0.68, w * 0.9, 40, {
        weight: 500,
      });
    },
    'servo-label',
    { width: 512, height: 192, fonts: [`700 70px ${FONT_SANS}`] },
  );

  // Horn, output and the train follow the angle.
  const out = useRef<Group>(null);
  const hornRef = useRef<Group>(null);
  const g3 = useRef<Group>(null);
  const g2 = useRef<Group>(null);
  const g1 = useRef<Group>(null);
  const motor = useRef<Group>(null);
  useFollow(
    deg(angle - 90),
    (a) => {
      if (hornRef.current) hornRef.current.rotation.y = a;
      if (out.current) out.current.rotation.y = a;
      if (g3.current) g3.current.rotation.y = -a * R3;
      if (g2.current) g2.current.rotation.y = a * R2;
      if (g1.current) g1.current.rotation.y = -a * R1;
      if (motor.current) motor.current.rotation.y = a * RM;
    },
    6,
  );

  const caseMaterial = (
    <Material
      color={tint.color}
      roughness={0.32}
      roughnessMap={noise}
      clearcoat={0.5}
      clearcoatRoughness={0.3}
      clip
      cutColor={tint.cut}
    />
  );
  const nylon = <Material preset="nylonNatural" color="#f1ede0" roughness={0.45} />;

  // Wires: from the board, out of the end of the case, to the connector.
  const wires = WIRES.map((w, i) => {
    const z = (i - 1) * 1.0;
    const points: Vec3[] = [
      [-8.6, PCB.y1 + 0.45, z],
      [-BW / 2 - 1.5, PCB.y1 + 0.45, z],
      [-BW / 2 - 5, 0.5, z],
      [-BW / 2 - 26, 0.5, z],
      [-BW / 2 - 30, 1.3, z * 2.54],
      [-BW / 2 - 32, 1.3, z * 2.54],
    ];
    return <Lead key={w.name} points={points} radius={0.5} color={w.color} strip={0} bend={2} />;
  });
  const xc = -BW / 2 - 32 - 7;

  return (
    <group>
      {/* Case: bottom cover, middle case with the ears, top cover. */}
      <Explode offset={[0, -22, 0]} delay={0.2}>
        <mesh geometry={geo.bottom}>{caseMaterial}</mesh>
      </Explode>
      <Explode offset={[0, -16, 0]} delay={0.1}>
        <mesh geometry={geo.middle}>{caseMaterial}</mesh>
        <Decal
          map={label}
          width={17}
          height={6.4}
          position={[-1.2, (BOTTOM + EAR.y0) / 2 + 0.4, BD / 2 + 0.02]}
          clip
        />
      </Explode>
      <Explode offset={[0, 22, 0]} delay={0.1}>
        <mesh geometry={geo.top}>{caseMaterial}</mesh>
      </Explode>

      {/* Control board with the controller, a few parts and the wire pads. */}
      <mesh position={[0, (PCB.y0 + PCB.y1) / 2, 0]}>
        <boxGeometry args={[PCB.w, PCB.y1 - PCB.y0, PCB.d]} />
        <Material preset="solderMask" />
      </mesh>
      <mesh position={[0.6, PCB.y1 + 0.7, -1.6]}>
        <boxGeometry args={[2.8, 1.4, 3.9]} />
        <Material preset="epoxyBlack" />
      </mesh>
      {[
        [0.6, 2.6],
        [3.2, 3.6],
        [-8.4, -3.6],
        [8.6, -3.4],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x!, PCB.y1 + 0.4, z!]}>
          <boxGeometry args={[1.6, 0.8, 0.8]} />
          <Material preset="ceramicTan" color="#b9925e" />
        </mesh>
      ))}
      <Anchor name="board" position={[7.5, PCB.y1, PCB.d / 2]} />
      {wires}
      <mesh position={[xc, 1.3, 0]}>
        <boxGeometry args={[14, 2.6, 7.6]} />
        <Material preset="absBlack" roughness={0.55} />
      </mesh>
      {[-2.54, 0, 2.54].map((z) => (
        <mesh key={z} position={[xc - 7.01, 1.3, z]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.1, 1.1]} />
          <Material color="#050506" roughness={0.9} />
        </mesh>
      ))}

      {/* Motor, standing at the far end; the pinion turns with it. */}
      <mesh geometry={geo.can}>
        <Material preset="nickel" color="#d9d7d2" roughness={0.25} roughnessMap={noise} />
      </mesh>
      <mesh geometry={geo.motorCap}>
        <Material preset="absBlack" roughness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[XM + s * 2.6, PCB.y1 + 0.5, 0]}>
          <boxGeometry args={[0.9, 1.1, 0.3]} />
          <Material preset="brass" roughness={0.3} />
        </mesh>
      ))}
      <group ref={motor} position={[XM, 0, 0]}>
        <mesh geometry={geo.motorShaft} position={[-XM, 0, 0]}>
          <Material preset="steel" roughness={0.2} />
        </mesh>
        <mesh geometry={geo.pinion}>
          <Material preset="brass" roughness={0.3} />
        </mesh>
      </group>
      <Anchor name="motor" position={[XM, (MOTOR.y0 + MOTOR.y1) / 2, MOTOR.r]} />

      {/* Potentiometer under the output gear, legs into the board. */}
      <mesh geometry={geo.potBody}>
        <Material color="#2a2c30" roughness={0.6} />
      </mesh>
      <mesh geometry={geo.potTop}>
        <Material preset="nickel" roughness={0.3} />
      </mesh>
      {[-2.4, 0, 2.4].map((dx) => (
        <mesh key={dx} position={[XO + dx, (PCB.y1 + POT.y0) / 2, POT.r - 0.6]}>
          <boxGeometry args={[0.6, POT.y0 - PCB.y1, 0.3]} />
          <Material preset="tin" />
        </mesh>
      ))}
      <Anchor name="pot" position={[XO, (POT.y0 + POT.y1) / 2, POT.r]} />

      {/* Gear train. */}
      <mesh geometry={geo.pin}>
        <Material preset="steel" roughness={0.25} />
      </mesh>
      <Explode offset={[0, 3, 0]} delay={0.3}>
        <group ref={g1} position={[X1, 0, 0]}>
          <mesh geometry={geo.g1} position={[-X1, 0, 0]}>
            {nylon}
          </mesh>
        </group>
      </Explode>
      <Explode offset={[0, 6.5, 0]} delay={0.25}>
        <group ref={g2} position={[XO, 0, 0]}>
          <mesh geometry={geo.g2} position={[-XO, 0, 0]}>
            {nylon}
          </mesh>
        </group>
      </Explode>
      <Explode offset={[0, 10, 0]} delay={0.2}>
        <group ref={g3} position={[X1, 0, 0]}>
          <mesh geometry={geo.g3} position={[-X1, 0, 0]}>
            {nylon}
          </mesh>
        </group>
        <Anchor name="gears" position={[X1 - 3, G.g3Big[1], 3.5]} />
      </Explode>
      <Explode offset={[0, 14, 0]} delay={0.15}>
        <group ref={out} position={[XO, 0, 0]}>
          <mesh geometry={geo.output}>{nylon}</mesh>
        </group>
      </Explode>

      {/* Horn and its screw. */}
      <Explode offset={[0, 28, 0]}>
        <group ref={hornRef} position={[XO, 0, 0]}>
          <mesh geometry={geo.horn}>
            <Material preset="nylonNatural" color="#f4f2ea" roughness={0.5} />
          </mesh>
          <mesh geometry={geo.screw}>
            <Material preset="nickel" roughness={0.3} />
          </mesh>
          <Anchor name="horn" position={[horn === 'simples' ? 12 : 10, HORN.y1, 0]} />
        </group>
      </Explode>
    </group>
  );
}
