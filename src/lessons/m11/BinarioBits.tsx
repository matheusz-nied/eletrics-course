/*
 * Lesson 11.1: eight bits, each a wire at 0 V or 5 V. The student flips them
 * and sees the number they make, with the weight of each position.
 */
import { useId, useState } from 'react';
import { bitsToNumber } from './limiar';
import '../m00/widget.css';
import './binario.css';

const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];

export default function BinarioBits() {
  const id = useId();
  const [bits, setBits] = useState<boolean[]>(() => WEIGHTS.map((w) => w === 4 || w === 1));
  const value = bitsToNumber(bits);
  const sum = WEIGHTS.filter((_, k) => bits[k]);

  return (
    <section className="lw binario" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Oito fios, um número
        </h3>
        <p className="lw__lead">
          Cada chave é um fio: em 5 V ele vale 1, em 0 V vale 0. Ligue e desligue os bits e veja o
          número que eles formam.
        </p>
      </header>

      <div className="lw__body">
        <fieldset className="binario__bits">
          <legend className="lw__legend">Bits, do mais significativo ao menos significativo</legend>
          {WEIGHTS.map((w, k) => (
            <label key={w} className="binario__bit">
              <input
                type="checkbox"
                checked={bits[k]}
                onChange={() => setBits((b) => b.map((x, i) => (i === k ? !x : x)))}
                aria-label={`Bit de peso ${w}`}
              />
              <span className="binario__led" aria-hidden="true" />
              <span className="binario__digit num">{bits[k] ? 1 : 0}</span>
              <span className="binario__volts">{bits[k] ? '5 V' : '0 V'}</span>
              <span className="binario__weight num">{w}</span>
            </label>
          ))}
        </fieldset>

        <div className="lw__output" aria-live="polite">
          <p className="lw__value-label">Valor em decimal</p>
          <p className="lw__value num">{value}</p>
          <p className="lw__formula">
            {sum.length === 0 ? 'Nenhum bit em 1: zero.' : `${sum.join(' + ')} = ${value}`}
          </p>
          <p className="lw__note">
            Com 8 bits (um byte) dá para escrever 2⁸ = 256 valores, de 0 a 255.
          </p>
        </div>
      </div>
    </section>
  );
}
