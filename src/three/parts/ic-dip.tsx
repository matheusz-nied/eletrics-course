/**
 * DIP integrated circuit (8, 14, 16, 18 or 28 pins, 0,3" wide) with the
 * pin-1 notch and dimple, laser-etched marking and an optional stamped-contact
 * socket. Dimensions from JEDEC MS-001 (PDIP): body 6,35 mm wide and 3,3 mm
 * thick, rows 7,62 mm apart, pitch 2,54 mm, shoulders 1,52 mm, pins 0,46 mm
 * wide and 3,3 mm below the seating plane. Inside (cutaway and exploded
 * view): copper lead frame, die on its paddle and gold bond wires.
 */
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import {
  bentStrip,
  bondWires,
  extrudeOutline,
  mergeAll,
  mergeAt,
  moldedBlock,
  placed,
  stripOutline,
  type Pt,
} from './_semi-geometry';
import { icPads, SiliconDie, usePrintedTop } from './_semi-parts';

export interface IcDipProps {
  pins?: 8 | 14 | 16 | 18 | 28;
  /** Part number printed on top (generic, no logos). */
  code?: string;
  /** Year and week of manufacture printed under the code. */
  dateCode?: string;
  /** Sitting in a black DIP socket. */
  socket?: boolean;
  burned?: boolean;
}

/** Body length (mm) by pin count (MS-001 nominal). */
const BODY_LENGTH: Record<number, number> = { 8: 9.27, 14: 19.05, 16: 19.3, 18: 22.86, 28: 35.0 };
/** Die size (mm) by pin count: typical of the parts usually sold in each size. */
const DIE_SIZE: Record<number, [number, number]> = {
  8: [1.5, 1.3],
  14: [1.8, 1.6],
  16: [2.0, 1.7],
  18: [2.3, 2.0],
  28: [3.2, 3.0],
};

const PITCH = 2.54;
const ROW = 7.62;
const BODY_W = 6.35;
const BODY_H = 3.3;
const STANDOFF = 0.5;
const PIN_L = 3.3;
const LEAD_T = 0.25;
const SHOULDER_W = 1.52;
const PIN_W = 0.46;
const PARTING = 1.45;
const SOCKET_H = 4.2;
const SOCKET_PIN = 3.0;

export const meta: PartMeta = {
  id: 'ic-dip',
  label: 'Circuito integrado DIP',
  category: 'semicondutores',
  summary:
    'Circuito integrado em encapsulamento DIP (8 a 28 pinos), com chanfro do pino 1, marcação a laser e soquete opcional; por dentro, o chip de silício e os fios de ouro.',
  defaults: { pins: 8, code: 'NE555P', dateCode: '2341', socket: false, burned: false },
  controls: {
    pins: {
      kind: 'select',
      label: 'Pinos',
      options: [8, 14, 16, 18, 28].map((n) => ({ value: n, label: `DIP-${n}` })),
    },
    code: { kind: 'text', label: 'Código impresso', maxLength: 14 },
    dateCode: { kind: 'text', label: 'Código de data', maxLength: 6 },
    socket: { kind: 'toggle', label: 'No soquete' },
    burned: { kind: 'toggle', label: 'Queimado' },
  },
  annotations: (p) => {
    const n = pinsOf(p.pins);
    const L = BODY_LENGTH[n]!;
    const lift = p.socket ? SOCKET_PIN + SOCKET_H - PIN_L : 0;
    const top = lift + PIN_L + STANDOFF + BODY_H;
    const x1 = -((n / 2 - 1) / 2) * PITCH;
    const list = [
      {
        at: [-L / 2 + 0.6, top, 0] as Vec3,
        text: 'Chanfro: marca o lado do pino 1',
        exploded: false,
      },
      {
        at: [x1, lift + 1, ROW / 2] as Vec3,
        text: 'Pino 1; a contagem segue no sentido anti-horário',
        exploded: false,
      },
      { at: [0, top, -1] as Vec3, text: 'Código da peça e data de fabricação', exploded: false },
      { at: [0, 0, 0] as Vec3, text: 'Chip de silício (o circuito de verdade)', anchor: 'die' },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Fios de ouro ligam o chip aos terminais',
        anchor: 'wires',
        exploded: true,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Estrutura de cobre (lead frame)',
        anchor: 'frame',
        exploded: true,
      },
      { at: [0, 0, 0] as Vec3, text: 'Corpo de epóxi moldado', anchor: 'body', exploded: true },
    ];
    if (p.socket) {
      list.push({
        at: [L / 2 + 0.6, SOCKET_PIN + SOCKET_H * 0.5, ROW / 2] as Vec3,
        text: 'Soquete: troca o CI sem soldar',
        exploded: false,
      });
    }
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const n = pinsOf(p.pins);
    const base = `Circuito integrado DIP de ${n} pinos marcado ${String(p.code)}${p.socket ? ', encaixado num soquete' : ''}`;
    return `${base}${p.burned ? ', queimado' : ''}. O pino 1 fica ao lado do chanfro e a numeração segue no sentido anti-horário, vista de cima.`;
  },
  view: [0.55, 1.05, 1.35],
};

