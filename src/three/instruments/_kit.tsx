/**
 * Building blocks shared by the instruments: rounded slabs with holes
 * (housings, front panels), printed decals, knurled knobs, banana jacks,
 * binding posts, BNC sockets, rubber feet and a damped value for animated
 * knobs and jaws. All in millimetres; panel parts face +Z.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  Curve,
  ExtrudeGeometry,
  Path,
  Shape,
  ShapeGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type Texture,
} from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp } from '../core/motion';
import { Material, type MaterialProps } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { Vec3 } from '../types';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** Outline of a rounded rectangle centred on (cx, cy). */
function traceRoundedRect(path: Path, w: number, h: number, r: number, cx = 0, cy = 0): Path {
  const rr = Math.max(Math.min(r, w / 2, h / 2), 0.01);
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  path.moveTo(x0 + rr, y0);
  path.lineTo(x0 + w - rr, y0);
  path.absarc(x0 + w - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(x0 + w, y0 + h - rr);
  path.absarc(x0 + w - rr, y0 + h - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(x0 + rr, y0 + h);
  path.absarc(x0 + rr, y0 + h - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + rr);
  path.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  return path;
}

export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): Shape {
  return traceRoundedRect(new Shape(), w, h, r, cx, cy) as Shape;
}

/** A hole in a panel: rounded rectangle or circle (final size, in mm). */
export type HoleSpec =
  | { kind: 'rect'; w: number; h: number; r: number; x: number; y: number }
  | { kind: 'circle'; r: number; x: number; y: number };

function holePath(hole: HoleSpec, grow = 0): Path {
  if (hole.kind === 'circle') {
    const p = new Path();
    p.absarc(hole.x, hole.y, hole.r + grow, 0, Math.PI * 2, false);
    return p;
  }
  return traceRoundedRect(
    new Path(),
    hole.w + grow * 2,
    hole.h + grow * 2,
    hole.r + grow,
    hole.x,
    hole.y,
  );
}

/**
 * Smooth normals across shallow angles (bevels, rounded corners) and keep
 * sharp edges sharp: extrusions are flat-shaded otherwise.
 */
export function smooth<T extends BufferGeometry>(geometry: T, creaseAngle = Math.PI / 4.5): T {
  toCreasedNormals(geometry, creaseAngle);
  return geometry;
}

export interface SlabOptions {
  width: number;
  height: number;
  depth: number;
  radius: number;
  bevel?: number;
  holes?: HoleSpec[];
  curveSegments?: number;
  /** Custom outline instead of the rounded rectangle (final size). */
  shape?: (inset: number) => Shape;
}

/**
 * Rounded rectangular slab with bevelled edges, extruded along +Z from z = 0
 * to z = depth, with holes. Final outer size is exactly width × height.
 */
export function roundedSlab({
  width,
  height,
  depth,
  radius,
  bevel = 1,
  holes = [],
  curveSegments = 8,
  shape: custom,
}: SlabOptions): ExtrudeGeometry {
  // The bevel grows the outline and shrinks the holes: it must stay below
  // half of the thinnest wall, or the triangulation collapses.
  const walls = holes.map((hole) =>
    hole.kind === 'circle'
      ? Math.min(width / 2 - Math.abs(hole.x) - hole.r, height / 2 - Math.abs(hole.y) - hole.r)
      : Math.min(
          width / 2 - Math.abs(hole.x) - hole.w / 2,
          height / 2 - Math.abs(hole.y) - hole.h / 2,
        ),
  );
  const b = Math.max(
    Math.min(bevel, depth / 2 - 0.01, radius * 0.9, ...walls.map((t) => t / 2 - 0.05)),
    0,
  );
  const shape = custom
    ? custom(b)
    : roundedRectShape(width - 2 * b, height - 2 * b, Math.max(radius - b, 0.2));
  for (const hole of holes) shape.holes.push(holePath(hole, b));
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * b, 0.01),
    bevelEnabled: b > 0.001,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments,
  });
  geometry.translate(0, 0, b);
  return smooth(geometry);
}

