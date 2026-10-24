/**
 * Small parts shared by the microcontroller boards and sensor modules
 * (`dev-board`, `relay-module`, `pir-sensor`, `ultrasonic-sensor`), the ones
 * the kit has no part for. Generic shapes without markings of any
 * manufacturer. Private to `parts/` (the leading `_` keeps it out of the
 * registry).
 *
 * Every part rests its body on y = 0 (the board surface), centred on its
 * footprint, with through-hole pins going down through the board.
 * Dimensions (mm) from typical datasheets:
 * - female header 2,54 mm: 2,5 × 8,5 mm per position, 0,64 mm square tails;
 * - USB-B receptacle, right angle: 12,0 × 10,9 × 16,4 mm, opening 8,45 × 7,78 mm;
 * - micro-USB B receptacle: 7,5 × 2,55 × 5,0 mm;
 * - DC barrel jack 5,5/2,1 mm (DC-005 type): 9,0 × 11,0 × 14,4 mm;
 * - HC-49/S (HC-49/US) crystal: 11,05 × 4,65 × 3,5 mm, leads 4,88 mm apart;
 * - SOT-223: body 6,5 × 3,5 × 1,6 mm, 7,0 mm tip to tip; SOT-23: 2,9 × 1,3 × 1,0 mm;
 * - SMA diode: 4,3 × 2,6 × 2,1 mm; chip resistors and capacitors (EIA sizes);
 * - 0805 chip LED: 2,0 × 1,25 × 0,8 mm;
 * - SMD aluminium electrolytic 6,3 × 5,4 mm on its 6,6 mm plastic base;
 * - SMD tactile switch 6,0 × 3,5 mm;
 * - Wi-Fi module of the 38-pin boards: 18,0 × 25,5 × 3,1 mm, shield 2,3 mm
 *   tall, PCB meander antenna past the shield.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Mesh,
  Path,
  Shape,
  type BufferGeometry,
  type Group,
} from 'three';
import { emission, GLOW } from '../fx/glow';
import { Material } from '../materials/Material';
import { FONT_MONO, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import { resolveLayout, type PcbLayout, type Point } from '../pcb/layout';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import {
  addRoundedRect,
  extrudeAlongX,
  extrudeUp,
  mergeAll,
  roundedRectShape,
  shellGeometry,
} from './_em-geometry';
import { Decal } from './_em-kit';
import { bentStrip, moldedBlock, placed } from './_semi-geometry';
import { usePrintedTop } from './_semi-parts';

export const PITCH = 2.54;

/** Box from y = y0 up, centred on (x, z). */
export function box(w: number, h: number, d: number, x = 0, y0 = 0, z = 0): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y0 + h / 2, z);
}

/** Positions of `n` pins centred on 0 at `pitch`. */
export const pinRow = (n: number, pitch = PITCH) =>
  Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);

// ---------------------------------------------------------------------------
// Female header

export const FEMALE_HEADER_H = 8.5;
const TAIL = 3;

