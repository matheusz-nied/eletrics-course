/**
 * `<PrintedCircuitBoard layout={…}>`: a board generated from a layout
 * (`layout.ts`). The substrate is extruded with real drilled holes; copper,
 * solder mask, finish and silkscreen are painted into the maps of each face
 * (colour, roughness/metalness/clearcoat and bump), so a board with hundreds
 * of pads stays a handful of draw calls. Plated holes get a barrel, soldered
 * pads a fillet and a cut lead. In the exploded view the layers separate:
 * silkscreen, mask, copper, substrate, copper, mask.
 *
 * Keep the `layout` object stable (a module constant or useMemo): the maps
 * are rebuilt when it changes.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  LinearSRGBColorSpace,
  Object3D,
  Path,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
  type BufferGeometry,
  type Group,
  type InstancedMesh,
} from 'three';
import { useQuality } from '../core/quality';
import { Anchor, Explode, useView } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_MONO, FONT_SANS } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import type { Vec3 } from '../types';
import {
  composeSide,
  drawSideLayers,
  layerAlphaMaps,
  pixelsPerMm,
  sideHasDetail,
  type SideLayers,
} from './draw';
import {
  SUBSTRATE_COLORS,
  boardPoint,
  copperSides,
  isPlated,
  maskColorOf,
  padDims,
  resolveLayout,
  type BoardSide,
  type PcbLayout,
  type Point,
  type ResolvedLayout,
} from './layout';

export interface PrintedCircuitBoardProps {
  layout: PcbLayout;
  /** Texture pixels per millimetre (default: as sharp as the quality level allows). */
  resolution?: number;
  /** Components and anything else mounted on the board (part space, mm). */
  children?: ReactNode;
}

const SIDES: BoardSide[] = ['top', 'bottom'];

interface SideTextures {
  color: CanvasTexture;
  orm: CanvasTexture;
  bump: CanvasTexture;
  layers: SideLayers;
}

function texture(canvas: HTMLCanvasElement, color: boolean): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = color ? SRGBColorSpace : LinearSRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Bumps when the silkscreen fonts finish loading, so text is redrawn with them. */
function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    const fonts = [`600 16px ${FONT_SANS}`, `600 16px ${FONT_MONO}`];
    if (fonts.every((f) => document.fonts.check(f))) return;
    let alive = true;
    Promise.all(fonts.map((f) => document.fonts.load(f)))
      .then(() => alive && setVersion((v) => v + 1))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return version;
}

/** Substrate with every drilled hole; groups: 0 bottom face, 1 top face, 2 edges. */
function boardGeometry(l: ResolvedLayout): ExtrudeGeometry {
  const { width: W, height: H } = l;
  const r = Math.min(l.corner, W / 2, H / 2);
  const x0 = -W / 2;
  const x1 = W / 2;
  const y0 = -H / 2;
  const y1 = H / 2;
  const shape = new Shape();
  if (r > 0.01) {
    shape.moveTo(x0 + r, y0);
    shape.lineTo(x1 - r, y0);
    shape.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(x1, y1 - r);
    shape.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
    shape.lineTo(x0 + r, y1);
    shape.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(x0, y0 + r);
    shape.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  } else {
    shape.moveTo(x0, y0);
    shape.lineTo(x1, y0);
    shape.lineTo(x1, y1);
    shape.lineTo(x0, y1);
  }
  // Shape space: (x − W/2, H/2 − y); after rotateX(−90°) z = y − H/2.
  const drills: { at: Point; d: number }[] = [
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

  // Face UVs are shape coordinates: map them onto the board (0..1).
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < half * 2; i++) uv.setXY(i, uv.getX(i) / W + 0.5, uv.getY(i) / H + 0.5);
  uv.needsUpdate = true;
  return geometry;
}

/** Open cylinder with its normals inward: the plating seen inside a hole. */
function barrelGeometry(): CylinderGeometry {
  const geometry = new CylinderGeometry(1, 1, 1, 16, 1, true);
  const index = geometry.index!;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    index.setX(i, index.getX(i + 2));
    index.setX(i + 2, a);
  }
  const normal = geometry.attributes.normal!;
  for (let i = 0; i < normal.count; i++)
    normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
  return geometry;
}

/** Concave solder fillet, unit pad radius and height, lead radius 0,35. */
function filletGeometry(): BufferGeometry {
  const profile: [number, number][] = [[0, -0.02]];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    profile.push([0.35 + 0.65 * (1 - t) ** 2.4, t]);
  }
  return axialLathe(profile, 24);
}

interface Instance {
  position: Vec3;
  scale: Vec3;
  flip?: boolean;
}

function Instances({
  geometry,
  items,
  children,
}: {
  geometry: BufferGeometry;
  items: Instance[];
  children: ReactNode;
}) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    items.forEach((item, i) => {
      o.position.set(...item.position);
      o.rotation.set(item.flip ? Math.PI : 0, 0, 0);
      o.scale.set(...item.scale);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[geometry, undefined, items.length]}
      castShadow
      receiveShadow
    >
      {children}
    </instancedMesh>
  );
}

