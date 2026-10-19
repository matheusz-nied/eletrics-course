/*
 * Lesson 7.4 (fios e cabos): sizes a branch circuit of a house. Current,
 * section by capacity and by the minimum of the NBR 5410, breaker with
 * I_B ≤ I_n ≤ I_Z, voltage drop and a section that grows when the drop passes
 * 4 %. The logic is in circuito.ts.
 */
import { useId, useState } from 'react';
import { formatNumber } from '../m00/formato';
import { CAPACITY, MAX_DROP, sizeCircuit, type CircuitKind } from './circuito';
import '../m00/widget.css';
import './calculadora-circuito.css';

const KINDS: { value: CircuitKind; label: string }[] = [
  { value: 'iluminacao', label: 'Iluminação' },
  { value: 'tomadas', label: 'Tomadas de uso geral' },
  { value: 'especifico', label: 'Uso específico (chuveiro, forno)' },
];

const PRESETS: { label: string; watts: number; kind: CircuitKind }[] = [
  { label: 'Chuveiro 7.500 W', watts: 7500, kind: 'especifico' },
  { label: 'Chuveiro 5.500 W', watts: 5500, kind: 'especifico' },
  { label: 'Tomadas da cozinha 2.200 W', watts: 2200, kind: 'tomadas' },
  { label: 'Luzes da casa 600 W', watts: 600, kind: 'iluminacao' },
];

const MIN_WATTS = 50;
const MAX_WATTS = 20_000;

const mm2 = (s: number) => `${formatNumber(s, 1)} mm²`;
const amps = (i: number) => `${formatNumber(i, 1)} A`;
const pct = (f: number) => `${formatNumber(f * 100, 2)} %`;

