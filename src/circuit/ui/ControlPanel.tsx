import { useId, type PointerEvent } from 'react';
import type { ControlDoc, ElementDoc, ParamValue } from '../../engine/contract';
import { formatControlValue, fromFraction, isOn, sliderRange, toFraction } from './control-utils';
import { useSim, useSimState } from './context';

const RESOLUTION = 1000;

function Control({ el, c }: { el: ElementDoc; c: ControlDoc }) {
  const sim = useSim();
  const id = useId();
  const value = useSimState((s) => s.params[el.id]?.[c.param]);
  const set = (v: ParamValue) => sim.setParam(el.id, c.param, v);

  if (c.kind === 'toggle') {
    const on = isOn(value);
    return (
      <div className="sim-control">
        <span className="sim-control__label" id={id}>
          {c.label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={id}
          className={`sim-switch${on ? ' is-on' : ''}`}
          onClick={() => set(!on)}
        >
          <span className="sim-switch__track">
            <span className="sim-switch__thumb" />
          </span>
          <span className="sim-switch__text">{on ? 'Ligado' : 'Desligado'}</span>
        </button>
      </div>
    );
  }

  if (c.kind === 'momentary') {
    const down = (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      set(true);
    };
    return (
      <div className="sim-control">
        <span className="sim-control__label" id={id}>
          {c.label}
        </span>
        <button
          type="button"
          id={`${id}-hold`}
          className={`sim-hold${isOn(value) ? ' is-on' : ''}`}
          // The visible text must be part of the name (WCAG 2.5.3, axe label-content-name-mismatch).
          aria-labelledby={`${id} ${id}-hold`}
          aria-pressed={isOn(value)}
          onPointerDown={down}
          onPointerUp={() => set(false)}
          onPointerCancel={() => set(false)}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              set(true);
            }
          }}
          onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && set(false)}
          onBlur={() => isOn(value) && set(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {isOn(value) ? 'Apertado' : 'Segure para apertar'}
        </button>
      </div>
    );
  }

  if (c.kind === 'select') {
    return (
      <div className="sim-control">
        <label className="sim-control__label" htmlFor={id}>
          {c.label}
        </label>
        <select
          id={id}
          className="sim-select"
          value={String(value)}
          onChange={(e) => {
            const opt = c.options?.find((o) => String(o.value) === e.target.value);
            if (opt) set(opt.value);
          }}
        >
          {c.options?.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const n = Number(value ?? sliderRange(c).min);
  return (
    <div className="sim-control sim-control--slider">
      <label className="sim-control__label" htmlFor={id}>
        {c.label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={RESOLUTION}
        step={1}
        value={Math.round(toFraction(c, n) * RESOLUTION)}
        aria-valuetext={formatControlValue(c, n)}
        onChange={(e) => set(fromFraction(c, Number(e.target.value) / RESOLUTION))}
      />
      <output htmlFor={id} className="sim-control__value num">
        {formatControlValue(c, n)}
      </output>
    </div>
  );
}

export function ControlPanel() {
  const sim = useSim();
  const items = sim.model.elements.flatMap((v) => v.controls.map((c) => ({ el: v.el, c })));
  if (items.length === 0) return null;
  return (
    <div className="sim-controls" role="group" aria-label="Controles do circuito">
      {items.map(({ el, c }) => (
        <Control key={`${el.id}.${c.param}`} el={el} c={c} />
      ))}
    </div>
  );
}
