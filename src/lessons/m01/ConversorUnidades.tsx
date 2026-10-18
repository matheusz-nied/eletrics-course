/*
 * Lesson 1.6 (units): a converter. "Converter" writes one value with every
 * prefix, in scientific notation and as a calculator shows it; "Ler
 * marcação" reads the codes printed on resistors and ceramic capacitors.
 */
import { Fragment, useId, useState } from 'react';
import { parsePlain } from '../../course/quiz/grade';
import { formatSI, NBSP } from '../m00/formato';
import {
  bestPrefix,
  decodeMarking,
  formatCalculator,
  formatPlain,
  formatScientific,
  inPrefix,
  PREFIXES,
  toBase,
  type MarkingKind,
} from './unidades';
import '../m00/widget.css';
import './conversor-unidades.css';

const UNITS = [
  { symbol: 'Ω', name: 'ohm' },
  { symbol: 'A', name: 'ampère' },
  { symbol: 'V', name: 'volt' },
  { symbol: 'W', name: 'watt' },
  { symbol: 'F', name: 'farad' },
  { symbol: 'Hz', name: 'hertz' },
];

const EXAMPLES: Record<MarkingKind, string> = { resistor: '4K7', capacitor: '104' };

/** A long number that may only wrap after its thousands separators. */
function Grouped({ text }: { text: string }) {
  return (
    <>
      {text.split('.').map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              .<wbr />
            </>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}

function Converter() {
  const [text, setText] = useState('4,7');
  const [prefix, setPrefix] = useState('k');
  const [unit, setUnit] = useState('Ω');

  const number = parsePlain(text.trim().replace(/^−/, '-'));
  const base = number === undefined ? undefined : toBase(number, prefix);
  const best = base === undefined || base === 0 ? undefined : bestPrefix(base);

  return (
    <>
      <div className="conv-un__inputs">
        <label className="lw__field">
          <span>Valor</span>
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={number === undefined}
          />
        </label>
        <label className="lw__field">
          <span>Prefixo</span>
          <select value={prefix} onChange={(e) => setPrefix(e.target.value)}>
            {PREFIXES.map((p) => (
              <option key={p.name} value={p.symbol}>
                {p.symbol ? `${p.symbol} (${p.name})` : 'nenhum'}
              </option>
            ))}
          </select>
        </label>
        <label className="lw__field">
          <span>Unidade</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u.symbol} value={u.symbol}>
                {u.symbol} ({u.name})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="lw__output" aria-live="polite">
        {base === undefined ? (
          <div className="lw__status lw__status--warn">
            <span className="lw__status-dot" aria-hidden="true" />
            <p>Digite um número, com vírgula para os decimais, como 4,7 ou 0,25.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="lw__value-label">Do jeito mais fácil de ler</p>
              <p className="lw__value">{formatSI(base, unit, 6)}</p>
            </div>
            <dl className="conv-un__forms">
              <div>
                <dt>Sem prefixo</dt>
                <dd>
                  {formatPlain(base)} {unit}
                </dd>
              </div>
              <div>
                <dt>Notação científica</dt>
                <dd>
                  {formatScientific(base)} {unit}
                </dd>
              </div>
              <div>
                <dt>No visor da calculadora</dt>
                <dd className="conv-un__calc">{formatCalculator(base)}</dd>
              </div>
            </dl>
            <table className="conv-un__table">
              <caption className="lw__sr">O mesmo valor escrito com cada prefixo</caption>
              <thead>
                <tr>
                  <th scope="col">Prefixo</th>
                  <th scope="col">O mesmo valor</th>
                </tr>
              </thead>
              <tbody>
                {PREFIXES.map((p) => (
                  <tr
                    key={p.name}
                    className={best?.symbol === p.symbol ? 'conv-un__best' : undefined}
                  >
                    <th scope="row">
                      {p.name}
                      {p.symbol && ` (${p.symbol})`}
                    </th>
                    <td>
                      <Grouped text={formatPlain(inPrefix(base, p.symbol))} />
                      {NBSP}
                      {p.symbol}
                      {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lw__note">
              A linha destacada é a que deixa o número entre 1 e 999, o jeito que os técnicos
              costumam escrever. Cada linha para baixo multiplica o número por 1.000.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Marking() {
  const id = useId();
  const [kind, setKind] = useState<MarkingKind>('resistor');
  const [text, setText] = useState(EXAMPLES.resistor);
  const decoded = decodeMarking(text, kind);

  const choose = (k: MarkingKind) => {
    setKind(k);
    setText(EXAMPLES[k]);
  };

  return (
    <>
      <fieldset className="lw__group">
        <legend className="lw__legend">Componente</legend>
        <div className="lw__choices">
          <label className="lw__choice">
            <input
              type="radio"
              name={`${id}-tipo`}
              checked={kind === 'resistor'}
              onChange={() => choose('resistor')}
            />
            Resistor
          </label>
          <label className="lw__choice">
            <input
              type="radio"
              name={`${id}-tipo`}
              checked={kind === 'capacitor'}
              onChange={() => choose('capacitor')}
            />
            Capacitor cerâmico
          </label>
        </div>
      </fieldset>
      <label className="lw__field conv-un__code">
        <span>
          Marcação impressa (exemplos: {kind === 'resistor' ? '4K7, 2R2, 472' : '104, 102, 22, 4n7'}
          )
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!decoded}
          autoCapitalize="characters"
          spellCheck={false}
        />
      </label>

      <div className="lw__output" aria-live="polite">
        {decoded ? (
          <>
            <div>
              <p className="lw__value-label">Valor</p>
              <p className="lw__value">{formatSI(decoded.value, decoded.unit, 4)}</p>
            </div>
            <p>{decoded.steps}</p>
            {decoded.unit === 'F' && (
              <p className="lw__formula">
                {formatPlain(inPrefix(decoded.value, 'p'))} pF ={' '}
                {formatPlain(inPrefix(decoded.value, 'n'))} nF ={' '}
                {formatPlain(inPrefix(decoded.value, 'µ'))} µF
              </p>
            )}
            {decoded.tolerance && (
              <p className="lw__note">A letra no fim indica a tolerância: {decoded.tolerance}.</p>
            )}
          </>
        ) : (
          <div className="lw__status lw__status--warn">
            <span className="lw__status-dot" aria-hidden="true" />
            <p>
              Não reconheci essa marcação. Use o formato de{' '}
              {kind === 'resistor' ? 'resistores' : 'capacitores cerâmicos'}, como nos exemplos.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function ConversorUnidades() {
  const id = useId();
  const [mode, setMode] = useState<'converter' | 'marcacao'>('converter');

  return (
    <section className="lw conv-un" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Conversor de unidades
        </h3>
        <p className="lw__lead">
          Escreva um valor com qualquer prefixo e veja todas as formas de escrever o mesmo número,
          ou leia a marcação de um componente.
        </p>
      </header>

      <div className="lw__body">
        <fieldset className="lw__group">
          <legend className="lw__legend">O que fazer</legend>
          <div className="lw__choices">
            <label className="lw__choice">
              <input
                type="radio"
                name={`${id}-modo`}
                checked={mode === 'converter'}
                onChange={() => setMode('converter')}
              />
              Converter um valor
            </label>
            <label className="lw__choice">
              <input
                type="radio"
                name={`${id}-modo`}
                checked={mode === 'marcacao'}
                onChange={() => setMode('marcacao')}
              />
              Ler a marcação de um componente
            </label>
          </div>
        </fieldset>
        {mode === 'converter' ? <Converter /> : <Marking />}
      </div>
    </section>
  );
}
