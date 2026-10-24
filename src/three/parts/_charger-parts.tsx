/**
 * Parts of the USB wall charger (`phone-charger.tsx`) that the kit has no
 * part for, all generic and unmarked by any maker:
 *
 * - EE16 ferrite transformer (17 × 15 × 15 mm, the usual size in 5–10 W
 *   flyback chargers) with the winding and the core wrapped in yellow
 *   polyester tape, or the smaller EE13 with the bare enamelled wire of the
 *   cheap clones;
 * - USB-A receptacle (USB 2.0 outline: shell 13,1 × 5,6 mm, 14 mm deep,
 *   tongue 11 × 1,8 mm with four contacts);
 * - blue Y1 safety disc capacitor (8 mm, 7,5 mm pitch, "Y1 102M 400V~");
 * - NBR 14136 plug pin (Ø 4,0 mm, 19 mm out of the plug face, 19 mm apart);
 * - small SMD parts: 1206/0805 chips, SOT-23, the SOP-4 bridge (4,7 × 3,9 ×
 *   1,5 mm) and an SMC diode (7 × 6 × 2,3 mm), merged into a few meshes.
 *
 * Board parts rest their body on y = 0 (the board surface), with the leads
 * going LEAD_BELOW down through the board.
 */
import { BoxGeometry, Path, Shape, type BufferGeometry } from 'three';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { Vec3 } from '../types';
import { extrudeAlongX, extrudeUp, mergeAll, roundedRectShape } from './_em-geometry';
import { blobBottom, blobDecalGeometry, blobGeometry, type BlobShape } from './_passive-common';
import { roundedRectShell, scaleUv, useTurnsTexture } from './_power-shared';

/** How far the leads go below the board surface (1,2 mm board + the cut ends). */
export const LEAD_BELOW = 2.6;

/** Rounded box from y = 0 to h with few facets (these parts are small). */
function roundedBox(w: number, h: number, d: number, r: number, bevel = Math.min(r, 0.4)) {
  return extrudeUp(roundedRectShape(w, d, r), h, bevel, { curveSegments: 3, bevelSegments: 1 });
}

/** Plain box from y = 0 to h, centred on (x, z). */
function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

// ---------------------------------------------------------------------------
// Ferrite transformer.

/** Scale of the clone's EE13 against the EE16. */
const SMALL = 0.78;

/** Pins (x, z) of the transformer: primary row at −z, secondary row at +z. */
export function transformerPins(small: boolean): [number, number][] {
  const k = small ? SMALL : 1;
  return [-5.625, -1.875, 1.875, 5.625].flatMap((x) => [
    [x * k, -6.5 * k],
    [x * k, 6.5 * k],
  ]);
}

/** Footprint (x × z) and height of the transformer. */
export function transformerSize(small: boolean) {
  const k = small ? SMALL : 1;
  return { w: 17 * k, d: 15 * k, h: 15 * k };
}

/**
 * EE ferrite transformer standing on its bobbin: black bobbin rails with the
 * pins, the winding between the two E halves of the core (outer legs and
 * yokes; the centre leg is inside the winding). `taped`: the winding is
 * wrapped in yellow polyester tape and a band of tape holds the core; without
 * it the outer layer of enamelled wire shows.
 */
