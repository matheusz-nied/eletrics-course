/**
 * Lesson 7.6 (interruptores): the student wires two three-way switches
 * ("interruptores paralelos") and a lamp by choosing, for each terminal,
 * which conductor goes there. This module checks the wiring by trying the
 * four positions of the two switches, the way an electrician tests it: does
 * the lamp change from both points, is there a short between phase and
 * neutral in any position, and does the lamp keep the phase when it is off?
 */

/** Conductors the student can put on a terminal. `nenhum` leaves it empty. */
export type Wire = 'nenhum' | 'fase' | 'neutro' | 'retorno' | 'viajante1' | 'viajante2';

export const WIRES: { id: Wire; label: string; short: string }[] = [
  { id: 'nenhum', label: 'Nenhum fio', short: '—' },
  { id: 'fase', label: 'Fase (do quadro)', short: 'F' },
  { id: 'neutro', label: 'Neutro (do quadro)', short: 'N' },
  { id: 'retorno', label: 'Retorno', short: 'R' },
  { id: 'viajante1', label: 'Viajante 1', short: 'V1' },
  { id: 'viajante2', label: 'Viajante 2', short: 'V2' },
];

/** Terminals: C, 1 and 2 of each switch, and the two of the lamp socket. */
export type Terminal = 's1c' | 's11' | 's12' | 's2c' | 's21' | 's22' | 'la' | 'lb';

export const TERMINALS: { id: Terminal; label: string }[] = [
  { id: 's1c', label: 'Interruptor 1, borne C (comum)' },
  { id: 's11', label: 'Interruptor 1, borne 1' },
  { id: 's12', label: 'Interruptor 1, borne 2' },
  { id: 's2c', label: 'Interruptor 2, borne C (comum)' },
  { id: 's21', label: 'Interruptor 2, borne 1' },
  { id: 's22', label: 'Interruptor 2, borne 2' },
  { id: 'la', label: 'Lâmpada, borne A' },
  { id: 'lb', label: 'Lâmpada, borne B' },
];

export type Wiring = Record<Terminal, Wire>;

/** Which contact the common touches: 1 or 2. */
export type Position = 1 | 2;

export const EMPTY: Wiring = {
  s1c: 'nenhum',
  s11: 'nenhum',
  s12: 'nenhum',
  s2c: 'nenhum',
  s21: 'nenhum',
  s22: 'nenhum',
  la: 'nenhum',
  lb: 'nenhum',
};

/** The classic wiring: phase on the common of switch 1, return from the common of switch 2. */
export const CLASSIC: Wiring = {
  s1c: 'fase',
  s11: 'viajante1',
  s12: 'viajante2',
  s2c: 'retorno',
  s21: 'viajante1',
  s22: 'viajante2',
  la: 'retorno',
  lb: 'neutro',
};

/** What a terminal has with respect to the installation. */
export type Potential = 'fase' | 'neutro' | 'solto';

export interface State {
  /** Phase and neutral joined through the switches: the breaker trips. */
  short: boolean;
  lit: boolean;
  /** What each lamp terminal has (through the filament when the other side is loose). */
  lamp: { a: Potential; b: Potential };
}

/** Union–find over the conductors, joined by the switch contacts in one position. */
function groups(w: Wiring, p1: Position, p2: Position): (x: Wire) => Wire {
  const parent = new Map<Wire, Wire>();
  const find = (x: Wire): Wire => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const join = (a: Wire, b: Wire) => {
    if (a === 'nenhum' || b === 'nenhum') return;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  join(w.s1c, p1 === 1 ? w.s11 : w.s12);
  join(w.s2c, p2 === 1 ? w.s21 : w.s22);
  return find;
}

/** The circuit in one position of the two switches. */
export function evaluate(w: Wiring, p1: Position, p2: Position): State {
  const find = groups(w, p1, p2);
  const potential = (x: Wire): Potential => {
    if (x === 'nenhum') return 'solto';
    const g = find(x);
    if (g === find('fase')) return 'fase';
    if (g === find('neutro')) return 'neutro';
    return 'solto';
  };
  const short = find('fase') === find('neutro');
  const a = potential(w.la);
  const b = potential(w.lb);
  const lit = !short && ((a === 'fase' && b === 'neutro') || (a === 'neutro' && b === 'fase'));
  // With one side loose, the filament carries the other side's potential across.
  const lamp = {
    a: a === 'solto' && b !== 'solto' ? b : a,
    b: b === 'solto' && a !== 'solto' ? a : b,
  };
  if (short) return { short, lit: false, lamp: { a, b } };
  return { short, lit, lamp };
}

export type Verdict =
  | 'incompleta'
  | 'curto'
  | 'correta'
  | 'neutro-cortado'
  | 'um-ponto'
  | 'sempre-acesa'
  | 'nunca-acende';

export interface Diagnosis {
  verdict: Verdict;
  /** The four positions, in the order 1-1, 1-2, 2-1, 2-2. */
  states: { p1: Position; p2: Position; state: State }[];
  /** Short title (pt-BR). */
  title: string;
  /** Explanation (pt-BR). */
  message: string;
  /** True for the verdicts that put someone at risk or trip the breaker. */
  danger: boolean;
}

const POSITIONS: [Position, Position][] = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
];

