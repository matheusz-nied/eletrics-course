/**
 * The live schematic: SVG drawn once by React; voltage colours and current
 * dots are updated directly in the DOM on every animation frame, so a 30
 * element circuit stays at 60 fps.
 */
import { useEffect, useId, useMemo, useRef, type RefObject } from 'react';
import type { SimFrame } from '../../engine/contract';
import { voltageColor } from '../colors';
import { formatSI } from '../format';
import { wireCurrents, type FlowPath } from '../schematic/model';
import { useDarkTheme, useSim, useSimState } from './context';
import { ElementGlyph } from './ElementGlyph';

/** Spacing of the current dots and their top speed (px, px/s). */
const DOT_SPACING = 16;
const MAX_SPEED = 90;
/** Currents below 1 µA (leakage of an open switch, solver residue) show no dots. */
const MIN_FLOW = 1e-6;

function flowCurrent(f: FlowPath, frame: SimFrame, segCurrent: Float64Array): number {
  if (f.kind === 'segment') return segCurrent[f.index]!;
  // Current entering the part through a pin: a→b inside a two-terminal part.
  const i = frame.readouts[`${f.id}.pin.${f.kind === 'element' ? 'a' : f.pin}`];
  return typeof i === 'number' ? i : 0;
}

function pinCurrentFrom(frame: SimFrame) {
  return (element: string, pin: string): number => {
    const i = frame.readouts[`${element}.pin.${pin}`];
    return typeof i === 'number' ? i : Number.NaN;
  };
}

