/*
 * Lesson 1.4 (Ohm's law), "A extensão que esquenta": how much of the power
 * turns into heat along an extension cord, for each wire gauge. The cord's two
 * conductors are in series with the appliance (see extensao.ts).
 */
import { useId, useState } from 'react';
import { formatNumber, formatSI } from '../m00/formato';
import { cord, GAUGES, MAINS } from './extensao';
import '../m00/widget.css';
import './calculadora-extensao.css';

const gaugeLabel = (mm2: number) => `${formatNumber(mm2)} mm²`;

export default function CalculadoraExtensao() {
  const id = useId();
  const [gauge, setGauge] = useState(0.75);
  const [meters, setMeters] = useState(20);
  const [watts, setWatts] = useState(1270);

  const result = cord(gauge, meters, watts);
  const all = GAUGES.map((g) => ({ gauge: g, heat: cord(g, meters, watts).heat }));
  const maxHeat = Math.max(...all.map((r) => r.heat));

  return (
    <section className="lw calc-extensao" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Calcule</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Quanto esquenta a sua extensão
        </h3>
        <p className="lw__lead">
          Um aparelho resistivo (aquecedor, ferro de passar) numa tomada de 127 V, ligado por uma
          extensão de cobre. Os dois fios da extensão entram no cálculo: a corrente vai por um e
          volta pelo outro.
        </p>
      </header>

      <div className="lw__body">
        <div className="lw__controls lw__controls--cols">
          <fieldset className="lw__group">
            <legend className="lw__legend">Bitola da extensão</legend>
            <div className="lw__choices">
              {GAUGES.map((g) => (
                <label key={g} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-bitola`}
                    checked={g === gauge}
                    onChange={() => setGauge(g)}
                  />
                  {gaugeLabel(g)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="lw__controls">
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Comprimento da extensão</span>
                <strong className="num">{formatNumber(meters)} m</strong>
              </span>
              <input
                type="range"
                min={2}
                max={50}
                step={1}
                value={meters}
                aria-valuetext={`${formatNumber(meters)} metros`}
                onChange={(e) => setMeters(Number(e.target.value))}
              />
            </label>
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Potência do aparelho</span>
                <strong className="num">{formatNumber(watts)} W</strong>
              </span>
              <input
                type="range"
                min={100}
                max={2500}
                step={10}
                value={watts}
                aria-valuetext={`${formatNumber(watts)} watts`}
                onChange={(e) => setWatts(Number(e.target.value))}
              />
            </label>
          </div>
        </div>

        <div className="lw__output" aria-live="polite">
          <div>
            <p className="lw__value-label">Calor produzido nos fios da extensão</p>
            <p className="lw__value">{formatSI(result.heat, 'W')}</p>
          </div>
          <p className="lw__formula">
            R dos fios = 1,72×10⁻⁸ Ω·m × {formatNumber(2 * meters)} m ÷ {gaugeLabel(gauge)} ={' '}
            {formatSI(result.wires, 'Ω')}
          </p>
          <dl className="calc-extensao__facts">
            <div>
              <dt>Corrente</dt>
              <dd className="num">{formatSI(result.current, 'A')}</dd>
            </div>
            <div>
              <dt>Tensão perdida nos fios</dt>
              <dd className="num">{formatSI(result.drop, 'V')}</dd>
            </div>
            <div>
              <dt>Tensão que chega ao aparelho</dt>
              <dd className="num">
                {formatSI(result.appliance, 'V')} de {formatSI(MAINS, 'V')}
              </dd>
            </div>
            <div>
              <dt>Calor por metro de extensão</dt>
              <dd className="num">{formatSI(result.heat / meters, 'W')}</dd>
            </div>
          </dl>

          <div>
            <p className="lw__value-label">A mesma extensão em outras bitolas</p>
            <ul className="calc-extensao__bars">
              {all.map((r) => (
                <li
                  key={r.gauge}
                  className={
                    r.gauge === gauge ? 'calc-extensao__bar is-current' : 'calc-extensao__bar'
                  }
                >
                  <span className="calc-extensao__bar-label num">{gaugeLabel(r.gauge)}</span>
                  <span className="calc-extensao__bar-track" aria-hidden="true">
                    <span
                      className="calc-extensao__bar-fill"
                      style={{ width: `${(r.heat / maxHeat) * 100}%` }}
                    />
                  </span>
                  <span className="calc-extensao__bar-value num">{formatSI(r.heat, 'W')}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="lw__note">
            Cobre a 20 °C. Fio quente tem resistência um pouco maior, e o calor aumenta mais um
            pouco. Esse calor se espalha ao longo do fio; com a extensão enrolada no carretel, ele
            não tem por onde sair.
          </p>
        </div>
      </div>
    </section>
  );
}