/** Tests the wiring in the four positions, like an electrician flipping both switches. */
export function diagnose(w: Wiring): Diagnosis {
  const states = POSITIONS.map(([p1, p2]) => ({ p1, p2, state: evaluate(w, p1, p2) }));
  const make = (verdict: Verdict, title: string, message: string, danger = false): Diagnosis => ({
    verdict,
    states,
    title,
    message,
    danger,
  });

  const used = new Set(Object.values(w));
  if (!used.has('fase') || !used.has('neutro')) {
    return make(
      'incompleta',
      'Falta ligar a fase ou o neutro',
      'A fase e o neutro chegam do quadro. Os dois precisam ir a algum borne para a lâmpada ter por onde acender.',
    );
  }

  const shorts = states.filter((s) => s.state.short);
  if (shorts.length > 0) {
    const where = shorts.map((s) => `${s.p1}-${s.p2}`).join(', ');
    return make(
      'curto',
      'Curto-circuito entre fase e neutro',
      `Com os interruptores em ${where}, a fase encontra o neutro pelos contatos, sem passar pela lâmpada. Na instalação real, o disjuntor desarma com um estalo, os contatos do interruptor podem derreter e quem estiver mexendo leva um susto (ou coisa pior). O neutro nunca vai a um interruptor paralelo: ele vai direto à lâmpada.`,
      true,
    );
  }

  const lit = states.map((s) => s.state.lit);
  const on = lit.filter(Boolean).length;
  if (on === 0) {
    return make(
      'nunca-acende',
      'A lâmpada não acende em nenhuma posição',
      'Em nenhuma das quatro posições a lâmpada recebe a fase de um lado e o neutro do outro. Siga o caminho: fase no comum de um interruptor, viajantes ligando 1 com 1 e 2 com 2, e o retorno saindo do comum do outro até a lâmpada.',
    );
  }
  if (on === 4) {
    return make(
      'sempre-acesa',
      'A lâmpada fica sempre acesa',
      'A lâmpada recebe fase e neutro sem passar pelos contatos dos interruptores, que ficaram fora do caminho. Os interruptores mudam de posição, mas não comandam nada.',
    );
  }

  // Works from both points: flipping either switch changes the lamp, in every position.
  const both = lit[0] === lit[3] && lit[1] === lit[2] && lit[0] !== lit[1];
  if (!both) {
    return make(
      'um-ponto',
      'A lâmpada só muda por um dos interruptores',
      'Em alguma posição, mexer num dos interruptores não muda a lâmpada. Os viajantes precisam ligar o borne 1 de um ao borne 1 do outro e o 2 ao 2 (ou cruzados, 1 com 2 e 2 com 1: também funciona). A fase e o retorno ficam nos comuns.',
    );
  }

  const offStates = states.filter((s) => !s.state.lit);
  const phaseWhenOff = offStates.some(
    (s) => s.state.lamp.a === 'fase' || s.state.lamp.b === 'fase',
  );
  if (phaseWhenOff) {
    return make(
      'neutro-cortado',
      'Funciona, mas os interruptores cortam o neutro',
      'A lâmpada acende e apaga pelos dois interruptores, mas a fase vai direto à lâmpada. Apagada, ela continua com fase no soquete: quem for trocar a lâmpada "com a luz apagada" pode levar um choque, e algumas lâmpadas LED ficam piscando fraco. Troque: a fase vai ao comum de um interruptor e o neutro vai direto à lâmpada.',
      true,
    );
  }

  return make(
    'correta',
    'Ligação correta',
    'A lâmpada muda de estado pelos dois interruptores, em qualquer posição, e apagada fica sem fase. É a ligação clássica do interruptor paralelo: fase num comum, retorno no outro comum e os viajantes entre os bornes 1 e 2.',
  );
}

/** How many terminals still have no conductor. */
export function emptyTerminals(w: Wiring): number {
  return Object.values(w).filter((x) => x === 'nenhum').length;
}
