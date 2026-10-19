/*
 * Lesson 7.5 (tomadas e plugues): pick how an outlet was wired and see what a
 * common three-lamp outlet tester and a multimeter show, and what it means
 * for an appliance with a metal case. Logic in ./testador-tomada.ts.
 */
import { useId, useState } from 'react';
import {
  CASES,
  FEED_LABEL,
  getCase,
  lampLit,
  PAIRS,
  reading,
  readingText,
  type CaseId,
  type Feed,
  type Hole,
  type Pair,
} from './testador-tomada';
import '../m00/widget.css';
import './testador-tomada.css';

const HOLES: { id: Hole; x: number; y: number; name: string }[] = [
  { id: 'F', x: 52, y: 78, name: 'F' },
  { id: 'N', x: 128, y: 78, name: 'N' },
  { id: 'T', x: 90, y: 90, name: 'T' },
];

const PAIR_TEXT: Record<Pair, string> = {
  'F-N': 'F–N',
  'F-T': 'F–T',
  'N-T': 'N–T',
};

const SHORT: Record<Feed, string> = {
  fase: 'fase',
  fase2: 'outra fase',
  neutro: 'neutro',
  terra: 'terra',
  solto: 'solto',
};

const feedClass = (f: Feed) => `tt__feed tt__feed--${f}`;

export default function TestadorTomada() {
  const id = useId();
  const [caseId, setCaseId] = useState<CaseId>('correta');
  const c = getCase(caseId);
  const lit = PAIRS.map((p) => lampLit(c, p));
  const litText = PAIRS.filter((_, i) => lit[i])
    .map((p) => PAIR_TEXT[p])
    .join(', ');
  const summary = `Tomada com ${c.label.toLowerCase()}. Furo F com ${FEED_LABEL[c.feeds.F]}, furo N com ${FEED_LABEL[c.feeds.N]}, furo T com ${FEED_LABEL[c.feeds.T]}. Luzes acesas no testador: ${litText || 'nenhuma'}.`;

  return (
    <section className="lw tt" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O testador de tomada e o multímetro
        </h3>
        <p className="lw__lead">
          Escolha como a tomada foi ligada e compare as luzes do testador com as três medidas do
          multímetro. F é o furo onde o instalador quis a fase; N, o do neutro; T, o do terra.
        </p>
      </header>

      <div className="lw__body">
        <fieldset className="lw__group">
          <legend className="lw__legend">Como a tomada foi ligada</legend>
          <div className="lw__choices tt__choices">
            {CASES.map((k) => (
              <label key={k.id} className="lw__choice">
                <input
                  type="radio"
                  name={`${id}-ligacao`}
                  checked={k.id === caseId}
                  onChange={() => setCaseId(k.id)}
                />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>

        <svg className="tt__scene" viewBox="0 0 360 180" role="img" aria-label={summary}>
          {/* Outlet seen from the front: plate, recess and the three holes. */}
          <rect x={10} y={14} width={160} height={152} rx={16} className="tt__plate" />
          <path d="M50 40 H130 L156 84 L130 128 H50 L24 84 Z" className="tt__recess" />
          {HOLES.map((h) => (
            <g key={h.id}>
              <circle cx={h.x} cy={h.y} r={8} className={feedClass(c.feeds[h.id])} />
              <text x={h.x} y={h.id === 'T' ? h.y + 25 : h.y - 15} className="tt__hole-name">
                {h.name}
              </text>
            </g>
          ))}
          <text x={90} y={146} className="tt__caption">
            F: {SHORT[c.feeds.F]} · N: {SHORT[c.feeds.N]}
          </text>
          <text x={90} y={160} className="tt__caption">
            T: {SHORT[c.feeds.T]}
          </text>

          {/* The tester: one lamp per pair of holes. */}
          <rect x={196} y={30} width={150} height={120} rx={14} className="tt__tester" />
          <text x={271} y={52} className="tt__caption">
            testador de tomada
          </text>
          {PAIRS.map((p, i) => (
            <g key={p}>
              <circle
                cx={226 + i * 45}
                cy={90}
                r={13}
                className={lit[i] ? 'tt__lamp is-on' : 'tt__lamp'}
                data-lamp={p}
                data-lit={lit[i] ? 'sim' : 'nao'}
              />
              <text x={226 + i * 45} y={124} className="tt__lamp-name">
                {PAIR_TEXT[p]}
              </text>
            </g>
          ))}
        </svg>

        <div className="lw__output" aria-live="polite">
          <div className="tt__table-wrap">
            <table className="tt__table">
              <caption className="lw__value-label">Multímetro em V~</caption>
              <thead>
                <tr>
                  <th scope="col">Entre</th>
                  <th scope="col">Leitura</th>
                  <th scope="col">Luz do testador</th>
                </tr>
              </thead>
              <tbody>
                {PAIRS.map((p, i) => (
                  <tr key={p}>
                    <th scope="row">{PAIR_TEXT[p]}</th>
                    <td className="num" data-reading={p}>
                      {readingText(reading(c, p))}
                    </td>
                    <td>{lit[i] ? 'acesa' : 'apagada'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className={`lw__status ${c.danger ? 'lw__status--danger' : c.id === 'correta' ? 'lw__status--ok' : 'lw__status--warn'}`}
            data-verdict={c.id}
          >
            <span className="lw__status-dot" aria-hidden="true" />
            <div className="tt__verdict">
              <p>
                <strong>{c.danger ? 'Perigo. ' : ''}</strong>
                {c.verdict}
              </p>
              <p>
                <strong>Com um aparelho de carcaça metálica: </strong>
                {c.appliance}
              </p>
            </div>
          </div>
          <p className="lw__note">
            Modelo simplificado de uma instalação de 127/220 V. A ordem e as cores das luzes mudam
            de um testador para outro: leia a legenda impressa no seu. Um furo solto não acende nada
            (ou acende fraco), e o multímetro nele mostra um valor que não quer dizer nada.
          </p>
        </div>
      </div>
    </section>
  );
}
