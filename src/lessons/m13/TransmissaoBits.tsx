/*
 * Lesson 13.3: the bits a 433 MHz remote sends and what the receiver does
 * with them. The student presses the remote, teaches it to the receiver,
 * erases the memory and plays back a copied frame, with fixed code and with
 * rolling code. Logic in codigos.ts.
 */
import { useId, useState } from 'react';
import { formatNumber, NBSP } from '../m00/formato';
import {
  emptyReceiver,
  fieldsOf,
  frameDuration,
  hex,
  makeFrame,
  receive,
  REMOTES,
  remoteById,
  segmentsOf,
  timeline,
  VERDICTS,
  WINDOW,
  type CodeKind,
  type FieldId,
  type Frame,
  type Verdict,
} from './codigos';
import '../m00/widget.css';
import './transmissao.css';

/* Frame drawing (viewBox 0 -6 640 90). */
const FX0 = 8;
const FX1 = 632;
const HIGH = 40;
const LOW = 70;

const KINDS: { id: CodeKind; label: string }[] = [
  { id: 'fixo', label: 'Código fixo' },
  { id: 'rolling', label: 'Rolling code' },
];

interface LogLine {
  n: number;
  text: string;
  ok: boolean;
}

function frameText(frame: Frame): string {
  const remote = remoteById(frame.remote).label.toLowerCase();
  if (frame.kind === 'fixo')
    return `${remote}, serial ${hex(frame.serial, 5)}, botão ${frame.button}`;
  return `${remote}, cifrado ${hex(frame.hop ?? 0, 8)}, serial ${hex(frame.serial, 7)}, botão ${frame.button}`;
}

