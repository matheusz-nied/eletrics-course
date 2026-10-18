/**
 * Exercise of lesson 16.2: three loose wires of a gate motor and a
 * multimeter on the resistance scale. The student measures the three pairs
 * and finds the common wire (the pair with the largest reading is the two
 * windings in series; the wire left out is the common).
 */
import { useId, useState } from 'react';
import { windingMotor, type WindingMotor } from './winding-motor';
import './medir-fios.css';

type Probe = number | null;

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export interface MedirFiosProps {
  /** Starts with a 220 V motor instead of 127 V. */
  tensao?: 127 | 220;
}

export default function MedirFios({ tensao = 127 }: MedirFiosProps) {
  const [seed, setSeed] = useState(1);
  const [voltage, setVoltage] = useState<127 | 220>(tensao);
  const motor = windingMotor(seed, voltage);
  const [red, setRed] = useState<Probe>(null);
  const [black, setBlack] = useState<Probe>(null);
  const [log, setLog] = useState<{ pair: string; text: string }[]>([]);
  const [guess, setGuess] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const uid = useId();

  const reading = readingFor(motor, red, black);

  const place = (which: 'red' | 'black', wire: Probe) => {
    const r = which === 'red' ? wire : red;
    const b = which === 'black' ? wire : black;
    if (which === 'red') setRed(wire);
    else setBlack(wire);
    if (r !== null && b !== null && r !== b) {
      const pair = [r, b]
        .sort()
        .map((i) => `fio ${i + 1}`)
        .join(' e ');
      const text = readingFor(motor, r, b).text;
      setLog((old) => [{ pair, text }, ...old.filter((l) => l.pair !== pair)]);
    }
  };

  const another = (v: 127 | 220 = voltage) => {
    setSeed((s) => s + 1);
    setVoltage(v);
    setRed(null);
    setBlack(null);
    setLog([]);
    setGuess(null);
    setChecked(false);
  };

  const right = guess === motor.common;

  return (
    <div className="mf breakout" data-medir-fios="">
      <p className="mf-title">Exercício: descubra o fio comum de um motor de {voltage} V</p>
      <p className="mf-text">
        O motor está desligado e com os três fios soltos. O multímetro está na escala de resistência
        (Ω). Escolha onde encostar cada ponta.
      </p>

      <ul className="mf-wires" aria-label="Fios do motor">
        {motor.colors.map((c, i) => (
          <li key={i} className="mf-wire">
            <span className="mf-swatch" style={{ background: c.css }} aria-hidden="true" />
            Fio {i + 1} ({c.name})
          </li>
        ))}
      </ul>

      <div className="mf-probes">
        <ProbePicker
          legend="Ponta vermelha"
          name={`${uid}-red`}
          value={red}
          colors={motor.colors.map((c) => c.name)}
          onChange={(w) => place('red', w)}
        />
        <ProbePicker
          legend="Ponta preta"
          name={`${uid}-black`}
          value={black}
          colors={motor.colors.map((c) => c.name)}
          onChange={(w) => place('black', w)}
        />
        <div className="mf-meter" aria-live="polite">
          <span className="mf-meter__label">Visor do multímetro</span>
          <span className="mf-meter__value num">{reading.text}</span>
        </div>
      </div>

      {log.length > 0 && (
        <div className="mf-log">
          <p className="mf-log__title">Suas medições</p>
          <ul>
            {log.map((l) => (
              <li key={l.pair}>
                Entre {l.pair}: <strong className="num">{l.text}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="mf-guess">
        <legend>Qual fio é o comum?</legend>
        {motor.colors.map((c, i) => (
          <label key={i}>
            <input
              type="radio"
              name={`${uid}-guess`}
              checked={guess === i}
              onChange={() => {
                setGuess(i);
                setChecked(false);
              }}
            />
            Fio {i + 1} ({c.name})
          </label>
        ))}
        <button type="button" disabled={guess === null} onClick={() => setChecked(true)}>
          Verificar
        </button>
      </fieldset>

      {checked && guess !== null && (
        <p className={`mf-feedback ${right ? 'is-right' : 'is-wrong'}`} role="status">
          {right
            ? `Certo: o fio ${motor.common + 1} é o comum. A maior leitura (${nf.format(motor.full)} Ω) é entre os outros dois, que são as pontas dos dois enrolamentos em série; com o comum, cada leitura dá mais ou menos a metade.`
            : log.length < 3
              ? 'Ainda não. Meça os três pares antes de decidir: o comum é o fio que fica de fora do par com a maior leitura.'
              : `Não é esse. Procure o par com a maior leitura: ele liga as duas pontas dos enrolamentos. O fio que não está nesse par é o comum.`}
        </p>
      )}

      <div className="mf-actions">
        <button type="button" onClick={() => another()}>
          Outro motor
        </button>
        <button type="button" onClick={() => another(voltage === 127 ? 220 : 127)}>
          Motor de {voltage === 127 ? 220 : 127} V
        </button>
      </div>
    </div>
  );
}

function ProbePicker({
  legend,
  name,
  value,
  colors,
  onChange,
}: {
  legend: string;
  name: string;
  value: Probe;
  colors: string[];
  onChange: (wire: Probe) => void;
}) {
  return (
    <fieldset className="mf-probe">
      <legend>{legend}</legend>
      <label>
        <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} />
        Solta
      </label>
      {colors.map((c, i) => (
        <label key={i}>
          <input type="radio" name={name} checked={value === i} onChange={() => onChange(i)} />
          Fio {i + 1} ({c})
        </label>
      ))}
    </fieldset>
  );
}

function readingFor(motor: WindingMotor, red: Probe, black: Probe): { text: string } {
  if (red === null || black === null) return { text: 'OL' };
  if (red === black) return { text: `${nf.format(motor.leads)} Ω` };
  return { text: `${nf.format(motor.between(red, black))} Ω` };
}
