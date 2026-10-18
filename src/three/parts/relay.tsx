/**
 * PCB power relay, "sugar cube" type (one changeover contact, 10 A): body
 * 19,0 × 15,5 × 15,0 mm, five pins (coil 1, coil 2, COM, NC, NO). Dimensions
 * from the typical datasheets of the T73 / SRD family (Ningbo Songle SRD,
 * Hongfa JQC-3F): coil pins 12 mm apart, contact pins 12 mm apart, pins
 * 3,5 mm long. Inside: bobbin with enamelled wire around an iron core, L
 * yoke, hinged armature with the moving contact blade (COM) between the NC
 * contact (above) and the NO contact (below), and the return spring. The
 * armature moves smoothly when `energized` changes.
 */
import { useRef } from 'react';
import { type Group } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_MONO, FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { roundedCylinderProfile, axialLathe, tube } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta } from '../types';
import { HelixCurve, roundedBox, shellGeometry } from './_em-geometry';
import { Decal, Pin, useSmooth } from './_em-kit';

export interface RelayProps {
  /** Coil voltage (V DC): 5, 12 or 24. */
  coilVoltage?: number;
  /** Coil energized: armature pulled, COM on NO. */
  energized?: boolean;
  /** Clear cover that shows the mechanism. */
  transparentCover?: boolean;
}

/** Body (mm). */
const L = 19;
const W = 15.5;
const H = 15;
/** Pin length below the body and stand-off height. */
const PIN = 3.5;
const STANDOFF = 0.4;
/** Height of the body bottom above the pin tips (for scenes that seat the relay on a board). */
export const RELAY_SEAT = PIN + STANDOFF;

/** Pin positions (x, z) in the body, bottom view mirrored: coil, COM, NO, NC. */
export const RELAY_PINS = {
  coil1: [-5, 6] as const,
  coil2: [-5, -6] as const,
  com: [-7.4, 0] as const,
  no: [7.8, -6] as const,
  nc: [7.8, 6] as const,
};

/** Typical coil data of this relay family (resistance, Ω). */
const COIL: Record<number, { ohms: number; wire: number }> = {
  5: { ohms: 70, wire: 0.18 },
  12: { ohms: 400, wire: 0.11 },
  24: { ohms: 1600, wire: 0.08 },
};

/** Mechanism (body coordinates, base top at y = 1,6). */
const BASE_TOP = 1.6;
const PIVOT: [number, number] = [-7, 10.6];
const CORE_X = -2.1;
/** Armature opening when released (rad). */
const OPEN_ANGLE = 0.07;
const CONTACT_LOCAL_X = 13.2;

