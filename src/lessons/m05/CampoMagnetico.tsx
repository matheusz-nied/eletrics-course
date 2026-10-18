/*
 * Lesson 5.1: the field around bar magnets, drawn in the browser. Field lines
 * and a grid of compasses for one magnet, two opposite poles and two equal
 * poles, plus a probe the student moves (sliders, arrow keys or a click) to
 * read where a compass would point and how strong the field is there.
 */
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  directionWords,
  fieldAt,
  fieldLines,
  HEIGHT,
  insideMagnet,
  MAGNET_LENGTH,
  MAGNET_WIDTH,
  PRESETS,
  strength,
  WIDTH,
  type Magnet,
  type PresetId,
  type Vec,
} from './campo-magnetico';
import '../m00/widget.css';
import './campo-magnetico.css';

/** SVG px per figure unit. */
const S = 5;
const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

const SUMMARY: Record<PresetId, string> = {
  um: 'Um ímã em barra deitado, com o polo norte à direita. As linhas de campo saem do polo norte, fazem uma curva por fora e entram no polo sul; ficam juntas perto dos polos e espaçadas longe do ímã.',
  atraem:
    'Dois ímãs em fila, com o polo norte do primeiro de frente para o polo sul do segundo. Entre os dois, as linhas atravessam o espaço quase retas, do norte para o sul, bem juntas: o campo ali é forte e os ímãs se atraem.',
  repelem:
    'Dois ímãs em fila, com os dois polos norte frente a frente. As linhas que saem dos dois polos se empurram e se desviam para cima e para baixo; no meio do caminho entre os polos existe um ponto em que o campo se anula.',
};

function percent(b: number): string {
  const p = b * 100;
  if (p < 0.2) return 'praticamente zero';
  if (p < 10) return `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} %`;
  return `${Math.round(p).toLocaleString('pt-BR')} %`;
}

function linePath(line: Vec[]): string {
  return line
    .map((p, i) => `${i ? 'L' : 'M'}${(p.x * S).toFixed(1)} ${(p.y * S).toFixed(1)}`)
    .join('');
}

/** Arrowhead in the middle of the visible part of a line, pointing along it. */
function arrowAt(line: Vec[]): string | undefined {
  const visible = line
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.x > 1 && p.x < WIDTH - 1 && p.y > 1 && p.y < HEIGHT - 1);
  if (visible.length < 6) return undefined;
  const k = visible[Math.floor(visible.length / 2)]!.i;
  const a = line[Math.max(0, k - 1)]!;
  const b = line[Math.min(line.length - 1, k + 1)]!;
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return `translate(${(line[k]!.x * S).toFixed(1)} ${(line[k]!.y * S).toFixed(1)}) rotate(${angle.toFixed(1)})`;
}

function MagnetBar({ m }: { m: Magnet }) {
  const x = (m.x - MAGNET_LENGTH / 2) * S;
  const y = (m.y - MAGNET_WIDTH / 2) * S;
  const w = MAGNET_LENGTH * S;
  const h = MAGNET_WIDTH * S;
  const northRight = m.north === 'right';
  return (
    <g className="cm__magnet">
      <rect x={x} y={y} width={w / 2} height={h} className={northRight ? 'cm__s' : 'cm__n'} />
      <rect
        x={x + w / 2}
        y={y}
        width={w / 2}
        height={h}
        className={northRight ? 'cm__n' : 'cm__s'}
      />
      <rect x={x} y={y} width={w} height={h} rx={3} className="cm__outline" />
      <text x={x + w / 4} y={y + h / 2 + 5} className="cm__pole">
        {northRight ? 'S' : 'N'}
      </text>
      <text x={x + (3 * w) / 4} y={y + h / 2 + 5} className="cm__pole">
        {northRight ? 'N' : 'S'}
      </text>
    </g>
  );
}

function Needle({ at, b }: { at: Vec; b: Vec }) {
  const n = strength(b);
  if (n < 1e-9) return null;
  const angle = (Math.atan2(b.y, b.x) * 180) / Math.PI;
  return (
    <g transform={`translate(${at.x * S} ${at.y * S}) rotate(${angle.toFixed(1)})`}>
      <path d="M0 -3.2L14 0L0 3.2Z" className="cm__needle-n" />
      <path d="M0 -3.2L-14 0L0 3.2Z" className="cm__needle-s" />
      <circle r={1.6} className="cm__pivot" />
    </g>
  );
}

