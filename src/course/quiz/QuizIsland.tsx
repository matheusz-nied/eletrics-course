/*
 * The interactive quiz (rendered by src/course/Quiz.astro, which validates the
 * questions and fixes the shuffled order so server and browser agree).
 * Each question is checked on its own, with feedback per alternative; when
 * all are answered the score is saved in the progress store.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { getProgress } from '../progress/store';
import {
  formatQuantity,
  gradeChoice,
  gradeMatch,
  gradeOrder,
  isClose,
  parseAnswer,
  type QuizQuestion,
} from './grade';

/** A question plus the order its options, items or right column are shown in. */
export type PreparedQuestion = QuizQuestion & { order: number[] };

export interface QuizIslandProps {
  questions: PreparedQuestion[];
  title: string;
  quizKey: string;
  /** Where the score is saved; without it the quiz works but saves nothing. */
  lessonId?: string | undefined;
}

type Answer =
  | { type: 'multipla'; selected: number[] }
  | { type: 'numerica'; text: string; value?: number | undefined }
  | { type: 'vf'; value?: boolean | undefined }
  | { type: 'ordenar'; order: number[] }
  | { type: 'associar'; choices: (number | undefined)[] };

interface QuestionState {
  answer: Answer;
  /** Set once checked: right or wrong. */
  correct?: boolean | undefined;
  error?: string | undefined;
}

function initial(q: PreparedQuestion): QuestionState {
  switch (q.type) {
    case 'multipla':
      return { answer: { type: 'multipla', selected: [] } };
    case 'numerica':
      return { answer: { type: 'numerica', text: '' } };
    case 'vf':
      return { answer: { type: 'vf' } };
    case 'ordenar':
      return { answer: { type: 'ordenar', order: q.order } };
    case 'associar':
      return { answer: { type: 'associar', choices: q.pairs.map(() => undefined) } };
  }
}

