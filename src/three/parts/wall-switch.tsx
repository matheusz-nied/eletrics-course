/**
 * Wall light switch in a Brazilian 4 × 2" plate (73 × 116 mm, NBR 5410
 * installation box) with one horizontal rocker module (key 44 × 22,6 mm,
 * module body 45 × 23 × 27 mm), the support frame with the box screws
 * (83,5 mm apart) and the screw terminals on the back. Dimensions from
 * typical catalogues of Brazilian 4 × 2 lines, the same as the doorbell
 * plate of `wall-push-button`.
 * - `simples` (one-way): two terminals, a bridge closes them.
 * - `paralelo` (three-way, "three-way" in English): terminals C (common), 1
 *   and 2; a blade links C to 1 or to 2.
 * - `intermediario` (four-way): terminals 1 and 2 (from one three-way
 *   switch) and 3 and 4 (to the other); two bridges link them straight
 *   (1–3, 2–4) or crossed (1–4, 2–3).
 * Terminal markings vary between manufacturers; these are the usual ones.
 * Faces +Z; the key rocks and the contacts follow it smoothly.
 */
import { useRef } from 'react';
import { Shape, type Group } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import {
  addRoundedRect,
  extrudeAlongZ,
  screwHeadGeometry,
  shellGeometry,
  threadedRodGeometry,
} from './_em-geometry';
import { Decal, useSmooth } from './_em-kit';
import {
  BOX_SCREW_Y,
  MODULE_4X2,
  PLATE,
  supportFrameGeometry,
  wallPlateGeometry,
} from './_house-plate';

type Kind = 'simples' | 'paralelo' | 'intermediario';

export interface WallSwitchProps {
  kind?: Kind;
  /** Key in the "on" position (top half pressed in). */
  on?: boolean;
}

const KIND_LABELS: Record<Kind, string> = {
  simples: 'Simples',
  paralelo: 'Paralelo (three-way)',
  intermediario: 'Intermediário (four-way)',
};

/** Rocker key: size, front and back faces, pivot depth and tilt. */
const KEY = { W: 44.2, H: 22.6, front: 8.3, back: 4.6, pivot: 4.2, tilt: 0.055 };
/** Module body behind the key. */
const MODULE = { W: MODULE_4X2.W, H: MODULE_4X2.H, front: 3.3, back: -24, wall: 1.2 };
/** Contact level (fixed silver contacts face +Z here). */
const CONTACT_Z = -6;

interface Terminal {
  id: string;
  label: string;
  x: number;
  y: number;
}

const TERMINALS: Record<Kind, Terminal[]> = {
  simples: [
    { id: 'a', label: '', x: -11, y: 0 },
    { id: 'b', label: '', x: 11, y: 0 },
  ],
  paralelo: [
    { id: 'c', label: 'C', x: -12, y: 0 },
    { id: '1', label: '1', x: 12, y: 5.4 },
    { id: '2', label: '2', x: 12, y: -5.4 },
  ],
  intermediario: [
    { id: '1', label: '1', x: -12, y: 5.4 },
    { id: '2', label: '2', x: -12, y: -5.4 },
    { id: '3', label: '3', x: 12, y: 5.4 },
    { id: '4', label: '4', x: 12, y: -5.4 },
  ],
};

