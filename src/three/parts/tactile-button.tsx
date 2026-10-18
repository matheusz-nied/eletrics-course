/**
 * Tactile push button for PCBs: 6 × 6 mm (height 5 mm, black round plunger)
 * and 12 × 12 mm (square plunger with a round snap-on cap), steel cover
 * crimped over the black base, four bent legs (pins 1–2 and 3–4 are joined
 * inside). Dimensions from typical datasheets (Omron B3F-1000 / B3F-4055,
 * C&K PTS645): 6 × 6 legs at 6,5 × 4,5 mm, 12 × 12 legs at 12,5 × 5,0 mm,
 * travel 0,25 mm. Inside: the stainless snap dome over the centre contact;
 * pressing flattens the dome onto it.
 */
import { useRef } from 'react';
import { Path, Shape, type BufferGeometry, type Group, type Mesh } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta } from '../types';
import { addRoundedRect, extrudeUp, mergeAll, roundedBox, shellGeometry } from './_em-geometry';
import { Pin, useSmooth } from './_em-kit';

type CapColor = 'preto' | 'vermelho' | 'azul' | 'amarelo' | 'verde' | 'branco' | 'cinza';

export interface TactileButtonProps {
  /** Body size (mm): 6 or 12. */
  size?: number;
  pressed?: boolean;
  /** Colour of the round cap of the 12 × 12 button. */
  capColor?: CapColor;
}

const CAP_COLORS: Record<CapColor, { color: string; label: string }> = {
  preto: { color: '#1c1c1e', label: 'Preta' },
  vermelho: { color: '#c3231c', label: 'Vermelha' },
  azul: { color: '#2155c4', label: 'Azul' },
  amarelo: { color: '#f0b81a', label: 'Amarela' },
  verde: { color: '#23934a', label: 'Verde' },
  branco: { color: '#efeee9', label: 'Branca' },
  cinza: { color: '#8a8e93', label: 'Cinza' },
};

interface Dims {
  body: number;
  base: number;
  plate: number;
  plunger: number;
  plungerTop: number;
  legX: number;
  legZ: number;
  dome: number;
  square: boolean;
}

const DIMS: Record<6 | 12, Dims> = {
  6: {
    body: 6,
    base: 3.1,
    plate: 0.25,
    plunger: 3.5,
    plungerTop: 5,
    legX: 3.25,
    legZ: 2.25,
    dome: 4.6,
    square: false,
  },
  12: {
    body: 12,
    base: 3.1,
    plate: 0.3,
    plunger: 3.8,
    plungerTop: 7.3,
    legX: 6.25,
    legZ: 2.5,
    dome: 8,
    square: true,
  },
};

const LEG = 3.5;
const TRAVEL = 0.25;
/** Height of the body bottom above the leg tips. */
export const TACTILE_SEAT = LEG;
const CAP = { r: 5.75, h: 6.2, gap: 0.6 };

export const meta: PartMeta = {
  id: 'tactile-button',
  label: 'Botão táctil',
  category: 'eletromecanicos',
  summary:
    'Botão táctil de placa 6 × 6 mm ou 12 × 12 mm com capa, com o domo metálico que dá o clique e fecha o contato.',
  defaults: { size: 6, pressed: false, capColor: 'preto' },
  controls: {
    size: {
      kind: 'select',
      label: 'Tamanho',
      options: [
        { value: 6, label: '6 × 6 mm' },
        { value: 12, label: '12 × 12 mm com capa' },
      ],
    },
    pressed: { kind: 'toggle', label: 'Apertado' },
    capColor: {
      kind: 'select',
      label: 'Cor da capa (12 × 12)',
      options: (Object.keys(CAP_COLORS) as CapColor[]).map((c) => ({
        value: c,
        label: CAP_COLORS[c].label,
      })),
    },
  },
  annotations: (p) => {
    const d = DIMS[sizeOf(p.size)];
    const list: PartAnnotation[] = [
      {
        at: [0, 0, 0],
        text: d.square ? 'Capa: o dedo aperta aqui' : 'Êmbolo: o dedo aperta aqui',
        anchor: 'botao',
      },
      { at: [0, 0, 0], text: 'Capa de aço presa na base', anchor: 'capa', exploded: false },
      {
        at: [0, 0, 0],
        text: 'Domo de aço: dá o clique e encosta no contato central',
        anchor: 'domo',
        exploded: true,
      },
      {
        at: [d.legX, 0.3, d.legZ],
        text: 'Pinos do mesmo lado já são ligados entre si',
        exploded: false,
      },
    ];
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const twelve = sizeOf(p.size) === 12;
    const cap = CAP_COLORS[capOf(p.capColor)].label.toLowerCase();
    const name = twelve
      ? `Botão táctil 12 × 12 mm com capa redonda ${cap}`
      : 'Botão táctil 6 × 6 mm';
    return `${name}, ${p.pressed ? 'apertado: o domo encosta no contato e liga os dois pares de pinos' : 'solto: os dois pares de pinos estão desligados'}.`;
  },
  view: [0.7, 0.9, 1.3],
};

