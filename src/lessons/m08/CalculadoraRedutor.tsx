/*
 * Lesson 8.6: a calculator for a motor, a reducer and, optionally, a pinion
 * on a rack. It shows what happens to speed, torque and power on the way
 * through, with presets for the gate of module 16, an industrial reducer
 * and a power window. Logic in reducao.ts.
 */
import { useId, useState } from 'react';
import { formatNumber } from '../m00/formato';
import { CV, PRESETS, selfLocking, solveDrive, type Drive } from './reducao';
import '../m00/widget.css';
import './reducao.css';

const g = 9.81;

export default function CalculadoraRedutor() {
  const id = useId();
  const [preset, setPreset] = useState<string>('portao');
  const [drive, setDrive] = useState<Drive>(PRESETS[0]!.drive);
  const r = solveDrive(drive);

  const choose = (pid: string) => {
    setPreset(pid);
    setDrive(PRESETS.find((p) => p.id === pid)!.drive);
  };
  const set = (patch: Partial<Drive>) => {
    setPreset('');
    setDrive((d) => ({ ...d, ...patch }));
  };
  /** Number input handler that ignores empty or invalid text. */
  const num =
    (key: keyof Drive, scale = 1, min = 0) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value.replace(',', '.'));
      if (Number.isFinite(v) && v >= min) set({ [key]: v * scale });
    };

  const valid = drive.power > 0 && drive.rpm > 0 && drive.ratio >= 1 && drive.efficiency > 0;

  return (
    <section className="lw redutor" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Calcule</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Motor, redutor e pinhão
        </h3>
        <p className="lw__lead">
          Escolha um exemplo ou digite os seus números. A potência é a do eixo do motor, a da placa.
        </p>
      </header>

      <div className="lw__body redutor__body">
        <div className="lw__controls">
          <fieldset className="lw__group">
            <legend className="lw__legend">Exemplo</legend>
            <div className="lw__choices lw__choices--stack">
              {PRESETS.map((p) => (
                <label key={p.id} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-ex`}
                    checked={preset === p.id}
                    onChange={() => choose(p.id)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="redutor__fields">
            <label className="lw__field">
              <span>Potência do motor (W)</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                value={Math.round(drive.power * 10) / 10}
                onChange={num('power', 1, 1)}
              />
            </label>
            <label className="lw__field">
              <span>Rotação do motor (rpm)</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step={10}
                value={drive.rpm}
                onChange={num('rpm', 1, 1)}
              />
            </label>
            <label className="lw__field">
              <span>Redução (1 : N)</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                value={drive.ratio}
                onChange={num('ratio', 1, 1)}
              />
            </label>
            <label className="lw__field">
              <span>Rendimento (%)</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={100}
                step={5}
                value={Math.round(drive.efficiency * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0 && v <= 100) set({ efficiency: v / 100 });
                }}
              />
            </label>
            <label className="lw__field">
              <span>Raio do pinhão (cm)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={Math.round(drive.pinion * 1000) / 10}
                onChange={num('pinion', 0.01)}
              />
            </label>
          </div>
        </div>

        <div className="lw__output redutor__out" aria-live="polite">
          {valid ? (
            <>
              <dl className="redutor__grid">
                <div>
                  <dt className="lw__value-label">No eixo do motor</dt>
                  <dd className="redutor__val">
                    {formatNumber(r.motorTorque, 2)} N·m a {formatNumber(drive.rpm, 0)} rpm
                  </dd>
                  <dd className="lw__note">
                    {formatNumber(drive.power, 0)} W, ou {formatNumber(drive.power / CV, 2)} CV
                  </dd>
                </div>
                <div>
                  <dt className="lw__value-label">Na saída do redutor</dt>
                  <dd className="redutor__val" data-saida>
                    {formatNumber(r.outTorque, 1)} N·m a {formatNumber(r.outRpm, 1)} rpm
                  </dd>
                  <dd className="lw__note">
                    {formatNumber(r.outPower, 0)} W; {formatNumber(r.loss, 0)} W viram calor no
                    redutor
                  </dd>
                </div>
                {r.speed !== undefined && r.force !== undefined && (
                  <div>
                    <dt className="lw__value-label">Na cremalheira</dt>
                    <dd className="redutor__val" data-cremalheira>
                      {formatNumber(r.force, 0)} N a {formatNumber(r.speed * 60, 1)} m/min
                    </dd>
                    <dd className="lw__note">
                      A força de um peso de {formatNumber(r.force / g, 0)} kg;{' '}
                      {formatNumber(r.speed, 3)} m/s
                    </dd>
                  </div>
                )}
              </dl>
              <p className="lw__note">
                A rotação caiu {formatNumber(drive.ratio, 1)} vezes, e o torque subiu{' '}
                {formatNumber(drive.ratio * drive.efficiency, 1)} vezes (a redução vezes o
                rendimento).
                {selfLocking(drive.efficiency)
                  ? ' Com rendimento abaixo de 50 %, um redutor de coroa e sem-fim costuma ser irreversível: a carga não consegue girar o motor de volta.'
                  : ''}
              </p>
            </>
          ) : (
            <p className="lw__note">
              Preencha potência, rotação, redução e rendimento maiores que zero.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
