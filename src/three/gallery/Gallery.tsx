/**
 * /dev/pecas: every part of the kit with controls for all its props, the
 * MDX snippet to use it, and a turntable mode that shows the frame rate.
 * `?peca=<id>` selects a part; `?poster` renders a bare view for the poster
 * generator (tests/e2e/kit3d-posters.spec.ts).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Viewer from '../core/Viewer';
import { CATEGORY_LABELS, type PartCategory, type PartControl, type PartProps } from '../types';
import './gallery.css';

export interface GalleryPart {
  id: string;
  label: string;
  category: PartCategory;
  summary: string;
  defaults: PartProps;
  controls: Record<string, PartControl>;
  poster?: string;
  explode: boolean;
  cutaway: boolean;
}

function parseProps(text: string | null): PartProps {
  try {
    return JSON.parse(text ?? '{}') as PartProps;
  } catch {
    return {};
  }
}

function readQuery() {
  const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const props = parseProps(query.get('props'));
  return {
    id: query.get('peca'),
    poster: query.has('poster'),
    props,
    explode: query.has('explodir'),
    cutaway: query.has('corte'),
    annotations: query.has('anotacoes'),
  };
}

export default function Gallery({ parts }: { parts: GalleryPart[] }) {
  const [initial] = useState(readQuery);
  const [selected, setSelected] = useState(
    () => parts.find((p) => p.id === initial.id)?.id ?? parts[0]?.id ?? '',
  );
  const part = parts.find((p) => p.id === selected);
  const [values, setValues] = useState<PartProps>(() => ({ ...part?.defaults, ...initial.props }));
  const [spin, setSpin] = useState(false);
  const fps = useFps(spin);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('peca', selected);
    history.replaceState(null, '', url);
  }, [selected]);

  const select = (id: string) => {
    const next = parts.find((p) => p.id === id);
    setSelected(id);
    setValues({ ...next?.defaults });
  };

  const groups = useMemo(() => {
    const byCategory = new Map<PartCategory, GalleryPart[]>();
    for (const p of parts) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
    return [...byCategory.entries()].sort(([a], [b]) =>
      CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b], 'pt-BR'),
    );
  }, [parts]);

  if (!part) return <p>Nenhuma peça registrada.</p>;

  if (initial.poster) {
    return (
      <div className="gallery-poster">
        <Viewer
          key={part.id}
          part={part.id}
          props={values}
          label={part.label}
          explode={initial.explode}
          cutaway={initial.cutaway}
          height={600}
          bare
          capture
          keepAlive
        />
      </div>
    );
  }

  const changed = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== part.defaults[key]),
  );
  const snippet = `<Model3D part="${part.id}"${
    Object.keys(changed).length
      ? ` props={${JSON.stringify(changed).replace(/"([a-zA-Z]+)":/g, '$1: ')}}`
      : ''
  } />`;

  return (
    <div className="gallery">
      <nav className="gallery__list" aria-label="Peças">
        {groups.map(([category, list]) => (
          <section key={category}>
            <h2 className="eyebrow">{CATEGORY_LABELS[category]}</h2>
            <ul>
              {list.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="gallery__item"
                    aria-current={p.id === selected ? 'true' : undefined}
                    onClick={() => select(p.id)}
                  >
                    {p.poster ? (
                      <img src={p.poster} alt="" width={64} height={40} loading="lazy" />
                    ) : (
                      <span className="gallery__thumb" aria-hidden="true" />
                    )}
                    <span>{p.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="gallery__main">
        <header className="gallery__header">
          <h2>{part.label}</h2>
          <p>{part.summary}</p>
        </header>
        <Viewer
          key={part.id}
          part={part.id}
          props={values}
          label={`Modelo 3D: ${part.label}`}
          height={520}
          poster={part.poster}
          explode={initial.explode && part.id === initial.id}
          cutaway={initial.cutaway && part.id === initial.id}
          annotations={initial.annotations && part.id === initial.id}
          keepAlive
          autoRotate={spin}
        />

        <div className="gallery__panel">
          <section aria-labelledby="gallery-props">
            <h3 id="gallery-props">Propriedades</h3>
            {Object.keys(part.controls).length === 0 && <p>Esta peça não tem propriedades.</p>}
            <div className="gallery__controls">
              {Object.entries(part.controls).map(([name, control]) => (
                <ControlField
                  key={`${part.id}-${name}`}
                  name={name}
                  control={control}
                  value={values[name] ?? part.defaults[name]}
                  onChange={(value) => setValues((v) => ({ ...v, [name]: value }))}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn gallery__reset"
              onClick={() => setValues({ ...part.defaults })}
            >
              Restaurar padrão
            </button>
          </section>

          <section aria-labelledby="gallery-code">
            <h3 id="gallery-code">Na aula (MDX)</h3>
            <pre className="gallery__code">
              <code>{snippet}</code>
            </pre>
            <label className="gallery__check">
              <input type="checkbox" checked={spin} onChange={(e) => setSpin(e.target.checked)} />
              Girar sem parar e medir o desempenho
            </label>
            {spin && (
              <p className="gallery__fps num" aria-live="polite">
                {fps > 0 ? `${fps} quadros por segundo` : 'Medindo…'}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ControlField({
  name,
  control,
  value,
  onChange,
}: {
  name: string;
  control: PartControl;
  value: PartProps[string];
  onChange: (value: string | number | boolean) => void;
}) {
  const id = `control-${name}`;
  let field: ReactNode;
  switch (control.kind) {
    case 'toggle':
      return (
        <label className="gallery__check" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          {control.label}
        </label>
      );
    case 'select':
      field = (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const option = control.options.find((o) => String(o.value) === e.target.value);
            onChange(option?.value ?? e.target.value);
          }}
        >
          {control.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'text':
      field = (
        <input
          id={id}
          type="text"
          value={String(value ?? '')}
          maxLength={control.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'number': {
      const n = Number(value);
      const toSlider = (v: number) => (control.log ? Math.log10(Math.max(v, control.min)) : v);
      const fromSlider = (v: number) => {
        if (!control.log) return v;
        const raw = 10 ** v;
        const magnitude = 10 ** Math.floor(Math.log10(raw));
        return (Math.round((raw / magnitude) * 10) / 10) * magnitude;
      };
      field = (
        <span className="gallery__number">
          <input
            id={id}
            type="range"
            min={toSlider(control.min)}
            max={toSlider(control.max)}
            step={control.log ? 0.01 : (control.step ?? (control.max - control.min) / 100)}
            value={toSlider(n)}
            onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
          />
          <input
            type="number"
            aria-label={`${control.label} (valor)`}
            value={Number.isFinite(n) ? n : 0}
            min={control.min}
            max={control.max}
            step="any"
            onChange={(e) => onChange(Number(e.target.value))}
          />
          {control.unit && <span className="gallery__unit">{control.unit}</span>}
        </span>
      );
      break;
    }
  }
  return (
    <div className="gallery__field">
      <label htmlFor={id}>{control.label}</label>
      {field}
    </div>
  );
}

/** Frames per second of the page while `active`. */
function useFps(active: boolean): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frames = 0;
    let start = performance.now();
    let raf = 0;
    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - start >= 1000) {
        setFps(Math.round((frames * 1000) / (now - start)));
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return active ? fps : 0;
}