/** Circular arc in a plane z = const, from angle a0 to a1 (radians, CCW from +X). */
export class ArcCurve3 extends Curve<Vector3> {
  constructor(
    readonly cx: number,
    readonly cy: number,
    readonly radius: number,
    readonly a0: number,
    readonly a1: number,
    readonly z = 0,
  ) {
    super();
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = this.a0 + (this.a1 - this.a0) * t;
    return target.set(
      this.cx + Math.cos(a) * this.radius,
      this.cy + Math.sin(a) * this.radius,
      this.z,
    );
  }
}

/**
 * A cross-section swept along an arc (clamp jaws, cores, coils). The
 * section's X runs along Z and its Y runs along the radius (inwards).
 */
export function arcSweep(
  section: Shape,
  arc: { cx: number; cy: number; radius: number; a0: number; a1: number; z?: number },
  steps = 40,
): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(section, {
    steps,
    bevelEnabled: false,
    curveSegments: 6,
    extrudePath: new ArcCurve3(arc.cx, arc.cy, arc.radius, arc.a0, arc.a1, arc.z ?? 0),
  });
  return smooth(geometry);
}

/** Flat decal of an outline with holes, UVs normalised to its bounding box. */
export function decalGeometry(w: number, h: number, r: number, holes: HoleSpec[] = []) {
  const shape = roundedRectShape(w, h, r);
  for (const hole of holes) shape.holes.push(holePath(hole));
  const geometry = new ShapeGeometry(shape, 10);
  normaliseUVs(geometry, -w / 2, -h / 2, w, h);
  return geometry;
}

/** Planar UVs from X/Y positions: (x - x0) / w, (y - y0) / h. */
export function normaliseUVs(
  geometry: BufferGeometry,
  x0: number,
  y0: number,
  w: number,
  h: number,
) {
  const pos = geometry.attributes.position!;
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - x0) / w, (pos.getY(i) - y0) / h);
  }
  uv.needsUpdate = true;
}

