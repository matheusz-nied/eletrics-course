/*
 * Lesson 12.3: a sensor lab. One tab per sensor: a small scene, a control
 * for the physical quantity, what reaches the microcontroller pin (value
 * and a little level/timing plot) and the number the program computes.
 * Physics and typical values in sensores.ts. Used as
 * `<LaboratorioSensores client:visible />`.
 */
import {
  useCallback,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { NBSP, formatNumber } from '../m00/formato';
import { PIR_DT, PIR_JANELA, PirSim } from './pir-sim';
import {
  ACS712,
  AMOSTRAGEM,
  CARGAS,
  HCSR04,
  IR_VCC,
  LSB,
  PIR,
  PIR_CAMPO,
  PIR_TEMPOS,
  REDE_HZ,
  REDE_V,
  REFLETANCIA,
  SCT013,
  analisarCorrente,
  correnteInstantanea,
  infravermelho,
  luzRefletida,
  tensaoNoPino,
  ultrassom,
  zonaPir,
  type Cor,
  type PirModo,
  type Superficie,
  type TipoSensor,
} from './sensores';
import { useVisivel } from './use-estreito';
import '../m00/widget.css';
import './laboratorio-sensores.css';

export type SensorId = 'pir' | 'ultrassom' | 'infravermelho' | 'corrente';

export interface LaboratorioSensoresProps {
  titulo?: string;
  /** Tab open at first (default "pir"). */
  inicial?: SensorId;
}

const ABAS: { id: SensorId; nome: string }[] = [
  { id: 'pir', nome: 'Presença (PIR)' },
  { id: 'ultrassom', nome: 'Distância (ultrassom)' },
  { id: 'infravermelho', nome: 'Infravermelho (obstáculo)' },
  { id: 'corrente', nome: 'Corrente' },
];

const n = (v: number, d = 1) => formatNumber(v, d);
const fix = (v: number, d: number) =>
  v
    .toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
    .replace('-', '−');
const pct = (x: number) => `${formatNumber(Math.round(x * 100), 0)}${NBSP}%`;
const tempoTexto = (s: number) => (s >= 60 ? `${n(s / 60, 0)} min` : `${n(s, 0)} s`);

export default function LaboratorioSensores({
  titulo = 'O que o microcontrolador enxerga',
  inicial = 'pir',
}: LaboratorioSensoresProps) {
  const id = useId();
  const [aba, setAba] = useState<SensorId>(inicial);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % ABAS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + ABAS.length) % ABAS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ABAS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setAba(ABAS[next]!.id);
    tabs.current[next]?.focus();
  };

  return (
    <section className="lw labsens breakout" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Laboratório</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          {titulo}
        </h3>
        <p className="lw__lead">
          Mexa na grandeza física e veja o que chega ao pino do microcontrolador e o número que o
          programa calcula. Valores típicos dos módulos mais vendidos.
        </p>
      </header>

      <div className="labsens__tabs" role="tablist" aria-label="Sensores">
        {ABAS.map((a, i) => (
          <button
            key={a.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${a.id}`}
            aria-selected={aba === a.id}
            aria-controls={`${id}-painel`}
            tabIndex={aba === a.id ? 0 : -1}
            className="labsens__tab"
            onClick={() => setAba(a.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div
        className="lw__body labsens__panel"
        role="tabpanel"
        id={`${id}-painel`}
        aria-labelledby={`${id}-tab-${aba}`}
        data-sensor={aba}
        tabIndex={0}
      >
        {aba === 'pir' && <PainelPir uid={id} />}
        {aba === 'ultrassom' && <PainelUltrassom />}
        {aba === 'infravermelho' && <PainelInfravermelho uid={id} />}
        {aba === 'corrente' && <PainelCorrente />}
      </div>
    </section>
  );
}

/* Shared pieces */

function Leitura({
  nome,
  valor,
  chave,
  destaque,
}: {
  nome: string;
  valor: ReactNode;
  chave: string;
  destaque?: boolean;
}) {
  return (
    <div className={destaque ? 'is-destaque' : undefined}>
      <dt>{nome}</dt>
      <dd className="num" data-leitura={chave}>
        {valor}
      </dd>
    </div>
  );
}

function Programa({ children }: { children: ReactNode }) {
  return (
    <div className="labsens__code">
      <p className="lw__value-label">O que o programa faz</p>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Faixa({
  label,
  value,
  text,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  text: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="lw__range">
      <span className="lw__range-head">
        <span>{label}</span>
        <strong className="num">{text}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/* Presence (PIR) */

function PainelPir({ uid }: { uid: string }) {
  const [sim] = useState(() => new PirSim(5, 'H'));
  const s = useSyncExternalStore(sim.subscribe, sim.getSnapshot, sim.getSnapshot);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const onVisible = useCallback((v: boolean) => sim.setVisible(v), [sim]);
  useVisivel(root, onVisible);

  const alto = s.estado.saida;
  let situacao: string;
  if (alto) situacao = `fica em HIGH por mais ${fix(s.estado.restante, 1)} s`;
  else if (s.estado.bloqueio > 0)
    situacao = `bloqueado por mais ${fix(s.estado.bloqueio, 1)} s (ignora movimento)`;
  else situacao = 'esperando movimento';

  return (
    <div ref={setRoot} className="labsens__grid">
      <div className="labsens__scene">
        <PirScene x={s.x} detectando={alto} />
      </div>
      <div className="lw__controls">
        <Faixa
          label="Posição da pessoa"
          value={Math.round(s.x * 100)}
          text={pct(s.x)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => sim.setX(v / 100)}
        />
        <div className="labsens__row">
          <button type="button" className="lw__btn lw__btn--primary" onClick={() => sim.passar()}>
            Passar na frente
          </button>
        </div>
        <label className="lw__field">
          <span>Tempo (trimpot do módulo)</span>
          <select value={s.tempo} onChange={(e) => sim.setTempo(Number(e.target.value))}>
            {PIR_TEMPOS.map((t) => (
              <option key={t} value={t}>
                {tempoTexto(t)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="lw__group">
          <legend className="lw__legend">Jumper de modo</legend>
          <div className="lw__choices">
            {(
              [
                ['H', 'H: movimento renova o tempo'],
                ['L', 'L: não renova'],
              ] as [PirModo, string][]
            ).map(([m, label]) => (
              <label key={m} className="lw__choice">
                <input
                  type="radio"
                  name={`${uid}-modo`}
                  checked={s.modo === m}
                  onChange={() => sim.setModo(m)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="lw__output labsens__out">
        <dl className="labsens__readouts">
          <Leitura
            nome="Pino OUT"
            chave="saida"
            destaque
            valor={alto ? `HIGH (${n(PIR.saida)} V)` : 'LOW (0 V)'}
          />
          <Leitura nome="Módulo" chave="situacao" valor={situacao} />
        </dl>
        <PirPlot amostras={s.amostras} deteccoes={s.deteccoes} t={s.t} />
        <Programa>
          {`if (digitalRead(PIR) == HIGH) {   // agora: ${alto ? 'HIGH' : 'LOW'}
  acenderLuz();
}`}
        </Programa>
        <p className="lw__note">
          O PIR não “vê” a pessoa: ele percebe a <strong>mudança</strong> do calor (infravermelho)
          quando ela passa de uma zona da lente para outra. Quem fica parado na frente deixa de ser
          detectado, e o OUT volta a LOW depois do tempo do trimpot (típico: de cerca de 3 s a 5
          min). Depois disso o módulo fica cerca de 2,5 s sem aceitar movimento. A saída é de 3,3 V
          mesmo com o módulo alimentado em 5 V; o Arduino Uno entende isso como HIGH.
        </p>
      </div>
    </div>
  );
}

/** Top view: sensor at the bottom, lens zones fanning out, person walking along y = 64. */
function PirScene({ x, detectando }: { x: number; detectando: boolean }) {
  const sx = 180;
  const sy = 176;
  const line = 64;
  const px = 20 + x * 320;
  const zona = zonaPir(x);
  const bounds = Array.from(
    { length: PIR_CAMPO.zonas + 1 },
    (_, k) => 20 + (PIR_CAMPO.de + ((PIR_CAMPO.ate - PIR_CAMPO.de) * k) / PIR_CAMPO.zonas) * 320,
  );
  // Extend each ray from the sensor through the walking line up to y = 14.
  const far = (bx: number) => sx + ((bx - sx) * (sy - 14)) / (sy - line);
  return (
    <svg
      viewBox="0 0 360 196"
      role="img"
      aria-label={`Pessoa a ${pct(x)} da largura da sala, ${zona === null ? 'fora do campo do sensor' : `na zona ${zona + 1} da lente`}.`}
    >
      {bounds.slice(0, -1).map((b, k) => (
        <polygon
          key={k}
          className={`labsens-zone${k % 2 ? ' is-alt' : ''}${zona === k ? ' is-here' : ''}`}
          points={`${sx},${sy} ${far(b)},14 ${far(bounds[k + 1]!)},14`}
        />
      ))}
      <line className="labsens-walk" x1="12" y1={line} x2="348" y2={line} />
      <g className="labsens-person" transform={`translate(${px} ${line})`}>
        <circle r="11" />
        <circle className="labsens-person__head" r="5" />
      </g>
      <g className={`labsens-pir${detectando ? ' is-on' : ''}`}>
        <rect x={sx - 18} y={sy - 4} width="36" height="16" rx="2" />
        <path d={`M${sx - 12} ${sy - 4} a12 12 0 0 1 24 0`} />
      </g>
      <text className="labsens-label" x="12" y="190">
        lente de Fresnel: 8 zonas
      </text>
      <text className="labsens-label" x="348" y="190" textAnchor="end">
        {detectando ? 'OUT em HIGH' : 'OUT em LOW'}
      </text>
    </svg>
  );
}

function PirPlot({
  amostras,
  deteccoes,
  t,
}: {
  amostras: readonly boolean[];
  deteccoes: readonly number[];
  t: number;
}) {
  const W = 340;
  const x0 = 34;
  const hi = 14;
  const lo = 54;
  const dx = (W - x0 - 6) / amostras.length;
  let d = '';
  amostras.forEach((a, i) => {
    const y = a ? hi : lo;
    d += i === 0 ? `M${x0} ${y}` : `L${(x0 + i * dx).toFixed(1)} ${y}`;
    d += `L${(x0 + (i + 1) * dx).toFixed(1)} ${y}`;
  });
  const xt = (time: number) => x0 + ((time - (t - PIR_JANELA)) / PIR_DT) * dx;
  return (
    <figure className="labsens__plot">
      <svg
        viewBox={`0 0 ${W} 84`}
        role="img"
        aria-label="Nível do pino OUT nos últimos 20 segundos."
      >
        <text className="labsens-axis" x="2" y={hi + 4}>
          3,3 V
        </text>
        <text className="labsens-axis" x="2" y={lo + 4}>
          0 V
        </text>
        <line className="labsens-grid" x1={x0} y1={lo} x2={W - 6} y2={lo} />
        {deteccoes.map((dt) => (
          <line
            key={dt}
            className="labsens-tick"
            x1={xt(dt)}
            y1={lo + 4}
            x2={xt(dt)}
            y2={lo + 12}
          />
        ))}
        <path className="labsens-trace" d={d} />
        <text className="labsens-axis" x={x0} y="80">
          −20 s
        </text>
        <text className="labsens-axis" x={W - 6} y="80" textAnchor="end">
          agora
        </text>
        <text
          className="labsens-axis labsens-axis--tick"
          x={(x0 + W) / 2}
          y="80"
          textAnchor="middle"
        >
          ▲ mudança vista
        </text>
      </svg>
    </figure>
  );
}

/* Distance (ultrasound) */

function PainelUltrassom() {
  const [d, setD] = useState(100);
  const [temp, setTemp] = useState(20);
  const [sup, setSup] = useState<Superficie>('dura');
  const r = ultrassom(d, temp, sup);

  return (
    <div className="labsens__grid">
      <div className="labsens__scene">
        <UltrassomScene d={d} eco={r.eco} macia={sup === 'macia'} />
      </div>
      <div className="lw__controls">
        <Faixa
          label="Distância até o objeto"
          value={d}
          text={`${n(d, 0)} cm`}
          min={2}
          max={500}
          step={1}
          onChange={setD}
        />
        <Faixa
          label="Temperatura do ar"
          value={temp}
          text={`${n(temp, 0)} °C`}
          min={0}
          max={40}
          step={1}
          onChange={setTemp}
        />
        <label className="lw__field">
          <span>Superfície</span>
          <select value={sup} onChange={(e) => setSup(e.target.value as Superficie)}>
            <option value="dura">Parede ou objeto duro</option>
            <option value="macia">Tecido ou espuma (absorve o som)</option>
          </select>
        </label>
      </div>

      <div className="lw__output labsens__out">
        <dl className="labsens__readouts">
          <Leitura nome="Velocidade do som" chave="velocidade" valor={`${fix(r.v, 1)} m/s`} />
          <Leitura
            nome="Pulso no pino ECHO"
            chave="largura"
            destaque
            valor={r.eco ? `${n(r.larguraUs, 0)} µs` : 'sem eco'}
          />
          <Leitura
            nome="Distância calculada"
            chave="distancia-programa"
            destaque
            valor={r.dPrograma === null ? 'fora de alcance' : `${fix(r.dPrograma, 1)} cm`}
          />
          <Leitura
            nome="Erro"
            chave="erro"
            valor={r.erroCm === null ? '—' : `${r.erroCm >= 0 ? '+' : ''}${fix(r.erroCm, 1)} cm`}
          />
        </dl>
        <UltrassomPlot larguraUs={r.larguraUs} eco={r.eco} />
        <Programa>
          {r.eco
            ? `t = pulseIn(ECHO, HIGH);    // ${n(r.larguraUs, 0)} µs
d = t * 0.0343 / 2;         // ${fix(r.dPrograma ?? 0, 1)} cm`
            : `t = pulseIn(ECHO, HIGH);    // nada de eco
// o ECHO cai sozinho depois de cerca de 38 ms (típico):
// trate como “fora de alcance”`}
        </Programa>
        <p className="lw__note">
          O programa manda um pulso de 10 µs no TRIG; o módulo emite 8 ciclos de ultrassom a 40 kHz
          e deixa o ECHO em HIGH até o eco voltar. O som vai e volta, por isso a divisão por 2. A
          conta usa 343 m/s (ar a 20 °C), mas a velocidade real é cerca de 331,3 + 0,606 × T m/s: no
          frio o sensor mede a mais. Alcance típico de 2 cm a 4 m. O ECHO sai com 5 V: num ESP32
          (3,3 V), use um divisor de tensão.
        </p>
      </div>
    </div>
  );
}

function UltrassomScene({ d, eco, macia }: { d: number; eco: boolean; macia: boolean }) {
  const x = 56 + (Math.min(d, 500) / 500) * 280;
  const arcs = [0.25, 0.5, 0.75].map((f) => 52 + (x - 52) * f);
  return (
    <svg
      viewBox="0 0 360 150"
      role="img"
      aria-label={`Objeto a ${n(d, 0)} cm do sensor. ${eco ? 'O eco volta.' : 'O eco não volta.'}`}
    >
      <g className="labsens-hcsr04">
        <rect x="10" y="44" width="40" height="62" rx="4" />
        <circle cx="30" cy="60" r="11" />
        <circle cx="30" cy="90" r="11" />
      </g>
      {arcs.map((ax, i) => (
        <path
          key={i}
          className="labsens-wave"
          d={`M${ax} 50 Q${ax + 14} 75 ${ax} 100`}
          opacity={1 - i * 0.25}
        />
      ))}
      {eco &&
        arcs.map((ax, i) => (
          <path
            key={`e${i}`}
            className="labsens-wave labsens-wave--eco"
            d={`M${ax + 10} 58 Q${ax - 2} 75 ${ax + 10} 92`}
            opacity={0.35 + i * 0.2}
          />
        ))}
      <rect
        className={`labsens-wall${macia ? ' is-macia' : ''}${d > HCSR04.maximo * 100 ? ' is-longe' : ''}`}
        x={x}
        y="20"
        width="14"
        height="110"
        rx="2"
      />
      <line className="labsens-dim" x1="50" y1="140" x2={x} y2="140" />
      <text className="labsens-label" x={(50 + x) / 2} y="136" textAnchor="middle">
        {n(d, 0)} cm
      </text>
      <text className="labsens-label" x="10" y="36">
        emissor · receptor
      </text>
    </svg>
  );
}

function UltrassomPlot({ larguraUs, eco }: { larguraUs: number; eco: boolean }) {
  const W = 340;
  const x0 = 54;
  const burst = (HCSR04.ciclos / HCSR04.frequencia) * 1e6;
  const total = eco ? burst + larguraUs * 1.15 : burst + larguraUs * 1.05;
  const xt = (us: number) => x0 + (us / total) * (W - x0 - 6);
  const trigW = Math.max(2.5, xt(10) - x0);
  const ecoIni = xt(burst);
  const ecoFim = xt(burst + larguraUs);
  const row = (y: number) => ({ hi: y, lo: y + 16 });
  const tr = row(8);
  const bu = row(34);
  const ec = row(60);
  const wave = Array.from({ length: 16 }, (_, i) => {
    const xa = x0 + 6 + (i * 4) / 1;
    return `${i === 0 ? 'M' : 'L'}${xa.toFixed(1)} ${i % 2 ? bu.hi + 2 : bu.lo - 2}`;
  }).join(' ');
  return (
    <figure className="labsens__plot">
      <svg
        viewBox={`0 0 ${W} 112`}
        role="img"
        aria-label={
          eco
            ? `Pulso ECHO de ${n(larguraUs, 0)} microssegundos.`
            : 'Sem eco: o ECHO cai depois de cerca de 38 milissegundos.'
        }
      >
        <text className="labsens-axis" x="2" y={tr.lo}>
          TRIG
        </text>
        <text className="labsens-axis" x="2" y={bu.lo}>
          som
        </text>
        <text className="labsens-axis" x="2" y={ec.lo}>
          ECHO
        </text>
        <path
          className="labsens-trace"
          d={`M${x0} ${tr.lo} L${x0} ${tr.hi} L${x0 + trigW} ${tr.hi} L${x0 + trigW} ${tr.lo} L${W - 6} ${tr.lo}`}
        />
        <path className="labsens-trace labsens-trace--soft" d={wave} />
        {eco && (
          <path
            className="labsens-trace labsens-trace--soft"
            d={`M${ecoFim - 8} ${bu.lo - 3} L${ecoFim - 4} ${bu.hi + 3} L${ecoFim} ${bu.lo - 3} L${ecoFim + 4} ${bu.hi + 3}`}
          />
        )}
        <path
          className="labsens-trace labsens-trace--main"
          d={`M${x0} ${ec.lo} L${ecoIni} ${ec.lo} L${ecoIni} ${ec.hi} L${ecoFim} ${ec.hi} L${ecoFim} ${ec.lo} L${W - 6} ${ec.lo}`}
        />
        <line className="labsens-dim" x1={ecoIni} y1={ec.lo + 10} x2={ecoFim} y2={ec.lo + 10} />
        <text
          className="labsens-axis labsens-axis--strong"
          x={(ecoIni + ecoFim) / 2}
          y={ec.lo + 24}
          textAnchor="middle"
        >
          {eco ? `t = ${n(larguraUs, 0)} µs` : 'cerca de 38 ms sem eco'}
        </text>
        <text className="labsens-axis" x={x0 + trigW + 4} y={tr.hi + 10}>
          10 µs
        </text>
        <text className="labsens-axis" x={x0 + 74} y={bu.lo - 2}>
          8 ciclos a 40 kHz
        </text>
      </svg>
      <figcaption className="lw__note">Pulsos curtos fora de escala, para aparecerem.</figcaption>
    </figure>
  );
}

/* Obstacle (reflective infrared) */

const CORES: [Cor, string][] = [
  ['branco', 'Branco'],
  ['cinza', 'Cinza'],
  ['preto', 'Preto'],
];

function PainelInfravermelho({ uid }: { uid: string }) {
  const [d, setD] = useState(12);
  const [cor, setCor] = useState<Cor>('branco');
  const [sens, setSens] = useState(0.5);
  const [sol, setSol] = useState(false);
  const r = infravermelho(d, cor, sens, sol);

  return (
    <div className="labsens__grid">
      <div className="labsens__scene">
        <IrScene d={d} cor={cor} sol={sol} detecta={r.detecta} />
      </div>
      <div className="lw__controls">
        <Faixa
          label="Distância até a superfície"
          value={d}
          text={`${n(d, 0)} cm`}
          min={1}
          max={30}
          step={1}
          onChange={setD}
        />
        <fieldset className="lw__group">
          <legend className="lw__legend">Cor da superfície</legend>
          <div className="lw__choices">
            {CORES.map(([c, label]) => (
              <label key={c} className="lw__choice">
                <input
                  type="radio"
                  name={`${uid}-cor`}
                  checked={cor === c}
                  onChange={() => setCor(c)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <Faixa
          label="Sensibilidade (trimpot)"
          value={Math.round(sens * 100)}
          text={pct(sens)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => setSens(v / 100)}
        />
        <label className="lw__check">
          <input type="checkbox" checked={sol} onChange={(e) => setSol(e.target.checked)} />
          <span>Sol forte</span>
        </label>
      </div>

      <div className="lw__output labsens__out">
        <dl className="labsens__readouts">
          <Leitura nome="Luz refletida" chave="luz" valor={pct(r.luz)} />
          <Leitura nome="Limite do trimpot" chave="limite" valor={pct(r.limite)} />
          <Leitura
            nome="Pino OUT"
            chave="saida"
            destaque
            valor={r.detecta ? 'LOW (0 V): obstáculo' : `HIGH (${n(IR_VCC, 0)} V): livre`}
          />
          <Leitura nome="LED do módulo" chave="led" valor={r.detecta ? 'aceso' : 'apagado'} />
        </dl>
        <IrPlot d={d} cor={cor} sol={sol} limite={r.limite} />
        <Programa>
          {`if (digitalRead(IR) == LOW) {    // agora: ${r.detecta ? 'LOW' : 'HIGH'}
  obstaculo();                    // ativo em LOW
}`}
        </Programa>
        <p className="lw__note">
          O LED infravermelho ilumina a superfície e o fototransistor mede quanto volta. Um
          comparador (o LM393 do módulo) compara essa luz com o limite do trimpot e puxa o OUT para
          0 V quando passa dele. Superfície preta devolve pouca luz e só é vista bem de perto; o sol
          tem muito infravermelho e pode disparar o sensor sem obstáculo nenhum.
        </p>
      </div>
    </div>
  );
}

function IrScene({
  d,
  cor,
  sol,
  detecta,
}: {
  d: number;
  cor: Cor;
  sol: boolean;
  detecta: boolean;
}) {
  const x = 70 + (d / 30) * 250;
  return (
    <svg
      viewBox="0 0 360 150"
      role="img"
      aria-label={`Superfície ${cor} a ${n(d, 0)} cm do módulo.${sol ? ' Sol forte.' : ''} ${detecta ? 'O módulo detecta.' : 'O módulo não detecta.'}`}
    >
      <g className="labsens-irmod">
        <rect x="10" y="40" width="50" height="70" rx="4" />
        <circle className="labsens-irmod__tx" cx="52" cy="62" r="6" />
        <circle className="labsens-irmod__rx" cx="52" cy="88" r="6" />
        <circle className={`labsens-irmod__led${detecta ? ' is-on' : ''}`} cx="22" cy="100" r="4" />
      </g>
      <line className="labsens-ray" x1="58" y1="62" x2={x} y2="75" />
      <line
        className="labsens-ray labsens-ray--back"
        x1={x}
        y1="75"
        x2="58"
        y2="88"
        style={{ opacity: Math.max(0.12, luzRefletida(d, cor)) }}
      />
      <rect
        className={`labsens-surface labsens-surface--${cor}`}
        x={x}
        y="18"
        width="16"
        height="114"
        rx="2"
      />
      {sol && (
        <g className="labsens-sun">
          <circle cx="318" cy="28" r="12" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1={318 + Math.cos(a) * 16}
                y1={28 + Math.sin(a) * 16}
                x2={318 + Math.cos(a) * 22}
                y2={28 + Math.sin(a) * 22}
              />
            );
          })}
        </g>
      )}
      <text className="labsens-label" x="10" y="32">
        LED IR · receptor
      </text>
      <text className="labsens-label" x="10" y="128">
        LED do módulo
      </text>
    </svg>
  );
}

function IrPlot({ d, cor, sol, limite }: { d: number; cor: Cor; sol: boolean; limite: number }) {
  const W = 340;
  const H = 120;
  const x0 = 34;
  const top = 8;
  const bottom = 92;
  const xd = (cm: number) => x0 + ((cm - 1) / 29) * (W - x0 - 8);
  const yl = (l: number) => bottom - l * (bottom - top);
  const curve = (c: Cor) =>
    Array.from({ length: 59 }, (_, i) => {
      const cm = 1 + i * 0.5;
      return `${i === 0 ? 'M' : 'L'}${xd(cm).toFixed(1)} ${yl(luzRefletida(cm, c, sol)).toFixed(1)}`;
    }).join(' ');
  const luz = luzRefletida(d, cor, sol);
  return (
    <figure className="labsens__plot">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Luz refletida em função da distância. Agora: ${pct(luz)}, limite ${pct(limite)}.`}
      >
        <line className="labsens-grid" x1={x0} y1={bottom} x2={W - 8} y2={bottom} />
        <line className="labsens-grid" x1={x0} y1={top} x2={x0} y2={bottom} />
        {(Object.keys(REFLETANCIA) as Cor[])
          .filter((c) => c !== cor)
          .map((c) => (
            <path key={c} className="labsens-trace labsens-trace--faint" d={curve(c)} />
          ))}
        <path className="labsens-trace labsens-trace--main" d={curve(cor)} />
        <line className="labsens-limit" x1={x0} y1={yl(limite)} x2={W - 8} y2={yl(limite)} />
        <text
          className="labsens-axis labsens-axis--limit"
          x={W - 8}
          y={yl(limite) - 4}
          textAnchor="end"
        >
          limite
        </text>
        <circle className="labsens-point" cx={xd(d)} cy={yl(luz)} r="5" />
        <text className="labsens-axis" x="2" y={top + 6}>
          100 %
        </text>
        <text className="labsens-axis" x="2" y={bottom}>
          0
        </text>
        <text className="labsens-axis" x={x0} y={H - 10}>
          1 cm
        </text>
        <text className="labsens-axis" x={W - 8} y={H - 10} textAnchor="end">
          30 cm
        </text>
        <text className="labsens-axis" x={(x0 + W) / 2} y={H - 10} textAnchor="middle">
          distância
        </text>
      </svg>
      <figcaption className="lw__note">
        Curva da cor escolhida em destaque; as outras cores em cinza. Acima do limite, o OUT vai a
        LOW.
      </figcaption>
    </figure>
  );
}

/* Current */

function PainelCorrente() {
  const [tipo, setTipo] = useState<TipoSensor>('hall');
  const [carga, setCarga] = useState('ventilador');
  const c = CARGAS.find((x) => x.id === carga) ?? CARGAS[1]!;
  const r = analisarCorrente(tipo, c.watts);
  const abaixo = !r.foraDaFaixa && r.ipico < r.porPasso;
  const vpa = tipo === 'hall' ? '0.185' : '0.0165';

  return (
    <div className="labsens__grid">
      <div className="labsens__scene">
        <CorrenteScene tipo={tipo} />
      </div>
      <div className="lw__controls">
        <label className="lw__field">
          <span>Tipo de sensor</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoSensor)}>
            <option value="hall">Hall em série (ACS712, 5 A)</option>
            <option value="alicate">Alicate não invasivo (SCT-013, 100 A : 50 mA)</option>
          </select>
        </label>
        <label className="lw__field">
          <span>Carga ligada em {REDE_V} V</span>
          <select value={carga} onChange={(e) => setCarga(e.target.value)}>
            {CARGAS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <p className="lw__formula">
          I = P ÷ V = {n(c.watts, 0)} W ÷ {REDE_V} V = {fix(r.irms, r.irms < 1 ? 3 : 2)} A
        </p>
        {tipo === 'hall' ? (
          <p className="lw__note">
            ACS712 de 5 A (típico): 2,5 V com 0 A e 185 mV por ampère; mede até ±5 A. Há versões de
            20 A e 30 A, menos sensíveis.
          </p>
        ) : (
          <p className="lw__note">
            SCT-013 de 100 A : 50 mA: a corrente no secundário é 2.000 vezes menor e passa por um
            resistor de carga de {SCT013.carga} Ω; um divisor soma 2,5 V para o ADC ler o semiciclo
            negativo. Abrace só um fio (fase ou neutro): com os dois, as correntes se cancelam e a
            leitura dá zero.
          </p>
        )}
      </div>

      <div className="lw__output labsens__out">
        <dl className="labsens__readouts">
          <Leitura
            nome="Corrente real (RMS)"
            chave="corrente-real"
            valor={`${fix(r.irms, r.irms < 1 ? 3 : 2)} A`}
          />
          <Leitura
            nome="Tensão no pino"
            chave="tensao-pino"
            valor={`2,5 V ± ${r.vpico < 0.1 ? `${n(r.vpico * 1000, 1)} mV` : `${fix(r.vpico, 2)} V`}`}
          />
          <Leitura nome="Leituras do ADC" chave="adc" valor={`${r.min} a ${r.max}`} />
          <Leitura
            nome="Corrente calculada (RMS)"
            chave="corrente-rms"
            destaque
            valor={
              r.foraDaFaixa
                ? 'não vale (fora da faixa)'
                : `${fix(r.rmsPrograma, r.rmsPrograma < 1 ? 3 : 2)} A`
            }
          />
        </dl>
        <CorrentePlot tipo={tipo} irms={r.irms} />
        {r.foraDaFaixa && (
          <p className="lw__status lw__status--danger" role="status">
            <span className="lw__status-dot" aria-hidden="true" />
            <span>
              A corrente de pico ({fix(r.ipico, 1)} A) passa da faixa do ACS712 de 5 A: a leitura
              não vale e o sensor está sendo usado acima do que foi feito para conduzir. Escolha uma
              versão maior ou o alicate.
            </span>
          </p>
        )}
        {abaixo && (
          <p className="lw__status lw__status--warn" role="status">
            <span className="lw__status-dot" aria-hidden="true" />
            <span>
              O sinal é menor que um passo do ADC ({n(LSB * 1000, 1)} mV ≈ {fix(r.porPasso, 2)} A):
              o programa não enxerga essa carga. Um alicate de 100 A é grande demais para uma
              lâmpada.
            </span>
          </p>
        )}
        <Programa>
          {`leitura = analogRead(A0);              // ${r.min} a ${r.max}
i = (leitura - 512) * 5.0 / 1024 / ${vpa};  // em A
soma += i * i;                          // ${AMOSTRAGEM.n} amostras, 6 ciclos
Irms = sqrt(soma / ${AMOSTRAGEM.n});               // ${r.foraDaFaixa ? 'não vale' : `${fix(r.rmsPrograma, 3)} A`}`}
        </Programa>
        <p className="lw__note">
          1 passo do ADC de 10 bits = 5 V ÷ 1.024 ≈ 4,9 mV, o que dá ≈ {fix(r.porPasso * 1000, 0)}{' '}
          mA com este sensor. A corrente é alternada: o sinal oscila em torno de 2,5 V, e o programa
          calcula o valor eficaz (RMS) a partir de muitas amostras. A conta usa fator de potência 1;
          em lâmpadas LED e motores a corrente real é um pouco diferente.
        </p>
        <div className="lw__status lw__status--warn">
          <span className="lw__status-dot" aria-hidden="true" />
          <p>
            <strong>Segurança:</strong> o ACS712 fica em série com o fio da rede: os bornes dele
            estão em {REDE_V} V e a corrente da carga passa por dentro do módulo. Instalar segue as
            regras de segurança da rede (disjuntor desligado, teste de ausência de tensão,
            eletricista habilitado se tiver dúvida). Prefira o alicate não invasivo (tipo SCT-013),
            que abraça o fio sem cortá-lo.
          </p>
        </div>
      </div>
    </div>
  );
}

function CorrenteScene({ tipo }: { tipo: TipoSensor }) {
  return (
    <svg
      viewBox="0 0 360 150"
      role="img"
      aria-label={
        tipo === 'hall'
          ? 'O ACS712 fica em série com o fio fase, entre a tomada e a carga.'
          : 'O alicate SCT-013 abraça o fio fase, sem cortá-lo.'
      }
    >
      <text className="labsens-label" x="10" y="20">
        tomada {REDE_V} V
      </text>
      <rect className="labsens-box" x="10" y="30" width="44" height="90" rx="6" />
      <text className="labsens-label" x="350" y="20" textAnchor="end">
        carga
      </text>
      <rect className="labsens-box" x="306" y="30" width="44" height="90" rx="6" />
      {tipo === 'hall' ? (
        <>
          <path className="labsens-wire labsens-wire--fase" d="M54 55 H150 M210 55 H306" />
          <rect className="labsens-chip" x="150" y="38" width="60" height="34" rx="4" />
          <text className="labsens-label labsens-label--chip" x="180" y="60" textAnchor="middle">
            ACS712
          </text>
          <path className="labsens-wire labsens-wire--sinal" d="M180 72 V108 H230" />
          <text className="labsens-label" x="234" y="112">
            A0
          </text>
          <text className="labsens-label labsens-label--perigo" x="180" y="30" textAnchor="middle">
            em série: {REDE_V} V nos bornes
          </text>
        </>
      ) : (
        <>
          <path className="labsens-wire labsens-wire--fase" d="M54 55 H306" />
          <ellipse className="labsens-clamp" cx="180" cy="55" rx="14" ry="24" />
          <path className="labsens-wire labsens-wire--sinal" d="M180 79 V108 H230" />
          <text className="labsens-label" x="234" y="112">
            resistor de {SCT013.carga} Ω → A0
          </text>
          <text className="labsens-label" x="180" y="24" textAnchor="middle">
            alicate em volta de um fio
          </text>
        </>
      )}
      <path className="labsens-wire labsens-wire--neutro" d="M54 95 H306" />
      <text className="labsens-label" x="100" y="90" textAnchor="middle">
        neutro
      </text>
      <text className="labsens-label" x="100" y="50" textAnchor="middle">
        fase
      </text>
    </svg>
  );
}

function CorrentePlot({ tipo, irms }: { tipo: TipoSensor; irms: number }) {
  const W = 340;
  const H = 128;
  const x0 = 34;
  const top = 8;
  const bottom = 104;
  const dur = 2 / REDE_HZ;
  const xt = (t: number) => x0 + (t / dur) * (W - x0 - 8);
  const yv = (v: number) => bottom - (v / 5) * (bottom - top);
  const pts = Array.from({ length: 161 }, (_, i) => {
    const t = (i / 160) * dur;
    const v = tensaoNoPino(tipo, correnteInstantanea(irms, t));
    return `${i === 0 ? 'M' : 'L'}${xt(t).toFixed(1)} ${yv(v).toFixed(1)}`;
  }).join(' ');
  const samples = Array.from({ length: Math.round(dur * AMOSTRAGEM.taxa) }, (_, k) => {
    const t = k / AMOSTRAGEM.taxa;
    const v = tensaoNoPino(tipo, correnteInstantanea(irms, t));
    return { x: xt(t), y: yv(Math.round(v / LSB) * LSB) };
  });
  return (
    <figure className="labsens__plot">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Tensão no pino do ADC durante dois ciclos de 60 Hz."
      >
        <line className="labsens-grid" x1={x0} y1={yv(5)} x2={W - 8} y2={yv(5)} />
        <line className="labsens-grid" x1={x0} y1={yv(0)} x2={W - 8} y2={yv(0)} />
        <line className="labsens-limit" x1={x0} y1={yv(2.5)} x2={W - 8} y2={yv(2.5)} />
        {tipo === 'hall' && (
          <>
            <line
              className="labsens-grid labsens-grid--range"
              x1={x0}
              y1={yv(2.5 + ACS712.faixa * ACS712.sensibilidade)}
              x2={W - 8}
              y2={yv(2.5 + ACS712.faixa * ACS712.sensibilidade)}
            />
            <line
              className="labsens-grid labsens-grid--range"
              x1={x0}
              y1={yv(2.5 - ACS712.faixa * ACS712.sensibilidade)}
              x2={W - 8}
              y2={yv(2.5 - ACS712.faixa * ACS712.sensibilidade)}
            />
          </>
        )}
        <path className="labsens-trace labsens-trace--main" d={pts} />
        {samples.map((s, i) => (
          <circle key={i} className="labsens-sample" cx={s.x} cy={s.y} r="1.6" />
        ))}
        <text className="labsens-axis" x="2" y={yv(5) + 4}>
          5 V
        </text>
        <text className="labsens-axis" x="2" y={yv(2.5) + 4}>
          2,5 V
        </text>
        <text className="labsens-axis" x="2" y={yv(0) + 4}>
          0 V
        </text>
        <text className="labsens-axis" x={x0} y={H - 6}>
          0
        </text>
        <text className="labsens-axis" x={W - 8} y={H - 6} textAnchor="end">
          33,3 ms (2 ciclos)
        </text>
      </svg>
      <figcaption className="lw__note">
        Tensão no pino A0; os pontos são as amostras do ADC (2.000 por segundo).
        {tipo === 'hall' ? ' Linhas tracejadas: a faixa de ±5 A do sensor.' : ''}
      </figcaption>
    </figure>
  );
}
