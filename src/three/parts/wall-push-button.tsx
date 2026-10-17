/**
 * Push buttons that close a contact only while pressed (normally open):
 * - `campainha`: Brazilian 4 × 2" wall plate (73 × 116 mm, NBR 5410
 *   installation box) with one horizontal doorbell key (bell symbol), the
 *   support frame with the box screws (83,5 mm apart) and the module behind
 *   it: contact block, return spring and two screw terminals on the back.
 *   Dimensions from typical catalogues of Brazilian 4 × 2 lines.
 * - `pulsador-industrial`: 22 mm panel push button (IEC 60947-5-1): flush
 *   coloured button in a metal bezel (Ø 29,7 mm), ring nut, fixing collar and
 *   snap-on contact blocks (NA 13–14 green marker, NF 11–12 red marker) with
 *   screw terminals. Dimensions from typical 22 mm series catalogues.
 * Pressing moves the key (or button) and the moving contact smoothly.
 */
import { useRef } from 'react';
import { Path, Shape, ShapeGeometry, type BufferGeometry, type Group } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta } from '../types';
import {
  addRoundedRect,
  extrudeAlongZ,
  HelixCurve,
  mergeAll,
  roundedBox,
  roundedRectSweep,
  screwHeadGeometry,
  threadedRodGeometry,
} from './_em-geometry';
import { Decal, useSmooth } from './_em-kit';

type Variant = 'campainha' | 'pulsador-industrial';
type PlateColor = 'branco' | 'preto' | 'cinza' | 'bege';
type CapColor = 'verde' | 'vermelho' | 'preto' | 'amarelo' | 'azul';
type Contacts = 'na' | 'nf' | 'na-nf';

export interface WallPushButtonProps {
  variant?: Variant;
  pressed?: boolean;
  /** Colour of the wall plate and key (campainha). */
  plateColor?: PlateColor;
  /** Colour of the industrial button. */
  capColor?: CapColor;
  /** Contact blocks of the industrial button. */
  contacts?: Contacts;
}

const PLATE_COLORS: Record<PlateColor, { color: string; cut: string; label: string }> = {
  branco: { color: '#f1f0eb', cut: '#cfcdc6', label: 'branca' },
  preto: { color: '#1e1e20', cut: '#0e0e0f', label: 'preta' },
  cinza: { color: '#4a4d52', cut: '#2f3135', label: 'cinza-grafite' },
  bege: { color: '#e3d8c2', cut: '#bcae94', label: 'bege' },
};

const CAP_COLORS: Record<CapColor, { color: string; label: string }> = {
  verde: { color: '#1f9447', label: 'verde' },
  vermelho: { color: '#c8231b', label: 'vermelho' },
  preto: { color: '#1c1c1e', label: 'preto' },
  amarelo: { color: '#f2c01a', label: 'amarelo' },
  azul: { color: '#1f56c6', label: 'azul' },
};

/** Wall plate (mm): width, height, skirt depth, front thickness. */
const P = { W: 73, H: 116, D: 7, T: 2.2, r: 5, f: 2.4, wall: 1.6 };
const KEY = { W: 44.2, H: 22.6, travel: 1.5 };
const MODULE = { W: 44, H: 22.4, front: 3.6, back: -24 };

/** Industrial button (mm). */
const B = { panel: 60, bezelR: 14.85, capR: 11.6, travel: 4, bodyR: 11, block: 9.8 };

