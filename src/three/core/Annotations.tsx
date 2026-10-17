/**
 * Numbered markers attached to points of a part, with their text. The same
 * list is rendered as an ordered list next to the canvas (screen readers and
 * small screens), so the numbers match.
 *
 * Labels point away from the middle of the model and are nudged apart
 * vertically when two of them would overlap on screen.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3, type Group } from 'three';
import { useView } from './view';
import type { PartAnnotation } from '../types';

export function visibleAnnotations(list: PartAnnotation[], exploded: boolean): PartAnnotation[] {
  return list.filter((a) => a.exploded === undefined || a.exploded === exploded);
}

/** Screen position (px) and label element of each marker, written every frame. */
interface Placement {
  x: number;
  y: number;
  side: 'left' | 'right';
  pin: HTMLSpanElement | null;
}

/** Minimum vertical distance between two labels on the same side (px). */
const LABEL_GAP = 24;

/**
 * Vertical offsets (px) that keep labels at least `gap` apart, pushing lower
 * labels down. Two labels clash when they point to the same side, or when
 * their markers are close enough horizontally for the numbers to touch.
 * Pure, unit-tested.
 */
export function spreadLabels(
  items: { x: number; y: number; side: 'left' | 'right' }[],
  gap = LABEL_GAP,
): number[] {
  const offsets = items.map(() => 0);
  const order = items.map((item, index) => ({ ...item, index })).sort((a, b) => a.y - b.y);
  const placed: { x: number; y: number; side: 'left' | 'right' }[] = [];
  for (const item of order) {
    let y = item.y;
    for (const other of placed) {
      const clash = other.side === item.side || Math.abs(other.x - item.x) < gap * 2;
      if (clash) y = Math.max(y, other.y + gap);
    }
    offsets[item.index] = y - item.y;
    placed.push({ x: item.x, y, side: item.side });
  }
  return offsets;
}

export function Annotations({ items }: { items: PartAnnotation[] }) {
  const placements = useMemo<Placement[]>(
    () => items.map(() => ({ x: 0, y: 0, side: 'right', pin: null })),
    [items],
  );

  // Runs after the markers' own frame callbacks (children subscribe first).
  useFrame(() => {
    const offsets = spreadLabels(placements);
    placements.forEach((p, i) => {
      const dy = `${Math.round(offsets[i] ?? 0)}px`;
      if (p.pin && p.pin.style.getPropertyValue('--m3d-dy') !== dy)
        p.pin.style.setProperty('--m3d-dy', dy);
    });
  });

  return (
    <>
      {items.map((item, index) => (
        <Marker
          key={`${index}-${item.text}`}
          item={item}
          number={index + 1}
          placement={placements[index]!}
        />
      ))}
    </>
  );
}

function Marker({
  item,
  number,
  placement,
}: {
  item: PartAnnotation;
  number: number;
  placement: Placement;
}) {
  const group = useRef<Group>(null);
  const pin = useRef<HTMLSpanElement>(null);
  const { anchors } = useView();
  const world = useRef(new Vector3());
  const origin = useRef(new Vector3());

  useFrame(({ camera, size }) => {
    const g = group.current;
    if (!g) return;
    const anchor = item.anchor ? anchors.get(item.anchor) : undefined;
    if (anchor && g.parent) {
      anchor.getWorldPosition(world.current);
      g.position.copy(g.parent.worldToLocal(world.current));
    } else {
      g.position.set(...item.at);
    }
    if (!pin.current || !g.parent) return;
    g.getWorldPosition(world.current).project(camera);
    g.parent.getWorldPosition(origin.current).project(camera);
    const side = world.current.x < origin.current.x - 0.02 ? 'left' : 'right';
    if (pin.current.dataset.side !== side) pin.current.dataset.side = side;
    // The placement object is shared with <Annotations>, which spreads the labels.
    Object.assign(placement, {
      x: ((world.current.x + 1) / 2) * size.width,
      y: ((1 - world.current.y) / 2) * size.height,
      side,
      pin: pin.current,
    });
  });

  return (
    <group ref={group} position={item.at}>
      <Html center zIndexRange={[30, 10]} pointerEvents="none" className="m3d-pin-wrap">
        <span ref={pin} className="m3d-pin" data-side="right" aria-hidden="true">
          <span className="m3d-pin__number">{number}</span>
          <span className="m3d-pin__text">{item.text}</span>
        </span>
      </Html>
    </group>
  );
}