function pinsOf(value: unknown): 8 | 14 | 16 | 18 | 28 {
  const n = Number(value);
  return n === 14 || n === 16 || n === 18 || n === 28 ? n : 8;
}

/** X of pin `i` (0-based) in a row of `perRow` pins. */
const pinX = (i: number, perRow: number) => (i - (perRow - 1) / 2) * PITCH;

export default function IcDip(props: IcDipProps) {
  const p = { ...meta.defaults, ...props } as Required<IcDipProps>;
  const n = pinsOf(p.pins);
  const perRow = n / 2;
  const L = BODY_LENGTH[n]!;
  const [dieW, dieD] = DIE_SIZE[n]!;
  const lift = p.socket ? SOCKET_PIN + SOCKET_H - PIN_L : 0;
  const seat = PIN_L; // seating plane (shoulders)
  const bodyY = seat + STANDOFF;
  const frameY = bodyY + PARTING; // lead frame plane (centre of the sheet)

  const body = useDisposable(
    () =>
      moldedBlock({
        width: L,
        depth: BODY_W,
        height: BODY_H,
        corner: 0.25,
        fillet: 0.32,
        bottomFillet: 0.25,
        draft: 0.1,
        parting: PARTING,
        notch: { radius: n === 8 ? 0.8 : 1.0, depth: 0.55 },
      }),
    [L, n],
  );

  // External leads (tinned): shoulder bent down from the parting line, then the pin.
  const leads = useDisposable(() => {
    const edge = BODY_W / 2 - 0.05;
    const shoulder = bentStrip(
      [
        [edge, frameY],
        [ROW / 2, frameY],
        [ROW / 2, seat],
      ],
      LEAD_T,
      SHOULDER_W,
      0.35,
    );
    shoulder.rotateY(-Math.PI / 2);
    const half = SHOULDER_W / 2;
    const pinOutline: Pt[] = [
      [-half, seat],
      [-half, seat - 0.12],
      [-PIN_W / 2, seat - 0.55],
      [-PIN_W / 2, 0.3],
      [-PIN_W / 4, 0],
      [PIN_W / 4, 0],
      [PIN_W / 2, 0.3],
      [PIN_W / 2, seat - 0.55],
      [half, seat - 0.12],
      [half, seat],
    ];
    const pin = extrudeOutline(pinOutline, LEAD_T);
    pin.translate(0, 0, ROW / 2);
    const one = mergeAll([shoulder, pin]);
    const matrices = [];
    for (let i = 0; i < perRow; i++) {
      matrices.push(placed([pinX(i, perRow), 0, 0]));
      matrices.push(placed([pinX(i, perRow), 0, 0], [0, Math.PI, 0]));
    }
    const all = mergeAt(one, matrices);
    one.dispose();
    return all;
  }, [n, frameY]);

  // Lead frame inside: die paddle and the fingers fanning in from each lead.
  const paddle: [number, number] = [dieW + 0.5, dieD + 0.5];
  const fingerTips = (() => {
    const tips: { x: number; z: number; leadX: number; side: 1 | -1 }[] = [];
    const spanX = Math.max(paddle[0] / 2 + 0.9, 1.4);
    for (let i = 0; i < perRow; i++) {
      const lx = pinX(i, perRow);
      const k = perRow > 1 ? lx / Math.abs(pinX(0, perRow)) : 0;
      // Pins near the ends wrap around the paddle corners.
      const tx = k * spanX;
      const tz = paddle[1] / 2 + 0.3 + Math.max(Math.abs(k) - 0.75, 0) * 1.2;
      tips.push({ x: tx, z: tz, leadX: lx, side: 1 });
    }
    return tips;
  })();

  const frame = useDisposable(() => {
    const parts = [];
    for (const side of [1, -1] as const) {
      for (const t of fingerTips) {
        const x = side === 1 ? t.leadX : -t.leadX;
        const tx = side === 1 ? t.x : -t.x;
        const outline = stripOutline(
          [
            [x, side * (BODY_W / 2 - 0.05)],
            [x, side * (BODY_W / 2 - 0.9)],
            [tx, side * t.z],
          ],
          [SHOULDER_W * 0.8, 0.5, 0.42],
        );
        const g = extrudeOutline(outline, LEAD_T);
        g.rotateX(Math.PI / 2);
        parts.push(g);
      }
    }
    // Paddle and its tie bars to the ends of the body.
    const pad = extrudeOutline(
      [
        [-paddle[0] / 2, -paddle[1] / 2],
        [paddle[0] / 2, -paddle[1] / 2],
        [paddle[0] / 2, paddle[1] / 2],
        [-paddle[0] / 2, paddle[1] / 2],
      ],
      LEAD_T,
    );
    pad.rotateX(Math.PI / 2);
    parts.push(pad);
    for (const side of [1, -1]) {
      const tie = extrudeOutline(
        stripOutline(
          [
            [(side * paddle[0]) / 2 - side * 0.1, 0],
            [side * (L / 2 - 0.4), 0],
          ],
          0.35,
        ),
        LEAD_T,
      );
      tie.rotateX(Math.PI / 2);
      parts.push(tie);
    }
    const merged = mergeAll(parts);
    merged.translate(0, frameY, 0);
    return merged;
  }, [n, frameY, L]);

  const dieTop = frameY + LEAD_T / 2 + 0.03 + 0.28;
  // Pad 1 sits at the middle of the die's left edge; pads 1..n/2 go round the front half.
  const padInset = Math.min(dieW, dieD) * 0.1;
  const padStart = (dieD - 2 * padInset) / 2 / (2 * (dieW + dieD - 4 * padInset));
  const pads = icPads(dieW, dieD, n, padStart);
  const wires = useDisposable(() => {
    const list = pads.map(([x, z], k) => {
      // Pins 1..n/2 on the front row (left to right), the rest on the back row (right to left).
      const front = k < perRow;
      const tip = front ? fingerTips[k]! : fingerTips[k - perRow]!;
      const tx = front ? tip.x : -tip.x;
      const tz = front ? tip.z - 0.12 : -(tip.z - 0.12);
      return {
        from: [x, dieTop, z] as Vec3,
        to: [tx, frameY + LEAD_T / 2, tz] as Vec3,
        loop: 0.35,
      };
    });
    return bondWires(list, 0.022);
  }, [pads, dieTop, frameY, fingerTips]);

  const marking = usePrintedTop({
    width: L,
    height: BODY_W,
    lines: [
      { text: p.code, size: n === 8 ? 1.05 : 1.3, weight: 600 },
      { text: p.dateCode, size: n === 8 ? 0.8 : 0.95, mono: true, weight: 600 },
    ],
    dimple: { x: n === 8 ? 1.25 : 1.6, y: BODY_W - 1.35, d: 0.9 },
    ejectors:
      n === 8
        ? []
        : [
            { x: 2.3, y: BODY_W / 2, d: 2.2 },
            { x: L - 2.3, y: BODY_W / 2, d: 2.2 },
          ],
    offset: [n === 8 ? 0.35 : 0, -0.15],
    burned: p.burned,
  });
  const noise = getNoiseTexture();
  const ic = (
    <group>
      <Explode offset={[0, BODY_H * 2.2 + 2, 0]}>
        <mesh geometry={body} position={[0, bodyY, 0]}>
          <Material
            attach="material-0"
            preset="epoxyBlack"
            clip
            roughnessMap={noise}
            roughness={0.62}
            color={p.burned ? '#141211' : '#1b1b1d'}
            cutColor="#2a2a2c"
          />
          <Material
            attach="material-1"
            preset="epoxyBlack"
            clip
            color="#ffffff"
            map={marking.map}
            roughness={1}
            roughnessMap={marking.roughnessMap}
            bumpMap={marking.bumpMap}
            bumpScale={1.2}
            specularIntensity={0.55}
            cutColor="#2a2a2c"
          />
        </mesh>
        <Anchor name="body" position={[L / 2 - 1.2, bodyY + BODY_H, -1.5]} />
      </Explode>

      {/* Lead frame, die and bond wires stay in place. */}
      <mesh geometry={frame}>
        <Material preset="copper" color="#c98a64" roughness={0.35} />
      </mesh>
      <Anchor name="frame" position={[fingerTips[0]!.x - 0.3, frameY, fingerTips[0]!.z + 1.2]} />
      <mesh position={[0, frameY + LEAD_T / 2 + 0.015, 0]}>
        <boxGeometry args={[dieW + 0.12, 0.03, dieD + 0.12]} />
        <Material color="#d8d8d4" metalness={0.6} roughness={0.5} />
      </mesh>
      <SiliconDie
        size={[dieW, dieD]}
        thickness={0.28}
        kind="ic"
        pads={n}
        padStart={padStart}
        seed={n * 13 + p.code.length}
        position={[0, frameY + LEAD_T / 2 + 0.03, 0]}
        burned={p.burned}
      />
      <Anchor name="die" position={[0, dieTop, 0]} />
      <mesh geometry={wires}>
        <Material preset="gold" />
      </mesh>
      <Anchor
        name="wires"
        position={[-fingerTips[perRow - 1]!.x * 0.6, dieTop + 0.3, -fingerTips[0]!.z * 0.75]}
      />
      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.35} />
      </mesh>
    </group>
  );

  if (!p.socket) return ic;
  return (
    <group>
      <DipSocket pins={n} />
      <Explode offset={[0, 9, 0]}>
        <group position={[0, lift, 0]}>{ic}</group>
      </Explode>
    </group>
  );
}

