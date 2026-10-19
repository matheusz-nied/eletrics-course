/**
 * Power semiconductor in a TO-220 package (TIP120, IRF540, 7805 style):
 * epoxy body with printed front, metal tab with the 3,6 mm mounting hole and
 * three leads, optionally screwed to an extruded aluminium heatsink with an
 * M3 screw and nut, with or without a mica insulator and insulating bushing. Dimensions from
 * JEDEC TO-220AB: body 10 × 9 mm, 4,5 mm thick with the 1,27 mm tab, 15,5 mm
 * tall with the tab, leads 0,8 × 0,5 mm (1,3 mm shoulders) at 2,54 mm.
 * Heatsink: typical 25 × 23 × 16 mm finned extrusion.
 */
import { useMemo } from 'react';
import { Color, ExtrudeGeometry, Shape, Vector2 } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import {
  bentStrip,
  bondWires,
  extrudeOutline,
  mergeAll,
  moldedBlock,
  type Pt,
} from './_semi-geometry';
import { SiliconDie, usePrintedTop } from './_semi-parts';

export interface TransistorTo220Props {
  code?: string;
  dateCode?: string;
  heatsink?: boolean;
  /**
   * Mica insulator and shoulder bushing between the tab and the heatsink. Off:
   * the tab is screwed straight on, so the heatsink is at the middle lead's voltage.
   */
  insulator?: boolean;
  /** Case temperature in °C: hot tabs and screws darken (oxide), nothing glows. */
  temperature?: number;
  burned?: boolean;
  leadLength?: number;
}

/** Package dimensions (mm). Z = 0 is the middle of the epoxy, the tab at the back. */
const BW = 10; // body width
const BH = 9; // epoxy height
const TAB_T = 1.27;
const TOTAL_T = 4.5;
const TAB_H = 15.5; // epoxy bottom to tab top
const HOLE_D = 3.6;
const HOLE_Y = TAB_H - 2.8; // hole centre above the epoxy bottom
const FRONT = (TOTAL_T - TAB_T) / 2; // epoxy front face
const TAB_FRONT = -FRONT;
const TAB_BACK = TAB_FRONT - TAB_T;
const LEAD_Z = TAB_BACK + 2.5; // lead plane (JEDEC J1)
const LEAD_T = 0.5;
/** Heatsink (extruded profile) and insulation. */
const HS = { w: 25, h: 23, d: 16, base: 2.2 };
const MICA_T = 0.1;
const HS_BOTTOM = -1; // relative to the epoxy bottom