export function Schematic({
  maxHeight,
  svgRef,
}: {
  maxHeight: number;
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const sim = useSim();
  const model = sim.model;
  const uid = useId().replace(/:/g, '');
  const dotRefs = useRef<(SVGPathElement | null)[]>([]);
  const view = useSimState((s) => s.view);
  const playing = useSimState((s) => s.playing);
  const dark = useDarkTheme();
  const [vx, vy, vw, vh] = model.viewBox;

  // Node label positions: middle of the node's first wire segment, else its first pin.
  const nodeLabelPos = useMemo(() => {
    const pos = new Map<number, [number, number]>();
    model.segments.forEach((s) => {
      if (s.node >= 0 && !pos.has(s.node)) {
        pos.set(s.node, [(s.from[0] + s.to[0]) / 2, (s.from[1] + s.to[1]) / 2]);
      }
    });
    for (const el of model.elements) {
      for (const p of el.pins) if (p.node >= 0 && !pos.has(p.node)) pos.set(p.node, p.pos);
    }
    return pos;
  }, [model]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const segCurrent = new Float64Array(model.segments.length);
    const offsets = new Float64Array(model.flows.length);
    const speeds = new Float64Array(model.flows.length);
    let vScale = 1;
    let iScale = MIN_FLOW;
    let pending: SimFrame | null = sim.store.getState().frame;
    let last = performance.now();
    let raf = 0;
    const labelEls = new Map<number, SVGTextElement>();
    svg.querySelectorAll<SVGTextElement>('[data-node-label]').forEach((t) => {
      labelEls.set(Number(t.dataset.nodeLabel), t);
    });
    let lastLabels = 0;

    const apply = (frame: SimFrame, now: number) => {
      // Voltage colours, scaled to the largest voltage seen recently.
      let vmax = 0;
      for (const v of Object.values(frame.nodeVoltages)) vmax = Math.max(vmax, Math.abs(v));
      vScale = Math.max(vmax, vScale * 0.995, 1e-3);
      model.nodes.forEach((id, i) => {
        const v = frame.nodeVoltages[id] ?? (id === 'GND' ? 0 : Number.NaN);
        svg.style.setProperty(
          `--v${i}`,
          Number.isFinite(v) ? voltageColor(v, vScale, dark) : 'var(--sch-ink)',
        );
      });
      if (view.nodeLabels && now - lastLabels > 150) {
        lastLabels = now;
        for (const [i, el] of labelEls) {
          const v = frame.nodeVoltages[model.nodes[i]!];
          el.textContent = v === undefined ? '' : formatSI(v, 'V');
        }
      }

      // Currents: KCL on the wire graph, then dot speed proportional to current.
      wireCurrents(model, pinCurrentFrom(frame), segCurrent);
      let imax = 0;
      const currents = model.flows.map((f) => {
        const i = flowCurrent(f, frame, segCurrent);
        imax = Math.max(imax, Math.abs(i));
        return i;
      });
      iScale = Math.max(imax, iScale * 0.99, MIN_FLOW);
      const threshold = Math.max(iScale * 1e-3, MIN_FLOW);
      currents.forEach((i, k) => {
        const el = dotRefs.current[k];
        const visible = Math.abs(i) > threshold;
        speeds[k] = visible ? (i / iScale) * MAX_SPEED * (view.electrons ? -1 : 1) : 0;
        if (el) el.style.opacity = visible ? '1' : '0';
      });
    };

    // The loop runs while dots are moving; otherwise one frame per engine update.
    let running = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (pending) {
        apply(pending, now);
        pending = null;
      }
      const animate = view.current && playing && sim.isVisible;
      if (animate) {
        for (let k = 0; k < offsets.length; k++) {
          const el = dotRefs.current[k];
          if (!el || speeds[k] === 0) continue;
          offsets[k] = (offsets[k]! - speeds[k]! * dt) % DOT_SPACING;
          el.style.strokeDashoffset = String(offsets[k]);
        }
        raf = requestAnimationFrame(loop);
      } else running = false;
    };
    const kick = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const off = sim.onFrame((f) => {
      pending = f;
      kick();
    });
    const offVisible = sim.onVisibility(kick);
    kick();
    return () => {
      off();
      offVisible();
      cancelAnimationFrame(raf);
    };
  }, [model, sim, view, playing, dark, svgRef]);

  const interactive = model.elements.some((v) => v.controls.length > 0);

  return (
    <svg
      ref={svgRef}
      className={`sch${view.voltage ? ' sch--voltage' : ''}${view.current ? ' sch--current' : ''}${view.electrons ? ' sch--electrons' : ''}`}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      style={{ maxHeight }}
      // A picture, unless parts of it are controls (an img cannot hold controls).
      role={interactive ? 'group' : 'img'}
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-desc`}
    >
      <title id={`${uid}-title`}>{`Esquema: ${sim.doc.title}`}</title>
      <desc id={`${uid}-desc`}>{sim.doc.description}</desc>
      <g className="sch-wires">
        {model.wires.map((w) => (
          <polyline
            key={w.id}
            points={w.points.map((p) => p.join(',')).join(' ')}
            className="sch-wire"
            data-node={model.nodes[w.node]}
            style={{ ['--wc' as string]: `var(--v${w.node})` }}
          />
        ))}
      </g>
      <g className="sch-elements">
        {model.elements.map((v) => (
          <ElementGlyph key={v.el.id} view={v} uid={uid} gradient={view.voltage} />
        ))}
      </g>
      <g className="sch-junctions" aria-hidden="true">
        {model.junctions.map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={3.2} />
        ))}
        {model.openPins.map(([x, y]) => (
          <circle key={`o${x},${y}`} cx={x} cy={y} r={2.6} className="sch-open" />
        ))}
      </g>
      <g className="sch-flow" aria-hidden="true">
        {model.flows.map((f, k) => (
          <path
            key={k}
            ref={(el) => {
              dotRefs.current[k] = el;
            }}
            d={`M${f.from[0]} ${f.from[1]}L${f.to[0]} ${f.to[1]}`}
            strokeDasharray={`0 ${DOT_SPACING}`}
            style={{ opacity: 0 }}
          />
        ))}
      </g>
      {view.nodeLabels && (
        <g className="sch-node-labels" aria-hidden="true">
          {[...nodeLabelPos].map(([i, [x, y]]) => (
            <text key={i} x={x} y={y - 7} data-node-label={i} textAnchor="middle" />
          ))}
        </g>
      )}
    </svg>
  );
}
