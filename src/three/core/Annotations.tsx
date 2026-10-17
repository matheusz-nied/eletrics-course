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
  const { anchors } = useView();
  const world = useRef(new Vector3());

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const anchor = item.anchor ? anchors.get(item.anchor) : undefined;
    if (anchor && g.parent) {
      anchor.getWorldPosition(world.current);
      g.position.copy(g.parent.worldToLocal(world.current));
    } else {
      g.position.set(...item.at);
    }
  });

  return (
    <group ref={group} position={item.at}>
      <Html center zIndexRange={[30, 10]} pointerEvents="none" className="m3d-pin-wrap">
        <span className="m3d-pin" aria-hidden="true">
          <span className="m3d-pin__number">{number}</span>
          <span className="m3d-pin__text">{item.text}</span>
        </span>
      </Html>
    </group>
  );
}
