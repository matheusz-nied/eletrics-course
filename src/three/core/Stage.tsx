/* eslint-disable react-hooks/immutability -- React Three Fiber mutates three.js objects every frame; this React Compiler rule does not apply here (the compiler is not used). */
/**
 * The stage every 3D view uses: HDRI lighting, background, contact shadows,
 * camera framing, orbit controls and post-processing (ambient occlusion,
 * bloom for emissive parts, tone mapping), all scaled to the content and to
 * the quality level. Works for parts in millimetres and scenes in metres.
 */
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  Box3,
  CanvasTexture,
  NeutralToneMapping,
  NoToneMapping,
  SRGBColorSpace,
  Sphere,
  Vector3,
  type Group,
  type PerspectiveCamera,
} from 'three';
import { withBase } from '../../lib/url';
import { QUALITY, useQuality } from './quality';
import type { Vec3 } from '../types';
import type { OrbitControlsLike } from './controls';
import { fitDistance } from './framing';
import { renderStats } from './stats';

export { fitDistance };

/**
 * Only light-emitting surfaces bloom: the studio HDRI peaks below ~85, so
 * reflections stay under this threshold, and emissive cores (LED dies,
 * filaments) use `emissiveIntensity` around `GLOW` (fx/glow.ts).
 */
const GLOW_THRESHOLD = 90;

export type EnvironmentName = 'estudio' | 'externo' | 'interno';
export type ToneMappingName = 'neutral' | 'agx' | 'aces';

export function hdriUrl(name: EnvironmentName, resolution: '1k' | '512'): string {
  return withBase(`hdri/${name}-${resolution}.hdr`);
}

const TONE_MAPPING = {
  neutral: { renderer: NeutralToneMapping, pass: ToneMappingMode.NEUTRAL },
  agx: { renderer: AgXToneMapping, pass: ToneMappingMode.AGX },
  aces: { renderer: ACESFilmicToneMapping, pass: ToneMappingMode.ACES_FILMIC },
} as const;

export interface Bounds {
  center: Vector3;
  size: Vector3;
  radius: number;
  minY: number;
}

export interface StageProps {
  children: ReactNode;
  environment?: EnvironmentName;
  environmentIntensity?: number;
  /**
   * Rotation of the environment around Y (radians). The default puts the
   * studio's big softbox at the side of the default camera, so flat glossy
   * surfaces (boards, panels) do not mirror it. Debug: `?efeitos=giro90`.
   */
  environmentRotation?: number;
  /**
   * `neutral` (Khronos PBR Neutral) keeps catalogue colours true, which matters
   * for colour codes; `agx` and `aces` suit large scenes.
   */
  toneMapping?: ToneMappingName;
  exposure?: number;
  /** `studio`: soft gradient that follows the site theme; or a CSS colour. */
  background?: 'studio' | string;
  shadows?: boolean;
  /** Ambient occlusion and bloom; `undefined` follows the quality level. */
  ao?: boolean;
  bloom?: boolean;
  /** Direction from the target towards the camera on the first framing. */
  view?: Vec3;
  /** Extra room around the content when framing (1 = tight). */
  margin?: number;
  /** Changing it frames the content again from `view` (new part). */
  fitKey?: string | number;
  /** Changing it re-frames smoothly from the current angle (exploded view). */
  followKey?: string | number;
  controls?: boolean;
  /** Turns the orbit controls off without removing them (touch activation). */
  interactive?: boolean;
  autoRotate?: boolean;
  onBounds?: (bounds: Bounds) => void;
}

