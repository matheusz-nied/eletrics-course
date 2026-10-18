/**
 * "Central virtual": the generic CD-1 central running its real firmware
 * against a model of a sliding gate, with the buttons, jumpers, DIP and
 * trimpots of the board. Used in the M16 lessons as
 * `<CentralVirtual client:visible mostrar={[...]} />`.
 */
import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { nivelForca, tempoPausa } from '../central/controller';
import type { BoardSettings } from '../central/system';
import {
  CentralController,
  OBSTACLE_AT,
  type CentralOptions,
  type CentralSnapshot,
  type WidgetFaults,
} from './central-controller';
import './central-virtual.css';

export type Grupo = 'comandos' | 'cadastro' | 'seguranca' | 'ajustes' | 'energia';

export interface CentralVirtualProps {
  titulo?: string;
  /** Control groups to show (default: comandos, seguranca, ajustes). */
  mostrar?: Grupo[];
  ajustes?: Partial<BoardSettings>;
  defeitos?: WidgetFaults;
  /** Initial gate position, 0 (closed) to 1 (open). */
  abertura?: number;
  /** The remote is already learned (default true). */
  controleCadastrado?: boolean;
  /** Simulated seconds per real second (default 2). */
  velocidade?: number;
  /**
   * A controller made by the parent, for widgets that also read the
   * central's state (the diagnosis exercise). Overrides the options above.
   */
  controller?: CentralController;
}

const DEFAULT_GROUPS: Grupo[] = ['comandos', 'seguranca', 'ajustes'];

const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const pct = (x: number) => `${nf0.format(Math.round(Math.min(1, Math.max(0, x)) * 100))} %`;