function sizeOf(v: unknown): 6 | 12 {
  return Number(v) === 12 ? 12 : 6;
}

function capOf(v: unknown): CapColor {
  return typeof v === 'string' && v in CAP_COLORS ? (v as CapColor) : 'preto';
}

export default function TactileButton(props: TactileButtonProps) {
  const p = { ...meta.defaults, ...props } as Required<TactileButtonProps>;
  const d = DIMS[sizeOf(p.size)];
  const cap = CAP_COLORS[capOf(p.capColor)];
  const noise = getNoiseTexture();
  const moving = useRef<Group>(null);
  const dome = useRef<Mesh>(null);
  const B = d.body;
  const plateTop = d.base + d.plate;

  useSmooth(
    [p.pressed ? 1 : 0],
    ([v]) => {
      if (moving.current) moving.current.position.y = -TRAVEL * v!;
      if (dome.current) dome.current.scale.y = 1 - 0.85 * v!;
    },
    22,
  );

  const base = useDisposable(() => {
    const g = shellGeometry(B, d.base, B, 0.5, 0.35, d.square ? 1.4 : 0.9, 0.8);
    g.rotateX(Math.PI);
    g.translate(0, d.base, 0);
    return g;
  }, [B, d.base, d.square]);

  const cover = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const s = new Shape();
    addRoundedRect(s, B, B, 0.3);
    if (d.square) {
      const hole = new Shape();
      addRoundedRect(hole, d.plunger + 0.2, d.plunger + 0.2, 0.4, 0, 0, true);
      s.holes.push(hole);
    } else {
      const hole = new Path();
      hole.absarc(0, 0, d.plunger / 2 + 0.1, 0, Math.PI * 2, true);
      s.holes.push(hole);
    }
    const plate = extrudeUp(s, d.plate, 0.06, { curveSegments: 20, bevelSegments: 1 });
    plate.translate(0, d.base, 0);
    parts.push(plate);
    // Crimp tabs bent down over the base on two sides.
    for (const side of [-1, 1]) {
      const tab = roundedBox(d.square ? 3 : 1.8, d.base - 0.4, d.plate, 0.1, 0.05);
      tab.translate(0, 0.45, side * (B / 2 + d.plate / 2));
      parts.push(tab);
    }
    return mergeAll(parts);
  }, [B, d]);

  const plunger = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    if (d.square) {
      const s = new Shape();
      addRoundedRect(s, d.plunger, d.plunger, 0.4);
      const g = extrudeUp(s, d.plungerTop - d.base + 0.8, 0.2, { curveSegments: 4 });
      g.translate(0, d.base - 0.8, 0);
      parts.push(g);
    } else {
      const r = d.plunger / 2;
      parts.push(
        axialLathe(
          [
            [0, d.base - 0.9],
            [r + 0.6, d.base - 0.9],
            [r + 0.6, d.base - 0.15],
            [r, d.base - 0.1],
            [r, d.plungerTop - 0.25],
            [r - 0.2, d.plungerTop - 0.03],
            [r - 0.35, d.plungerTop],
            [0, d.plungerTop],
          ],
          40,
        ),
      );
    }
    // Actuator nub that presses the dome (just above its apex).
    const nubBottom = 0.88 + (d.square ? 0.45 : 0.3);
    const nub = axialLathe(
      [
        [0, nubBottom],
        [0.6, nubBottom],
        [0.6, d.base - 0.8],
        [0, d.base - 0.8],
      ],
      20,
    );
    parts.push(nub);
    return mergeAll(parts);
  }, [d]);

  const capGeometry = useDisposable(() => {
    const r = CAP.r;
    const y0 = d.base + d.plate + CAP.gap;
    const top = y0 + CAP.h;
    const pts: [number, number][] = [[0, d.plungerTop + 0.01]];
    pts.push([d.plunger * 0.72, d.plungerTop + 0.01]);
    pts.push([r - 0.6, y0 + 0.4]);
    pts.push([r - 0.6, y0]);
    pts.push([r, y0]);
    pts.push([r, top - 1.1]);
    for (let i = 1; i <= 8; i++) {
      const a = (Math.PI / 2) * (i / 8);
      pts.push([r - 1.1 + Math.cos(a) * 1.1, top - 1.1 + Math.sin(a) * 1.1]);
    }
    // Slightly concave top for the finger.
    pts.push([r * 0.6, top - 0.18]);
    pts.push([0, top - 0.3]);
    return axialLathe(pts, 56);
  }, [d]);

  const domeGeometry = useDisposable(() => {
    const r = d.dome / 2;
    const h = d.square ? 0.45 : 0.3;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([r * (1 - t), h * Math.sin((t * Math.PI) / 2)]);
    }
    return axialLathe(pts, 40);
  }, [d]);

  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  const contact = { preset: 'tin' as const, color: '#e4e4df', roughness: 0.25 };

  return (
    <group position={[0, TACTILE_SEAT, 0]}>
      {/* Base with the contacts and the legs. */}
      <mesh geometry={base}>
        <Material preset="pbtBlack" roughness={0.55} roughnessMap={noise} clip cutColor="#0b0b0c" />
      </mesh>
      <mesh position={[0, 0.83, 0]}>
        <cylinderGeometry args={[d.dome * 0.14, d.dome * 0.14, 0.06, 24]} />
        <Material {...contact} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * d.dome * 0.36, 0.83, 0]}>
          <boxGeometry args={[d.dome * 0.18, 0.06, d.dome * 0.62]} />
          <Material {...contact} />
        </mesh>
      ))}
      {legs.map(([sx, sz]) => (
        <group key={`${sx}${sz}`}>
          <mesh position={[sx * (B / 2 + (d.legX - B / 2) / 2 - 0.05), 0.75, sz * d.legZ]}>
            <boxGeometry args={[d.legX - B / 2 + 0.4, 0.3, 0.7]} />
            <Material preset="tin" roughness={0.3} />
          </mesh>
          <Pin
            x={sx * d.legX}
            z={sz * d.legZ}
            bottom={-LEG}
            top={0.9}
            width={0.3}
            thickness={0.7}
            material={{ preset: 'tin', roughness: 0.3 }}
          />
        </group>
      ))}

      {/* Snap dome. */}
      <Explode offset={[0, 5, 0]} delay={0.2}>
        <mesh ref={dome} geometry={domeGeometry} position={[0, 0.86, 0]}>
          <Material preset="steel" color="#d5d7da" roughness={0.18} />
        </mesh>
        <Anchor name="domo" position={[d.dome * 0.3, 1.2, d.dome * 0.2]} />
      </Explode>

      {/* Steel cover. */}
      <Explode offset={[0, 10, 0]} delay={0.1}>
        <mesh geometry={cover}>
          <Material
            preset="steel"
            color="#c9cbce"
            roughness={0.3}
            roughnessMap={noise}
            clip
            cutColor="#6d6f72"
          />
        </mesh>
        <Anchor name="capa" position={[B * 0.3, plateTop, B * 0.35]} />
      </Explode>

      {/* Plunger (and cap). */}
      <Explode offset={[0, d.square ? 16 : 14, 0]} delay={0.3}>
        <group ref={moving}>
          <mesh geometry={plunger}>
            <Material preset="absBlack" roughness={0.45} clip cutColor="#0b0b0c" />
          </mesh>
          {d.square && (
            <Explode offset={[0, 9, 0]} delay={0.4}>
              <mesh geometry={capGeometry}>
                <Material
                  color={cap.color}
                  roughness={0.38}
                  roughnessMap={noise}
                  clearcoat={0.2}
                  clip
                />
              </mesh>
            </Explode>
          )}
          <Anchor
            name="botao"
            position={[0, d.square ? plateTop + CAP.gap + CAP.h : d.plungerTop, 0]}
          />
        </group>
      </Explode>
    </group>
  );
}