/** Stamped-contact DIP socket: black PBT frame, open window, tinned pins. */
function DipSocket({ pins }: { pins: number }) {
  const perRow = pins / 2;
  const length = perRow * PITCH + 0.3;
  const railW = 2.5;
  const top = SOCKET_PIN + SOCKET_H;

  const rail = useDisposable(
    () =>
      moldedBlock({
        width: length,
        depth: railW,
        height: SOCKET_H,
        corner: 0.2,
        fillet: 0.25,
        bottomFillet: 0.1,
        draft: 0.02,
        parting: 0,
      }),
    [length],
  );
  const holes = usePrintedTop({
    width: length,
    height: railW,
    lines: [],
    base: '#1f2022',
    extra: (ctx, k) => {
      for (let i = 0; i < perRow; i++) {
        const cx = (length / 2 + pinX(i, perRow)) * k;
        const cy = (railW / 2) * k;
        const g = ctx.createRadialGradient(cx, cy, 0.1 * k, cx, cy, 0.9 * k);
        g.addColorStop(0, '#050505');
        g.addColorStop(0.55, '#0b0b0c');
        g.addColorStop(1, '#2a2b2e');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 0.75 * k, cy - 0.85 * k, 1.5 * k, 1.7 * k);
        ctx.fillStyle = '#b9bcbf';
        ctx.fillRect(cx - 0.42 * k, cy - 0.1 * k, 0.12 * k, 0.2 * k);
        ctx.fillRect(cx + 0.3 * k, cy - 0.1 * k, 0.12 * k, 0.2 * k);
      }
    },
    extraKey: `socket|${pins}`,
  });

  const pinGeometry = useDisposable(() => {
    const outline: Pt[] = [
      [-0.5, SOCKET_PIN + 0.4],
      [-0.5, SOCKET_PIN - 0.2],
      [-0.25, SOCKET_PIN - 0.6],
      [-0.25, 0.25],
      [-0.1, 0],
      [0.1, 0],
      [0.25, 0.25],
      [0.25, SOCKET_PIN - 0.6],
      [0.5, SOCKET_PIN - 0.2],
      [0.5, SOCKET_PIN + 0.4],
    ];
    const one = extrudeOutline(outline, 0.25);
    const matrices = [];
    for (let i = 0; i < perRow; i++) {
      for (const side of [1, -1]) matrices.push(placed([pinX(i, perRow), 0, (side * ROW) / 2]));
    }
    const all = mergeAt(one, matrices);
    one.dispose();
    return all;
  }, [pins]);

  return (
    <group>
      {([1, -1] as const).map((side) => (
        <mesh key={side} geometry={rail} position={[0, SOCKET_PIN, (side * ROW) / 2]}>
          <Material attach="material-0" preset="pbtBlack" clip cutColor="#2b2b2d" />
          <Material
            attach="material-1"
            preset="pbtBlack"
            clip
            color="#ffffff"
            map={holes.map}
            roughness={1}
            roughnessMap={holes.roughnessMap}
            cutColor="#2b2b2d"
          />
        </mesh>
      ))}
      {/* End bars, the pin-1 end with its notch mark. */}
      {([1, -1] as const).map((side) => (
        <mesh key={side} position={[(side * (length - 1.1)) / 2, SOCKET_PIN + 0.8, 0]}>
          <boxGeometry args={[1.1, 1.6, ROW - railW + 0.2]} />
          <Material preset="pbtBlack" clip cutColor="#2b2b2d" />
        </mesh>
      ))}
      <mesh position={[-(length - 1.1) / 2, SOCKET_PIN + 1.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 20, -Math.PI / 2, Math.PI]} />
        <Material color="#0c0c0d" roughness={0.6} />
      </mesh>
      {/* Contact leaves inside each hole (seen in the cutaway). */}
      {Array.from({ length: perRow }, (_, i) =>
        ([1, -1] as const).map((side) => (
          <group key={`${i}${side}`} position={[pinX(i, perRow), SOCKET_PIN, (side * ROW) / 2]}>
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                position={[s * 0.36, SOCKET_H / 2 + 0.3, 0]}
                rotation={[0, 0, s * 0.06]}
              >
                <boxGeometry args={[0.15, SOCKET_H - 0.9, 0.9]} />
                <Material preset="tin" roughness={0.3} />
              </mesh>
            ))}
          </group>
        )),
      )}
      <mesh geometry={pinGeometry}>
        <Material preset="tin" roughness={0.35} />
      </mesh>
      <Anchor name="socket" position={[0, top, ROW / 2]} />
    </group>
  );
}