export const meta: PartMeta = {
  id: 'wall-switch',
  label: 'Interruptor de parede',
  category: 'eletromecanicos',
  summary:
    'Interruptor de luz em placa 4 × 2 (simples, paralelo ou intermediário), com o suporte, o módulo, os contatos e os bornes por trás.',
  defaults: { kind: 'simples', on: false },
  controls: {
    kind: {
      kind: 'select',
      label: 'Tipo',
      options: (Object.keys(KIND_LABELS) as Kind[]).map((k) => ({
        value: k,
        label: KIND_LABELS[k],
      })),
    },
    on: { kind: 'toggle', label: 'Tecla na posição ligada' },
  },
  annotations: (p): PartAnnotation[] => {
    const kind = kindOf(p.kind);
    const notes: PartAnnotation[] = [
      {
        at: [KEY.W / 2 - 6, PLATE.H / 2 + 6, KEY.front],
        text: 'Tecla: muda a posição do contato',
        exploded: false,
      },
      { at: [PLATE.W / 2 - 4, PLATE.H - 8, PLATE.D], text: 'Placa 4 × 2', exploded: false },
      {
        at: [0, 0, 0],
        anchor: 'suporte',
        text: 'Suporte: parafusos da caixa 4 × 2 (83,5 mm)',
        exploded: true,
      },
      { at: [0, 0, 0], anchor: 'modulo', text: 'Módulo do interruptor', exploded: true },
    ];
    if (kind === 'simples') {
      notes.push(
        { at: [0, 0, 0], anchor: 'borne-a', text: 'Borne: chega a fase', exploded: true },
        {
          at: [0, 0, 0],
          anchor: 'borne-b',
          text: 'Borne: sai o retorno para a lâmpada',
          exploded: true,
        },
        {
          at: [0, 0, 0],
          anchor: 'contato',
          text: 'Ponte: fecha o contato com a tecla ligada',
          exploded: true,
        },
      );
    } else if (kind === 'paralelo') {
      notes.push(
        {
          at: [0, 0, 0],
          anchor: 'borne-c',
          text: 'Borne C (comum): fase ou retorno da lâmpada',
          exploded: true,
        },
        {
          at: [0, 0, 0],
          anchor: 'borne-1',
          text: 'Bornes 1 e 2: fios para o outro paralelo',
          exploded: true,
        },
        {
          at: [0, 0, 0],
          anchor: 'contato',
          text: 'Lâmina: liga o C ao 1 ou ao 2',
          exploded: true,
        },
      );
    } else {
      notes.push(
        {
          at: [0, 0, 0],
          anchor: 'borne-1',
          text: 'Bornes 1 e 2: vêm de um paralelo',
          exploded: true,
        },
        {
          at: [0, 0, 0],
          anchor: 'borne-3',
          text: 'Bornes 3 e 4: vão para o outro paralelo',
          exploded: true,
        },
        {
          at: [0, 0, 0],
          anchor: 'contato',
          text: 'Pontes: ligam reto (1–3 e 2–4) ou cruzado (1–4 e 2–3)',
          exploded: true,
        },
      );
    }
    return notes;
  },
  explode: true,
  describe: (p) => {
    const kind = kindOf(p.kind);
    const on = !!p.on;
    if (kind === 'paralelo')
      return `Interruptor paralelo (three-way) em placa 4 × 2, com os bornes C (comum), 1 e 2 atrás. ${on ? 'Tecla ligada: o C está ligado ao 1.' : 'Tecla desligada: o C está ligado ao 2.'} Dois paralelos comandam a mesma lâmpada de dois lugares.`;
    if (kind === 'intermediario')
      return `Interruptor intermediário (four-way) em placa 4 × 2, com quatro bornes atrás: 1 e 2 vêm de um paralelo, 3 e 4 vão para o outro. ${on ? 'Tecla ligada: as pontes ligam reto (1–3 e 2–4).' : 'Tecla desligada: as pontes ligam cruzado (1–4 e 2–3).'} Entre dois paralelos, comanda a lâmpada de um terceiro lugar.`;
    return `Interruptor simples em placa 4 × 2, com dois bornes atrás: um recebe a fase e o outro manda o retorno para a lâmpada. ${on ? 'Tecla ligada: o contato está fechado.' : 'Tecla desligada: o contato está aberto.'}`;
  },
  view: [1.25, 0.5, 1],
};

function kindOf(v: unknown): Kind {
  return v === 'paralelo' || v === 'intermediario' ? v : 'simples';
}

const BRASS = { preset: 'brass' as const, roughness: 0.32 };
const SILVER = { color: '#dcdad4', metalness: 1, roughness: 0.25 };

/** A flat bar from (x0, y0) to (x1, y1) at depth z (width w, thickness t). */
function Bar({
  from,
  to,
  z,
  w = 2.6,
  t = 0.7,
  material = { preset: 'copper' as const, roughness: 0.3 },
}: {
  from: [number, number];
  to: [number, number];
  z: number;
  w?: number;
  t?: number;
  material?: Parameters<typeof Material>[0];
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) + w;
  return (
    <mesh
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
    >
      <boxGeometry args={[length, w, t]} />
      <Material {...material} />
    </mesh>
  );
}

