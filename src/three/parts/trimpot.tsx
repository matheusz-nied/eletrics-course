/**
 * PCB trimmer potentiometers ("trimpots"), the ones used for adjustments on
 * boards (force and pause of a gate controller, for example):
 * - `multivoltas`: square sealed cermet trimmer, 25 turns, 9,53 × 4,83 ×
 *   10,03 mm, brass screw on top, three in-line pins at 2,54 mm (dimensions
 *   of the common 3296W footprint). Inside: worm screw, gear carrying the
 *   wiper, cermet track on a ceramic substrate.
 * - `aberto`: 6 mm open single-turn carbon trimmer (RM065-like footprint:
 *   two pins in front at 5,0 mm, the wiper pin behind), rotor with a cross slot.
 * `rotation` (0..1) moves the wiper from terminal 1 to terminal 3. The label
 * (e.g. "VR1", "FORÇA") is the name on the board; it is not printed on the part.
 */
import { CylinderGeometry, ExtrudeGeometry, Shape, TorusGeometry } from 'three';
import { formatOhms, smdResistorCode } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { roundedPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps } from '../types';
import { roundedBoxGeometry } from './_passive-common';

export type TrimpotVariant = 'multivoltas' | 'aberto';

export interface TrimpotProps {
  variant?: TrimpotVariant;
  ohms?: number;
  /** Wiper position, 0 (terminal 1) to 1 (terminal 3). */
  rotation?: number;
  /** Reference on the board (VR1, FORÇA…); not printed on the part. */
  label?: string;
}

/** Electrical travel of the wiper (degrees). */
const TRAVEL = 300;
/** Turns of the screw of the multi-turn trimmer. */
const TURNS = 25;

/** 3296W housing (mm). */
const MT = { W: 9.53, D: 4.83, H: 9.43, standoff: 0.6, pin: 4.0, pitch: 2.54 };
/** Open single-turn trimmer (mm). */
const OT = { W: 6.6, D: 7, T: 1.3, pin: 3.5, rotor: 2.25 };

/** Value code printed on trimmers: 3 digits like SMD resistors (`103` = 10 kΩ). */
export const trimpotCode = (ohms: number) => smdResistorCode(Math.max(ohms, 10));

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

