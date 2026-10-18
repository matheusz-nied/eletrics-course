/**
 * Small parts of the CD-1 board that the kit has no part for: the ferrite
 * transformer of the 12 V switching supply, the 433,92 MHz receiver module
 * and its wire antenna. Generic shapes, no markings. Private to
 * `gate-control-board.tsx`.
 *
 * Every part here rests its body on y = 0 (the board surface) with the pins
 * going down through the board.
 */
import { BoxGeometry, type BufferGeometry } from 'three';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { roundedPath, smoothPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { Vec3 } from '../types';
import { extrudeUp, HelixCurve, mergeAll, roundedRectShape } from './_em-geometry';

/** Rounded box from y = 0 to h with few facets (these parts are small on the board). */
function roundedBox(w: number, h: number, d: number, r: number, bevel = Math.min(r, 0.4)) {
  return extrudeUp(roundedRectShape(w, d, r), h, bevel, { curveSegments: 2, bevelSegments: 1 });
}

/** Plain box from y = 0 to h. */
function box(w: number, h: number, d: number): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(0, h / 2, 0);
}

/** EE16 transformer: pins (x, z) in the part, two rows of four. */
export const TRANSFORMER_PINS: [number, number][] = [-5.625, -1.875, 1.875, 5.625].flatMap((x) => [
  [x, -6.5],
  [x, 6.5],
]);
export const TRANSFORMER_SIZE = { w: 17, d: 15, h: 16.9 };

const PIN_BELOW = 3.5;

/**
 * Horizontal EE16 ferrite transformer: black bobbin with the pin rails, the
 * winding wrapped in yellow polyester tape and the E–E core around it (outer
 * legs and yokes; the centre leg is inside the winding).
 */
