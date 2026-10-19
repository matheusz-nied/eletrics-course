/**
 * The CD-1 board itself: `<PrintedCircuitBoard>` with an isolation slot
 * milled through the substrate. Board layouts have only round holes, so the
 * substrate the generator extrudes is swapped, after it mounts, for the same
 * extrusion with the slot cut out (same face groups and UVs, so the copper,
 * mask and silkscreen maps land in the same place).
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ExtrudeGeometry, Mesh, Path, Shape, type Group } from 'three';
import { PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import { resolveLayout, type PcbLayout, type Point } from '../pcb/layout';

export interface BoardSlot {
  /** Ends of the slot's centre line (layout mm). */
  from: Point;
  to: Point;
  width: number;
}

/** Same extrusion as the board generator, plus the slots. */
function slottedGeometry(layout: PcbLayout, slots: BoardSlot[]): ExtrudeGeometry {
  const l = resolveLayout(layout);
  const { width: W, height: H } = l;
  const r = Math.min(l.corner, W / 2, H / 2);
  const x0 = -W / 2;
  const x1 = W / 2;
  const y0 = -H / 2;
  const y1 = H / 2;
  const shape = new Shape();
  shape.moveTo(x0 + r, y0);
  shape.lineTo(x1 - r, y0);
  shape.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x1, y1 - r);
  shape.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x0 + r, y1);
  shape.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x0, y0 + r);
  shape.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  const drills = [
    ...l.pads.filter((p) => p.drill !== undefined).map((p) => ({ at: p.at, d: p.drill! })),
    ...l.holes.map((h) => ({ at: h.at, d: h.drill })),
  ];
  for (const { at, d } of drills) {
    const hole = new Path();
    hole.absarc(at[0] - W / 2, H / 2 - at[1], d / 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  for (const s of slots) {
    // Stadium around the centre line, in shape space (x − W/2, H/2 − y).
    const ax = s.from[0] - W / 2;
    const ay = H / 2 - s.from[1];
    const bx = s.to[0] - W / 2;
    const by = H / 2 - s.to[1];
    const angle = Math.atan2(by - ay, bx - ax);
    const hole = new Path();
    hole.absarc(bx, by, s.width / 2, angle - Math.PI / 2, angle + Math.PI / 2, false);
    hole.absarc(ax, ay, s.width / 2, angle + Math.PI / 2, angle + Math.PI * 1.5, false);
    hole.closePath();
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

export function SlottedBoard({ layout, slots }: { layout: PcbLayout; slots: BoardSlot[] }) {
  const ref = useRef<Group>(null);
  const geometry = useMemo(() => slottedGeometry(layout, slots), [layout, slots]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // The generator keeps its own geometry object; once swapped, React leaves it alone.
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
