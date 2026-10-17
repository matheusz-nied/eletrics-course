/**
 * Card with the live values of the element under the pointer (or focused,
 * or tapped), and fields to change its values.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ParamInfo, ParamValue } from '../../engine/contract';
import { formatSI, parseSI } from '../format';
import { formatQuantity, quantityMeta } from '../readouts';
import type { ElementView } from '../schematic/model';
import { useSim, useSimState } from './context';
import { Icon } from './icons';

const MAIN = ['voltage', 'current', 'power'];

function ParamField({ view, name, info }: { view: ElementView; name: string; info: ParamInfo }) {
  const sim = useSim();
  const id = view.el.id;
  const value = useSimState((s) => s.params[id]?.[name]);
  const [text, setText] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const shown =
    text ??
    (typeof value === 'number' ? formatSI(value, '', { digits: 4 }).trim() : String(value ?? ''));
  const commit = () => {
    if (text === null) return;
    const n = parseSI(text, info.unit ?? '');
    const ok =
      Number.isFinite(n) &&
      (info.min === undefined || n >= info.min) &&
      (info.max === undefined || n <= info.max);
    setInvalid(!ok);
    if (ok) {
      sim.setParam(id, name, n);
      setText(null);
    }
  };
  const inputId = `insp-${id}-${name}`;
  return (
    <div className="sim-field">
      <label htmlFor={inputId}>{info.label}</label>
      <span className="sim-field__input">
        <input
          id={inputId}
          inputMode="decimal"
          value={shown}
          aria-invalid={invalid || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setText(null);
              setInvalid(false);
            }
          }}
        />
        {info.unit && <span className="sim-field__unit">{info.unit}</span>}
      </span>
      {invalid && <span className="sim-field__error">Valor inválido</span>}
    </div>
  );
}

export function Inspector({
  svgRef,
  wrapRef,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  wrapRef: RefObject<HTMLDivElement | null>;
}) {
  const sim = useSim();
  const focus = useSimState((s) => s.focus);
  const frame = useSimState((s) => s.slow);
  const params = useSimState((s) => (focus ? s.params[focus] : undefined));
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const view = sim.model.elements.find((v) => v.el.id === focus);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!view || !svg || !wrap) return setPos(null);
    const ctm = svg.getScreenCTM();
    if (!ctm) return setPos(null);
    const [x, y, w, h] = view.bbox;
    const pt = new DOMPoint(x + w / 2, y + h).matrixTransform(ctm);
    const r = wrap.getBoundingClientRect();
    setPos({ left: pt.x - r.left, top: pt.y - r.top + 8, width: r.width });
  }, [view, svgRef, wrapRef]);

  if (!view || !params) return null;
  const id = view.el.id;
  const pinKeys = view.two ? [] : view.pins.map((p) => `pin.${p.name}`);
  const readoutKeys = [
    ...(view.info?.readouts ?? []).filter((k) => !k.startsWith('pin.')),
    ...pinKeys,
  ];
  const values = readoutKeys
    .filter((k) => frame && frame.readouts[`${id}.${k}`] !== undefined)
    .sort((a, b) => (MAIN.indexOf(a) + 1 || 9) - (MAIN.indexOf(b) + 1 || 9));
  const controlParams = new Set(view.controls.map((c) => c.param));
  const editable = Object.entries(view.info?.params ?? {}).filter(
    ([k, p]) => p.unit && typeof p.default === 'number' && !controlParams.has(k),
  );
  const changed = Object.entries(sim.initialParams[id] ?? {}).some(
    ([k, v]) => (params as Record<string, ParamValue>)[k] !== v,
  );
  const left = pos ? Math.min(Math.max(pos.left, 130), Math.max(pos.width - 130, 130)) : undefined;

  return (
    <div
      ref={cardRef}
      className="sim-inspector"
      style={pos ? { left, top: pos.top } : undefined}
      role="dialog"
      aria-label={`${view.el.label ?? id}: valores`}
    >
      <div className="sim-inspector__head">
        <div>
          <p className="sim-inspector__name">{view.el.label ?? id}</p>
          <p className="sim-inspector__type">{view.info?.label ?? view.el.type}</p>
        </div>
        <button
          type="button"
          className="sim-btn sim-btn--ghost"
          onClick={() => sim.setFocus(null)}
          aria-label="Fechar"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      {values.length > 0 && (
        <dl className="sim-inspector__values">
          {values.map((k) => {
            const v = frame!.readouts[`${id}.${k}`];
            const shown =
              k === 'current' && typeof v === 'number'
                ? Math.abs(v)
                : k === 'power' && typeof v === 'number'
                  ? Math.abs(v)
                  : v;
            return (
              <div key={k}>
                <dt>{quantityMeta(k, view.info).label}</dt>
                <dd className="num">{formatQuantity(k, shown, 3, view.info)}</dd>
              </div>
            );
          })}
        </dl>
      )}
      {editable.length > 0 && (
        <div className="sim-inspector__edit">
          {editable.slice(0, 3).map(([k, p]) => (
            <ParamField key={k} view={view} name={k} info={p} />
          ))}
          {changed && (
            <button type="button" className="sim-link" onClick={() => sim.restoreParams(id)}>
              <Icon name="undo" size={14} /> Restaurar valores originais
            </button>
          )}
        </div>
      )}
    </div>
  );
}