export function FerriteTransformer() {
  const noise = getNoiseTexture();
  const rails = useDisposable(
    () =>
      mergeAll(
        [-1, 1].map((s) => {
          const g = roundedBox(17, 2.5, 3.2, 0.4, 0.2);
          g.translate(0, 0, s * 5.9);
          return g;
        }),
      ),
    [],
  );
  const winding = useDisposable(() => {
    const g = roundedBox(11, 9.4, 11.6, 2.2, 0.8);
    g.translate(0, 5, 0);
    return g;
  }, []);
  const core = useDisposable(() => {
    const parts = [
      // Bottom and top yokes.
      roundedBox(16, 2.4, 4.8, 0.3, 0.2).translate(0, 2.5, 0),
      roundedBox(16, 2.4, 4.8, 0.3, 0.2).translate(0, 14.5, 0),
      // Outer legs.
      roundedBox(2.5, 9.6, 4.8, 0.3, 0.15).translate(-6.75, 4.9, 0),
      roundedBox(2.5, 9.6, 4.8, 0.3, 0.15).translate(6.75, 4.9, 0),
    ];
    return mergeAll(parts);
  }, []);
  const pins = useDisposable(
    () =>
      mergeAll(
        TRANSFORMER_PINS.map(([x, z]) => {
          const g = box(0.6, PIN_BELOW + 2.5, 0.6);
          g.translate(x, -PIN_BELOW, z);
          return g;
        }),
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={rails}>
        <Material preset="pbtBlack" roughnessMap={noise} clip cutColor="#2a2a2c" />
      </mesh>
      <mesh geometry={winding}>
        <Material
          color="#e4bf2e"
          roughness={0.34}
          clearcoat={0.4}
          clearcoatRoughness={0.3}
          clip
          cutColor="#b4582c"
        />
      </mesh>
      <mesh geometry={core}>
        <Material
          color="#2c2c2e"
          roughness={0.78}
          roughnessMap={noise}
          metalness={0.1}
          clip
          cutColor="#1d1d1f"
        />
      </mesh>
      <mesh geometry={pins}>
        <Material preset="tin" />
      </mesh>
    </group>
  );
}

/** Receiver module: pins (x, z) in the part, and where the antenna is soldered. */
export const RF_PINS: [number, number][] = [-13.2, -10.66, -8.12, -5.58].map((x) => [x, 4.6]);
export const RF_ANTENNA: Vec3 = [14.2, 5.6, -4.4];
export const RF_SIZE = { w: 32, d: 12, lift: 4 };

/**
 * 433,92 MHz superheterodyne receiver module: small green board standing on
 * its four pins (VCC, DATA, DATA, GND), with the receiver chip, the crystal
 * that sets the frequency, the air-core coil of the RF front end and a few
 * SMD parts.
 */
export function RfModule() {
  const { w, d, lift } = RF_SIZE;
  const board = useDisposable(() => roundedBox(w, 1, d, 0.6, 0.15).translate(0, lift, 0), []);
  const chip = useDisposable(
    () => roundedBox(9.9, 1.5, 3.9, 0.15, 0.1).translate(3, lift + 1, -1.2),
    [],
  );
  const crystal = useDisposable(() => {
    const g = roundedBox(10.6, 3.4, 4.4, 1.6, 0.4);
    g.translate(-6, lift + 1, -1.6);
    return g;
  }, []);
  const coil = useDisposable(() => {
    const g = tube(new HelixCurve(0.9, 3.6, 4.5), 0.22, { radial: 5, segments: 54 });
    g.rotateZ(-Math.PI / 2);
    g.translate(8.2, lift + 2.1, 3.4);
    return g;
  }, []);
  const smd = useDisposable(
    () =>
      mergeAll(
        (
          [
            [10.5, -3.6],
            [12.3, 0.6],
            [10.2, 1.2],
            [-0.6, 3.6],
            [2.4, 3.6],
            [5.4, 3.6],
            [12.6, 3.4],
          ] as const
        ).map(([x, z]) => box(1.6, 0.55, 0.8).translate(x, lift + 1, z)),
      ),
    [],
  );
  const spacer = useDisposable(
    () => roundedBox(10.2, 2.5, 2.5, 0.2, 0.15).translate(-9.4, 0, 4.6),
    [],
  );
  const pins = useDisposable(
    () =>
      mergeAll(
        RF_PINS.map(([x, z]) =>
          box(0.64, lift + PIN_BELOW + 1.8, 0.64).translate(x, -PIN_BELOW, z),
        ),
      ),
    [],
  );
  const solder = useDisposable(
    () =>
      mergeAll(
        [...RF_PINS.map(([x, z]): Vec3 => [x, lift + 1, z]), RF_ANTENNA].map(([x, y, z]) =>
          roundedBox(1.5, 0.5, 1.5, 0.7, 0.24).translate(x, y === lift + 1 ? y : lift + 1, z),
        ),
      ),
    [],
  );
  return (
    <group>
      <mesh geometry={board}>
        <Material preset="solderMask" color="#15653c" clip cutColor="#aaa36f" />
      </mesh>
      <mesh geometry={chip}>
        <Material preset="epoxyBlack" clip />
      </mesh>
      <mesh geometry={crystal}>
        <Material preset="nickel" roughness={0.26} clip />
      </mesh>
      <mesh geometry={coil}>
        <Material preset="copper" />
      </mesh>
      <mesh geometry={smd}>
        <Material color="#8e7a5a" roughness={0.6} />
      </mesh>
      <mesh geometry={spacer}>
        <Material preset="pbtBlack" />
      </mesh>
      <mesh geometry={pins}>
        <Material preset="tin" />
      </mesh>
      <mesh geometry={solder}>
        <Material preset="solder" />
      </mesh>
    </group>
  );
}

/** Insulated wire antenna along `points` (smooth), with the stripped end soldered at the first point. */
export function WireAntenna({ points, color = '#e3bd1c' }: { points: Vec3[]; color?: string }) {
  const geometry = useDisposable(
    () => tube(smoothPath(points, 0.5), 0.62, { radial: 8 }),
    [points],
  );
  const end = points[points.length - 1]!;
  const start = points[0]!;
  const tip = useDisposable(() => {
    const g = tube(roundedPath([start, [start[0], start[1] - 1.2, start[2]]], 0.2), 0.32, {
      radial: 6,
    });
    return g;
  }, [start]);
  const cap = useDisposable(
    () => roundedBox(1.24, 0.3, 1.24, 0.6, 0.1).translate(end[0], end[1], end[2]),
    [end],
  );
  return (
    <group>
      <mesh geometry={geometry}>
        <Material preset="pvc" color={color} clip />
      </mesh>
      <mesh geometry={tip}>
        <Material preset="copper" />
      </mesh>
      <mesh geometry={cap}>
        <Material preset="pvc" color={color} />
      </mesh>
    </group>
  );
}
