/**
 * DIP switch, 2,54 mm pitch, 2 / 4 / 8 positions, red or blue body with
 * white sliders, "ON" and the switch numbers printed on top. Dimensions from
 * typical datasheets (CTS 206, Würth WS-DISV): rows 7,62 mm apart, body
 * 6,6 mm wide, length n × 2,54 + 0,6 mm. Inside: a base with the contact
 * pads of each pin pair and, under every slider, a spring contact that
 * bridges the two pads in the ON position.
 */
import { useRef } from 'react';
import { Shape, type BufferGeometry, type Group } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import {
  addRoundedRect,
  extrudeUp,
  invertGeometry,
  mergeAll,
  roundedRectCap,
  roundedRectSweep,
} from './_em-geometry';
import { Decal, Pin, useSmooth } from './_em-kit';

export interface DipSwitchProps {
  /** Number of switches: 2, 4 or 8. */
  positions?: number;
  /** One character per switch, "1" = ON ("1010"). */
  states?: string;
  color?: 'vermelho' | 'azul';
}

const PITCH = 2.54;
const ROW = 7.62;
const W = 6.6;
const PIN = 3.5;
const STANDOFF = 0.4;
/** Height of the body bottom above the pin tips. */
export const DIP_SWITCH_SEAT = PIN + STANDOFF;
const BASE_TOP = 1.6;
const PLATE = 3.6;
const TOP = 4.4;
const WIN_X = 1.3;
const WIN_Z = 3.6;
const KNOB_Z = 1.3;
const TRAVEL = (WIN_Z - KNOB_Z) / 2 - 0.05;

const BODY = {
  vermelho: { color: '#c42a20', cut: '#7d1a13' },
  azul: { color: '#1f52c0', cut: '#143683' },
};

