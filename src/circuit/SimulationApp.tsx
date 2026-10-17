/**
 * The live simulation island behind <Simulation>: toolbar, schematic with
 * on-symbol controls, legend, control panel, challenges, instruments, event
 * messages and the 3D scene when the layout asks for it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitDoc } from '../engine/contract';
import { SimAudio, hasSound } from './audio';
import { runsOnRealEngine } from './engine';
import { Instruments, normalizeInstruments, type InstrumentSpec } from './instruments/Instruments';
import { SimController } from './runtime/controller';
import { SimBinding } from './SimBinding';
import { ControlPanel } from './ui/ControlPanel';
import { SimContext, useReducedMotion } from './ui/context';
import { EventLog } from './ui/EventLog';
import { Goals } from './ui/Goals';
import { Inspector } from './ui/Inspector';
import { Legend } from './ui/Legend';
import { Schematic } from './ui/Schematic';
import { Toolbar } from './ui/Toolbar';
import { ValuesTable } from './ui/ValuesTable';
import './simulation.css';

export type Layout = 'esquema' | 'esquema+3d' | '3d';

export interface SimulationProps {
  doc: CircuitDoc;
  height: number;
  layout: Layout;
  autoplay: boolean;
  instruments?: InstrumentSpec[];
}

export default function SimulationApp({
  doc,
  height,
  layout,
  autoplay,
  instruments,
}: SimulationProps) {
  const [sim] = useState(() => new SimController(doc));
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState(false);
  const items = useMemo(() => normalizeInstruments(doc, instruments), [doc, instruments]);
  const scene = doc.scene3d && layout !== 'esquema' ? doc.scene3d : null;
  const showSchematic = layout !== '3d' || !scene;

  // Engine: start when the island mounts (it mounts when it scrolls into view).
  useEffect(() => {
    const off = sim.store.subscribe((s) => {
      setReady(s.ready);
      setError(s.error);
      setSound(s.sound);
    });
    void sim.start(autoplay);
    return () => {
      off();
      sim.dispose();
    };
  }, [sim, autoplay]);

  // No moving dots for people who asked for less motion.
  useEffect(() => {
    if (reducedMotion) sim.setView({ current: false });
  }, [sim, reducedMotion]);

  // Pause the engine while the simulation is off screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) sim.setVisible(e.isIntersecting);
    });
    io.observe(el);
    const onHidden = () => sim.setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [sim]);

  // Sound, only after the student turns it on.
  useEffect(() => {
    if (!sound) return;
    const audio = new SimAudio(doc);
    audio.start();
    const update = (frame: Parameters<Parameters<typeof sim.onFrame>[0]>[0]) =>
      audio.update(frame, sim.store.getState().playing && sim.isVisible);
    const off = sim.onFrame(update);
    const offState = sim.store.subscribe((s, prev) => {
      if (s.playing !== prev.playing && s.frame) update(s.frame);
    });
    return () => {
      off();
      offState();
      audio.dispose();
    };
  }, [sound, sim, doc]);

  return (
    <SimContext.Provider value={sim}>
      <div
        ref={rootRef}
        className={`sim sim--${layout.replace('+', '-')}`}
        data-simulation={doc.id}
        data-ready={ready ? '' : undefined}
        data-engine={runsOnRealEngine(doc) ? 'motor' : 'provisorio'}
      >
        <div className="sim-head">
          <p className="sim-head__title">{doc.title}</p>
          <Toolbar soundAvailable={hasSound(doc)} />
        </div>
        {error && (
          <p className="sim-error" role="alert">
            {error}
          </p>
        )}
        <div className={`sim-stage${scene && showSchematic ? ' sim-stage--split' : ''}`}>
          {showSchematic && (
            <div className="sim-schematic" ref={wrapRef}>
              <Schematic maxHeight={height} svgRef={svgRef} />
              <Inspector svgRef={svgRef} wrapRef={wrapRef} />
            </div>
          )}
          {scene && <SimBinding scene={scene.scene} bindings={scene.bindings} height={height} />}
        </div>
        {showSchematic && <Legend />}
        <ControlPanel />
        <Goals />
        <Instruments items={items} />
        <EventLog />
        <ValuesTable />
      </div>
    </SimContext.Provider>
  );
}
