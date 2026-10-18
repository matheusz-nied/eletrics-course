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
 * Both face +Z; the cutaway is the vertical plane x = 0 through the mechanism.
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
  roundedRectSweep,
  screwHeadGeometry,
  shellGeometry,
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
/** Key of the module: size, front and back faces, travel. */
const KEY = { W: 44.2, H: 22.6, front: 8.3, back: 4.6, travel: 1.2 };
/** Module body behind the key (hollow, the contact block inside). */
const MODULE = { W: 45, H: 23, front: 3.3, back: -24, wall: 1.2 };
/** Contact block: x of the silver contacts, z of the fixed contact faces, x of the strips. */
const CB = { x: 8.5, fixed: -5, strip: 11 };

/** Industrial button (mm). */
const B = { panel: 60, bezelR: 14.85, capR: 10.6, travel: 4, block: 9.8, bridgeTravel: 2.5 };
const PANEL_FRONT = 0.75;
const BEZEL_TOP = PANEL_FRONT + 3.4;
const CAP_FRONT = BEZEL_TOP - 0.35;
const BODY_END = -13.5;
const BLOCK_FRONT = -19.6;
const BLOCK_BACK = BLOCK_FRONT - 20;
/** Front of the block plunger; the pusher reaches it after this pre-travel. */
const PLUNGER_FRONT = BLOCK_FRONT + 1;
const PRE_TRAVEL = B.travel - B.bridgeTravel;

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
          at: [3, B.panel / 2 + 4, CAP_FRONT],
          text: 'Botão: só fecha (ou abre) enquanto está apertado',
          exploded: false,
        },
        {
          at: [B.bezelR * 0.75, B.panel / 2 - B.bezelR * 0.6, BEZEL_TOP - 0.5],
          text: 'Aro de 22 mm: furo padrão no painel',
          exploded: false,
        },
        { at: [0, 0, 0], text: 'Bloco de contato: NA (verde) ou NF (vermelho)', anchor: 'bloco' },
        { at: [0, 0, 0], text: 'Bornes de parafuso (13–14 ou 11–12)', anchor: 'bornes' },
        { at: [0, 0, 0], text: 'Ponte de contato móvel', anchor: 'ponte', exploded: true },
      ];
    }
    return [
      {
        at: [KEY.W / 2 - 6, P.H / 2 + 6, KEY.front],
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
      {
        at: [0, 0, 0],
        text: 'Bornes de parafuso atrás do módulo',
        anchor: 'bornes',
        exploded: true,
      },
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
  // Vertical cut through the middle; the half towards the camera (x > 0) is removed.
  cut: (p) => ({
    normal: [-1, 0, 0],
    through: [0, p.variant === 'pulsador-industrial' ? B.panel / 2 : P.H / 2, 0],
  }),
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

  // Stations along the depth (z) of the contact block.
  const silver = 0.5;
  const bridgeBack = CB.fixed + KEY.travel + silver;
  const bridgeZ = bridgeBack + 0.35;
  const springBase = MODULE.back + MODULE.wall;
  const springLength = bridgeBack - springBase;

  useSmooth(
    [pressed ? 1 : 0],
    ([v]) => {
      const dz = -KEY.travel * v!;
      if (key.current) key.current.position.z = dz;
      if (bridge.current) bridge.current.position.z = dz;
      if (spring.current) spring.current.scale.z = (springLength + dz) / springLength;
    },
    18,
  );

  const plate = useDisposable(() => plateGeometry(), []);
  const keyGeometry = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, KEY.W, KEY.H, 1.3);
    const g = extrudeAlongZ(s, KEY.front - KEY.back, 0.9, { curveSegments: 6, bevelSegments: 3 });
    g.translate(0, 0, (KEY.front + KEY.back) / 2);
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
    // Built along +Y with the open side at y = 0: turn it to run along −Z.
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, MODULE.front);
    return g;
  }, []);
  const moduleFront = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, MODULE.W - 2 * MODULE.wall + 0.1, MODULE.H - 2 * MODULE.wall + 0.1, 0.6);
    const hole = new Path();
    addRoundedRect(hole, 6.6, 6.6, 1, 0, 0, true);
    s.holes.push(hole);
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
  const springGeometry = useDisposable(
    () => tube(new HelixCurve(2.2, springLength, 9), 0.3, { radial: 8, segments: 260 }),
    [springLength],
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
  const silverMat = { color: '#dcdad4', metalness: 1, roughness: 0.25 };

  return (
    <group position={[0, cy, 0]}>
      {/* Plate. */}
      <Explode offset={[0, 0, 24]} delay={0.1}>
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
      </Explode>

      {/* Key with the bell symbol. */}
      <Explode offset={[0, 0, 40]} delay={0.2}>
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
            position={[0, 0, KEY.front + 0.012]}
            roughness={0.4}
            clip
          />
        </group>
      </Explode>

      {/* Support frame and the box screws. */}
      <Explode offset={[0, 0, 12]}>
        <mesh geometry={frame}>
          <Material preset="absDark" roughness={0.55} clip />
        </mesh>
        {[-41.75, 41.75].map((y) => (
          <group key={y} position={[0, y, 0]}>
            <mesh geometry={boxScrew} position={[0, 0, 2.8]} rotation={[Math.PI / 2, 0, 0.3]}>
              <Material preset="zinc" roughness={0.35} clip />
            </mesh>
            <mesh geometry={boxScrewShank}>
              <Material preset="zinc" roughness={0.4} clip />
            </mesh>
          </group>
        ))}
        <Anchor name="suporte" position={[-3.4, 41.75, 4]} />
      </Explode>

      {/* Module housing (hollow): moves back and leaves the contact block. */}
      <Explode offset={[0, 0, -36]} delay={0.1}>
        <mesh geometry={moduleShell}>
          <Material
            preset="absWhite"
            roughness={0.5}
            roughnessMap={noise}
            clip
            cutColor="#c9c6bd"
          />
        </mesh>
        <mesh geometry={moduleFront}>
          <Material preset="absWhite" roughness={0.5} clip cutColor="#c9c6bd" />
        </mesh>
        <Decal
          map={rating}
          width={20}
          height={5}
          position={[0, MODULE.H / 2 + 0.012, -12]}
          rotation={[-Math.PI / 2, 0, 0]}
          clip
        />
        {/* Wire entries next to the terminal screws. */}
        {[-CB.strip, CB.strip].map((x) => (
          <mesh key={x} position={[x, -7.4, MODULE.back - 0.015]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[3.6, 3.4]} />
            <Material color="#141414" roughness={0.9} clip />
          </mesh>
        ))}
        {/* Snap latches that hold the module in the frame. */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (MODULE.W / 2 + 0.35), 0, 0.2]}>
            <boxGeometry args={[0.7, 7, 2.2]} />
            <Material preset="absWhite" roughness={0.5} clip />
          </mesh>
        ))}
      </Explode>

      {/* Contact block: terminals, fixed contacts, moving bridge and return spring. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * CB.strip, 0, MODULE.back - 0.35]}>
            <boxGeometry args={[6.4, 6.4, 0.7]} />
            <Material {...brass} />
          </mesh>
          <mesh
            geometry={screwHead}
            position={[side * CB.strip, 0, MODULE.back - 0.7]}
            rotation={[-Math.PI / 2, 0, 0.5]}
          >
            <Material preset="brass" color="#e0c27f" roughness={0.28} />
          </mesh>
          <mesh position={[side * CB.strip, 0, (MODULE.back + CB.fixed - silver) / 2]}>
            <boxGeometry args={[0.6, 3, CB.fixed - silver - MODULE.back]} />
            <Material {...brass} />
          </mesh>
          <mesh position={[side * (CB.strip - 2), 0, CB.fixed - silver - 0.3]}>
            <boxGeometry args={[4.6, 3, 0.6]} />
            <Material {...brass} />
          </mesh>
          <mesh position={[side * CB.x, 0, CB.fixed - silver / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1, 1.1, silver, 20]} />
            <Material {...silverMat} />
          </mesh>
        </group>
      ))}
      <Anchor name="bornes" position={[-CB.strip, 3.6, MODULE.back - 1.8]} />
      <group ref={bridge}>
        <mesh position={[0, 0, bridgeZ]}>
          <boxGeometry args={[21, 3.4, 0.7]} />
          <Material preset="copper" roughness={0.3} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * CB.x, 0, bridgeBack - silver / 2]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[1.1, 1, silver, 20]} />
            <Material {...silverMat} />
          </mesh>
        ))}
        {/* Plunger from the key to the bridge. */}
        <mesh position={[0, 0, (bridgeZ + 0.35 + KEY.back) / 2]}>
          <boxGeometry args={[6, 6, KEY.back - bridgeZ - 0.35]} />
          <Material preset="absWhite" color="#e7e4dc" roughness={0.5} />
        </mesh>
        <Anchor name="ponte" position={[-5, 1.7, bridgeZ]} />
      </group>
      <group ref={spring} position={[0, 0, springBase]}>
        <mesh geometry={springGeometry} rotation={[Math.PI / 2, 0, 0]}>
          <Material preset="steel" color="#c2c5c9" roughness={0.3} />
        </mesh>
      </group>
      <Anchor name="mola" position={[-2.4, 2.4, springBase + springLength * 0.45]} />
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
  const noise = getNoiseTexture();
  const cy = B.panel / 2;

  useSmooth(
    [pressed ? 1 : 0],
    ([v]) => {
      if (button.current) button.current.position.z = -B.travel * v!;
    },
    16,
  );

  const panel = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, B.panel, B.panel, 2);
    const hole = new Path();
    hole.absarc(0, 0, 11.15, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return extrudeAlongZ(s, PANEL_FRONT * 2, 0.3, { curveSegments: 24 });
  }, []);

  const bezel = useDisposable(() => {
    const ri = B.capR + 0.35;
    const R = B.bezelR;
    const g = axialLathe(
      [
        [ri, 0],
        [R, 0],
        [R, 2.2],
        [R - 0.4, 3],
        [R - 1.2, 3.4],
        [ri + 0.6, 3.4],
        [ri, 3.1],
        [ri, -1.5],
      ],
      64,
    );
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, PANEL_FRONT);
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
    g.translate(0, 0, CAP_FRONT - 3.1);
    return g;
  }, []);

  const body = useDisposable(() => {
    const g = threadedRodGeometry(22, 1.5, PANEL_FRONT - BODY_END, 64);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, PANEL_FRONT);
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
    g.translate(0, 0, -PANEL_FRONT - 1.75);
    return g;
  }, []);

  const collar = useDisposable(() => {
    const s = new Shape();
    addRoundedRect(s, 30, 40, 3);
    const hole = new Path();
    hole.absarc(0, 0, 11.05, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = extrudeAlongZ(s, 6, 0.4, { curveSegments: 24 });
    g.translate(0, 0, BODY_END - 3);
    return g;
  }, []);

  const blockGeometry = useDisposable(() => {
    const g = shellGeometry(B.block - 0.3, BLOCK_FRONT - BLOCK_BACK, 30, 0.8, 0.4, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, BLOCK_FRONT);
    return g;
  }, []);

  const screwHead = useDisposable(
    () => screwHeadGeometry(2.7, 1.8, 'combinada', { slot: 0.8 }),
    [],
  );
  const collarScrew = useDisposable(() => screwHeadGeometry(2.4, 1.6, 'cruz'), []);

  const kinds: ('na' | 'nf')[] = contacts === 'na-nf' ? ['na', 'nf'] : [contacts];
  const xs = kinds.length === 2 ? [-B.block / 2 - 0.1, B.block / 2 + 0.1] : [0];

  // Actuator inside the body: rod and pusher plate that reach the block plungers.
  const pusherBack = PLUNGER_FRONT + PRE_TRAVEL;
  const capBack = CAP_FRONT - 3.1 - 6;

  return (
    <group position={[0, cy, 0]}>
      {/* Panel section. */}
      <mesh geometry={panel}>
        <Material
          color="#c8cac7"
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
          <Material preset="chrome" roughness={0.12} clip cutColor="#8d9095" />
        </mesh>
      </Explode>
      <Explode offset={[0, 0, 30]} delay={0.1}>
        <group ref={button}>
          <mesh geometry={capGeometry}>
            <Material color={cap} roughness={0.32} roughnessMap={noise} clearcoat={0.5} clip />
          </mesh>
          <mesh position={[0, 0, (capBack + pusherBack + 1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3, 3, capBack - pusherBack - 1, 24]} />
            <Material preset="absBlack" roughness={0.5} clip />
          </mesh>
          <mesh position={[0, 0, pusherBack + 0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[7.5, 7.5, 1, 40]} />
            <Material preset="absBlack" roughness={0.5} clip />
          </mesh>
        </group>
      </Explode>

      {/* Threaded body, ring nut and fixing collar behind the panel. */}
      <mesh geometry={body}>
        <Material preset="absBlack" roughness={0.5} clip />
      </mesh>
      <Explode offset={[0, 0, -14]} delay={0.1}>
        <mesh geometry={ringNut}>
          <Material preset="absBlack" roughness={0.55} clip />
        </mesh>
      </Explode>

      {/* Collar and blocks, turned so the blocks stack vertically (the cut runs across them). */}
      <group rotation={[0, 0, Math.PI / 2]}>
        <Explode offset={[0, 0, -16]} delay={0.15}>
          <mesh geometry={collar}>
            <Material preset="zinc" color="#bfc2c4" roughness={0.4} roughnessMap={noise} clip />
          </mesh>
          <mesh geometry={collarScrew} position={[0, 20, BODY_END - 3]}>
            <Material preset="nickel" roughness={0.3} />
          </mesh>
        </Explode>
        <Explode offset={[0, 0, -32]} delay={0.25}>
          {kinds.map((kind, i) => (
            <ContactBlock
              key={kind + i}
              x={xs[i]!}
              kind={kind}
              pressed={pressed}
              geometry={blockGeometry}
              screw={screwHead}
              first={i === 0}
            />
          ))}
        </Explode>
      </group>
    </group>
  );
}

function ContactBlock({
  x,
  kind,
  pressed,
  geometry,
  screw,
  first,
}: {
  x: number;
  kind: 'na' | 'nf';
  pressed: boolean;
  geometry: BufferGeometry;
  screw: BufferGeometry;
  first: boolean;
}) {
  const moving = useRef<Group>(null);
  const noise = getNoiseTexture();
  const na = kind === 'na';
  const numbers = na ? ['13', '14'] : ['11', '12'];

  // Same damping as the button: the bridge waits for the pre-travel, then follows it.
  useSmooth(
    [pressed ? 1 : 0],
    ([v]) => {
      if (moving.current) moving.current.position.z = -Math.max(0, B.travel * v! - PRE_TRAVEL);
    },
    16,
  );

  const label = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#2b2b2b';
      // The block is shown turned a quarter turn: the numbers are drawn turned back.
      for (const [i, n] of numbers.entries()) {
        ctx.save();
        ctx.translate(w / 2, h * (i === 0 ? 0.33 : 0.67));
        ctx.rotate(-Math.PI / 2);
        fitText(ctx, n, 0, 0, h * 0.2, w * 0.55, { weight: 700, family: FONT_SANS });
        ctx.restore();
      }
    },
    numbers.join(),
    { width: 128, height: 384, fonts: [`700 40px ${FONT_SANS}`] },
  );

  // Stations along z: NO has the fixed contacts behind the bridge (pressing
  // closes), NC in front of it (pressing opens).
  const bridgeZ = na ? -24 : -28;
  const bridgeSilver = bridgeZ + (na ? -0.6 : 0.6);
  const fixedSilver = na ? bridgeSilver - 0.4 - B.bridgeTravel : bridgeSilver + 0.4;
  const fixedPlate = fixedSilver + (na ? -0.6 : 0.6);
  const plungerBack = bridgeZ + 0.4;
  const stripFront = fixedPlate - 0.4;

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
      {/* Colour marker: green NO, red NC. */}
      <mesh position={[0, 15.02, BLOCK_FRONT - 4]}>
        <boxGeometry args={[B.block - 2, 0.06, 6]} />
        <Material color={na ? '#1f9447' : '#c8231b'} roughness={0.5} clip />
      </mesh>
      <Decal
        map={label}
        width={B.block - 1.5}
        height={30}
        position={[0, 0, BLOCK_BACK - 0.02]}
        rotation={[0, Math.PI, 0]}
        clip
      />
      {[-11, 11].map((y) => {
        return (
          <group key={y}>
            <mesh position={[0, y, BLOCK_BACK - 0.3]}>
              <boxGeometry args={[6.2, 5.6, 0.6]} />
              <Material preset="zinc" color="#c9c5b0" roughness={0.35} />
            </mesh>
            <mesh
              geometry={screw}
              position={[0, y, BLOCK_BACK - 0.6]}
              rotation={[-Math.PI / 2, 0, 0.4]}
            >
              <Material preset="zinc" color="#d0ccb8" roughness={0.3} />
            </mesh>
            {/* Terminal strip to the fixed contact. */}
            <mesh position={[0, y, (BLOCK_BACK + stripFront) / 2]}>
              <boxGeometry args={[2.4, 1, stripFront - BLOCK_BACK]} />
              <Material preset="brass" roughness={0.32} />
            </mesh>
            <mesh position={[0, Math.sign(y) * 8.75, fixedPlate]}>
              <boxGeometry args={[2.4, 5.5, 0.8]} />
              <Material preset="brass" roughness={0.32} />
            </mesh>
            <mesh position={[0, Math.sign(y) * 8, fixedSilver]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[1, 1.1, 0.4, 16]} />
              <Material color="#dcdad4" metalness={1} roughness={0.25} />
            </mesh>
          </group>
        );
      })}
      <group ref={moving}>
        <mesh position={[0, 0, bridgeZ]}>
          <boxGeometry args={[2.4, 19, 0.8]} />
          <Material preset="copper" roughness={0.3} />
        </mesh>
        {[-8, 8].map((y) => (
          <mesh key={y} position={[0, y, bridgeSilver]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1, 1.1, 0.4, 16]} />
            <Material color="#dcdad4" metalness={1} roughness={0.25} />
          </mesh>
        ))}
        {/* Plunger of the block. */}
        <mesh position={[0, 0, (PLUNGER_FRONT + plungerBack) / 2]}>
          <boxGeometry args={[3, 4, PLUNGER_FRONT - plungerBack]} />
          <Material preset="absWhite" color="#e6e3db" roughness={0.5} />
        </mesh>
        {first && <Anchor name="ponte" position={[1.2, 5, bridgeZ]} />}
      </group>
      {first && <Anchor name="bloco" position={[B.block / 2, 8, BLOCK_FRONT - 8]} />}
      {first && <Anchor name="bornes" position={[0, 11, BLOCK_BACK - 1.8]} />}
    </group>
  );
}
