import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Plane, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { labelSide, spreadLabels } from '../core/Annotations';
import { resistorBands } from '../core/colorCode';
import { fitDistance, visibleBounds } from '../core/framing';
import { transitionStep } from '../core/motion';
import {
  capacitorCode,
  formatFarads,
  formatNumber,
  formatOhms,
  formatWatts,
  smdResistorCode,
} from '../core/format';
import { blackbodyRGB, glowIntensity } from '../fx/blackbody';
import { flowSpeed } from '../fx/CurrentFlow';
import { ellipticKE, fieldAt, fieldLines, loopField, traceLine } from '../fx/field';
import { boardPoint, padPosition, resolveLayout } from '../pcb/layout';
import { ledBoard, perfBoard, smdBoard } from '../pcb/samples';

describe('format', () => {
  it('writes numbers the Brazilian way', () => {
    expect(formatNumber(4.7)).toBe('4,7');
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatOhms(4700)).toBe('4,7 kΩ');
    expect(formatOhms(1_000_000)).toBe('1 MΩ');
    expect(formatOhms(470)).toBe('470 Ω');
    expect(formatFarads(100e-9)).toBe('100 nF');
    expect(formatFarads(2.2e-6)).toBe('2,2 µF');
  });

  it('prints catalogue power ratings', () => {
    expect(formatWatts(0.25)).toBe('1/4 W');
    expect(formatWatts(0.5)).toBe('1/2 W');
    expect(formatWatts(5)).toBe('5 W');
  });

  it('builds SMD and capacitor codes', () => {
    expect(smdResistorCode(4700)).toBe('472');
    expect(smdResistorCode(4700, true)).toBe('4701');
    expect(smdResistorCode(100)).toBe('101');
    expect(smdResistorCode(4.7)).toBe('4R7');
    expect(capacitorCode(100e-9)).toBe('104');
    expect(capacitorCode(4.7e-9)).toBe('472');
    expect(capacitorCode(22e-12)).toBe('22');
  });
});

describe('resistor colour code', () => {
  it('encodes 4 and 5 bands', () => {
    expect(resistorBands(4700).bands).toEqual(['amarelo', 'violeta', 'vermelho', 'dourado']);
    expect(resistorBands(470, 5).bands).toEqual(['amarelo', 'violeta', 'marrom', 'dourado']);
    expect(resistorBands(10, 10).bands).toEqual(['marrom', 'preto', 'preto', 'prateado']);
    expect(resistorBands(4.7).bands).toEqual(['amarelo', 'violeta', 'dourado', 'dourado']);
    expect(resistorBands(12_100, 1, 5).bands).toEqual([
      'marrom',
      'vermelho',
      'marrom',
      'vermelho',
      'marrom',
    ]);
  });

  it('rounds to what the bands can say', () => {
    expect(resistorBands(4689).ohms).toBe(4700);
  });
});

describe('black body', () => {
  it('goes from red to white', () => {
    const [r1, g1, b1] = blackbodyRGB(1200);
    expect(r1).toBe(1);
    expect(g1).toBeLessThan(0.5);
    expect(b1).toBe(0);
    const [r2, g2, b2] = blackbodyRGB(6500);
    expect(Math.min(r2, g2, b2)).toBeGreaterThan(0.9);
  });

  it('only glows above ~750 K and reaches 1 at 2700 K', () => {
    expect(glowIntensity(600)).toBe(0);
    expect(glowIntensity(1000)).toBeGreaterThan(0);
    expect(glowIntensity(2700)).toBeCloseTo(1);
    expect(glowIntensity(3000)).toBeGreaterThan(1);
  });
});

