import type { CircuitDoc, Netlist, Vec2 } from '../contract';
import { findDevice } from '../devices';
import { pinPoints, pointKey, wirePoints } from './geometry';

/** Id of the reference node. */
export const GROUND = 'GND';

class UnionFind {
  private parent = new Map<string, string>();
  find(k: string): string {
    if (!this.parent.has(k)) {
      this.parent.set(k, k);
      return k;
    }
    let root = k;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    while (k !== root) {
      const next = this.parent.get(k)!;
      this.parent.set(k, root);
      k = next;
    }
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Connectivity (docs/plano/02-arquitetura.md, section 5.2): pins on the same
 * grid point are connected, directly or through wires; wires connect only at
 * their end points and vertices. Node "GND" holds the ground symbols; without
 * any, the negative pin of the first source (or else the first node) becomes
 * the reference. Other nodes are "n1", "n2"… in document order.
 *
 * Throws for unknown device types; run validateCircuit first for friendly errors.
 */
export function buildNetlist(doc: CircuitDoc): Netlist {
  const uf = new UnionFind();
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (p: Vec2) => {
    const k = pointKey(p);
    uf.find(k);
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
    return k;
  };

  const pinKeys = new Map<string, string>();
  const groundKeys: string[] = [];
  let referenceKey: string | undefined;

  for (const el of doc.elements) {
    if (el.type === 'wire') {
      const pts = wirePoints(el);
      for (let i = 0; i < pts.length; i++) {
        const k = visit(pts[i]);
        if (i > 0) uf.union(pointKey(pts[i - 1]), k);
      }
      continue;
    }
    const def = findDevice(el.type);
    if (!def)
      throw new Error(`Tipo de dispositivo desconhecido: "${el.type}" (elemento ${el.id}).`);
    const points = pinPoints(el, def.info);
    def.info.pins.forEach((pin, i) => {
      const k = visit(points[i]);
      pinKeys.set(`${el.id}.${pin.name}`, k);
      if (el.type === 'ground') groundKeys.push(k);
      if (referenceKey === undefined && def.referencePin === pin.name) referenceKey = k;
    });
  }

  for (let i = 1; i < groundKeys.length; i++) uf.union(groundKeys[0], groundKeys[i]);
  const groundRoot =
    groundKeys.length > 0
      ? uf.find(groundKeys[0])
      : referenceKey !== undefined
        ? uf.find(referenceKey)
        : order.length > 0
          ? uf.find(order[0])
          : undefined;

  const nodeIds = new Map<string, string>();
  const nodes: Netlist['nodes'] = [];
  const byRoot = new Map<string, Netlist['nodes'][number]>();
  if (groundRoot !== undefined) {
    const node = { id: GROUND, points: [] };
    nodeIds.set(groundRoot, GROUND);
    byRoot.set(groundRoot, node);
    nodes.push(node);
  }
  for (const k of order) {
    const root = uf.find(k);
    let node = byRoot.get(root);
    if (!node) {
      node = { id: `n${nodes.length}`, points: [] };
      nodeIds.set(root, node.id);
      byRoot.set(root, node);
      nodes.push(node);
    }
    const [x, y] = k.split(',').map(Number);
    node.points.push([x, y]);
  }

  const pins: Record<string, string> = {};
  for (const [pin, k] of pinKeys) pins[pin] = nodeIds.get(uf.find(k))!;
  return { nodes, pins };
}