export function ChargerTransformer({ small, taped }: { small: boolean; taped: boolean }) {
  const k = small ? SMALL : 1;
  const noise = getNoiseTexture();
  const turns = useTurnsTexture('color');
  const turnsBump = useTurnsTexture('bump');
  const rails = useDisposable(
    () =>
      mergeAll(
        [-1, 1].map((s) => {
          const g = roundedBox(17 * k, 2.4 * k, 3.2 * k, 0.4 * k, 0.2);
          g.translate(0, 0, s * 5.9 * k);
          return g;
        }),
      ),
    [k],
  );
  const winding = useDisposable(() => {
    const g = roundedBox(11 * k, 8 * k, 11.6 * k, 2.2 * k, 0.6 * k);
    g.translate(0, 4.7 * k, 0);
    // Tile the turns texture: 8 turns of 0,3 mm wire per tile.
    return scaleUv(g, 1 / 2.4, 1 / 2.4);
  }, [k]);
  const core = useDisposable(
    () =>
      mergeAll([
        roundedBox(16 * k, 2.2 * k, 4.8 * k, 0.3, 0.2).translate(0, 2.4 * k, 0),
        roundedBox(16 * k, 2.2 * k, 4.8 * k, 0.3, 0.2).translate(0, 12.8 * k, 0),
        roundedBox(2.5 * k, 8.2 * k, 4.8 * k, 0.3, 0.15).translate(-6.75 * k, 4.6 * k, 0),
        roundedBox(2.5 * k, 8.2 * k, 4.8 * k, 0.3, 0.15).translate(6.75 * k, 4.6 * k, 0),
        // Centre leg, inside the winding (seen in the cut).
        roundedBox(4 * k, 8.2 * k, 4.4 * k, 0.6, 0.15).translate(0, 4.6 * k, 0),
      ]),
    [k],
  );
  // Band of tape around the outer legs and the winding.
  const band = useDisposable(
    () => roundedRectShell(16 * k + 0.4, 11.6 * k + 0.4, 1.2 * k, 6 * k, 11.2 * k, 0.15, 3),
    [k],
  );
  const pins = useDisposable(
    () =>
      mergeAll(
        transformerPins(small).map(([x, z]) =>
          box(0.6, LEAD_BELOW + 2.2 * k, 0.6, x, -LEAD_BELOW, z),
        ),
      ),
    [small],
  );
  const tape = '#e2bc2b';
  return (
    <group>
      <mesh geometry={rails}>
        <Material preset="pbtBlack" roughnessMap={noise} clip cutColor="#2a2a2c" />
      </mesh>
      <mesh geometry={winding}>
        {taped ? (
          <Material
            color={tape}
            roughness={0.34}
            clearcoat={0.4}
            clearcoatRoughness={0.3}
            clip
            cutColor="#b4582c"
          />
        ) : (
          <Material
            preset="magnetWire"
            color="#ffffff"
            map={turns}
            bumpMap={turnsBump}
            bumpScale={0.6}
            clip
            cutColor="#b4582c"
          />
        )}
      </mesh>
      <mesh geometry={core}>
        <Material preset="ferrite" roughnessMap={noise} metalness={0.1} clip cutColor="#1d1d1f" />
      </mesh>
      {taped && (
        <mesh geometry={band}>
          <Material color={tape} roughness={0.3} clearcoat={0.5} clearcoatRoughness={0.3} clip />
        </mesh>
      )}
      <mesh geometry={pins}>
        <Material preset="tin" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// USB-A receptacle.

export const USB = { length: 14, width: 13.1, height: 5.6, wall: 0.3 };

/** Through-hole pins (x, z) of the receptacle: four contacts at the back, two shell tabs. */
export const USB_PINS: [number, number][] = [
  ...[-3.5, -1, 1, 3.5].map((z): [number, number] => [-USB.length / 2 - 0.5, z]),
  [0, -USB.width / 2],
  [0, USB.width / 2],
];

/**
 * USB-A receptacle with its opening towards +X: tin-plated steel shell, back
 * plate, black tongue with the four contacts on its underside, the contact
 * pins at the back and the two shell tabs soldered through the board.
 */
export function UsbReceptacle() {
  const { length: L, width: W, height: H, wall: t } = USB;
  const shell = useDisposable(() => {
    const shape = new Shape();
    shape.moveTo(-W / 2, 0);
    shape.lineTo(W / 2, 0);
    shape.lineTo(W / 2, H);
    shape.lineTo(-W / 2, H);
    shape.closePath();
    const hole = new Path();
    hole.moveTo(-W / 2 + t, t);
    hole.lineTo(-W / 2 + t, H - t);
    hole.lineTo(W / 2 - t, H - t);
    hole.lineTo(W / 2 - t, t);
    hole.closePath();
    shape.holes.push(hole);
    return mergeAll([
      extrudeAlongX(shape, L),
      box(t, H, W, -L / 2 + t / 2),
      // Shell tabs down through the board.
      box(1.2, LEAD_BELOW + 0.5, 0.3, 0, -LEAD_BELOW, -W / 2 + 0.15),
      box(1.2, LEAD_BELOW + 0.5, 0.3, 0, -LEAD_BELOW, W / 2 - 0.15),
      // Spring latches pressed into the top.
      box(2.2, 0.15, 1.2, L / 2 - 3.2, H - 0.05, -3),
      box(2.2, 0.15, 1.2, L / 2 - 3.2, H - 0.05, 3),
    ]);
  }, []);
  const tongue = useDisposable(() => box(L - 4.2, 1.8, 11, -2.1 + 0.15, 2.95, 0), []);
  const contacts = useDisposable(
    () =>
      mergeAll([
        ...[-3.5, -1, 1, 3.5].map((z) =>
          box(6, 0.08, z === -1 || z === 1 ? 1 : 1.2, -0.8, 2.87, z),
        ),
        ...[-3.5, -1, 1, 3.5].map((z) =>
          box(0.5, LEAD_BELOW + 2.2, 0.4, -L / 2 - 0.5, -LEAD_BELOW, z),
        ),
        ...[-3.5, -1, 1, 3.5].map((z) => box(0.9, 0.4, 0.4, -L / 2 - 0.15, 1.8, z)),
      ]),
    [],
  );
  return (
    <group>
      <mesh geometry={shell}>
        <Material preset="tin" color="#cfd2d4" roughness={0.3} clip />
      </mesh>
      <mesh geometry={tongue}>
        <Material preset="pbtBlack" clip />
      </mesh>
      <mesh geometry={contacts}>
        <Material preset="gold" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Y1 safety capacitor.

const Y_SHAPE: BlobShape = {
  a: 4,
  b: 4,
  c: 2.2,
  e1: 0.5,
  e2: 1,
  drip: 0.16,
  bottom: 0.25,
  taper: 0.18,
};
export const Y_PITCH = 7.5;

/**
 * Blue dipped Y1 capacitor, the class that may sit across the isolation
 * barrier: if it fails, it opens, never shorts. Body bottom `up` mm above the
 * board, face towards +Z.
 */
export function YCapacitor({ up = 1.5 }: { up?: number }) {
  const s = Y_SHAPE;
  const cy = up - blobBottom(s);
  const body = useDisposable(() => blobGeometry(s, 24, 48), []);
  const front = useDisposable(
    () => blobDecalGeometry(s, { uw: s.a * 1.7, uh: s.b * 1.7, side: 1, reach: 0.82 }),
    [],
  );
  const back = useDisposable(
    () => blobDecalGeometry(s, { uw: s.a * 1.7, uh: s.b * 1.7, side: -1, reach: 0.82 }),
    [],
  );
  const ink = '#f2f4f8';
  const frontMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = ink;
      fitText(ctx, 'Y1', w / 2, h * 0.32, w * 0.5, h * 0.26, { weight: 700 });
      fitText(ctx, '102M', w / 2, h * 0.6, w * 0.66, h * 0.2, { weight: 700 });
    },
    'y1-front',
    { width: 256, height: 256, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const backMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = ink;
      fitText(ctx, '400V~', w / 2, h * 0.4, w * 0.7, h * 0.19, { weight: 700 });
      fitText(ctx, 'X1 440V~', w / 2, h * 0.62, w * 0.7, h * 0.15, { weight: 700 });
    },
    'y1-back',
    { width: 256, height: 256, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const half = Y_PITCH / 2;
  const lead = (side: 1 | -1): Vec3[] => [
    [side * half, -LEAD_BELOW, 0],
    [side * half, up + 0.6, 0],
    [side * half * 0.5, cy - s.b * 0.35, 0],
    [side * half * 0.4, cy, 0],
  ];
  return (
    <group>
      <group position={[0, cy, 0]}>
        <mesh geometry={body}>
          <Material
            preset="epoxyOrange"
            color="#2f5fd0"
            roughness={0.38}
            clearcoat={0.55}
            clearcoatRoughness={0.3}
            clip
            cutColor="#1d3c86"
          />
        </mesh>
        {[front, back].map((g, i) => (
          <mesh key={i} geometry={g}>
            <Material
              color="#ffffff"
              map={i === 0 ? frontMap : backMap}
              transparent
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-2}
              roughness={0.5}
              clip
            />
          </mesh>
        ))}
      </group>
      <Wire points={lead(1)} radius={0.3} bend={0.8} />
      <Wire points={lead(-1)} radius={0.3} bend={0.8} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Plug pins.

/** NBR 14136 plug: pin diameter, length out of the plug face and spacing (mm). */
export const PLUG = { d: 4, length: 19, spacing: 19 };

/**
 * One plug pin along −X from the plug face at x = 0: rounded tip, the shank
 * through the wall (`wall` thick) and a collar and a solder lug inside.
 */
export function PlugPin({ wall }: { wall: number }) {
  const r = PLUG.d / 2;
  const geometry = useDisposable(() => {
    const L = PLUG.length;
    const profile: [number, number][] = [
      [0, -L],
      [r * 0.55, -L + 0.08],
      [r * 0.85, -L + 0.45],
      [r, -L + 1.1],
      [r, wall],
      [r + 1, wall],
      [r + 1, wall + 1.2],
      [r * 0.8, wall + 1.2],
      [r * 0.8, wall + 3.2],
      [0, wall + 3.2],
    ];
    const g = axialLathe(profile, 28);
    g.rotateZ(-Math.PI / 2);
    return g;
  }, [wall]);
  const lug = useDisposable(() => box(2.6, 0.5, 3, wall + 4.2, -0.25, 0), [wall]);
  return (
    <group>
      <mesh geometry={geometry}>
        <Material preset="nickel" roughness={0.24} clip />
      </mesh>
      <mesh geometry={lug}>
        <Material preset="brass" clip />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// SMD parts.

export type SmdKind = 'r1206' | 'r0805' | 'c0805' | 'sot23' | 'sop4' | 'smc';

export interface SmdItem {
  kind: SmdKind;
  /** Position on the board surface (part space x, z). */
  at: [number, number];
  /** Turned about Y (degrees, counter-clockwise from the top). */
  rotation?: number;
}

/** Footprint pads (local x, z) and pad size of each SMD kind, for the board layout. */
export const SMD_PADS: Record<SmdKind, { pads: [number, number][]; size: [number, number] }> = {
  r1206: {
    pads: [
      [-1.5, 0],
      [1.5, 0],
    ],
    size: [1.2, 1.8],
  },
  r0805: {
    pads: [
      [-0.95, 0],
      [0.95, 0],
    ],
    size: [1, 1.4],
  },
  c0805: {
    pads: [
      [-0.95, 0],
      [0.95, 0],
    ],
    size: [1, 1.4],
  },
  sot23: {
    pads: [
      [-0.95, -1.1],
      [0.95, -1.1],
      [0, 1.1],
    ],
    size: [0.8, 1],
  },
  sop4: {
    pads: [
      [-1.27, -2.9],
      [1.27, -2.9],
      [-1.27, 2.9],
      [1.27, 2.9],
    ],
    size: [0.8, 1.4],
  },
  smc: {
    pads: [
      [-3.4, 0],
      [3.4, 0],
    ],
    size: [2.4, 3.4],
  },
};

function smdPieces(kind: SmdKind) {
  const black: BufferGeometry[] = [];
  const tan: BufferGeometry[] = [];
  const tin: BufferGeometry[] = [];
  const mark: BufferGeometry[] = [];
  const chip = (L: number, W: number, T: number, body: BufferGeometry[]) => {
    body.push(box(L - 0.5, T, W, 0, 0.02));
    for (const s of [-1, 1]) tin.push(box(0.3, T + 0.04, W + 0.04, s * (L / 2 - 0.15), 0));
  };
  const gull = (x: number, z: number, out: number) => {
    // Lead leaving the body side at z, bending down to a foot on the board.
    const dir = Math.sign(z);
    tin.push(box(0.4, 0.15, Math.abs(out), x, 0, z + (dir * Math.abs(out)) / 2));
  };
  switch (kind) {
    case 'r1206':
      chip(3.2, 1.6, 0.55, black);
      break;
    case 'r0805':
      chip(2, 1.25, 0.5, black);
      break;
    case 'c0805':
      chip(2, 1.25, 0.8, tan);
      break;
    case 'sot23':
      black.push(roundedBox(2.9, 1, 1.3, 0.1, 0.08).translate(0, 0.1, 0));
      for (const [x, z] of [
        [-0.95, -0.65],
        [0.95, -0.65],
        [0, 0.65],
      ] as const)
        gull(x, z, 0.6);
      break;
    case 'sop4':
      black.push(roundedBox(4.7, 1.5, 3.9, 0.15, 0.1).translate(0, 0.1, 0));
      for (const x of [-1.27, 1.27]) for (const z of [-1.95, 1.95]) gull(x, z, 1.4);
      mark.push(box(0.9, 0.02, 0.9, -1.6, 1.6, -1.1));
      break;
    case 'smc':
      black.push(roundedBox(5.6, 2.3, 6, 0.2, 0.15).translate(0, 0, 0));
      for (const s of [-1, 1]) tin.push(box(1.4, 0.2, 3, s * 3.3, 0, 0));
      mark.push(box(0.8, 0.02, 5.4, -2.2, 2.3, 0));
      break;
  }
  return { black, tan, tin, mark };
}

/** A set of SMD parts, merged into four meshes (bodies, ceramic, tin, white marks). */
export function SmdParts({ items }: { items: SmdItem[] }) {
  const geometries = useDisposable(() => {
    const out = { black: [] as BufferGeometry[], tan: [] as BufferGeometry[] };
    const tin: BufferGeometry[] = [];
    const mark: BufferGeometry[] = [];
    for (const item of items) {
      const pieces = smdPieces(item.kind);
      const a = ((item.rotation ?? 0) * Math.PI) / 180;
      const place = (g: BufferGeometry) => g.rotateY(a).translate(item.at[0], 0, item.at[1]);
      out.black.push(...pieces.black.map(place));
      out.tan.push(...pieces.tan.map(place));
      tin.push(...pieces.tin.map(place));
      mark.push(...pieces.mark.map(place));
    }
    // One geometry with four groups: black, tan, tin, mark.
    const parts = [out.black, out.tan, tin, mark].map((list) =>
      list.length ? mergeAll(list) : null,
    );
    return mergeWithGroups(parts);
  }, [items]);
  return (
    <mesh geometry={geometries}>
      <Material attach="material-0" preset="epoxyBlack" />
      <Material attach="material-1" preset="ceramicTan" color="#b39a72" />
      <Material attach="material-2" preset="tin" />
      <Material attach="material-3" preset="silkscreen" />
    </mesh>
  );
}

/** Merges geometries (or holes) into one with a material group per entry. */
function mergeWithGroups(parts: (BufferGeometry | null)[]): BufferGeometry {
  const present = parts.filter((g): g is BufferGeometry => g !== null);
  const merged = mergeAll(present.map((g) => g.clone()));
  merged.clearGroups();
  let start = 0;
  parts.forEach((g, i) => {
    if (!g) return;
    const count = g.attributes.position!.count;
    merged.addGroup(start, count, i);
    start += count;
    g.dispose();
  });
  return merged;
}

// ---------------------------------------------------------------------------
// Bare wire jumper (the clone's "fuse" and filter inductor).

/** Tinned wire link between two pads `pitch` apart along X, arched `height` above the board. */
export function WireLink({ pitch, height = 0.6 }: { pitch: number; height?: number }) {
  const h = pitch / 2;
  const points: Vec3[] = [
    [-h, -LEAD_BELOW, 0],
    [-h, height, 0],
    [h, height, 0],
    [h, -LEAD_BELOW, 0],
  ];
  return <Wire points={points} radius={0.3} bend={0.6} />;
}
