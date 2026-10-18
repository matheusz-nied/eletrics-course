/* eslint-disable react-hooks/refs -- React Three Fiber mutates three.js objects; this React Compiler rule does not apply here (the compiler is not used). */
/**
 * `<Material preset="copper" />`: a MeshPhysicalMaterial from the library,
 * with overrides, cutaway support and a cheaper fallback for transparent
 * materials on the lowest quality level.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, FrontSide, type ColorRepresentation, type Side } from 'three';
import { useView } from '../core/view';
import { useQuality } from '../core/quality';
import { PRESETS, type MaterialPreset, type PresetName } from './presets';

export interface MaterialProps extends MaterialPreset {
  preset?: PresetName;
  /** Cut by the cutaway plane (outer shells). The cut face shows as solid `cutColor`. */
  clip?: boolean;
  /** Colour of the cut face; defaults to a darker body colour. */
  cutColor?: ColorRepresentation;
  side?: Side;
  attach?: string;
}

interface CompiledShader {
  uniforms: Record<string, { value: unknown }>;
  fragmentShader: string;
}

/**
 * Back faces seen through the cut are painted flat, so shells read as solid.
 * Only while this material is being cut: other double-sided surfaces (thin
 * sheets, labels) keep their normal shading on the back.
 */
function patchCutFaces(color: { value: Color }, on: { value: number }) {
  return (shader: CompiledShader) => {
    shader.uniforms.uCutColor = color;
    shader.uniforms.uCutOn = on;
    shader.fragmentShader =
      `uniform vec3 uCutColor;\nuniform float uCutOn;\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  if (!gl_FrontFacing && uCutOn > 0.5) gl_FragColor = vec4(uCutColor, 1.0);',
      );
  };
}

const cacheKey = () => 'kit3d-cut-v2';

export function Material({
  preset,
  clip = false,
  cutColor,
  side,
  attach,
  ...overrides
}: MaterialProps) {
  const { cutaway, cutPlanes } = useView();
  const lowQuality = useQuality((s) => s.level === 'baixa');
  const params: MaterialPreset = { ...(preset ? PRESETS[preset] : {}), ...overrides };

  const uniform = useRef({ value: new Color() }).current;
  const cutOn = useRef({ value: 0 }).current;
  const onBeforeCompile = useMemo(() => patchCutFaces(uniform, cutOn), [uniform, cutOn]);
  const baseColor = params.color ?? '#ffffff';
  useLayoutEffect(() => {
    if (cutColor !== undefined) uniform.value.set(cutColor);
    else uniform.value.set(baseColor as ColorRepresentation).multiplyScalar(0.55);
  }, [uniform, cutColor, baseColor]);

  // Transmission costs an extra scene pass; on the lowest level glass is a simple blend.
  if (lowQuality && params.transmission) {
    const amount = params.transmission;
    params.transmission = 0;
    params.transparent = true;
    params.opacity = 1 - amount * 0.8;
    params.depthWrite = false;
  }

  const cut = clip && cutaway;
  cutOn.value = cut ? 1 : 0;

  return (
    <meshPhysicalMaterial
      {...(attach ? { attach } : {})}
      {...params}
      side={cut ? DoubleSide : (side ?? FrontSide)}
      clippingPlanes={cut ? cutPlanes : null}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={cacheKey}
    />
  );
}
