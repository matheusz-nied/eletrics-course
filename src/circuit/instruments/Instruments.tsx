/**
 * The instrument bench under the schematic: tabs for the multimeter,
 * oscilloscope, time chart and Bode plot. Only the open tab runs.
 */
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { CircuitDoc } from '../../engine/contract';
import { useSim } from '../ui/context';
import { Bode } from './Bode';
import { Multimeter } from './Multimeter';
import { Oscilloscope } from './Oscilloscope';
import { sourceFrequency } from './scope';
import { TimeChart } from './TimeChart';

export type InstrumentKind = 'multimetro' | 'osciloscopio' | 'grafico' | 'bode';

/** What a lesson can ask for: a kind, or a kind with the series it shows. */
export type InstrumentSpec = InstrumentKind | { kind: InstrumentKind; series?: string[] };

const LABELS: Record<InstrumentKind, string> = {
  multimetro: 'Multímetro',
  osciloscopio: 'Osciloscópio',
  grafico: 'Gráfico',
  bode: 'Bode',
};

/** Instruments shown when the lesson does not choose: what fits the analysis. */
export function defaultInstruments(doc: CircuitDoc): InstrumentKind[] {
  if (!doc.probes?.length) return [];
  switch (doc.analysis.kind) {
    case 'ac-sweep':
      return ['bode'];
    case 'dc':
      return ['multimetro'];
    case 'transient':
      return ['multimetro', 'osciloscopio', 'grafico'];
    case 'quasi-static':
      return ['multimetro', 'grafico'];
  }
}

export function normalizeInstruments(
  doc: CircuitDoc,
  specs: InstrumentSpec[] | undefined,
): { kind: InstrumentKind; series: string[] }[] {
  const probes = (doc.probes ?? []).map((p) => p.id);
  return (specs ?? defaultInstruments(doc)).map((s) =>
    typeof s === 'string'
      ? { kind: s, series: probes }
      : { kind: s.kind, series: s.series ?? probes },
  );
}

function Panel({ kind, series, doc }: { kind: InstrumentKind; series: string[]; doc: CircuitDoc }) {
  const probes = (doc.probes ?? []).filter((p) => series.includes(p.id));
  if (kind === 'multimetro') {
    const ac = Number.isFinite(sourceFrequency(doc));
    return (
      <div className="dmm-grid">
        {probes.slice(0, 4).map((p) => (
          <Multimeter key={p.id} probe={p} defaultMode={ac ? 'ac' : 'dc'} />
        ))}
      </div>
    );
  }
  if (kind === 'osciloscopio') return <Oscilloscope channels={series} />;
  if (kind === 'grafico') return <TimeChart series={series} />;
  return <Bode probes={series} />;
}

export function Instruments({ items }: { items: { kind: InstrumentKind; series: string[] }[] }) {
  const sim = useSim();
  const uid = useId();
  const [active, setActive] = useState(0);
  const tabs = useMemo(() => items.filter((it) => it.series.length > 0), [items]);
  if (tabs.length === 0) return null;
  const current = Math.min(active, tabs.length - 1);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const move: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: -current,
      End: tabs.length - 1 - current,
    };
    const d = move[e.key];
    if (d === undefined) return;
    e.preventDefault();
    const next = (current + d + tabs.length) % tabs.length;
    setActive(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <section className="sim-instruments" aria-label="Instrumentos">
      {tabs.length > 1 && (
        <div className="sim-tabs" role="tablist" aria-label="Instrumentos">
          {tabs.map((t, i) => (
            <button
              key={t.kind}
              id={`${uid}-tab-${i}`}
              type="button"
              role="tab"
              className="sim-tab"
              aria-selected={i === current}
              aria-controls={`${uid}-panel`}
              tabIndex={i === current ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onKey}
            >
              {LABELS[t.kind]}
            </button>
          ))}
        </div>
      )}
      <div
        id={`${uid}-panel`}
        className="sim-instruments__panel"
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `${uid}-tab-${current}` : undefined}
        aria-label={tabs.length > 1 ? undefined : LABELS[tabs[current]!.kind]}
      >
        <Panel
          key={tabs[current]!.kind}
          kind={tabs[current]!.kind}
          series={tabs[current]!.series}
          doc={sim.doc}
        />
      </div>
    </section>
  );
}