export const meta: PartMeta = {
  id: 'wall-push-button',
  label: 'Botoeira (campainha) e botão de painel',
  category: 'eletromecanicos',
  summary:
    'Botão de campainha em placa 4 × 2 e botão pulsador industrial de 22 mm, com os bornes e o bloco de contato por trás.',
  defaults: {
    variant: 'campainha',
    pressed: false,
    plateColor: 'branco',
    capColor: 'verde',
    contacts: 'na',
  },
  controls: {
    variant: {
      kind: 'select',
      label: 'Modelo',
      options: [
        { value: 'campainha', label: 'Campainha (placa 4 × 2)' },
        { value: 'pulsador-industrial', label: 'Pulsador industrial 22 mm' },
      ],
    },
    pressed: { kind: 'toggle', label: 'Apertado' },
    plateColor: {
      kind: 'select',
      label: 'Cor da placa',
      options: (Object.keys(PLATE_COLORS) as PlateColor[]).map((c) => ({
        value: c,
        label: PLATE_COLORS[c].label[0]!.toUpperCase() + PLATE_COLORS[c].label.slice(1),
      })),
    },
    capColor: {
      kind: 'select',
      label: 'Cor do botão (industrial)',
      options: (Object.keys(CAP_COLORS) as CapColor[]).map((c) => ({
        value: c,
        label: CAP_COLORS[c].label[0]!.toUpperCase() + CAP_COLORS[c].label.slice(1),
      })),
    },
    contacts: {
      kind: 'select',
      label: 'Blocos de contato (industrial)',
      options: [
        { value: 'na', label: '1 NA (13–14)' },
        { value: 'nf', label: '1 NF (11–12)' },
        { value: 'na-nf', label: '1 NA + 1 NF' },
      ],
    },
  },
  annotations: (p): PartAnnotation[] => {
    if (p.variant === 'pulsador-industrial') {
      return [
        {
          at: [0, 30, 4],
          text: 'Botão: só fecha (ou abre) enquanto está apertado',
          exploded: false,
        },
        { at: [B.bezelR, 30 + B.bezelR * 0.6, 2], text: 'Aro de 22 mm: furo padrão no painel' },
        { at: [0, 0, 0], text: 'Bloco de contato: NA (verde) ou NF (vermelho)', anchor: 'bloco' },
        { at: [0, 0, 0], text: 'Bornes de parafuso (13–14 ou 11–12)', anchor: 'bornes' },
        { at: [0, 0, 0], text: 'Ponte de contato móvel', anchor: 'ponte', exploded: true },
      ];
    }
    return [
      {
        at: [0, P.H / 2, P.D + 1.4],
        text: 'Tecla de campainha: contato NA (pulsador)',
        exploded: false,
      },
      { at: [P.W / 2 - 4, P.H - 8, P.D], text: 'Placa 4 × 2', exploded: false },
      {
        at: [0, 0, 0],
        text: 'Parafusos da caixa 4 × 2 (83,5 mm)',
        anchor: 'suporte',
        exploded: true,
      },
      { at: [0, 0, 0], text: 'Bornes de parafuso atrás do módulo', anchor: 'bornes' },
      {
        at: [0, 0, 0],
        text: 'Bloco de contato: a ponte encosta nos dois contatos',
        anchor: 'ponte',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Mola: devolve a tecla e abre o contato',
        anchor: 'mola',
        exploded: true,
      },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const pressed = !!p.pressed;
    if (p.variant === 'pulsador-industrial') {
      const cap = CAP_COLORS[capOf(p.capColor)].label;
      const c = contactsOf(p.contacts);
      const blocks =
        c === 'na-nf'
          ? 'um bloco NA (13–14) e um NF (11–12)'
          : c === 'nf'
            ? 'um bloco NF (11–12)'
            : 'um bloco NA (13–14)';
      return `Botão pulsador industrial de 22 mm, ${cap}, com ${blocks}. ${pressed ? 'Apertado: o NA fecha e o NF abre.' : 'Solto: o NA está aberto e o NF, fechado.'}`;
    }
    const color = PLATE_COLORS[plateOf(p.plateColor)].label;
    return `Botão de campainha em placa 4 × 2 ${color}, com contato normalmente aberto e dois bornes de parafuso atrás. ${pressed ? 'Apertado: o contato fecha e a campainha toca.' : 'Solto: o contato está aberto.'}`;
  },
  view: [0.75, 0.45, 1.35],
};

function plateOf(v: unknown): PlateColor {
  return typeof v === 'string' && v in PLATE_COLORS ? (v as PlateColor) : 'branco';
}
function capOf(v: unknown): CapColor {
  return typeof v === 'string' && v in CAP_COLORS ? (v as CapColor) : 'verde';
}
function contactsOf(v: unknown): Contacts {
  return v === 'nf' || v === 'na-nf' ? v : 'na';
}

export default function WallPushButton(props: WallPushButtonProps) {
  const p = { ...meta.defaults, ...props } as Required<WallPushButtonProps>;
  if (p.variant === 'pulsador-industrial')
    return (
      <IndustrialButton
        pressed={!!p.pressed}
        cap={CAP_COLORS[capOf(p.capColor)].color}
        contacts={contactsOf(p.contacts)}
      />
    );
  return <DoorbellPlate pressed={!!p.pressed} color={plateOf(p.plateColor)} />;
}

/** Flat face with holes, at height y, facing up or down (for shells built along +Y). */
function faceWithHoles(outer: Shape, y: number, up: boolean): BufferGeometry {
  const g = new ShapeGeometry(outer, 8);
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/**
 * The plate as a thin shell: skirt with a rounded front edge and a front
 * panel with the key opening. Built facing +Y, then turned to face +Z.
 */
function plateGeometry(): BufferGeometry {
  const { W, H, D, T, r, f, wall } = P;
  const outer: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 2) * (i / 6);
    outer.push([-f + Math.cos(a) * f, D - f + Math.sin(a) * f]);
  }
  const hole = (path: Path | Shape, clockwise: boolean) =>
    addRoundedRect(path, KEY.W + 0.8, KEY.H + 0.8, 1.4, 0, 0, clockwise);
  const front = new Shape();
  addRoundedRect(front, W - 2 * f, H - 2 * f, r - f);
  const h1 = new Path();
  hole(h1, true);
  front.holes.push(h1);
  const back = new Shape();
  addRoundedRect(back, W - 2 * wall, H - 2 * wall, r - wall);
  const h2 = new Path();
  hole(h2, true);
  back.holes.push(h2);
  // Walls of the key opening (rounded-rect sweep facing the hole).
  const opening = roundedRectSweep(KEY.W + 0.8, KEY.H + 0.8, 1.4, [
    [0, D],
    [0, D - T],
  ]);
  const parts = [
    roundedRectSweep(W, H, r, outer),
    faceWithHoles(front, D, true),
    opening,
    faceWithHoles(back, D - T, false),
    roundedRectSweep(W, H, r, [
      [-wall, D - T],
      [-wall, 0],
    ]),
    roundedRectSweep(W, H, r, [
      [-wall, 0],
      [0, 0],
    ]),
  ];
  const g = mergeAll(parts);
  g.rotateX(Math.PI / 2);
  return g;
}