/** Silver contact button facing +Z (or −Z) at (x, y, z). */
function Stud({ x, y, z, back = false }: { x: number; y: number; z: number; back?: boolean }) {
  return (
    <mesh position={[x, y, z]} rotation={[back ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[1, 1.1, 0.5, 18]} />
      <Material {...SILVER} />
    </mesh>
  );
}

export default function WallSwitch(props: WallSwitchProps) {
  const p = { ...meta.defaults, ...props } as Required<WallSwitchProps>;
  const kind = kindOf(p.kind);
  const terminals = TERMINALS[kind];
  const noise = getNoiseTexture();
  const key = useRef<Group>(null);
  const bridge = useRef<Group>(null);
  const blade = useRef<Group>(null);
  const straight = useRef<Group>(null);
  const crossed = useRef<Group>(null);
  const cy = PLATE.H / 2;

  // Simple switch: the bridge closes 1,2 mm onto the fixed contacts.
  const gap = 1.2;
  const bladeAngle = Math.atan2(5.4, 22);
  useSmooth(
    [p.on ? 1 : 0],
    ([v]) => {
      const s = v! * 2 - 1;
      if (key.current) key.current.rotation.x = -KEY.tilt * s;
      if (bridge.current) bridge.current.position.z = gap * (1 - v!);
      if (blade.current) blade.current.rotation.z = bladeAngle * s;
      if (straight.current) straight.current.visible = v! >= 0.5;
      if (crossed.current) crossed.current.visible = v! < 0.5;
    },
    16,
  );

  const plate = useDisposable(() => wallPlateGeometry(KEY.W + 0.8, KEY.H + 0.8), []);
  const frame = useDisposable(() => supportFrameGeometry(), []);
  const keyGeometry = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, KEY.W, KEY.H, 1.3);
    const g = extrudeAlongZ(s, KEY.front - KEY.back, 0.9, { curveSegments: 6, bevelSegments: 3 });
    g.translate(0, 0, (KEY.front + KEY.back) / 2 - KEY.pivot);
    return g;
  }, []);
  const moduleShell = useDisposable(() => {
    const g = shellGeometry(
      MODULE.W,
      MODULE.front - MODULE.back,
      MODULE.H,
      1.2,
      0.6,
      MODULE.wall,
      MODULE.wall,
    );
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, MODULE.front);
    return g;
  }, []);
  const moduleFront = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, MODULE.W - 2 * MODULE.wall + 0.1, MODULE.H - 2 * MODULE.wall + 0.1, 0.6);
    const g = extrudeAlongZ(s, MODULE.wall, 0, { curveSegments: 4 });
    g.translate(0, 0, MODULE.front - MODULE.wall / 2);
    return g;
  }, []);
  const screwHead = useDisposable(
    () => screwHeadGeometry(2.6, 1.8, 'combinada', { slot: 0.8 }),
    [],
  );
  const boxScrew = useDisposable(() => screwHeadGeometry(3.4, 1.6, 'fenda', { slot: 0.9 }), []);
  const boxScrewShank = useDisposable(() => {
    const g = threadedRodGeometry(3.5, 0.6, 20, 10);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 2.8);
    return g;
  }, []);

  // Terminal markings moulded on the back of the module, plus the rating.
  const marks = terminals.map((t) => `${t.label}@${t.x},${t.y}`).join('|');
  const backLabel = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#4d4d4a';
      const px = w / MODULE.W;
      for (const t of terminals) {
        if (!t.label) continue;
        // Seen from behind: x is mirrored on the back face.
        const x = w / 2 - (t.x + (t.x < 0 ? 6.4 : -6.4)) * px;
        fitText(ctx, t.label, x, h / 2 - t.y * px, 5 * px, 5 * px, { weight: 800 });
      }
      fitText(ctx, '10 A 250 V~', w / 2, h * 0.9, w * 0.4, 2.2 * px, { weight: 600 });
    },
    `back|${marks}`,
    {
      width: 512,
      height: Math.round((512 * MODULE.H) / MODULE.W),
      fonts: [`800 40px ${FONT_SANS}`],
    },
  );

  const plateColor = '#f1f0eb';
  const anchorOf = (t: Terminal): Vec3 => [t.x, t.y + 3.6, MODULE.back - 1.6];

  return (
    <group position={[0, cy, 0]}>
      {/* Plate. */}
      <Explode offset={[0, 0, 64]} delay={0.1}>
        <mesh geometry={plate}>
          <Material color={plateColor} roughness={0.3} roughnessMap={noise} clearcoat={0.3} />
        </mesh>
      </Explode>

      {/* Rocker key. */}
      <Explode offset={[0, 0, 96]} delay={0.2}>
        <group ref={key} position={[0, 0, KEY.pivot]}>
          <mesh geometry={keyGeometry}>
            <Material color={plateColor} roughness={0.26} roughnessMap={noise} clearcoat={0.4} />
          </mesh>
          {/* Small ridge that shows which half is pressed. */}
          <mesh position={[0, KEY.H / 2 - 3.2, KEY.front - KEY.pivot + 0.05]}>
            <boxGeometry args={[12, 0.8, 0.3]} />
            <Material color="#d9d8d2" roughness={0.4} />
          </mesh>
        </group>
      </Explode>

      {/* Support frame and the box screws. */}
      <Explode offset={[0, 0, 34]}>
        <mesh geometry={frame}>
          <Material preset="absDark" roughness={0.55} />
        </mesh>
        {[-BOX_SCREW_Y, BOX_SCREW_Y].map((y) => (
          <group key={y} position={[0, y, 0]}>
            <mesh geometry={boxScrew} position={[0, 0, 2.8]} rotation={[Math.PI / 2, 0.3, 0]}>
              <Material preset="zinc" roughness={0.35} />
            </mesh>
            <mesh geometry={boxScrewShank}>
              <Material preset="zinc" roughness={0.4} />
            </mesh>
          </group>
        ))}
        <Anchor name="suporte" position={[-3.4, BOX_SCREW_Y, 4]} />
      </Explode>

      {/* Module housing: moves back and leaves the contacts and terminals. */}
      <Explode offset={[0, 0, -58]} delay={0.1}>
        <mesh geometry={moduleShell}>
          <Material preset="absWhite" roughness={0.5} roughnessMap={noise} />
        </mesh>
        <mesh geometry={moduleFront}>
          <Material preset="absWhite" roughness={0.5} />
        </mesh>
        <Decal
          map={backLabel}
          width={MODULE.W - 2}
          height={MODULE.H - 2}
          position={[0, 0, MODULE.back - 0.02]}
          rotation={[0, Math.PI, 0]}
        />
        {terminals.map((t) => (
          <mesh
            key={t.id}
            position={[t.x + (t.x < 0 ? -4.6 : 4.6), t.y, MODULE.back - 0.02]}
            rotation={[0, Math.PI, 0]}
          >
            <planeGeometry args={[3, 3.4]} />
            <Material color="#141414" roughness={0.9} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (MODULE.W / 2 + 0.35), 0, 0.2]}>
            <boxGeometry args={[0.7, 7, 2.2]} />
            <Material preset="absWhite" roughness={0.5} />
          </mesh>
        ))}
        <Anchor name="modulo" position={[MODULE.W / 2, MODULE.H / 2, -12]} />
      </Explode>

      {/* Terminals: brass plate, screw and strip to the fixed contact. */}
      {terminals.map((t) => (
        <group key={t.id}>
          <mesh position={[t.x, t.y, MODULE.back - 0.35]}>
            <boxGeometry args={[6.4, kind === 'simples' ? 6.4 : 5.2, 0.7]} />
            <Material {...BRASS} />
          </mesh>
          <mesh
            geometry={screwHead}
            position={[t.x, t.y, MODULE.back - 0.7]}
            rotation={[-Math.PI / 2, 0.5, 0]}
            scale={kind === 'simples' ? 1 : 0.85}
          >
            <Material preset="brass" color="#e0c27f" roughness={0.28} />
          </mesh>
          <mesh position={[t.x, t.y, (MODULE.back + CONTACT_Z - 0.6) / 2]}>
            <boxGeometry args={[0.6, 2.6, CONTACT_Z - 0.6 - MODULE.back]} />
            <Material {...BRASS} />
          </mesh>
          <Anchor name={`borne-${t.id}`} position={anchorOf(t)} />
        </group>
      ))}

      {kind === 'simples' && (
        <>
          {terminals.map((t) => (
            <group key={t.id}>
              <Bar from={[t.x, t.y]} to={[t.x * 0.75, t.y]} z={CONTACT_Z - 0.6} material={BRASS} />
              <Stud x={t.x * 0.75} y={t.y} z={CONTACT_Z - 0.05} />
            </group>
          ))}
          <group ref={bridge}>
            <Bar from={[-8.25, 0]} to={[8.25, 0]} z={CONTACT_Z + 0.95} w={3.2} />
            {[-8.25, 8.25].map((x) => (
              <Stud key={x} x={x} y={0} z={CONTACT_Z + 0.45} back />
            ))}
            {/* Plunger from the key. */}
            <mesh position={[0, 0, (CONTACT_Z + 1.3 + KEY.back - 0.3) / 2]}>
              <boxGeometry args={[5, 5, KEY.back - 0.3 - CONTACT_Z - 1.3]} />
              <Material preset="absWhite" color="#e7e4dc" roughness={0.5} />
            </mesh>
            <Anchor name="contato" position={[-4, 1.6, CONTACT_Z + 1]} />
          </group>
        </>
      )}

      {kind === 'paralelo' && (
        <>
          {terminals
            .filter((t) => t.id !== 'c')
            .map((t) => (
              <group key={t.id}>
                <Stud x={t.x - 2} y={t.y} z={CONTACT_Z - 0.05} />
                <Bar from={[t.x, t.y]} to={[t.x - 2, t.y]} z={CONTACT_Z - 0.6} material={BRASS} />
              </group>
            ))}
          {/* Pivot post on the common terminal and the blade. */}
          <mesh position={[-12, 0, CONTACT_Z + 0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.4, 1.4, 2.2, 18]} />
            <Material {...BRASS} />
          </mesh>
          <group ref={blade} position={[-12, 0, CONTACT_Z + 0.95]}>
            <mesh position={[11.5, 0, 0]}>
              <boxGeometry args={[23, 2.8, 0.6]} />
              <Material preset="copper" roughness={0.3} />
            </mesh>
            <Stud x={22} y={0} z={-0.5} back />
            <Anchor name="contato" position={[14, 1.6, 0.4]} />
          </group>
          {/* Cam that the key turns. */}
          <mesh position={[0, 0, (CONTACT_Z + 1.4 + KEY.back - 0.3) / 2]}>
            <boxGeometry args={[4, 6, KEY.back - 0.3 - CONTACT_Z - 1.4]} />
            <Material preset="absWhite" color="#e7e4dc" roughness={0.5} />
          </mesh>
        </>
      )}

      {kind === 'intermediario' && (
        <>
          {terminals.map((t) => (
            <group key={t.id}>
              <Stud x={t.x * 0.8} y={t.y} z={CONTACT_Z - 0.05} />
              <Bar from={[t.x, t.y]} to={[t.x * 0.8, t.y]} z={CONTACT_Z - 0.6} material={BRASS} />
            </group>
          ))}
          <group ref={straight}>
            {[5.4, -5.4].map((y) => (
              <Bar key={y} from={[-9.6, y]} to={[9.6, y]} z={CONTACT_Z + 0.6} w={2.4} t={0.6} />
            ))}
          </group>
          <group ref={crossed}>
            <Bar from={[-9.6, 5.4]} to={[9.6, -5.4]} z={CONTACT_Z + 0.6} w={2.2} t={0.6} />
            <Bar from={[-9.6, -5.4]} to={[9.6, 5.4]} z={CONTACT_Z + 1.4} w={2.2} t={0.6} />
          </group>
          <Anchor name="contato" position={[0, 7.6, CONTACT_Z + 1]} />
          {/* Carrier that the key moves. */}
          <mesh position={[0, 0, (CONTACT_Z + 1.8 + KEY.back - 0.3) / 2]}>
            <boxGeometry args={[4, 4, KEY.back - 0.3 - CONTACT_Z - 1.8]} />
            <Material preset="absWhite" color="#e7e4dc" roughness={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}