export const meta: PartMeta = {
  id: 'trimpot',
  label: 'Trimpot',
  category: 'passivos',
  summary:
    'Trimpot de ajuste para placa: o azul multivoltas (parafuso de latão) e o pequeno aberto de uma volta, com o código do valor.',
  defaults: { variant: 'multivoltas', ohms: 10_000, rotation: 0.5, label: '' },
  controls: {
    variant: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'multivoltas', label: 'Multivoltas (25 voltas)' },
        { value: 'aberto', label: 'Aberto de uma volta (6 mm)' },
      ],
    },
    ohms: { kind: 'number', label: 'Resistência', min: 100, max: 2_000_000, log: true, unit: 'Ω' },
    rotation: { kind: 'number', label: 'Posição do cursor', min: 0, max: 1, step: 0.01 },
    label: { kind: 'text', label: 'Nome na placa', maxLength: 12 },
  },
  annotations: (p) => {
    const code = trimpotCode(Number(p.ohms));
    const name = String(p.label ?? '').trim();
    const codeNote = `Código ${code}: ${formatOhms(Number(p.ohms))}${name ? ` (${name} na placa)` : ''}`;
    if (p.variant === 'aberto') {
      const top = OT.pin + OT.T;
      return [
        { at: [0, top + 1.6, 0], text: 'Fenda: gire com chave de fenda', exploded: false },
        { at: [0, top, OT.D / 2 - 0.4], text: codeNote, exploded: false },
        { at: [-2.5, 1.2, 2.5], text: 'Terminal 1', exploded: false },
        { at: [0, 1.2, -2.5], text: 'Terminal 2: cursor', exploded: false },
        { at: [2.5, 1.2, 2.5], text: 'Terminal 3', exploded: false },
        { at: [0, 0, 0], text: 'Pista de carbono', anchor: 'track', exploded: true },
        { at: [0, 0, 0], text: 'Cursor (gira com o rotor)', anchor: 'wiper', exploded: true },
      ] satisfies PartAnnotation[];
    }
    const top = MT.pin + MT.standoff + MT.H;
    return [
      {
        at: [-3, top + 0.5, 0],
        text: `Parafuso: ${TURNS} voltas de ponta a ponta`,
        exploded: false,
      },
      { at: [1, top * 0.62, MT.D / 2], text: codeNote, exploded: false },
      { at: [-MT.pitch, 1.5, 0], text: 'Terminal 1', exploded: false },
      { at: [0, 1, 0], text: 'Terminal 2: cursor', exploded: false },
      { at: [MT.pitch, 1.5, 0], text: 'Terminal 3', exploded: false },
      { at: [0, 0, 0], text: 'Rosca sem-fim', anchor: 'worm' },
      { at: [0, 0, 0], text: 'Engrenagem com o cursor', anchor: 'gear', exploded: true },
      { at: [0, 0, 0], text: 'Pista de cermet (resistência)', anchor: 'track', exploded: true },
    ] satisfies PartAnnotation[];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const name = String(p.label ?? '').trim();
    const kind = p.variant === 'aberto' ? 'aberto de uma volta' : `multivoltas (${TURNS} voltas)`;
    const pct = Math.round(clamp01(Number(p.rotation)) * 100);
    return `Trimpot ${name ? `${name}, ` : ''}${kind}, de ${formatOhms(Number(p.ohms))} (código ${trimpotCode(Number(p.ohms))}), com o cursor a ${pct} % do curso. Os terminais das pontas vão às extremidades da pista; o do meio é o cursor.`;
  },
  view: [0.6, 0.65, 1.5],
};

export default function Trimpot(props: TrimpotProps) {
  const p = { ...meta.defaults, ...props } as Required<TrimpotProps>;
  return p.variant === 'aberto' ? <OpenTrimpot {...p} /> : <MultiTurnTrimpot {...p} />;
}

/** Ring sector (track) facing +Z, from angle a0 over `length` radians. */
function trackGeometry(r0: number, r1: number, a0: number, length: number, depth: number) {
  const shape = new Shape();
  shape.absarc(0, 0, r1, a0, a0 + length, false);
  shape.absarc(0, 0, r0, a0 + length, a0, true);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 40 });
}