export default function CampoMagnetico() {
  const id = useId();
  const [preset, setPreset] = useState<PresetId>('um');
  const [showLines, setShowLines] = useState(true);
  const [showCompasses, setShowCompasses] = useState(true);
  const [probe, setProbe] = useState<Vec>({ x: 50, y: 14 });

  const magnets = PRESETS[preset].magnets;
  const lines = useMemo(() => fieldLines(magnets), [magnets]);
  const grid = useMemo(() => {
    const out: { at: Vec; b: Vec }[] = [];
    for (let x = 5; x < WIDTH; x += 10) {
      for (let y = 5; y < HEIGHT; y += 10) {
        const at = { x, y };
        if (!insideMagnet(magnets, at, 1.5)) out.push({ at, b: fieldAt(magnets, at) });
      }
    }
    return out;
  }, [magnets]);

  const onMagnet = insideMagnet(magnets, probe, 0.5);
  const b = fieldAt(magnets, probe);
  const intensity = strength(b);
  const neutral = !onMagnet && intensity < 0.002;

  const move = (p: Vec) =>
    setProbe({
      x: Math.min(WIDTH, Math.max(0, Math.round(p.x))),
      y: Math.min(HEIGHT, Math.max(0, Math.round(p.y))),
    });

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 5 : 1;
    const d: Record<string, Vec> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = d[e.key];
    if (!delta) return;
    e.preventDefault();
    move({ x: probe.x + delta.x, y: probe.y + delta.y });
  };

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    // A tap places the probe; dragging only with a mouse, so a finger still scrolls the page.
    if (e.type === 'pointermove' && (e.pointerType !== 'mouse' || e.buttons === 0)) return;
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    move({
      x: ((e.clientX - r.left) / r.width) * WIDTH,
      y: ((e.clientY - r.top) / r.height) * HEIGHT,
    });
  };

  const reading = onMagnet
    ? 'A sonda está em cima do ímã. Leve-a para fora dele.'
    : neutral
      ? 'O campo aqui é praticamente zero: as influências dos ímãs se cancelam e uma bússola fica sem direção definida.'
      : `Uma bússola aqui apontaria o norte da agulha ${directionWords(b)}. Intensidade: ${percent(intensity)} da que existe encostado no polo de um ímã sozinho.`;

  return (
    <section className="lw cm" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O campo em volta dos ímãs
        </h3>
        <p className="lw__lead">
          Escolha a montagem e leve a sonda (o círculo amarelo) pelo desenho: clique ou arraste no
          desenho, use as setas do teclado ou os controles abaixo.
        </p>
      </header>

      <div className="lw__body">
        <fieldset className="lw__group">
          <legend className="lw__legend">Montagem</legend>
          <div className="lw__choices">
            {PRESET_IDS.map((p) => (
              <label key={p} className="lw__choice">
                <input
                  type="radio"
                  name={`${id}-preset`}
                  checked={p === preset}
                  onChange={() => setPreset(p)}
                />
                {PRESETS[p].label}
              </label>
            ))}
          </div>
        </fieldset>

        <svg
          className="cm__plot"
          viewBox={`0 0 ${WIDTH * S} ${HEIGHT * S}`}
          role="img"
          aria-label={`${SUMMARY[preset]} Sonda em ${probe.x} por ${probe.y}. ${reading}`}
          tabIndex={0}
          onKeyDown={onKey}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
        >
          <rect width={WIDTH * S} height={HEIGHT * S} className="cm__bg" />
          {showLines &&
            lines.map((line, i) => {
              const arrow = arrowAt(line);
              return (
                <g key={i}>
                  <path d={linePath(line)} className="cm__line" />
                  {arrow && (
                    <path d="M-5 -3.5L3 0L-5 3.5Z" transform={arrow} className="cm__arrow" />
                  )}
                </g>
              );
            })}
          {showCompasses &&
            grid.map((g) => <Needle key={`${g.at.x}-${g.at.y}`} at={g.at} b={g.b} />)}
          {magnets.map((m) => (
            <MagnetBar key={`${m.x}-${m.north}`} m={m} />
          ))}
          <g transform={`translate(${probe.x * S} ${probe.y * S})`} className="cm__probe">
            {!onMagnet && !neutral && (
              <g transform={`rotate(${((Math.atan2(b.y, b.x) * 180) / Math.PI).toFixed(1)})`}>
                <path d="M0 0H30" className="cm__probe-dir" />
                <path d="M30 -5L40 0L30 5Z" className="cm__probe-head" />
              </g>
            )}
            <circle r={9} className="cm__probe-ring" />
            <circle r={2.5} className="cm__probe-dot" />
          </g>
        </svg>

        <div className="cm__controls">
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Sonda: posição na horizontal</span>
              <strong className="num">{probe.x}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={WIDTH}
              step={1}
              value={probe.x}
              onChange={(e) => move({ x: Number(e.target.value), y: probe.y })}
            />
          </label>
          <label className="lw__range">
            <span className="lw__range-head">
              <span>Sonda: posição na vertical</span>
              <strong className="num">{probe.y}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={HEIGHT}
              step={1}
              value={probe.y}
              onChange={(e) => move({ x: probe.x, y: Number(e.target.value) })}
            />
          </label>
          <div className="cm__checks">
            <label className="lw__check">
              <input
                type="checkbox"
                checked={showLines}
                onChange={(e) => setShowLines(e.target.checked)}
              />
              Linhas de campo
            </label>
            <label className="lw__check">
              <input
                type="checkbox"
                checked={showCompasses}
                onChange={(e) => setShowCompasses(e.target.checked)}
              />
              Bússolas
            </label>
          </div>
        </div>

        <div className="lw__output" aria-live="polite">
          <p className="lw__value-label">Na sonda</p>
          <p className="lw__value cm__value">{onMagnet ? '—' : percent(intensity)}</p>
          <p className="lw__note cm__reading">{reading}</p>
        </div>
      </div>
    </section>
  );
}
