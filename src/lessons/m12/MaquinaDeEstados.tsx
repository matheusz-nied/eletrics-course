/*
 * Lesson 12.2: the state machine of the gate central, live. The real
 * firmware of module 16 (m16/central-generica) runs against the gate model;
 * the diagram lights the current state and the arrow of the last
 * transition, and the panel below shows what the program reads and decides
 * at each step. Used as `<MaquinaDeEstados client:visible />`.
 */
import { useCallback, useId, useState, useSyncExternalStore } from 'react';
import { formatNumber } from '../m00/formato';
import { OBSTACLE_AT } from '../m16/ui/central-controller';
import {
  MaquinaController,
  PAUSA_AULA,
  type Cenario,
  type MaquinaSnapshot,
} from './maquina-controller';
import {
  ESTADOS,
  SUBTITULO,
  TRANSICOES,
  textoRegistro,
  transicao,
  type Estado,
} from './maquina-estados';
import { ESTREITO, LARGO, caminho, type Layout } from './maquina-layout';
import { useEstreito, useVisivel } from './use-estreito';
import '../m00/widget.css';
import './maquina-estados.css';

export interface MaquinaDeEstadosProps {
  titulo?: string;
  /** Simulated seconds per real second (default 2). */
  velocidade?: number;
}

const VELOCIDADES = [1, 2, 5, 10];
/** How long the arrow of the last transition stays animated (simulated s). */
const DESTAQUE = 2.5;

