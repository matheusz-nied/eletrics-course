/**
 * The 3D viewer behind <Model3D>: poster first, canvas when the view is near
 * the screen, toolbar (exploded view, cutaway, annotations, re-frame,
 * quality, full screen), keyboard and touch handling, and a fallback when the
 * browser has no WebGL.
 */
import { Canvas } from '@react-three/fiber';
import {
  Suspense,
  createElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { annotationsFor, isAnimated, loadPart, resolveProps } from '../registry';
import type { PartModule, PartProps } from '../types';
import { Annotations, visibleAnnotations } from './Annotations';
import { FrameRateMonitor, KeyboardOrbit, ReadySignal, ViewerErrorBoundary } from './helpers';
import { useReducedMotion } from './motion';
import { guessQuality, QUALITY, QUALITY_LABELS, useQuality, type QualityLevel } from './quality';
import { Stage } from './Stage';
import { useInView } from './useInView';
import { useContinuousRender, ViewProvider } from './view';
import { hasWebGL, isSoftwareRenderer } from './webgl';
import './viewer.css';

export interface ViewerProps {
  part: string;
  props?: PartProps;
  /** Initial state of the toggles. */
  explode?: boolean;
  cutaway?: boolean;
  annotations?: boolean;
  height?: number;
  /** Name and accessible description, resolved at build time (or from the part). */
  label: string;
  description?: string;
  poster?: string;
  /** Hide the toolbar (posters, thumbnails). */
  bare?: boolean;
  /** Keep the drawing buffer so the canvas can be saved as an image. */
  capture?: boolean;
  /** Keep the canvas alive even off screen (galleries with one view). */
  keepAlive?: boolean;
  /** Slow turntable rotation (galleries; it keeps rendering every frame). */
  autoRotate?: boolean;
  onReady?: () => void;
}

type Status = 'loading' | 'ready' | 'unsupported' | 'error';

export default function Viewer({
  part,
  props,
  explode: initialExplode = false,
  cutaway: initialCutaway = false,
  annotations: initialAnnotations = false,
  height = 360,
  label,
  description,
  poster,
  bare = false,
  capture = false,
  keepAlive = false,
  autoRotate = false,
  onReady,
}: ViewerProps) {
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const legendId = useId();
  const reducedMotion = useReducedMotion();
  const near = useInView(root);
  const inView = keepAlive || near;

  const [module, setModule] = useState<PartModule | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [exploded, setExploded] = useState(initialExplode);
  const [cut, setCut] = useState(initialCutaway);
  const [showNotes, setShowNotes] = useState(initialAnnotations);
  const [fitKey, setFitKey] = useState(0);
  const [touchActive, setTouchActive] = useState(false);
  const [extent, setExtent] = useState(60);
  const coarse = useSyncExternalStore(noSubscription, isCoarsePointer, () => false);
  const webgl = useSyncExternalStore(noSubscription, hasWebGL, () => true);

  const initQuality = useQuality((s) => s.init);
  const level = useQuality((s) => s.level);
  const fixed = useQuality((s) => s.fixed);
  const choose = useQuality((s) => s.choose);
  const quality = QUALITY[level];
  const [ceiling] = useState<QualityLevel>(() =>
    typeof window === 'undefined' ? 'alta' : guessQuality(),
  );

  useEffect(() => initQuality(), [initQuality]);

  useEffect(() => {
    let alive = true;
    loadPart(part)
      .then((m) => alive && setModule(m))
      .catch((error: unknown) => {
        console.warn('[3D]', error);
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [part]);

  // Touch: the page keeps scrolling until the student taps the view.
  useEffect(() => {
    if (!touchActive) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setTouchActive(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [touchActive]);

  const resolved = useMemo(
    () => (module ? resolveProps(module.meta, props) : (props ?? {})),
    [module, props],
  );
  const meta = module?.meta;
  const notes = useMemo(
    () => (meta ? visibleAnnotations(annotationsFor(meta, resolved), exploded) : []),
    [meta, resolved, exploded],
  );
  const canExplode = !!meta?.explode;
  const canCut = !!meta?.cutaway;
  const hasNotes = !!meta && annotationsFor(meta, resolved).length > 0;
  const animated = autoRotate || (!!meta && isAnimated(meta, resolved));
  const text = description ?? (meta ? (meta.describe?.(resolved) ?? meta.summary) : label);

  const handleReady = useCallback(() => {
    setStatus('ready');
    onReady?.();
  }, [onReady]);
  const reframe = useCallback(() => setFitKey((k) => k + 1), []);

  const toggleFullscreen = () => {
    const el = root.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  const unsupported = !webgl || status === 'unsupported';
  const showCanvas = webgl && inView && module && status !== 'error';
  const interactive = !coarse || touchActive;

  const fallback = (
    <p className="m3d__message" role="status">
      {status === 'error'
        ? 'Não foi possível mostrar o modelo 3D nesta página.'
        : 'Seu navegador não exibe 3D. A imagem mostra o modelo com os valores padrão.'}
    </p>
  );

  return (
    <div
      ref={root}
      className="m3d"
      data-part={part}
      data-status={unsupported ? 'unsupported' : status}
      data-quality={level}
      style={{ ['--m3d-height' as string]: `${height}px` }}
    >
      <div
        ref={viewport}
        className="m3d__viewport"
        role="application"
        aria-roledescription="visualizador 3D"
        aria-label={label}
        aria-describedby={descriptionId}
        tabIndex={0}
        data-touch={coarse ? (touchActive ? 'ativo' : 'inativo') : undefined}
      >
        {poster && (
          <img
            className="m3d__poster"
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            data-hidden={status === 'ready' && showCanvas ? 'true' : undefined}
          />
        )}
        {!poster && status !== 'ready' && <div className="m3d__placeholder" aria-hidden="true" />}

        {showCanvas && (
          <ViewerErrorBoundary fallback={null} onError={() => setStatus('error')}>
            <Canvas
              key={quality.postprocessing ? 'composer' : 'direct'}
              className="m3d__canvas"
              frameloop="demand"
              dpr={quality.dpr}
              camera={{ fov: 30, near: 0.1, far: 5000, position: [60, 45, 100] }}
              gl={{
                antialias: !quality.postprocessing,
                alpha: false,
                powerPreference: 'high-performance',
                preserveDrawingBuffer: capture,
                stencil: false,
              }}
              onCreated={({ gl }) => {
                const context = gl.getContext();
                if (isSoftwareRenderer(context) && !fixed) useQuality.setState({ level: 'baixa' });
                gl.domElement.addEventListener('webglcontextlost', (event) => {
                  event.preventDefault();
                  setStatus('error');
                });
              }}
            >
              <Suspense fallback={null}>
                <ViewProvider
                  explode={exploded}
                  cutaway={cut}
                  instant={reducedMotion || capture}
                  extent={extent}
                >
                  <Stage
                    view={meta?.view}
                    fitKey={`${part}:${fitKey}`}
                    followKey={exploded ? 'explodido' : 'montado'}
                    interactive={interactive}
                    autoRotate={autoRotate}
                    onBounds={(bounds) => setExtent(bounds.radius * 1.05)}
                  >
                    {module && createElement(module.default, resolved)}
                    {showNotes && <Annotations items={notes} />}
                  </Stage>
                  <ContinuousRender active={animated} />
                </ViewProvider>
                <ReadySignal onReady={handleReady} />
              </Suspense>
              <KeyboardOrbit element={viewport} onReset={reframe} />
              {!fixed && <FrameRateMonitor ceiling={ceiling} />}
            </Canvas>
          </ViewerErrorBoundary>
        )}

        {(unsupported || status === 'error') && fallback}
        {!unsupported && status === 'loading' && inView && (
          <p className="m3d__loading" role="status">
            <span className="m3d__spinner" aria-hidden="true" />
            Carregando modelo 3D…
          </p>
        )}
        {coarse && !touchActive && status === 'ready' && (
          <button type="button" className="m3d__touch" onClick={() => setTouchActive(true)}>
            Toque para girar o modelo
          </button>
        )}
      </div>

      <p id={descriptionId} className="m3d__sr">
        {text} Use as setas do teclado para girar, + e − para aproximar e 0 para recentralizar.
      </p>

      {!bare && (
        <div className="m3d__toolbar" role="toolbar" aria-label={`Controles: ${label}`}>
          {canExplode && (
            <ToolbarToggle
              pressed={exploded}
              onClick={() => setExploded((v) => !v)}
              icon="explodir"
            >
              Vista explodida
            </ToolbarToggle>
          )}
          {canCut && (
            <ToolbarToggle pressed={cut} onClick={() => setCut((v) => !v)} icon="corte">
              Corte
            </ToolbarToggle>
          )}
          {hasNotes && (
            <ToolbarToggle
              pressed={showNotes}
              onClick={() => setShowNotes((v) => !v)}
              icon="anotacoes"
              controls={legendId}
            >
              Anotações
            </ToolbarToggle>
          )}
          <button type="button" className="m3d__btn" onClick={reframe}>
            <ToolIcon name="centralizar" />
            <span>Centralizar</span>
          </button>
          <span className="m3d__spacer" />
          <label className="m3d__quality">
            <span className="m3d__quality-label">Qualidade</span>
            <select
              value={fixed ? level : 'auto'}
              onChange={(event) => choose(event.target.value as QualityLevel | 'auto')}
            >
              <option value="auto">Automática ({QUALITY_LABELS[level].toLowerCase()})</option>
              {(Object.keys(QUALITY_LABELS) as QualityLevel[]).map((key) => (
                <option key={key} value={key}>
                  {QUALITY_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="m3d__btn m3d__btn--icon"
            onClick={toggleFullscreen}
            aria-label="Tela cheia"
            title="Tela cheia"
          >
            <ToolIcon name="tela-cheia" />
          </button>
        </div>
      )}

      {showNotes && notes.length > 0 && (
        <ol id={legendId} className="m3d__legend" aria-label={`Partes: ${label}`}>
          {notes.map((note, index) => (
            <li key={`${index}-${note.text}`}>
              <span className="m3d__legend-number" aria-hidden="true">
                {index + 1}
              </span>
              {note.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const noSubscription = () => () => undefined;
const isCoarsePointer = () => matchMedia('(pointer: coarse)').matches;

function ContinuousRender({ active }: { active: boolean }) {
  useContinuousRender(active);
  return null;
}

function ToolbarToggle({
  pressed,
  onClick,
  icon,
  controls,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: IconName;
  controls?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="m3d__btn"
      aria-pressed={pressed}
      aria-controls={controls}
      onClick={onClick}
    >
      <ToolIcon name={icon} />
      <span>{children}</span>
    </button>
  );
}

type IconName = 'explodir' | 'corte' | 'anotacoes' | 'centralizar' | 'tela-cheia';

const ICONS: Record<IconName, string> = {
  explodir: 'M12 3v5m0 8v5M3 12h5m8 0h5M7 7l2 2m6 6 2 2M17 7l-2 2m-6 6-2 2',
  corte: 'M4 20 20 4M6 4h4v4H6zM14 16h4v4h-4z',
  anotacoes:
    'M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  centralizar: 'M12 3v3m0 12v3M3 12h3m12 0h3M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'tela-cheia': 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
};

function ToolIcon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
