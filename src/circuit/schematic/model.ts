/**
 * Everything the schematic needs to draw a circuit, computed once per circuit:
 * screen geometry of elements and wires, nodes, junction dots, and the wire
 * graph used to turn element currents into wire currents (KCL).
 */
import type { ControlDoc, DeviceInfo, ElementDoc, Netlist, Vec2 } from '../../engine/contract';
import { deviceInfo } from '../engine';
import { GRID, elementParams, pinPositions, pointKey, transformOffset } from '../geometry';
import { getSymbol, type SymbolDef } from '../symbols';

export type Px = [number, number];

export interface PinView {
  name: string;
  /** Pin position on screen (px). */
  pos: Px;
  /** Node index, -1 when unknown. */
  node: number;
  /** Where the symbol drawing ends for this pin (px); a lead joins pos → anchor. */
  anchor: Px;
}

export interface ElementView {
  el: ElementDoc;
  info?: DeviceInfo;
  symbol: SymbolDef;
  two: boolean;
  /** SVG transform of the symbol group. */
  transform: string;
  /** Rotation (deg) and mirror seen on screen, for upright text. */
  rot: number;
  flip: boolean;
  pins: PinView[];
  /** Engine pins of this instance (grid, rotation 0) for symbols drawn from them. */
  instancePins: Record<string, Vec2>;
  /** Lead segments (px path) and the node that colours them. */
  leads: { d: string; node: number; pin: string; from: Px; to: Px }[];
  /** Screen bounding box [x, y, w, h] (px). */
  bbox: [number, number, number, number];
  label?: {
    x: number;
    y: number;
    anchor: 'start' | 'middle' | 'end';
    valueX: number;
    valueY: number;
    inline: boolean;
    /** Estimated text width (px), to keep the label inside the view box. */
    width: number;
  };
  controls: ControlDoc[];
  /** Two-terminal geometry (px). */
  a?: Px;
  b?: Px;
}

export interface WireView {
  id: string;
  node: number;
  points: Px[];
}

/** A path along which current dots move. */
export type FlowPath =
  | { kind: 'segment'; index: number; from: Px; to: Px; length: number }
  | { kind: 'element'; id: string; from: Px; to: Px; length: number }
  | { kind: 'lead'; id: string; pin: string; from: Px; to: Px; length: number };

/** Spanning tree of one node's wire graph, for KCL. */
export interface NodeTree {
  /** Pins attached to each vertex: "R1.a". */
  attachments: { vertex: number; pin: string; element: string; pinName: string }[];
  vertexCount: number;
  /** BFS order (root first): vertex, parent vertex, segment index, sign. */
  order: { vertex: number; parent: number; segment: number; sign: 1 | -1 }[];
}

export interface SchematicModel {
  viewBox: [number, number, number, number];
  nodes: string[];
  nodeIndex: Map<string, number>;
  elements: ElementView[];
  wires: WireView[];
  /** Wire segments (grid → px), indexed by FlowPath.index. */
  segments: { from: Px; to: Px; node: number }[];
  junctions: Px[];
  /** Pins connected to nothing (shown as hollow dots). */
  openPins: Px[];
  trees: NodeTree[];
  flows: FlowPath[];
}

const px = ([x, y]: Vec2): Px => [x * GRID, y * GRID];

function controlsOf(el: ElementDoc): ControlDoc[] {
  if (!el.control) return [];
  return Array.isArray(el.control) ? el.control : [el.control];
}

function transformLocal(local: Px, at: Px, rot: number, flip: boolean): Px {
  const [x, y] = transformOffset(local as Vec2, rot, flip);
  return [at[0] + x, at[1] + y];
}

