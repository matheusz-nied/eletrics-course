/**
 * Numbered markers attached to points of a part, with their text. The same
 * list is rendered as an ordered list next to the canvas (screen readers and
 * small screens), so the numbers match.
 *
 * Labels point away from the middle of the model (or to the side where they
 * fit) and are nudged apart vertically when two of them would overlap.
 *
 * The markers are plain DOM in the viewer (<AnnotationPins>, outside the
 * canvas); <Annotations>, inside the canvas, only moves them each frame. A
 * React root per marker (drei's <Html>) raced with the canvas unmounting on
 * pages with several models and threw on removal.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
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

/** Radius of the number disc (px): the label starts there. */
const PIN_RADIUS = 10;

/**
 * Side a label goes to: the preferred one (away from the middle of the
 * model), unless the label would run off the view there and fits better on
 * the other side. Pure, unit-tested.
 */
export function labelSide(
  x: number,
  preferred: 'left' | 'right',
  width: number,
  viewport: number,
  pad = 4,
): 'left' | 'right' {
  const overflowRight = Math.max(0, x - PIN_RADIUS + width - (viewport - pad));
  const overflowLeft = Math.max(0, pad - (x + PIN_RADIUS - width));
  if (preferred === 'right' && overflowRight > 0 && overflowLeft < overflowRight) return 'left';
  if (preferred === 'left' && overflowLeft > 0 && overflowRight < overflowLeft) return 'right';
  return preferred;
}

/** The marker elements, rendered by the viewer over the canvas. */
export function AnnotationPins({
  items,
  layer,
}: {
  items: PartAnnotation[];
  layer: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={layer} className="m3d__pins" aria-hidden="true">
      {items.map((item, index) => (
        <div key={`${index}-${item.text}`} className="m3d-pin-wrap" hidden>
          <span className="m3d-pin" data-side="right">
            <span className="m3d-pin__number">{index + 1}</span>
            <span className="m3d-pin__text">{item.text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Moves the markers of <AnnotationPins> to their points, every frame. */
export function Annotations({
  items,
  layer,
}: {
  items: PartAnnotation[];
  layer: RefObject<HTMLDivElement | null>;
}) {
  const placements = useMemo<Placement[]>(
    () => items.map(() => ({ x: 0, y: 0, side: 'right', pin: null })),
    [items],
  );

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
          index={index}
          layer={layer}
          placement={placements[index]!}
        />
      ))}
    </>
  );
}

function Marker({
  item,
  index,
  layer,
  placement,
}: {
  item: PartAnnotation;
  index: number;
  layer: RefObject<HTMLDivElement | null>;
  placement: Placement;
}) {
  const group = useRef<Group>(null);
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
    const wrap = layer.current?.children[index] as HTMLElement | undefined;
    const pin = wrap?.firstElementChild as HTMLSpanElement | null | undefined;
    if (!wrap || !pin || !g.parent) return;
    g.getWorldPosition(world.current).project(camera);
    g.parent.getWorldPosition(origin.current).project(camera);
    const x = ((world.current.x + 1) / 2) * size.width;
    const y = ((1 - world.current.y) / 2) * size.height;
    // Behind the camera the projection mirrors; hide the marker there.
    wrap.toggleAttribute('hidden', world.current.z > 1);
    wrap.style.setProperty('transform', `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`);
    const preferred = world.current.x < origin.current.x - 0.02 ? 'left' : 'right';
    const side = labelSide(x, preferred, pin.offsetWidth, size.width);
    if (pin.dataset.side !== side) pin.setAttribute('data-side', side);
    Object.assign(placement, { x, y, side, pin });
  });

  return <group ref={group} position={item.at} />;
}