function isAnswered(state: QuestionState): boolean {
  const a = state.answer;
  switch (a.type) {
    case 'multipla':
      return a.selected.length > 0;
    case 'numerica':
      return a.text.trim() !== '';
    case 'vf':
      return a.value !== undefined;
    case 'ordenar':
      return true;
    case 'associar':
      return a.choices.every((c) => c !== undefined);
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function QuizIsland({ questions, title, quizKey, lessonId }: QuizIslandProps) {
  const uid = useId();
  const [states, setStates] = useState<QuestionState[]>(() => questions.map(initial));
  const [attempt, setAttempt] = useState(0);
  const [previous, setPrevious] = useState<{ acertos: number; total: number } | undefined>();

  useEffect(() => {
    if (!lessonId) return;
    const store = getProgress();
    const read = () => {
      const saved = store.lesson(lessonId).quizzes?.[quizKey];
      setPrevious(saved ? { acertos: saved.acertos, total: saved.total } : undefined);
    };
    read();
    return store.subscribe(read);
  }, [lessonId, quizKey]);

  const checked = states.filter((s) => s.correct !== undefined).length;
  const right = states.filter((s) => s.correct).length;
  const total = questions.length;
  const finished = checked === total;

  const update = (index: number, change: (s: QuestionState) => QuestionState) =>
    setStates((all) => all.map((s, i) => (i === index ? change(s) : s)));

  function check(index: number) {
    const q = questions[index];
    const state = states[index];
    if (!q || !state || state.correct !== undefined || !isAnswered(state)) return;
    const a = state.answer;
    let correct = false;
    let value: number | undefined;
    if (q.type === 'multipla' && a.type === 'multipla')
      correct = gradeChoice(q.options, a.selected);
    else if (q.type === 'vf' && a.type === 'vf') correct = a.value === q.answer;
    else if (q.type === 'ordenar' && a.type === 'ordenar') correct = gradeOrder(a.order);
    else if (q.type === 'associar' && a.type === 'associar') {
      correct = gradeMatch(q.pairs, a.choices).every(Boolean);
    } else if (q.type === 'numerica' && a.type === 'numerica') {
      value = parseAnswer(a.text, q.unit);
      if (value === undefined) {
        update(index, (s) => ({
          ...s,
          error:
            'Não entendi esse número. Escreva só o valor, com vírgula para decimais, como 0,5.',
        }));
        return;
      }
      correct = isClose(value, q.answer, q.tolerance);
    }

    const next = states.map((s, i) =>
      i === index
        ? {
            ...s,
            correct,
            error: undefined,
            answer: a.type === 'numerica' ? { ...a, value } : a,
          }
        : s,
    );
    setStates(next);

    if (next.every((s) => s.correct !== undefined)) {
      const acertos = next.filter((s) => s.correct).length;
      if (lessonId) getProgress().recordQuiz(lessonId, quizKey, acertos, total);
    }
  }

  function restart() {
    setStates(questions.map(initial));
    setAttempt((n) => n + 1);
    window.setTimeout(() => {
      document
        .getElementById(`${uid}-q0`)
        ?.querySelector<HTMLElement>('input, select, button')
        ?.focus();
    }, 0);
  }

  return (
    <section className="quiz" aria-labelledby={`${uid}-title`} data-quiz={quizKey}>
      <header className="quiz__head">
        <p className="quiz__kicker">Exercícios</p>
        <h3 id={`${uid}-title`} className="quiz__title">
          {title}
        </h3>
        <p className="quiz__meta">
          {plural(total, 'questão', 'questões')}
          {previous && !finished && (
            <>
              {' · '}
              Da última vez você acertou {previous.acertos} de {previous.total}.
            </>
          )}
        </p>
      </header>

      <ol className="quiz__list" key={attempt}>
        {questions.map((q, i) => (
          <QuestionView
            key={i}
            id={`${uid}-q${i}`}
            index={i}
            total={total}
            question={q}
            state={states[i] ?? initial(q)}
            onChange={(answer) => update(i, (s) => ({ ...s, answer, error: undefined }))}
            onCheck={() => check(i)}
          />
        ))}
      </ol>

      <div className="quiz__summary" data-finished={finished || undefined}>
        {finished ? (
          <>
            <p className="quiz__score">
              Você acertou <strong>{right}</strong> de <strong>{total}</strong>
              {right === total ? '. Excelente!' : '.'}
            </p>
            <p className="quiz__note">
              {right === total
                ? 'Tudo certo. Seu resultado ficou salvo no seu progresso.'
                : 'Releia as explicações das questões que errou e tente de novo. Seu resultado ficou salvo no seu progresso.'}
            </p>
            <button type="button" className="quiz__restart" onClick={restart}>
              Refazer os exercícios
            </button>
          </>
        ) : (
          <p className="quiz__note">
            {checked === 0
              ? 'Responda e clique em Verificar em cada questão.'
              : `${plural(checked, 'questão respondida', 'questões respondidas')} de ${total}.`}
          </p>
        )}
      </div>
      <p className="sr-only" role="status">
        {finished ? `Fim dos exercícios. Você acertou ${right} de ${total}.` : ''}
      </p>
    </section>
  );
}

interface QuestionViewProps {
  id: string;
  index: number;
  total: number;
  question: PreparedQuestion;
  state: QuestionState;
  onChange: (answer: Answer) => void;
  onCheck: () => void;
}

function QuestionView({ id, index, total, question, state, onChange, onCheck }: QuestionViewProps) {
  const done = state.correct !== undefined;
  const resultRef = useRef<HTMLDivElement>(null);
  const wasDone = useRef(done);

  useEffect(() => {
    if (done && !wasDone.current) resultRef.current?.focus();
    wasDone.current = done;
  }, [done]);

  const status = done ? (state.correct ? 'certa' : 'errada') : undefined;

  return (
    <li className="quiz__q" id={id} data-result={status}>
      <fieldset className="quiz__fieldset" disabled={done}>
        <legend className="quiz__legend">
          <span className="quiz__number">
            Questão {index + 1} de {total}
          </span>
          <span className="quiz__prompt">{question.prompt}</span>
        </legend>
        <Body id={id} question={question} state={state} onChange={onChange} onCheck={onCheck} />
      </fieldset>

      {state.error && (
        <p className="quiz__error" id={`${id}-erro`} role="alert">
          {state.error}
        </p>
      )}

      {!done && (
        <button
          type="button"
          className="quiz__check"
          onClick={onCheck}
          disabled={!isAnswered(state)}
        >
          Verificar
        </button>
      )}

      {done && (
        <div className="quiz__result" ref={resultRef} tabIndex={-1}>
          <p className="quiz__verdict">
            <Mark ok={Boolean(state.correct)} />
            {state.correct ? 'Correto!' : 'Não foi dessa vez.'}
          </p>
          <Solution question={question} state={state} />
          {question.explanation && <p className="quiz__explanation">{question.explanation}</p>}
        </div>
      )}
    </li>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <svg
      className="quiz__mark"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      {ok ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M7 7l10 10M17 7L7 17" />}
    </svg>
  );
}

interface BodyProps {
  id: string;
  question: PreparedQuestion;
  state: QuestionState;
  onChange: (answer: Answer) => void;
  onCheck: () => void;
}

function Body({ id, question: q, state, onChange, onCheck }: BodyProps) {
  const a = state.answer;
  const done = state.correct !== undefined;

  if (q.type === 'multipla' && a.type === 'multipla') {
    const many = q.options.filter((o) => o.correct).length > 1;
    return (
      <>
        {many && <p className="quiz__hint">Marque todas as alternativas corretas.</p>}
        <ul className="quiz__options">
          {q.order.map((optionIndex) => {
            const option = q.options[optionIndex];
            if (!option) return null;
            const chosen = a.selected.includes(optionIndex);
            const result = done
              ? option.correct
                ? 'certa'
                : chosen
                  ? 'errada'
                  : undefined
              : undefined;
            return (
              <li
                key={optionIndex}
                className="quiz__option"
                data-result={result}
                data-chosen={chosen || undefined}
              >
                <label className="quiz__choice">
                  <input
                    type={many ? 'checkbox' : 'radio'}
                    name={`${id}-opcao`}
                    checked={chosen}
                    onChange={(event) => {
                      const on = event.currentTarget.checked;
                      const selected = many
                        ? on
                          ? [...a.selected, optionIndex]
                          : a.selected.filter((s) => s !== optionIndex)
                        : [optionIndex];
                      onChange({ type: 'multipla', selected });
                    }}
                  />
                  <span>{option.text}</span>
                  {result && (
                    <span className="quiz__tag">
                      {result === 'certa'
                        ? chosen
                          ? 'Correta, sua resposta'
                          : 'Correta'
                        : 'Sua resposta'}
                    </span>
                  )}
                </label>
                {done && option.feedback && (chosen || option.correct) && (
                  <p className="quiz__feedback">{option.feedback}</p>
                )}
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  if (q.type === 'vf' && a.type === 'vf') {
    return (
      <ul className="quiz__options quiz__options--row">
        {[true, false].map((value) => {
          const chosen = a.value === value;
          const result = done
            ? value === q.answer
              ? 'certa'
              : chosen
                ? 'errada'
                : undefined
            : undefined;
          return (
            <li
              key={String(value)}
              className="quiz__option"
              data-result={result}
              data-chosen={chosen || undefined}
            >
              <label className="quiz__choice">
                <input
                  type="radio"
                  name={`${id}-vf`}
                  checked={chosen}
                  onChange={() => onChange({ type: 'vf', value })}
                />
                <span>{value ? 'Verdadeiro' : 'Falso'}</span>
                {result && (
                  <span className="quiz__tag">
                    {result === 'certa'
                      ? chosen
                        ? 'Correta, sua resposta'
                        : 'Correta'
                      : 'Sua resposta'}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  if (q.type === 'numerica' && a.type === 'numerica') {
    return (
      <div className="quiz__number-field">
        <label className="quiz__label" htmlFor={`${id}-valor`}>
          Sua resposta
        </label>
        <div className="quiz__input-row">
          <input
            id={`${id}-valor`}
            className="quiz__input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={a.text}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={`${id}-dica${state.error ? ` ${id}-erro` : ''}`}
            onChange={(event) => onChange({ type: 'numerica', text: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onCheck();
              }
            }}
          />
          {q.unit && <span className="quiz__unit">{q.unit}</span>}
        </div>
        <p className="quiz__hint" id={`${id}-dica`}>
          Use vírgula para decimais, como 0,5. Pode usar prefixos: 470 mA, 4k7.
        </p>
      </div>
    );
  }

  if (q.type === 'ordenar' && a.type === 'ordenar') {
    return <OrderList id={id} items={q.items} order={a.order} done={done} onChange={onChange} />;
  }

  if (q.type === 'associar' && a.type === 'associar') {
    const marks = done ? gradeMatch(q.pairs, a.choices) : [];
    return (
      <>
        <p className="quiz__hint">Escolha o par de cada item.</p>
        <ul className="quiz__pairs">
          {q.pairs.map(([left], i) => {
            const result = done ? (marks[i] ? 'certa' : 'errada') : undefined;
            return (
              <li key={i} className="quiz__pair" data-result={result}>
                <label className="quiz__pair-left" htmlFor={`${id}-par-${i}`}>
                  {left}
                </label>
                <select
                  id={`${id}-par-${i}`}
                  className="quiz__select"
                  value={a.choices[i] ?? ''}
                  onChange={(event) => {
                    const v = event.currentTarget.value;
                    const choices = a.choices.map((c, j) =>
                      j === i ? (v === '' ? undefined : Number(v)) : c,
                    );
                    onChange({ type: 'associar', choices });
                  }}
                >
                  <option value="">Escolha…</option>
                  {q.order.map((pairIndex) => (
                    <option key={pairIndex} value={pairIndex}>
                      {q.pairs[pairIndex]?.[1]}
                    </option>
                  ))}
                </select>
                {result && (
                  <span className="quiz__tag">{result === 'certa' ? 'Certo' : 'Errado'}</span>
                )}
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return null;
}

interface OrderListProps {
  id: string;
  items: string[];
  order: number[];
  done: boolean;
  onChange: (answer: Answer) => void;
}

function OrderList({ id, items, order, done, onChange }: OrderListProps) {
  const [announcement, setAnnouncement] = useState('');
  const focusNext = useRef<{ item: number; dir: 'cima' | 'baixo' } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-item="${target.item}"]`);
    const preferred = row?.querySelector<HTMLButtonElement>(`[data-dir="${target.dir}"]`);
    const other = row?.querySelector<HTMLButtonElement>(
      `[data-dir="${target.dir === 'cima' ? 'baixo' : 'cima'}"]`,
    );
    (preferred && !preferred.disabled ? preferred : other)?.focus();
  }, [order]);

  function move(position: number, delta: -1 | 1) {
    const to = position + delta;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const item = next[position];
    if (item === undefined) return;
    next.splice(position, 1);
    next.splice(to, 0, item);
    focusNext.current = { item, dir: delta < 0 ? 'cima' : 'baixo' };
    setAnnouncement(`${items[item]}: posição ${to + 1} de ${order.length}.`);
    onChange({ type: 'ordenar', order: next });
  }

  return (
    <>
      <p className="quiz__hint">Use os botões de seta para mudar a ordem.</p>
      <ol className="quiz__order" ref={listRef}>
        {order.map((item, position) => {
          const result = done ? (item === position ? 'certa' : 'errada') : undefined;
          return (
            <li key={item} className="quiz__order-item" data-item={item} data-result={result}>
              <span className="quiz__order-pos" aria-hidden="true">
                {position + 1}
              </span>
              <span className="quiz__order-text">{items[item]}</span>
              {result && (
                <span className="quiz__tag">
                  {result === 'certa' ? 'No lugar certo' : 'Fora do lugar'}
                </span>
              )}
              {!done && (
                <span className="quiz__order-buttons">
                  <OrderButton
                    dir="cima"
                    label={`Subir: ${items[item]}`}
                    disabled={position === 0}
                    onClick={() => move(position, -1)}
                  />
                  <OrderButton
                    dir="baixo"
                    label={`Descer: ${items[item]}`}
                    disabled={position === order.length - 1}
                    onClick={() => move(position, 1)}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite" id={`${id}-ordem`}>
        {announcement}
      </p>
    </>
  );
}

function OrderButton({
  dir,
  label,
  disabled,
  onClick,
}: {
  dir: 'cima' | 'baixo';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="quiz__move"
      data-dir={dir}
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d={dir === 'cima' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
      </svg>
      <span className="sr-only">{label}</span>
    </button>
  );
}

function Solution({
  question: q,
  state,
}: {
  question: PreparedQuestion;
  state: QuestionState;
}): ReactNode {
  const a = state.answer;
  if (q.type === 'numerica' && a.type === 'numerica') {
    return (
      <p className="quiz__solution">
        {a.value !== undefined && !state.correct && (
          <>Você respondeu {formatQuantity(a.value, q.unit)}. </>
        )}
        Resposta: <strong>{formatQuantity(q.answer, q.unit)}</strong>.
      </p>
    );
  }
  if (state.correct) return null;
  if (q.type === 'ordenar') {
    return (
      <div className="quiz__solution">
        <p>A ordem certa é:</p>
        <ol className="quiz__solution-list">
          {q.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    );
  }
  if (q.type === 'associar') {
    return (
      <div className="quiz__solution">
        <p>Os pares certos são:</p>
        <ul className="quiz__solution-list">
          {q.pairs.map(([left, right]) => (
            <li key={left}>
              {left}: {right}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (q.type === 'vf') {
    return (
      <p className="quiz__solution">
        A afirmação é <strong>{q.answer ? 'verdadeira' : 'falsa'}</strong>.
      </p>
    );
  }
  return null;
}