export function Stage({
  children,
  environment = 'estudio',
  environmentIntensity = 0.85,
  environmentRotation = Math.PI / 2,
  toneMapping = 'neutral',
  exposure = 1,
  background = 'studio',
  shadows = true,
  ao,
  bloom,
  view = [1, 0.75, 1.6],
  margin = 1.25,
  fitKey,
  followKey,
  controls = true,
  interactive = true,
  autoRotate = false,
  onBounds,
}: StageProps) {
  const level = useQuality((s) => s.level);
  const quality = QUALITY[level];
  const content = useRef<Group>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);

  const usePasses = quality.postprocessing;
  const tone = TONE_MAPPING[toneMapping];
  const gl = useThree((s) => s.gl);

  useLayoutEffect(() => {
    // With the composer, tone mapping is the last pass; without it, the renderer does it.
    gl.toneMapping = usePasses ? NoToneMapping : tone.renderer;
    gl.toneMappingExposure = exposure;
    gl.localClippingEnabled = true;
    // Render targets (contact shadows) need a transparent clear; the screen has no alpha.
    gl.setClearColor(0x000000, 0);
  }, [gl, usePasses, tone, exposure]);

  const handleBounds = (next: Bounds) => {
    setBounds(next);
    onBounds?.(next);
  };

  const debug =
    typeof location !== 'undefined'
      ? (new URLSearchParams(location.search).get('efeitos') ?? '')
      : '';
  const showAo = (ao ?? quality.ao) && usePasses && !debug.includes('sem-ao');
  const showBloom = (bloom ?? quality.bloom) && usePasses && !debug.includes('sem-bloom');
  const extent = bounds?.radius ?? 10;
  const turn = /giro(-?\d+)/.exec(debug);
  const envTurn = turn ? (Number(turn[1]) * Math.PI) / 180 : environmentRotation;

  return (
    <>
      <Environment
        files={hdriUrl(environment, quality.hdri)}
        environmentIntensity={environmentIntensity}
        environmentRotation={[0, envTurn, 0]}
      />
      <StageBackground kind={background} />
      <directionalLight position={[extent * 2, extent * 4, extent * 3]} intensity={0.6} />

      <group ref={content}>{children}</group>
      {debug.includes('stats') && <StatsProbe content={content} />}

      <FitCamera
        content={content}
        view={view}
        margin={margin}
        fitKey={fitKey}
        followKey={followKey}
        onBounds={handleBounds}
      />

      {shadows && bounds && (
        <ContactShadows
          key={`${fitKey}-${quality.shadowResolution}`}
          position={[bounds.center.x, bounds.minY - bounds.radius * 0.002, bounds.center.z]}
          scale={Math.max(bounds.size.x, bounds.size.z) * 2.2 + bounds.radius}
          far={Math.max(bounds.size.y, bounds.radius) * 1.2}
          blur={2.2}
          opacity={0.5}
          resolution={quality.shadowResolution}
          color="#1a1d22"
        />
      )}

      {controls && (
        <OrbitControls
          makeDefault
          enabled={interactive}
          enableDamping
          dampingFactor={0.12}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={extent * 0.25}
          maxDistance={extent * 12}
        />
      )}

      {usePasses && (
        <EffectComposer multisampling={0} enableNormalPass={false} mergeMode="none">
          {showAo ? (
            <N8AO
              aoRadius={extent * 0.18}
              distanceFalloff={1}
              intensity={2.2}
              halfRes={quality.aoHalfRes}
              quality="medium"
            />
          ) : (
            <></>
          )}
          {showBloom ? (
            <Bloom
              mipmapBlur
              intensity={0.7}
              luminanceThreshold={GLOW_THRESHOLD}
              luminanceSmoothing={0.25}
              radius={0.7}
            />
          ) : (
            <></>
          )}
          <ToneMapping mode={tone.pass} />
          {/* Anti-aliasing after tone mapping: MSAA on the HDR buffer leaves bright dots on edges. */}
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}

/**
 * `?efeitos=stats`: writes the cost of the content (draw calls, triangles,
 * texture memory) to `data-stats` on the canvas, for the performance check.
 */
function StatsProbe({ content }: { content: RefObject<Group | null> }) {
  const canvas = useThree((s) => s.gl.domElement);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!content.current) return;
      const stats = renderStats(content.current);
      canvas.dataset.stats = JSON.stringify(stats);
    }, 400);
    return () => window.clearInterval(id);
  }, [canvas, content]);
  return null;
}