export function buildSchematicModel(
  elements: ElementDoc[],
  netlist: Netlist,
  view?: { width: number; height: number },
): SchematicModel {
  const nodes = netlist.nodes.map((n) => n.id);
  const nodeIndex = new Map(nodes.map((id, i) => [id, i]));
  const pointNode = new Map<string, number>();
  for (const n of netlist.nodes)
    for (const p of n.points) pointNode.set(pointKey(p), nodeIndex.get(n.id)!);
  const nodeOfPin = (ref: string) => {
    const id = netlist.pins[ref];
    return id === undefined ? -1 : (nodeIndex.get(id) ?? -1);
  };

  const wires: WireView[] = [];
  const segments: SchematicModel['segments'] = [];
  const degree = new Map<string, number>();
  const bump = (p: Vec2, n = 1) => degree.set(pointKey(p), (degree.get(pointKey(p)) ?? 0) + n);
  const segGrid: { from: Vec2; to: Vec2; node: number }[] = [];

  for (const el of elements) {
    if (el.type !== 'wire') continue;
    const pts = el.points ?? (el.a && el.b ? [el.a, el.b] : []);
    if (pts.length < 2) continue;
    const node = pointNode.get(pointKey(pts[0]!)) ?? -1;
    wires.push({ id: el.id, node, points: pts.map(px) });
    for (let i = 1; i < pts.length; i++) {
      const from = pts[i - 1]!;
      const to = pts[i]!;
      if (from[0] === to[0] && from[1] === to[1]) continue;
      segGrid.push({ from, to, node });
      segments.push({ from: px(from), to: px(to), node });
      bump(from);
      bump(to);
    }
  }

  const views: ElementView[] = [];
  const pinGrid: { ref: string; element: string; pin: string; p: Vec2; node: number }[] = [];

  for (const el of elements) {
    if (el.type === 'wire') continue;
    const info = deviceInfo(el.type, elementParams(el, undefined));
    const symbol = getSymbol(el.type);
    const gridPins = pinPositions(el, info);
    const controls = controlsOf(el);
    const instancePins: Record<string, Vec2> = {};
    for (const p of info?.pins ?? []) instancePins[p.name] = p.offset;

    for (const [name, p] of Object.entries(gridPins)) {
      pinGrid.push({
        ref: `${el.id}.${name}`,
        element: el.id,
        pin: name,
        p,
        node: nodeOfPin(`${el.id}.${name}`),
      });
      bump(p);
    }

    if (el.a && el.b) {
      const a = px(el.a);
      const b = px(el.b);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const body = Math.min(symbol.body ?? 30, Math.max(length - 4, 4));
      const half = symbol.half ?? 10;
      const mid: Px = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const s: Px = [mid[0] - (ux * body) / 2, mid[1] - (uy * body) / 2];
      const e: Px = [mid[0] + (ux * body) / 2, mid[1] + (uy * body) / 2];
      const corners = [
        [-body / 2, -half],
        [body / 2, -half],
        [body / 2, half],
        [-body / 2, half],
      ].map(([x, y]) => [mid[0] + x! * ux - y! * uy, mid[1] + x! * uy + y! * ux] as Px);
      const xs = [...corners.map((c) => c[0]), a[0], b[0]];
      const ys = [...corners.map((c) => c[1]), a[1], b[1]];
      const bbox: ElementView['bbox'] = [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      ];
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const nodeA = nodeOfPin(`${el.id}.a`);
      const nodeB = nodeOfPin(`${el.id}.b`);
      views.push({
        el,
        info,
        symbol,
        two: true,
        transform: `translate(${mid[0]} ${mid[1]}) rotate(${angle})`,
        rot: angle,
        flip: false,
        pins: [
          { name: 'a', pos: a, node: nodeA, anchor: s },
          { name: 'b', pos: b, node: nodeB, anchor: e },
        ],
        instancePins,
        leads: [
          { d: `M${a[0]} ${a[1]}L${s[0]} ${s[1]}`, node: nodeA, pin: 'a', from: a, to: s },
          { d: `M${e[0]} ${e[1]}L${b[0]} ${b[1]}`, node: nodeB, pin: 'b', from: e, to: b },
        ],
        bbox,
        label: horizontal
          ? {
              x: mid[0],
              y: mid[1] - half - 7,
              anchor: 'middle',
              valueX: mid[0],
              valueY: mid[1] + half + 9,
              inline: false,
              width: labelWidth(el, symbol, info, false),
            }
          : {
              x: mid[0] + half + 6,
              y: mid[1] - 7,
              anchor: 'start',
              valueX: mid[0] + half + 6,
              valueY: mid[1] + 7,
              inline: false,
              width: labelWidth(el, symbol, info, false),
            },
        controls,
        a,
        b,
      });
      continue;
    }

    const at = px(el.at ?? [0, 0]);
    const rot = el.rot ?? 0;
    const flip = !!el.flip;
    const pins: PinView[] = [];
    const leads: ElementView['leads'] = [];
    for (const [name, g] of Object.entries(gridPins)) {
      const pos = px(g);
      const natural = symbol.pins?.[name];
      const anchor = natural ? transformLocal(px(natural), at, rot, flip) : pos;
      const node = nodeOfPin(`${el.id}.${name}`);
      pins.push({ name, pos, node, anchor });
      if (anchor[0] !== pos[0] || anchor[1] !== pos[1]) {
        leads.push({
          d: `M${pos[0]} ${pos[1]}L${anchor[0]} ${anchor[1]}`,
          node,
          pin: name,
          from: pos,
          to: anchor,
        });
      }
    }
    const [bx, by, bw, bh] = symbol.box ?? localBoxFromPins(instancePins);
    const corners = [
      [bx, by],
      [bx + bw, by],
      [bx + bw, by + bh],
      [bx, by + bh],
    ].map((c) => transformLocal(c as Px, at, rot, flip));
    const xs = [...corners.map((c) => c[0]), ...pins.map((p) => p.pos[0])];
    const ys = [...corners.map((c) => c[1]), ...pins.map((p) => p.pos[1])];
    const bbox: ElementView['bbox'] = [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ];
    views.push({
      el,
      info,
      symbol,
      two: false,
      transform: `translate(${at[0]} ${at[1]}) rotate(${rot}) scale(${flip ? -1 : 1} 1)`,
      rot,
      flip,
      pins,
      instancePins,
      leads,
      bbox,
      label: symbol.noLabel
        ? undefined
        : {
            x: bbox[0] + bbox[2] / 2,
            y: bbox[1] - 7,
            anchor: 'middle',
            valueX: bbox[0] + bbox[2] / 2,
            valueY: bbox[1] - 7,
            inline: true,
            width: labelWidth(el, symbol, info, true),
          },
      controls,
    });
  }

  placeSideLabels(views);

  // Junction dots where three or more connections meet; hollow dots on loose pins.
  const junctions: Px[] = [];
  for (const [key, d] of degree) {
    if (d >= 3) {
      const [x, y] = key.split(',').map(Number) as Vec2;
      junctions.push(px([x, y]));
    }
  }
  const openPins: Px[] = pinGrid
    .filter((p) => (degree.get(pointKey(p.p)) ?? 0) < 2)
    .map((p) => px(p.p));

  const trees = buildTrees(nodes.length, segGrid, pinGrid);

  const flows: FlowPath[] = [];
  segments.forEach((s, index) => {
    const length = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);
    flows.push({ kind: 'segment', index, from: s.from, to: s.to, length });
  });
  for (const v of views) {
    if (v.two && v.a && v.b) {
      flows.push({
        kind: 'element',
        id: v.el.id,
        from: v.a,
        to: v.b,
        length: Math.hypot(v.b[0] - v.a[0], v.b[1] - v.a[1]),
      });
    } else {
      for (const l of v.leads) {
        flows.push({
          kind: 'lead',
          id: v.el.id,
          pin: l.pin,
          from: l.from,
          to: l.to,
          length: Math.hypot(l.to[0] - l.from[0], l.to[1] - l.from[1]),
        });
      }
    }
  }

  return {
    viewBox: computeViewBox(views, wires, view),
    nodes,
    nodeIndex,
    elements: views,
    wires,
    segments,
    junctions,
    openPins,
    trees,
    flows,
  };
}

