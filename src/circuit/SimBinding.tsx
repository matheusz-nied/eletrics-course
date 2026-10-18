/**
 * Links a simulation to a 3D scene: every frame, the readouts named in
 * `scene3d.bindings` become props of the scene ("lamp.brightness" ←
 * "L1.brightness" gives `<Scene lamp={{ brightness: 0.8 }} />`).
 *
 * Scene convention (docs/plano/02-arquitetura.md, section 7): the folder
 * `src/scenes/<id>/` has an `index.tsx` whose default export is a React
 * component that draws the whole scene (its own canvas) from its props.
 */
import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatQuantity, splitReadout } from './readouts';
import { useSim, useSimState } from './ui/context';

type SceneProps = Record<string, unknown>;
type SceneModule = { default: ComponentType<SceneProps> };

const SCENES = import.meta.glob<SceneModule>('/src/scenes/*/index.tsx');

// One lazy component per scene, made once: nothing loads until a scene is shown.
const LAZY_SCENES: Record<
  string,
  LazyExoticComponent<ComponentType<SceneProps>>
> = Object.fromEntries(Object.entries(SCENES).map(([path, load]) => [path, lazy(load)]));

const scenePath = (id: string) => `/src/scenes/${id}/index.tsx`;

export function hasScene(id: string): boolean {
  return scenePath(id) in SCENES;
}

/** `{ "lamp.brightness": 0.8, "gatePosition": 0.5 }` → `{ lamp: { brightness: 0.8 }, gatePosition: 0.5 }`. */
export function nestProps(flat: Record<string, unknown>): SceneProps {
  const out: SceneProps = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let node = out;
    parts.slice(0, -1).forEach((p) => {
      if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
      node = node[p] as SceneProps;
    });
    node[parts[parts.length - 1]!] = value;
  }
  return out;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
  }

  override render() {
    if (this.state.failed) {
      return (
        <p className="sim-3d__message">
          Não foi possível mostrar a cena 3D neste navegador. A simulação continua funcionando no
          esquema.
        </p>
      );
    }
    return this.props.children;
  }
}

export function SimBinding({
  scene,
  bindings,
  height,
}: {
  scene: string;
  bindings: Record<string, string>;
  height: number;
}) {
  const sim = useSim();
  const flat = useSimState(
    useShallow((s) => {
      const out: Record<string, unknown> = {};
      for (const [prop, key] of Object.entries(bindings)) out[prop] = sim.value(key, s.frame);
      return out;
    }),
  );
  const Scene = LAZY_SCENES[scenePath(scene)];

  if (!Scene) {
    // The scene is not built yet: show what it would receive.
    return (
      <div className="sim-3d sim-3d--placeholder" style={{ minHeight: height }} data-scene={scene}>
        <p className="sim-3d__title">Cena 3D em construção</p>
        <p className="sim-3d__id num">{scene}</p>
        {Object.keys(bindings).length > 0 && (
          <dl className="sim-3d__values">
            {Object.entries(bindings).map(([prop, key]) => (
              <div key={prop}>
                <dt>{prop}</dt>
                <dd className="num">
                  {formatQuantity(
                    splitReadout(key).quantity,
                    flat[prop] as number | boolean | string | undefined,
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  return (
    <div className="sim-3d" style={{ minHeight: height }} data-scene={scene}>
      <SceneBoundary>
        <Suspense fallback={<p className="sim-3d__message">Carregando a cena 3D…</p>}>
          <Scene {...nestProps(flat)} height={height} />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
