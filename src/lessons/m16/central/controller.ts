/**
 * Logic of the generic gate central (CD-1), docs/plano/05-portao.md,
 * section 5.2: the state machine, the motor drive (relays choose the
 * direction, the TRIAC switches the current with soft start and limits the
 * force), obstacle detection, auto close, remote learning and the LEDs.
 *
 * It works on what the program means ("the opening limit switch is
 * active"); src/lessons/m16/firmware/central-generica.ts translates the
 * microcontroller pins (pull-ups, active low, ADC voltages) to and from it.
 * Pure: the same state and inputs always give the same result.
 */
import type { FirmwareEvent, RfFrame } from './firmware-api';

export type Estado = 'FECHADO' | 'ABRINDO' | 'ABERTO' | 'FECHANDO' | 'PARADO' | 'ERRO';
export type Sentido = 'abrir' | 'fechar';

export const CONFIG = {
  /** Both relays off for at least this long before reversing (s). */
  tempoMorto: 0.3,
  /** A relay contact settles before the TRIAC fires, and the TRIAC stops before it opens (s). */
  tempoRele: 0.05,
  /** Soft start: the TRIAC conduction ramps up for this long (s). */
  rampa: 1,
  /** Conduction at the start of the ramp (fraction of the half-cycle). */
  nivelPartida: 0.3,
  /** Conduction with FORÇA at minimum; at maximum it is 1. */
  nivelMinimo: 0.4,
  /** PAUSA trimpot range (s); below `pausaMinima` auto close is off. */
  pausaMaxima: 120,
  pausaMinima: 2,
  /** Longest run without reaching a limit switch (s). */
  tempoMaximo: 40,
  /** After an obstacle while opening, the gate backs off for this long (s). */
  recuo: 0.5,
  /** Electric lock pulse at the start of an opening (s). */
  pulsoTrava: 1,
  /** Garage light after the movement, with DIP LUZ on (s). */
  luzExtra: 60,
  /**
   * After the soft start the motor still accelerates the gate, drawing several
   * times its running current: the central waits this long (s)…
   */
  esperaAprendizado: 1,
  /** …and then learns the running current for this long (s). */
  aprendizado: 0.5,
  /** Current above the limit for this long counts as an obstacle (s). */
  persistencia: 0.25,
  /** Obstacle limit = running current × factor; FORÇA goes from the first to the second. */
  fatorMinimo: 1.25,
  fatorMaximo: 2.25,
  /** Buttons must hold a level this long to count (s). */
  debounce: 0.03,
  /** Learning mode waits this long for a remote (s). */
  cadastroTimeout: 10,
  /** Holding PROG this long erases every remote (s). */
  apagarSegurando: 10,
  /** Remote buttons the memory holds. */
  capacidade: 32,
  /** A rolling code is accepted up to this many presses ahead of the last one. */
  janelaRolling: 1000,
};

export type CentralConfig = typeof CONFIG;

/** What the program sees, already converted from the pins. */
export interface CentralInputs {
  /** Opening limit switch active (magnet at the reed). */
  fca: boolean;
  /** Closing limit switch active. */
  fcf: boolean;
  /** Push button pressed. */
  botoeira: boolean;
  /** Photocell beam free (its NC contact closed). A broken wire reads as interrupted. */
  feixeLivre: boolean;
  /** PROG button pressed. */
  prog: boolean;
  /** J1 FOTO fitted: photocell ignored. */
  j1: boolean;
  /** J2 AUT fitted: auto close on. */
  j2: boolean;
  /** DIP 1 INV on: K1 and K2 swap meaning. */
  inv: boolean;
  /** DIP 2 LUZ on: garage light stays on 60 s after the movement. */
  luz: boolean;
  /** PAUSA and FORÇA trimpot positions, 0 to 1. */
  pausa: number;
  forca: number;
  /** Motor current (A, RMS). */
  corrente: number;
  rf: readonly RfFrame[];
}

export interface CentralOutputs {
  /** Relay coils: K1 opens, K2 closes (swapped with INV). */
  k1: boolean;
  k2: boolean;
  /** TRIAC conduction, 0 to 1. */
  triac: number;
  trava: boolean;
  /** Garage light (AUX contact). */
  aux: boolean;
  buzzer: boolean;
  ledProg: boolean;
}