export default function CentralVirtual({
  titulo = 'Central virtual',
  mostrar = DEFAULT_GROUPS,
  ajustes,
  defeitos,
  abertura,
  controleCadastrado,
  velocidade,
  controller,
}: CentralVirtualProps) {
  const [ctl] = useState(
    () =>
      controller ??
      new CentralController({
        settings: ajustes,
        faults: defeitos,
        abertura,
        controleCadastrado,
        speed: velocidade,
      } satisfies CentralOptions),
  );
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot, ctl.getSnapshot);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [aviso, setAviso] = useState('');
  const uid = useId();
  const show = (g: Grupo) => mostrar.includes(g);

  useEffect(() => {
    if (!root) return;
    if (typeof IntersectionObserver === 'undefined') {
      ctl.setVisible(true);
      return () => ctl.dispose();
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) ctl.setVisible(e.isIntersecting && !document.hidden);
    });
    io.observe(root);
    const onHidden = () => ctl.setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onHidden);
      ctl.dispose();
    };
  }, [ctl, root]);

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(''), 4000);
    return () => clearTimeout(id);
  }, [aviso]);

  const holdHandlers = (button: 'botoeira' | 'prog') => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      ctl.hold(button, true);
    },
    onPointerUp: () => ctl.hold(button, false),
    onPointerCancel: () => ctl.hold(button, false),
    onLostPointerCapture: () => ctl.hold(button, false),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        ctl.hold(button, true);
      }
    },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') ctl.hold(button, false);
    },
    onBlur: () => ctl.hold(button, false),
  });

  const pressRemote = () => {
    if (!ctl.remote()) setAviso('O sinal do controle não chegou à central.');
  };

  const s = snap;
  const motor = s.k1 || s.k2 ? `relé ${s.k1 ? 'K1' : 'K2'} ligado` : 'relés desligados';

  return (
    <div ref={setRoot} className="cv breakout" data-central-virtual="">
      <div className="cv-head">
        <p className="cv-title">{titulo}</p>
        <p className={`cv-state cv-state--${s.estado.toLowerCase() || 'off'}`} aria-live="polite">
          <span className="cv-sr">Estado da central: </span>
          {s.nomeEstado}
        </p>
        <div className="cv-toolbar" role="group" aria-label="Simulação">
          <button type="button" onClick={() => ctl.setPlaying(!s.playing)}>
            {s.playing ? 'Pausar' : 'Continuar'}
          </button>
          <label className="cv-speed">
            <span>Velocidade</span>
            <select value={s.speed} onChange={(e) => ctl.setSpeed(Number(e.target.value))}>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={5}>5×</option>
            </select>
          </label>
          <button type="button" onClick={() => ctl.reset()}>
            Reiniciar
          </button>
        </div>
      </div>

      <GateView snap={s} />
      <ul className="cv-legend">
        <li>
          <span className="cv-key cv-key--fca" aria-hidden="true" />
          ímã de abertura
        </li>
        <li>
          <span className="cv-key cv-key--fcf" aria-hidden="true" />
          ímã de fechamento
        </li>
        <li>
          <span className="cv-key cv-key--reed" aria-hidden="true" />
          reed do fim de curso, no motor
        </li>
        <li>
          <span className="cv-key cv-key--beam" aria-hidden="true" />
          feixe da fotocélula
        </li>
      </ul>

      <dl className="cv-status">
        <div>
          <dt>Portão</dt>
          <dd>{pct(s.abertura)} aberto</dd>
        </div>
        <div>
          <dt>Motor</dt>
          <dd>
            {s.zumbindo ? 'zumbindo, sem girar' : motor}
            {s.triac > 0 && ` · TRIAC ${pct(s.triac)}`}
          </dd>
        </div>
        <div>
          <dt>Corrente</dt>
          <dd className="num">{nf1.format(s.corrente)} A</dd>
        </div>
        <div>
          <dt>Trava</dt>
          <dd>{s.trava ? 'pulso de 12 V' : 'sem pulso'}</dd>
        </div>
        <div>
          <dt>Luz da garagem</dt>
          <dd>{s.aux ? 'acesa' : 'apagada'}</dd>
        </div>
        <div>
          <dt>
            {s.estado === 'ABERTO' && s.fechamentoAutomatico ? 'Fecha sozinho em' : 'Percurso'}
          </dt>
          <dd className="num">
            {s.estado === 'ABERTO' && s.fechamentoAutomatico
              ? `${nf0.format(Math.ceil(s.pausaRestante))} s`
              : `${nf1.format(s.tempoPercurso)} s de 40 s`}
          </dd>
        </div>
      </dl>

      <ul className="cv-leds" aria-label="LEDs da placa">
        <Led label="REDE" on={s.leds.rede} color="verde" />
        <Led label="FCA" on={s.leds.fca} color="verde" />
        <Led label="FCF" on={s.leds.fcf} color="vermelho" />
        <Led label="FOTO" on={s.leds.foto} color="amarelo" />
        <Led label="PROG" on={s.leds.prog} color="azul" />
        <li className={`cv-buzzer${s.buzzer ? ' is-on' : ''}`}>
          <span aria-hidden="true">♪</span> Buzzer {s.buzzer ? 'apitando' : 'quieto'}
        </li>
      </ul>

      <div className="cv-controls">
        {show('comandos') && (
          <fieldset>
            <legend>Comandos</legend>
            <button type="button" className="cv-btn cv-btn--main" onClick={pressRemote}>
              Controle remoto
            </button>
            <button type="button" className="cv-btn" {...holdHandlers('botoeira')}>
              Botoeira
            </button>
          </fieldset>
        )}

        {show('cadastro') && (
          <fieldset>
            <legend>Cadastro de controles ({s.controles} na memória)</legend>
            <button
              type="button"
              className="cv-btn"
              aria-describedby={`${uid}-prog`}
              {...holdHandlers('prog')}
            >
              PROG
            </button>
            <button type="button" className="cv-btn" onClick={() => ctl.otherRemote()}>
              Controle novo
            </button>
            <button
              type="button"
              className="cv-btn"
              onClick={() => {
                if (!ctl.replay()) setAviso('Aperte o controle antes, para ter um código copiado.');
              }}
            >
              Repetir código copiado
            </button>
            <p id={`${uid}-prog`} className="cv-hint">
              Toque no PROG para cadastrar (o LED acende; aperte o controle novo). Segure por 10 s
              para apagar todos.
            </p>
          </fieldset>
        )}

        {show('seguranca') && (
          <fieldset>
            <legend>Segurança</legend>
            <Toggle
              label="Pessoa no feixe da fotocélula"
              checked={s.env.feixeInterrompido}
              onChange={(v) => ctl.setBeam(v)}
            />
            <Toggle
              label="Obstáculo no caminho do portão"
              checked={s.env.obstaculo !== null}
              onChange={(v) => ctl.setObstacle(v)}
            />
          </fieldset>
        )}

        {show('ajustes') && (
          <fieldset>
            <legend>Jumpers, DIP e trimpots</legend>
            <Toggle
              label="J1 FOTO (ignora a fotocélula)"
              checked={s.settings.j1}
              onChange={(v) => ctl.setSetting('j1', v)}
            />
            <Toggle
              label="J2 AUT (fechamento automático)"
              checked={s.settings.j2}
              onChange={(v) => ctl.setSetting('j2', v)}
            />
            <Toggle
              label="DIP 1 INV (inverte o sentido)"
              checked={s.settings.inv}
              onChange={(v) => ctl.setSetting('inv', v)}
            />
            <Toggle
              label="DIP 2 LUZ (luz de garagem mais 60 s)"
              checked={s.settings.luz}
              onChange={(v) => ctl.setSetting('luz', v)}
            />
            <Trimpot
              label="PAUSA"
              value={s.settings.pausa}
              text={
                tempoPausa(s.settings.pausa) > 0
                  ? `${nf0.format(tempoPausa(s.settings.pausa))} s`
                  : 'desligada'
              }
              onChange={(v) => ctl.setSetting('pausa', v)}
            />
            <Trimpot
              label="FORÇA"
              value={s.settings.forca}
              text={`TRIAC ${pct(nivelForca(s.settings.forca))}`}
              onChange={(v) => ctl.setSetting('forca', v)}
            />
          </fieldset>
        )}

        {show('energia') && (
          <fieldset>
            <legend>Energia e alcance</legend>
            <Toggle
              label="Disjuntor do portão ligado"
              checked={s.disjuntor}
              onChange={(v) => ctl.setBreaker(v)}
            />
            <Toggle
              label="Controle perto da central"
              checked={s.controlePerto}
              onChange={(v) => ctl.setRemoteClose(v)}
            />
          </fieldset>
        )}
      </div>

      <div className="cv-log">
        <p className="cv-log__title">O que a central fez</p>
        {aviso && (
          <p className="cv-aviso" role="status">
            {aviso}
          </p>
        )}
        <ol aria-live="polite">
          {s.eventos.length === 0 && <li className="cv-log__empty">Nada ainda.</li>}
          {s.eventos.map((e, i) => (
            <li key={`${e.t}-${i}`} className={e.kind === 'warning' ? 'is-warning' : undefined}>
              <span className="cv-log__t num">{nf1.format(e.t)} s</span> {e.message}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Led({ label, on, color }: { label: string; on: boolean; color: string }) {
  return (
    <li className={`cv-led cv-led--${color}${on ? ' is-on' : ''}`}>
      <span className="cv-led__dot" aria-hidden="true" />
      {label}
      <span className="cv-sr">{on ? ' aceso' : ' apagado'}</span>
    </li>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="cv-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Trimpot({
  label,
  value,
  text,
  onChange,
}: {
  label: string;
  value: number;
  text: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="cv-trimpot">
      <span className="cv-trimpot__name">Trimpot {label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="cv-trimpot__value num">{text}</span>
    </label>
  );
}

/** Side view of the sliding gate: 50 px per metre, opening from x = 40 to 240. */
function GateView({ snap }: { snap: CentralSnapshot }) {
  const p = Math.min(1, Math.max(0, snap.abertura)) * 3.98;
  const left = 40 + p * 50;
  const width = 230;
  const bars = Array.from({ length: 15 }, (_, i) => left + 8 + i * 15);
  const reedX = 266;
  const magnets = [
    { x: left + 225, cls: 'cv-magnet--fcf' },
    { x: left + 27, cls: 'cv-magnet--fca' },
  ];
  const angle = ((p * 50) / 7) * (180 / Math.PI);
  const beamBlocked = snap.env.feixeInterrompido;
  const obstacle = snap.env.obstaculo !== null;
  const label = `Portão ${pct(snap.abertura)} aberto. Central: ${snap.nomeEstado}.${
    beamBlocked ? ' Há uma pessoa no feixe da fotocélula.' : ''
  }${obstacle ? ' Há um obstáculo no caminho do portão.' : ''}`;
  return (
    <svg className="cv-gate" viewBox="0 0 480 172" role="img" aria-label={label}>
      <rect className="cv-ground" x="0" y="150" width="480" height="22" />
      <rect className="cv-wall" x="256" y="62" width="224" height="88" />
      <line className="cv-track" x1="20" y1="148" x2="480" y2="148" />
      {/* gate */}
      <g className="cv-panel">
        <rect x={left} y="40" width={width} height="94" rx="2" />
        {bars.map((x) => (
          <line key={x} x1={x} y1="44" x2={x} y2="130" />
        ))}
        <rect className="cv-rack" x={left} y="134" width={width} height="5" />
        {magnets.map((m) => (
          <rect
            key={m.cls}
            className={`cv-magnet ${m.cls}`}
            x={m.x - 4}
            y="128"
            width="8"
            height="6"
          />
        ))}
        <circle className="cv-wheel" cx={left + 20} cy="143" r="5" />
        <circle className="cv-wheel" cx={left + width - 20} cy="143" r="5" />
      </g>
      {/* posts */}
      <rect className="cv-post" x="24" y="26" width="16" height="124" />
      <rect className="cv-post" x="240" y="26" width="16" height="124" />
      {/* motor, pinion and reed */}
      <g className={`cv-motor${snap.zumbindo ? ' is-humming' : ''}`}>
        <rect x="246" y="139" width="44" height="22" rx="3" />
        <g transform={`rotate(${angle.toFixed(1)} 258 139)`}>
          <circle className="cv-pinion" cx="258" cy="139" r="7" />
          <line className="cv-pinion-mark" x1="258" y1="139" x2="258" y2="133" />
        </g>
        <rect
          className={`cv-reed${snap.leds.fca || snap.leds.fcf ? ' is-on' : ''}`}
          x={reedX - 5}
          y="136"
          width="10"
          height="3"
        />
      </g>
      {/* photocell and beam */}
      <rect className="cv-photo" x="40" y="104" width="7" height="10" />
      <rect className="cv-photo" x="233" y="104" width="7" height="10" />
      <line
        className={`cv-beam${beamBlocked ? ' is-blocked' : ''}`}
        x1="47"
        y1="109"
        x2={beamBlocked ? 160 : 233}
        y2="109"
      />
      {beamBlocked && (
        <g className="cv-person">
          <circle cx="170" cy="82" r="7" />
          <path d="M170 89v32M170 98l-11 10M170 98l11 10M170 121l-8 27M170 121l8 27" />
        </g>
      )}
      {obstacle && (
        <rect
          className="cv-obstacle"
          x={40 + OBSTACLE_AT * 50 - 34}
          y="114"
          width="34"
          height="34"
          rx="3"
        />
      )}
    </svg>
  );
}
