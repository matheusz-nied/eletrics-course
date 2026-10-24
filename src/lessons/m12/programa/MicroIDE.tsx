/**
 * Lesson 12.5 "Programando um microcontrolador": the student edits a small
 * Arduino program, sends it to a simulated Uno-like board and watches the
 * circuit react. Used in MDX as
 * `<MicroIDE client:visible exemplo="pisca" />`, with `exemplos` to limit
 * the example menu.
 *
 * Stable hooks for end-to-end tests: root `.mide` with `data-estado`,
 * `data-led13` (on|off), `data-led9` (brightness 0–100), `data-relay`
 * (on|off) and `data-buzzer` (Hz); `.mide__serial`, `.mide__status`; the
 * upload button reads "Enviar para a placa".
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { formatNumber, formatSI } from '../../m00/formato';
import { I_GREEN, I_RED, pwmFrequency } from './board';
import { MicroController, type MideSnapshot } from './controller';
import Editor from './Editor';
import { EXEMPLOS, exemploPorId } from './exemplos';
import PlacaCircuito from './PlacaCircuito';
import { SomBuzzer } from './som';
import '../../m00/widget.css';
import './micro-ide.css';

export interface MicroIDEProps {
  /** Id of the first example shown (default "pisca"). */
  exemplo?: string;
  /** Ids of the examples in the menu (default: all). */
  exemplos?: string[];
  titulo?: string;
}

const SPEEDS = [
  { v: 0.1, label: '0,1× (câmera lenta)' },
  { v: 1, label: '1× (tempo real)' },
  { v: 10, label: '10× (acelerado)' },
];

const seconds = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pct = (x: number) => `${formatNumber(Math.round(x * 100), 0)} %`;
const volts = (v: number) => `${v.toFixed(2).replace('.', ',')} V`;

function ledText(s: MideSnapshot['view']['led13'], full: number): string {
  if (s.fraco) return 'aceso bem fraquinho (só o pull-up interno)';
  if (s.pwm !== null) {
    return `PWM ${s.pwm} de 255 (${pct(s.pwm / 255)}) · ${formatSI(s.corrente, 'A', 2)} em média`;
  }
  if (s.brilho > 0.05 && s.brilho < 0.95) return `piscando rápido · brilho médio ${pct(s.brilho)}`;
  return s.aceso ? `aceso · cerca de ${formatSI(full, 'A', 2)}` : 'apagado';
}

function buttonText(s: MideSnapshot): string {
  const solto = s.inputs.botao ? 'apertado' : 'solto';
  switch (s.view.pino2) {
    case 'HIGH':
      return `${solto} · o pino 2 lê HIGH`;
    case 'LOW':
      return `${solto} · o pino 2 lê LOW`;
    case 'flutuando':
      return `${solto} · o pino 2 flutua (leitura aleatória)`;
    default:
      return `${solto} · o pino 2 está como saída`;
  }
}

function statusText(s: MideSnapshot): {
  tone: 'ok' | 'warn' | 'danger' | 'idle';
  title: string;
  note: string;
} {
  const e = s.erro;
  if (e?.tipo === 'compilacao') {
    return {
      tone: 'danger',
      title: `Erro na linha ${e.line}`,
      note:
        e.message +
        (s.estado === 'rodando' ? ' A placa continua rodando o programa enviado antes.' : ''),
    };
  }
  if (e?.tipo === 'execucao') {
    return { tone: 'danger', title: `O programa parou na linha ${e.line}`, note: e.message };
  }
  switch (s.estado) {
    case 'vazia':
      return {
        tone: 'idle',
        title: 'Placa sem programa',
        note: 'Escolha um exemplo ou escreva o seu e clique em "Enviar para a placa".',
      };
    case 'parada':
      return {
        tone: 'idle',
        title: 'Placa parada',
        note: 'O programa está parado e os pinos voltaram a ser entradas. Clique em "Reiniciar placa" para rodar de novo.',
      };
    default:
      return {
        tone: s.avisos.length ? 'warn' : 'ok',
        title: s.avisos.length ? 'Programa rodando, com avisos' : 'Programa rodando',
        note: s.avisos.length
          ? 'Ele funciona, mas veja os avisos abaixo.'
          : 'Mexa no botão, no potenciômetro e na luz para ver o circuito reagir.',
      };
  }
}

