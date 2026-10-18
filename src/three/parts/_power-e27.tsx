/**
 * E27 Edison screw cap (IEC 60061-1, sheet 7004-21): knuckle thread of
 * 7 turns per inch (pitch 3,629 mm), major diameter about 26,3 mm, black
 * glass insulator and the soldered centre contact. Shared by the lamp parts.
 * Y up, centre contact at y = 0, top rim at y = E27_HEIGHT.
 */
import { Material } from '../materials/Material';
import { useDisposable } from '../shapes/Wire';
import { fixLatheSeam, lathe, shellProfile } from './_power-shared';

export const E27_HEIGHT = 25.2;
/** Radius of the top rim of the shell, where the bulb neck or housing enters. */
export const E27_TOP_RADIUS = 13.2;
const PITCH = 3.629;
const THREAD_FROM = 6.8;
const THREAD_TO = 22.4;
const THREAD_DEPTH = 0.62;
const SEGMENTS = 72;

function smooth(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

export interface E27BaseProps {
  finish?: 'aluminum' | 'brass' | 'nickel';
  clip?: boolean;
}

export function E27Base({ finish = 'aluminum', clip = false }: E27BaseProps) {
  const shell = useDisposable(() => {
    const outer: [number, number][] = [
      [10.6, 5.2],
      [11.6, 5.5],
      [12.35, 6.1],
    ];
    const step = PITCH / 14;
    for (let y = THREAD_FROM - 0.4; y <= THREAD_TO + 0.4; y += step) outer.push([12.62, y]);
    outer.push([12.75, 23.2], [13.05, 23.9], [13.25, 24.5], [13.3, 24.9], [13.1, 25.2]);
    const geometry = lathe(shellProfile(outer, 0.28), SEGMENTS, { angle: 50 });
    // Knuckle thread: push the sheet in and out along a helix.
    const position = geometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-6 || y < THREAD_FROM - 0.5 || y > THREAD_TO + 0.5) continue;
      const phi = Math.atan2(x, z);
      const ramp =
        smooth((y - THREAD_FROM) / (PITCH * 0.5)) * smooth((THREAD_TO - y) / (PITCH * 0.5));
      const offset =
        THREAD_DEPTH * ramp * Math.cos(((y - THREAD_FROM) / PITCH) * Math.PI * 2 - phi);
      const k = (r + offset) / r;
      position.setX(i, x * k);
      position.setZ(i, z * k);
    }
    geometry.computeVertexNormals();
    fixLatheSeam(geometry, position.count / (SEGMENTS + 1), SEGMENTS);
    return geometry;
  }, []);

  const insulator = useDisposable(
    () =>
      lathe(
        [
          [0, 1.5],
          [4.6, 1.5],
          [5.4, 1.9],
          [8.6, 2.5],
          [10.4, 3.6],
          [11.2, 4.8],
          [11.7, 5.6],
          [11.9, 6.4],
          [0, 6.4],
        ],
        48,
        { angle: 40 },
      ),
    [],
  );

  const contact = useDisposable(
    () =>
      lathe(
        [
          [0, 0],
          [1.4, 0.06],
          [2.5, 0.35],
          [3.2, 0.85],
          [3.5, 1.3],
          [4.2, 1.45],
          [4.5, 1.7],
          [0, 1.7],
        ],
        40,
        { angle: 40 },
      ),
    [],
  );

  return (
    <group>
      <mesh geometry={shell}>
        <Material
          preset={finish === 'brass' ? 'brass' : finish === 'nickel' ? 'nickel' : 'aluminum'}
          roughness={finish === 'aluminum' ? 0.3 : 0.26}
          clip={clip}
        />
      </mesh>
      <mesh geometry={insulator}>
        <Material
          color="#0b0b0d"
          roughness={0.28}
          specularIntensity={0.6}
          clip={clip}
          cutColor="#1a1a1c"
        />
      </mesh>
      <mesh geometry={contact}>
        <Material preset="solder" roughness={0.22} clip={clip} />
      </mesh>
    </group>
  );
}