function DoorbellPlate({ pressed, color }: { pressed: boolean; color: PlateColor }) {
  const key = useRef<Group>(null);
  const bridge = useRef<Group>(null);
  const spring = useRef<Group>(null);
  const noise = getNoiseTexture();
  const c = PLATE_COLORS[color];
  const dark = color === 'preto' || color === 'cinza';
  const cy = P.H / 2;

  useSmooth(
    [pressed ? 1 : 0],
    ([v]) => {
      const dz = -KEY.travel * v!;
      if (key.current) key.current.position.z = dz;
      if (bridge.current) bridge.current.position.z = dz;
      if (spring.current) spring.current.scale.z = 1 + (dz / 9) * 1;
    },
    18,
  );

  const plate = useDisposable(() => plateGeometry(), []);
  const keyGeometry = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, KEY.W, KEY.H, 1.3);
    const g = extrudeAlongZ(s, 5, 0.9, { curveSegments: 6, bevelSegments: 3 });
    g.translate(0, 0, P.D + 1.3 - 2.5);
    return g;
  }, []);

  const frame = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, 66, 108, 3);
    const window = new Path();
    addRoundedRect(window, MODULE.W + 1, MODULE.H + 1, 1, 0, 0, true);
    s.holes.push(window);
    for (const y of [-41.75, 41.75]) {
      const slot = new Path();
      addRoundedRect(slot, 7.5, 3.8, 1.85, 0, y, true);
      s.holes.push(slot);
    }
    const g = extrudeAlongZ(s, 1.6, 0.3, { curveSegments: 6 });
    g.translate(0, 0, 1.2);
    return g;
  }, []);

  const moduleBody = useDisposable(() => {
    const g = roundedBox(MODULE.W, MODULE.front - MODULE.back, MODULE.H, 1.2, 0.5);
    // Built along +Y; turn so it runs along −Z from the front.
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, MODULE.front);
    return g;
  }, []);

  const screwHead = useDisposable(
    () => screwHeadGeometry(2.6, 1.8, 'combinada', { slot: 0.8 }),
    [],
  );
  const boxScrew = useDisposable(() => screwHeadGeometry(3.4, 1.6, 'fenda', { slot: 0.9 }), []);
  const springGeometry = useDisposable(
    () => tube(new HelixCurve(2, 9, 6, 0.4), 0.25, { radial: 8, segments: 200 }),
    [],
  );

  const bell = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dark ? '#d9d9d6' : '#9a9a97';
      const cx = w / 2;
      const top = h * 0.2;
      const bottom = h * 0.68;
      const half = h * 0.26;
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.18, top);
      ctx.quadraticCurveTo(cx - half * 0.85, top + h * 0.05, cx - half * 0.8, bottom - h * 0.12);
      ctx.lineTo(cx - half * 1.1, bottom);
      ctx.lineTo(cx + half * 1.1, bottom);
      ctx.lineTo(cx + half * 0.8, bottom - h * 0.12);
      ctx.quadraticCurveTo(cx + half * 0.85, top + h * 0.05, cx + half * 0.18, top);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, top - h * 0.02, h * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, bottom + h * 0.07, h * 0.075, 0, Math.PI);
      ctx.fill();
    },
    `bell|${dark}`,
    { width: 256, height: 256 },
  );

  const rating = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#5b5b58';
      fitText(ctx, '10A 250V~', w / 2, h * 0.3, w * 0.9, h * 0.36, {
        weight: 700,
        family: FONT_SANS,
      });
      fitText(ctx, 'PULSADOR', w / 2, h * 0.72, w * 0.9, h * 0.3, {
        weight: 600,
        family: FONT_SANS,
      });
    },
    'rating',
    { width: 512, height: 128, fonts: [`700 40px ${FONT_SANS}`] },
  );

  const brass = { preset: 'brass' as const, roughness: 0.32 };
  const silver = { color: '#dcdad4', metalness: 1, roughness: 0.25 };
  const contactZ = -6;

  return (
    <group>
      {/* Plate. */}
      <Explode offset={[0, 0, 24]} delay={0.1}>
        <group position={[0, cy, 0]}>
          <mesh geometry={plate}>
            <Material
              color={c.color}
              roughness={0.3}
              roughnessMap={noise}
              clearcoat={0.3}
              clip
              cutColor={c.cut}
            />
          </mesh>
        </group>
      </Explode>

      {/* Key with the bell symbol. */}
      <Explode offset={[0, 0, 44]} delay={0.2}>
        <group position={[0, cy, 0]}>
          <group ref={key}>
            <mesh geometry={keyGeometry}>
              <Material
                color={c.color}
                roughness={0.28}
                roughnessMap={noise}
                clearcoat={0.35}
                clip
                cutColor={c.cut}
              />
            </mesh>
            <Decal
              map={bell}
              width={11}
              height={11}
              position={[0, 0, P.D + 1.3 + 0.012]}
              roughness={0.4}
              clip
            />
          </group>
        </group>
      </Explode>

      {/* Support frame and the box screws. */}
      <Explode offset={[0, 0, 10]}>
        <group position={[0, cy, 0]}>
          <mesh geometry={frame}>
            <Material preset="absDark" roughness={0.55} />
          </mesh>
          {[-41.75, 41.75].map((y) => (
            <mesh
              key={y}
              geometry={boxScrew}
              position={[0, y, 2.8]}
              rotation={[Math.PI / 2, 0, 0.3]}
            >
              <Material preset="zinc" roughness={0.35} />
            </mesh>
          ))}
          <Anchor name="suporte" position={[3.4, 41.75, 4]} />
        </group>
      </Explode>

      {/* Module housing with the terminals on the back. */}
      <Explode offset={[0, 0, -30]}>
        <group position={[0, cy, 0]}>
          <mesh geometry={moduleBody}>
            <Material
              preset="absWhite"
              roughness={0.5}
              roughnessMap={noise}
              clip
              cutColor="#c9c6bd"
            />
          </mesh>
          <Decal
            map={rating}
            width={20}
            height={5}
            position={[0, MODULE.H / 2 + 0.012, -14]}
            rotation={[-Math.PI / 2, 0, 0]}
            clip
          />
          {[-11, 11].map((x) => (
            <group key={x} position={[x, 0, MODULE.back]}>
              <mesh position={[0, 0, -0.35]}>
                <boxGeometry args={[6.4, 6.4, 0.7]} />
                <Material {...brass} />
              </mesh>
              <mesh geometry={screwHead} position={[0, 0, -0.7]} rotation={[-Math.PI / 2, 0, 0.5]}>
                <Material preset="brass" color="#e0c27f" roughness={0.28} />
              </mesh>
              {/* Fixed contact strip from the terminal to the front. */}
              <mesh position={[x > 0 ? -2.5 : 2.5, 0, (MODULE.back + contactZ) / 2]}>
                <boxGeometry args={[5, 3, 0.6]} />
                <Material {...brass} />
              </mesh>
            </group>
          ))}
          <Anchor name="bornes" position={[11, 3.2, MODULE.back - 1]} />
        </group>
      </Explode>

      {/* Contact block: fixed contacts, moving bridge and return spring. */}
      <group position={[0, cy, 0]}>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 8.5, 0, contactZ]}>
              <boxGeometry args={[5, 3, 0.6]} />
              <Material {...brass} />
            </mesh>
            <mesh position={[side * 8.5, 0, contactZ + 0.55]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[1, 1.1, 0.5, 20]} />
              <Material {...silver} />
            </mesh>
            <mesh
              position={[side * 9.5, 0, (MODULE.back + contactZ) / 2]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <boxGeometry args={[MODULE.back * -1 + contactZ, 3, 0.6]} />
              <Material {...brass} />
            </mesh>
          </group>
        ))}
        <group ref={bridge}>
          <mesh position={[0, 0, contactZ + 2.4]}>
            <boxGeometry args={[22, 3.4, 0.7]} />
            <Material preset="copper" roughness={0.3} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 8.5, 0, contactZ + 1.8]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[1, 1.1, 0.5, 20]} />
              <Material {...silver} />
            </mesh>
          ))}
          {/* Plunger from the key to the bridge. */}
          <mesh position={[0, 0, (contactZ + 2.8 + MODULE.front) / 2]}>
            <boxGeometry args={[6, 6, MODULE.front - contactZ - 2.8]} />
            <Material preset="absWhite" color="#e7e4dc" roughness={0.5} />
          </mesh>
          <Anchor name="ponte" position={[5, 1.8, contactZ + 2.4]} />
        </group>
        <group ref={spring} position={[0, 0, contactZ + 2]}>
          <mesh geometry={springGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]}>
            <Material preset="steel" color="#c2c5c9" roughness={0.3} />
          </mesh>
        </group>
        <Anchor name="mola" position={[2.2, 2, contactZ - 4]} />
      </group>
    </group>
  );
}

