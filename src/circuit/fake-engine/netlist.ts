/**
 * Connectivity (docs/plano/02-arquitetura.md, section 5.2): two pins share a node
 * when they sit on the same grid point, directly or through wires. Wires connect
 * only at their ends and vertices.
 */
import type { CircuitDoc, Netlist, Vec2 } from '../../engine/contract';
import { elementParams, pinPositions, pointKey } from '../geometry';
import { getDeviceInfo, hasDevice } from './catalog';

class UnionFind {
  private parent = new Map<string, string>();

  add(k: string) {
    if (!this.parent.has(k)) this.parent.set(k, k);
  }

  find(k: string): string {
    let root = k;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = k;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string) {
    this.add(a);
    this.add(b);
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }

  keys() {
    return this.parent.keys();
  }
}

export function buildNetlist(doc: CircuitDoc): Netlist {
  const uf = new UnionFind();
  const coords = new Map<string, Vec2>();
  const remember = (p: Vec2) => {
    const k = pointKey(p);
    coords.set(k, p);
    uf.add(k);
    return k;
  };

  for (const el of doc.elements) {
    if (el.type !== 'wire') continue;
    const pts = el.points ?? (el.a && el.b ? [el.a, el.b] : []);
    for (let i = 0; i < pts.length; i++) {
      const k = remember(pts[i]!);
      if (i > 0) uf.union(pointKey(pts[i - 1]!), k);
    }
  }

  const pinPoint: Record<string, string> = {};
  const groundKeys = new Set<string>();
  for (const el of doc.elements) {
    if (el.type === 'wire') continue;
    const info = hasDevice(el.type)
      ? getDeviceInfo(el.type, elementParams(el, undefined))
      : undefined;
    const positions = pinPositions(el, info);
    for (const [pin, p] of Object.entries(positions)) {
      const k = remember(p);
      pinPoint[`${el.id}.${pin}`] = k;
      if (el.type === 'ground') groundKeys.add(k);
    }
  }

  // Name nodes in order of first appearance; the ground node is "GND".
  const groundRoots = new Set([...groundKeys].map((k) => uf.find(k)));
  const rootName = new Map<string, string>();
  const byName = new Map<string, Netlist['nodes'][number]>();
  let counter = 0;
  for (const k of uf.keys()) {
    const root = uf.find(k);
    let name = rootName.get(root);
    if (!name) {
      name = groundRoots.has(root) ? 'GND' : `n${++counter}`;
      rootName.set(root, name);
      byName.set(name, { id: name, points: [] });
    }
    byName.get(name)!.points.push(coords.get(k)!);
  }
  const nodes = [...byName.values()];

  const pins: Record<string, string> = {};
  for (const [pin, k] of Object.entries(pinPoint)) pins[pin] = rootName.get(uf.find(k))!;
  return { nodes, pins };
}