function MultiTurnTrimpot(p: Required<TrimpotProps>) {
  const r = clamp01(p.rotation);
  const code = trimpotCode(p.ohms);
  const lift = MT.pin + MT.standoff;
  const screwX = -3.05;
  const gear = { x: 1.0, y: 4.9, r: 3.1, z: -0.35, t: 1.1 };
  const subZ = -MT.D / 2 + 0.55;
  // Wiper angle: gap at the bottom (toward the pins); 0 → right end, 1 → left end.
  const gap = ((360 - TRAVEL) / 2) * (Math.PI / 180);
  const wiperAngle = -Math.PI / 2 + gap + ((TRAVEL * Math.PI) / 180) * r;
  const screwAngle = r * TURNS * Math.PI * 2;

  const housing = useDisposable(() => roundedBoxGeometry(MT.W, MT.H, MT.D, 0.35, 0.5), []);
  const track = useDisposable(
    () => trackGeometry(1.9, 2.75, -Math.PI / 2 + gap, (TRAVEL * Math.PI) / 180, 0.05),
    [],
  );
  const gearGeometry = useDisposable(() => {
    const shape = new Shape();
    const teeth = 26;
    const steps = teeth * 4;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const phase = (i % 4) / 4;
      const rr = gear.r - (phase < 0.5 ? 0 : 0.28);
      if (i === 0) shape.moveTo(rr * Math.cos(a), rr * Math.sin(a));
      else shape.lineTo(rr * Math.cos(a), rr * Math.sin(a));
    }
    const g = new ExtrudeGeometry(shape, {
      depth: gear.t,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.05,
      bevelSegments: 1,
      curveSegments: 4,
    });
    g.translate(0, 0, -gear.t / 2);
    return g;
  }, []);
  // Worm: helical thread along the screw.
  const wormGeometry = useDisposable(() => {
    const points: [number, number, number][] = [];
    const turns = 9;
    const y0 = 2.2;
    const y1 = 7.8;
    for (let i = 0; i <= turns * 16; i++) {
      const t = i / (turns * 16);
      const a = t * turns * Math.PI * 2;
      points.push([0.62 * Math.cos(a), y0 + (y1 - y0) * t, 0.62 * Math.sin(a)]);
    }
    return tube(roundedPath(points, 0.05), 0.16, { radial: 6, segments: turns * 16 });
  }, []);
  const slotGeometry = useDisposable(() => new CylinderGeometry(1.15, 1.15, 0.6, 32), []);

  const print = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f1f3f6';
      fitText(ctx, code, w * 0.56, h * 0.5, w * 0.6, h * 0.36, { weight: 700, family: FONT_SANS });
      // Pin-1 mark and the direction that raises the resistance 1–2.
      fitText(ctx, '1', w * 0.12, h * 0.86, w * 0.1, h * 0.14, { weight: 700, family: FONT_SANS });
      ctx.font = `600 ${Math.round(h * 0.12)}px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText('CW', w * 0.56, h * 0.18);
    },
    code,
    { width: 512, height: 512, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const noise = getNoiseTexture();

  return (
    <group position={[0, lift, 0]}>
      {/* Blue sealed housing with the printed code. */}
      <Explode offset={[0, MT.H + 6, 0]}>
        <mesh geometry={housing} position={[0, MT.H / 2, 0]}>
          <Material
            preset="pbtBlue"
            clip
            color="#2457c5"
            roughnessMap={noise}
            roughness={0.42}
            clearcoat={0.25}
            cutColor="#173a85"
          />
        </mesh>
        <mesh position={[0.3, MT.H * 0.45, MT.D / 2 + 0.005]}>
          <planeGeometry args={[MT.W * 0.85, MT.H * 0.85]} />
          <Material
            preset="epoxyBlack"
            clip
            color="#ffffff"
            map={print}
            transparent
            depthWrite={false}
            roughness={0.5}
          />
        </mesh>
        {/* Standoff feet. */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (MT.W / 2 - 0.9), -MT.standoff / 2, 0]}>
            <boxGeometry args={[1.2, MT.standoff, MT.D - 0.6]} />
            <Material preset="pbtBlue" color="#2457c5" roughness={0.5} />
          </mesh>
        ))}
      </Explode>

      {/* Screw: brass head with slot, worm inside; turns 25 times. */}
      <Explode offset={[0, 4, 0]}>
        <group position={[screwX, 0, gear.z]} rotation={[0, screwAngle, 0]}>
          <mesh position={[0, (1.6 + MT.H) / 2, 0]}>
            <cylinderGeometry args={[0.45, 0.45, MT.H - 1.6, 20]} />
            <Material preset="brass" roughness={0.3} />
          </mesh>
          <mesh geometry={wormGeometry}>
            <Material preset="brass" roughness={0.3} />
          </mesh>
          <mesh geometry={slotGeometry} position={[0, MT.H + 0.2, 0]}>
            <Material preset="brass" roughness={0.28} />
          </mesh>
          <mesh position={[0, MT.H + 0.48, 0]}>
            <boxGeometry args={[2.4, 0.12, 0.45]} />
            <Material preset="epoxyBlack" color="#3a2a12" roughness={0.6} />
          </mesh>
          <Anchor name="worm" position={[0.6, 5, 0]} />
        </group>
      </Explode>

      {/* Gear with the wiper: turns 300° over the 25 turns of the screw. */}
      <Explode offset={[0, 0, 6]}>
        <group position={[gear.x, gear.y, gear.z]} rotation={[0, 0, wiperAngle]}>
          <mesh geometry={gearGeometry}>
            <Material preset="nylonNatural" clip color="#ece6d6" roughness={0.55} />
          </mesh>
          {/* Wiper contact on the back of the gear, at the track radius. */}
          <mesh position={[2.32, 0, -gear.t / 2 - 0.12]}>
            <boxGeometry args={[1.0, 0.5, 0.15]} />
            <Material preset="gold" color="#e7cf8a" roughness={0.3} />
          </mesh>
          <mesh position={[1.2, 0, -gear.t / 2 - 0.08]}>
            <boxGeometry args={[2.2, 0.7, 0.08]} />
            <Material preset="nickel" color="#ddd5c0" roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, gear.t / 2]}>
            <cylinderGeometry args={[0.5, 0.5, 0.2, 16]} />
            <Material preset="tin" />
          </mesh>
          <Anchor name="gear" position={[0, -gear.r * 0.6, gear.t / 2]} />
        </group>
      </Explode>

      {/* Ceramic substrate with the cermet track, and the pins. */}
      <mesh position={[gear.x, gear.y - 0.3, subZ]}>
        <boxGeometry args={[7.2, 7.6, 0.6]} />
        <Material preset="ceramicWhite" color="#f2efe7" roughness={0.6} />
      </mesh>
      <mesh geometry={track} position={[gear.x, gear.y, subZ + 0.3]}>
        <Material preset="carbonFilm" color="#2b2826" roughness={0.65} />
      </mesh>
      {/* Silver terminations at the track ends. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[gear.x + side * 1.2, gear.y - 2.4, subZ + 0.31]}
          rotation={[0, 0, side * 0.5]}
        >
          <boxGeometry args={[1.0, 1.4, 0.03]} />
          <Material preset="aluminum" color="#d0d2d4" roughness={0.45} />
        </mesh>
      ))}
      <Anchor name="track" position={[gear.x - 2.3, gear.y + 0.6, subZ + 0.35]} />
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * MT.pitch, (2.2 - lift) / 2, 0]}>
          <boxGeometry args={[0.5, lift + 2.2, 0.5]} />
          <Material preset="tin" roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function OpenTrimpot(p: Required<TrimpotProps>) {
  const r = clamp01(p.rotation);
  const code = trimpotCode(p.ohms);
  const lift = OT.pin;
  // Track gap toward the two front pins (+Z); 0 → right end, 1 → left end.
  const gap = ((360 - TRAVEL) / 2) * (Math.PI / 180);
  // Angle around Y measured from +Z: x = sin, z = cos.
  const angle = gap + ((TRAVEL * Math.PI) / 180) * (1 - r);

  const base = useDisposable(() => roundedBoxGeometry(OT.W, OT.T, OT.D, 0.15, 0.4), []);
  const trackGeo = useDisposable(() => {
    // Gap centred on +Z; the extrusion faces +Z, turned to face up.
    const g = trackGeometry(1.7, 2.95, Math.PI / 2 + gap, (TRAVEL * Math.PI) / 180, 0.04);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const rotorGeo = useDisposable(() => {
    // Disc with a pointer tab over the wiper (shape −Y becomes +Z once turned up).
    const shape = new Shape();
    shape.absarc(0, 0, OT.rotor, -Math.PI / 2 + 0.45, -Math.PI / 2 - 0.45 + Math.PI * 2, false);
    shape.lineTo(-0.55, -OT.rotor - 0.7);
    shape.lineTo(0.55, -OT.rotor - 0.7);
    shape.closePath();
    const g = new ExtrudeGeometry(shape, {
      depth: 0.9,
      bevelEnabled: true,
      bevelSize: 0.12,
      bevelThickness: 0.12,
      bevelSegments: 2,
      curveSegments: 32,
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const ringGeo = useDisposable(() => new TorusGeometry(0.75, 0.18, 10, 24), []);

  const print = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f2f4f8';
      fitText(ctx, code, w / 2, h / 2, w * 0.9, h * 0.8, { weight: 700, family: FONT_SANS });
    },
    code,
    { width: 256, height: 96, fonts: [`700 40px ${FONT_SANS}`] },
  );
  const noise = getNoiseTexture();
  const top = OT.T;

  return (
    <group position={[0, lift, 0]}>
      <mesh geometry={base} position={[0, OT.T / 2, 0]}>
        <Material
          preset="pbtBlue"
          clip
          color="#2457c5"
          roughnessMap={noise}
          roughness={0.45}
          cutColor="#173a85"
        />
      </mesh>
      {/* Phenolic insert with the carbon track. */}
      <mesh position={[0, top + 0.01, 0]}>
        <cylinderGeometry args={[3.15, 3.15, 0.04, 48]} />
        <Material clip preset="phenolic" color="#7c5a35" roughness={0.6} />
      </mesh>
      <mesh geometry={trackGeo} position={[0, top + 0.03, 0]}>
        <Material clip preset="carbonFilm" color="#24211e" roughness={0.75} />
      </mesh>
      <Anchor name="track" position={[-2.4, top, -1]} />
      {/* Value code printed on the front edge of the base. */}
      <mesh position={[0, OT.T / 2, OT.D / 2 + 0.01]}>
        <planeGeometry args={[2.6, 0.95]} />
        <Material
          clip
          preset="epoxyBlack"
          color="#ffffff"
          map={print}
          transparent
          depthWrite={false}
          roughness={0.5}
        />
      </mesh>

      {/* Rotor with the cross slot and the wiper under its pointer. */}
      <Explode offset={[0, 4.5, 0]}>
        <group position={[0, top + 0.28, 0]} rotation={[0, angle, 0]}>
          <mesh geometry={rotorGeo} position={[0, 0.12, 0]}>
            <Material preset="nylonNatural" clip color="#d3cdbd" roughness={0.62} />
          </mesh>
          {[0, Math.PI / 2].map((a) => (
            <mesh key={a} position={[0, 1.12, 0]} rotation={[0, a, 0]}>
              <boxGeometry args={[3.0, 0.08, 0.5]} />
              <Material clip preset="epoxyBlack" color="#8d877a" roughness={0.8} />
            </mesh>
          ))}
        </group>
      </Explode>
      {/* Wiper: bent spring contact on the track, under the pointer. */}
      <Explode offset={[0, 2.2, 0]} delay={0.1}>
        <group position={[0, top + 0.28, 0]} rotation={[0, angle, 0]}>
          <mesh position={[0, -0.12, 2.35]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.7, 0.1, 1.0]} />
            <Material preset="nickel" color="#ddd5c0" roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.1, 1.2]}>
            <boxGeometry args={[0.9, 0.1, 1.6]} />
            <Material preset="nickel" color="#ddd5c0" roughness={0.3} />
          </mesh>
          <Anchor name="wiper" position={[0, -0.1, 2.4]} />
        </group>
      </Explode>
      {/* Centre eyelet (wiper connection). */}
      <mesh geometry={ringGeo} position={[0, top + 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Material clip preset="tin" />
      </mesh>

      {/* Flat pins: two in front (track ends), one behind (wiper). */}
      {(
        [
          [-2.5, 2.5],
          [0, -2.5],
          [2.5, 2.5],
        ] as const
      ).map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (0.6 - lift) / 2, z]}>
          <boxGeometry args={[0.8, lift + 0.6, 0.3]} />
          <Material preset="tin" roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