export const meta: PartMeta = {
  id: 'dip-switch',
  label: 'DIP switch',
  category: 'eletromecanicos',
  summary:
    'Chave DIP de 2, 4 ou 8 posições, com as alavancas brancas em ON ou OFF e o contato de mola por dentro.',
  defaults: { positions: 4, states: '1010', color: 'vermelho' },
  controls: {
    positions: {
      kind: 'select',
      label: 'Posições',
      options: [
        { value: 2, label: '2' },
        { value: 4, label: '4' },
        { value: 8, label: '8' },
      ],
    },
    states: { kind: 'text', label: 'Estados (1 = ON), ex.: 1010', maxLength: 8 },
    color: {
      kind: 'select',
      label: 'Cor',
      options: [
        { value: 'vermelho', label: 'Vermelho' },
        { value: 'azul', label: 'Azul' },
      ],
    },
  },
  annotations: (p) => {
    const n = positionsOf(p.positions);
    const x0 = -((n - 1) / 2) * PITCH;
    return [
      {
        at: [x0, DIP_SWITCH_SEAT + TOP + 0.6, 0] as Vec3,
        text: 'Alavanca do lado ON = chave ligada',
        exploded: false,
      },
      {
        at: [-x0 + 1.5, DIP_SWITCH_SEAT + TOP, W / 2 - 0.6] as Vec3,
        text: 'Marcação ON',
        exploded: false,
      },
      {
        at: [-x0, DIP_SWITCH_SEAT + TOP, -W / 2 + 0.6] as Vec3,
        text: 'Número de cada chave',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Contato de mola: em ON liga os dois pinos', anchor: 'mola' },
      { at: [0, 0, 0] as Vec3, text: 'Pinos: cada chave fica entre um par', anchor: 'pinos' },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const n = positionsOf(p.positions);
    const s = statesOf(p.states, n);
    const on = s.map((v, i) => (v ? i + 1 : 0)).filter(Boolean);
    const color = p.color === 'azul' ? 'azul' : 'vermelha';
    const list =
      on.length === 0
        ? 'todas em OFF'
        : on.length === n
          ? 'todas em ON'
          : `${on.length === 1 ? 'chave' : 'chaves'} ${joinPt(on.map(String))} em ON, as outras em OFF`;
    return `Chave DIP ${color} de ${n} posições: ${list}.`;
  },
  view: [0.35, 1.1, 1.2],
};

function positionsOf(v: unknown): number {
  const n = Number(v);
  return n === 2 || n === 8 ? n : 4;
}

function statesOf(v: unknown, n: number): boolean[] {
  const text = String(v ?? '').replace(/[^01]/g, '');
  return Array.from({ length: n }, (_, i) => text[i] === '1');
}

function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export default function DipSwitch(props: DipSwitchProps) {
  const p = { ...meta.defaults, ...props } as Required<DipSwitchProps>;
  const n = positionsOf(p.positions);
  const states = statesOf(p.states, n);
  const L = n * PITCH + 0.6;
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * PITCH);
  const body = BODY[p.color === 'azul' ? 'azul' : 'vermelho'];
  const noise = getNoiseTexture();

  const base = useDisposable(() => {
    const shape = new Shape();
    addRoundedRect(shape, L, W, 0.35);
    return extrudeUp(shape, BASE_TOP, 0.12, { curveSegments: 4 });
  }, [L]);

  // Cover: hollow walls and the top plate with one window per switch.
  const cover = useDisposable(() => {
    const b = 0.22;
    const plate = new Shape();
    addRoundedRect(plate, L, W, 0.35);
    for (const x of xs) {
      const hole = new Shape();
      addRoundedRect(hole, WIN_X, WIN_Z, 0.15, x, 0, true);
      plate.holes.push(hole);
    }
    const top = extrudeUp(plate, TOP - PLATE + b, b, { curveSegments: 4 });
    top.translate(0, PLATE - b, 0);
    const wall = 0.55;
    const parts: BufferGeometry[] = [
      top,
      roundedRectSweep(L, W, 0.35, [
        [0, BASE_TOP],
        [0, PLATE],
      ]),
      roundedRectSweep(L, W, 0.35, [
        [-wall, BASE_TOP],
        [0, BASE_TOP],
      ]),
      invertGeometry(
        roundedRectSweep(L, W, 0.35, [
          [-wall, BASE_TOP],
          [-wall, PLATE - b],
        ]),
      ),
      roundedRectCap(L - 2 * wall, W - 2 * wall, 0.1, PLATE - b - 0.001, false),
    ];
    return mergeAll(parts);
  }, [L, xs]);

  const marking = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f6f4ee';
      const strip = ((W - WIN_Z) / 2 / W) * h;
      // "ON" and the arrow on the front strip (+Z is the bottom of the canvas).
      fitText(ctx, 'ON', w - (w / L) * 1.9, h - strip * 0.5, (w / L) * 2.6, strip * 0.78, {
        weight: 800,
        family: FONT_SANS,
      });
      const ax = w - (w / L) * 3.7;
      ctx.beginPath();
      ctx.moveTo(ax, h - strip * 0.2);
      ctx.lineTo(ax - strip * 0.28, h - strip * 0.62);
      ctx.lineTo(ax + strip * 0.28, h - strip * 0.62);
      ctx.closePath();
      ctx.fill();
      xs.forEach((x, i) => {
        fitText(
          ctx,
          String(i + 1),
          ((x + L / 2) / L) * w,
          strip * 0.52,
          (w / L) * 2,
          strip * 0.74,
          {
            weight: 700,
            family: FONT_SANS,
          },
        );
      });
    },
    `${n}`,
    { width: 128 * n, height: Math.round(((128 * n) / L) * W), fonts: [`800 40px ${FONT_SANS}`] },
  );

  const knob = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const foot = new Shape();
    addRoundedRect(foot, WIN_X + 0.5, KNOB_Z + 0.7, 0.1);
    const f = extrudeUp(foot, PLATE - 2.3, 0.06, { curveSegments: 2, bevelSegments: 1 });
    f.translate(0, 2.3, 0);
    parts.push(f);
    const top = new Shape();
    addRoundedRect(top, WIN_X - 0.24, KNOB_Z, 0.18);
    const t = extrudeUp(top, TOP + 0.35 - PLATE + 0.1, 0.16, { curveSegments: 3 });
    t.translate(0, PLATE - 0.1, 0);
    parts.push(t);
    return mergeAll(parts);
  }, []);

  // Contact pads on the base: a long pad (top-row pin) and a short one (bottom row).
  const pads = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    for (const x of xs) {
      const a = new Shape();
      addRoundedRect(a, 0.9, 2.6, 0.1);
      const ga = extrudeUp(a, 0.12, 0.03, { curveSegments: 2, bevelSegments: 1 });
      ga.translate(x, BASE_TOP, 0.5);
      const b = new Shape();
      addRoundedRect(b, 0.9, 0.8, 0.1);
      const gb = extrudeUp(b, 0.12, 0.03, { curveSegments: 2, bevelSegments: 1 });
      gb.translate(x, BASE_TOP, -1.55);
      parts.push(ga, gb);
    }
    return mergeAll(parts);
  }, [xs]);

  const spring = useDisposable(() => {
    // Bent leaf: flat on top, two curved fingers that touch the pads.
    const parts: BufferGeometry[] = [];
    const s = new Shape();
    addRoundedRect(s, 0.8, 2.0, 0.08);
    const g = extrudeUp(s, 0.08, 0.02, { curveSegments: 2, bevelSegments: 1 });
    g.translate(0, 2.2, 0);
    parts.push(g);
    for (const z of [-0.8, 0.8]) {
      const leg = new Shape();
      addRoundedRect(leg, 0.7, 0.18, 0.05);
      const l = extrudeUp(leg, 0.5, 0.02, { curveSegments: 2, bevelSegments: 1 });
      l.translate(0, BASE_TOP + 0.12, z);
      parts.push(l);
    }
    return mergeAll(parts);
  }, []);

  return (
    <group position={[0, DIP_SWITCH_SEAT, 0]}>
      {/* Base with pins and pads. */}
      <mesh geometry={base}>
        <Material color={body.color} roughness={0.5} roughnessMap={noise} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (L / 2 - 1), -STANDOFF / 2, 0]}>
          <boxGeometry args={[1, STANDOFF, W - 1]} />
          <Material color={body.color} roughness={0.55} />
        </mesh>
      ))}
      <mesh geometry={pads}>
        <Material preset="gold" color="#e9c98a" roughness={0.28} />
      </mesh>
      {xs.map((x) =>
        [-1, 1].map((side) => (
          <group key={`${x}|${side}`}>
            <Pin
              x={x}
              z={side * (ROW / 2)}
              bottom={-DIP_SWITCH_SEAT}
              top={0.9}
              width={0.5}
              thickness={0.26}
              material={{ preset: 'tin', roughness: 0.3 }}
            />
            <mesh position={[x, 0.75, side * (ROW / 2 - 0.3)]}>
              <boxGeometry args={[0.5, 0.26, 0.86]} />
              <Material preset="tin" roughness={0.3} />
            </mesh>
          </group>
        )),
      )}
      <Anchor name="pinos" position={[xs[0]!, -1.5, ROW / 2]} />

      {/* Cover with the windows and the printing. */}
      <Explode offset={[0, 14, 0]}>
        <mesh geometry={cover}>
          <Material
            color={body.color}
            roughness={0.45}
            roughnessMap={noise}
            clip
            cutColor={body.cut}
          />
        </mesh>
        <Decal
          map={marking}
          width={L}
          height={W}
          position={[0, TOP + 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          roughness={0.5}
          clip
        />
      </Explode>

      {/* Sliders and their spring contacts. */}
      {xs.map((x, i) => (
        <Slider key={x} x={x} on={states[i]!} knob={knob} spring={spring} anchor={i === 0} />
      ))}
    </group>
  );
}

function Slider({
  x,
  on,
  knob,
  spring,
  anchor,
}: {
  x: number;
  on: boolean;
  knob: BufferGeometry;
  spring: BufferGeometry;
  anchor: boolean;
}) {
  const ref = useRef<Group>(null);
  useSmooth(
    [on ? TRAVEL : -TRAVEL],
    ([z]) => {
      if (ref.current) ref.current.position.z = z!;
    },
    14,
  );
  return (
    <group position={[x, 0, 0]}>
      <group ref={ref} position={[0, 0, on ? TRAVEL : -TRAVEL]}>
        <Explode offset={[0, 6.5, 0]} delay={0.1}>
          <mesh geometry={knob}>
            <Material color="#f4f3ef" roughness={0.42} />
          </mesh>
        </Explode>
        <Explode offset={[0, 2.5, 0]} delay={0.2}>
          <mesh geometry={spring}>
            <Material preset="gold" color="#e2bd84" roughness={0.3} />
          </mesh>
          {anchor && <Anchor name="mola" position={[0.4, 2.3, 0]} />}
        </Explode>
      </group>
    </group>
  );
}
