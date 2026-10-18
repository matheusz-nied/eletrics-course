/*
 * Lesson 1.6 (orders of magnitude): "Jogo das grandezas". Each round has four
 * real-world values of one quantity; the student puts them in order with the
 * up/down buttons (mouse, touch or keyboard) and checks the answer.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { decadesSpanned, isSorted, move, ROUNDS, solution } from './grandezas';
import '../m00/widget.css';
import './jogo-grandezas.css';

const initialOrder = (index: number) => ROUNDS[index]!.items.map((item) => item.id);

export default function JogoGrandezas() {
  const id = useId();
  const [index, setIndex] = useState(0);
  const [order, setOrder] = useState(() => initialOrder(0));
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<(boolean | undefined)[]>(() =>
    ROUNDS.map(() => undefined),
  );
  const [announce, setAnnounce] = useState('');
  const focus = useRef<{ item: string; dir: 'up' | 'down' } | null>(null);
  const list = useRef<HTMLOListElement>(null);

  const round = ROUNDS[index]!;
  const right = isSorted(round, order);
  const last = index === ROUNDS.length - 1;
  const byId = (itemId: string) => round.items.find((item) => item.id === itemId)!;

  useEffect(() => {
    const target = focus.current;
    if (!target || !list.current) return;
    focus.current = null;
    const button =
      list.current.querySelector<HTMLButtonElement>(
        `[data-item="${target.item}"][data-dir="${target.dir}"]:not(:disabled)`,
      ) ??
      list.current.querySelector<HTMLButtonElement>(`[data-item="${target.item}"]:not(:disabled)`);
    button?.focus();
  }, [order]);

  const shift = (position: number, delta: number) => {
    const itemId = order[position]!;
    const next = move(order, position, delta);
    focus.current = { item: itemId, dir: delta < 0 ? 'up' : 'down' };
    setOrder(next);
    setAnnounce(`${byId(itemId).label}: posição ${next.indexOf(itemId) + 1} de ${next.length}.`);
  };

  const check = () => {
    setChecked(true);
    setResults((r) => r.map((value, i) => (i === index && value === undefined ? right : value)));
  };

  const goTo = (next: number) => {
    setIndex(next);
    setOrder(initialOrder(next));
    setChecked(false);
    setAnnounce('');
  };

  const restart = () => {
    setResults(ROUNDS.map(() => undefined));
    goTo(0);
  };

  const firstTry = results.filter(Boolean).length;
  const done = results.every((r) => r !== undefined);
  const correct = solution(round);
  const decades = decadesSpanned(round);

  return (
    <section className="lw jogo-gr" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Jogo</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Jogo das grandezas
        </h3>
        <p className="lw__lead">
          Coloque os valores em ordem, do menor para o maior, usando as setas. Os valores são
          típicos ou aproximados.
        </p>
      </header>

      <div className="lw__body">
        <div className="jogo-gr__round">
          <p className="lw__value-label">
            Rodada {index + 1} de {ROUNDS.length} · {round.title}
          </p>
          <p className="jogo-gr__question">{round.question}</p>
        </div>

        <ol className="jogo-gr__list" ref={list}>
          {order.map((itemId, position) => {
            const item = byId(itemId);
            const ok = correct[position] === itemId;
            return (
              <li
                key={itemId}
                className={
                  checked ? `jogo-gr__item jogo-gr__item--${ok ? 'ok' : 'bad'}` : 'jogo-gr__item'
                }
              >
                <span className="jogo-gr__pos" aria-hidden="true">
                  {position + 1}
                </span>
                <span className="jogo-gr__text">
                  <span className="jogo-gr__label">{item.label}</span>
                  {checked && <span className="jogo-gr__value">{item.text}</span>}
                  {checked && (
                    <span className="lw__sr">{ok ? ', na posição certa' : ', fora do lugar'}</span>
                  )}
                </span>
                <span className="jogo-gr__moves">
                  <button
                    type="button"
                    className="lw__btn jogo-gr__move"
                    data-item={itemId}
                    data-dir="up"
                    aria-label={`Subir: ${item.label}`}
                    disabled={checked || position === 0}
                    onClick={() => shift(position, -1)}
                  >
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                      <path d="M3 10l5-5 5 5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="lw__btn jogo-gr__move"
                    data-item={itemId}
                    data-dir="down"
                    aria-label={`Descer: ${item.label}`}
                    disabled={checked || position === order.length - 1}
                    onClick={() => shift(position, 1)}
                  >
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                      <path d="M3 6l5 5 5-5" />
                    </svg>
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="lw__sr" aria-live="polite">
          {announce}
        </p>

        <div className="jogo-gr__actions">
          {!checked ? (
            <button type="button" className="lw__btn lw__btn--primary" onClick={check}>
              Conferir
            </button>
          ) : (
            <>
              {!right && (
                <button type="button" className="lw__btn" onClick={() => setChecked(false)}>
                  Tentar de novo
                </button>
              )}
              {last ? (
                <button type="button" className="lw__btn lw__btn--primary" onClick={restart}>
                  Jogar de novo
                </button>
              ) : (
                <button
                  type="button"
                  className="lw__btn lw__btn--primary"
                  onClick={() => goTo(index + 1)}
                >
                  Próxima rodada
                </button>
              )}
            </>
          )}
        </div>

        <div aria-live="polite">
          {checked && (
            <div className={`lw__status lw__status--${right ? 'ok' : 'warn'}`}>
              <span className="lw__status-dot" aria-hidden="true" />
              <p>
                {right ? (
                  <>
                    <strong>Na ordem certa.</strong> Entre o menor e o maior valor há cerca de{' '}
                    {decades} ordens de grandeza: o maior vale perto de 10<sup>{decades}</sup> vezes
                    o menor, um 1 seguido de {decades} zeros.
                  </>
                ) : (
                  <>
                    <strong>Ainda não.</strong> Os itens marcados estão fora do lugar. Compare os
                    valores, que agora aparecem, e tente de novo.
                  </>
                )}
              </p>
            </div>
          )}
          {checked && last && done && (
            <p className="lw__note jogo-gr__score">
              Você acertou {firstTry} de {ROUNDS.length} rodadas na primeira tentativa.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