export function PrintedCircuitBoard({ layout, resolution, children }: PrintedCircuitBoardProps) {
  const l = useMemo(() => resolveLayout(layout), [layout]);
  const low = useQuality((s) => s.level === 'baixa');
  const k = resolution ?? pixelsPerMm(l, low ? 1024 : 2048, low ? 8 : 12);
  const fonts = useFontsVersion();
  const { explode } = useView();

  const geometry = useMemo(() => boardGeometry(l), [l]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const sides = useMemo(() => {
    void fonts;
    const out: Partial<Record<BoardSide, SideTextures>> = {};
    for (const side of SIDES) {
      if (!sideHasDetail(l, side)) continue;
      const layers = drawSideLayers(l, side, k);
      const maps = composeSide(l, side, layers);
      out[side] = {
        color: texture(maps.color, true),
        orm: texture(maps.orm, false),
        bump: texture(maps.bump, false),
        layers,
      };
    }
    return out;
  }, [l, k, fonts]);
  useEffect(
    () => () => {
      for (const s of Object.values(sides)) {
        s.color.dispose();
        s.orm.dispose();
        s.bump.dispose();
      }
    },
    [sides],
  );

  // Layer maps for the exploded view are drawn the first time it opens.
  const [wantLayers, setWantLayers] = useState(false);
  const layerMaps = useMemo(() => {
    if (!wantLayers) return null;
    const out: Partial<
      Record<BoardSide, Record<'copper' | 'mask' | 'silk', CanvasTexture | null>>
    > = {};
    for (const side of SIDES) {
      const s = sides[side];
      if (!s) continue;
      const maps = layerAlphaMaps(l, side, s.layers);
      out[side] = {
        copper: maps.copper && texture(maps.copper, false),
        mask: maps.mask && texture(maps.mask, false),
        silk: maps.silk && texture(maps.silk, false),
      };
    }
    return out;
  }, [wantLayers, l, sides]);
  useEffect(
    () => () => {
      for (const s of Object.values(layerMaps ?? {}))
        for (const t of Object.values(s)) t?.dispose();
    },
    [layerMaps],
  );

  const assembled = useRef<Group>(null);
  const exploded = useRef<Group>(null);
  useFrame(() => {
    const f = explode.current ?? 0;
    if (f > 0.001 && !wantLayers) setWantLayers(true);
    const showLayers = f > 0.02 && layerMaps !== null;
    if (assembled.current) assembled.current.visible = !showLayers;
    if (exploded.current) exploded.current.visible = showLayers;
  });

  const barrel = useMemo(() => barrelGeometry(), []);
  const fillet = useMemo(() => filletGeometry(), []);
  const stub = useMemo(() => new CylinderGeometry(1, 1, 1, 10), []);
  const plane = useMemo(() => new PlaneGeometry(l.width, l.height).rotateX(-Math.PI / 2), [l]);
  useEffect(() => () => [barrel, fillet, stub].forEach((g) => g.dispose()), [barrel, fillet, stub]);
  useEffect(() => () => plane.dispose(), [plane]);

  const T = l.thickness;
  const { barrels, fillets, stubs } = useMemo(() => {
    const barrels: Instance[] = [];
    const fillets: Instance[] = [];
    const stubs: Instance[] = [];
    const solderSide: BoardSide = l.componentSide === 'top' ? 'bottom' : 'top';
    const solderable = copperSides(l).includes(solderSide);
    for (const pad of l.pads) {
      if (pad.drill === undefined) continue;
      const [x, , z] = boardPoint(l, pad.at);
      const r = pad.drill / 2;
      if (isPlated(l)) barrels.push({ position: [x, T / 2, z], scale: [r, T, r] });
      if (!pad.solder || !solderable) continue;
      const padR = (Math.min(...padDims(pad)) / 2) * 0.94;
      const lead = (pad.lead ?? pad.drill * 0.6) / 2;
      const down = solderSide === 'bottom';
      fillets.push({
        position: [x, down ? 0 : T, z],
        scale: [padR, Math.min(0.9, padR * 1.1), padR],
        flip: down,
      });
      if (lead > 0) {
        const protrude = 1.4;
        stubs.push({
          position: [x, down ? (T - protrude) / 2 : T + protrude / 2 - T / 2, z],
          scale: [lead, T + protrude, lead],
        });
      }
    }
    return { barrels, fillets, stubs };
  }, [l, T]);

  const maskColor = maskColorOf(l);
  const substrate = SUBSTRATE_COLORS[l.substrate];
  const step = Math.min(16, Math.max(3, Math.min(l.width, l.height) * 0.24));
  // Layer labels step across the board so their pins do not stack.
  const anchorAt = (i: number): Vec3 => [-l.width * 0.42 + i * l.width * 0.13, 0, -l.height * 0.3];

  const face = (side: BoardSide, index: number) => {
    const s = sides[side];
    const attach = `material-${index}`;
    if (!s)
      return (
        <Material
          key={side}
          attach={attach}
          preset={l.substrate === 'fr4' ? 'fr4' : 'phenolic'}
          color={substrate}
          clip
        />
      );
    return (
      <Material
        key={side}
        attach={attach}
        clip
        color="#ffffff"
        map={s.color}
        roughness={1}
        roughnessMap={s.orm}
        metalness={1}
        metalnessMap={s.orm}
        clearcoat={0}
        clearcoatMap={s.orm}
        clearcoatRoughness={0.4}
        bumpMap={s.bump}
        bumpScale={0.6}
        cutColor={substrate}
      />
    );
  };

  const layer = (
    side: BoardSide,
    kind: 'copper' | 'mask' | 'silk',
    order: number,
    anchor: string,
  ) => {
    const map = layerMaps?.[side]?.[kind];
    if (!map) return null;
    const sign = side === 'top' ? 1 : -1;
    const y = side === 'top' ? T + 0.02 * order : -0.02 * order;
    return (
      <Explode
        key={`${side}-${kind}`}
        position={[0, y, 0]}
        offset={[0, sign * step * order, -sign * step * 0.5 * order]}
      >
        <mesh geometry={plane}>
          {kind === 'copper' ? (
            <Material preset="copper" alphaMap={map} alphaTest={0.5} side={DoubleSide} />
          ) : kind === 'mask' ? (
            <Material
              preset="solderMask"
              color={maskColor ?? '#0b4424'}
              alphaMap={map}
              alphaTest={0.5}
              transparent
              opacity={0.82}
              depthWrite={false}
              side={DoubleSide}
            />
          ) : (
            <Material
              preset="silkscreen"
              color={l.silkColor}
              alphaMap={map}
              alphaTest={0.5}
              side={DoubleSide}
            />
          )}
        </mesh>
        <Anchor name={anchor} position={anchorAt(order + (side === 'top' ? 0 : 3))} />
      </Explode>
    );
  };

  return (
    <group>
      <group ref={assembled}>
        <mesh geometry={geometry} castShadow receiveShadow>
          {face('bottom', 0)}
          {face('top', 1)}
          <Material
            attach="material-2"
            preset={l.substrate === 'fr4' ? 'fr4' : 'phenolic'}
            color={substrate}
            clip
            cutColor={substrate}
          />
        </mesh>
      </group>

      <group ref={exploded} visible={false}>
        <mesh geometry={geometry}>
          <Material preset={l.substrate === 'fr4' ? 'fr4' : 'phenolic'} color={substrate} clip />
        </mesh>
        <Anchor name="pcb-substrate" position={[anchorAt(0)[0], T, anchorAt(0)[2]]} />
        {layer('top', 'copper', 1, 'pcb-copper')}
        {layer('top', 'mask', 2, 'pcb-mask')}
        {layer('top', 'silk', 3, 'pcb-silk')}
        {layer('bottom', 'copper', 1, 'pcb-copper-bottom')}
        {layer('bottom', 'mask', 2, 'pcb-mask-bottom')}
        {layer('bottom', 'silk', 3, 'pcb-silk-bottom')}
      </group>

      <Instances geometry={barrel} items={barrels}>
        <Material preset={l.finish === 'enig' ? 'gold' : 'tin'} clip />
      </Instances>
      <Instances geometry={fillet} items={fillets}>
        <Material preset="solder" clip />
      </Instances>
      <Instances geometry={stub} items={stubs}>
        <Material preset="tin" clip />
      </Instances>
      {/* Mounted parts rise above the layers in the exploded view. */}
      <Explode offset={[0, step * 4, -step * 2]}>{children}</Explode>
    </group>
  );
}

export interface OnBoardProps {
  layout: PcbLayout;
  /** Layout point (mm, from the top-left corner). */
  at: Point;
  side?: BoardSide;
  /** Rotation in degrees, counter-clockwise as seen from the top. */
  rotation?: number;
  /** Height above the surface (mm). */
  lift?: number;
  children: ReactNode;
}

/** Places children on a board surface at a layout point. */
export function OnBoard({
  layout,
  at,
  side = 'top',
  rotation = 0,
  lift = 0,
  children,
}: OnBoardProps) {
  const [x, y, z] = boardPoint(layout, at, side);
  const angle = (rotation * Math.PI) / 180;
  return side === 'top' ? (
    <group position={[x, y + lift, z]} rotation={[0, angle, 0]}>
      {children}
    </group>
  ) : (
    <group position={[x, y - lift, z]} rotation={[Math.PI, -angle, 0]}>
      {children}
    </group>
  );
}
