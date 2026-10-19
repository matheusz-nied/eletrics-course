/*
 * Lesson 9.4: the resistor for one or more LEDs in series. The student picks
 * the supply, the color, how many LEDs and the current; the widget gives the
 * calculated resistance, the next standard value and the current that value
 * really gives (led-calc.ts, the same LED model as the simulations).
 */
import { useId, useState } from 'react';
import { formatNumber, formatSI } from '../m00/formato';
import { LEDS, designResistor, type LedColor } from './led-calc';
import '../m00/widget.css';
import './led-calculadora.css';

const SUPPLIES = [3.3, 5, 9, 12, 24];

/** "2,0 V": forward voltages always with one decimal. */
const volts1 = (v: number) => `${v.toFixed(1).replace('.', ',')} V`;
const COLORS = Object.keys(LEDS) as LedColor[];

/** "1/4 W", "1 W". */
function ratingLabel(watts: number): string {
  if (watts < 1) return `1/${Math.round(1 / watts)} W`;
  return `${formatNumber(watts)} W`;
}

export default function LedCalculadora() {
  const id = useId();
  const [supply, setSupply] = useState(5);
  const [color, setColor] = useState<LedColor>('red');
  const [count, setCount] = useState(1);
  const [milliamps, setMilliamps] = useState(10);

  const led = LEDS[color];
  const design = designResistor(supply, color, count, milliamps / 1000);
  const lit = design.chosen !== undefined;
  const tight = lit && design.tight;

  let status: { tone: 'ok' | 'warn' | 'danger'; label: string; note: string };
  if (!lit) {
    status = {
      tone: 'danger',
      label: 'A fonte não dá conta',
      note: `${count} ${count > 1 ? 'LEDs pedem' : 'LED pede'} cerca de ${volts1(count * led.vf)}, e a fonte tem ${formatSI(supply, 'V')}. Use menos LEDs em série ou uma fonte maior.`,
    };
  } else if (tight) {
    status = {
      tone: 'warn',
      label: 'Funciona, mas com pouca folga',
      note: 'Sobra pouca tensão para o resistor. Uma pequena variação da fonte ou da tensão dos LEDs muda muito a corrente.',
    };
  } else {
    status = {
      tone: 'ok',
      label: 'Projeto bom',
      note: 'O resistor fica com tensão de sobra, e a corrente quase não depende das diferenças entre LEDs.',
    };
  }

  return (
    <section className="lw ledcalc" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Calcule</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O resistor do seu LED
        </h3>
        <p className="lw__lead">
          Escolha a fonte, a cor, quantos LEDs vão em série e a corrente que você quer. A
          calculadora usa a tensão direta típica de cada cor a 20 mA.
        </p>
      </header>

      <div className="lw__body">
        <div className="lw__controls">
          <fieldset className="lw__group">
            <legend className="lw__legend">Tensão da fonte</legend>
            <div className="lw__choices">
              {SUPPLIES.map((v) => (
                <label key={v} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-fonte`}
                    checked={v === supply}
                    onChange={() => setSupply(v)}
                  />
                  {formatSI(v, 'V')}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="lw__field">
            <span>Cor do LED</span>
            <select value={color} onChange={(e) => setColor(e.target.value as LedColor)}>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {LEDS[c].label} (cerca de {volts1(LEDS[c].vf)})
                </option>
              ))}
            </select>
          </label>

          <label className="lw__range">
            <span className="lw__range-head">
              <span>LEDs em série</span>
              <strong className="num">{count}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={count}
              aria-valuetext={`${count} ${count > 1 ? 'LEDs' : 'LED'}`}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>

          <label className="lw__range">
            <span className="lw__range-head">
              <span>Corrente desejada</span>
              <strong className="num">{milliamps} mA</strong>
            </span>
            <input
              type="range"
              min={2}
              max={25}
              step={1}
              value={milliamps}
              aria-valuetext={`${milliamps} miliampères`}
              onChange={(e) => setMilliamps(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="lw__output" aria-live="polite">
          <div className={`lw__status lw__status--${status.tone}`}>
            <span className="lw__status-dot" aria-hidden="true" />
            <div>
              <p>
                <strong>{status.label}</strong>
              </p>
              <p className="lw__note">{status.note}</p>
            </div>
          </div>

          {lit && (
            <>
              <p className="lw__formula">
                R = ({formatSI(supply, 'V')} − {count > 1 ? `${count} × ` : ''}
                {volts1(led.vf)}) ÷ {milliamps} mA = {formatSI(design.ideal!, 'Ω')}
              </p>
              <dl className="ledcalc__facts">
                <div>
                  <dt>Valor comercial (série E12)</dt>
                  <dd className="num ledcalc__big">{formatSI(design.chosen!, 'Ω')}</dd>
                </div>
                <div>
                  <dt>Corrente com esse resistor</dt>
                  <dd className="num ledcalc__big">{formatSI(design.current, 'A')}</dd>
                </div>
                <div>
                  <dt>Tensão em cada LED</dt>
                  <dd className="num">{formatSI(design.ledVoltage, 'V')}</dd>
                </div>
                <div>
                  <dt>Potência no resistor</dt>
                  <dd className="num">
                    {formatSI(design.power, 'W')}: use {ratingLabel(design.rating)}
                  </dd>
                </div>
              </dl>
            </>
          )}

          <p className="lw__note">
            O valor comercial é o primeiro da série E12 acima do calculado, para a corrente ficar um
            pouco abaixo da desejada. A corrente real usa o mesmo modelo de LED das simulações. A
            potência sugerida é a primeira que aguenta o dobro da dissipada.
          </p>
        </div>
      </div>
    </section>
  );
}
