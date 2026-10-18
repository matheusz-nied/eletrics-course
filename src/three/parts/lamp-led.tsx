/**
 * LED bulb A60 with E27 cap (typical catalogue size: Ø 60 × 108 mm): white
 * opal polycarbonate diffuser, white plastic neck over an aluminium heat
 * spreader, aluminium-core LED board with SMD 2835 LEDs and the small
 * switching driver board inside the neck. The diffuser glows with the colour
 * temperature of the light (2700 K warm white to 6500 K daylight).
 */
import { useMemo } from 'react';
import { Color } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { blackbodyColor } from '../fx/blackbody';
import { emission, GLOW, GlowSprite } from '../fx/glow';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { useDisposable, Wire } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import { E27Base } from './_power-e27';
import { lathe, shellProfile } from './_power-shared';

export interface LampLedProps {
  /** Rated power (W). */
  watts?: number;
  /** 0 = off, 1 = rated light output. */
  brightness?: number;
  /** Correlated colour temperature (K): 2700, 4000 or 6500. */
  colorTemperature?: number;
}

/** Efficacy of a typical A60 LED bulb (lm/W). */
const LUMENS_PER_WATT = 90;
const DOME_CENTER = 77;
const DOME_R = 30;
const JOINT_Y = 58.6;
const BOARD_Y = 57.4;

export const meta: PartMeta = {
  id: 'lamp-led',
  label: 'Lâmpada LED',
  category: 'saidas',
  summary:
    'Lâmpada LED A60 com rosca E27: difusor leitoso, placa de LEDs SMD e o pequeno circuito driver escondido no pescoço.',
  defaults: { watts: 9, brightness: 1, colorTemperature: 6500 },
  controls: {
    watts: {
      kind: 'select',
      label: 'Potência',
      options: [5, 7, 9, 12, 15].map((w) => ({ value: w, label: `${w} W` })),
    },
    brightness: { kind: 'number', label: 'Brilho', min: 0, max: 1, step: 0.01 },
    colorTemperature: {
      kind: 'select',
      label: 'Cor da luz',
      options: [
        { value: 2700, label: '2.700 K (branco quente)' },
        { value: 4000, label: '4.000 K (branco neutro)' },
        { value: 6500, label: '6.500 K (branco frio)' },
      ],
    },
  },
  annotations: [
    { at: [0, 100, 0], text: 'Difusor leitoso: espalha a luz dos LEDs', exploded: false },
    { at: [-20, 44, 8], text: 'Pescoço: dissipa o calor do driver e dos LEDs', exploded: false },
    { at: [13, 15, 0], text: 'Rosca E27: ligar ao neutro', exploded: false },
    { at: [0, 0, 0], text: 'Contato central: fase, pelo interruptor', exploded: false },
    { at: [0, 0, 0], text: 'LEDs SMD sobre placa de alumínio', anchor: 'leds' },
    {
      at: [0, 0, 0],
      text: 'Driver: transforma 127/220 V CA em corrente contínua',
      anchor: 'driver',
    },
    { at: [0, 0, 0], text: 'Capacitor eletrolítico de filtro', anchor: 'cap', exploded: true },
    { at: [0, 0, 0], text: 'Difusor', anchor: 'dome', exploded: true },
  ],
  explode: true,
  cutaway: true,
  describe: (p) => {
    const watts = Number(p.watts);
    const k = Number(p.colorTemperature);
    const tone = k <= 3000 ? 'branco quente' : k >= 5500 ? 'branco frio' : 'branco neutro';
    const lm = Math.round((watts * LUMENS_PER_WATT) / 10) * 10;
    const state =
      Number(p.brightness) > 0
        ? `acesa a ${formatNumber(Math.round(Number(p.brightness) * 100))} %`
        : 'apagada';
    return `Lâmpada LED A60 de ${formatNumber(watts)} W (cerca de ${formatNumber(lm, 4)} lm), luz ${tone} de ${formatNumber(k, 4)} K, rosca E27, ${state}.`;
  },
  view: [0.55, 0.45, 1.5],
};