describe('visible bounds', () => {
  it('ignores hidden objects and turned-off materials', () => {
    const root = new Group();
    const shown = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    const hidden = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    hidden.position.set(50, 0, 0);
    hidden.visible = false;
    const off = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial({ visible: false }));
    off.position.set(0, 0, -40);
    const moved = new Group();
    moved.position.set(0, 10, 0);
    moved.add(new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial()));
    root.add(shown, hidden, off, moved);
    const box = visibleBounds(root, new Box3());
    expect(box.min.toArray()).toEqual([-1, -1, -1]);
    expect(box.max.toArray()).toEqual([1, 11, 1]);
  });

  it('keeps only the part a cutaway plane leaves', () => {
    const material = new MeshBasicMaterial({
      clippingPlanes: [new Plane(new Vector3(0, 0, -1), 0)],
    });
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(4, 4, 4), material));
    const box = visibleBounds(root, new Box3());
    expect(box.min.z).toBe(-2);
    expect(box.max.z).toBe(0);
  });
});

describe('framing', () => {
  it('backs off further for a wider box', () => {
    const center = new Vector3();
    const dir = new Vector3(0, 0, 1);
    const small = new Box3(new Vector3(-5, -5, -5), new Vector3(5, 5, 5));
    const wide = new Box3(new Vector3(-50, -5, -5), new Vector3(50, 5, 5));
    const a = fitDistance(small, center, dir, 30, 1.5);
    const b = fitDistance(wide, center, dir, 30, 1.5);
    expect(b).toBeGreaterThan(a * 4);
    // A 10 mm cube, 30° vertical fov: half-height 5 at depth d − 5 → d ≈ 5 + 5/tan(15°).
    expect(a).toBeCloseTo(5 + 5 / Math.tan(Math.PI / 12), 1);
  });
});

describe('transition step', () => {
  it('takes a nominal first step, then real time up to a quarter second', () => {
    // The first frame after idle spans the idle time; it must not jump the transition.
    expect(transitionStep(false, 12)).toBeCloseTo(1 / 60);
    expect(transitionStep(true, 0.1)).toBe(0.1);
    expect(transitionStep(true, 3)).toBe(0.25);
  });
});

describe('magnetic field', () => {
  it('computes the elliptic integrals', () => {
    const [K0, E0] = ellipticKE(0);
    expect(K0).toBeCloseTo(Math.PI / 2, 10);
    expect(E0).toBeCloseTo(Math.PI / 2, 10);
    const [K, E] = ellipticKE(0.5);
    expect(K).toBeCloseTo(1.854074677, 8);
    expect(E).toBeCloseTo(1.350643881, 8);
  });

  it('matches the on-axis field of a loop', () => {
    const a = 10;
    const z = 7;
    const [brho, bz] = loopField(a, 2, 0, z);
    expect(brho).toBe(0);
    // μ0 I a² / (2 (a² + z²)^{3/2}) with μ0 = 4π.
    expect(bz).toBeCloseTo((2 * Math.PI * 2 * a * a) / (a * a + z * z) ** 1.5, 9);
  });

  it('points from north to south outside a bar magnet', () => {
    const bar = [{ kind: 'bar' as const, length: 40, axis: [1, 0, 0] as [number, number, number] }];
    // Beyond the north pole the field points away from the magnet…
    expect(fieldAt(bar, [40, 0, 0])[0]).toBeGreaterThan(0);
    // …and beside the middle it runs back towards the south pole.
    expect(fieldAt(bar, [0, 15, 0])[0]).toBeLessThan(0);
  });

  it('circles a straight wire by the right-hand rule', () => {
    const wire = [
      {
        kind: 'wire' as const,
        start: [0, -100, 0] as [number, number, number],
        end: [0, 100, 0] as [number, number, number],
      },
    ];
    const b = fieldAt(wire, [10, 0, 0]);
    // Current up (+y), point at +x: B along −z.
    expect(b[2]).toBeLessThan(0);
    expect(Math.abs(b[0])).toBeLessThan(1e-9);
    // Nearly infinite wire: B = μ0 I / (2π d) = 2 I / d with μ0 = 4π.
    expect(Math.abs(b[2])).toBeCloseTo(2 / 10, 2);
    const line = traceLine(wire, [10, 0, 0], 1, { step: 0.5, extent: 50 });
    expect(line.closed).toBe(true);
  });

  it('draws lines that leave the north pole and reach the south pole', () => {
    const lines = fieldLines([{ kind: 'bar', length: 40, axis: [1, 0, 0] }], { count: 8 });
    expect(lines.length).toBeGreaterThanOrEqual(8);
    const closing = lines.filter((l) => l[0]![0] > 19 && l[l.length - 1]![0] < -19);
    expect(closing.length).toBeGreaterThanOrEqual(4);
  });
});

