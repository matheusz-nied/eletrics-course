/*
 * Lesson 4.1: the colour code game. "Ler": a random resistor from the E12 or
 * E24 series; the student types the value (4700, 4,7k, 4K7…) and sees how
 * each band is read. "Montar": pick the bands and see the value, the
 * tolerance range and whether it is a commercial value.
 */
import { useId, useState, type SubmitEvent } from 'react';
import { parseAnswer } from '../../course/quiz/grade';
import {
  BAND_HEX,
  bandLayout,
  bandMeaning,
  bodyHex,
  colorLabel,
  decode,
  DIGIT_COLORS,
  E12,
  E24,
  encode,
  formatMultiplier,
  formatOhms,
  inSeries,
  isRightAnswer,
  MULTIPLIER_EXPONENT,
  randomRound,
  TOLERANCE_PERCENT,
  toleranceRange,
  type BandColor,
  type BandCount,
  type Round,
} from './color-code';
import '../m00/widget.css';
import './color-code-game.css';

const FIRST_ROUND: Round = { ohms: 220, tolerance: 5, bands: encode(220, 5) };

const MULTIPLIER_COLORS = Object.keys(MULTIPLIER_EXPONENT) as BandColor[];
const TOLERANCE_COLORS = Object.keys(TOLERANCE_PERCENT) as BandColor[];

/** "amarelo, violeta, vermelho e dourado" */
function bandList(bands: readonly BandColor[]): string {
  return `${bands.slice(0, -1).join(', ')} e ${bands[bands.length - 1]}`;
}

/** The resistor drawn with its bands; the tolerance band stands apart on the right. */
function ResistorDrawing({ bands, label }: { bands: readonly BandColor[]; label: string }) {
  const clip = useId();
  const x0 = 60;
  const width = 240;
  return (
    <svg className="ccg__resistor" viewBox="0 0 360 100" role="img" aria-label={label}>
      <path className="ccg__lead" d="M0 50H70M290 50H360" />
      <clipPath id={clip}>
        <rect x={x0} y={26} width={width} height={48} rx={18} />
      </clipPath>
      <rect x={x0} y={26} width={width} height={48} rx={18} fill={bodyHex(bands.length)} />
      <g clipPath={`url(#${clip})`}>
        {bandLayout(bands, width).map((b, i) => (
          <rect key={i} x={x0 + b.x} y={20} width={b.width} height={60} fill={BAND_HEX[b.color]} />
        ))}
        <rect className="ccg__shine" x={x0} y={30} width={width} height={10} />
      </g>
      <rect className="ccg__outline" x={x0} y={26} width={width} height={48} rx={18} fill="none" />
    </svg>
  );
}

/** How each band reads: "Amarelo 4", "Vermelho ×100", "Dourado ±5 %". */
function Breakdown({ bands }: { bands: readonly BandColor[] }) {
  return (
    <ol className="ccg__breakdown">
      {bands.map((band, i) => (
        <li key={i}>
          <span className="ccg__swatch" style={{ background: BAND_HEX[band] }} aria-hidden="true" />
          <span className="ccg__band-name">{colorLabel(band)}</span>
          <span className="ccg__band-meaning">{bandMeaning(bands, i)}</span>
        </li>
      ))}
    </ol>
  );
}

function explain(bands: readonly BandColor[]): string {
  const d = decode(bands)!;
  const [lo, hi] = toleranceRange(d.ohms, d.tolerance);
  const times = formatMultiplier(d.exponent).replace('×', '× ');
  const tolerance = String(d.tolerance).replace('.', ',');
  return `${d.digits} ${times} = ${formatOhms(d.ohms)}, com tolerância de ±${tolerance} % (de ${formatOhms(lo, 4)} a ${formatOhms(hi, 4)}).`;
}

function ReadMode() {
  const id = useId();
  const [round, setRound] = useState<Round>(FIRST_ROUND);
  const [text, setText] = useState('');
  const [result, setResult] = useState<'right' | 'wrong' | 'invalid' | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [counted, setCounted] = useState(false);

  const check = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = parseAnswer(text, 'Ω');
    if (value === undefined || !(value > 0)) {
      setResult('invalid');
      return;
    }
    const right = isRightAnswer(value, round.ohms);
    setResult(right ? 'right' : 'wrong');
    if (!counted) {
      setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
      setCounted(true);
    }
  };

  const next = () => {
    let r = randomRound(Math.random);
    while (r.ohms === round.ohms) r = randomRound(Math.random);
    setRound(r);
    setText('');
    setResult(null);
    setCounted(false);
  };

  const shown = result === 'right' || result === 'wrong';

  return (
    <div className="ccg__mode">
      <ResistorDrawing
        bands={round.bands}
        label={`Resistor de ${round.bands.length} faixas: ${bandList(round.bands)}.`}
      />
      <p className="lw__note">
        {round.bands.length} faixas. Leia da esquerda para a direita: a faixa da tolerância é a que
        fica separada, à direita.
      </p>
      <form className="ccg__answer" onSubmit={check}>
        <label className="lw__field" htmlFor={`${id}-valor`}>
          Valor do resistor
          <input
            id={`${id}-valor`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="ex.: 4700, 4,7k ou 4K7"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (result === 'invalid') setResult(null);
            }}
          />
        </label>
        <div className="ccg__actions">
          <button type="submit" className="lw__btn lw__btn--primary">
            Conferir
          </button>
          <button type="button" className="lw__btn" onClick={next}>
            Próximo resistor
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {result === 'invalid' && (
          <div className="lw__status lw__status--warn">
            <span className="lw__status-dot" aria-hidden="true" />
            <p>Não entendi o número. Escreva, por exemplo, 4700, 4,7k ou 4K7.</p>
          </div>
        )}
        {shown && (
          <div className={`lw__status lw__status--${result === 'right' ? 'ok' : 'warn'}`}>
            <span className="lw__status-dot" aria-hidden="true" />
            <p>
              <strong>{result === 'right' ? 'Certo.' : 'Ainda não.'}</strong>{' '}
              {result === 'right'
                ? explain(round.bands)
                : 'Confira cada faixa na tabela abaixo e tente de novo.'}
            </p>
          </div>
        )}
      </div>
      {shown && <Breakdown bands={round.bands} />}
      <p className="lw__note ccg__score">
        Acertos na primeira tentativa: {score.right} de {score.total}
      </p>
    </div>
  );
}

function BandSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: BandColor;
  options: readonly BandColor[];
  onChange: (c: BandColor) => void;
}) {
  return (
    <label className="lw__field ccg__band">
      <span className="ccg__band-label">
        <span className="ccg__swatch" style={{ background: BAND_HEX[value] }} aria-hidden="true" />
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value as BandColor)}>
        {options.map((c) => (
          <option key={c} value={c}>
            {colorLabel(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

function BuildMode() {
  const id = useId();
  const [count, setCount] = useState<BandCount>(4);
  const [digits, setDigits] = useState<BandColor[]>(['amarelo', 'violeta', 'preto']);
  const [multiplier, setMultiplier] = useState<BandColor>('vermelho');
  const [tolerance, setTolerance] = useState<BandColor>('dourado');

  const n = count === 5 ? 3 : 2;
  const bands = [...digits.slice(0, n), multiplier, tolerance];
  const d = decode(bands);
  const commercial =
    d && d.ohms > 0
      ? inSeries(d.ohms, E12)
        ? 'É um valor comercial das séries E12 e E24.'
        : inSeries(d.ohms, E24)
          ? 'É um valor comercial da série E24 (não está na E12).'
          : 'Não é um valor das séries E12 nem E24; existe em séries de precisão ou não existe à venda.'
      : '';

  const setDigit = (i: number, c: BandColor) =>
    setDigits((old) => old.map((v, j) => (j === i ? c : v)));

  const ordinal = ['1º', '2º', '3º'];

  return (
    <div className="ccg__mode">
      <fieldset className="lw__group">
        <legend className="lw__legend">Quantas faixas</legend>
        <div className="lw__choices">
          {([4, 5] as const).map((c) => (
            <label key={c} className="lw__choice">
              <input
                type="radio"
                name={`${id}-faixas`}
                value={c}
                checked={count === c}
                onChange={() => {
                  setCount(c);
                  setTolerance(c === 5 ? 'marrom' : 'dourado');
                }}
              />
              {c} faixas
            </label>
          ))}
        </div>
      </fieldset>

      <div className="ccg__bands">
        {digits.slice(0, n).map((c, i) => (
          <BandSelect
            key={i}
            label={`${i + 1}ª faixa: ${ordinal[i]} algarismo`}
            value={c}
            options={DIGIT_COLORS}
            onChange={(v) => setDigit(i, v)}
          />
        ))}
        <BandSelect
          label={`${n + 1}ª faixa: multiplicador`}
          value={multiplier}
          options={MULTIPLIER_COLORS}
          onChange={setMultiplier}
        />
        <BandSelect
          label={`${n + 2}ª faixa: tolerância`}
          value={tolerance}
          options={TOLERANCE_COLORS}
          onChange={setTolerance}
        />
      </div>

      <ResistorDrawing
        bands={bands}
        label={`Resistor de ${bands.length} faixas: ${bandList(bands)}.`}
      />

      <div className="lw__output" aria-live="polite">
        <p className="lw__value-label">Valor</p>
        <p className="lw__value">
          {d && d.ohms > 0 ? formatOhms(d.ohms) : 'Zero'}
          {d && d.ohms > 0 && (
            <span className="ccg__tol"> ±{String(d.tolerance).replace('.', ',')} %</span>
          )}
        </p>
        {d && d.ohms > 0 ? (
          <>
            <p className="lw__formula">{explain(bands)}</p>
            <p className="lw__note">{commercial}</p>
          </>
        ) : (
          <p className="lw__note">
            Com o primeiro algarismo preto o valor fica zero ou começa com zero: escolha outra cor
            para a primeira faixa.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ColorCodeGame() {
  const id = useId();
  const [mode, setMode] = useState<'ler' | 'montar'>('ler');
  return (
    <section className="lw ccg" data-widget="codigo-de-cores" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Jogo</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Código de cores
        </h3>
        <p className="lw__lead">
          Em <strong>Ler</strong>, descubra o valor do resistor sorteado. Em <strong>Montar</strong>
          , escolha as faixas e veja o valor.
        </p>
      </header>
      <div className="lw__body">
        <fieldset className="lw__group">
          <legend className="lw__legend">Modo</legend>
          <div className="lw__choices">
            <label className="lw__choice">
              <input
                type="radio"
                name={`${id}-modo`}
                value="ler"
                checked={mode === 'ler'}
                onChange={() => setMode('ler')}
              />
              Ler o valor
            </label>
            <label className="lw__choice">
              <input
                type="radio"
                name={`${id}-modo`}
                value="montar"
                checked={mode === 'montar'}
                onChange={() => setMode('montar')}
              />
              Montar as faixas
            </label>
          </div>
        </fieldset>
        {mode === 'ler' ? <ReadMode /> : <BuildMode />}
      </div>
    </section>
  );
}