const pct = (x: number) => `${formatNumber(Math.round(Math.min(1, Math.max(0, x)) * 100), 0)} %`;
const seg1 = (s: number) =>
  s.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function MaquinaDeEstados({
  titulo = 'A máquina de estados da central',
  velocidade = 2,
}: MaquinaDeEstadosProps) {
  const [ctl] = useState(() => new MaquinaController({ speed: velocidade }));
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot, ctl.getSnapshot);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [figura, setFigura] = useState<HTMLDivElement | null>(null);
  const estreito = useEstreito(figura, 560);
  const onVisible = useCallback((v: boolean) => ctl.setVisible(v), [ctl]);
  useVisivel(root, onVisible);
  const id = useId();

  const c = snap.central;
  const estado = c.estado;
  const t = c.t;

  return (
    <section
      ref={setRoot}
      className="lw med breakout"
      data-estado={estado}
      aria-labelledby={`${id}-titulo`}
    >
      <header className="lw__head">
        <p className="lw__kicker">Veja por dentro</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          {titulo}
        </h3>
        <p className="lw__lead">
          O programa da central de portão do módulo 16, rodando de verdade. A cada passo ele olha o
          estado atual e as entradas, e decide o próximo estado e as saídas. Aperte o controle e
          acompanhe as setas.
        </p>
      </header>

      <div className="lw__body">
        <div className="med__bar">
          <p className="med__now" aria-live="polite" aria-atomic="true">
            <span className="med__now-label">Estado atual</span>{' '}
            <strong className={`med__pill med__pill--${estado.toLowerCase() || 'off'}`}>
              {estado || 'DESLIGADA'}
            </strong>
          </p>
          <p className="med__clock num" aria-hidden="true">
            t = {seg1(t)} s
          </p>
          <div className="med__sim" role="group" aria-label="Simulação">
            <button type="button" className="lw__btn" onClick={() => ctl.setPlaying(!c.playing)}>
              {c.playing ? 'Pausar' : 'Continuar'}
            </button>
            <button type="button" className="lw__btn" onClick={() => ctl.reset()}>
              Reiniciar
            </button>
            <label className="med__select">
              <span>Velocidade</span>
              <select value={c.speed} onChange={(e) => ctl.setSpeed(Number(e.target.value))}>
                {VELOCIDADES.map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div ref={setFigura} className="med__figure">
          <Diagrama snap={snap} layout={estreito ? ESTREITO : LARGO} uid={id} />
        </div>

        <GateStrip snap={snap} />

        <div className="med__controls">
          <div className="med__actions" role="group" aria-label="Comandos">
            <button type="button" className="lw__btn lw__btn--primary" onClick={() => ctl.remote()}>
              Apertar o controle
            </button>
            <button type="button" className="lw__btn" onClick={() => ctl.pressBotoeira()}>
              Apertar a botoeira
            </button>
            <button
              type="button"
              className="lw__btn med__toggle"
              aria-pressed={c.env.feixeInterrompido}
              onClick={() => ctl.setBeam(!c.env.feixeInterrompido)}
            >
              Interromper a fotocélula
            </button>
            <button
              type="button"
              className="lw__btn med__toggle"
              aria-pressed={c.env.obstaculo !== null}
              onClick={() => ctl.setObstacle(c.env.obstaculo === null)}
            >
              Colocar obstáculo
            </button>
          </div>
          <div className="med__settings">
            <label className="lw__check">
              <input
                type="checkbox"
                checked={c.settings.j2}
                onChange={(e) => ctl.setAutoClose(e.target.checked)}
              />
              <span>
                Fechamento automático{' '}
                <span className="med__muted">(J2, pausa de {PAUSA_AULA} s)</span>
              </span>
            </label>
            <label className="med__select">
              <span>Situação</span>
              <select
                value={snap.cenario}
                onChange={(e) => ctl.setCenario(e.target.value as Cenario)}
              >
                <option value="normal">Portão normal</option>
                <option value="destravado">Destravado: o motor gira em falso</option>
              </select>
            </label>
          </div>
          {snap.cenario === 'destravado' && (
            <p className="lw__note">
              Com o destravamento manual aberto, o motor gira mas o portão não anda, e nenhum fim de
              curso chega. Abra e espere: depois de 40 s a central desiste e vai para ERRO.
            </p>
          )}
        </div>

        <Painel snap={snap} />

        <div className="med__log">
          <p className="lw__legend" id={`${id}-registro`}>
            Registro
          </p>
          <ol aria-labelledby={`${id}-registro`}>
            {snap.registros.length === 0 && (
              <li className="med__log-empty">Nenhuma mudança de estado ainda.</li>
            )}
            {snap.registros.map((r, i) => (
              <li
                key={`${r.t}-${r.de}-${r.para}-${i}`}
                className={r.recusado ? 'is-recusado' : undefined}
              >
                {textoRegistro(r)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* The diagram */

function Diagrama({ snap, layout, uid }: { snap: MaquinaSnapshot; layout: Layout; uid: string }) {
  const c = snap.central;
  const atual = c.estado;
  const ultima = snap.registros.find((r) => !r.recusado);
  const idUltima = ultima ? transicao(ultima.de, ultima.para)?.id : undefined;
  const recente = ultima !== undefined && c.t - ultima.t < DESTAQUE;
  const mk = uid.replace(/[^a-zA-Z0-9_-]/g, '');
  const { largura: w, altura: h } = layout.no;
  const desc = `Diagrama de estados da central. Estado atual: ${atual || 'desligada'}.${
    ultima ? ` Última transição: ${ultima.de} para ${ultima.para}.` : ''
  }`;

  return (
    <svg
      className={`med-diagram${layout === ESTREITO ? ' med-diagram--estreito' : ''}`}
      viewBox={`0 0 ${layout.largura} ${layout.altura}`}
      role="img"
      aria-label={desc}
    >
      <defs>
        {(['base', 'saida', 'ultima'] as const).map((k) => (
          <marker
            key={k}
            id={`${mk}-ponta-${k}`}
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0.5 L10 5 L0 9.5 z" className={`med-ponta med-ponta--${k}`} />
          </marker>
        ))}
      </defs>

      {layout.setas.map((s) => {
        const tr = TRANSICOES.find((x) => x.id === s.id);
        const saida = tr?.de === atual;
        const isUltima = s.id === idUltima;
        const k = isUltima ? 'ultima' : saida ? 'saida' : 'base';
        return (
          <g
            key={s.id}
            className={`med-seta med-seta--${k}${isUltima && recente ? ' is-recente' : ''}`}
            data-transicao={s.id}
          >
            <path d={caminho(s)} markerEnd={`url(#${mk}-ponta-${k})`} />
            {isUltima && recente && <path className="med-seta__pulso" d={caminho(s)} />}
            <text x={s.rotulo.x} y={s.rotulo.y - ((s.linhas.length - 1) * 15) / 2 + 4.5}>
              {s.linhas.map((l, i) => (
                <tspan key={i} x={s.rotulo.x} dy={i === 0 ? 0 : 15}>
                  {l}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}

      {ESTADOS.map((e) => {
        const pos = layout.estados[e];
        const on = e === atual;
        const sub = subtitulo(e, snap);
        const contagem =
          on && e === 'ABERTO' && c.fechamentoAutomatico ? c.pausaRestante / PAUSA_AULA : null;
        return (
          <g
            key={e}
            className={`med-no med-no--${e.toLowerCase()}${on ? ' is-atual' : ''}`}
            data-no={e}
          >
            <rect x={pos.x - w / 2} y={pos.y - h / 2} width={w} height={h} rx="12" />
            <text className="med-no__nome" x={pos.x} y={pos.y - 4}>
              {e}
            </text>
            <text className="med-no__sub" x={pos.x} y={pos.y + 15}>
              {on ? sub : SUBTITULO[e]}
            </text>
            {contagem !== null && (
              <rect
                className="med-no__barra"
                x={pos.x - w / 2 + 10}
                y={pos.y + h / 2 - 7}
                width={Math.max(0, (w - 20) * Math.min(1, contagem))}
                height="3"
                rx="1.5"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function subtitulo(e: Estado, snap: MaquinaSnapshot): string {
  const c = snap.central;
  if (e === 'ABERTO' && c.fechamentoAutomatico)
    return `fecha em ${formatNumber(Math.ceil(c.pausaRestante), 0)} s`;
  if (e === 'ABERTO') return 'espera um comando';
  if (e === 'ABRINDO' || e === 'FECHANDO')
    return `${formatNumber(Math.floor(c.tempoPercurso), 0)} s de 40 s`;
  if (e === 'ERRO') return 'aperte o controle';
  return SUBTITULO[e];
}

/* The gate, seen from above */

/** Top view: 200 units of opening (closing post at x = 30, motor post at 230). */
function GateStrip({ snap }: { snap: MaquinaSnapshot }) {
  const c = snap.central;
  const a = Math.min(1, Math.max(0, c.abertura));
  const left = 30 + a * 200;
  const blocked = c.env.feixeInterrompido;
  const obstacle = c.env.obstaculo !== null;
  const obstacleX = 30 + (OBSTACLE_AT / 3.98) * 200;
  const reedOn = c.leds.fca || c.leds.fcf;
  const label = `Portão ${pct(a)} aberto.${blocked ? ' Há uma pessoa no feixe da fotocélula.' : ''}${
    obstacle ? ' Há um obstáculo na passagem.' : ''
  }`;
  return (
    <figure className="med-strip">
      <svg viewBox="0 0 470 96" role="img" aria-label={label}>
        <rect className="med-strip__wall" x="236" y="14" width="234" height="8" />
        <rect className="med-strip__post" x="18" y="8" width="12" height="62" rx="2" />
        <rect className="med-strip__post" x="230" y="8" width="12" height="62" rx="2" />
        <line className="med-strip__track" x1="30" y1="34" x2="470" y2="34" />
        <g className="med-strip__leaf">
          <rect x={left} y="28" width="225" height="12" rx="2" />
          <rect
            className="med-strip__magnet med-strip__magnet--fca"
            x={left + 11}
            y="40"
            width="8"
            height="6"
          />
          <rect
            className="med-strip__magnet med-strip__magnet--fcf"
            x={left + 211}
            y="40"
            width="8"
            height="6"
          />
        </g>
        <rect className="med-strip__motor" x="236" y="46" width="30" height="20" rx="3" />
        <rect
          className={`med-strip__reed${reedOn ? ' is-on' : ''}`}
          x="241"
          y="45"
          width="10"
          height="4"
        />
        <rect className="med-strip__photo" x="30" y="62" width="6" height="10" />
        <rect className="med-strip__photo" x="224" y="62" width="6" height="10" />
        <line
          className={`med-strip__beam${blocked ? ' is-blocked' : ''}`}
          x1="36"
          y1="67"
          x2={blocked ? 136 : 224}
          y2="67"
        />
        {blocked && <circle className="med-strip__person" cx="146" cy="67" r="9" />}
        {obstacle && (
          <rect
            className="med-strip__obstacle"
            x={obstacleX - 26}
            y="24"
            width="24"
            height="20"
            rx="3"
          />
        )}
        <text className="med-strip__text" x="30" y="90">
          fechado
        </text>
        <text className="med-strip__text" x="236" y="90" textAnchor="middle">
          motor
        </text>
        <text className="med-strip__text" x="462" y="90" textAnchor="end">
          {pct(a)} aberto
        </text>
      </svg>
      <figcaption className="med-strip__legend">
        <span>
          <i className="med-key med-key--fca" aria-hidden="true" /> ímã FCA
        </span>
        <span>
          <i className="med-key med-key--fcf" aria-hidden="true" /> ímã FCF
        </span>
        <span>
          <i className="med-key med-key--reed" aria-hidden="true" /> reed (no motor)
        </span>
        <span>
          <i className="med-key med-key--beam" aria-hidden="true" /> feixe da fotocélula
        </span>
      </figcaption>
    </figure>
  );
}

/* Inputs → program → outputs */

function Painel({ snap }: { snap: MaquinaSnapshot }) {
  const c = snap.central;
  const entradas: { nome: string; valor: string; on: boolean; alerta?: boolean }[] = [
    { nome: 'FCA', valor: c.leds.fca ? 'ativo' : 'inativo', on: c.leds.fca },
    { nome: 'FCF', valor: c.leds.fcf ? 'ativo' : 'inativo', on: c.leds.fcf },
    { nome: 'Botoeira', valor: snap.botoeira ? 'apertada' : 'solta', on: snap.botoeira },
    { nome: 'Controle', valor: snap.controle ? 'sinal recebido' : 'sem sinal', on: snap.controle },
    {
      nome: 'Fotocélula',
      valor: c.leds.foto ? 'feixe livre' : 'interrompida',
      on: c.leds.foto,
      alerta: !c.leds.foto,
    },
    {
      nome: 'Corrente',
      valor: `${formatNumber(c.corrente, 1)} A`,
      on: c.corrente > 0.05,
    },
    { nome: 'J2', valor: c.settings.j2 ? 'colocado' : 'retirado', on: c.settings.j2 },
  ];
  const saidas = [
    { nome: 'K1 (abrir)', valor: c.k1 ? 'ligado' : 'desligado', on: c.k1 },
    { nome: 'K2 (fechar)', valor: c.k2 ? 'ligado' : 'desligado', on: c.k2 },
    { nome: 'TRIAC', valor: c.triac > 0 ? `conduz ${pct(c.triac)}` : 'desligado', on: c.triac > 0 },
  ];
  return (
    <div className="med-io">
      <div className="med-io__col">
        <p className="lw__legend">Entradas que o programa lê</p>
        <ul>
          {entradas.map((e) => (
            <Chip key={e.nome} {...e} />
          ))}
        </ul>
      </div>
      <div className="med-io__mid" aria-hidden="true">
        <span className="med-io__arrow">→</span>
        <span className="med-io__brain">
          estado <strong>{c.estado || '—'}</strong>
          <small>decide a cada 10 ms</small>
        </span>
        <span className="med-io__arrow">→</span>
      </div>
      <div className="med-io__col">
        <p className="lw__legend">Saídas que ele decide</p>
        <ul>
          {saidas.map((e) => (
            <Chip key={e.nome} {...e} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function Chip({
  nome,
  valor,
  on,
  alerta,
}: {
  nome: string;
  valor: string;
  on: boolean;
  alerta?: boolean;
}) {
  return (
    <li className={`med-chip${on ? ' is-on' : ''}${alerta ? ' is-alerta' : ''}`}>
      <span className="med-chip__dot" aria-hidden="true" />
      <span className="med-chip__nome">{nome}</span>
      <span className="med-chip__valor num">{valor}</span>
    </li>
  );
}