export type FaseMotor = 'desligado' | 'atracando' | 'rampa' | 'regime' | 'soltando';

export interface ControleCadastrado {
  serial: string;
  botao: number;
  /** Last rolling-code counter accepted; undefined for fixed code. */
  contador?: number;
}

type Sinal = 'confirmar' | 'apagado' | 'cheia';

export interface CentralState {
  iniciado: boolean;
  estado: Estado;
  /** Direction of the last movement: PARADO resumes in the opposite one. */
  ultimoSentido: Sentido;
  /** Time in the current movement (s), for the 40 s limit. */
  tMovimento: number;
  /** Time counted with the gate open (s), for auto close. */
  tPausa: number;
  /** Back-off time still to run (s). */
  recuo: number;
  tErro: number;
  tTrava: number;
  tLuz: number;
  motor: {
    fase: FaseMotor;
    /** Relay engaged; null with both off. */
    sentido: Sentido | null;
    /** Where the program wants the motor to go. */
    alvo: Sentido | null;
    /** Time in the current phase (s). */
    t: number;
  };
  /** Obstacle detection during the run. */
  esforco: {
    t: number;
    soma: number;
    amostras: number;
    referencia: number | null;
    tAcima: number;
    sobrecarga: boolean;
  };
  botoes: Record<'botoeira' | 'prog', { nivel: boolean; t: number }>;
  prog: { modo: 'normal' | 'cadastro'; t: number; segurando: number; apagou: boolean };
  sinal: { tipo: Sinal | null; t: number };
  memoria: { controles: ControleCadastrado[] };
}

export function initialState(memoria?: { controles: ControleCadastrado[] }): CentralState {
  return {
    iniciado: false,
    estado: 'PARADO',
    ultimoSentido: 'fechar',
    tMovimento: 0,
    tPausa: 0,
    recuo: 0,
    tErro: 0,
    tTrava: 0,
    tLuz: 0,
    motor: { fase: 'desligado', sentido: null, alvo: null, t: CONFIG.tempoMorto },
    esforco: { t: 0, soma: 0, amostras: 0, referencia: null, tAcima: 0, sobrecarga: false },
    botoes: { botoeira: { nivel: false, t: 0 }, prog: { nivel: false, t: 0 } },
    prog: { modo: 'normal', t: 0, segurando: 0, apagou: false },
    sinal: { tipo: null, t: 0 },
    memoria: { controles: memoria?.controles.map((c) => ({ ...c })) ?? [] },
  };
}

/** TRIAC conduction in steady running for a FORÇA position. */
export function nivelForca(forca: number, cfg: CentralConfig = CONFIG): number {
  return cfg.nivelMinimo + (1 - cfg.nivelMinimo) * clamp01(forca);
}

/** Auto-close time for a PAUSA position (s); 0 means off. */
export function tempoPausa(pausa: number, cfg: CentralConfig = CONFIG): number {
  const s = clamp01(pausa) * cfg.pausaMaxima;
  return s < cfg.pausaMinima ? 0 : s;
}

/** Obstacle limit factor for a FORÇA position. */
export function fatorLimite(forca: number, cfg: CentralConfig = CONFIG): number {
  return cfg.fatorMinimo + (cfg.fatorMaximo - cfg.fatorMinimo) * clamp01(forca);
}

export const NOME_ESTADO: Record<Estado, string> = {
  FECHADO: 'Fechado',
  ABRINDO: 'Abrindo',
  ABERTO: 'Aberto',
  FECHANDO: 'Fechando',
  PARADO: 'Parado',
  ERRO: 'Erro',
};

export interface StepResult {
  state: CentralState;
  outputs: CentralOutputs;
  events: FirmwareEvent[];
}

