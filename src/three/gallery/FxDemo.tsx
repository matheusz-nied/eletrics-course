/**
 * Internal demo of the effects in `fx/` (smoke, sparks, magnetic field lines,
 * current flow), at /dev/pecas/efeitos/. Scenes and lessons use the same
 * components.
 */
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { Stage } from '../core/Stage';
import { useQuality, QUALITY } from '../core/quality';
import { ViewProvider } from '../core/view';
import { CurrentFlow, type CurrentConvention } from '../fx/CurrentFlow';
import { FieldLines } from '../fx/FieldLines';
import type { FieldSource } from '../fx/field';
import { Smoke } from '../fx/Smoke';
import { Sparks } from '../fx/Sparks';
import { Material } from '../materials/Material';
import Resistor from '../parts/resistor';
import { Wire } from '../shapes/Wire';
import type { Vec3 } from '../types';
import './fx-demo.css';

type Demo = 'fumaca' | 'faiscas' | 'campo' | 'corrente';
type FieldKind = 'ima' | 'espira' | 'bobina' | 'fio' | 'dois-imas';

const DEMOS: { id: Demo; label: string }[] = [
  { id: 'fumaca', label: 'Fumaça' },
  { id: 'faiscas', label: 'Faíscas' },
  { id: 'campo', label: 'Linhas de campo' },
  { id: 'corrente', label: 'Corrente no fio' },
];

const FIELDS: Record<FieldKind, { label: string; sources: FieldSource[] }> = {
  ima: { label: 'Ímã em barra', sources: [{ kind: 'bar', length: 50, axis: [1, 0, 0] }] },
  'dois-imas': {
    label: 'Dois ímãs (N de frente para S)',
    sources: [
      { kind: 'bar', length: 30, axis: [1, 0, 0], position: [-27, 0, 0] },
      { kind: 'bar', length: 30, axis: [1, 0, 0], position: [27, 0, 0] },
    ],
  },
  espira: {
    label: 'Espira com corrente',
    sources: [{ kind: 'loop', radius: 20, axis: [1, 0, 0] }],
  },
  bobina: {
    label: 'Bobina (solenoide)',
    sources: [{ kind: 'solenoid', radius: 10, length: 40, turns: 40, axis: [1, 0, 0] }],
  },
  fio: {
    label: 'Fio reto com corrente',
    sources: [{ kind: 'wire', start: [0, -40, 0], end: [0, 40, 0] }],
  },
};

const LOOP: Vec3[] = [
  [-40, 2, 20],
  [-40, 2, -20],
  [40, 2, -20],
  [40, 2, 20],
  [-36, 2, 20],
];

function FieldScene({
  kind,
  flow,
  layout,
}: {
  kind: FieldKind;
  flow: boolean;
  layout: '3d' | 'plano';
}) {
  const { sources } = FIELDS[kind];
  return (
    <group position={[0, 40, 0]}>
      {sources.map((s, i) => {
        if (s.kind === 'bar') {
          const [x] = s.position ?? [0, 0, 0];
          return (
            <group key={i} position={[x, 0, 0]}>
              <mesh position={[s.length / 4, 0, 0]}>
                <boxGeometry args={[s.length / 2, 10, 10]} />
                <Material preset="absRed" />
              </mesh>
              <mesh position={[-s.length / 4, 0, 0]}>
                <boxGeometry args={[s.length / 2, 10, 10]} />
                <Material preset="absGray" color="#4d6d8f" />
              </mesh>
            </group>
          );
        }
        if (s.kind === 'loop')
          return (
            <mesh key={i} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[s.radius, 0.8, 12, 64]} />
              <Material preset="copper" />
            </mesh>
          );
        if (s.kind === 'solenoid')
          return (
            <mesh key={i} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[s.radius, s.radius, s.length, 48, 1, true]} />
              <Material preset="magnetWire" side={2} />
            </mesh>
          );
        if (s.kind === 'wire')
          return (
            <Wire key={i} points={[s.start, s.end]} radius={0.8} material={{ preset: 'copper' }} />
          );
        return null;
      })}
      <FieldLines
        sources={sources}
        count={layout === '3d' ? 30 : 14}
        layout={layout}
        flow={flow ? 12 : 0}
      />
    </group>
  );
}