/** Soft vertical gradient in the site's light or dark palette. */
function StageBackground({ kind }: { kind: string }) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const theme = useSiteTheme();

  const texture = useMemo(() => {
    if (kind !== 'studio') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    if (theme === 'dark') {
      gradient.addColorStop(0, '#2a3039');
      gradient.addColorStop(1, '#0f1217');
    } else {
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, '#d9dee5');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 256);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, [kind, theme]);

  useLayoutEffect(() => {
    const previous = scene.background;
    if (texture) scene.background = texture;
    else if (kind !== 'studio') scene.background = null;
    invalidate();
    return () => {
      scene.background = previous;
      texture?.dispose();
    };
  }, [scene, texture, kind, invalidate]);

  if (kind === 'studio') return null;
  return <color attach="background" args={[kind]} />;
}

/** The site theme (`data-theme` on <html>), updated when the student switches it. */
export function useSiteTheme(): 'light' | 'dark' {
  const read = () =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
      ? 'dark'
      : 'light';
  const [theme, setTheme] = useState<'light' | 'dark'>(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

interface FitCameraProps {
  content: RefObject<Group | null>;
  view: Vec3;
  margin: number;
  fitKey?: string | number;
  followKey?: string | number;
  onBounds: (bounds: Bounds) => void;
}

const FOLLOW_SECONDS = 1.6;

/**
 * Frames the content: jumps on a new `fitKey`, follows smoothly on a new
 * `followKey` (the exploded view grows the model), and stops following as
 * soon as the student orbits.
 */
function FitCamera({ content, view, margin, fitKey, followKey, onBounds }: FitCameraProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsLike | null;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const state = useRef({ follow: 0, jump: true, measured: false });
  const tmp = useMemo(
    () => ({
      box: new Box3(),
      sphere: new Sphere(),
      dir: new Vector3(),
      goal: new Vector3(),
      center: new Vector3(),
    }),
    [],
  );
  const [vx, vy, vz] = view;

  useEffect(() => {
    state.current = { follow: FOLLOW_SECONDS, jump: true, measured: false };
    invalidate();
  }, [fitKey, vx, vy, vz, invalidate]);

  useEffect(() => {
    state.current.follow = FOLLOW_SECONDS;
    invalidate();
  }, [followKey, invalidate]);

  // Resizing the view keeps the model framed.
  useEffect(() => {
    state.current.follow = Math.max(state.current.follow, 0.3);
    invalidate();
  }, [size.width, size.height, invalidate]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      state.current.follow = 0;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  useFrame((_, dt) => {
    const s = state.current;
    const group = content.current;
    if (s.follow <= 0 || !group) return;
    tmp.box.setFromObject(group);
    if (tmp.box.isEmpty()) return;
    tmp.box.getBoundingSphere(tmp.sphere);
    const center = tmp.box.getCenter(tmp.center);

    if (!s.measured) {
      s.measured = true;
      const boxSize = tmp.box.getSize(new Vector3());
      onBounds({
        center: center.clone(),
        size: boxSize,
        radius: tmp.sphere.radius,
        minY: tmp.box.min.y,
      });
    }

    const target = controls?.target ?? new Vector3();
    if (s.jump) tmp.dir.set(vx, vy, vz).normalize();
    else tmp.dir.copy(camera.position).sub(target).normalize();
    const distance = fitDistance(tmp.box, center, tmp.dir, camera.fov, camera.aspect) * margin;
    tmp.goal.copy(center).addScaledVector(tmp.dir, distance);

    if (s.jump) {
      camera.position.copy(tmp.goal);
      target.copy(center);
      s.jump = false;
    } else {
      const k = 1 - Math.exp(-5 * Math.min(dt, 0.05));
      camera.position.lerp(tmp.goal, k);
      target.lerp(center, k);
    }
    camera.near = Math.max(distance / 200, tmp.sphere.radius / 100);
    camera.far = distance * 30;
    camera.updateProjectionMatrix();
    controls?.update();
    s.follow -= Math.min(dt, 0.05);
    invalidate();
  });

  return null;
}