export default function CalculadoraCircuito() {
  const id = useId();
  const [wattsText, setWattsText] = useState('7500');
  const [volts, setVolts] = useState<127 | 220>(220);
  const [meters, setMeters] = useState(15);
  const [kind, setKind] = useState<CircuitKind>('especifico');
  const [loaded, setLoaded] = useState<2 | 3>(2);

  const parsed = Number(wattsText.replace(/\./g, '').replace(',', '.'));
  const validWatts = Number.isFinite(parsed) && parsed >= MIN_WATTS && parsed <= MAX_WATTS;
  const watts = validWatts ? parsed : null;
  const voltage = loaded === 3 ? 220 : volts;

  const r = watts === null ? null : sizeCircuit({ watts, volts: voltage, meters, kind, loaded });

  const choose = (preset: (typeof PRESETS)[number]) => {
    setWattsText(String(preset.watts));
    setKind(preset.kind);
  };

  return (
    <section className="lw calc-circuito" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Calcule</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Dimensione um circuito
        </h3>
        <p className="lw__lead">
          Fios de cobre com isolação de PVC em eletroduto embutido na parede (método B1 da NBR 5410,
          30 °C), sem os fatores de correção de um projeto real. Carga resistiva, como chuveiro,
          forno ou aquecedor.
        </p>
      </header>

      <div className="lw__body">
        <div className="calc-circuito__presets" role="group" aria-label="Exemplos prontos">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="lw__btn" onClick={() => choose(p)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="lw__controls lw__controls--cols">
          <div className="lw__controls">
            <label className="lw__field">
              <span>Potência da carga (W)</span>
              <input
                type="text"
                inputMode="numeric"
                value={wattsText}
                aria-invalid={!validWatts}
                aria-describedby={`${id}-watts-help`}
                onChange={(e) => setWattsText(e.target.value)}
              />
              <span id={`${id}-watts-help`} className="lw__note">
                {validWatts
                  ? 'A potência da etiqueta do aparelho, ou a soma do circuito.'
                  : `Digite um valor entre ${formatNumber(MIN_WATTS)} e ${formatNumber(MAX_WATTS)} W.`}
              </span>
            </label>

            <label className="lw__range">
              <span className="lw__range-head">
                <span>Comprimento do quadro até a carga</span>
                <strong className="num">{formatNumber(meters)} m</strong>
              </span>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={meters}
                aria-valuetext={`${formatNumber(meters)} metros`}
                onChange={(e) => setMeters(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="lw__controls">
            <fieldset className="lw__group">
              <legend className="lw__legend">Tensão do circuito</legend>
              <div className="lw__choices">
                {([127, 220] as const).map((v) => (
                  <label key={v} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-tensao`}
                      checked={voltage === v}
                      disabled={loaded === 3 && v === 127}
                      onChange={() => setVolts(v)}
                    />
                    {v} V
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="lw__group">
              <legend className="lw__legend">Condutores carregados</legend>
              <div className="lw__choices">
                <label className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-carregados`}
                    checked={loaded === 2}
                    onChange={() => setLoaded(2)}
                  />
                  2 (fase e neutro, ou duas fases)
                </label>
                <label className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-carregados`}
                    checked={loaded === 3}
                    onChange={() => setLoaded(3)}
                  />
                  3 (circuito trifásico, 220 V entre fases)
                </label>
              </div>
            </fieldset>
          </div>
        </div>

        <fieldset className="lw__group">
          <legend className="lw__legend">Tipo de circuito</legend>
          <div className="lw__choices">
            {KINDS.map((k) => (
              <label key={k.value} className="lw__choice">
                <input
                  type="radio"
                  name={`${id}-tipo`}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="lw__output" aria-live="polite">
          {r === null ? (
            <p className="lw__note">Digite a potência para ver o resultado.</p>
          ) : (
            <>
              <div>
                <p className="lw__value-label">
                  Corrente de projeto (I<sub>B</sub>)
                </p>
                <p className="lw__value" data-result="corrente">
                  {amps(r.current)}
                </p>
              </div>
              <p className="lw__formula">
                {loaded === 2
                  ? `I = P ÷ V = ${formatNumber(watts!)} W ÷ ${voltage} V`
                  : `I = P ÷ (√3 × V) = ${formatNumber(watts!)} W ÷ (1,73 × ${voltage} V)`}
              </p>

              <dl className="calc-circuito__facts">
                <div>
                  <dt>Menor seção que aguenta a corrente</dt>
                  <dd className="num" data-result="capacidade">
                    {r.byCapacity === null
                      ? 'acima de 16 mm²'
                      : `${mm2(r.byCapacity)} (${amps(
                          CAPACITY.find((c) => c.section === r.byCapacity)![
                            loaded === 2 ? 'two' : 'three'
                          ],
                        )})`}
                  </dd>
                </div>
                <div>
                  <dt>Seção mínima para esse tipo de circuito</dt>
                  <dd className="num">{mm2(r.minimum)}</dd>
                </div>
                <div>
                  <dt>
                    Disjuntor sugerido (I<sub>n</sub>)
                  </dt>
                  <dd className="num" data-result="disjuntor">
                    {r.breaker === null ? 'acima de 63 A' : `${r.breaker} A`}
                  </dd>
                </div>
                <div>
                  <dt>Queda de tensão</dt>
                  <dd className="num" data-result="queda">
                    {formatNumber(r.drop.volts, 2)} V ({pct(r.drop.fraction)})
                  </dd>
                </div>
              </dl>

              <Verdict r={r} />

              <p className="lw__note">
                A queda usa os dois fios do circuito (ida e volta) e o cobre a 20 °C: ΔV = 2 × ρ × L
                × I ÷ S{loaded === 3 ? ', ou √3 × ρ × L × I ÷ S no trifásico' : ''}. Projeto de
                verdade também aplica fatores de correção para circuitos agrupados e temperatura
                alta, que reduzem a capacidade dos fios.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Verdict({ r }: { r: NonNullable<ReturnType<typeof sizeCircuit>> }) {
  if (r.outOfRange || r.section === null) {
    return (
      <div className="lw__status lw__status--danger" data-result="veredito">
        <span className="lw__status-dot" aria-hidden="true" />
        <p>
          {r.breaker === null
            ? 'A corrente passa do que esta calculadora cobre (disjuntor de 63 A e fio de 16 mm²).'
            : 'Nem o fio de 16 mm² mantém a queda de tensão dentro de 4 %.'}{' '}
          Um circuito assim pede projeto de um eletricista ou engenheiro, e talvez outra tensão.
        </p>
      </div>
    );
  }
  const before = r.dropBeforeGrowing!;
  return (
    <div
      className={`lw__status ${r.grewForDrop ? 'lw__status--warn' : 'lw__status--ok'}`}
      data-result="veredito"
    >
      <span className="lw__status-dot" aria-hidden="true" />
      <p>
        <strong>
          Use fio de {mm2(r.section)} com disjuntor de {r.breaker} A.
        </strong>{' '}
        {r.grewForDrop
          ? `Com ${mm2(r.byProtection!)} a queda seria de ${pct(before.fraction)}, acima dos ${pct(MAX_DROP)} da NBR 5410 para circuitos terminais; a seção subiu até a queda ficar dentro do limite.`
          : `A corrente cabe no disjuntor (${amps(r.current)} ≤ ${r.breaker} A), o disjuntor protege o fio (${r.breaker} A ≤ ${amps(r.capacity!)}) e a queda fica dentro dos ${pct(MAX_DROP)}.`}
      </p>
    </div>
  );
}
