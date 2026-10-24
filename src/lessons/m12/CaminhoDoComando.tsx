/*
 * Lesson 12.6: "acender a luz pelo celular". The command leaves the phone
 * app, goes through the router and, depending on the mode, through the
 * maker's cloud or a local server, until it reaches the ESP32 smart relay in
 * the wall box. Toggles break links; a packet runs along the path (in slow
 * motion) and the panel explains why the lamp did or did not change. Logic
 * in caminho.ts. Used as `<CaminhoDoComando client:visible />`.
 */
import { useEffect, useId, useState } from 'react';
import { formatNumber } from '../m00/formato';
import {
  CASA_INICIAL,
  CONDICOES_INICIAIS,
  aplicarComando,
  cortarEnergia,
  enviar,
  explicarRetorno,
  falhaDoTrecho,
  voltarEnergia,
  type Casa,
  type Condicoes,
  type Meio,
  type Modo,
  type No,
  type Resultado,
  type Retorno,
} from './caminho';
import { useEstreito } from './use-estreito';
import '../m00/widget.css';
import './caminho-do-comando.css';

export interface CaminhoDoComandoProps {
  titulo?: string;
}

/** Slow motion: each hop of the animation lasts this long (ms). */
const MS_POR_TRECHO = 420;

interface Ponto {
  x: number;
  y: number;
}

interface Desenho {
  largura: number;
  altura: number;
  no: { w: number; h: number };
  casa: { x: number; y: number; w: number; h: number };
  pos: Record<Exclude<No, 'celular'>, Ponto> & { celularCasa: Ponto; celularFora: Ponto };
}

const LARGO: Desenho = {
  largura: 780,
  altura: 360,
  no: { w: 118, h: 44 },
  casa: { x: 8, y: 8, w: 512, h: 344 },
  pos: {
    celularCasa: { x: 82, y: 96 },
    celularFora: { x: 700, y: 296 },
    roteador: { x: 250, y: 96 },
    servidor: { x: 250, y: 262 },
    rele: { x: 430, y: 186 },
    lampada: { x: 430, y: 56 },
    interruptor: { x: 430, y: 306 },
    internet: { x: 620, y: 140 },
    nuvem: { x: 700, y: 50 },
  },
};

const ESTREITO: Desenho = {
  largura: 380,
  altura: 600,
  no: { w: 116, h: 42 },
  casa: { x: 6, y: 172, w: 368, h: 420 },
  pos: {
    celularCasa: { x: 290, y: 236 },
    celularFora: { x: 300, y: 122 },
    roteador: { x: 86, y: 236 },
    servidor: { x: 86, y: 420 },
    rele: { x: 290, y: 440 },
    lampada: { x: 290, y: 330 },
    interruptor: { x: 290, y: 548 },
    internet: { x: 200, y: 50 },
    nuvem: { x: 70, y: 122 },
  },
};

const NOMES: Record<No, [string, string]> = {
  celular: ['Celular', 'app'],
  roteador: ['Roteador', 'Wi-Fi'],
  internet: ['Internet', ''],
  nuvem: ['Nuvem', 'do fabricante'],
  servidor: ['Servidor local', 'ex.: Home Assistant'],
  rele: ['Relé inteligente', 'ESP32 na caixa 4×2'],
  lampada: ['Lâmpada', ''],
  interruptor: ['Interruptor', 'ligado ao relé'],
};

interface Envio {
  resultado: Resultado;
  pedido: boolean;
  inicio: number;
}

