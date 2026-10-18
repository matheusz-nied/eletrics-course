/*
 * Step-by-step reduction of a resistor circuit (lesson 02.4): one schematic per
 * stage, with the group being combined highlighted, the formula and the
 * result. The stages are plain data (./reduction-data.ts), so the same
 * component can show other circuits. Server-rendered at the first stage, so
 * the drawing is there without JavaScript.
 */
import { useId, useState, type KeyboardEvent } from 'react';
import './reduction-steps.css';

export type Pt = [number, number];

export type ReductionItem =
  | { kind: 'wire'; points: Pt[] }
  /** `hl`: the group combined in this stage; `fresh`: created in the previous stage. */
  | { kind: 'resistor'; a: Pt; b: Pt; name: string; value: string; hl?: boolean; fresh?: boolean }
  /** DC source, `a` is the positive terminal. */
  | { kind: 'source'; a: Pt; b: Pt; label: string }
  | { kind: 'node'; at: Pt; label?: string }
  | {
      kind: 'note';
      at: Pt;
      text: string;
      anchor?: 'start' | 'middle' | 'end';
      tone?: 'current' | 'voltage';
    };

export interface ReductionStage {
  /** "Etapa 1: R3 e R4 em série" */
  title: string;
  /** What to notice and why, in pt-BR. */
  text: string;
  /** Plain-text formula with numbers: "R34 = R3 + R4 = 100 Ω + 200 Ω = 300 Ω". */
  formula?: string;
  items: ReductionItem[];
}

export interface ReductionStepsProps {
  /** Heading of the block. */
  title: string;
  stages: ReductionStage[];
  /** Drawing size in SVG units (default 360 × 220). */
  width?: number;
  height?: number;
}

const BODY = 36;
const THICK = 14;

function Resistor({ item }: { item: Extract<ReductionItem, { kind: 'resistor' }> }) {
  const [ax, ay] = item.a;
  const [bx, by] = item.b;
  const horizontal = ay === by;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const cls = item.hl ? 'rs-part is-hl' : item.fresh ? 'rs-part is-fresh' : 'rs-part';
  if (horizontal) {
    const x0 = mx - BODY / 2;
    const x1 = mx + BODY / 2;
    return (
      <g className={cls}>
        <path d={`M${Math.min(ax, bx)} ${ay} H${x0} M${x1} ${ay} H${Math.max(ax, bx)}`} />
        <rect x={x0} y={ay - THICK / 2} width={BODY} height={THICK} rx={2} />
        <text x={mx} y={ay - THICK / 2 - 7} className="rs-name">
          {item.name}
        </text>
        <text x={mx} y={ay + THICK / 2 + 16} className="rs-value">
          {item.value}
        </text>
      </g>
    );
  }
  const y0 = my - BODY / 2;
  const y1 = my + BODY / 2;
  return (
    <g className={cls}>
      <path d={`M${ax} ${Math.min(ay, by)} V${y0} M${ax} ${y1} V${Math.max(ay, by)}`} />
      <rect x={ax - THICK / 2} y={y0} width={THICK} height={BODY} rx={2} />
      <text x={ax + THICK / 2 + 6} y={my - 3} className="rs-name rs-start">
        {item.name}
      </text>
      <text x={ax + THICK / 2 + 6} y={my + 14} className="rs-value rs-start">
        {item.value}
      </text>
    </g>
  );
}

function Source({ item }: { item: Extract<ReductionItem, { kind: 'source' }> }) {
  const [x, ya] = item.a;
  const yb = item.b[1];
  const my = (ya + yb) / 2;
  const r = 16;
  return (
    <g className="rs-source">
      <path d={`M${x} ${ya} V${my - r} M${x} ${my + r} V${yb}`} />
      <circle cx={x} cy={my} r={r} />
      <path
        d={`M${x - 5} ${my - 6} H${x + 5} M${x} ${my - 11} V${my - 1} M${x - 5} ${my + 7} H${x + 5}`}
      />
      <text x={x - r - 6} y={my + 5} className="rs-value rs-end">
        {item.label}
      </text>
    </g>
  );
}

function Drawing({
  stage,
  width,
  height,
}: {
  stage: ReductionStage;
  width: number;
  height: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="rs-svg"
      role="img"
      aria-label={`Esquema: ${stage.title}`}
    >
      {stage.items.map((item, i) => {
        switch (item.kind) {
          case 'wire':
            return (
              <polyline
                key={i}
                className="rs-wire"
                points={item.points.map((p) => p.join(',')).join(' ')}
              />
            );
          case 'resistor':
            return <Resistor key={i} item={item} />;
          case 'source':
            return <Source key={i} item={item} />;
          case 'node':
            return (
              <g key={i} className="rs-node">
                <circle cx={item.at[0]} cy={item.at[1]} r={3.5} />
                {item.label && (
                  <text x={item.at[0] - 8} y={item.at[1] - 8} className="rs-node-label rs-end">
                    {item.label}
                  </text>
                )}
              </g>
            );
          case 'note':
            return (
              <text
                key={i}
                x={item.at[0]}
                y={item.at[1]}
                className={`rs-note rs-${item.anchor ?? 'middle'} is-${item.tone ?? 'current'}`}
              >
                {item.text}
              </text>
            );
          default:
            return null;
        }
      })}
    </svg>
  );
}

export default function ReductionSteps({
  title,
  stages,
  width = 360,
  height = 220,
}: ReductionStepsProps) {
  const [index, setIndex] = useState(0);
  const uid = useId();
  const stage = stages[index]!;
  const last = stages.length - 1;
  const go = (i: number) => setIndex(Math.min(Math.max(i, 0), last));

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  };

  return (
    <section className="rs" aria-labelledby={`${uid}-title`} data-component="ReductionSteps">
      <header className="rs-head">
        <p className="rs-kicker">Redução passo a passo</p>
        <h3 id={`${uid}-title`} className="rs-title">
          {title}
        </h3>
      </header>
      <div className="rs-body" onKeyDown={onKey}>
        <div className="rs-figure">
          <Drawing stage={stage} width={width} height={height} />
          <ul className="rs-legend" aria-hidden="true">
            <li>
              <span className="rs-swatch is-hl" /> grupo desta etapa
            </li>
            <li>
              <span className="rs-swatch is-fresh" /> resultado da etapa anterior
            </li>
          </ul>
        </div>
        <div className="rs-text" aria-live="polite">
          <p className="rs-stage">
            Etapa {index + 1} de {stages.length}
          </p>
          <p className="rs-stage-title">{stage.title}</p>
          <p>{stage.text}</p>
          {stage.formula && <p className="rs-formula">{stage.formula}</p>}
        </div>
        <nav className="rs-nav" aria-label="Etapas da redução">
          <button
            type="button"
            className="rs-btn"
            onClick={() => go(index - 1)}
            disabled={index === 0}
          >
            ← Anterior
          </button>
          <ol className="rs-dots">
            {stages.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="rs-dot"
                  aria-label={`Etapa ${i + 1}: ${s.title}`}
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => go(i)}
                />
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="rs-btn rs-btn--primary"
            onClick={() => go(index + 1)}
            disabled={index === last}
          >
            Próximo →
          </button>
        </nav>
      </div>
    </section>
  );
}
