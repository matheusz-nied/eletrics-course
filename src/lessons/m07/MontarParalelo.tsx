/*
 * Lesson 7.6 (interruptores): wire two three-way switches and a lamp by
 * choosing the conductor of each terminal, flip the switches, and test the
 * four positions. Logic in ./montar-paralelo.ts.
 */
import { useId, useState } from 'react';
import {
  CLASSIC,
  diagnose,
  EMPTY,
  emptyTerminals,
  evaluate,
  TERMINALS,
  WIRES,
  type Position,
  type Potential,
  type Terminal,
  type Wire,
  type Wiring,
} from './montar-paralelo';
import '../m00/widget.css';
import './montar-paralelo.css';

type Point = [number, number];

/** Where each terminal sits in the drawing (viewBox 0 0 360 210). */
const AT: Record<Terminal, Point> = {
  s1c: [40, 95],
  s11: [116, 62],
  s12: [116, 128],
  s21: [174, 62],
  s22: [174, 128],
  s2c: [250, 95],
  la: [316, 46],
  lb: [316, 144],
};

const NAME: Record<Terminal, string> = {
  s1c: 'C',
  s11: '1',
  s12: '2',
  s21: '1',
  s22: '2',
  s2c: 'C',
  la: 'A',
  lb: 'B',
};

/** Where the name of each terminal goes, relative to it. */
const NAME_AT: Record<Terminal, Point> = {
  s1c: [0, -14],
  s11: [0, -13],
  s12: [0, 20],
  s21: [0, -13],
  s22: [0, 20],
  s2c: [0, -14],
  la: [-16, 4],
  lb: [-16, 4],
};

/** Supply points: phase and neutral arrive from the panel. */
const SOURCE: Partial<Record<Wire, Point>> = { fase: [22, 192], neutro: [74, 192] };

const SHORT = Object.fromEntries(WIRES.map((w) => [w.id, w.short])) as Record<Wire, string>;

const POTENTIAL: Record<Potential, string> = {
  fase: 'com fase',
  neutro: 'no neutro',
  solto: 'sem ligação',
};

const GROUPS: { title: string; terminals: Terminal[] }[] = [
  { title: 'Interruptor 1 (pé da escada)', terminals: ['s1c', 's11', 's12'] },
  { title: 'Interruptor 2 (alto da escada)', terminals: ['s2c', 's21', 's22'] },
  { title: 'Lâmpada', terminals: ['la', 'lb'] },
];

