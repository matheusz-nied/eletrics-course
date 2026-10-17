import type { CircuitDoc, Vec2 } from '../contract';
import { pointKey, wirePoints } from '../format/geometry';

/**
 * Current in every wire segment, from the pin currents, by Kirchhoff's current
 * law on a spanning tree of each node's wires. Ideal wires that form a loop
 * have no unique split: the tree carries the current and the closing segment
 * shows zero. Ground symbols absorb whatever reaches them.
 */
export interface WireSegment {
  wire: string;
  index: number;
  /** Tree edge from `child` to `parent` vertex, and whether that runs along the segment. */
  child: number;
  parent: number;
  forward: boolean;
}

export interface WireGraph {
  /** Per vertex: pins injecting current there ("R1.a" with its element index and pin index). */
  vertexPins: { element: number; pin: number }[][];
  /** Tree edges in post-order (children before parents). */
  order: WireSegment[];
  /** Segments outside the tree (loops) and zero-length segments: always 0. */
  idle: { wire: string; index: number }[];
  vertexCount: number;
}

export function buildWireGraph(
  doc: CircuitDoc,
  pinPoints: { element: number; pin: number; point: Vec2; ground: boolean }[],
): WireGraph {
  const vertexOf = new Map<string, number>();
  const vertex = (p: Vec2) => {
    const k = pointKey(p);
    let v = vertexOf.get(k);
    if (v === undefined) {
      v = vertexOf.size;
      vertexOf.set(k, v);
    }
    return v;
  };
  const edges: { wire: string; index: number; from: number; to: number }[] = [];
  const idle: WireGraph['idle'] = [];
  for (const el of doc.elements) {
    if (el.type !== 'wire') continue;
    const pts = wirePoints(el);
    for (let k = 1; k < pts.length; k++) {
      const from = vertex(pts[k - 1]);
      const to = vertex(pts[k]);
      if (from === to) idle.push({ wire: el.id, index: k - 1 });
      else edges.push({ wire: el.id, index: k - 1, from, to });
    }
  }
  const vertexPins: WireGraph['vertexPins'] = [];
  const groundVertices = new Set<number>();
  for (const { element, pin, point, ground } of pinPoints) {
    const v = vertexOf.get(pointKey(point));
    if (v === undefined) continue; // not on any wire: no wire current to compute
    (vertexPins[v] ??= []).push({ element, pin });
    if (ground) groundVertices.add(v);
  }
  const vertexCount = vertexOf.size;
  for (let v = 0; v < vertexCount; v++) vertexPins[v] ??= [];

  const adjacency: { edge: number; other: number }[][] = Array.from(
    { length: vertexCount },
    () => [],
  );
  edges.forEach((e, i) => {
    adjacency[e.from].push({ edge: i, other: e.to });
    adjacency[e.to].push({ edge: i, other: e.from });
  });

  // BFS from ground vertices first, so their residual current goes to ground.
  const visited = new Uint8Array(vertexCount);
  const usedEdge = new Uint8Array(edges.length);
  const order: WireSegment[] = [];
  const roots = [...groundVertices, ...Array.from({ length: vertexCount }, (_, v) => v)];
  for (const root of roots) {
    if (visited[root]) continue;
    visited[root] = 1;
    const queue = [root];
    const tree: WireSegment[] = [];
    for (let q = 0; q < queue.length; q++) {
      const u = queue[q];
      for (const { edge, other } of adjacency[u]) {
        if (visited[other] || usedEdge[edge]) continue;
        visited[other] = 1;
        usedEdge[edge] = 1;
        queue.push(other);
        const e = edges[edge];
        // Positive tree flow goes from `other` (child) to `u` (parent).
        tree.push({
          wire: e.wire,
          index: e.index,
          child: other,
          parent: u,
          forward: e.from === other,
        });
      }
    }
    order.push(...tree.reverse());
  }
  edges.forEach((e, i) => {
    if (!usedEdge[i]) idle.push({ wire: e.wire, index: e.index });
  });
  return { vertexPins, order, idle, vertexCount };
}

/**
 * Writes `<wire>.current.<k>` (and `<wire>.current` for segment 0) into `out`.
 * `pinCurrent(element, pin)` is the current entering the device at that pin.
 */
export function wireCurrents(
  graph: WireGraph,
  pinCurrent: (element: number, pin: number) => number,
  out: Record<string, number | boolean | string>,
  scratch: Float64Array,
): void {
  // Net current flowing from devices into each vertex.
  for (let v = 0; v < graph.vertexCount; v++) {
    let s = 0;
    for (const { element, pin } of graph.vertexPins[v]) s -= pinCurrent(element, pin);
    scratch[v] = s;
  }
  for (const seg of graph.order) {
    const flow = scratch[seg.child];
    scratch[seg.parent] += flow;
    const value = seg.forward ? flow : -flow;
    out[`${seg.wire}.current.${seg.index}`] = value;
    if (seg.index === 0) out[`${seg.wire}.current`] = value;
  }
  for (const { wire, index } of graph.idle) {
    out[`${wire}.current.${index}`] = 0;
    if (index === 0) out[`${wire}.current`] = 0;
  }
}