function localBoxFromPins(pins: Record<string, Vec2>): [number, number, number, number] {
  const pts = Object.values(pins);
  if (pts.length === 0) return [-30, -20, 60, 40];
  const xs = pts.map((p) => p[0] * GRID);
  const ys = pts.map((p) => p[1] * GRID);
  return [
    Math.min(...xs),
    Math.min(...ys) - 10,
    Math.max(...xs) - Math.min(...xs) || 40,
    Math.max(...ys) - Math.min(...ys) + 20,
  ];
}

function buildTrees(
  nodeCount: number,
  segs: { from: Vec2; to: Vec2; node: number }[],
  pins: { ref: string; element: string; pin: string; p: Vec2; node: number }[],
): NodeTree[] {
  const trees: NodeTree[] = [];
  for (let n = 0; n < nodeCount; n++) {
    const vIndex = new Map<string, number>();
    const vertex = (p: Vec2) => {
      const k = pointKey(p);
      let i = vIndex.get(k);
      if (i === undefined) {
        i = vIndex.size;
        vIndex.set(k, i);
      }
      return i;
    };
    const attachments: NodeTree['attachments'] = [];
    for (const p of pins) {
      if (p.node === n)
        attachments.push({ vertex: vertex(p.p), pin: p.ref, element: p.element, pinName: p.pin });
    }
    const adj: { to: number; segment: number; sign: 1 | -1 }[][] = [];
    segs.forEach((s, index) => {
      if (s.node !== n) return;
      const u = vertex(s.from);
      const v = vertex(s.to);
      (adj[u] ??= []).push({ to: v, segment: index, sign: 1 });
      (adj[v] ??= []).push({ to: u, segment: index, sign: -1 });
    });
    const count = vIndex.size;
    const order: NodeTree['order'] = [];
    const seen = new Uint8Array(count);
    const roots = attachments.length
      ? [attachments[0]!.vertex, ...Array.from({ length: count }, (_, i) => i)]
      : Array.from({ length: count }, (_, i) => i);
    for (const root of roots) {
      if (seen[root]) continue;
      seen[root] = 1;
      order.push({ vertex: root, parent: -1, segment: -1, sign: 1 });
      const queue = [root];
      while (queue.length) {
        const u = queue.shift()!;
        for (const e of adj[u] ?? []) {
          if (seen[e.to]) continue;
          seen[e.to] = 1;
          // current from child (e.to) to parent (u) runs against the segment if sign = 1
          order.push({ vertex: e.to, parent: u, segment: e.segment, sign: e.sign === 1 ? -1 : 1 });
          queue.push(e.to);
        }
      }
    }
    trees.push({ attachments, vertexCount: count, order });
  }
  return trees;
}