export const meta: PartMeta = {
  id: 'transistor-to220',
  label: 'Transistor de potência TO-220',
  category: 'semicondutores',
  summary:
    'Componente de potência no encapsulamento TO-220 (transistor, MOSFET ou regulador), com a aba metálica e, se quiser, parafusado num dissipador de alumínio, com ou sem isolante de mica.',
  defaults: {
    code: 'TIP120',
    dateCode: '2328',
    heatsink: false,
    insulator: true,
    temperature: 25,
    burned: false,
    leadLength: 13.5,
  },
  controls: {
    code: { kind: 'text', label: 'Código impresso', maxLength: 10 },
    dateCode: { kind: 'text', label: 'Código de data', maxLength: 6 },
    heatsink: { kind: 'toggle', label: 'Com dissipador' },
    insulator: { kind: 'toggle', label: 'Isolante de mica e bucha (com dissipador)' },
    temperature: { kind: 'number', label: 'Temperatura', min: 25, max: 300, step: 5, unit: '°C' },
    burned: { kind: 'toggle', label: 'Queimado' },
    leadLength: { kind: 'number', label: 'Terminais', min: 5, max: 20, step: 0.5, unit: 'mm' },
  },
  annotations: (p) => {
    const y0 = Number(p.leadLength);
    const list = [
      { at: [0, y0 + BH * 0.55, FRONT] as Vec3, text: 'Código da peça na frente', exploded: false },
      {
        at: [BW / 2, y0 + HOLE_Y + 1.5, TAB_BACK + TAB_T / 2] as Vec3,
        text: 'Aba metálica: leva o calor (e é ligada ao terminal do meio)',
        exploded: false,
      },
      {
        at: [0, y0 + HOLE_Y, TAB_FRONT] as Vec3,
        text: 'Furo de 3,6 mm para o parafuso M3',
        exploded: false,
      },
      {
        at: [-2.54, Math.min(y0 * 0.35, 4), LEAD_Z] as Vec3,
        text: 'Três terminais com passo de 2,54 mm',
        exploded: false,
      },
      { at: [0, 0, 0] as Vec3, text: 'Chip de potência soldado na aba', anchor: 'die' },
      { at: [0, 0, 0] as Vec3, text: 'Fios grossos de alumínio', anchor: 'wires', exploded: true },
    ];
    if (p.heatsink && p.insulator === false) {
      list.push({
        at: [0, 0, 0] as Vec3,
        text: 'Dissipador sem isolante: encosta na aba e fica na tensão do terminal do meio',
        anchor: 'heatsink',
      });
    } else if (p.heatsink) {
      list.push(
        {
          at: [0, 0, 0] as Vec3,
          text: 'Dissipador de alumínio com aletas',
          anchor: 'heatsink',
          exploded: false,
        },
        {
          at: [0, 0, 0] as Vec3,
          text: 'Isolante de mica: separa a aba do dissipador',
          anchor: 'mica',
          exploded: true,
        },
        {
          at: [0, 0, 0] as Vec3,
          text: 'Bucha isolante: o parafuso não toca a aba',
          anchor: 'bushing',
          exploded: true,
        },
      );
    }
    return list;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const t = Number(p.temperature);
    const hot = t >= 60 ? `, a ${Math.round(t)} °C (quente demais para tocar)` : '';
    const mount = !p.heatsink
      ? ''
      : p.insulator === false
        ? ', parafusado direto num dissipador de alumínio, sem isolante: o dissipador fica na tensão da aba'
        : ', parafusado num dissipador de alumínio com isolante de mica';
    return `Componente de potência ${String(p.code)} em TO-220${mount}${hot}${p.burned ? ', queimado' : ''}. A aba metálica é ligada ao terminal do meio.`;
  },
  view: [0.75, 0.55, 1.5],
};

/** Tab colour with heat discolouration (nickel/tin oxide films), from 120 °C. */
function heatTint(base: string, temperature: number, burned: boolean): string {
  const c = new Color(base);
  const t = Math.min(Math.max((temperature - 120) / 180, 0), 1);
  if (t > 0) c.lerp(new Color('#a07a4e'), t * 0.55);
  if (burned) c.lerp(new Color('#4a3a2c'), 0.35);
  return `#${c.getHexString()}`;
}

