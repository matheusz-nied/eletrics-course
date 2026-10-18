/*
 * Lesson 1.5 (power and energy): "Quanto custa?". The student picks an
 * appliance (typical values) or types power, time of use, days and the tariff
 * of their own bill, and sees E = P × t in kWh per month and the cost.
 */
import { useId, useState } from 'react';
import { parsePlain } from '../../course/quiz/grade';
import { formatMoney, formatNumber } from '../m00/formato';
import { APPLIANCES, EXAMPLE_TARIFF, monthlyUse } from './energia';
import '../m00/widget.css';
import './custo-energia.css';

/** Monthly energy of the 9 W LED bulb, 6 h a day: the unit of comparison. */
const LED_MONTH_KWH = 1.62;

const parse = (text: string) => {
  const value = parsePlain(text.trim());
  return value !== undefined && value >= 0 ? value : undefined;
};

export default function CustoEnergia() {
  const id = useId();
  const first = APPLIANCES[0]!;
  const [preset, setPreset] = useState(first.id);
  const [watts, setWatts] = useState(formatNumber(first.watts, 0));
  const [amount, setAmount] = useState(formatNumber(first.amount));
  const [unit, setUnit] = useState<'min' | 'h'>(first.unit);
  const [days, setDays] = useState('30');
  const [tariff, setTariff] = useState(EXAMPLE_TARIFF.toFixed(2).replace('.', ','));

  const choose = (applianceId: string) => {
    const a = APPLIANCES.find((x) => x.id === applianceId);
    if (!a) return;
    setPreset(a.id);
    setWatts(formatNumber(a.watts, 0));
    setAmount(formatNumber(a.amount));
    setUnit(a.unit);
  };

  const p = parse(watts);
  const t = parse(amount);
  const d = parse(days);
  const r = parse(tariff);
  const ok = p !== undefined && t !== undefined && d !== undefined && r !== undefined;
  const use = ok ? monthlyUse(p, t, unit, d, r) : undefined;
  const hoursOk = !use || use.hoursPerDay <= 24;

  return (
    <section className="lw custo-en" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Quanto custa por mês?
        </h3>
        <p className="lw__lead">
          Escolha um aparelho para começar com valores típicos e ajuste tudo para a sua casa. Use a
          tarifa da sua conta de luz.
        </p>
      </header>

      <div className="lw__body">
        <fieldset className="lw__group">
          <legend className="lw__legend">Aparelho</legend>
          <div className="lw__choices">
            {APPLIANCES.map((a) => (
              <label key={a.id} className="lw__choice">
                <input
                  type="radio"
                  name={`${id}-aparelho`}
                  checked={preset === a.id}
                  onChange={() => choose(a.id)}
                />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="custo-en__fields">
          <label className="lw__field">
            <span>Potência (W)</span>
            <input
              inputMode="decimal"
              value={watts}
              onChange={(e) => setWatts(e.target.value)}
              aria-invalid={p === undefined}
            />
          </label>
          <div className="lw__field">
            <span id={`${id}-tempo`}>Tempo de uso por dia</span>
            <div className="custo-en__pair">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-labelledby={`${id}-tempo`}
                aria-invalid={t === undefined || !hoursOk}
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value === 'h' ? 'h' : 'min')}
                aria-label="Unidade do tempo"
              >
                <option value="min">minutos</option>
                <option value="h">horas</option>
              </select>
            </div>
          </div>
          <label className="lw__field">
            <span>Dias de uso no mês</span>
            <input
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-invalid={d === undefined}
            />
          </label>
          <label className="lw__field">
            <span>Tarifa (R$ por kWh)</span>
            <input
              inputMode="decimal"
              value={tariff}
              onChange={(e) => setTariff(e.target.value)}
              aria-invalid={r === undefined}
            />
          </label>
        </div>
        <p className="lw__note">
          A tarifa inicial de {formatMoney(EXAMPLE_TARIFF)} é só um exemplo. Para achar a sua,
          divida o valor total da conta pelo consumo do mês em kWh.
        </p>

        <div className="lw__output" aria-live="polite">
          {use && hoursOk ? (
            <>
              <div className="custo-en__values">
                <div>
                  <p className="lw__value-label">Energia no mês</p>
                  <p className="lw__value">{formatNumber(use.kWhPerMonth, 1)} kWh</p>
                </div>
                <div>
                  <p className="lw__value-label">Custo no mês</p>
                  <p className="lw__value">{formatMoney(use.cost)}</p>
                </div>
              </div>
              <p className="lw__formula">
                E = {formatNumber(p! / 1000, 3)} kW × {formatNumber(use.hoursPerDay, 3)} h ×{' '}
                {formatNumber(d!, 0)} dias = {formatNumber(use.kWhPerMonth, 2)} kWh
              </p>
              <p className="lw__formula">
                Custo = {formatNumber(use.kWhPerMonth, 2)} kWh × {formatMoney(r!)} ={' '}
                {formatMoney(use.cost)}
              </p>
              <p className="lw__note">
                Por dia: {formatNumber(use.kWhPerDay, 3)} kWh. É a energia de{' '}
                {formatNumber(use.kWhPerMonth / LED_MONTH_KWH, 1)}{' '}
                {use.kWhPerMonth / LED_MONTH_KWH >= 1.95 ? 'lâmpadas' : 'lâmpada'} LED de 9 W acesas
                6 horas por dia durante o mês.
              </p>
            </>
          ) : (
            <div className="lw__status lw__status--warn">
              <span className="lw__status-dot" aria-hidden="true" />
              <p>
                {hoursOk
                  ? 'Confira os campos: use só números, com vírgula para os decimais, como 0,90.'
                  : 'Um dia tem 24 horas: confira o tempo de uso.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
