/**
 * LED 3 mm and 5 mm (through-hole), in the usual colours, clear or diffused,
 * lit by `brightness` (the simulation's `brightness` readout). Dimensions from
 * typical datasheets (Kingbright L-53, L-7104). Inside: the cathode anvil with
 * the reflector cup and the chip, the anode post and the gold bond wire.
 */
import { useMemo } from 'react';
import { Color, DoubleSide, ExtrudeGeometry, Shape } from 'three';
import { Anchor, Explode } from '../core/view';
import { emission, GLOW, GlowSprite } from '../fx/glow';
import { Material } from '../materials/Material';
import { axialLathe, roundedPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta } from '../types';

export type LedColor = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul' | 'branco';

export interface LedProps {
  color?: LedColor;
  /** Body diameter: 3 or 5 mm. */
  size?: 3 | 5;
  lens?: 'difuso' | 'transparente';
  /** 0 = off, 1 = rated current; above 1 the core turns white. */
  brightness?: number;
  /** Burned by overcurrent: the chip is dead and the epoxy browned. */
  burned?: boolean;
  /** Length of the cathode lead below the body (mm); the anode is 2 mm longer. */
  leadLength?: number;
}

/** Light colour (sRGB) and the tint of a diffused lens when off. */
export const LED_COLORS: Record<
  LedColor,
  { light: string; lens: string; label: string; vf: string }
> = {
  vermelho: { light: '#ff2414', lens: '#d8261c', label: 'vermelho', vf: '2,0 V' },
  laranja: { light: '#ff6a0a', lens: '#e86a1c', label: 'laranja', vf: '2,0 V' },
  amarelo: { light: '#ffc800', lens: '#efc12a', label: 'amarelo', vf: '2,1 V' },
  verde: { light: '#24ff4a', lens: '#2fbf4a', label: 'verde', vf: '3,0 V' },
  azul: { light: '#2550ff', lens: '#3058d8', label: 'azul', vf: '3,1 V' },
  branco: { light: '#f2f4ff', lens: '#f4f4f0', label: 'branco', vf: '3,1 V' },
};

/** Datasheet dimensions (mm). */
const SIZES = {
  3: { r: 1.5, flange: 1.9, flangeH: 0.9, height: 5.3, pitch: 2.54 },
  5: { r: 2.5, flange: 2.9, flangeH: 1.0, height: 8.6, pitch: 2.54 },
} as const;

const LEAD = 0.5;