export default function MicroIDE({ exemplo = 'pisca', exemplos, titulo }: MicroIDEProps) {
  const uid = useId();
  const lista = useMemo(() => {
    const l = exemplos?.length ? EXEMPLOS.filter((e) => exemplos.includes(e.id)) : EXEMPLOS;
    return l.length ? l : EXEMPLOS;
  }, [exemplos]);
  const first = lista.find((e) => e.id === exemplo) ?? lista[0]!;

  const [ctl] = useState(() => new MicroController());
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot, ctl.getSnapshot);
  const [exId, setExId] = useState(first.id);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [som, setSom] = useState(false);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [visivel, setVisivel] = useState(false);
  const [audio] = useState(() => new SomBuzzer());
  const serialRef = useRef<HTMLPreElement>(null);

  const ex = exemploPorId(exId) ?? first;
  const codigo = edits[exId] ?? ex.codigo;
  const modificado = snap.enviado !== null && snap.enviado !== codigo;

  // Run only while on screen and the tab is visible.
  useEffect(() => {
    if (!root) return;
    const update = (onScreen: boolean) => {
      const v = onScreen && !document.hidden;
      setVisivel(v);
      ctl.setVisible(v);
    };
    let onScreen = true;
    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) onScreen = e.isIntersecting;
        update(onScreen);
      });
      io.observe(root);
    } else {
      update(true);
    }
    const onHidden = () => update(onScreen);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
      ctl.dispose();
    };
  }, [ctl, root]);

  // The buzzer sound follows the board, only with "Som" on and the widget visible.
  const hz = snap.estado === 'rodando' && som && visivel ? snap.view.buzzerHz : 0;
  useEffect(() => {
    audio.tocar(hz);
  }, [audio, hz]);
  useEffect(() => () => audio.fechar(), [audio]);

  // Keep the serial monitor scrolled to the end, unless the student scrolled up.
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = serialRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [snap.serial]);

  const setCodigo = useCallback(
    (c: string) => {
      setEdits((m) => ({ ...m, [exId]: c }));
      ctl.limparErro();
    },
    [ctl, exId],
  );
  const enviar = useCallback(() => {
    ctl.enviar(edits[exId] ?? (exemploPorId(exId) ?? first).codigo);
  }, [ctl, edits, exId, first]);

  const toggleSom = (on: boolean) => {
    setSom(on);
    if (on) audio.ligar();
    else audio.desligar();
  };

  const hold = {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      ctl.setBotao(true);
    },
    onPointerUp: () => ctl.setBotao(false),
    onPointerCancel: () => ctl.setBotao(false),
    onLostPointerCapture: () => ctl.setBotao(false),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        ctl.setBotao(true);
      }
    },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        ctl.setBotao(false);
      }
    },
    onBlur: () => ctl.setBotao(false),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };

  const v = snap.view;
  const status = statusText(snap);
  const errorLine = snap.erro && snap.erro.line > 0 ? snap.erro.line : null;
  const running = snap.estado === 'rodando';
  const led13 = running && v.led13.aceso;
  const svgLabel = `Placa e circuito. LED vermelho ${led13 ? 'aceso' : 'apagado'}, LED verde com brilho de ${pct(v.led9.brilho)}, relé ${v.rele ? 'ligado e lâmpada acesa' : 'desligado'}, buzzer ${v.buzzerHz > 0 ? `tocando ${v.buzzerHz} Hz` : 'em silêncio'}, botão ${snap.inputs.botao ? 'apertado' : 'solto'}.`;

  return (
    <section
      ref={setRoot}
      className="lw mide breakout"
      aria-labelledby={`${uid}-titulo`}
      data-estado={snap.estado}
      data-led13={led13 ? 'on' : 'off'}
      data-led9={Math.round(v.led9.brilho * 100)}
      data-relay={v.rele ? 'on' : 'off'}
      data-buzzer={v.buzzerHz}
    >
      <header className="lw__head">
        <p className="lw__kicker">Microcontrolador simulado</p>
        <h3 id={`${uid}-titulo`} className="lw__title">
          {titulo ?? 'Programe a placa e veja o circuito reagir'}
        </h3>
        <p className="lw__lead">
          Edite o programa, clique em “Enviar para a placa” e mexa no botão, no potenciômetro e na
          luz. A placa só muda quando você envia o código de novo, como num Arduino de verdade.
        </p>
      </header>

      <div className="mide__grid">
        <div className="mide__col">
          <div className="mide__toolbar" role="group" aria-label="Placa">
            <button type="button" className="lw__btn lw__btn--primary" onClick={enviar}>
              Enviar para a placa
            </button>
            <button
              type="button"
              className="lw__btn"
              onClick={() => ctl.parar()}
              disabled={!running}
            >
              Parar
            </button>
            <button
              type="button"
              className="lw__btn"
              onClick={() => ctl.reiniciar()}
              disabled={snap.enviado === null}
            >
              Reiniciar placa
            </button>
          </div>
          <div className="mide__selects">
            <label className="lw__field">
              <span>Exemplo</span>
              <select value={exId} onChange={(e) => setExId(e.target.value)}>
                {lista.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="lw__field">
              <span>Velocidade</span>
              <select
                value={snap.velocidade}
                onChange={(e) => ctl.setVelocidade(Number(e.target.value))}
              >
                {SPEEDS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="lw__note">{ex.resumo}</p>

          <label className="mide__code-label" htmlFor={`${uid}-codigo`}>
            Código do programa
            {edits[exId] !== undefined && edits[exId] !== ex.codigo && (
              <button
                type="button"
                className="mide__link"
                onClick={() =>
                  setEdits((m) => {
                    const next = { ...m };
                    delete next[exId];
                    return next;
                  })
                }
              >
                Voltar ao exemplo original
              </button>
            )}
          </label>
          <Editor
            id={`${uid}-codigo`}
            value={codigo}
            onChange={setCodigo}
            onUpload={enviar}
            errorLine={errorLine}
            hintId={`${uid}-dica`}
          />
          <p id={`${uid}-dica`} className="lw__note">
            Tab insere dois espaços; para sair do editor pelo teclado, aperte Esc e depois Tab.
            Ctrl+Enter envia para a placa.
            {modificado && (
              <strong className="mide__mod"> O código mudou: envie de novo para a placa.</strong>
            )}
          </p>

          <div
            className={`lw__status lw__status--${status.tone === 'idle' ? 'ok' : status.tone} mide__status`}
            role="status"
            aria-live="polite"
          >
            <span className="lw__status-dot" aria-hidden="true" />
            <div className="mide__status-body">
              <p>
                <strong>{status.title}</strong>
              </p>
              <p className="lw__note">{status.note}</p>
              {snap.avisos.length > 0 && (
                <ul className="mide__avisos">
                  {snap.avisos.map((a) => (
                    <li key={a.key}>{a.texto}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {running && snap.semDelay && (
            <p className="lw__note mide__info">
              Este programa não chama delay(): o loop() roda sem parar, cerca de{' '}
              {formatNumber(Math.round(snap.loopsPorSegundo / 100) * 100, 0)} vezes por segundo. Num
              microcontrolador de verdade também é assim, e tudo bem.
            </p>
          )}
          {running && snap.lento && (
            <p className="lw__note mide__info">
              O simulador não está dando conta dessa velocidade: o tempo na placa está passando mais
              devagar que o pedido.
            </p>
          )}
        </div>

        <div className="mide__col">
          <div className="mide__board">
            <PlacaCircuito
              view={v}
              inputs={snap.inputs}
              ligada
              label={svgLabel}
              onBotao={(d) => ctl.setBotao(d)}
            />
          </div>

          <div className="mide__inputs">
            <button
              type="button"
              className="lw__btn mide__hold"
              aria-pressed={snap.inputs.botao}
              {...hold}
            >
              {snap.inputs.botao ? 'Botão do pino 2: apertado' : 'Segure o botão do pino 2'}
            </button>
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Potenciômetro (A0)</span>
                <strong className="num">
                  {pct(snap.inputs.pot)} · {volts(v.a0.volts)}
                </strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(snap.inputs.pot * 100)}
                aria-valuetext={`${pct(snap.inputs.pot)}, ${volts(v.a0.volts)}`}
                onChange={(e) => ctl.setPot(Number(e.target.value) / 100)}
              />
            </label>
            <label className="lw__range">
              <span className="lw__range-head">
                <span>Luz no LDR (A1)</span>
                <strong className="num">
                  {pct(snap.inputs.luz)} · {volts(v.a1.volts)}
                </strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(snap.inputs.luz * 100)}
                aria-valuetext={`${pct(snap.inputs.luz)} de luz, ${volts(v.a1.volts)}`}
                onChange={(e) => ctl.setLuz(Number(e.target.value) / 100)}
              />
            </label>
            <label className="lw__check">
              <input type="checkbox" checked={som} onChange={(e) => toggleSom(e.target.checked)} />
              Som do buzzer
            </label>
          </div>

          <dl className="mide__readouts">
            <div>
              <dt>LED vermelho (D13)</dt>
              <dd>{ledText(v.led13, I_RED)}</dd>
            </div>
            <div>
              <dt>LED verde (D9)</dt>
              <dd>
                {ledText(v.led9, I_GREEN)}
                {v.led9.pwm !== null && ` · onda de ${formatNumber(pwmFrequency(9), 0)} Hz`}
              </dd>
            </div>
            <div>
              <dt>Relé (D7)</dt>
              <dd>{v.rele ? 'ligado: lâmpada acesa' : 'desligado: lâmpada apagada'}</dd>
            </div>
            <div>
              <dt>Buzzer (D8)</dt>
              <dd>
                {v.buzzerHz > 0 ? `tocando ${formatNumber(v.buzzerHz, 0)} Hz` : 'em silêncio'}
              </dd>
            </div>
            <div>
              <dt>Botão (D2)</dt>
              <dd>{buttonText(snap)}</dd>
            </div>
            <div>
              <dt>Potenciômetro (A0)</dt>
              <dd>
                {volts(v.a0.volts)}: analogRead dá {v.a0.leitura}
              </dd>
            </div>
            <div>
              <dt>LDR (A1)</dt>
              <dd>
                {volts(v.a1.volts)}: analogRead dá {v.a1.leitura}
              </dd>
            </div>
            <div>
              <dt>Tempo na placa</dt>
              <dd className="num">
                {seconds.format(snap.tempo / 1000)} s
                {snap.velocidade !== 1 &&
                  ` (${SPEEDS.find((s) => s.v === snap.velocidade)?.label.split(' ')[0]})`}
              </dd>
            </div>
          </dl>

          <ul className="mide__legend" aria-label="Ligações do circuito">
            <li>
              <b>D13:</b> resistor de 220 Ω e LED vermelho até o GND. É o mesmo pino do LED “L” da
              placa.
            </li>
            <li>
              <b>D9 (PWM):</b> resistor de 220 Ω e LED verde até o GND.
            </li>
            <li>
              <b>D8:</b> buzzer passivo até o GND. Só soa com tone().
            </li>
            <li>
              <b>D7:</b> entrada IN de um módulo relé que liga com HIGH. O contato do relé acende
              uma lâmpada de 12 V com fonte própria.
            </li>
            <li>
              <b>D2:</b> botão até o GND, sem resistor externo.
            </li>
            <li>
              <b>A0:</b> cursor de um potenciômetro de 10 kΩ ligado entre 5 V e GND.
            </li>
            <li>
              <b>A1:</b> LDR até 5 V e resistor de 10 kΩ até o GND: mais luz, mais tensão.
            </li>
          </ul>
          <p className="lw__note">
            Desenho simplificado: na placa real os pinos ficam em outra ordem. Com o pino em HIGH, o
            LED vermelho leva (5 − 2) V ÷ 220 Ω ≈ 14 mA. Muitos módulos relé vendidos ligam com LOW;
            confira o seu.
          </p>
        </div>
      </div>

      <div className="mide__bottom">
        <div className="mide__monitor">
          <div className="mide__monitor-head">
            <span id={`${uid}-serial`}>Monitor serial</span>
            <button
              type="button"
              className="lw__btn mide__small"
              onClick={() => ctl.limparSerial()}
            >
              Limpar
            </button>
          </div>
          <pre
            ref={serialRef}
            className="mide__serial"
            tabIndex={0}
            aria-labelledby={`${uid}-serial`}
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
          >
            {snap.serial || (
              <span className="mide__empty">
                Nada recebido ainda. O que o programa mandar com Serial.print() aparece aqui.
              </span>
            )}
          </pre>
        </div>
      </div>
    </section>
  );
}
