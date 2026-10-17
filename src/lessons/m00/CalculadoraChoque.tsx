/*
 * Lesson 0.2 (safety): "Calculadora do choque". The student picks the touch
 * voltage, the hand and the way out of the body; the figure shows the current
 * (Ohm's law on the same resistances as choque.circuit.ts), where it falls on
 * a scale of typical effects, and whether a 30 mA RCD would trip.
 */
import { useId, useState } from 'react';
import { BODY, EXIT, HAND, RCD_TRIP, VOLTAGES, type Option } from './choque-dados';
import { formatSI } from './formato';
import './widget.css';
import './calculadora-choque.css';

/** Typical effect bands for 60 Hz, hand to feet, adult (IEC 60479 describes them in detail). */
const BANDS = [
  {
    upTo: 0.0005,
    tone: 'ok',
    name: 'Em geral não se sente',
    text: 'Abaixo de cerca de 0,5 mA a maioria das pessoas não percebe a corrente.',
  },
  {
    upTo: 0.01,
    tone: 'warn',
    name: 'Formigamento e dor',
    text: 'A pessoa sente formigamento, que vira dor conforme a corrente sobe. Em geral ainda consegue soltar o que está segurando.',
  },
  {
    upTo: 0.03,
    tone: 'danger',
    name: 'Músculos travam',
    text: 'Contrações fortes: a mão pode fechar no objeto e a pessoa não consegue soltar. Se o choque continua, respirar fica difícil.',
  },
  {
    upTo: Infinity,
    tone: 'danger',
    name: 'Perigo de morte',
    text: 'Se durar perto de um segundo ou mais, a respiração pode parar e o coração pode entrar em fibrilação ventricular: ele treme em vez de bater e o sangue para de circular.',
  },
] as const;

/** The scale goes from 0,1 mA to 1 A (four decades, logarithmic). */
const SCALE_MIN = 1e-4;
const SCALE_MAX = 1;
const position = (amps: number) =>
  Math.min(
    100,
    Math.max(0, (Math.log10(amps / SCALE_MIN) / Math.log10(SCALE_MAX / SCALE_MIN)) * 100),
  );

function Choices<T extends Option>({
  legend,
  name,
  options,
  value,
  onChange,
  stack = false,
}: {
  legend: string;
  name: string;
  options: T[];
  value: number;
  onChange: (value: number) => void;
  stack?: boolean;
}) {
  return (
    <fieldset className="lw__group">
      <legend className="lw__legend">{legend}</legend>
      <div className={stack ? 'lw__choices lw__choices--stack' : 'lw__choices'}>
        {options.map((option) => (
          <label key={option.value} className="lw__choice">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function CalculadoraChoque() {
  const id = useId();
  const [voltage, setVoltage] = useState(127);
  const [hand, setHand] = useState(HAND[0]!.value);
  const [exitIndex, setExitIndex] = useState(0);
  const [rcd, setRcd] = useState(false);

  const exit = EXIT[exitIndex]!;
  const total = hand + BODY + exit.value;
  const current = voltage / total;
  const band = BANDS.find((b) => current < b.upTo) ?? BANDS[BANDS.length - 1]!;

  let rcdTone: 'ok' | 'warn' | 'danger';
  let rcdText: string;
  if (!rcd) {
    rcdTone = 'danger';
    rcdText =
      'Sem DR, nada desliga o circuito. O disjuntor comum só desarma com correntes centenas de vezes maiores que a de um choque.';
  } else if (!exit.earth) {
    rcdTone = 'danger';
    rcdText =
      'O DR não percebe este choque: a corrente sai pela fase, passa pelo corpo e volta pelo neutro, como se a pessoa fosse um aparelho ligado. Nada escapa para a terra.';
  } else if (current >= RCD_TRIP) {
    rcdTone = 'ok';
    rcdText =
      'O DR desarma em uma fração de segundo. A pessoa leva o choque, mas o tempo curto reduz muito o risco de morte.';
  } else if (current >= RCD_TRIP / 2) {
    rcdTone = 'warn';
    rcdText =
      'O DR pode desarmar ou não: um DR de 30 mA não deve desarmar abaixo de 15 mA e precisa desarmar a partir de 30 mA.';
  } else {
    rcdTone = 'warn';
    rcdText =
      'O DR não desarma: a fuga está abaixo do limite dele. Ele não evita o choque pequeno; ele corta o choque grave.';
  }

  const exitOptions = EXIT.map((o, i) => ({ value: i, label: o.label }));

  return (
    <section className="lw choque" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Calculadora do choque
        </h3>
        <p className="lw__lead">
          Valores típicos de resistência, só para comparar situações. O corpo de cada pessoa é
          diferente: nunca use isto para decidir se um choque é seguro.
        </p>
      </header>

      <div className="lw__body">
        <div className="lw__controls lw__controls--cols">
          <Choices
            legend="Tensão de toque"
            name={`${id}-tensao`}
            options={VOLTAGES}
            value={voltage}
            onChange={setVoltage}
            stack
          />
          <Choices
            legend="Mão que encosta"
            name={`${id}-mao`}
            options={HAND}
            value={hand}
            onChange={setHand}
            stack
          />
          <Choices
            legend="Por onde a corrente sai"
            name={`${id}-saida`}
            options={exitOptions}
            value={exitIndex}
            onChange={setExitIndex}
            stack
          />
        </div>

        <label className="lw__check">
          <input type="checkbox" checked={rcd} onChange={(e) => setRcd(e.target.checked)} />O
          circuito tem DR de 30 mA
        </label>

        <div className="lw__output" aria-live="polite">
          <div>
            <p className="lw__value-label">Corrente pelo corpo</p>
            <p className="lw__value">{formatSI(current, 'A')}</p>
          </div>
          <p className="lw__formula">
            I = {formatSI(voltage, 'V')} ÷ ({formatSI(hand, 'Ω')} + {formatSI(BODY, 'Ω')} +{' '}
            {formatSI(exit.value, 'Ω')}) = {formatSI(current, 'A')}
          </p>

          <div className="choque__scale" aria-hidden="true">
            <div className="choque__bands">
              {BANDS.map((b, i) => {
                const from = position(i === 0 ? SCALE_MIN : BANDS[i - 1]!.upTo);
                const to = position(b.upTo);
                return (
                  <span
                    key={b.name}
                    className={`choque__band choque__band--${i}`}
                    style={{ left: `${from}%`, width: `${to - from}%` }}
                  />
                );
              })}
              <span className="choque__marker" style={{ left: `${position(current)}%` }} />
            </div>
            <div className="choque__ticks">
              {[
                [1e-4, '0,1 mA'],
                [1e-3, '1 mA'],
                [1e-2, '10 mA'],
                [1e-1, '100 mA'],
                [1, '1 A'],
              ].map(([value, label]) => (
                <span key={label} style={{ left: `${position(value as number)}%` }}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className={`lw__status lw__status--${band.tone}`}>
            <span className="lw__status-dot" aria-hidden="true" />
            <p>
              <strong>{band.name}.</strong> {band.text}
            </p>
          </div>
          <div className={`lw__status lw__status--${rcdTone}`}>
            <span className="lw__status-dot" aria-hidden="true" />
            <p>
              <strong>DR:</strong> {rcdText}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