export default function TransistorTo220(props: TransistorTo220Props) {
  const p = { ...meta.defaults, ...props } as Required<TransistorTo220Props>;
  const y0 = Math.max(p.leadLength, 3);
  const noise = getNoiseTexture();

  const epoxy = useDisposable(
    () =>
      moldedBlock({
        width: BW,
        depth: FRONT - TAB_FRONT + 0.04,
        height: BH,
        corner: 0.25,
        fillet: 0.2,
        bottomFillet: 0.15,
        draft: 0,
        chamferFront: 0.9,
      }),
    [],
  );

  // Tab: plate with the hole and the side notches, extruded through its thickness.
  const tab = useDisposable(() => {
    const shape = new Shape();
    const notchY = BH + 0.6;
    const top = TAB_H;
    const r = 0.5;
    shape.moveTo(-BW / 2 + 0.15, 1.6);
    shape.lineTo(BW / 2 - 0.15, 1.6);
    shape.lineTo(BW / 2 - 0.15, notchY - r);
    shape.absarc(BW / 2 - 0.15, notchY, r, -Math.PI / 2, Math.PI / 2, true);
    shape.lineTo(BW / 2 - 0.15, top - 0.6);
    shape.quadraticCurveTo(BW / 2 - 0.15, top, BW / 2 - 0.75, top);
    shape.lineTo(-BW / 2 + 0.75, top);
    shape.quadraticCurveTo(-BW / 2 + 0.15, top, -BW / 2 + 0.15, top - 0.6);
    shape.lineTo(-BW / 2 + 0.15, notchY + r);
    shape.absarc(-BW / 2 + 0.15, notchY, r, Math.PI / 2, -Math.PI / 2, true);
    shape.closePath();
    const hole = new Shape();
    hole.absarc(0, HOLE_Y, HOLE_D / 2, 0, Math.PI * 2, false);
    shape.holes.push(hole);
    const g = new ExtrudeGeometry(shape, {
      depth: TAB_T - 0.12,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelOffset: -0.06,
      bevelSegments: 2,
      curveSegments: 24,
    });
    g.translate(0, 0, TAB_BACK + 0.06);
    return g;
  }, []);

  // Leads: front outline (shoulder, step, narrow lead) extruded through 0,5 mm.
  const leads = useDisposable(() => {
    const parts = [-1, 0, 1].map((s) => {
      const x = s * 2.54;
      const outline: Pt[] = [
        [x - 0.4, 0.4],
        [x - 0.25, 0],
        [x + 0.25, 0],
        [x + 0.4, 0.4],
        [x + 0.4, y0 - 3.6],
        [x + 0.65, y0 - 3.3],
        [x + 0.65, y0 + (s === 0 ? 1.2 : 2.4)],
        [x - 0.65, y0 + (s === 0 ? 1.2 : 2.4)],
        [x - 0.65, y0 - 3.3],
        [x - 0.4, y0 - 3.6],
      ];
      const g = extrudeOutline(outline, LEAD_T, 0.04);
      g.translate(0, 0, LEAD_Z);
      return g;
    });
    // Inside: the outer leads end in bonding posts; the middle one joins the tab.
    for (const s of [-1, 1]) {
      const post = extrudeOutline(
        [
          [s * 2.54 - 1.0, y0 + 2.4],
          [s * 2.54 + 1.0, y0 + 2.4],
          [s * 2.54 + 1.0, y0 + 3.6],
          [s * 2.54 - 1.0, y0 + 3.6],
        ],
        LEAD_T,
      );
      post.translate(0, 0, LEAD_Z);
      parts.push(post);
    }
    const jog = bentStrip(
      [
        [LEAD_Z, y0 + 1.0],
        [LEAD_Z, y0 + 1.25],
        [TAB_FRONT - 0.3, y0 + 1.9],
        [TAB_FRONT - 0.3, y0 + 2.4],
      ],
      LEAD_T,
      1.3,
      0.3,
    );
    jog.rotateY(-Math.PI / 2);
    parts.push(jog);
    return mergeAll(parts);
  }, [y0]);

  // Die and aluminium wires (cutaway).
  const dieSize: [number, number] = [2.8, 2.6];
  const dieY = y0 + 5.2;
  const dieZ = TAB_FRONT + 0.05;
  const dieT = 0.3;
  const wires = useDisposable(() => {
    const top = dieZ + dieT;
    const postZ = LEAD_Z + LEAD_T / 2;
    return bondWires(
      [
        { from: [-1.0, dieY + 0.85, top], to: [-2.54, y0 + 3.0, postZ], loop: 1.2 },
        { from: [0.55, dieY - 0.4, top], to: [2.2, y0 + 3.0, postZ], loop: 1.5 },
        { from: [0.95, dieY + 0.3, top], to: [2.9, y0 + 3.0, postZ], loop: 1.7 },
      ],
      0.11,
      [0, 0, 1],
      { radial: 8, segments: 32 },
    );
  }, [y0, dieY]);

  const face = usePrintedTop({
    width: BW - 0.6,
    height: BH - 1.6,
    lines: [
      { text: p.code, size: 1.15, weight: 600 },
      { text: p.dateCode, size: 0.85, mono: true },
    ],
    offset: [0, -0.4],
    burned: p.burned,
  });

  const tabColor = heatTint('#c9c9c4', p.temperature, p.burned);
  const epoxyColor = p.burned ? '#141211' : '#1b1b1d';

  const part = (
    <group>
      {/* Epoxy body, its printed front and the lip under the tab. */}
      <Explode offset={[-8, 0, 7]}>
        <group position={[0, y0, 0]}>
          <mesh geometry={epoxy} position={[0, 0, (FRONT + TAB_FRONT - 0.04) / 2]}>
            <Material
              attach="material-0"
              preset="epoxyBlack"
              clip
              roughnessMap={noise}
              roughness={0.55}
              color={epoxyColor}
              cutColor="#2e2e31"
            />
            <Material
              attach="material-1"
              preset="epoxyBlack"
              clip
              roughnessMap={noise}
              roughness={0.55}
              color={epoxyColor}
              cutColor="#2e2e31"
            />
          </mesh>
          <mesh position={[0, 0.79, TAB_BACK + TAB_T / 2 + 0.15]}>
            <boxGeometry args={[BW - 0.1, 1.58, TAB_T + 0.3]} />
            <Material
              preset="epoxyBlack"
              clip
              roughness={0.55}
              color={epoxyColor}
              cutColor="#2e2e31"
            />
          </mesh>
          <mesh position={[0, (BH - 1.6) / 2 + 0.25, FRONT + 0.004]}>
            <planeGeometry args={[BW - 0.6, BH - 1.6]} />
            <Material
              preset="epoxyBlack"
              clip
              color="#ffffff"
              map={face.map}
              roughness={1}
              roughnessMap={face.roughnessMap}
              bumpMap={face.bumpMap}
              bumpScale={0.6}
              specularIntensity={0.6}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
        </group>
      </Explode>

      {/* Tab (heat spreader), die and wires. */}
      <group position={[0, y0, 0]}>
        <mesh geometry={tab}>
          <Material preset="nickel" color={tabColor} roughness={0.32} roughnessMap={noise} />
        </mesh>
        <mesh position={[0, dieY - y0, TAB_FRONT + 0.025]}>
          <boxGeometry args={[dieSize[0] + 0.25, dieSize[1] + 0.25, 0.05]} />
          <Material preset="solder" roughness={0.45} />
        </mesh>
      </group>
      <SiliconDie
        size={dieSize}
        thickness={dieT}
        kind="power"
        seed={11}
        position={[0, dieY, dieZ]}
        rotation={[Math.PI / 2, 0, 0]}
        burned={p.burned}
      />
      <Anchor name="die" position={[dieSize[0] / 2, dieY + 0.6, dieZ + dieT]} />
      <mesh geometry={wires}>
        <Material preset="aluminum" roughness={0.3} />
      </mesh>
      <Anchor name="wires" position={[2.0, y0 + 3.6, LEAD_Z + 1.2]} />
      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.32} />
      </mesh>
    </group>
  );

  if (!p.heatsink) return part;
  return (
    <group>
      {part}
      <Mounting y0={y0} temperature={p.temperature} insulator={p.insulator !== false} />
    </group>
  );
}