export default function FxDemo() {
  const init = useQuality((s) => s.init);
  const level = useQuality((s) => s.level);
  useEffect(() => init(), [init]);
  const quality = QUALITY[level];

  const [demo, setDemo] = useState<Demo>('fumaca');
  const [smoke, setSmoke] = useState(1);
  const [burst, setBurst] = useState(0);
  const [arc, setArc] = useState(false);
  const [field, setField] = useState<FieldKind>('ima');
  const [flow, setFlow] = useState(true);
  const [layout, setLayout] = useState<'plano' | '3d'>('plano');
  const [current, setCurrent] = useState(0.5);
  const [convention, setConvention] = useState<CurrentConvention>('eletrons');

  return (
    <div className="fx-demo">
      <div className="fx-demo__view">
        <div className="fx-demo__canvas">
          <Canvas
            key={quality.postprocessing ? 'composer' : 'direct'}
            frameloop="demand"
            dpr={quality.dpr}
            camera={{ fov: 30, near: 0.1, far: 5000, position: [60, 45, 100] }}
            gl={{ antialias: !quality.postprocessing, alpha: false, stencil: false }}
          >
            <Suspense fallback={null}>
              <ViewProvider>
                <Stage
                  fitKey={demo + field}
                  view={demo === 'campo' ? [0, 0.35, 1] : [0.8, 0.7, 1.5]}
                >
                  {demo === 'fumaca' && (
                    <>
                      <Resistor watts={2} burned={smoke > 0} temperature={smoke > 0 ? 320 : 25} />
                      <Smoke position={[0, 4, 0]} intensity={smoke} radius={3} height={45} />
                    </>
                  )}
                  {demo === 'faiscas' && (
                    <>
                      <Wire
                        points={[
                          [-30, 1, 0],
                          [-1.5, 1, 0],
                        ]}
                        radius={0.8}
                        material={{ preset: 'copper' }}
                      />
                      <Wire
                        points={[
                          [30, 1, 0],
                          [1.5, 1, 0],
                        ]}
                        radius={0.8}
                        material={{ preset: 'copper' }}
                      />
                      <Sparks position={[0, 1, 0]} trigger={burst} rate={arc ? 60 : 0} count={60} />
                    </>
                  )}
                  {demo === 'campo' && <FieldScene kind={field} flow={flow} layout={layout} />}
                  {demo === 'corrente' && (
                    <>
                      <Wire
                        points={LOOP}
                        radius={1.2}
                        bend={6}
                        material={{ preset: 'pvc', color: '#c62828' }}
                      />
                      <CurrentFlow
                        points={LOOP}
                        current={current}
                        convention={convention}
                        bend={6}
                        spacing={7}
                        radius={1.45}
                      />
                    </>
                  )}
                </Stage>
              </ViewProvider>
            </Suspense>
          </Canvas>
        </div>
      </div>
      <aside className="fx-demo__panel">
        <fieldset className="fx-demo__controls">
          <legend>Efeito</legend>
          {DEMOS.map((d) => (
            <label key={d.id}>
              <input
                type="radio"
                name="efeito"
                checked={demo === d.id}
                onChange={() => setDemo(d.id)}
              />{' '}
              {d.label}
            </label>
          ))}
        </fieldset>
        {demo === 'fumaca' && (
          <label className="fx-demo__control">
            Intensidade: {smoke.toLocaleString('pt-BR')}
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={smoke}
              onChange={(e) => setSmoke(Number(e.target.value))}
            />
          </label>
        )}
        {demo === 'faiscas' && (
          <div className="fx-demo__control">
            <button type="button" onClick={() => setBurst((n) => n + 1)}>
              Curto-circuito
            </button>
            <label>
              <input type="checkbox" checked={arc} onChange={(e) => setArc(e.target.checked)} />{' '}
              Arco contínuo
            </label>
          </div>
        )}
        {demo === 'campo' && (
          <div className="fx-demo__control">
            <label>
              Fonte do campo{' '}
              <select value={field} onChange={(e) => setField(e.target.value as FieldKind)}>
                {Object.entries(FIELDS).map(([id, f]) => (
                  <option key={id} value={id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={layout === '3d'}
                onChange={(e) => setLayout(e.target.checked ? '3d' : 'plano')}
              />{' '}
              Linhas em volta (3D)
            </label>
            <label>
              <input type="checkbox" checked={flow} onChange={(e) => setFlow(e.target.checked)} />{' '}
              Setas em movimento
            </label>
          </div>
        )}
        {demo === 'corrente' && (
          <div className="fx-demo__control">
            <label>
              Corrente: {current.toLocaleString('pt-BR')} A
              <input
                type="range"
                min={-2}
                max={2}
                step={0.05}
                value={current}
                onChange={(e) => setCurrent(Number(e.target.value))}
              />
            </label>
            <label>
              Sentido{' '}
              <select
                value={convention}
                onChange={(e) => setConvention(e.target.value as CurrentConvention)}
              >
                <option value="eletrons">Elétrons (− para +)</option>
                <option value="convencional">Convencional (+ para −)</option>
              </select>
            </label>
          </div>
        )}
      </aside>
    </div>
  );
}
