/**
 * Lesson 12.2: the state machine of the gate central, as the student sees it
 * in the live diagram. The table below is the one the firmware really
 * follows (src/lessons/m16/central/controller.ts, `stepCentral`, and
 * docs/plano/05-portao.md, section 5.2); `Rastreador` turns the snapshots of
 * the running central into a log of transitions with their causes, read
 * from the firmware's own event messages. Pure, no DOM.
 */
import type { Estado } from '../m16/central/controller';

export type { Estado };

export const ESTADOS: readonly Estado[] = [
  'FECHADO',
  'ABRINDO',
  'ABERTO',
  'FECHANDO',
  'PARADO',
  'ERRO',
];

/** What makes the central change state. */
export type Causa =
  'comando' | 'fca' | 'fcf' | 'pausa' | 'fotocelula' | 'obstaculo' | 'tempo-maximo';

export const CAUSAS: Record<Causa, string> = {
  comando: 'comando (controle ou botoeira)',
  fca: 'fim de curso de abertura',
  fcf: 'fim de curso de fechamento',
  pausa: 'pausa terminou',
  fotocelula: 'fotocélula interrompida',
  obstaculo: 'obstáculo',
  'tempo-maximo': '40 s sem fim de curso',
};

export interface Transicao {
  id: string;
  de: Estado;
  para: Estado;
  causas: readonly Causa[];
  /** A condition the program checks too (pt-BR). */
  condicao?: string;
}

/** Every transition of the firmware, in the order of the lesson table. */
export const TRANSICOES: readonly Transicao[] = [
  { id: 'fechado-abrindo', de: 'FECHADO', para: 'ABRINDO', causas: ['comando'] },
  { id: 'abrindo-aberto', de: 'ABRINDO', para: 'ABERTO', causas: ['fca'] },
  { id: 'abrindo-parado', de: 'ABRINDO', para: 'PARADO', causas: ['comando', 'obstaculo'] },
  { id: 'abrindo-erro', de: 'ABRINDO', para: 'ERRO', causas: ['tempo-maximo'] },
  {
    id: 'aberto-fechando',
    de: 'ABERTO',
    para: 'FECHANDO',
    causas: ['comando', 'pausa'],
    condicao: 'só com o feixe da fotocélula livre',
  },
  { id: 'fechando-fechado', de: 'FECHANDO', para: 'FECHADO', causas: ['fcf'] },
  {
    id: 'fechando-abrindo',
    de: 'FECHANDO',
    para: 'ABRINDO',
    causas: ['comando', 'fotocelula', 'obstaculo'],
  },
  { id: 'fechando-erro', de: 'FECHANDO', para: 'ERRO', causas: ['tempo-maximo'] },
  {
    id: 'parado-abrindo',
    de: 'PARADO',
    para: 'ABRINDO',
    causas: ['comando'],
    condicao: 'se o último movimento foi fechar',
  },
  {
    id: 'parado-fechando',
    de: 'PARADO',
    para: 'FECHANDO',
    causas: ['comando'],
    condicao: 'se o último movimento foi abrir, e com o feixe livre',
  },
  { id: 'erro-abrindo', de: 'ERRO', para: 'ABRINDO', causas: ['comando'] },
];

export function transicao(de: Estado, para: Estado): Transicao | undefined {
  return TRANSICOES.find((t) => t.de === de && t.para === para);
}

/** What each state means for the motor, under the name in the diagram. */
export const SUBTITULO: Record<Estado, string> = {
  FECHADO: 'motor desligado',
  ABRINDO: 'K1 e TRIAC ligados',
  ABERTO: 'motor desligado',
  FECHANDO: 'K2 e TRIAC ligados',
  PARADO: 'espera um comando',
  ERRO: 'motor desligado',
};

export type Sentido = 'abrir' | 'fechar';

/**
 * Next state for a cause, as `stepCentral` decides it. `sentido` is the
 * last movement (PARADO resumes the other way); `recusado` is true when the
 * program refuses to close because the photocell beam is interrupted.
 * Undefined when the cause does nothing in that state.
 */
export function proximoEstado(
  estado: Estado,
  causa: Causa,
  sentido: Sentido,
  recusado = false,
): Estado | undefined {
  switch (causa) {
    case 'comando':
      return porComando(estado, sentido, recusado);
    case 'fca':
      return estado === 'ABRINDO' ? 'ABERTO' : undefined;
    case 'fcf':
      return estado === 'FECHANDO' ? 'FECHADO' : undefined;
    case 'pausa':
      return estado === 'ABERTO' ? 'FECHANDO' : undefined;
    case 'fotocelula':
      return estado === 'FECHANDO' ? 'ABRINDO' : undefined;
    case 'obstaculo':
      if (estado === 'ABRINDO') return 'PARADO';
      return estado === 'FECHANDO' ? 'ABRINDO' : undefined;
    case 'tempo-maximo':
      return estado === 'ABRINDO' || estado === 'FECHANDO' ? 'ERRO' : undefined;
  }
}