export const meta: PartMeta = {
  id: 'relay',
  label: 'Relé',
  category: 'eletromecanicos',
  summary:
    'Relé de placa com um contato reversível (COM, NA e NF), com a bobina, a armadura e os contatos por dentro.',
  defaults: { coilVoltage: 12, energized: false, transparentCover: false },
  controls: {
    coilVoltage: {
      kind: 'select',
      label: 'Tensão da bobina',
      options: [
        { value: 5, label: '5 V' },
        { value: 12, label: '12 V' },
        { value: 24, label: '24 V' },
      ],
    },
    energized: { kind: 'toggle', label: 'Bobina energizada' },
    transparentCover: { kind: 'toggle', label: 'Tampa transparente' },
  },
  annotations: (p) => {
    const inside = p.transparentCover ? undefined : true;
    return [
      {
        at: [0, 0, 0],
        text: 'Bobina: fio de cobre esmaltado em volta de um núcleo de ferro',
        anchor: 'bobina',
        exploded: inside,
      },
      {
        at: [0, 0, 0],
        text: 'Armadura: a bobina energizada puxa esta chapa de ferro',
        anchor: 'armadura',
        exploded: inside,
      },
      {
        at: [0, 0, 0],
        text: 'Contato comum (C): lâmina que se move com a armadura',
        anchor: 'comum',
        exploded: inside,
      },
      {
        at: [0, 0, 0],
        text: 'Contato NA: só fecha com a bobina energizada',
        anchor: 'na',
        exploded: inside,
      },
      {
        at: [0, 0, 0],
        text: 'Contato NF: fechado com a bobina desligada',
        anchor: 'nf',
        exploded: inside,
      },
      {
        at: [0, 0, 0],
        text: 'Mola: devolve a armadura quando a bobina desliga',
        anchor: 'mola',
        exploded: inside,
      },
      {
        at: [RELAY_PINS.coil1[0], 1, RELAY_PINS.coil1[1]],
        text: 'Pinos da bobina',
        exploded: false,
      },
      {
        at: [RELAY_PINS.no[0], 1, RELAY_PINS.no[1]],
        text: 'Pino NA',
        exploded: false,
      },
      {
        at: [RELAY_PINS.nc[0], 1, RELAY_PINS.nc[1]],
        text: 'Pino NF',
        exploded: false,
      },
      {
        at: [RELAY_PINS.com[0], 1, RELAY_PINS.com[1]],
        text: 'Pino comum (C)',
        exploded: false,
      },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const v = coilVoltageOf(p.coilVoltage);
    const coil = COIL[v]!;
    const ma = (v / coil.ohms) * 1000;
    const state = p.energized
      ? 'Bobina energizada: a armadura foi puxada e o comum (C) encosta no contato NA.'
      : 'Bobina desligada: a mola segura a armadura e o comum (C) encosta no contato NF.';
    return `Relé de ${v} V com um contato reversível de 10 A em 250 VCA. Bobina de cerca de ${formatNumber(coil.ohms)} Ω (${formatNumber(ma, 2)} mA). ${state}${p.transparentCover ? ' Tampa transparente.' : ''}`;
  },
  view: [0.95, 0.8, 1.35],
};

function coilVoltageOf(value: unknown): number {
  const v = Number(value);
  return v === 5 || v === 24 ? v : 12;
}

export default function Relay(props: RelayProps) {
  const p = { ...meta.defaults, ...props } as Required<RelayProps>;
  const volts = coilVoltageOf(p.coilVoltage);
  const coil = COIL[volts]!;
  const clear = p.transparentCover;
  const armature = useRef<Group>(null);
  const spring = useRef<Group>(null);

  useSmooth(
    [p.energized ? 0 : OPEN_ANGLE],
    ([angle]) => {
      if (armature.current) armature.current.rotation.z = angle!;
      // The spring hangs from the armature tail (behind the hinge).
      if (spring.current) spring.current.scale.y = 1 + (OPEN_ANGLE - angle!) * 0.35;
    },
    16,
  );

  const cover = useDisposable(() => shellGeometry(L, H, W, 0.9, 0.7, 0.6, 0.7), []);
  const base = useDisposable(() => roundedBox(L - 1.3, BASE_TOP, W - 1.3, 0.4, 0.15), []);
  const rivet = useDisposable(
    () => axialLathe(roundedCylinderProfile(0.82, 0, 1.05, 0.3, 5), 28),
    [],
  );
  const fixedRivet = useDisposable(
    () => axialLathe(roundedCylinderProfile(0.95, 0, 0.42, 0.18, 4), 28),
    [],
  );
  const springGeometry = useDisposable(
    () => tube(new HelixCurve(0.32, 3.2, 11, 0.5), 0.07, { radial: 6, segments: 260 }),
    [],
  );

  // Winding: one bump stripe per turn of wire (thicker wire for 5 V coils).
  const turns = Math.round(6.6 / coil.wire);
  const windingBump = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      const step = h / turns;
      for (let i = 0; i < turns; i++) {
        const g = ctx.createLinearGradient(0, i * step, 0, (i + 1) * step);
        g.addColorStop(0, '#2a2a2a');
        g.addColorStop(0.5, '#f0f0f0');
        g.addColorStop(1, '#2a2a2a');
        ctx.fillStyle = g;
        ctx.fillRect(0, i * step, w, step);
      }
    },
    `${turns}`,
    { width: 8, height: 1024, color: false },
  );

  const windingMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const step = h / turns;
      for (let i = 0; i < turns; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(60,20,5,0.28)' : 'rgba(255,220,180,0.12)';
        ctx.fillRect(0, i * step + step * 0.72, w, step * 0.28);
      }
    },
    `${turns}|map`,
    { width: 8, height: 1024 },
  );

  const ink = clear ? '#1b2333' : '#f4f6fa';
  const topLabel = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = ink;
      fitText(ctx, `${volts}VDC`, w * 0.36, h * 0.2, w * 0.62, h * 0.2, {
        weight: 800,
        family: FONT_SANS,
      });
      fitText(ctx, '10A 250VAC  10A 125VAC', w * 0.5, h * 0.44, w * 0.92, h * 0.1, {
        weight: 600,
        family: FONT_MONO,
      });
      fitText(ctx, '10A 30VDC  10A 28VDC', w * 0.5, h * 0.58, w * 0.92, h * 0.1, {
        weight: 600,
        family: FONT_MONO,
      });
      fitText(ctx, `RL-${volts}VDC-1C`, w * 0.5, h * 0.74, w * 0.8, h * 0.11, {
        weight: 700,
        family: FONT_MONO,
      });
      // Contact diagram (top view): coil and changeover contact.
      ctx.strokeStyle = ink;
      ctx.lineWidth = w * 0.008;
      const x0 = w * 0.74;
      const y0 = h * 0.08;
      const s = w * 0.2;
      ctx.strokeRect(x0, y0 + s * 0.1, s * 0.34, s * 0.6);
      ctx.beginPath();
      ctx.moveTo(x0, y0 + s * 0.7);
      ctx.lineTo(x0 + s * 0.34, y0 + s * 0.1);
      ctx.moveTo(x0 + s * 0.6, y0 + s * 0.75);
      ctx.lineTo(x0 + s * 0.6, y0 + s * 0.42);
      ctx.lineTo(x0 + s * 0.9, y0 + s * 0.16);
      ctx.moveTo(x0 + s * 0.88, y0 + s * 0.05);
      ctx.lineTo(x0 + s * 0.88, y0 + s * 0.22);
      ctx.moveTo(x0 + s * 1.0, y0 + s * 0.05);
      ctx.lineTo(x0 + s * 1.0, y0 + s * 0.4);
      ctx.stroke();
      ctx.fillStyle = ink;
      fitText(ctx, 'NF  NA', x0 + s * 0.94, y0 + s * 0.9, s * 0.8, h * 0.06, {
        weight: 600,
        family: FONT_SANS,
      });
      fitText(ctx, 'C', x0 + s * 0.6, y0 + s * 0.9, s * 0.3, h * 0.06, {
        weight: 600,
        family: FONT_SANS,
      });
      ctx.fillRect(w * 0.06, h * 0.88, w * 0.88, h * 0.012);
    },
    `${volts}|${ink}`,
    { width: 1024, height: 776, fonts: [`800 40px ${FONT_SANS}`, `600 40px ${FONT_MONO}`] },
  );

  const sideLabel = useCanvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = ink;
      fitText(ctx, `COIL ${volts}VDC  ${coil.ohms}Ω`, w / 2, h * 0.3, w * 0.9, h * 0.3, {
        weight: 600,
        family: FONT_MONO,
      });
      fitText(ctx, 'SPDT  1C', w / 2, h * 0.72, w * 0.6, h * 0.26, {
        weight: 600,
        family: FONT_MONO,
      });
    },
    `${volts}|${ink}|side`,
    { width: 512, height: 128, fonts: [`600 40px ${FONT_MONO}`] },
  );

  const contactMetal = { color: '#d8d5cd', metalness: 1, roughness: 0.26 };
  const bronze = { color: '#d39a62', metalness: 1, roughness: 0.24 };
  const terminal = { preset: 'copper' as const, color: '#d9a27a', roughness: 0.3 };

  // Positions of the fixed contacts (touch the moving rivet at the end of travel).
  const contactX = PIVOT[0] + CONTACT_LOCAL_X;
  const rivetBottomOn = PIVOT[1] + 0.25;
  const rivetTopOff = PIVOT[1] + 0.25 + 1.05 + CONTACT_LOCAL_X * Math.sin(OPEN_ANGLE);
  const noTop = rivetBottomOn;
  const ncBottom = rivetTopOff;

  return (
    <group position={[0, RELAY_SEAT, 0]}>
      {/* Cover. */}
      <Explode offset={[0, 34, 0]} delay={0}>
        <mesh geometry={cover}>
          {clear ? (
            <Material
              preset="polycarbonate"
              clip
              thickness={0.6}
              roughness={0.05}
              color="#f6f9ff"
              cutColor="#c9d4e4"
            />
          ) : (
            <Material
              color="#1d4fb8"
              roughness={0.36}
              clearcoat={0.35}
              clearcoatRoughness={0.4}
              clip
              cutColor="#173e8f"
            />
          )}
        </mesh>
        <Decal
          map={topLabel}
          width={L - 2}
          height={W - 2.6}
          position={[0, H + 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          roughness={0.5}
          clip
        />
        <Decal
          map={sideLabel}
          width={L - 4}
          height={(L - 4) / 4}
          position={[0, H * 0.55, W / 2 + 0.01]}
          clip
        />
      </Explode>

      {/* Base with the coil pins. */}
      <Explode offset={[0, -9, 0]}>
        <mesh geometry={base}>
          <Material preset="pbtBlack" roughness={0.7} />
        </mesh>
        {/* Stand-offs under the base. */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[0.5 + sx * 2.5, -STANDOFF / 2, sz * 6.2]}>
              <boxGeometry args={[1.6, STANDOFF, 1.4]} />
              <Material preset="pbtBlack" roughness={0.75} />
            </mesh>
          )),
        )}
        {(['coil1', 'coil2'] as const).map((id) => {
          const [x, z] = RELAY_PINS[id];
          return (
            <group key={id}>
              <Pin x={x} z={z} bottom={-RELAY_SEAT} top={BASE_TOP} width={0.6} thickness={0.45} />
              {/* Post where the coil wire is soldered. */}
              <mesh position={[x, BASE_TOP + 1, z]}>
                <boxGeometry args={[0.6, 2, 0.45]} />
                <Material preset="tin" />
              </mesh>
              <mesh position={[x, BASE_TOP + 1.9, z]}>
                <sphereGeometry args={[0.42, 12, 8]} />
                <Material preset="solder" />
              </mesh>
            </group>
          );
        })}
      </Explode>

      {/* Magnetic circuit: yoke (with the COM pin), core and coil. */}
      <Explode offset={[-15, 3, 0]} delay={0.1}>
        <mesh position={[-3.2, BASE_TOP + 0.4, 0]}>
          <boxGeometry args={[9.2, 0.8, 5.2]} />
          <Material preset="zinc" color="#c9ccc6" />
        </mesh>
        <mesh position={[-7.4, (BASE_TOP + PIVOT[1]) / 2, 0]}>
          <boxGeometry args={[0.8, PIVOT[1] - BASE_TOP, 6.4]} />
          <Material preset="zinc" color="#c9ccc6" />
        </mesh>
        {/* Tab where the spring hooks. */}
        <mesh position={[-8.1, 6.4, 0]}>
          <boxGeometry args={[0.6, 0.6, 1.2]} />
          <Material preset="zinc" color="#c9ccc6" />
        </mesh>
        <Pin
          x={RELAY_PINS.com[0]}
          z={RELAY_PINS.com[1]}
          bottom={-RELAY_SEAT}
          top={BASE_TOP}
          width={0.5}
          thickness={1.2}
        />
        {/* Iron core and pole face. */}
        <mesh position={[CORE_X, (BASE_TOP + 0.8 + PIVOT[1] - 0.6) / 2, 0]}>
          <cylinderGeometry args={[1.5, 1.5, PIVOT[1] - 0.6 - BASE_TOP - 0.8, 24]} />
          <Material preset="steel" color="#9a9ea3" roughness={0.45} />
        </mesh>
        <mesh position={[CORE_X, PIVOT[1] - 0.3, 0]}>
          <cylinderGeometry args={[2.2, 2.2, 0.6, 32]} />
          <Material preset="steel" color="#a7aaae" roughness={0.3} />
        </mesh>
        {/* Bobbin flanges and the enamelled winding. */}
        <mesh position={[CORE_X, BASE_TOP + 0.8 + 0.25, 0]}>
          <cylinderGeometry args={[4.4, 4.4, 0.5, 40]} />
          <Material preset="nylonNatural" clip cutColor="#cfc8b4" />
        </mesh>
        <mesh position={[CORE_X, PIVOT[1] - 0.85, 0]}>
          <cylinderGeometry args={[4.4, 4.4, 0.5, 40]} />
          <Material preset="nylonNatural" clip cutColor="#cfc8b4" />
        </mesh>
        <mesh position={[CORE_X, (BASE_TOP + 1.3 + PIVOT[1] - 1.1) / 2, 0]}>
          <cylinderGeometry args={[1.75, 1.75, PIVOT[1] - 1.1 - BASE_TOP - 1.3, 24]} />
          <Material preset="nylonNatural" clip cutColor="#cfc8b4" />
        </mesh>
        <mesh position={[CORE_X, (BASE_TOP + 1.3 + PIVOT[1] - 1.1) / 2, 0]}>
          <cylinderGeometry args={[3.9, 3.9, PIVOT[1] - 1.1 - BASE_TOP - 1.3, 56, 1, false]} />
          <Material
            preset="magnetWire"
            map={windingMap}
            bumpMap={windingBump}
            bumpScale={0.25}
            clip
            cutColor="#8a3d1a"
          />
        </mesh>
        <Anchor name="bobina" position={[CORE_X + 2.2, 6.2, 3.4]} />
        {/* Coil wire ends going to the posts. */}
        {[1, -1].map((side) => (
          <Wire
            key={side}
            points={[
              [CORE_X - 2.4, BASE_TOP + 1.6, side * 3.2],
              [CORE_X - 2.9, BASE_TOP + 1.9, side * 4.6],
              [RELAY_PINS.coil1[0], BASE_TOP + 1.9, side * 6],
            ]}
            radius={0.07}
            smooth
            material={{ preset: 'magnetWire' }}
          />
        ))}
      </Explode>

      {/* Armature, moving blade (COM contact) and return spring. */}
      <Explode offset={[0, 13, 0]} delay={0.2}>
        <group position={[PIVOT[0], PIVOT[1], 0]}>
          <group ref={armature} rotation={[0, 0, OPEN_ANGLE]}>
            <mesh position={[(7.2 - 1.6) / 2, 0.35, 0]}>
              <boxGeometry args={[7.2 + 1.6, 0.7, 6.8]} />
              <Material preset="zinc" color="#c4c7c1" roughness={0.38} />
            </mesh>
            {/* Blade riveted on the armature. */}
            <mesh position={[(CONTACT_LOCAL_X + 0.9 + 1.6) / 2, 0.775, 0]}>
              <boxGeometry args={[CONTACT_LOCAL_X + 0.9 - 1.6, 0.15, 2.8]} />
              <Material {...bronze} />
            </mesh>
            {[2.6, 4.6].map((x) => (
              <mesh key={x} position={[x, 0.9, 0]}>
                <cylinderGeometry args={[0.5, 0.55, 0.22, 16]} />
                <Material {...bronze} roughness={0.3} />
              </mesh>
            ))}
            <mesh geometry={rivet} position={[CONTACT_LOCAL_X, 0.25, 0]}>
              <Material {...contactMetal} />
            </mesh>
            <Anchor name="comum" position={[CONTACT_LOCAL_X, 1.3, 0]} />
            <Anchor name="armadura" position={[4.6, 0.7, 2.6]} />
            {/* Spring hanging from the tail. */}
            <group ref={spring} position={[-1.25, 0.3, 0]} rotation={[Math.PI, 0, 0]}>
              <mesh geometry={springGeometry}>
                <Material preset="steel" color="#b8bbbf" roughness={0.3} />
              </mesh>
            </group>
            <Anchor name="mola" position={[-1.1, -2, 0]} />
          </group>
        </group>
      </Explode>

      {/* Fixed contacts: NC above the blade, NO below. */}
      <Explode offset={[14, 2, 0]} delay={0.3}>
        {/* NC terminal. */}
        <mesh position={[7.8, (BASE_TOP + ncBottom + 0.82) / 2, 5.6]}>
          <boxGeometry args={[0.4, ncBottom + 0.82 - BASE_TOP, 2.8]} />
          <Material {...terminal} />
        </mesh>
        <mesh position={[contactX, ncBottom + 0.62, 1.9]}>
          <boxGeometry args={[1.9, 0.4, 6]} />
          <Material {...terminal} />
        </mesh>
        <mesh position={[(contactX + 0.95 + 8) / 2, ncBottom + 0.62, 5]}>
          <boxGeometry args={[8 - contactX - 0.95, 0.4, 1.6]} />
          <Material {...terminal} />
        </mesh>
        <mesh
          geometry={fixedRivet}
          position={[contactX, ncBottom + 0.42, 0]}
          rotation={[Math.PI, 0, 0]}
        >
          <Material {...contactMetal} />
        </mesh>
        <Anchor name="nf" position={[contactX, ncBottom + 0.9, 1.2]} />
        <Pin
          x={RELAY_PINS.nc[0]}
          z={RELAY_PINS.nc[1]}
          bottom={-RELAY_SEAT}
          top={BASE_TOP}
          width={0.5}
          thickness={1.2}
        />
        {/* NO terminal. */}
        <mesh position={[7.8, (BASE_TOP + noTop - 0.42) / 2, -5.6]}>
          <boxGeometry args={[0.4, noTop - 0.42 - BASE_TOP, 2.8]} />
          <Material {...terminal} />
        </mesh>
        <mesh position={[contactX, noTop - 0.62, -1.9]}>
          <boxGeometry args={[1.9, 0.4, 6]} />
          <Material {...terminal} />
        </mesh>
        <mesh position={[(contactX + 0.95 + 8) / 2, noTop - 0.62, -5]}>
          <boxGeometry args={[8 - contactX - 0.95, 0.4, 1.6]} />
          <Material {...terminal} />
        </mesh>
        <mesh geometry={fixedRivet} position={[contactX, noTop - 0.42, 0]}>
          <Material {...contactMetal} />
        </mesh>
        <Anchor name="na" position={[contactX, noTop - 0.5, 1.2]} />
        <Pin
          x={RELAY_PINS.no[0]}
          z={RELAY_PINS.no[1]}
          bottom={-RELAY_SEAT}
          top={BASE_TOP}
          width={0.5}
          thickness={1.2}
        />
      </Explode>
    </group>
  );
}