const segundos = (ms: number) => `${formatNumber(ms / 1000, 2)} s`;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export default function CaminhoDoComando({
  titulo = 'O caminho do comando',
}: CaminhoDoComandoProps) {
  const id = useId();
  const [cond, setCond] = useState<Condicoes>(CONDICOES_INICIAIS);
  const [retorno, setRetorno] = useState<Retorno>('anterior');
  const [casa, setCasa] = useState<Casa>(CASA_INICIAL);
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [ultimo, setUltimo] = useState<Resultado | null>(null);
  const [aviso, setAviso] = useState<string>(
    'Escolha um comando: pelo app ou pelo interruptor da parede.',
  );
  const [figura, setFigura] = useState<HTMLDivElement | null>(null);
  const estreito = useEstreito(figura, 560);
  const d = estreito ? ESTREITO : LARGO;

  useEffect(() => {
    if (!envio) return;
    const r = envio.resultado;
    const trechos = r.chegou ? r.caminho.length : r.paradaEm! + 0.5;
    const total = trechos * MS_POR_TRECHO;
    let raf = requestAnimationFrame(function tick(now) {
      // The first frame time can be a little before the click.
      const p = Math.min(1, Math.max(0, (now - envio.inicio) / total));
      setProgresso(p * trechos);
      if (p >= 1) {
        setCasa((c) => aplicarComando(c, r, envio.pedido));
        setUltimo(r);
        setAviso(r.explicacao);
        setEnvio(null);
      } else raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [envio]);

  const mandar = (origem: 'app' | 'interruptor') => {
    const resultado = enviar(origem, cond);
    const e: Envio = { resultado, pedido: !casa.lampada, inicio: performance.now() };
    if (prefersReducedMotion()) {
      setCasa((c) => aplicarComando(c, resultado, e.pedido));
      setUltimo(resultado);
      setAviso(resultado.explicacao);
      setEnvio(null);
      return;
    }
    setProgresso(0);
    setUltimo(null);
    setAviso(origem === 'app' ? 'Enviando o comando pelo app…' : 'Interruptor apertado…');
    setEnvio(e);
  };

  const mudar = (patch: Partial<Condicoes>) => {
    setEnvio(null);
    setUltimo(null);
    const next = { ...cond, ...patch };
    if (patch.faltaEnergia !== undefined && patch.faltaEnergia !== cond.faltaEnergia) {
      if (patch.faltaEnergia) {
        setCasa((c) => cortarEnergia(c));
        setAviso('Faltou energia: o roteador, o relé e a lâmpada se apagaram.');
      } else {
        const volta = voltarEnergia(casa, retorno);
        setCasa(volta);
        setAviso(explicarRetorno(volta, retorno));
      }
    }
    setCond(next);
  };

  const acesa = casa.lampada;
  const r = envio?.resultado ?? ultimo;

  return (
    <section
      className="lw caminho breakout"
      data-lampada={acesa ? 'acesa' : 'apagada'}
      aria-labelledby={`${id}-titulo`}
    >
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          {titulo}
        </h3>
        <p className="lw__lead">
          Acender a luz pelo celular parece instantâneo, mas o comando faz uma viagem. Escolha o
          modo, quebre uma ligação e veja o que ainda funciona.
        </p>
      </header>

      <div className="lw__body">
        <div className="caminho__controls">
          <label className="lw__field">
            <span>Modo</span>
            <select value={cond.modo} onChange={(e) => mudar({ modo: e.target.value as Modo })}>
              <option value="nuvem">Pela nuvem (app do fabricante)</option>
              <option value="local">Na rede local (sem nuvem, ex.: Home Assistant)</option>
            </select>
          </label>
          <fieldset className="lw__group">
            <legend className="lw__legend">O que deu errado</legend>
            <div className="caminho__toggles">
              <Toggle
                label="Internet caiu"
                on={cond.internetCaiu}
                set={(v) => mudar({ internetCaiu: v })}
              />
              <Toggle
                label="Wi-Fi desligado"
                on={cond.wifiDesligado}
                set={(v) => mudar({ wifiDesligado: v })}
              />
              <Toggle
                label="Falta de energia"
                on={cond.faltaEnergia}
                set={(v) => mudar({ faltaEnergia: v })}
              />
              <Toggle
                label="Celular fora de casa"
                on={cond.foraDeCasa}
                set={(v) => mudar({ foraDeCasa: v })}
              />
            </div>
          </fieldset>
          <label className="lw__field">
            <span>Quando a energia volta, o relé…</span>
            <select value={retorno} onChange={(e) => setRetorno(e.target.value as Retorno)}>
              <option value="anterior">volta como estava</option>
              <option value="desligado">volta desligado</option>
            </select>
          </label>
        </div>

        <div className="caminho__actions">
          <button type="button" className="lw__btn lw__btn--primary" onClick={() => mandar('app')}>
            {acesa ? 'Apagar pelo app' : 'Acender pelo app'}
          </button>
          <button type="button" className="lw__btn" onClick={() => mandar('interruptor')}>
            Apertar o interruptor
          </button>
        </div>

        <div ref={setFigura} className="caminho__figure">
          <Mapa
            d={d}
            cond={cond}
            acesa={acesa}
            envio={envio}
            progresso={progresso}
            ultimo={ultimo}
          />
          <ul className="caminho__legend" aria-hidden="true">
            <li>
              <i className="caminho-key caminho-key--wifi" /> sem fio (Wi-Fi, dados)
            </li>
            <li>
              <i className="caminho-key caminho-key--fio" /> cabo ou fio
            </li>
            <li>
              <i className="caminho-key caminho-key--off" /> ligação quebrada
            </li>
          </ul>
        </div>

        <div
          className={`lw__status caminho__status ${
            envio ? '' : r ? (r.chegou ? 'lw__status--ok' : 'lw__status--danger') : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="lw__status-dot" aria-hidden="true" />
          <div>
            <p>
              <strong data-resultado="">
                {envio
                  ? 'Comando a caminho…'
                  : r
                    ? r.chegou
                      ? `Chegou: lâmpada ${acesa ? 'acesa' : 'apagada'}`
                      : `Não chegou: lâmpada continua ${acesa ? 'acesa' : 'apagada'}`
                    : `Lâmpada ${acesa ? 'acesa' : 'apagada'}`}
              </strong>
              {!envio && r?.chegou && (
                <span className="caminho__lat num"> · cerca de {segundos(r.latenciaMs)}</span>
              )}
            </p>
            <p className="lw__note">{aviso}</p>
          </div>
        </div>
        <p className="lw__note">
          Tempos típicos: na rede local, de 50 a 200 ms; pela nuvem, de 0,3 a 1,5 s, conforme a
          internet e o servidor. A animação é bem mais lenta que a realidade.
        </p>
      </div>
    </section>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="lw__check caminho__toggle">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

interface Ligacao {
  de: No;
  para: No;
  meio: Meio;
}

function ligacoes(c: Condicoes): Ligacao[] {
  const out: Ligacao[] = [
    { de: 'roteador', para: 'internet', meio: 'internet' },
    { de: 'internet', para: 'nuvem', meio: 'internet' },
    { de: 'roteador', para: 'rele', meio: 'wifi' },
    { de: 'rele', para: 'lampada', meio: 'fio' },
    { de: 'interruptor', para: 'rele', meio: 'fio' },
  ];
  if (c.modo === 'local') out.push({ de: 'roteador', para: 'servidor', meio: 'cabo' });
  if (!c.foraDeCasa) out.push({ de: 'celular', para: 'roteador', meio: 'wifi' });
  if (c.foraDeCasa || (c.modo === 'nuvem' && c.wifiDesligado))
    out.push({ de: 'celular', para: 'internet', meio: 'dados' });
  return out;
}

function Mapa({
  d,
  cond,
  acesa,
  envio,
  progresso,
  ultimo,
}: {
  d: Desenho;
  cond: Condicoes;
  acesa: boolean;
  envio: Envio | null;
  progresso: number;
  ultimo: Resultado | null;
}) {
  const pos = (n: No): Ponto =>
    n === 'celular' ? (cond.foraDeCasa ? d.pos.celularFora : d.pos.celularCasa) : d.pos[n];
  const semEnergia = cond.faltaEnergia;
  const apagados = new Set<No>(semEnergia ? ['roteador', 'servidor', 'rele', 'lampada'] : []);
  const visiveis: No[] = [
    'celular',
    'roteador',
    'internet',
    'nuvem',
    'rele',
    'lampada',
    'interruptor',
  ];
  if (cond.modo === 'local') visiveis.push('servidor');

  // The packet.
  const r = envio?.resultado ?? ultimo;
  let pacote: Ponto | null = null;
  let parada: Ponto | null = null;
  const ativos = new Set<number>();
  if (r) {
    const k = envio ? Math.max(0, Math.min(Math.floor(progresso), r.caminho.length - 1)) : -1;
    if (envio) {
      const tr = r.caminho[k]!;
      const f = progresso - k;
      const a = pos(tr.de);
      const b = pos(tr.para);
      pacote = { x: a.x + (b.x - a.x) * Math.min(f, 1), y: a.y + (b.y - a.y) * Math.min(f, 1) };
      for (let i = 0; i <= k; i++) ativos.add(i);
    } else if (!r.chegou && r.paradaEm !== null) {
      const tr = r.caminho[r.paradaEm]!;
      const a = pos(tr.de);
      const b = pos(tr.para);
      // A third of the way, so the mark does not sit on the wires of the middle column.
      parada = { x: a.x + (b.x - a.x) * 0.35, y: a.y + (b.y - a.y) * 0.35 };
    }
  }
  const usados = new Set(
    (r?.caminho ?? []).filter((_, i) => ativos.has(i)).map((t) => [t.de, t.para].sort().join('|')),
  );
  const desc = `Mapa do caminho do comando. Modo ${cond.modo === 'nuvem' ? 'pela nuvem' : 'na rede local'}. Lâmpada ${acesa ? 'acesa' : 'apagada'}.`;
  const { w, h } = d.no;

  return (
    <svg
      className="caminho-mapa"
      viewBox={`0 0 ${d.largura} ${d.altura}`}
      role="img"
      aria-label={desc}
    >
      <rect
        className="caminho-casa"
        x={d.casa.x}
        y={d.casa.y}
        width={d.casa.w}
        height={d.casa.h}
        rx="16"
      />
      <text className="caminho-casa__nome" x={d.casa.x + 12} y={d.casa.y + d.casa.h - 12}>
        Casa
      </text>
      {ligacoes(cond).map((l) => {
        const a = pos(l.de);
        const b = pos(l.para);
        const quebrada = falhaDoTrecho({ ...l, ms: 0 }, cond) !== null;
        const usada = usados.has([l.de, l.para].sort().join('|'));
        const sem = l.meio === 'wifi' || l.meio === 'dados';
        return (
          <g key={`${l.de}-${l.para}`}>
            <line
              className={`caminho-link${sem ? ' is-sem-fio' : ''}${quebrada ? ' is-quebrada' : ''}${usada ? ' is-usada' : ''}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            />
            {quebrada && !parada && (
              <text
                className="caminho-x"
                x={a.x + (b.x - a.x) * 0.3}
                y={a.y + (b.y - a.y) * 0.3 + 6}
              >
                ✕
              </text>
            )}
          </g>
        );
      })}
      {visiveis.map((n) => {
        const p = pos(n);
        const [nome, sub] = NOMES[n];
        const off = apagados.has(n);
        const isLamp = n === 'lampada';
        return (
          <g
            key={n}
            className={`caminho-no caminho-no--${n}${off ? ' is-off' : ''}${isLamp && acesa ? ' is-acesa' : ''}`}
          >
            {isLamp && acesa && <circle className="caminho-brilho" cx={p.x} cy={p.y} r={h} />}
            <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx="10" />
            <text className="caminho-no__nome" x={p.x} y={sub ? p.y - 2 : p.y + 5}>
              {isLamp ? `Lâmpada ${acesa ? 'acesa' : 'apagada'}` : nome}
            </text>
            {sub && (
              <text className="caminho-no__sub" x={p.x} y={p.y + 13}>
                {sub}
              </text>
            )}
          </g>
        );
      })}
      {pacote && <circle className="caminho-pacote" cx={pacote.x} cy={pacote.y} r="8" />}
      {parada && (
        <g className="caminho-parada">
          <circle cx={parada.x} cy={parada.y} r="13" />
          <text x={parada.x} y={parada.y + 5}>
            ✕
          </text>
        </g>
      )}
    </svg>
  );
}