/** Star-like outline with `ribs` rounded grooves (knurled knobs, caps). */
export function ribbedCircleShape(radius: number, ribs: number, grooveDepth: number): Shape {
  const shape = new Shape();
  const steps = ribs * 10;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const groove = Math.pow(Math.max(0, Math.cos(a * ribs)), 6);
    const r = radius - grooveDepth * groove;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** Lathe around Y turned to point along +Z (y of the profile → +Z). */
export function latheZ(profile: [number, number][], segments = 32) {
  const geometry = axialLathe(profile, segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

/**
 * Damped approach of a value towards `target`, applied with `apply` every
 * frame; keeps the demand frame loop alive while it moves. Starts at the
 * target (no animation on mount).
 */
export function useSpring(target: number, apply: (value: number) => void, lambda = 9) {
  const current = useRef<number | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const applyRef = useRef(apply);
  useLayoutEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => invalidate(), [target, invalidate]);
  useFrame((_, dt) => {
    const from = current.current ?? target;
    let next = damp(from, target, lambda, Math.min(dt, 0.05));
    if (Math.abs(next - target) < 1e-4) next = target;
    current.current = next;
    applyRef.current(next);
    if (next !== target) invalidate();
  });
}

/** A group rotated about Z by `-angle` (clockwise seen from the front), animated. */
export function RotatingGroup({
  angle,
  position,
  children,
  lambda = 9,
}: {
  angle: number;
  position?: Vec3;
  children: ReactNode;
  lambda?: number;
}) {
  const ref = useRef<Group>(null);
  useSpring(
    angle,
    (value) => {
      if (ref.current) ref.current.rotation.z = -value;
    },
    lambda,
  );
  return (
    <group position={position}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Panel parts
// ---------------------------------------------------------------------------

/** Rotary selector knob: knurled disc and grip bar with the pointer at +Y. */
export function BarKnob({ radius, clip = true }: { radius: number; clip?: boolean }) {
  const disc = useDisposable(() => {
    const g = new ExtrudeGeometry(ribbedCircleShape(radius - 0.4, Math.round(radius * 2.4), 0.45), {
      depth: 3.2,
      bevelEnabled: true,
      bevelThickness: 0.45,
      bevelSize: 0.35,
      bevelSegments: 2,
      curveSegments: 4,
    });
    g.translate(0, 0, 0.45);
    return smooth(g);
  }, [radius]);
  const barH = radius * 0.45;
  const bar = useDisposable(() => {
    const w = radius * 0.53;
    const g = roundedSlab({
      width: w,
      height: radius * 1.85,
      depth: barH,
      radius: w / 2,
      bevel: radius * 0.115,
    });
    g.translate(0, 0, 3.6);
    return g;
  }, [radius]);
  const arrow = useDisposable(() => {
    const s = new Shape();
    s.moveTo(0, radius - 0.8);
    s.lineTo(1.6, radius - 3.6);
    s.lineTo(-1.6, radius - 3.6);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
    g.translate(0, 0, 4.12);
    return g;
  }, [radius]);
  const noise = getNoiseTexture();
  return (
    <group>
      <mesh geometry={disc}>
        <Material
          preset="absBlack"
          color="#26282c"
          roughness={0.5}
          roughnessMap={noise}
          clip={clip}
          cutColor="#151618"
        />
      </mesh>
      <mesh geometry={bar}>
        <Material
          preset="absBlack"
          color="#2b2d31"
          roughness={0.42}
          roughnessMap={noise}
          clip={clip}
          cutColor="#151618"
        />
      </mesh>
      <mesh geometry={arrow}>
        <Material preset="silkscreen" color="#f4f4ef" clip={clip} />
      </mesh>
      <mesh position={[0, radius * 0.58, 3.6 + barH + 0.02]}>
        <boxGeometry args={[radius * 0.09, radius * 0.55, 0.1]} />
        <Material preset="silkscreen" color="#f4f4ef" clip={clip} />
      </mesh>
    </group>
  );
}

/** Printed decal: a flat mesh with a canvas texture, drawn over a surface. */
export function Decal({
  geometry,
  map,
  position,
  rotation,
  clip = false,
  material,
}: {
  geometry: BufferGeometry;
  map: Texture;
  position?: Vec3;
  rotation?: Vec3;
  clip?: boolean;
  material?: MaterialProps;
}) {
  return (
    <mesh geometry={geometry} position={position} rotation={rotation}>
      <Material
        color="#ffffff"
        roughness={0.55}
        {...material}
        map={map}
        clip={clip}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

export interface KnobProps {
  radius: number;
  height: number;
  ribs?: number;
  color?: string;
  /** Colour of the top insert. */
  capColor?: string;
  capMetal?: boolean;
  pointerColor?: string;
  /** Clockwise angle from 12 o'clock (radians), animated. */
  angle?: number;
  /** Optional skirt (dial ring) at the base. */
  skirtRadius?: number;
  skirtColor?: string;
  position?: Vec3;
  clip?: boolean;
}

/** Knurled front-panel knob with a pointer line, facing +Z. */
export function Knob({
  radius,
  height,
  ribs = 24,
  color = '#1d1f22',
  capColor,
  capMetal = false,
  pointerColor = '#f2f2ee',
  angle = 0,
  skirtRadius,
  skirtColor = '#2a2c30',
  position,
  clip = false,
}: KnobProps) {
  const body = useDisposable(() => {
    const shape = ribbedCircleShape(radius - 0.25, ribs, radius * 0.06);
    const g = new ExtrudeGeometry(shape, {
      depth: height - 0.8,
      bevelEnabled: true,
      bevelThickness: 0.4,
      bevelSize: 0.25,
      bevelSegments: 2,
      curveSegments: 4,
    });
    g.translate(0, 0, 0.4);
    return smooth(g);
  }, [radius, height, ribs]);
  const cap = useDisposable(
    () =>
      latheZ(
        [
          [0, 0],
          [radius * 0.78, 0],
          [radius * 0.8, 0.25],
          [radius * 0.6, 0.45],
          [0, 0.35],
        ],
        40,
      ),
    [radius],
  );
  const skirt = useDisposable(
    () =>
      skirtRadius
        ? latheZ(
            [
              [0, 0],
              [skirtRadius, 0],
              [skirtRadius, 0.9],
              [skirtRadius - 0.6, 1.5],
              [0, 1.5],
            ],
            48,
          )
        : latheZ(
            [
              [0, 0],
              [0.01, 0],
            ],
            3,
          ),
    [skirtRadius],
  );
  const noise = getNoiseTexture();
  return (
    <RotatingGroup angle={angle} position={position}>
      {skirtRadius ? (
        <>
          <mesh geometry={skirt}>
            <Material preset="absDark" color={skirtColor} roughness={0.45} clip={clip} />
          </mesh>
          <mesh position={[0, skirtRadius - 1.6, 1.55]}>
            <boxGeometry args={[0.8, 2.6, 0.1]} />
            <Material preset="silkscreen" color={pointerColor} />
          </mesh>
        </>
      ) : null}
      <group position={[0, 0, skirtRadius ? 1.4 : 0]}>
        <mesh geometry={body}>
          <Material
            preset="absBlack"
            color={color}
            roughness={0.5}
            roughnessMap={noise}
            clip={clip}
          />
        </mesh>
        <mesh geometry={cap} position={[0, 0, height - 0.05]}>
          <Material
            preset={capMetal ? 'brushedAluminum' : 'absBlack'}
            color={capColor ?? (capMetal ? '#c9ccd0' : color)}
            roughness={capMetal ? 0.32 : 0.35}
            clip={clip}
          />
        </mesh>
        <mesh position={[0, radius * 0.45, height + 0.32]}>
          <boxGeometry args={[radius * 0.13, radius * 0.62, 0.12]} />
          <Material preset="silkscreen" color={pointerColor} roughness={0.5} />
        </mesh>
      </group>
    </RotatingGroup>
  );
}

export type JackColor = 'vermelho' | 'preto' | 'verde' | 'amarelo';

export const JACK_COLORS: Record<JackColor, string> = {
  vermelho: '#c31f1a',
  preto: '#1c1c1e',
  verde: '#1d7a3a',
  amarelo: '#e5b31b',
};

/**
 * Shrouded 4 mm banana jack seen from the panel: coloured rim 1,2 mm proud of
 * the face, bore and nickel contact inside. y = 0 is the panel face.
 */
export function BananaJack({
  color = 'vermelho',
  position,
  rimRadius = 6,
  depth = 14,
  clip = false,
}: {
  color?: JackColor;
  position?: Vec3;
  rimRadius?: number;
  depth?: number;
  clip?: boolean;
}) {
  const shroud = useDisposable(
    () =>
      latheZ(
        [
          [2.65, -4],
          [3.25, -4],
          [3.25, 0.5],
          [3.75, 1.2],
          [rimRadius - 0.45, 1.2],
          [rimRadius, 0.75],
          [rimRadius, -2],
          [rimRadius - 0.9, -2.3],
          [rimRadius - 0.9, -depth],
          [2.65, -depth],
        ],
        40,
      ),
    [rimRadius, depth],
  );
  const contact = useDisposable(
    () =>
      latheZ(
        [
          [2.05, -depth + 1],
          [2.05, -4.1],
          [2.65, -4.1],
          [2.65, -depth + 1],
        ],
        24,
      ),
    [depth],
  );
  return (
    <group position={position}>
      <mesh geometry={shroud}>
        <Material
          preset="absBlack"
          color={JACK_COLORS[color]}
          roughness={0.38}
          clearcoat={0.3}
          clip={clip}
        />
      </mesh>
      <mesh geometry={contact}>
        <Material preset="nickel" roughness={0.28} />
      </mesh>
      {/* Dark bottom of the bore. */}
      <mesh position={[0, 0, -depth + 1.1]}>
        <circleGeometry args={[2.1, 20]} />
        <Material preset="absBlack" color="#050505" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Five-way binding post (bench supplies): coloured knurled cap on a metal stud. */
export function BindingPost({
  color = 'vermelho',
  position,
  clip = false,
}: {
  color?: JackColor;
  position?: Vec3;
  clip?: boolean;
}) {
  const base = useDisposable(
    () =>
      latheZ(
        [
          [2.6, 0],
          [7.6, 0],
          [7.6, 2.2],
          [7.1, 3],
          [2.6, 3],
        ],
        40,
      ),
    [],
  );
  const cap = useDisposable(() => {
    const g = new ExtrudeGeometry(ribbedCircleShape(6.2, 18, 0.45), {
      depth: 11,
      bevelEnabled: true,
      bevelThickness: 0.8,
      bevelSize: 0.6,
      bevelSegments: 3,
      curveSegments: 4,
    });
    g.translate(0, 0, 6.8);
    return smooth(g);
  }, []);
  const tip = useDisposable(
    () =>
      latheZ(
        [
          [2.05, 16.5],
          [2.05, 19.2],
          [3.4, 19.2],
          [3.6, 18.9],
          [3.6, 18],
          [2.05, 16.5],
        ],
        28,
      ),
    [],
  );
  return (
    <group position={position}>
      <mesh geometry={base}>
        <Material preset="absBlack" color={JACK_COLORS[color]} roughness={0.4} clip={clip} />
      </mesh>
      <mesh position={[0, 0, 5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 4, 20]} />
        <Material preset="brass" roughness={0.3} clip={clip} />
      </mesh>
      <mesh geometry={cap}>
        <Material
          preset="absBlack"
          color={JACK_COLORS[color]}
          roughness={0.36}
          clearcoat={0.4}
          clip={clip}
        />
      </mesh>
      <mesh geometry={tip}>
        <Material preset="nickel" roughness={0.22} clip={clip} />
      </mesh>
      <mesh position={[0, 0, 19.05]}>
        <circleGeometry args={[2.05, 20]} />
        <Material preset="absBlack" color="#070707" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Female BNC panel socket (nickel), facing +Z. */
export function Bnc({ position, clip = false }: { position?: Vec3; clip?: boolean }) {
  const sleeve = useDisposable(
    () =>
      latheZ(
        [
          [4.1, 3.2],
          [4.85, 3.2],
          [4.85, 12.4],
          [4.6, 12.9],
          [4.1, 12.9],
          [4.1, 3.2],
        ],
        36,
      ),
    [],
  );
  const insulator = useDisposable(
    () =>
      latheZ(
        [
          [0, 11.4],
          [0.85, 11.4],
          [0.85, 11.9],
          [3.3, 11.9],
          [3.5, 11.6],
          [3.5, 3.4],
          [0, 3.4],
        ],
        28,
      ),
    [],
  );
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.1]}>
        <cylinderGeometry args={[7.2, 7.2, 2.2, 6]} />
        <Material preset="nickel" roughness={0.3} clip={clip} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 2.6]}>
        <cylinderGeometry args={[5.6, 5.6, 1.2, 28]} />
        <Material preset="nickel" roughness={0.25} clip={clip} />
      </mesh>
      <mesh geometry={sleeve}>
        <Material preset="chrome" color="#dfe2e5" roughness={0.16} clip={clip} />
      </mesh>
      {/* Bayonet studs. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 5.3, 0, 9.8]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.8, 0.8, 1.4, 12]} />
          <Material preset="chrome" roughness={0.2} />
        </mesh>
      ))}
      <mesh geometry={insulator}>
        <Material preset="nylonNatural" color="#f1efe8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 11.42]}>
        <circleGeometry args={[0.55, 16]} />
        <Material preset="absBlack" color="#0b0a08" />
      </mesh>
      <mesh position={[0, 0, 11.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.5, 16, 1, true]} />
        <Material preset="gold" />
      </mesh>
    </group>
  );
}

/** Round rubber foot (r mm, h mm tall) standing on y = 0. */
export function RubberFoot({
  position,
  r = 6,
  h = 5,
}: {
  position?: Vec3;
  r?: number;
  h?: number;
}) {
  const geometry = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0],
          [r * 0.88, 0],
          [r, h * 0.25],
          [r, h * 0.8],
          [r * 0.85, h],
          [0, h],
        ],
        28,
      ),
    [r, h],
  );
  return (
    <mesh geometry={geometry} position={position}>
      <Material preset="rubber" roughness={0.85} />
    </mesh>
  );
}

/** Small round indicator LED behind the panel (lit with `glow`). */
export function PanelLed({
  position,
  color,
  lit,
}: {
  position?: Vec3;
  color: string;
  lit: boolean;
}) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.6]}>
        <cylinderGeometry args={[1.9, 1.9, 1.2, 20]} />
        <Material
          preset="absBlack"
          color={lit ? color : '#3a3532'}
          roughness={0.2}
          clearcoat={1}
          emissive={lit ? color : '#000000'}
          emissiveIntensity={lit ? 3.2 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 1.2]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[1.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Material
          preset="absBlack"
          color={lit ? color : '#4a4440'}
          roughness={0.15}
          clearcoat={1}
          emissive={lit ? color : '#000000'}
          emissiveIntensity={lit ? 4 : 0}
        />
      </mesh>
    </group>
  );
}