/** Heatsink, mica insulator and shoulder bushing (or a plain washer), M3 screw, washer and nut. */
function Mounting({
  y0,
  temperature,
  insulator,
}: {
  y0: number;
  temperature: number;
  insulator: boolean;
}) {
  const holeY = y0 + HOLE_Y;
  const hsFront = TAB_BACK - MICA_T - 0.05;

  const heatsink = useDisposable(() => {
    // Profile in (x, s) with s = depth behind the base front; tapered fins,
    // a wider gap in the middle for the nut.
    const fins = [-11.65, -7.9, -4.2, 4.2, 7.9, 11.65];
    const root = 0.85;
    const tip = 0.5;
    const pts: Pt[] = [
      [-HS.w / 2, 0],
      [HS.w / 2, 0],
    ];
    for (let i = fins.length - 1; i >= 0; i--) {
      const x = fins[i]!;
      if (i !== fins.length - 1) pts.push([x + root, HS.base]);
      pts.push(
        [x + tip, HS.d - 0.2],
        [x + tip * 0.5, HS.d],
        [x - tip * 0.5, HS.d],
        [x - tip, HS.d - 0.2],
      );
      if (i !== 0) pts.push([x - root, HS.base]);
    }
    const shape = new Shape(pts.map(([x, s]) => new Vector2(x, s)));
    const g = new ExtrudeGeometry(shape, {
      depth: HS.h - 0.3,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15,
      bevelOffset: -0.15,
      bevelSegments: 1,
    });
    // Shape Y is depth (towards -Z), extrusion is height (Y).
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.15, 0);
    return g;
  }, []);

  // M3 pan head (5,5 mm across, 1,9 mm tall).
  const screwHead = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0],
          [2.75, 0],
          [2.75, 0.55],
          [2.6, 1.15],
          [2.2, 1.6],
          [1.4, 1.85],
          [0, 1.9],
        ],
        32,
      ),
    [],
  );

  const shaft = useDisposable(() => {
    // Threads as a zig-zag profile (0,5 mm pitch).
    const length = 10;
    const profile: [number, number][] = [[0, 0]];
    for (let y = 0; y <= length; y += 0.25) profile.push([Math.round(y / 0.25) % 2 ? 1.5 : 1.3, y]);
    profile.push([1.2, length + 0.1]);
    profile.push([0, length + 0.1]);
    return axialLathe(profile, 20);
  }, []);

  const hsTint = useMemo(() => {
    const c = new Color('#d2d5d8');
    const t = Math.min(Math.max((temperature - 150) / 150, 0), 1);
    c.lerp(new Color('#b9b2a6'), t * 0.4);
    return `#${c.getHexString()}`;
  }, [temperature]);
  const screwTint = heatTint('#c6c9cc', temperature, false);

  return (
    <group>
      {/* Heatsink and nut behind the base. */}
      <Explode offset={[0, 0, -14]}>
        <mesh geometry={heatsink} position={[0, y0 + HS_BOTTOM, hsFront]}>
          <Material
            preset="brushedAluminum"
            color={hsTint}
            roughness={0.42}
            roughnessMap={getNoiseTexture()}
            clip
            cutColor="#9ea3a8"
          />
        </mesh>
        <Anchor
          name="heatsink"
          position={[HS.w / 2, y0 + HS_BOTTOM + HS.h * 0.7, hsFront - HS.d * 0.6]}
        />
        <group position={[0, holeY, hsFront - HS.base]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[3.3, 3.3, 0.5, 32]} />
            <Material preset="zinc" color={screwTint} />
          </mesh>
          <mesh position={[0, 0.5 + 1.2, 0]} rotation={[0, Math.PI / 6, 0]}>
            <cylinderGeometry args={[3.15, 3.15, 2.4, 6]} />
            <Material preset="zinc" color={screwTint} roughness={0.35} />
          </mesh>
        </group>
      </Explode>

      {/* Mica insulator (with thermal grease haze). */}
      {insulator && (
        <Explode offset={[0, 0, -6]}>
          <mesh position={[0, y0 + 7.8, TAB_BACK - MICA_T / 2 - 0.02]}>
            <boxGeometry args={[13, 18.5, MICA_T]} />
            <Material
              color="#d9b26a"
              roughness={0.3}
              metalness={0}
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
          <Anchor name="mica" position={[6.5, y0 + 15, TAB_BACK - 0.1]} />
        </Explode>
      )}

      {/* Screw with the shoulder bushing on the front of the tab. */}
      <Explode offset={[0, 0, 10]}>
        <group position={[0, holeY, TAB_FRONT]} rotation={[Math.PI / 2, 0, 0]}>
          {insulator ? (
            <>
              {/* Shoulder bushing (nylon): flange and sleeve through the hole. */}
              <mesh position={[0, 0.4, 0]}>
                <cylinderGeometry args={[3.1, 3.1, 0.8, 32]} />
                <Material preset="nylonNatural" />
              </mesh>
              <mesh position={[0, -0.7, 0]}>
                <cylinderGeometry args={[1.75, 1.75, 1.4, 24]} />
                <Material preset="nylonNatural" />
              </mesh>
            </>
          ) : (
            // Plain steel washer: the screw touches the tab.
            <mesh position={[0, 0.4, 0]}>
              <cylinderGeometry args={[3.3, 3.3, 0.8, 32]} />
              <Material preset="zinc" color={screwTint} />
            </mesh>
          )}
        </group>
        {insulator && <Anchor name="bushing" position={[3.1, holeY, TAB_FRONT + 0.8]} />}
        <group position={[0, holeY, TAB_FRONT + 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={screwHead}>
            <Material preset="zinc" color={screwTint} roughness={0.32} />
          </mesh>
          {/* Phillips recess. */}
          {[0, Math.PI / 2].map((a) => (
            <mesh key={a} position={[0, 1.78, 0]} rotation={[0, a, 0]}>
              <boxGeometry args={[2.4, 0.3, 0.5]} />
              <Material color="#3c3e40" roughness={0.6} metalness={0.6} />
            </mesh>
          ))}
          <mesh geometry={shaft} rotation={[Math.PI, 0, 0]}>
            <Material preset="zinc" color={screwTint} roughness={0.38} />
          </mesh>
        </group>
      </Explode>
    </group>
  );
}