/** Average glyph width of the 11 px label font, in px. */
const LABEL_CHAR = 6.4;

function labelWidth(
  el: ElementDoc,
  symbol: SymbolDef,
  info: DeviceInfo | undefined,
  inline: boolean,
): number {
  const name = (el.label ?? el.id).length;
  const value = (symbol.value?.(elementParams(el, info)) ?? '').length;
  return (inline ? name + (value ? value + 1 : 0) : Math.max(name, value)) * LABEL_CHAR;
}

/**
 * Vertical two-terminal parts on the left half of the circuit get their label
 * on the left, so it does not run into the parts on their right.
 */
function placeSideLabels(views: ElementView[]): void {
  const xs = views.flatMap((v) => v.pins.map((p) => p.pos[0]));
  if (xs.length === 0) return;
  const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const v of views) {
    const l = v.label;
    if (!v.two || !v.a || !v.b || !l || l.anchor !== 'start') continue;
    const x = v.a[0];
    if (x >= centre) continue;
    const gap = l.x - x;
    v.label = { ...l, anchor: 'end', x: x - gap, valueX: x - gap };
  }
}

function computeViewBox(
  views: ElementView[],
  wires: WireView[],
  view?: { width: number; height: number },
): [number, number, number, number] {
  if (view) return [0, 0, view.width * GRID, view.height * GRID];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const v of views) {
    xs.push(v.bbox[0], v.bbox[0] + v.bbox[2]);
    ys.push(v.bbox[1] - 18, v.bbox[1] + v.bbox[3] + 14);
    const l = v.label;
    if (l) {
      const left = l.anchor === 'start' ? 0 : l.anchor === 'end' ? l.width : l.width / 2;
      xs.push(l.x - left, l.x - left + l.width);
    }
  }
  for (const w of wires)
    for (const p of w.points) {
      xs.push(p[0]);
      ys.push(p[1]);
    }
  if (xs.length === 0) return [0, 0, 200, 100];
  const pad = 24;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return [minX, minY, Math.max(...xs) - minX + pad, Math.max(...ys) - minY + pad];
}

/**
 * Current along each wire segment (in the segment's from→to direction), from the
 * current entering each pin. `pinCurrent` returns NaN when it is unknown.
 */
export function wireCurrents(
  model: SchematicModel,
  pinCurrent: (element: string, pin: string) => number,
  out: Float64Array,
): void {
  out.fill(0);
  for (const tree of model.trees) {
    if (tree.order.length < 2) continue;
    const sub = new Float64Array(tree.vertexCount);
    for (const att of tree.attachments) {
      const i = pinCurrent(att.element, att.pinName);
      // current entering the device leaves the node
      if (Number.isFinite(i)) sub[att.vertex]! -= i;
    }
    for (let k = tree.order.length - 1; k >= 0; k--) {
      const o = tree.order[k]!;
      if (o.parent < 0) continue;
      out[o.segment] = o.sign * sub[o.vertex]!;
      sub[o.parent]! += sub[o.vertex]!;
    }
  }
}