function IndustrialButton({
  pressed,
  cap,
  contacts,
}: {
  pressed: boolean;
  cap: string;
  contacts: Contacts;
}) {
  const button = useRef<Group>(null);
  const bridges = useRef<Group>(null);
  const noise = getNoiseTexture();
  const cy = B.panel / 2;

  useSmooth(
    [pressed ? 1 : 0],
    ([v]) => {
      if (button.current) button.current.position.z = -B.travel * v!;
      if (bridges.current) bridges.current.position.z = -B.travel * v! * 0.75;
    },
    16,
  );

  const panel = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, B.panel, B.panel, 2);
    const hole = new Path();
    hole.absarc(0, 0, 11.15, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = extrudeAlongZ(s, 1.5, 0.3, { curveSegments: 24 });
    g.translate(0, 0, -0.75);
    return g;
  }, []);

  const bezel = useDisposable(() => {
    const ri = B.capR + 0.35;
    const g = axialLathe(
      [
        [ri, 0],
        [B.bezelR, 0],
        [B.bezelR, 2.2],
        [B.bezelR - 0.4, 3],
        [B.bezelR - 1.2, 3.4],
        [ri + 0.6, 3.4],
        [ri, 3.1],
        [ri, 0],
      ],
      64,
    );
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  const capGeometry = useDisposable(() => {
    const r = B.capR;
    const g = axialLathe(
      [
        [0, -6],
        [r - 0.3, -6],
        [r, -5.7],
        [r, 2.6],
        [r - 0.6, 3.05],
        [r * 0.6, 3.1],
        [0, 3.05],
      ],
      64,
    );
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  const body = useDisposable(() => {
    const g = threadedRodGeometry(22, 1.5, 12, 64);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -1.5);
    return g;
  }, []);

  const ringNut = useDisposable(() => {
    const s = new Shape();
    const n = 10;
    const R = 15;
    for (let i = 0; i < n * 4; i++) {
      const a = (i / (n * 4)) * Math.PI * 2;
      const notch = i % 4 === 0 ? 1.4 : 0;
      const x = (R - notch) * Math.cos(a);
      const y = (R - notch) * Math.sin(a);
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    const hole = new Path();
    hole.absarc(0, 0, 11.05, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = extrudeAlongZ(s, 3.5, 0.3, { curveSegments: 32 });
    g.translate(0, 0, -1.5 - 1.75);
    return g;
  }, []);

  const collar = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, 30, 40, 3);
    const hole = new Path();
    hole.absarc(0, 0, 11.05, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = extrudeAlongZ(s, 6, 0.4, { curveSegments: 24 });
    g.translate(0, 0, -13.5 - 3);
    return g;
  }, []);

  const blockGeometry = useDisposable(() => {
    const g = roundedBox(B.block - 0.3, 30, 31, 0.8, 0.35);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -19.5);
    return g;
  }, []);

  const screwHead = useDisposable(
    () => screwHeadGeometry(2.7, 1.8, 'combinada', { slot: 0.8 }),
    [],
  );
  const collarScrew = useDisposable(() => screwHeadGeometry(2.4, 1.6, 'cruz'), []);

  const kinds: ('na' | 'nf')[] = contacts === 'na-nf' ? ['na', 'nf'] : [contacts];
  const xs = kinds.length === 2 ? [-B.block / 2 - 0.1, B.block / 2 + 0.1] : [0];

  return (
    <group position={[0, cy, 0]}>
      {/* Panel section. */}
      <mesh geometry={panel}>
        <Material
          color="#d6d6d1"
          roughness={0.45}
          roughnessMap={noise}
          clearcoat={0.2}
          clip
          cutColor="#8f8f8b"
        />
      </mesh>

      {/* Bezel and button. */}
      <Explode offset={[0, 0, 16]}>
        <mesh geometry={bezel}>
          <Material preset="chrome" roughness={0.12} clip />
        </mesh>
      </Explode>
      <Explode offset={[0, 0, 30]} delay={0.1}>
        <group ref={button}>
          <mesh geometry={capGeometry}>
            <Material color={cap} roughness={0.32} roughnessMap={noise} clearcoat={0.5} clip />
          </mesh>
        </group>
      </Explode>

      {/* Threaded body, ring nut and fixing collar behind the panel. */}
      <mesh geometry={body}>
        <Material preset="absBlack" roughness={0.5} clip />
      </mesh>
      <Explode offset={[0, 0, -10]} delay={0.1}>
        <mesh geometry={ringNut}>
          <Material preset="absBlack" roughness={0.55} />
        </mesh>
      </Explode>
      <Explode offset={[0, 0, -16]} delay={0.15}>
        <mesh geometry={collar}>
          <Material preset="zinc" color="#bfc2c4" roughness={0.4} roughnessMap={noise} clip />
        </mesh>
        <mesh geometry={collarScrew} position={[0, -20, -13.5]} rotation={[Math.PI, 0, 0]}>
          <Material preset="nickel" roughness={0.3} />
        </mesh>
      </Explode>

      {/* Contact blocks. */}
      <Explode offset={[0, 0, -32]} delay={0.25}>
        {kinds.map((kind, i) => (
          <ContactBlock
            key={kind + i}
            x={xs[i]!}
            kind={kind}
            geometry={blockGeometry}
            screw={screwHead}
            first={i === 0}
          />
        ))}
        <group ref={bridges}>
          {kinds.map((kind, i) => (
            <group key={kind + i} position={[xs[i]!, 0, kind === 'na' ? -24 : -21]}>
              <mesh>
                <boxGeometry args={[2.4, 22, 0.8]} />
                <Material preset="copper" roughness={0.3} />
              </mesh>
              {[-8, 8].map((y) => (
                <mesh
                  key={y}
                  position={[0, y, kind === 'na' ? -0.6 : 0.6]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[1, 1.1, 0.4, 16]} />
                  <Material color="#dcdad4" metalness={1} roughness={0.25} />
                </mesh>
              ))}
              {/* Plunger of the block. */}
              <mesh position={[0, 0, kind === 'na' ? 3 : 1.5]}>
                <boxGeometry args={[3, 4, kind === 'na' ? 6 : 3]} />
                <Material preset="absWhite" color="#e6e3db" roughness={0.5} />
              </mesh>
              {i === 0 && <Anchor name="ponte" position={[1.2, 5, 0.5]} />}
            </group>
          ))}
        </group>
      </Explode>
    </group>
  );
}

function ContactBlock({
  x,
  kind,
  geometry,
  screw,
  first,
}: {
  x: number;
  kind: 'na' | 'nf';
  geometry: BufferGeometry;
  screw: BufferGeometry;
  first: boolean;
}) {
  const noise = getNoiseTexture();
  const na = kind === 'na';
  const numbers = na ? ['13', '14'] : ['11', '12'];
  const label = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#2b2b2b';
      fitText(ctx, numbers[0]!, w / 2, h * 0.1, w * 0.8, h * 0.08, {
        weight: 700,
        family: FONT_SANS,
      });
      fitText(ctx, numbers[1]!, w / 2, h * 0.9, w * 0.8, h * 0.08, {
        weight: 700,
        family: FONT_SANS,
      });
    },
    numbers.join(),
    { width: 128, height: 384, fonts: [`700 40px ${FONT_SANS}`] },
  );
  // Fixed contacts: behind the bridge for NO (pressing closes), in front for NC.
  const fixedZ = na ? -25.4 : -19.6;
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={geometry}>
        <Material
          preset="absWhite"
          color="#ecebe6"
          roughness={0.5}
          roughnessMap={noise}
          clip
          cutColor="#c9c6bd"
        />
      </mesh>
      {/* Colour marker on the top: green NO, red NC. */}
      <mesh position={[0, 15.02, -9]}>
        <boxGeometry args={[B.block - 2, 0.06, 6]} />
        <Material color={na ? '#1f9447' : '#c8231b'} roughness={0.5} />
      </mesh>
      <Decal
        map={label}
        width={B.block - 1.5}
        height={30}
        position={[0, 0, -35.02]}
        rotation={[0, Math.PI, 0]}
        clip
      />
      {[-11, 11].map((y) => (
        <group key={y}>
          <mesh position={[0, y, -35.3]}>
            <boxGeometry args={[6.2, 5.6, 0.6]} />
            <Material preset="zinc" color="#c9c5b0" roughness={0.35} />
          </mesh>
          <mesh geometry={screw} position={[0, y, -35.6]} rotation={[-Math.PI / 2, 0, 0.4]}>
            <Material preset="zinc" color="#d0ccb8" roughness={0.3} />
          </mesh>
          {/* Terminal strip to the fixed contact. */}
          <mesh position={[0, y * 0.73, (fixedZ - 35) / 2]}>
            <boxGeometry args={[2.4, 1.2, Math.abs(-35 - fixedZ)]} />
            <Material preset="brass" roughness={0.32} />
          </mesh>
          <mesh position={[0, y * 0.73, fixedZ]}>
            <boxGeometry args={[2.4, 4, 0.8]} />
            <Material preset="brass" roughness={0.32} />
          </mesh>
          <mesh
            position={[0, Math.sign(y) * 8, fixedZ + (na ? 0.6 : -0.6)]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[1, 1.1, 0.4, 16]} />
            <Material color="#dcdad4" metalness={1} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {first && <Anchor name="bloco" position={[B.block / 2, 8, -20]} />}
      {first && <Anchor name="bornes" position={[0, 11, -36.5]} />}
    </group>
  );
}
