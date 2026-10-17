/**
 * One element of the schematic: leads, symbol, labels and, when the circuit
 * declares a control, the direct interaction (click a switch, hold a button,
 * drag a potentiometer), all reachable by keyboard.
 */
import { memo, useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ControlDoc, ParamValue, SimFrame } from '../../engine/contract';
import type { ElementView } from '../schematic/model';
import {
  formatControlValue,
  fromFraction,
  isOn,
  nudge,
  primaryControl,
  sliderRange,
  toFraction,
} from './control-utils';
import { useSim, useSimState } from './context';

const EMPTY: Record<string, ParamValue> = {};

function pickLive(frame: SimFrame | null, id: string, keys: string[] | undefined) {
  const out: Record<string, number | boolean | string> = {};
  if (!frame || !keys) return out;
  for (const k of keys) {
    const v = frame.readouts[`${id}.${k}`];
    if (v === undefined) continue;
    // Quantize so the symbol re-renders only on visible changes.
    out[k] = typeof v === 'number' ? Math.round(v * 50) / 50 : v;
  }
  return out;
}

export const ElementGlyph = memo(function ElementGlyph({
  view,
  uid,
  gradient,
}: {
  view: ElementView;
  uid: string;
  gradient: boolean;
}) {
  const sim = useSim();
  const id = view.el.id;
  const params = useSimState((s) => s.params[id]) ?? EMPTY;
  const live = useSimState(useShallow((s) => pickLive(s.frame, id, view.symbol.live)));
  const focused = useSimState((s) => s.focus === id);
  const control = primaryControl(view.controls);
  const drag = useRef<{ x: number; f: number; pointer: number } | null>(null);

  const set = useCallback(
    (c: ControlDoc, value: ParamValue) => sim.setParam(id, c.param, value),
    [sim, id],
  );

  const name = view.el.label ?? id;
  const valueText = view.symbol.value?.(params);
  const gradientId = `${uid}-g-${id}`;

  // ── interaction ─────────────────────────────────────────────────────
  const onPointerDown = (e: PointerEvent<SVGGElement>) => {
    if (!control) return;
    if (control.kind === 'momentary') {
      e.currentTarget.setPointerCapture(e.pointerId);
      set(control, true);
    } else if (control.kind === 'slider') {
      e.currentTarget.setPointerCapture(e.pointerId);
      const value = Number(params[control.param] ?? sliderRange(control).min);
      drag.current = { x: e.clientX, f: toFraction(control, value), pointer: e.pointerId };
    }
  };

  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    if (!control || control.kind !== 'slider' || !drag.current) return;
    const svg = e.currentTarget.ownerSVGElement;
    const width = svg?.getBoundingClientRect().width || 300;
    // dragging across 40 % of the schematic covers the whole range
    const f = drag.current.f + (e.clientX - drag.current.x) / (width * 0.4);
    set(control, fromFraction(control, f));
  };

  const onPointerUp = (e: PointerEvent<SVGGElement>) => {
    if (!control) return;
    if (control.kind === 'momentary') set(control, false);
    if (drag.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drag.current = null;
  };

  const onClick = () => {
    if (!control) {
      sim.setFocus(focused ? null : id);
      return;
    }
    if (control.kind === 'toggle') set(control, !isOn(params[control.param]));
    else if (control.kind === 'select' && control.options?.length) {
      const i = control.options.findIndex((o) => o.value === params[control.param]);
      set(control, control.options[(i + 1) % control.options.length]!.value);
    }
  };

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (!control) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sim.setFocus(focused ? null : id);
      }
      return;
    }
    const value = params[control.param];
    if (control.kind === 'toggle' || control.kind === 'select') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    } else if (control.kind === 'momentary') {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        set(control, true);
      }
    } else if (control.kind === 'slider') {
      const v = Number(value ?? sliderRange(control).min);
      const map: Record<string, () => number> = {
        ArrowRight: () => nudge(control, v, 1),
        ArrowUp: () => nudge(control, v, 1),
        ArrowLeft: () => nudge(control, v, -1),
        ArrowDown: () => nudge(control, v, -1),
        PageUp: () => nudge(control, v, 10),
        PageDown: () => nudge(control, v, -10),
        Home: () => sliderRange(control).min,
        End: () => sliderRange(control).max,
      };
      const f = map[e.key];
      if (f) {
        e.preventDefault();
        set(control, f());
      }
    }
  };

  const onKeyUp = (e: KeyboardEvent<SVGGElement>) => {
    if (control?.kind === 'momentary' && (e.key === 'Enter' || e.key === ' ')) set(control, false);
  };

  const onBlur = () => {
    if (control?.kind === 'momentary' && isOn(params[control.param])) set(control, false);
  };

  const a11y: Record<string, string | number | boolean | undefined> = {};
  if (control) {
    const value = params[control.param];
    a11y['aria-label'] = control.label;
    if (control.kind === 'toggle') {
      a11y.role = 'switch';
      a11y['aria-checked'] = isOn(value);
    } else if (control.kind === 'momentary') {
      a11y.role = 'button';
      a11y['aria-pressed'] = isOn(value);
    } else if (control.kind === 'slider') {
      const { min, max } = sliderRange(control);
      a11y.role = 'slider';
      a11y['aria-valuemin'] = min;
      a11y['aria-valuemax'] = max;
      a11y['aria-valuenow'] = Number(value);
      a11y['aria-valuetext'] = formatControlValue(control, value);
    } else {
      a11y.role = 'button';
      a11y['aria-label'] = `${control.label}: ${formatControlValue(control, value)}`;
    }
  }

  const [bx, by, bw, bh] = view.bbox;
  const pad = 6;
  const interactive = !!control;
  const label = view.label;

  return (
    <g
      className={`sch-el${interactive ? ' sch-el--control' : ''}${focused ? ' is-focused' : ''}${control?.kind === 'slider' ? ' sch-el--slider' : ''}`}
      data-element={id}
      data-type={view.el.type}
      tabIndex={interactive ? 0 : -1}
      {...a11y}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={() => !interactive && sim.setFocus(id)}
      onPointerLeave={() => !interactive && focused && sim.setFocus(null)}
      onFocus={() => interactive && sim.setFocus(id)}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
    >
      <rect
        className="sch-hit"
        x={bx - pad}
        y={by - pad}
        width={Math.max(bw + 2 * pad, 28)}
        height={Math.max(bh + 2 * pad, 28)}
        rx={6}
      />
      {view.leads.map((l) => (
        <path
          key={l.pin}
          d={l.d}
          className="sch-wire sch-lead"
          style={{ ['--wc' as string]: `var(--v${l.node})` }}
        />
      ))}
      {gradient && view.two && view.symbol.gradientBody && (
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={-(view.symbol.body ?? 30) / 2}
            x2={(view.symbol.body ?? 30) / 2}
            y1={0}
            y2={0}
          >
            <stop offset="0" style={{ stopColor: `var(--v${view.pins[0]!.node})` }} />
            <stop offset="1" style={{ stopColor: `var(--v${view.pins[1]!.node})` }} />
          </linearGradient>
        </defs>
      )}
      <g transform={view.transform} className="sym">
        {view.symbol.draw({
          el: view.el,
          params,
          live,
          rot: view.rot,
          flip: view.flip,
          pins: view.instancePins,
          gradient: gradient && view.symbol.gradientBody ? `url(#${gradientId})` : undefined,
        })}
      </g>
      {label && (
        <g className="sch-label" aria-hidden="true">
          {label.inline ? (
            <text x={label.x} y={label.y} textAnchor="middle">
              <tspan className="sch-label__id">{name}</tspan>
              {valueText && (
                <tspan className="sch-label__value" dx={5}>
                  {valueText}
                </tspan>
              )}
            </text>
          ) : (
            <>
              <text x={label.x} y={label.y} textAnchor={label.anchor} className="sch-label__id">
                {name}
              </text>
              {valueText && (
                <text
                  x={label.valueX}
                  y={label.valueY}
                  textAnchor={label.anchor}
                  className="sch-label__value"
                >
                  {valueText}
                </text>
              )}
            </>
          )}
        </g>
      )}
      <rect
        className="sch-focus"
        x={bx - pad}
        y={by - pad}
        width={bw + 2 * pad}
        height={bh + 2 * pad}
        rx={6}
      />
    </g>
  );
});