export function stepCentral(
  previous: CentralState,
  inp: CentralInputs,
  dt: number,
  cfg: CentralConfig = CONFIG,
): StepResult {
  const s = structuredClone(previous);
  const events: FirmwareEvent[] = [];
  const info = (message: string) => events.push({ kind: 'info', message });
  const warn = (message: string) => events.push({ kind: 'warning', message });
  const feixeOk = inp.feixeLivre || inp.j1;

  if (!s.iniciado) {
    s.iniciado = true;
    if (inp.fcf) {
      s.estado = 'FECHADO';
      info('Central ligada com o portão fechado (fim de curso de fechamento ativo).');
    } else if (inp.fca) {
      s.estado = 'ABERTO';
      s.ultimoSentido = 'abrir';
      info('Central ligada com o portão aberto (fim de curso de abertura ativo).');
    } else {
      s.estado = 'PARADO';
      s.ultimoSentido = 'fechar';
      info('Central ligada sem saber a posição do portão: o primeiro comando abre.');
    }
    if (inp.j1) warn('J1 FOTO colocado: a central está ignorando a fotocélula.');
  }

  // Buttons, with debounce.
  const pressed = (name: 'botoeira' | 'prog', raw: boolean): boolean => {
    const b = s.botoes[name];
    if (raw === b.nivel) {
      b.t = 0;
      return false;
    }
    b.t += dt;
    if (b.t + 1e-9 < cfg.debounce) return false;
    b.nivel = raw;
    b.t = 0;
    return raw;
  };
  const botoeira = pressed('botoeira', inp.botoeira);
  const progPress = pressed('prog', inp.prog);

  const iniciar = (sentido: Sentido) => {
    s.recuo = 0;
    if (sentido === 'abrir' && inp.fca) {
      s.estado = 'ABERTO';
      s.motor.alvo = null;
      s.tPausa = 0;
      return;
    }
    if (sentido === 'fechar' && inp.fcf) {
      s.estado = 'FECHADO';
      s.motor.alvo = null;
      return;
    }
    if (sentido === 'abrir' && s.estado === 'FECHADO') s.tTrava = cfg.pulsoTrava;
    s.estado = sentido === 'abrir' ? 'ABRINDO' : 'FECHANDO';
    s.ultimoSentido = sentido;
    s.tMovimento = 0;
    s.motor.alvo = sentido;
  };
  const parar = () => {
    s.motor.alvo = null;
    s.recuo = 0;
  };
  const tentarFechar = () => {
    if (feixeOk) iniciar('fechar');
    else warn('Fotocélula interrompida: a central não fecha o portão.');
  };
  const comando = (origem: string) => {
    switch (s.estado) {
      case 'FECHADO':
        info(`Comando (${origem}): abrindo.`);
        iniciar('abrir');
        break;
      case 'ABRINDO':
        info(`Comando (${origem}) durante a abertura: o portão para.`);
        parar();
        s.estado = 'PARADO';
        break;
      case 'ABERTO':
        info(`Comando (${origem}): fechando.`);
        tentarFechar();
        break;
      case 'FECHANDO':
        info(`Comando (${origem}) durante o fechamento: o portão volta a abrir.`);
        iniciar('abrir');
        break;
      case 'PARADO':
        info(`Comando (${origem}): o portão segue no sentido oposto ao último.`);
        if (s.ultimoSentido === 'abrir') tentarFechar();
        else iniciar('abrir');
        break;
      case 'ERRO':
        info(`Comando (${origem}) depois do erro: abrindo.`);
        iniciar('abrir');
        break;
    }
  };

  // PROG: a touch starts learning, holding erases every remote.
  if (progPress) {
    if (s.prog.modo === 'normal') {
      s.prog.modo = 'cadastro';
      s.prog.t = 0;
      info('Modo de cadastro: aperte o botão do controle que você quer gravar.');
    } else {
      s.prog.modo = 'normal';
      info('Cadastro cancelado.');
    }
  }
  if (s.botoes.prog.nivel) {
    s.prog.segurando += dt;
    if (s.prog.segurando + 1e-9 >= cfg.apagarSegurando && !s.prog.apagou) {
      s.prog.apagou = true;
      s.prog.modo = 'normal';
      s.memoria.controles = [];
      s.sinal = { tipo: 'apagado', t: 0 };
      warn('Todos os controles foram apagados da memória.');
    }
  } else {
    s.prog.segurando = 0;
    s.prog.apagou = false;
  }
  if (s.prog.modo === 'cadastro') {
    s.prog.t += dt;
    if (s.prog.t >= cfg.cadastroTimeout) {
      s.prog.modo = 'normal';
      info('Tempo de cadastro esgotado sem receber nenhum controle.');
    }
  }

  // Remote frames.
  let comandoRf = false;
  for (const frame of inp.rf) {
    const known = s.memoria.controles.find(
      (c) => c.serial === frame.serial && c.botao === frame.button,
    );
    if (s.prog.modo === 'cadastro') {
      s.prog.modo = 'normal';
      if (known) {
        s.sinal = { tipo: 'confirmar', t: 0 };
        info('Este botão já estava cadastrado.');
      } else if (s.memoria.controles.length >= cfg.capacidade) {
        s.sinal = { tipo: 'cheia', t: 0 };
        warn(`Memória cheia (${cfg.capacidade} botões): apague os controles para cadastrar outro.`);
      } else {
        s.memoria.controles.push({
          serial: frame.serial,
          botao: frame.button,
          ...(frame.counter !== undefined ? { contador: frame.counter } : {}),
        });
        s.sinal = { tipo: 'confirmar', t: 0 };
        info(
          `Controle cadastrado (${s.memoria.controles.length} de ${cfg.capacidade} botões na memória).`,
        );
      }
      continue;
    }
    if (!known) continue;
    if (known.contador !== undefined) {
      const c = frame.counter;
      if (c === undefined || c <= known.contador || c - known.contador > cfg.janelaRolling) {
        warn('Código repetido ou fora da sequência: comando recusado (rolling code).');
        continue;
      }
      known.contador = c;
    } else if (frame.counter !== undefined) {
      continue;
    }
    comandoRf = true;
  }

  if (botoeira) comando('botoeira');
  if (comandoRf) comando('controle');

  // Watch the movement.
  const sobrecarga = s.esforco.sobrecarga;
  if (s.estado === 'ABRINDO') {
    s.tMovimento += dt;
    if (inp.fca) {
      parar();
      s.estado = 'ABERTO';
      s.tPausa = 0;
      info('Fim de curso de abertura: portão aberto, motor desligado.');
    } else if (sobrecarga) {
      parar();
      s.estado = 'PARADO';
      s.recuo = cfg.recuo;
      warn('Obstáculo na abertura (corrente acima do limite): o portão para e recua um pouco.');
    } else if (s.tMovimento >= cfg.tempoMaximo) {
      erro();
    }
  } else if (s.estado === 'FECHANDO') {
    s.tMovimento += dt;
    if (inp.fcf) {
      parar();
      s.estado = 'FECHADO';
      info('Fim de curso de fechamento: portão fechado, motor desligado.');
    } else if (!feixeOk) {
      warn('Feixe da fotocélula interrompido durante o fechamento: o portão volta a abrir.');
      iniciar('abrir');
    } else if (sobrecarga) {
      warn('Obstáculo no fechamento (corrente acima do limite): o portão volta a abrir.');
      iniciar('abrir');
    } else if (s.tMovimento >= cfg.tempoMaximo) {
      erro();
    }
  } else if (s.estado === 'ABERTO') {
    const pausa = tempoPausa(inp.pausa, cfg);
    if (inp.j2 && pausa > 0) {
      if (feixeOk) {
        s.tPausa += dt;
        if (s.tPausa >= pausa) {
          info('Pausa encerrada: fechamento automático.');
          iniciar('fechar');
        }
      } else s.tPausa = 0;
    } else s.tPausa = 0;
  } else if (s.estado === 'PARADO' && s.recuo > 0) {
    s.motor.alvo = 'fechar';
    const running = s.motor.sentido === 'fechar' && ['rampa', 'regime'].includes(s.motor.fase);
    if (running) s.recuo -= dt;
    if (s.recuo <= 0) {
      s.recuo = 0;
      s.motor.alvo = null;
    }
  } else if (s.estado === 'ERRO') {
    s.tErro += dt;
  }

  function erro() {
    parar();
    s.estado = 'ERRO';
    s.tErro = 0;
    warn(
      `Tempo máximo de percurso (${fmt(cfg.tempoMaximo)} s) sem chegar ao fim de curso: motor desligado. Confira o fim de curso e os ímãs.`,
    );
  }

  // Motor drive: relays switch with no current; the TRIAC starts and stops it.
  const nivel = nivelForca(inp.forca, cfg);
  const m = s.motor;
  m.t += dt;
  const wrongWay = m.alvo !== m.sentido;
  switch (m.fase) {
    case 'desligado':
      if (m.alvo && m.t + 1e-9 >= cfg.tempoMorto) {
        m.fase = 'atracando';
        m.sentido = m.alvo;
        m.t = 0;
      }
      break;
    case 'atracando':
      if (wrongWay) enter('desligado');
      else if (m.t + 1e-9 >= cfg.tempoRele) enter('rampa');
      break;
    case 'rampa':
      if (wrongWay) enter('soltando');
      else if (m.t + 1e-9 >= cfg.rampa) enter('regime');
      break;
    case 'regime':
      if (wrongWay) enter('soltando');
      break;
    case 'soltando':
      if (m.t + 1e-9 >= cfg.tempoRele) enter('desligado');
      break;
  }
  function enter(fase: FaseMotor) {
    m.fase = fase;
    m.t = 0;
    if (fase === 'desligado') m.sentido = null;
  }

  let triac = 0;
  if (m.fase === 'rampa') {
    const start = Math.min(cfg.nivelPartida, nivel);
    triac = start + (nivel - start) * Math.min(m.t / cfg.rampa, 1);
  } else if (m.fase === 'regime') triac = nivel;

  // Obstacle detection: learn the running current, then watch for a rise.
  const e = s.esforco;
  if (m.fase === 'regime') {
    e.t += dt;
    if (e.referencia === null) {
      if (e.t > cfg.esperaAprendizado) {
        e.soma += inp.corrente;
        e.amostras++;
      }
      if (e.t >= cfg.esperaAprendizado + cfg.aprendizado) e.referencia = e.soma / e.amostras;
    } else if (inp.corrente > e.referencia * fatorLimite(inp.forca, cfg)) {
      e.tAcima += dt;
      if (e.tAcima + 1e-9 >= cfg.persistencia) e.sobrecarga = true;
    } else {
      e.tAcima = 0;
      e.referencia += ((inp.corrente - e.referencia) * dt) / 3;
    }
  } else {
    s.esforco = { t: 0, soma: 0, amostras: 0, referencia: null, tAcima: 0, sobrecarga: false };
  }

  // Accessories and signals.
  const moving = m.sentido !== null;
  if (moving) s.tLuz = inp.luz ? cfg.luzExtra : 0;
  else s.tLuz = Math.max(0, s.tLuz - dt);
  s.tTrava = Math.max(0, s.tTrava - dt);

  let ledProg = s.prog.modo === 'cadastro';
  let buzzer = false;
  if (s.estado === 'ERRO') {
    ledProg = s.tErro % 1 < 0.5;
    buzzer = s.tErro < 1.2 && s.tErro % 0.4 < 0.2;
  }
  if (s.sinal.tipo) {
    // Three blinks to confirm, fast blinking and a long beep after erasing, two beeps when full.
    const t = s.sinal.t;
    const length = { confirmar: 0.9, apagado: 2, cheia: 0.8 }[s.sinal.tipo];
    if (t >= length - 1e-9) s.sinal.tipo = null;
    else if (s.sinal.tipo === 'confirmar') ledProg = t % 0.3 < 0.15;
    else if (s.sinal.tipo === 'apagado') {
      ledProg = t % 0.2 < 0.1;
      buzzer = t < 1;
    } else buzzer = t % 0.4 < 0.2;
    s.sinal.t += dt;
  }

  const abre = m.sentido === 'abrir';
  const fecha = m.sentido === 'fechar';
  return {
    state: s,
    outputs: {
      k1: inp.inv ? fecha : abre,
      k2: inp.inv ? abre : fecha,
      triac,
      trava: s.tTrava > 0,
      aux: moving || s.tLuz > 0,
      buzzer,
      ledProg,
    },
    events,
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}