export default function TransmissaoBits() {
  const id = useId();
  const [kind, setKind] = useState<CodeKind>('fixo');
  const [accepts, setAccepts] = useState<CodeKind>('fixo');
  const [remote, setRemote] = useState(REMOTES[0]!.id);
  const [button, setButton] = useState(1);
  const [counters, setCounters] = useState<Record<string, number>>({ a: 100, b: 500 });
  const [rx, setRx] = useState(emptyReceiver);
  const [last, setLast] = useState<Frame>(() => makeFrame('fixo', 'a', 1, 100));
  const [copy, setCopy] = useState<Frame | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [sent, setSent] = useState(0);

  const note = (text: string, ok: boolean) =>
    setLog((l) => [{ n: (l[0]?.n ?? 0) + 1, text, ok }, ...l].slice(0, 5));

  const deliver = (frame: Frame, origin: string) => {
    const out = receive(rx, frame, accepts);
    setRx(out.rx);
    setVerdict(out.verdict);
    note(`${origin}: ${VERDICTS[out.verdict].text}`, VERDICTS[out.verdict].ok);
  };

  const press = (heard: boolean) => {
    const counter = (counters[remote] ?? 0) + 1;
    setCounters({ ...counters, [remote]: counter });
    const frame = makeFrame(kind, remote, button, counter);
    setLast(frame);
    setSent((s) => s + 1);
    if (heard) {
      // The grabber hides near the gate and records every press it hears.
      setCopy(frame);
      deliver(frame, 'Aperto');
    } else {
      setVerdict(null);
      note(
        kind === 'rolling'
          ? `Aperto longe da central: ninguém ouviu, mas o contador do controle foi para ${counter}.`
          : 'Aperto longe da central: ninguém ouviu.',
        true,
      );
    }
  };

  const reset = (k: CodeKind, a: CodeKind) => {
    setKind(k);
    setAccepts(a);
    setRx(emptyReceiver());
    setCopy(null);
    setVerdict(null);
    setLog([]);
    setLast(makeFrame(k, remote, button, counters[remote] ?? 0));
  };

  const fields = fieldsOf(last);
  const segments = segmentsOf(last);
  const total = segments.reduce((a, s) => a + s.units, 0);
  const sx = (u: number) => FX0 + (u / total) * (FX1 - FX0);
  const drawn = timeline(segments).map((s) => ({
    ...s,
    x0: sx(s.start),
    x1: sx(s.start + s.units),
  }));
  const spans = new Map<FieldId, [number, number]>();
  for (const s of drawn) {
    const span = spans.get(s.field);
    spans.set(s.field, span ? [span[0], s.x1] : [s.x0, s.x1]);
  }
  const ms = formatNumber(frameDuration(last) * 1000, 1);
  const status = verdict ? VERDICTS[verdict] : null;

  return (
    <section className="lw bits" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Os bits no ar: controle, receptor e copiador
        </h3>
        <p className="lw__lead">
          Aperte o controle e veja o quadro que ele manda. Cadastre o controle no receptor e tente
          abrir o portão com a cópia gravada por um copiador escondido perto do portão.
        </p>
      </header>

      <div className="lw__body">
        <div className="lw__controls lw__controls--cols">
          <fieldset className="lw__group">
            <legend className="lw__legend">Tipo do controle</legend>
            <div className="lw__choices">
              {KINDS.map((k) => (
                <label key={k.id} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-controle`}
                    checked={kind === k.id}
                    onChange={() => reset(k.id, k.id)}
                  />
                  {k.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="lw__group">
            <legend className="lw__legend">O receptor entende</legend>
            <div className="lw__choices">
              {KINDS.map((k) => (
                <label key={k.id} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-receptor`}
                    checked={accepts === k.id}
                    onChange={() => reset(kind, k.id)}
                  />
                  {k.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="bits__panels">
          <div className="bits__panel">
            <h4 className="bits__panel-t">Controle</h4>
            <div className="lw__choices">
              {REMOTES.map((r) => (
                <label key={r.id} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-qual`}
                    checked={remote === r.id}
                    onChange={() => setRemote(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <div className="lw__choices">
              {[1, 2].map((b) => (
                <label key={b} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-botao`}
                    checked={button === b}
                    onChange={() => setButton(b)}
                  />
                  Botão {b}
                </label>
              ))}
            </div>
            <div className="bits__buttons">
              <button
                type="button"
                className="lw__btn lw__btn--primary"
                onClick={() => press(true)}
              >
                Apertar o botão
              </button>
              <button type="button" className="lw__btn" onClick={() => press(false)}>
                Apertar longe da central
              </button>
            </div>
            {kind === 'rolling' && (
              <p className="lw__note">
                Contador interno do controle:{' '}
                <strong className="num" data-contador>
                  {counters[remote]}
                </strong>
              </p>
            )}
          </div>

          <div className="bits__panel">
            <h4 className="bits__panel-t">Receptor da central</h4>
            <p className="bits__led-row">
              <span
                className={`bits__led${rx.learning ? ' bits__led--on' : ''}`}
                aria-hidden="true"
              ></span>
              {rx.learning ? 'Esperando um controle para cadastrar' : 'Funcionando normalmente'}
            </p>
            <div className="bits__buttons">
              <button
                type="button"
                className="lw__btn"
                onClick={() => {
                  setRx({ ...rx, learning: true });
                  note('Receptor em modo de cadastro: aperte o botão do controle.', true);
                }}
              >
                Cadastrar
              </button>
              <button
                type="button"
                className="lw__btn"
                onClick={() => {
                  setRx(emptyReceiver());
                  setVerdict(null);
                  note('Memória apagada: nenhum controle cadastrado.', true);
                }}
              >
                Apagar todos
              </button>
            </div>
            <p className="lw__value-label">Memória ({rx.memory.length})</p>
            <ul className="bits__memory" data-memoria={rx.memory.length}>
              {rx.memory.length === 0 && <li className="lw__note">vazia</li>}
              {rx.memory.map((e) => (
                <li key={`${e.serial}-${e.button}`}>
                  {remoteById(e.remote).label}, botão {e.button}
                  {e.kind === 'rolling' && <> · último contador {e.counter}</>}
                </li>
              ))}
            </ul>
          </div>

          <div className="bits__panel">
            <h4 className="bits__panel-t">Copiador</h4>
            <p className="lw__note">
              {copy ? `Gravou: ${frameText(copy)}` : 'Ainda não gravou nada.'}
            </p>
            <button
              type="button"
              className="lw__btn"
              disabled={!copy}
              onClick={() => copy && deliver(copy, 'Cópia')}
            >
              Repetir o código copiado
            </button>
          </div>
        </div>

        <figure className="bits__frame">
          <svg
            viewBox="0 -6 640 90"
            role="img"
            aria-label={`Último quadro enviado, ${kind === 'fixo' ? 'código fixo' : 'rolling code'}: ${frameText(last)}. Dura ${ms} milissegundos.`}
          >
            {[...spans].map(([f, [x0, x1]]) => (
              <g key={f} className={`bits__field bits__field--${f}`}>
                <rect x={x0} y={16} width={x1 - x0} height={64} className="bits__field-bg" />
                <text x={(x0 + x1) / 2} y={12} className="bits__field-t">
                  {fields.find((x) => x.id === f)?.label.replace(/ \(.*\)/, '')}
                </text>
              </g>
            ))}
            <line x1={FX0} x2={FX1} y1={LOW} y2={LOW} className="bits__base" />
            {drawn
              .filter((s) => s.on)
              .map((s, i) => (
                <rect
                  key={i}
                  x={s.x0}
                  y={HIGH}
                  width={Math.max(s.x1 - s.x0, 0.6)}
                  height={LOW - HIGH}
                  className="bits__on"
                />
              ))}
            {sent > 0 && (
              <rect key={sent} x={FX0} y={16} width={3} height={64} className="bits__cursor" />
            )}
          </svg>
          <p className="bits__axis">
            <span>portadora de 433,92{NBSP}MHz: ligada (barra) ou desligada (linha)</span>
            <span className="num">
              {ms}
              {NBSP}ms
            </span>
          </p>
          <figcaption className="bits__fields">
            {fields
              .filter((f) => f.bits.length)
              .map((f) => (
                <span key={f.id} className={`bits__chip bits__field--${f.id}`}>
                  <span className="bits__chip-t">{f.label}</span>{' '}
                  <code data-campo={f.id}>{f.bits.join('').replace(/(.{4})(?=.)/g, '$1 ')}</code>
                </span>
              ))}
          </figcaption>
        </figure>

        <div className="lw__output" aria-live="polite">
          {status ? (
            <p
              className={`lw__status ${status.ok ? 'lw__status--ok' : 'lw__status--danger'}`}
              data-veredito={verdict}
            >
              <span className="lw__status-dot" aria-hidden="true"></span>
              <span>{status.text}</span>
            </p>
          ) : (
            <p className="lw__note" data-veredito="">
              Nada recebido ainda.
            </p>
          )}
          {log.length > 0 && (
            <ol className="bits__log">
              {log.map((l) => (
                <li key={l.n} className={l.ok ? '' : 'bits__log--bad'}>
                  {l.text}
                </li>
              ))}
            </ol>
          )}
          {kind === 'rolling' && (
            <p className="lw__note">
              O receptor aceita um contador até {WINDOW} apertos à frente do último. Na figura, a
              parte cifrada usa um embaralhamento de brinquedo; nos controles reais é uma cifra com
              chave secreta.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