describe('current flow', () => {
  it('grows with the current and keeps its sign', () => {
    expect(flowSpeed(0)).toBe(0);
    expect(flowSpeed(0.5, 30)).toBe(15);
    expect(flowSpeed(-0.5, 30)).toBe(-15);
    expect(flowSpeed(10, 30)).toBeGreaterThan(flowSpeed(1, 30));
    expect(flowSpeed(1e6, 30)).toBe(150);
  });
});

describe('printed circuit board layouts', () => {
  it('fills the defaults', () => {
    const l = resolveLayout({ width: 10, height: 10 });
    expect(l.thickness).toBe(1.6);
    expect(l.maskSides).toEqual(['top', 'bottom']);
    expect(resolveLayout({ width: 10, height: 10, copper: 'bottom' }).maskSides).toEqual([
      'bottom',
    ]);
    expect(resolveLayout({ width: 10, height: 10, mask: 'nenhuma' }).maskSides).toEqual([]);
  });

  it('maps layout points to the part space', () => {
    const layout = { width: 40, height: 20 };
    expect(boardPoint(layout, [0, 0])).toEqual([-20, 1.6, -10]);
    expect(boardPoint(layout, [40, 20], 'bottom')).toEqual([20, 0, 10]);
    expect(padPosition(ledBoard(), 'R1.1')).toEqual([20 - 5.08 - 20, 1.6, 0]);
  });

  it('keeps every sample pad and hole inside the board', () => {
    for (const layout of [ledBoard(true), perfBoard(), smdBoard()]) {
      for (const item of [
        ...(layout.pads ?? []),
        ...(layout.holes ?? []),
        ...(layout.vias ?? []),
      ]) {
        expect(item.at[0]).toBeGreaterThan(0);
        expect(item.at[0]).toBeLessThan(layout.width);
        expect(item.at[1]).toBeGreaterThan(0);
        expect(item.at[1]).toBeLessThan(layout.height);
      }
    }
    expect(perfBoard().pads).toHaveLength(18 * 24);
  });
});

describe('annotation labels', () => {
  it('pushes overlapping labels on the same side apart', () => {
    const offsets = spreadLabels(
      [
        { x: 100, y: 50, side: 'right' },
        { x: 120, y: 40, side: 'right' },
        { x: 10, y: 45, side: 'left' },
        { x: 130, y: 200, side: 'right' },
      ],
      24,
    );
    expect(offsets).toEqual([14, 0, 0, 0]);
  });

  it('separates markers on opposite sides that sit on the same spot', () => {
    const offsets = spreadLabels(
      [
        { x: 200, y: 100, side: 'right' },
        { x: 204, y: 104, side: 'left' },
      ],
      24,
    );
    expect(offsets).toEqual([0, 20]);
  });

  it('flips a label that would run off the view', () => {
    expect(labelSide(40, 'left', 200, 800)).toBe('right');
    expect(labelSide(760, 'right', 200, 800)).toBe('left');
    expect(labelSide(400, 'left', 200, 800)).toBe('left');
    // Too wide for either side: keep the side with less overflow.
    expect(labelSide(100, 'right', 790, 800)).toBe('right');
  });

  it('keeps a chain of close labels in order', () => {
    const offsets = spreadLabels(
      [0, 1, 2].map((i) => ({ x: 0, y: 100 + i, side: 'left' as const })),
      20,
    );
    expect(offsets).toEqual([0, 19, 38]);
  });
});