/** What a command does in each state (`comando` in `stepCentral`). */
function porComando(estado: Estado, sentido: Sentido, recusado: boolean): Estado {
  switch (estado) {
    case 'FECHADO':
    case 'FECHANDO':
    case 'ERRO':
      return 'ABRINDO';
    case 'ABRINDO':
      return 'PARADO';
    case 'ABERTO':
      return recusado ? 'ABERTO' : 'FECHANDO';
    case 'PARADO':
      if (sentido === 'fechar') return 'ABRINDO';
      return recusado ? 'PARADO' : 'FECHANDO';
  }
}

/** A firmware message, by meaning. */
export type Sinal = Causa | 'recusado' | 'ligada';

/**
 * The cause behind an event message of the firmware
 * (src/lessons/m16/central/controller.ts); null for messages that change no
 * state (remote learning, rolling code…).
 */
export function sinalDaMensagem(message: string): Sinal | null {
  if (/^Comando \(/.test(message)) return 'comando';
  if (message.startsWith('Fim de curso de abertura')) return 'fca';
  if (message.startsWith('Fim de curso de fechamento')) return 'fcf';
  if (message.startsWith('Pausa encerrada')) return 'pausa';
  if (message.startsWith('Feixe da fotocélula interrompido')) return 'fotocelula';
  if (message.startsWith('Obstáculo')) return 'obstaculo';
  if (message.startsWith('Tempo máximo de percurso')) return 'tempo-maximo';
  if (message.startsWith('Fotocélula interrompida')) return 'recusado';
  if (message.startsWith('Central ligada')) return 'ligada';
  return null;
}

/** One line of the log. `de === para` for a command the program refused. */
export interface Registro {
  /** Simulated time (s). */
  t: number;
  de: Estado;
  para: Estado;
  causa: Causa;
  /** Where a command came from, as the firmware message says. */
  origem?: 'controle' | 'botoeira';
  recusado?: boolean;
}

/** "t = 12,4 s: ABRINDO → ABERTO (fim de curso de abertura)". */
export function textoRegistro(r: Registro): string {
  const t = r.t.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const causa =
    r.causa === 'comando' && r.origem
      ? `comando ${r.origem === 'controle' ? 'do controle' : 'da botoeira'}`
      : CAUSAS[r.causa];
  if (r.recusado) return `t = ${t} s: ${r.de} fica (${causa} recusado: fotocélula interrompida)`;
  return `t = ${t} s: ${r.de} → ${r.para} (${causa})`;
}

/** What the tracker needs from a snapshot of the running central. */
export interface Observacao {
  t: number;
  estado: Estado | '';
  /** Firmware events, newest first (as CentralSnapshot.eventos). */
  eventos: readonly { t: number; message: string }[];
}

/**
 * Follows the central from snapshot to snapshot and writes down each
 * transition with its cause. Snapshots come once per animation frame, so a
 * frame can hold several steps: the tracker walks the new events in order,
 * and only falls back to the table when the events do not explain the state.
 */
export class Rastreador {
  estado: Estado | '' = '';
  private sentido: Sentido = 'fechar';
  private tUltimoEvento = -Infinity;
  private t = -Infinity;

  reset(): void {
    this.estado = '';
    this.sentido = 'fechar';
    this.tUltimoEvento = -Infinity;
    this.t = -Infinity;
  }

  /** New log lines since the previous snapshot, oldest first. */
  observar(o: Observacao): Registro[] {
    if (o.t < this.t) this.reset();
    this.t = o.t;
    const novos = o.eventos.filter((e) => e.t > this.tUltimoEvento).reverse();
    for (const e of novos) this.tUltimoEvento = Math.max(this.tUltimoEvento, e.t);

    if (this.estado === '' || o.estado === '') {
      this.estado = o.estado;
      if (o.estado === 'ABERTO') this.sentido = 'abrir';
      return [];
    }

    const out: Registro[] = [];
    let atual: Estado = this.estado;
    const sinais = novos.map((e) => ({
      t: e.t,
      sinal: sinalDaMensagem(e.message),
      origem: /^Comando \((controle|botoeira)\)/.exec(e.message)?.[1] as Registro['origem'],
    }));
    sinais.forEach(({ t, sinal, origem }, i) => {
      if (sinal === null || sinal === 'ligada' || sinal === 'recusado') return;
      // The refusal comes right after the command, in the same step.
      const recusado = sinal === 'comando' && sinais[i + 1]?.sinal === 'recusado';
      const para = proximoEstado(atual, sinal, this.sentido, recusado);
      if (!para) return;
      out.push({
        t,
        de: atual,
        para,
        causa: sinal,
        ...(origem ? { origem } : {}),
        ...(recusado ? { recusado } : {}),
      });
      atual = para;
      if (para === 'ABRINDO') this.sentido = 'abrir';
      if (para === 'FECHANDO') this.sentido = 'fechar';
    });

    if (atual !== o.estado) {
      const tr = transicao(atual, o.estado);
      if (tr) out.push({ t: o.t, de: atual, para: o.estado, causa: tr.causas[0]! });
      if (o.estado === 'ABRINDO') this.sentido = 'abrir';
      if (o.estado === 'FECHANDO') this.sentido = 'fechar';
    }
    this.estado = o.estado;
    return out;
  }
}