export const meta: PartMeta = {
  id: 'led',
  label: 'LED',
  category: 'semicondutores',
  summary: 'LED de 3 ou 5 mm, aceso ou apagado, com o chip, o refletor e o fio de ouro por dentro.',
  defaults: {
    color: 'vermelho',
    size: 5,
    lens: 'difuso',
    brightness: 1,
    burned: false,
    leadLength: 14,
  },
  controls: {
    color: {
      kind: 'select',
      label: 'Cor',
      options: (Object.keys(LED_COLORS) as LedColor[]).map((c) => ({
        value: c,
        label: LED_COLORS[c].label[0]!.toUpperCase() + LED_COLORS[c].label.slice(1),
      })),
    },
    size: {
      kind: 'select',
      label: 'Diâmetro',
      options: [
        { value: 5, label: '5 mm' },
        { value: 3, label: '3 mm' },
      ],
    },
    lens: {
      kind: 'select',
      label: 'Lente',
      options: [
        { value: 'difuso', label: 'Difusa (colorida)' },
        { value: 'transparente', label: 'Transparente' },
      ],
    },
    brightness: { kind: 'number', label: 'Brilho', min: 0, max: 2, step: 0.05 },
    burned: { kind: 'toggle', label: 'Queimado' },
    leadLength: { kind: 'number', label: 'Terminais', min: 4, max: 27, step: 1, unit: 'mm' },
  },
  annotations: (p) => {
    const s = SIZES[Number(p.size) === 3 ? 3 : 5];
    return [
      { at: [s.pitch / 2, -6, 0], text: 'Ânodo (+): terminal mais longo', exploded: false },
      { at: [-s.pitch / 2, -4, 0], text: 'Cátodo (−): terminal mais curto', exploded: false },
      {
        at: [-s.flange, s.flangeH / 2, 0],
        text: 'Chanfro na borda: lado do cátodo',
        exploded: false,
      },
      { at: [0, s.height * 0.75, 0], text: 'Lente de epóxi', anchor: 'lens', exploded: true },
      { at: [0, 0, 0], text: 'Chip semicondutor: onde a luz nasce', anchor: 'chip' },
      { at: [0, 0, 0], text: 'Fio de ouro até o ânodo', anchor: 'wire', exploded: true },
      { at: [0, 0, 0], text: 'Refletor (copo) no cátodo', anchor: 'cup', exploded: true },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const c = LED_COLORS[(p.color as LedColor) ?? 'vermelho'] ?? LED_COLORS.vermelho;
    const state = p.burned ? 'queimado' : Number(p.brightness) > 0 ? 'aceso' : 'apagado';
    return `LED ${c.label} de ${p.size} mm, lente ${p.lens === 'transparente' ? 'transparente' : 'difusa'}, ${state}. O terminal mais longo é o ânodo (+).`;
  },
  view: [0.9, 0.55, 1.6],
};

export default function Led(props: LedProps) {
  const p = { ...meta.defaults, ...props } as Required<LedProps>;
  const s = SIZES[Number(p.size) === 3 ? 3 : 5];
  const colors = LED_COLORS[p.color] ?? LED_COLORS.vermelho;
  const level = p.burned ? 0 : Math.max(p.brightness, 0);
  const diffused = p.lens !== 'transparente';

  // Dome and cylinder (lathe); the flange with its flat is extruded separately.
  const bodyGeometry = useDisposable(() => {
    const profile: [number, number][] = [[0, s.flangeH]];
    profile.push([s.r, s.flangeH]);
    const domeStart = s.height - s.r;
    profile.push([s.r, domeStart]);
    for (let i = 1; i <= 16; i++) {
      const a = (Math.PI / 2) * (i / 16);
      profile.push([s.r * Math.cos(a), domeStart + s.r * Math.sin(a)]);
    }
    return axialLathe(profile, 48);
  }, [s]);

  const flangeGeometry = useDisposable(() => {
    // Circle with a straight cut on the cathode side (-X).
    const shape = new Shape();
    const flat = s.flange * 0.86;
    const a1 = Math.acos(flat / s.flange);
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = -Math.PI + a1 + ((2 * Math.PI - 2 * a1) * i) / steps;
      const x = s.flange * Math.cos(t);
      const y = s.flange * Math.sin(t);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, {
      depth: s.flangeH - 0.16,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0.08, 0);
    return geometry;
  }, [s]);

  // Gold bond wire from the chip to the anode post.
  const chipY = s.flangeH + s.height * 0.32;
  const postX = s.pitch / 2 - 0.25;
  const wireGeometry = useDisposable(
    () =>
      tube(
        roundedPath(
          [
            [-s.pitch / 2 + 0.55, chipY + 0.16, 0],
            [-0.2, chipY + 1.1, 0],
            [postX - 0.2, chipY + 0.75, 0],
            [postX, chipY + 0.3, 0],
          ],
          0.4,
        ),
        0.025,
        { radial: 6 },
      ),
    [chipY, postX, s],
  );

  const lensColor = useMemo(() => {
    if (!diffused) return '#ffffff';
    return colors.lens;
  }, [diffused, colors.lens]);
  const lensGlow = emission(colors.light, Math.min(level, 1.5) * (diffused ? 1.4 : 0.3), 1);
  const chipGlow = emission(
    level > 1 ? mix(colors.light, '#ffffff', Math.min(level - 1, 1)) : colors.light,
    level,
    GLOW,
  );
  const burnedTint = p.burned ? '#8a6a3a' : lensColor;
  const cathodeX = -s.pitch / 2;
  const anodeX = s.pitch / 2;
  const lead = p.leadLength;

  return (
    <group position={[0, lead + 2, 0]}>
      {/* Epoxy lens and flange. */}
      <Explode offset={[0, s.height * 1.3, 0]}>
        <mesh geometry={bodyGeometry}>
          <Material
            preset="ledEpoxy"
            clip
            color={burnedTint}
            transmission={diffused ? 0.15 : 0.97}
            roughness={diffused ? 0.5 : 0.05}
            thickness={s.r * 2}
            attenuationColor={diffused ? lensColor : '#ffffff'}
            attenuationDistance={diffused ? s.r * 1.2 : 1000}
            emissive={lensGlow.emissive}
            emissiveIntensity={lensGlow.emissiveIntensity}
            cutColor={diffused ? new Color(lensColor).multiplyScalar(0.8) : '#d9dde3'}
          />
        </mesh>
        <mesh geometry={flangeGeometry}>
          <Material
            preset="ledEpoxy"
            clip
            color={burnedTint}
            transmission={diffused ? 0.15 : 0.95}
            roughness={0.3}
            thickness={1}
            emissive={lensGlow.emissive}
            emissiveIntensity={lensGlow.emissiveIntensity * 0.6}
            cutColor={diffused ? new Color(lensColor).multiplyScalar(0.8) : '#d9dde3'}
          />
        </mesh>
        <Anchor name="lens" position={[s.r * 0.7, s.height * 0.8, 0]} />
        <GlowSprite
          always
          color={colors.light}
          intensity={Math.min(level, 1.5) * (diffused ? 0.75 : 0.5)}
          size={s.r * 6}
          position={[0, s.height * 0.6, 0]}
        />
      </Explode>

      {/* Cathode: lead, anvil with the reflector cup and the chip. */}
      <group>
        <mesh position={[cathodeX, (chipY - 0.3 - -lead) / 2 - lead, 0]}>
          <boxGeometry args={[LEAD, chipY - 0.3 + lead, LEAD]} />
          <Material preset="tin" />
        </mesh>
        <mesh position={[cathodeX + 0.35, chipY - 0.45, 0]}>
          <boxGeometry args={[1.6, 0.9, 0.45]} />
          <Material preset="tin" roughness={0.22} />
        </mesh>
        {/* Reflector cup. */}
        <mesh position={[cathodeX + 0.55, chipY, 0]}>
          <cylinderGeometry args={[0.48, 0.28, 0.35, 24, 1, true]} />
          <Material preset="tin" roughness={0.15} side={DoubleSide} />
        </mesh>
        <mesh position={[cathodeX + 0.55, chipY + 0.08, 0]}>
          <boxGeometry args={[0.3, 0.16, 0.3]} />
          <Material
            preset="epoxyBlack"
            color={p.burned ? '#141010' : p.color === 'branco' ? '#e9d36a' : '#3a3a40'}
            roughness={0.4}
            emissive={chipGlow.emissive}
            emissiveIntensity={chipGlow.emissiveIntensity}
          />
        </mesh>
        <Anchor name="chip" position={[cathodeX + 0.55, chipY + 0.2, 0]} />
        <Anchor name="cup" position={[cathodeX + 0.1, chipY - 0.2, 0]} />
        <mesh geometry={wireGeometry}>
          <Material preset="gold" />
        </mesh>
        <Anchor name="wire" position={[-0.2, chipY + 1.1, 0]} />
      </group>

      {/* Anode: lead and post. */}
      <Explode offset={[s.r * 0.8, 0, 0]}>
        <mesh position={[anodeX, (chipY + 0.3 + lead + 2) / 2 - lead - 2, 0]}>
          <boxGeometry args={[LEAD, chipY + 0.3 + lead + 2, LEAD]} />
          <Material preset="tin" />
        </mesh>
        <mesh position={[postX + 0.1, chipY + 0.15, 0]}>
          <boxGeometry args={[0.8, 0.5, 0.45]} />
          <Material preset="tin" roughness={0.22} />
        </mesh>
      </Explode>
    </group>
  );
}

function mix(a: string, b: string, t: number): string {
  return `#${new Color(a).lerp(new Color(b), t).getHexString()}`;
}