export default function LampLed(props: LampLedProps) {
  const p = { ...meta.defaults, ...props } as Required<LampLedProps>;
  const level = Math.min(Math.max(p.brightness, 0), 1.2);
  const lightColor = useMemo(() => blackbodyColor(p.colorTemperature), [p.colorTemperature]);
  const lumens = Math.round((p.watts * LUMENS_PER_WATT) / 10) * 10;
  const ledCount = p.watts <= 5 ? 8 : p.watts <= 9 ? 12 : 16;

  const housingProfile = useMemo<[number, number][]>(
    () => [
      [13.05, 24.3],
      [13.35, 25.6],
      [14.3, 28.6],
      [16.0, 33.0],
      [18.4, 38.0],
      [21.0, 43.4],
      [23.3, 48.8],
      [24.9, 53.4],
      [25.5, 56.2],
      [25.4, 57.4],
      [24.7, 57.8],
    ],
    [],
  );
  const housing = useDisposable(
    () => lathe(shellProfile(housingProfile, 1.3), 64),
    [housingProfile],
  );
  // Aluminium heat spreader under the plastic.
  const spreader = useDisposable(
    () =>
      lathe(
        shellProfile(
          housingProfile.slice(2, -2).map(([r, y]) => [r - 1.5, y] as [number, number]),
          0.8,
        ),
        48,
      ),
    [housingProfile],
  );
  const ring = useDisposable(
    () =>
      lathe(
        [
          [23.0, 57.0],
          [25.0, 57.0],
          [25.25, 57.4],
          [25.2, 58.9],
          [24.6, 59.2],
          [23.0, 59.2],
        ],
        64,
        { angle: 40 },
      ),
    [],
  );
  const dome = useDisposable(() => {
    const start = Math.asin((JOINT_Y - DOME_CENTER) / DOME_R);
    const outer: [number, number][] = [[Math.cos(start) * DOME_R - 0.6, JOINT_Y - 0.4]];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const a = start + ((Math.PI / 2 - start) * i) / steps;
      outer.push([DOME_R * Math.cos(a), DOME_CENTER + DOME_R * Math.sin(a)]);
    }
    return lathe(shellProfile(outer, 1.0), 64, { angle: 60 });
  }, []);

  // Specs printed around the neck, light grey on white.
  const neckMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#f2f1ec';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(110,112,116,0.9)';
      const text = `${formatNumber(p.watts)}W   ~127-220V 50/60Hz   ${formatNumber(p.colorTemperature, 4)}K   ${formatNumber(lumens, 4)}lm   A60 E27   `;
      ctx.font = `500 ${Math.round(h * 0.05)}px ${FONT_SANS}`;
      ctx.textBaseline = 'middle';
      const width = ctx.measureText(text).width;
      const repeats = Math.max(1, Math.floor(w / width));
      for (let i = 0; i < repeats; i++) ctx.fillText(text, (i * w) / repeats + 6, h * 0.52);
    },
    `${p.watts}|${p.colorTemperature}|${lumens}`,
    { width: 2048, height: 256, fonts: [`500 24px ${FONT_SANS}`] },
  );

  // The dome is brightest at the top, dimmer towards the neck.
  const domeGlowMap = useCanvasTexture(
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#e8e8e8');
      g.addColorStop(1, '#7a7a7a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    'led-dome-glow',
    { width: 4, height: 128 },
  );

  const domeGlow = emission(lightColor, level, GLOW * 0.75);
  const chipGlow = emission(lightColor, level, GLOW * 1.4);
  const phosphor = useMemo(
    () =>
      `#${new Color('#f2d65a')
        .lerp(
          new Color('#f5b347'),
          p.colorTemperature <= 3000 ? 0.7 : p.colorTemperature <= 4500 ? 0.3 : 0,
        )
        .getHexString()}`,
    [p.colorTemperature],
  );
  const leds = useMemo(() => {
    const out: { x: number; z: number; a: number }[] = [];
    const outer = ledCount >= 12 ? ledCount - 4 : ledCount;
    for (let i = 0; i < outer; i++) {
      const a = (i / outer) * Math.PI * 2;
      out.push({ x: Math.cos(a) * 15.5, z: Math.sin(a) * 15.5, a });
    }
    if (ledCount >= 12) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        out.push({ x: Math.cos(a) * 8, z: Math.sin(a) * 8, a });
      }
    }
    return out;
  }, [ledCount]);
  const lightAt: Vec3 = [0, 80, 0];

  return (
    <group>
      <E27Base finish="nickel" clip />

      {/* Plastic neck over the aluminium heat spreader. */}
      <mesh geometry={housing}>
        <Material
          preset="absWhite"
          color="#ffffff"
          map={neckMap}
          roughness={0.55}
          clip
          cutColor="#d8d6cf"
        />
      </mesh>
      <mesh geometry={spreader}>
        <Material preset="aluminum" color="#c4c7cb" roughness={0.62} clip cutColor="#a9adb2" />
      </mesh>
      <mesh geometry={ring}>
        <Material preset="brushedAluminum" clip cutColor="#a9adb2" />
      </mesh>

      {/* LED board: aluminium core, white solder mask, SMD 2835 LEDs. */}
      <Explode offset={[0, 26, 0]} delay={0.1}>
        <group position={[0, BOARD_Y, 0]}>
          <mesh>
            <cylinderGeometry args={[22.4, 22.4, 1.5, 64]} />
            <Material preset="aluminum" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.77, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[22.2, 64]} />
            <Material preset="absWhite" roughness={0.4} clearcoat={0.5} />
          </mesh>
          {leds.map((led, i) => (
            <group key={i} position={[led.x, 0.75, led.z]} rotation={[0, -led.a, 0]}>
              <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[3.5, 0.8, 2.8]} />
                <Material preset="absWhite" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[2.9, 2.2]} />
                <Material
                  color={phosphor}
                  roughness={0.5}
                  emissive={chipGlow.emissive}
                  emissiveIntensity={chipGlow.emissiveIntensity}
                />
              </mesh>
            </group>
          ))}
          {/* Two wire pads. */}
          {([-1, 1] as const).map((side) => (
            <mesh key={side} position={[side * 3, 0.8, -3]}>
              <boxGeometry args={[2.2, 0.12, 1.6]} />
              <Material preset="solder" />
            </mesh>
          ))}
          <Anchor name="leds" position={[leds[0]?.x ?? 15, 1.6, leds[0]?.z ?? 0]} />
        </group>
      </Explode>

      {/* Driver board standing in the neck. */}
      <Explode offset={[48, 6, 0]} delay={0.25}>
        <Driver />
      </Explode>

      {/* Opal diffuser. */}
      <Explode offset={[0, 52, 0]}>
        <mesh geometry={dome}>
          <Material
            preset="absWhite"
            color="#fbfbf8"
            roughness={0.32}
            clearcoat={0.4}
            clearcoatRoughness={0.4}
            sheen={0.3}
            sheenColor="#ffffff"
            emissive={domeGlow.emissive}
            emissiveIntensity={domeGlow.emissiveIntensity}
            emissiveMap={domeGlowMap}
            clip
            cutColor="#f4f4f0"
          />
        </mesh>
        <Anchor name="dome" position={[DOME_R * 0.7, DOME_CENTER + DOME_R * 0.7, 0]} />
        {level > 0.01 && (
          <>
            <GlowSprite
              always
              color={lightColor}
              intensity={level * 0.35}
              size={66}
              position={lightAt}
            />
            <pointLight
              position={[0, 64, 0]}
              color={lightColor}
              intensity={level * 900}
              decay={2}
            />
          </>
        )}
      </Explode>
    </group>
  );
}

