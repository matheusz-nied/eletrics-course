/**
 * Test leads of the multimeter (and of the bench): shrouded 4 mm banana plug,
 * silicone cable and probe with finger guard and steel tip. Typical CAT III
 * leads: probe 140 mm, Ø 9,5 mm handle, Ø 15 mm guard, 2 mm tip; cable
 * Ø 3,8 mm, about 1 m long (here shortened by the path you give).
 *
 * `TestLead` is exported for the bench: give it the jack mouth, the probe tip
 * and the direction the tip points, and it routes the cable between them.
 */
import { CatmullRomCurve3, Quaternion, Vector3 } from 'three';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { axialLathe, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { Vec3 } from '../types';

export type LeadColor = 'vermelho' | 'preto';

export const LEAD_COLORS: Record<LeadColor, { body: string; cable: string }> = {
  vermelho: { body: '#c11d18', cable: '#b81c17' },
  preto: { body: '#1b1b1d', cable: '#202022' },
};

/** Probe length from the tip to the end of the strain relief (mm). */
export const PROBE_LENGTH = 140;
/** Plug length out of the jack (mm). */
export const PLUG_LENGTH = 54;
export const CABLE_RADIUS = 1.9;

const Y = new Vector3(0, 1, 0);

/** Rotation that turns +Y into `dir`. */
function alignY(dir: Vec3): [number, number, number, number] {
  const q = new Quaternion().setFromUnitVectors(Y, new Vector3(...dir).normalize());
  return [q.x, q.y, q.z, q.w];
}

function ripple(y0: number, y1: number, r: number, depth: number, period: number) {
  const out: [number, number][] = [];
  const steps = Math.max(2, Math.round(((y1 - y0) / period) * 6));
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    const s = Math.sin(((y - y0) / period) * Math.PI);
    out.push([r - depth * s * s, y]);
  }
  return out;
}

/** Probe along +Y: tip at y = 0, cable entry at y = PROBE_LENGTH. */
export function Probe({ color }: { color: LeadColor }) {
  const tipGeometry = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0],
          [0.3, 0.5],
          [1, 3.2],
          [1, 16],
          [0, 16],
        ],
        20,
      ),
    [],
  );
  const bodyGeometry = useDisposable(() => {
    const profile: [number, number][] = [
      [0.98, 14.6],
      [1.7, 15.2],
      [2.3, 18],
      [3.4, 24],
      [3.95, 26],
      [3.95, 29],
      [7.1, 29.5],
      [7.6, 30.6],
      [7.6, 32.4],
      [7.1, 33.4],
      [4.75, 34.2],
      [4.75, 52],
      ...ripple(52, 104, 4.85, 0.32, 2.6),
      [4.75, 112],
      [4.55, 114],
      ...ripple(114, 132, 4.2, 0.25, 2),
      [2.7, 136],
      [2.3, 140],
      [1.85, 140],
    ];
    return axialLathe(profile, 28);
  }, []);
  const c = LEAD_COLORS[color];
  const noise = getNoiseTexture();
  return (
    <group>
      <mesh geometry={tipGeometry}>
        <Material preset="steel" color="#c9ccd0" roughness={0.22} />
      </mesh>
      <mesh geometry={bodyGeometry}>
        <Material
          preset="absBlack"
          color={c.body}
          roughness={0.48}
          roughnessMap={noise}
          clearcoat={0.15}
        />
      </mesh>
    </group>
  );
}

/** Shrouded banana plug along +Y: y = 0 at the jack mouth, cable at y = PLUG_LENGTH. */
export function BananaPlug({ color }: { color: LeadColor }) {
  const geometry = useDisposable(() => {
    const profile: [number, number][] = [
      [0, -8],
      [2.6, -8],
      [3.0, -7.4],
      [3.0, 0],
      [4.9, 0.2],
      [5.4, 1.2],
      [5.4, 3.6],
      [4.95, 4.2],
      [4.95, 8],
      ...ripple(8, 26, 5.1, 0.35, 2.25),
      [4.95, 30],
      [4.6, 31.2],
      [4.2, 33],
      ...ripple(33, 46, 3.9, 0.22, 1.6).map(([r, y]): [number, number] => [
        r - ((y - 33) / 13) * 1.1,
        y,
      ]),
      [2.5, 50],
      [2.3, 54],
      [1.85, 54],
    ];
    return axialLathe(profile, 28);
  }, []);
  const c = LEAD_COLORS[color];
  return (
    <mesh geometry={geometry}>
      <Material preset="absBlack" color={c.body} roughness={0.45} clearcoat={0.15} />
    </mesh>
  );
}

export interface TestLeadProps {
  color: LeadColor;
  /** Jack mouth and the plug axis, pointing out of the jack. */
  plug: { position: Vec3; direction: Vec3 };
  /** Probe tip and the direction the tip points to. */
  probe: { tip: Vec3; direction: Vec3 };
  /** Points the cable passes through between plug and probe. */
  via?: Vec3[];
}

/** A complete test lead: plug in a jack, cable along `via`, probe at `tip`. */
export function TestLead({ color, plug, probe, via = [] }: TestLeadProps) {
  const plugDir = new Vector3(...plug.direction).normalize();
  const probeDir = new Vector3(...probe.direction).normalize();
  const plugEnd = new Vector3(...plug.position).addScaledVector(plugDir, PLUG_LENGTH - 0.5);
  const probeRear = new Vector3(...probe.tip).addScaledVector(probeDir, -(PROBE_LENGTH - 0.5));
  const key = [plug, probe, via];

  const cable = useDisposable(() => {
    const points = [
      plugEnd.clone(),
      plugEnd.clone().addScaledVector(plugDir, 7),
      ...via.map((v) => new Vector3(...v)),
      probeRear.clone().addScaledVector(probeDir, -9),
      probeRear.clone(),
    ];
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    return tube(curve, CABLE_RADIUS, {
      radial: 10,
      segments: Math.min(Math.ceil(curve.getLength() / 1.6), 400),
    });
  }, key);

  const c = LEAD_COLORS[color];
  return (
    <group>
      <group position={plug.position} quaternion={alignY(plug.direction)}>
        <BananaPlug color={color} />
      </group>
      <group position={probe.tip} quaternion={alignY([-probeDir.x, -probeDir.y, -probeDir.z])}>
        <Probe color={color} />
      </group>
      <mesh geometry={cable}>
        <Material preset="siliconeRubber" color={c.cable} roughness={0.5} clearcoat={0.2} />
      </mesh>
    </group>
  );
}