/** Path through the points of one conductor, left to right. */
function wirePath(points: Point[]): string {
  return [...points]
    .sort((p, q) => p[0] - q[0] || p[1] - q[1])
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`)
    .join('');
}

export default function MontarParalelo() {
  const id = useId();
  const [wiring, setWiring] = useState<Wiring>(EMPTY);
  const [p1, setP1] = useState<Position>(1);
  const [p2, setP2] = useState<Position>(1);
  const [tested, setTested] = useState(false);

  const now = evaluate(wiring, p1, p2);
  const diagnosis = diagnose(wiring);
  const missing = emptyTerminals(wiring);

  const set = (t: Terminal, w: Wire) => setWiring((old) => ({ ...old, [t]: w }));

  const nets = WIRES.filter((w) => w.id !== 'nenhum').map((w) => {
    const points = TERMINALS.filter((t) => wiring[t.id] === w.id).map((t) => AT[t.id]);
    const source = SOURCE[w.id];
    if (source && points.length > 0) points.push(source);
    return { wire: w.id, points };
  });

  const blade1 = p1 === 1 ? 'M58 95L98 66' : 'M58 95L98 124';
  const blade2 = p2 === 1 ? 'M232 95L192 66' : 'M232 95L192 124';

  const liveText = now.short
    ? 'Curto-circuito entre fase e neutro: o disjuntor desarmaria.'
    : now.lit
      ? 'Lâmpada acesa.'
      : `Lâmpada apagada. Borne A ${POTENTIAL[now.lamp.a]}, borne B ${POTENTIAL[now.lamp.b]}.`;
  const summary = `Interruptor 1 com o comum no borne ${p1}, interruptor 2 com o comum no borne ${p2}. ${TERMINALS.map((t) => `${t.label}: ${WIRES.find((w) => w.id === wiring[t.id])!.label}`).join('. ')}. ${liveText}`;

  return (
    <section className="lw mp" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Monte e teste</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          A ligação do interruptor paralelo
        </h3>
        <p className="lw__lead">
          Escolha o fio de cada borne: a fase e o neutro chegam do quadro; o retorno e os dois
          viajantes você passa entre as caixas. Depois vire os interruptores e teste as quatro
          posições.
        </p>
      </header>

      <div className="lw__body">
        <svg className="mp__scene" viewBox="0 0 360 210" role="img" aria-label={summary}>
          {nets.map(
            (n) =>
              n.points.length > 1 && (
                <path
                  key={n.wire}
                  d={wirePath(n.points)}
                  className={`mp__wire mp__wire--${n.wire}`}
                />
              ),
          )}

          {/* Switch 1: common on the left, terminals 1 and 2 on the right. */}
          <rect x={50} y={44} width={56} height={102} rx={8} className="mp__box" />
          <path d="M40 95H58M116 62H98V66M116 128H98V124" className="mp__lead" />
          <circle cx={58} cy={95} r={3} className="mp__pivot" />
          <circle cx={98} cy={66} r={2.5} className="mp__contact" />
          <circle cx={98} cy={124} r={2.5} className="mp__contact" />
          <path d={blade1} className="mp__blade" />
          <text x={78} y={160} className="mp__caption">
            interruptor 1
          </text>

          {/* Switch 2, mirrored. */}
          <rect x={184} y={44} width={56} height={102} rx={8} className="mp__box" />
          <path d="M250 95H232M174 62H192V66M174 128H192V124" className="mp__lead" />
          <circle cx={232} cy={95} r={3} className="mp__pivot" />
          <circle cx={192} cy={66} r={2.5} className="mp__contact" />
          <circle cx={192} cy={124} r={2.5} className="mp__contact" />
          <path d={blade2} className="mp__blade" />
          <text x={212} y={160} className="mp__caption">
            interruptor 2
          </text>

          {/* Lamp between A and B. */}
          <path d="M316 46V75M316 115V144" className="mp__lead" />
          <circle
            cx={316}
            cy={95}
            r={20}
            className={now.lit ? 'mp__lamp is-on' : 'mp__lamp'}
            data-lit={now.lit ? 'sim' : 'nao'}
          />
          <path d="M304 101 L310 87 L316 101 L322 87 L328 101" className="mp__filament" />
          <text x={316} y={166} className="mp__caption">
            lâmpada
          </text>

          {Object.entries(SOURCE).map(([w, [x, y]]) => (
            <g key={w}>
              <rect
                x={x - 9}
                y={y - 9}
                width={18}
                height={18}
                rx={3}
                className={`mp__src mp__dot--${w}`}
              />
              <text x={x + 13} y={y + 4} className="mp__src-text">
                {w === 'fase' ? 'F' : 'N'}
              </text>
            </g>
          ))}
          <text x={110} y={196} className="mp__caption mp__caption--start">
            do quadro
          </text>

          {TERMINALS.map((t) => {
            const [x, y] = AT[t.id];
            const [dx, dy] = NAME_AT[t.id];
            const w = wiring[t.id];
            return (
              <g key={t.id}>
                <circle cx={x} cy={y} r={7} className={`mp__term mp__dot--${w}`} />
                <text x={x + dx} y={y + dy} className="mp__term-name">
                  {NAME[t.id]}
                  {w !== 'nenhum' ? `·${SHORT[w]}` : ''}
                </text>
              </g>
            );
          })}

          {now.short && (
            <g className="mp__short">
              <rect x={96} y={4} width={168} height={26} rx={6} />
              <text x={180} y={22}>
                CURTO: fase no neutro!
              </text>
            </g>
          )}
        </svg>

        <div className="mp__switches">
          <button type="button" className="lw__btn" onClick={() => setP1((p) => (p === 1 ? 2 : 1))}>
            Virar o interruptor 1 <span className="mp__pos num">C→{p1}</span>
          </button>
          <button type="button" className="lw__btn" onClick={() => setP2((p) => (p === 1 ? 2 : 1))}>
            Virar o interruptor 2 <span className="mp__pos num">C→{p2}</span>
          </button>
        </div>

        <div className="mp__groups">
          {GROUPS.map((g) => (
            <fieldset key={g.title} className="lw__group mp__group">
              <legend className="lw__legend">{g.title}</legend>
              {g.terminals.map((t) => {
                const label = TERMINALS.find((x) => x.id === t)!.label;
                return (
                  <label key={t} className="lw__field mp__field">
                    <span>
                      Borne <strong>{NAME[t]}</strong>
                    </span>
                    <select
                      aria-label={label}
                      value={wiring[t]}
                      onChange={(e) => set(t, e.target.value as Wire)}
                      className={`mp__select mp__select--${wiring[t]}`}
                    >
                      {WIRES.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        <div className="mp__actions">
          <button
            type="button"
            className="lw__btn lw__btn--primary"
            onClick={() => setTested(true)}
          >
            Testar as quatro posições
          </button>
          <button
            type="button"
            className="lw__btn"
            onClick={() => {
              setWiring(CLASSIC);
              setTested(false);
            }}
          >
            Mostrar a ligação clássica
          </button>
          <button
            type="button"
            className="lw__btn"
            onClick={() => {
              setWiring(EMPTY);
              setTested(false);
            }}
          >
            Limpar
          </button>
        </div>

        <div className="lw__output" aria-live="polite">
          <p className="mp__now" data-now={now.short ? 'curto' : now.lit ? 'acesa' : 'apagada'}>
            <strong>Agora:</strong> {liveText}
          </p>
          {tested && (
            <>
              <div
                className={`lw__status ${diagnosis.danger ? 'lw__status--danger' : diagnosis.verdict === 'correta' ? 'lw__status--ok' : 'lw__status--warn'}`}
                data-verdict={diagnosis.verdict}
              >
                <span className="lw__status-dot" aria-hidden="true" />
                <div className="mp__verdict">
                  <p>
                    <strong>{diagnosis.title}</strong>
                  </p>
                  <p>{diagnosis.message}</p>
                </div>
              </div>
              <table className="mp__table">
                <caption className="lw__value-label">As quatro posições</caption>
                <thead>
                  <tr>
                    <th scope="col">Interruptor 1</th>
                    <th scope="col">Interruptor 2</th>
                    <th scope="col">Lâmpada</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnosis.states.map((s) => (
                    <tr key={`${s.p1}-${s.p2}`}>
                      <td className="num">C→{s.p1}</td>
                      <td className="num">C→{s.p2}</td>
                      <td>
                        {s.state.short
                          ? 'curto-circuito'
                          : s.state.lit
                            ? 'acesa'
                            : s.state.lamp.a === 'fase' || s.state.lamp.b === 'fase'
                              ? 'apagada, mas com fase'
                              : 'apagada'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {missing > 0 && (
                <p className="lw__note">
                  {missing === 1 ? 'Um borne ficou' : `${missing} bornes ficaram`} sem fio. Numa
                  ligação de verdade, todo borne usado recebe um fio bem apertado.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