/** Non-isolated buck driver: fuse resistor, bridge, filter capacitor, IC, inductor. */
function Driver() {
  const label = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#e8e2d2';
      fitText(ctx, '400V 4,7µF', w / 2, h / 2, w * 0.9, h * 0.5, { weight: 600 });
    },
    'led-driver-cap',
    { width: 256, height: 64, fonts: [`600 24px ${FONT_SANS}`] },
  );
  const boardTop = 54;
  const boardBottom = 29;
  const h = boardTop - boardBottom;
  return (
    <group position={[0, 0, 0]}>
      {/* FR-4 board, vertical in the XY plane. */}
      <mesh position={[0, boardBottom + h / 2, 0]}>
        <boxGeometry args={[15, h, 1.0]} />
        <Material preset="fr4" color="#c9b77c" />
      </mesh>
      <mesh position={[0, boardBottom + h / 2, 0.51]}>
        <planeGeometry args={[14.6, h - 0.4]} />
        <Material preset="solderMask" />
      </mesh>
      {/* Filter capacitor lying on the board. */}
      <group position={[-2, 44, 4.6]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[4, 4, 11, 32]} />
          <Material preset="sleeve" color="#1d2f6d" />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[4.03, 4.03, 7, 32, 1, true, -0.6, 1.2]} />
          <Material color="#ffffff" map={label} transparent roughness={0.4} />
        </mesh>
        <mesh position={[0, 5.55, 0]}>
          <cylinderGeometry args={[3.7, 3.7, 0.2, 32]} />
          <Material preset="aluminum" />
        </mesh>
        <Anchor name="cap" position={[0, 5.6, 2]} />
      </group>
      {/* Drum inductor. */}
      <group position={[3.6, 35.4, 3.6]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[3, 3, 0.8, 24]} />
          <Material preset="ferrite" />
        </mesh>
        <mesh position={[0, 2.4, 0]}>
          <cylinderGeometry args={[2.5, 2.5, 4, 24]} />
          <Material preset="magnetWire" />
        </mesh>
        <mesh position={[0, 4.6, 0]}>
          <cylinderGeometry args={[3, 3, 0.6, 24]} />
          <Material preset="ferrite" />
        </mesh>
      </group>
      {/* Driver IC (SOP-8) and bridge rectifier. */}
      <mesh position={[-3.6, 34, 1.3]}>
        <boxGeometry args={[4, 5, 1.5]} />
        <Material preset="epoxyBlack" />
      </mesh>
      <mesh position={[-3.6, 38.8, 1.1]}>
        <boxGeometry args={[3.8, 4.6, 1.2]} />
        <Material preset="epoxyBlack" />
      </mesh>
      <mesh position={[3.4, 50.5, 0.95]}>
        <boxGeometry args={[3.2, 1.6, 0.9]} />
        <Material preset="epoxyBlack" />
      </mesh>
      {/* Fusible resistor down to the cap, and the wires up to the LED board. */}
      <Wire
        points={[
          [-5.4, boardBottom + 0.5, 0],
          [-5.4, 24, 0],
          [-9.6, 18, 0],
          [-11.8, 12, 0],
        ]}
        radius={0.3}
      />
      <mesh position={[-5.4, 26.4, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 3.6, 16]} />
        <Material preset="lacquer" color="#5d7fb3" />
      </mesh>
      <Wire
        points={[
          [4.6, boardBottom + 0.5, 0],
          [4.6, 22, 0],
          [0.4, 9, 0],
          [0, 2.2, 0],
        ]}
        radius={0.3}
      />
      {([-1, 1] as const).map((side) => (
        <Wire
          key={side}
          points={[
            [side * 3, boardTop - 0.5, 0],
            [side * 3, BOARD_Y + 0.8, -1.5],
            [side * 3, BOARD_Y + 0.9, -3],
          ]}
          radius={0.35}
          material={{ preset: 'pvc', color: side < 0 ? '#1d1d1f' : '#d23a2a' }}
        />
      ))}
      <Anchor name="driver" position={[4.5, 52.5, 0.8]} />
    </group>
  );
}