/** Female header, 2,54 mm, 1 × N or 2 × N, pins along X (rows along Z). */
export function FemaleHeader({ pins, rows = 1 }: { pins: number; rows?: number }) {
  const noise = getNoiseTexture();
  const xs = pinRow(pins);
  const zs = rows === 2 ? [-PITCH / 2, PITCH / 2] : [0];
  const body = useDisposable(() => {
    const cells: BufferGeometry[] = [];
    const h = 2.52 / 2;
    const c = 0.18;
    for (const x of xs) {
      for (const z of zs) {
        const shape = new Shape();
        shape.moveTo(-h + c, -h);
        shape.lineTo(h - c, -h);
        shape.lineTo(h, -h + c);
        shape.lineTo(h, h - c);
        shape.lineTo(h - c, h);
        shape.lineTo(-h + c, h);
        shape.lineTo(-h, h - c);
        shape.lineTo(-h, -h + c);
        shape.closePath();
        const hole = new Path();
        addRoundedRect(hole, 1.02, 1.02, 0.05, 0, 0, true);
        shape.holes.push(hole);
        const cell = extrudeUp(shape, FEMALE_HEADER_H, 0.12, {
          curveSegments: 1,
          bevelSegments: 1,
        });
        cell.translate(x, 0, z);
        cells.push(cell);
        // Floor of the socket, so the hole looks deep and dark.
        cells.push(box(1.04, 0.4, 1.04, x, 0.9, z));
      }
    }
    return mergeAll(cells);
  }, [pins, rows]);
  const metal = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    for (const x of xs) {
      for (const z of zs) {
        parts.push(box(0.64, TAIL + 1.2, 0.64, x, -TAIL, z));
        // Spring contacts seen down the hole.
        for (const s of [-1, 1]) parts.push(box(0.78, 5.6, 0.1, x, 1.3, z + s * 0.43));
      }
    }
    return mergeAll(parts);
  }, [pins, rows]);
  return (
    <group>
      <mesh geometry={body}>
        <Material preset="pbtBlack" roughness={0.58} roughnessMap={noise} clip cutColor="#0d0d0e" />
      </mesh>
      <mesh geometry={metal}>
        <Material preset="gold" roughness={0.24} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// USB-B receptacle (opening towards −X)

export const USB_B = { L: 16.4, W: 12, H: 10.9 };

export function UsbB() {
  const { L, W, H } = USB_B;
  const shell = useDisposable(() => {
    // Section (shape X → −Z, shape Y → Y): the shell with the B opening.
    const shape = new Shape();
    addRoundedRect(shape, W, H, 0.6, 0, H / 2);
    const ow = 8.45 / 2;
    const y0 = 1.6;
    const y1 = y0 + 7.78;
    const ch = 1.3;
    const hole = new Path();
    hole.moveTo(-ow, y0);
    hole.lineTo(-ow, y1 - ch);
    hole.lineTo(-ow + ch, y1);
    hole.lineTo(ow - ch, y1);
    hole.lineTo(ow, y1 - ch);
    hole.lineTo(ow, y0);
    hole.closePath();
    shape.holes.push(hole);
    const tube = extrudeAlongX(shape, L, 0.25, { curveSegments: 4, bevelSegments: 2 });
    const back = box(0.3, H - 0.4, W - 0.4, L / 2 - 0.35, 0.2, 0);
    // Shell tabs and the solder legs.
    const legs = [-1, 1].map((s) => box(2.2, 3.5, 0.3, 2.5, -3.2, s * (W / 2 - 0.15)));
    return mergeAll([tube, back, ...legs]);
  }, []);
  const plastic = useDisposable(() => {
    const depth = 11;
    const x0 = -L / 2 + 1.4;
    // Back wall of the socket and the centre tongue.
    const wall = box(0.6, 7.6, 8.3, -L / 2 + depth, 1.7, 0);
    const tongue = box(depth - 1.4, 3.0, 5.0, x0 + (depth - 1.4) / 2, 1.6 + 7.78 / 2 - 1.8, 0);
    return mergeAll([wall, tongue]);
  }, []);
  const pins = useDisposable(
    () =>
      mergeAll(
        [-1, 1].flatMap((s) =>
          [-1, 1].map((t) => box(0.6, 3.5, 0.6, 4.5 + t * 1.0, -3.2, s * 1.25)),
        ),
      ),
    [],
  );
  const contacts = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const y = 1.6 + 7.78 / 2 - 1.8;
    for (const z of [-1.25, 1.25]) {
      parts.push(box(7.5, 0.06, 0.8, -L / 2 + 1.6 + 3.75 + 1.0, y + 3.0, z));
      parts.push(box(7.5, 0.06, 0.8, -L / 2 + 1.6 + 3.75 + 1.0, y - 0.06, z));
    }
    return mergeAll(parts);
  }, []);
  return (
    <group>
      <mesh geometry={shell}>
        <Material preset="nickel" color="#d4d4d0" roughness={0.3} clip cutColor="#8a8a86" />
      </mesh>
      <mesh geometry={plastic}>
        <Material preset="absWhite" roughness={0.5} clip cutColor="#bdbab2" />
      </mesh>
      <mesh geometry={pins}>
        <Material preset="tin" />
      </mesh>
      <mesh geometry={contacts}>
        <Material preset="gold" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Micro-USB B receptacle (opening towards −X)

export const MICRO_USB = { L: 5.2, W: 7.5, H: 2.55 };

function trapezoid(path: Path | Shape, inset: number, clockwise: boolean) {
  const w = MICRO_USB.W / 2 - inset;
  const top = MICRO_USB.H - inset;
  const bot = inset;
  const side = 1.25;
  const pts: Point[] = [
    [-w, top],
    [w, top],
    [w, side],
    [w - 0.9, bot],
    [-(w - 0.9), bot],
    [-w, side],
  ];
  const list = clockwise ? [...pts].reverse() : pts;
  list.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
}

export function MicroUsb() {
  const { L, W } = MICRO_USB;
  const shell = useDisposable(() => {
    const shape = new Shape();
    trapezoid(shape, 0, false);
    const hole = new Path();
    trapezoid(hole, 0.22, true);
    shape.holes.push(hole);
    const tube = extrudeAlongX(shape, L, 0.06, { curveSegments: 2, bevelSegments: 1 });
    const legs = [-1, 1].map((s) => box(1.2, 1.6, 0.25, 0.8, -1.4, s * (W / 2 + 0.1)));
    const flange = [-1, 1].map((s) => box(0.25, 1.6, 1.1, -L / 2 + 0.12, 0.6, s * (W / 2 + 0.45)));
    return mergeAll([tube, ...legs, ...flange]);
  }, []);
  const plastic = useDisposable(() => {
    const back = new Shape();
    trapezoid(back, 0.22, false);
    const wall = extrudeAlongX(back, 2.2, 0, { curveSegments: 1 });
    wall.translate(L / 2 - 1.2, 0, 0);
    const tongue = box(L - 1.6, 0.6, 5.0, -L / 2 + 0.8 + (L - 1.6) / 2 + 0.4, 1.35, 0);
    return mergeAll([wall, tongue]);
  }, []);
  const contacts = useDisposable(
    () => mergeAll(pinRow(5, 0.65).map((z) => box(L - 2.2, 0.05, 0.28, 0.5, 1.3, z))),
    [],
  );
  return (
    <group>
      <mesh geometry={shell}>
        <Material preset="nickel" color="#d6d6d2" roughness={0.26} clip cutColor="#8a8a86" />
      </mesh>
      <mesh geometry={plastic}>
        <Material preset="absBlack" roughness={0.55} clip cutColor="#111" />
      </mesh>
      <mesh geometry={contacts}>
        <Material preset="gold" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// DC barrel jack (opening towards −X)

export const BARREL_JACK = { L: 14.4, W: 9, H: 11, axis: 6.4 };

export function BarrelJack() {
  const { L, W, H, axis } = BARREL_JACK;
  const noise = getNoiseTexture();
  const body = useDisposable(() => {
    const shape = new Shape();
    addRoundedRect(shape, W, H, 0.8, 0, H / 2);
    const hole = new Path();
    hole.absarc(0, axis, 3.2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const front = extrudeAlongX(shape, 10.5, 0.35, { curveSegments: 20, bevelSegments: 2 });
    front.translate(-L / 2 + 5.25, 0, 0);
    const rear = box(L - 10.5, H - 0.6, W - 0.8, L / 2 - (L - 10.5) / 2, 0, 0);
    // Floor of the plug hole.
    const floor = new CylinderGeometry(3.25, 3.25, 0.5, 20)
      .rotateZ(Math.PI / 2)
      .translate(-L / 2 + 10.2, axis, 0);
    return mergeAll([front, rear, floor]);
  }, []);
  const metal = useDisposable(() => {
    const pin = new CylinderGeometry(1.0, 1.0, 7.4, 16)
      .rotateZ(Math.PI / 2)
      .translate(-L / 2 + 10 - 3.7, axis, 0);
    const tip = new CylinderGeometry(0.6, 1.0, 0.5, 16)
      .rotateZ(Math.PI / 2)
      .translate(-L / 2 + 2.35, axis, 0);
    // Sleeve spring along the bottom of the hole.
    const spring = box(6, 0.25, 1.8, -L / 2 + 6.5, axis - 3.15, 0);
    const legs = [
      box(0.5, 3.6, 3.0, L / 2 - 1.2, -3.5, 0),
      box(0.5, 3.6, 3.0, -0.5, -3.5, 0),
      box(3.0, 3.6, 0.5, 3.5, -3.5, W / 2 - 0.6),
    ];
    return mergeAll([pin, tip, spring, ...legs]);
  }, []);
  return (
    <group>
      <mesh geometry={body}>
        <Material preset="absBlack" roughness={0.48} roughnessMap={noise} clip cutColor="#121214" />
      </mesh>
      <mesh geometry={metal}>
        <Material preset="tin" roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// HC-49/S crystal (long axis along X)

export const CRYSTAL = { L: 11.05, W: 4.65, H: 3.5, pitch: 4.88 };

function stadium(l: number, w: number): Shape {
  return roundedRectShape(l, w, w / 2 - 0.001);
}

export function CrystalHc49({ label, height = CRYSTAL.H }: { label: string; height?: number }) {
  const { L, W, pitch } = CRYSTAL;
  const can = useDisposable(() => {
    const top = extrudeUp(stadium(L, W), height, 0.3, { curveSegments: 16, bevelSegments: 3 });
    top.translate(0, 0.35, 0);
    const flange = extrudeUp(stadium(L + 0.4, W + 0.4), 0.4, 0.1, { curveSegments: 16 });
    return mergeAll([top, flange]);
  }, [height]);
  const leads = useDisposable(
    () => mergeAll([-1, 1].map((s) => box(0.45, 3.4, 0.45, (s * pitch) / 2, -3.2, 0))),
    [],
  );
  const marking = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(40,40,44,0.92)';
      fitText(ctx, label, w / 2, h / 2, w * 0.7, h * 0.5, { weight: 700, family: FONT_MONO });
    },
    label,
    { width: 256, height: 96, fonts: [`700 40px ${FONT_MONO}`] },
  );
  return (
    <group>
      <mesh geometry={can}>
        <Material preset="nickel" color="#dcdcd8" roughness={0.22} clip cutColor="#77756f" />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" />
      </mesh>
      <Decal
        map={marking}
        width={L - W}
        height={(L - W) * 0.375}
        position={[0, height + 0.35 + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        roughness={0.6}
        clip
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Moulded SMD packages

interface GullLead {
  /** Side of the body: +1 (+Z) or −1 (−Z). */
  side: 1 | -1;
  x: number;
  width: number;
}

/** Gull-wing leads leaving a body of half-depth `half`, tips at `reach` beyond it. */
function gullLeads(leads: GullLead[], half: number, reach: number, leadY: number, t = 0.15) {
  const parts = leads.map((l) => {
    const one = bentStrip(
      [
        [-0.2, leadY],
        [0.2, leadY],
        [Math.min(0.55, reach * 0.45), t / 2],
        [reach, t / 2],
      ],
      t,
      l.width,
      0.15,
    );
    one.applyMatrix4(
      placed([l.x, 0, l.side * half], [0, l.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]),
    );
    return one;
  });
  return mergeAll(parts);
}

interface MoldedProps {
  /** Body length (X), width (Z) and height. */
  l: number;
  w: number;
  h: number;
  standoff?: number;
  leads: GullLead[];
  reach: number;
  lines?: string[];
  /** Cap height of the marking (mm). */
  text?: number;
}

/** A moulded SMD body with gull-wing leads and, with `lines`, a laser-etched top. */
function Molded({ l, w, h, standoff = 0.08, leads, reach, lines = [], text = 0.8 }: MoldedProps) {
  const body = useDisposable(
    () =>
      moldedBlock({
        width: l,
        depth: w,
        height: h,
        corner: 0.12,
        fillet: 0.1,
        draft: 0.06,
        parting: h * 0.45,
      }).translate(0, standoff, 0),
    [l, w, h, standoff],
  );
  const metal = useDisposable(
    () => gullLeads(leads, w / 2, reach, standoff + h * 0.45),
    [leads, w, reach, standoff, h],
  );
  const noise = getNoiseTexture();
  return (
    <group>
      <mesh geometry={body}>
        <Material
          attach="material-0"
          preset="epoxyBlack"
          roughnessMap={noise}
          clip
          cutColor="#2a2a2c"
        />
        {lines.length > 0 ? (
          <PrintedTop l={l} w={w} lines={lines} text={text} />
        ) : (
          <Material
            attach="material-1"
            preset="epoxyBlack"
            roughnessMap={noise}
            clip
            cutColor="#2a2a2c"
          />
        )}
      </mesh>
      <mesh geometry={metal}>
        <Material preset="tin" roughness={0.26} />
      </mesh>
    </group>
  );
}

function PrintedTop({
  l,
  w,
  lines,
  text,
}: {
  l: number;
  w: number;
  lines: string[];
  text: number;
}) {
  const top = usePrintedTop({
    width: l,
    height: w,
    lines: lines.map((t) => ({ text: t, size: text, mono: true })),
  });
  return (
    <Material
      attach="material-1"
      preset="epoxyBlack"
      color="#ffffff"
      map={top.map}
      roughnessMap={top.roughnessMap}
      bumpMap={top.bumpMap}
      bumpScale={0.4}
      clip
      cutColor="#2a2a2c"
    />
  );
}

/** SOT-223 regulator: three leads on −Z, the wide tab on +Z. */
export function Sot223({ lines = ['1117', '5.0'] }: { lines?: string[] }) {
  const leads = useMemo<GullLead[]>(
    () => [
      ...pinRow(3, 2.3).map((x) => ({ side: -1 as const, x, width: 0.7 })),
      { side: 1, x: 0, width: 3.0 },
    ],
    [],
  );
  return <Molded l={6.5} w={3.5} h={1.6} leads={leads} reach={1.75} lines={lines} text={0.75} />;
}

/** SOT-23 transistor or regulator: two leads on −Z, one on +Z. */
export function Sot23({ lines = [] }: { lines?: string[] }) {
  const leads = useMemo<GullLead[]>(
    () => [
      { side: -1, x: -0.95, width: 0.4 },
      { side: -1, x: 0.95, width: 0.4 },
      { side: 1, x: 0, width: 0.4 },
    ],
    [],
  );
  return <Molded l={2.9} w={1.3} h={1.0} leads={leads} reach={0.55} lines={lines} text={0.45} />;
}

/** SMA diode: J-leads at the ends (X), cathode band at −X. */
export function SmaDiode() {
  const noise = getNoiseTexture();
  const body = useDisposable(
    () =>
      moldedBlock({
        width: 4.3,
        depth: 2.6,
        height: 2.0,
        corner: 0.15,
        fillet: 0.15,
        draft: 0.08,
      }).translate(0, 0.1, 0),
    [],
  );
  const band = useDisposable(() => box(0.7, 0.02, 2.3, -1.45, 2.1, 0), []);
  const leads = useDisposable(
    () =>
      mergeAll(
        [-1, 1].flatMap((s) => [
          box(0.2, 1.1, 1.5, s * 2.25, 0.05, 0),
          box(1.2, 0.2, 1.5, s * 2.0, 0, 0),
        ]),
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={body}>
        <Material preset="epoxyBlack" roughnessMap={noise} clip cutColor="#2a2a2c" />
      </mesh>
      <mesh geometry={band}>
        <Material color="#b9bcc0" roughness={0.6} />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Chip resistors, capacitors and fuses

export type ChipSize = '0402' | '0603' | '0805' | '1206' | '1812';
export type ChipKind = 'r' | 'c' | 'f';

export interface ChipItem {
  /** Centre (x, z) in the parent's space. */
  at: [number, number];
  /** Rotation (degrees, counter-clockwise from the top). */
  rot?: number;
  size: ChipSize;
  kind: ChipKind;
}

/** Length, width, height of a resistor, end-cap length (mm). */
const CHIP_DIMS: Record<ChipSize, [number, number, number, number]> = {
  '0402': [1.0, 0.5, 0.35, 0.25],
  '0603': [1.6, 0.8, 0.45, 0.3],
  '0805': [2.0, 1.25, 0.5, 0.4],
  '1206': [3.2, 1.6, 0.55, 0.5],
  '1812': [4.5, 3.2, 0.85, 0.5],
};

const CHIP_COLORS: Record<ChipKind, string> = { r: '#1d1d1f', c: '#b79a6c', f: '#2f5a37' };

/** Many chip parts at once: one geometry per body colour and one for the end caps. */
export function ChipParts({ items }: { items: ChipItem[] }) {
  const geometries = useMemo(() => {
    const bodies: Record<ChipKind, BufferGeometry[]> = { r: [], c: [], f: [] };
    const caps: BufferGeometry[] = [];
    for (const item of items) {
      const [l, w, h0, cap] = CHIP_DIMS[item.size];
      const h = item.kind === 'c' ? Math.min(w, h0 * 1.7) : h0;
      const m = placed([item.at[0], 0, item.at[1]], [0, ((item.rot ?? 0) * Math.PI) / 180, 0]);
      const b = box(l - 2 * cap + 0.02, h * 0.96, w * 0.98, 0, 0.01, 0).applyMatrix4(m);
      bodies[item.kind].push(b);
      for (const s of [-1, 1]) caps.push(box(cap, h, w, (s * (l - cap)) / 2, 0, 0).applyMatrix4(m));
    }
    const merge = (list: BufferGeometry[]) => (list.length ? mergeAll(list) : null);
    return { r: merge(bodies.r), c: merge(bodies.c), f: merge(bodies.f), caps: merge(caps) };
  }, [items]);
  useEffect(() => () => Object.values(geometries).forEach((g) => g?.dispose()), [geometries]);
  return (
    <group>
      {(['r', 'c', 'f'] as const).map((k) =>
        geometries[k] ? (
          <mesh key={k} geometry={geometries[k]}>
            <Material
              color={CHIP_COLORS[k]}
              roughness={k === 'c' ? 0.55 : 0.45}
              clearcoat={k === 'f' ? 0.4 : 0}
              clip
            />
          </mesh>
        ) : null,
      )}
      {geometries.caps && (
        <mesh geometry={geometries.caps}>
          <Material preset="tin" roughness={0.32} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Chip LED 0805 (long axis along X)

export interface SmdLedProps {
  /** Light colour (sRGB). */
  light: string;
  /** Lens tint when off. */
  lens: string;
  /** 0..1 */
  brightness: number;
}

export const SMD_LED_TOP = 0.8;

export function SmdLed({ light, lens, brightness }: SmdLedProps) {
  const level = Math.max(brightness, 0);
  const lensGlow = emission(light, Math.min(level, 1.5) * 2.4, 1);
  const chipGlow = emission(light, level, GLOW);
  return (
    <group>
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[1.3, 0.34, 1.25]} />
        <Material preset="absWhite" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.34 + 0.23, 0]}>
        <boxGeometry args={[1.95, 0.46, 1.2]} />
        <Material
          color={level > 0 ? mixHex(lens, '#ffffff', 0.35) : lens}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.05}
          emissive={lensGlow.emissive}
          emissiveIntensity={lensGlow.emissiveIntensity}
        />
      </mesh>
      <mesh position={[0, SMD_LED_TOP + 0.005, 0]}>
        <boxGeometry args={[0.32, 0.01, 0.32]} />
        <Material
          color="#d9c27a"
          roughness={0.4}
          emissive={chipGlow.emissive}
          emissiveIntensity={chipGlow.emissiveIntensity}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.85, 0.2, 0]}>
          <boxGeometry args={[0.32, 0.4, 1.26]} />
          <Material preset="tin" roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) * (1 - t) + ch(pb, s) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------------------
// SMD aluminium electrolytic capacitor (polarity mark towards −X)

export function SmdElectrolytic({
  label = '47',
  volts = '16V',
}: {
  label?: string;
  volts?: string;
}) {
  const R = 3.15;
  const H = 5.4;
  const can = useDisposable(() => {
    const profile: [number, number][] = [[0, 0.6]];
    profile.push([R - 0.05, 0.6], [R, 0.7], [R, 1.55], [R - 0.22, 1.7], [R - 0.22, 1.85]);
    profile.push([R, 2.0]);
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const a = (Math.PI / 2) * (i / steps);
      profile.push([R - 0.3 + Math.cos(a) * 0.3, H - 0.3 + Math.sin(a) * 0.3]);
    }
    profile.push([0, H]);
    return axialLathe(profile, 40);
  }, []);
  const base = useDisposable(() => {
    const s = new Shape();
    const h = 3.3;
    const c = 1.0;
    // Chamfered corners on the + side (+X), like the real bases.
    s.moveTo(-h, -h);
    s.lineTo(h - c, -h);
    s.lineTo(h, -h + c);
    s.lineTo(h, h - c);
    s.lineTo(h - c, h);
    s.lineTo(-h, h);
    s.closePath();
    return extrudeUp(s, 1.0, 0.1, { curveSegments: 1, bevelSegments: 1 });
  }, []);
  const leads = useDisposable(
    () => mergeAll([-1, 1].map((s) => box(1.6, 0.2, 0.8, s * 3.3, 0, 0))),
    [],
  );
  const top = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      // Black segment marks the negative side.
      ctx.fillStyle = '#141416';
      ctx.fillRect(0, 0, w * 0.27, h);
      ctx.fillStyle = 'rgba(20,20,22,0.9)';
      fitText(ctx, label, w * 0.62, h * 0.4, w * 0.5, h * 0.2, { weight: 700, family: FONT_MONO });
      fitText(ctx, volts, w * 0.62, h * 0.64, w * 0.5, h * 0.16, {
        weight: 700,
        family: FONT_MONO,
      });
      ctx.restore();
    },
    `${label}|${volts}`,
    { width: 256, height: 256, fonts: [`700 40px ${FONT_MONO}`] },
  );
  return (
    <group>
      <mesh geometry={base}>
        <Material preset="absBlack" roughness={0.6} clip />
      </mesh>
      <mesh geometry={can}>
        <Material preset="aluminum" roughness={0.3} clip cutColor="#8c8f93" />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" />
      </mesh>
      <Decal
        map={top}
        width={R * 2 - 0.6}
        height={R * 2 - 0.6}
        position={[0, H + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        roughness={0.5}
        clip
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// SMD tactile switch 6,0 × 3,5 mm (long side along X)

export function SmdButton() {
  const noise = getNoiseTexture();
  const plastic = useDisposable(() => {
    const base = extrudeUp(roundedRectShape(6.0, 3.5, 0.2), 1.5, 0.1, { curveSegments: 2 });
    const plunger = extrudeUp(roundedRectShape(1.7, 1.2, 0.25), 1.0, 0.15, { curveSegments: 3 });
    plunger.translate(0, 1.5, 0);
    return mergeAll([base, plunger]);
  }, []);
  const metal = useDisposable(() => {
    const frame = new Shape();
    addRoundedRect(frame, 6.0, 3.5, 0.2);
    const hole = new Path();
    addRoundedRect(hole, 2.1, 1.6, 0.3, 0, 0, true);
    frame.holes.push(hole);
    const plate = extrudeUp(frame, 0.2, 0, { curveSegments: 2 });
    plate.translate(0, 1.5, 0);
    const legs = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => box(1.0, 0.18, 0.7, sx * 3.25, 0, sz * 1.15)),
    );
    const sides = [-1, 1].map((sx) => box(0.15, 1.6, 2.4, sx * 3.0, 0.1, 0));
    return mergeAll([plate, ...legs, ...sides]);
  }, []);
  return (
    <group>
      <mesh geometry={plastic}>
        <Material preset="absBlack" roughness={0.55} roughnessMap={noise} clip />
      </mesh>
      <mesh geometry={metal}>
        <Material preset="steel" color="#c4c6c8" roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Wi-Fi module (pin end at −X, antenna at +X)

export const WIFI = { L: 25.5, W: 18, T: 0.8, shieldL: 17.6, shieldW: 15.8, shieldH: 2.3 };
/** Shield centre (x) in the module. */
export const WIFI_SHIELD_X = -WIFI.L / 2 + 1.0 + WIFI.shieldL / 2;

/** Castellated pads: 14 on each long side (1,27 mm) and 10 on the pin end. */
export function wifiPads(): { x: number; z: number; side: 'n' | 's' | 'w' }[] {
  const out: { x: number; z: number; side: 'n' | 's' | 'w' }[] = [];
  const x0 = -WIFI.L / 2 + 1.5;
  for (let i = 0; i < 14; i++) {
    out.push({ x: x0 + i * 1.27, z: -WIFI.W / 2, side: 'n' });
    out.push({ x: x0 + i * 1.27, z: WIFI.W / 2, side: 's' });
  }
  for (const z of pinRow(10, 1.27)) out.push({ x: -WIFI.L / 2, z, side: 'w' });
  return out;
}

export function WifiModule() {
  const { L, W, T, shieldL, shieldW, shieldH } = WIFI;
  const top = useCanvasTexture(
    (ctx, w, h) => {
      const k = w / L;
      ctx.fillStyle = '#16191e';
      ctx.fillRect(0, 0, w, h);
      // Canvas x along the module (−X → +X), y along +Z.
      const px = (x: number) => (x + L / 2) * k;
      const pz = (z: number) => (z + W / 2) * k;
      // Meander antenna (copper under the mask), beyond the shield.
      ctx.strokeStyle = '#3a3a33';
      ctx.lineWidth = 0.5 * k;
      ctx.lineJoin = 'miter';
      const ax0 = WIFI_SHIELD_X + shieldL / 2 + 1.3;
      const ax1 = L / 2 - 0.9;
      ctx.beginPath();
      ctx.moveTo(px(ax0), pz(-W / 2 + 2.2));
      ctx.lineTo(px(ax0 + 1.2), pz(-W / 2 + 2.2));
      let z = -W / 2 + 2.2;
      const step = 1.6;
      let up = true;
      while (z < W / 2 - 3) {
        const x = up ? ax1 : ax0 + 1.2;
        ctx.lineTo(px(x), pz(z));
        z += step;
        ctx.lineTo(px(x), pz(z));
        up = !up;
      }
      ctx.stroke();
      // Feed and ground stub of the antenna.
      ctx.fillStyle = '#3a3a33';
      ctx.fillRect(px(ax0 - 0.4), pz(-W / 2 + 1.4), 0.9 * k, 3.6 * k);
      // Keep-out line next to the shield, and the gold castellations.
      ctx.fillStyle = '#d8b25a';
      for (const p of wifiPads()) {
        if (p.side === 'w') ctx.fillRect(0, pz(p.z) - 0.35 * k, 0.9 * k, 0.7 * k);
        else ctx.fillRect(px(p.x) - 0.35 * k, p.side === 'n' ? 0 : h - 0.9 * k, 0.7 * k, 0.9 * k);
      }
      ctx.fillStyle = '#e8e8e2';
      ctx.beginPath();
      ctx.arc(px(-L / 2 + 1.6), pz(-W / 2 + 2.0), 0.35 * k, 0, Math.PI * 2);
      ctx.fill();
    },
    'wifi-top',
    { width: 1024, height: 724 },
  );
  const board = useDisposable(() => box(L, T, W), []);
  const castellations = useDisposable(
    () =>
      mergeAll(
        wifiPads().map((p) =>
          p.side === 'w'
            ? box(0.12, T + 0.04, 0.7, p.x - 0.03, -0.02, p.z)
            : box(0.7, T + 0.04, 0.12, p.x, -0.02, p.z + (p.side === 'n' ? -0.03 : 0.03)),
        ),
      ),
    [],
  );
  const shield = useDisposable(
    () =>
      shellGeometry(shieldL, shieldH, shieldW, 0.35, 0.25, 0.15, 0.15).translate(
        WIFI_SHIELD_X,
        T,
        0,
      ),
    [],
  );
  // Under the shield: the Wi-Fi chip (QFN 6 × 6), the flash memory, the crystal.
  const chips = useDisposable(() => {
    const qfn = box(6, 0.85, 6, WIFI_SHIELD_X + 2.4, T, 0.6);
    const flash = box(5.0, 1.2, 4.0, WIFI_SHIELD_X - 4.6, T, -3.2);
    return mergeAll([qfn, flash]);
  }, []);
  const crystalLid = useDisposable(() => box(3.2, 0.75, 2.5, WIFI_SHIELD_X - 4.6, T, 3.6), []);
  return (
    <group>
      <mesh geometry={board}>
        <Material color="#16191e" roughness={0.5} clearcoat={0.5} clearcoatRoughness={0.4} />
      </mesh>
      <mesh position={[0, T + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L, W]} />
        <Material map={top} roughness={0.45} clearcoat={0.6} clearcoatRoughness={0.35} />
      </mesh>
      <mesh geometry={castellations}>
        <Material preset="gold" />
      </mesh>
      <mesh geometry={shield}>
        <Material
          preset="nickel"
          color="#cfd0cc"
          roughness={0.34}
          roughnessMap={getNoiseTexture()}
          clip
          cutColor="#77756f"
        />
      </mesh>
      <mesh geometry={chips}>
        <Material preset="epoxyBlack" roughness={0.6} />
      </mesh>
      <mesh geometry={crystalLid}>
        <Material preset="nickel" roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Board with a custom outline

/**
 * `<PrintedCircuitBoard>` with an outline other than a rectangle (layout
 * points, mm from the top-left corner): the substrate the generator extrudes
 * is swapped, after it mounts, for the same extrusion with this outline
 * (same face groups and UVs, so the maps land in the same place).
 */
export function OutlineBoard({ layout, outline }: { layout: PcbLayout; outline: Point[] }) {
  const ref = useRef<Group>(null);
  const geometry = useMemo(() => outlineGeometry(layout, outline), [layout, outline]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      if (o instanceof Mesh && o.geometry instanceof ExtrudeGeometry && o.geometry !== geometry)
        o.geometry = geometry;
    });
  });
  return (
    <group ref={ref}>
      <PrintedCircuitBoard layout={layout} />
    </group>
  );
}

function outlineGeometry(layout: PcbLayout, outline: Point[]): ExtrudeGeometry {
  const l = resolveLayout(layout);
  const { width: W, height: H } = l;
  const shape = new Shape();
  outline.forEach(([x, y], i) =>
    i === 0 ? shape.moveTo(x - W / 2, H / 2 - y) : shape.lineTo(x - W / 2, H / 2 - y),
  );
  shape.closePath();
  const drills = [
    ...l.pads.filter((p) => p.drill !== undefined).map((p) => ({ at: p.at, d: p.drill! })),
    ...l.holes.map((h) => ({ at: h.at, d: h.drill })),
  ];
  for (const { at, d } of drills) {
    const hole = new Path();
    hole.absarc(at[0] - W / 2, H / 2 - at[1], d / 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geometry = new ExtrudeGeometry(shape, {
    depth: l.thickness,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geometry.rotateX(-Math.PI / 2);
  const [lids, edges] = geometry.groups;
  const half = (lids?.count ?? 0) / 2;
  geometry.clearGroups();
  geometry.addGroup(0, half, 0);
  geometry.addGroup(half, half, 1);
  if (edges) geometry.addGroup(edges.start, edges.count, 2);
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < half * 2; i++) uv.setXY(i, uv.getX(i) / W + 0.5, uv.getY(i) / H + 0.5);
  uv.needsUpdate = true;
  return geometry;
}
