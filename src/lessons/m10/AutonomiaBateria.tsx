/*
 * Lesson 10.3: how long a backup battery lasts. Two cases: a gate controller
 * with a DC motor (standby current plus a few movements per hour) and a
 * nobreak feeding appliances through its inverter. The widget sets the
 * plain account of lesson 1.2 (capacity ÷ current) beside the estimate with
 * depth of discharge, Peukert and the inverter (autonomia.ts).
 */
import { useId, useState } from 'react';
import { NBSP, formatNumber, formatSI } from '../m00/formato';
import { BATTERIES, formatDuration, gateAutonomy, upsAutonomy } from './autonomia';
import '../m00/widget.css';
import './autonomia-bateria.css';

type Mode = 'portao' | 'nobreak';

const DEPTHS = [
  { value: 0.5, label: '50 % (vida longa)' },
  { value: 0.8, label: '80 % (máximo)' },
];

export default function AutonomiaBateria() {
  const id = useId();
  const [mode, setMode] = useState<Mode>('portao');
  const [batteryId, setBatteryId] = useState('7ah');
  const [depth, setDepth] = useState(0.5);
  const [standbyMa, setStandbyMa] = useState(60);
  const [motor, setMotor] = useState(5);
  const [seconds, setSeconds] = useState(15);
  const [perHour, setPerHour] = useState(4);
  const [watts, setWatts] = useState(120);
  const [eff, setEff] = useState(0.85);

  const battery = BATTERIES.find((b) => b.id === batteryId)!;
  const gate = gateAutonomy(battery, { standby: standbyMa / 1000, motor, seconds, perHour }, depth);
  const ups = upsAutonomy(battery, watts, eff, depth);
  const result = mode === 'portao' ? gate : ups;
  const perMovementAh = (motor * seconds) / 3600;
  const share = result.hours / result.naive;

  return (
    <section className="lw autonomia" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Quanto tempo a bateria segura?
        </h3>
        <p className="lw__lead">
          Escolha o caso, a bateria e a carga. Compare a conta simples, capacidade dividida pela
          corrente, com a estimativa que leva em conta as perdas reais.
        </p>
      </header>

      <div className="lw__body autonomia__body">
        <div className="lw__controls">
          <fieldset className="lw__group">
            <legend className="lw__legend">Caso</legend>
            <div className="lw__choices">
              {(
                [
                  ['portao', 'Portão com motor CC'],
                  ['nobreak', 'Nobreak na tomada'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-modo`}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="lw__field">
            <span>Bateria</span>
            <select value={batteryId} onChange={(e) => setBatteryId(e.target.value)}>
              {BATTERIES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="lw__group">
            <legend className="lw__legend">Descarregar até</legend>
            <div className="lw__choices">
              {DEPTHS.map((d) => (
                <label key={d.value} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-dod`}
                    checked={depth === d.value}
                    onChange={() => setDepth(d.value)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'portao' ? (
            <>
              <label className="lw__range">
                <span className="lw__range-head">
                  <span>Central em espera</span>
                  <strong className="num">{formatSI(standbyMa / 1000, 'A')}</strong>
                </span>
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={10}
                  value={standbyMa}
                  aria-valuetext={formatSI(standbyMa / 1000, 'A')}
                  onChange={(e) => setStandbyMa(Number(e.target.value))}
                />
              </label>
              <label className="lw__range">
                <span className="lw__range-head">
                  <span>Motor durante a manobra</span>
                  <strong className="num">{formatSI(motor, 'A')}</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={0.5}
                  value={motor}
                  aria-valuetext={formatSI(motor, 'A')}
                  onChange={(e) => setMotor(Number(e.target.value))}
                />
              </label>
              <label className="lw__range">
                <span className="lw__range-head">
                  <span>Duração de cada manobra</span>
                  <strong className="num">
                    {seconds}
                    {NBSP}s
                  </strong>
                </span>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={seconds}
                  aria-valuetext={`${seconds} segundos`}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                />
              </label>
              <label className="lw__range">
                <span className="lw__range-head">
                  <span>Manobras por hora</span>
                  <strong className="num">{perHour}</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={perHour}
                  aria-valuetext={`${perHour} manobras por hora`}
                  onChange={(e) => setPerHour(Number(e.target.value))}
                />
              </label>
            </>
          ) : (
            <>
              <label className="lw__range">
                <span className="lw__range-head">
                  <span>Aparelhos ligados</span>
                  <strong className="num">{formatSI(watts, 'W')}</strong>
                </span>
                <input
                  type="range"
                  min={10}
                  max={400}
                  step={10}
                  value={watts}
                  aria-valuetext={formatSI(watts, 'W')}
                  onChange={(e) => setWatts(Number(e.target.value))}
                />
              </label>
              <label className="lw__range">
                <span className="lw__range-head">
                  <span>Eficiência do inversor</span>
                  <strong className="num">{Math.round(eff * 100)} %</strong>
                </span>
                <input
                  type="range"
                  min={0.7}
                  max={0.95}
                  step={0.01}
                  value={eff}
                  aria-valuetext={`${Math.round(eff * 100)} por cento`}
                  onChange={(e) => setEff(Number(e.target.value))}
                />
              </label>
            </>
          )}
        </div>

        <div className="lw__output" aria-live="polite">
          <div className="autonomia__values">
            <div>
              <p className="lw__value-label">Estimativa com as perdas</p>
              <p className="lw__value autonomia__main">{formatDuration(result.hours)}</p>
            </div>
            <div>
              <p className="lw__value-label">Conta simples</p>
              <p className="lw__value autonomia__naive">{formatDuration(result.naive)}</p>
            </div>
          </div>
          <p className="lw__note">A estimativa dá {Math.round(share * 100)} % da conta simples.</p>
          {mode === 'portao' ? (
            <>
              <p className="lw__formula">
                Corrente média: {formatSI(result.average, 'A')}. Cada manobra gasta{' '}
                {formatSI(perMovementAh, 'Ah')}, o mesmo que{' '}
                {formatDuration(perMovementAh / (standbyMa / 1000))} de espera.
              </p>
              <p className="lw__note">
                Com {formatSI(motor, 'A')}, bem acima da corrente de 20 horas da bateria (
                {formatSI(battery.ah / 20, 'A')}), cada ampère do motor vale mais que um.
              </p>
            </>
          ) : (
            <>
              <p className="lw__formula">
                Corrente na bateria: {formatSI(watts, 'W')} ÷ ({battery.volts}
                {NBSP}V × {formatNumber(eff, 2)}) = {formatSI(ups.current, 'A')}
              </p>
              <p className="lw__note">
                A conta simples usa a energia do rótulo, {battery.volts}
                {NBSP}V × {battery.ah}
                {NBSP}Ah = {formatSI(battery.volts * battery.ah, 'Wh')}, toda entregue aos
                aparelhos. Na prática, o inversor perde uma parte, e a bateria entrega menos
                ampères-hora com correntes altas.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
