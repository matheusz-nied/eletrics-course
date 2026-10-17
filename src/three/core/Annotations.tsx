/**
 * Numbered markers attached to points of a part, with their text. The same
 * list is rendered as an ordered list next to the canvas (screen readers and
 * small screens), so the numbers match.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3, type Group } from 'three';
import { useView } from './view';
import type { PartAnnotation } from '../types';

export function visibleAnnotations(list: PartAnnotation[], exploded: boolean): PartAnnotation[] {
  return list.filter((a) => a.exploded === undefined || a.exploded === exploded);
}

export function Annotations({ items }: { items: PartAnnotation[] }) {
  return (
    <>
      {items.map((item, index) => (
        <Marker key={`${index}-${item.text}`} item={item} number={index + 1} />
      ))}
    </>
  );
}

function Marker({ item, number }: { item: PartAnnotation; number: number }) {
  const group = useRef<Group>(null);
  const pin = useRef<HTMLSpanElement>(null);
  const { anchors } = useView();
  const world = useRef(new Vector3());
  const origin = useRef(new Vector3());

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const anchor = item.anchor ? anchors.get(item.anchor) : undefined;
    if (anchor && g.parent) {
      anchor.getWorldPosition(world.current);
      g.position.copy(g.parent.worldToLocal(world.current));
    } else {
      g.position.set(...item.at);
    }
    // Labels point away from the middle of the model, so neighbours do not overlap.
    if (pin.current && g.parent) {
      g.getWorldPosition(world.current).project(camera);
      g.parent.getWorldPosition(origin.current).project(camera);
      const side = world.current.x < origin.current.x - 0.02 ? 'left' : 'right';
      if (pin.current.dataset.side !== side) pin.current.dataset.side = side;
    }
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
