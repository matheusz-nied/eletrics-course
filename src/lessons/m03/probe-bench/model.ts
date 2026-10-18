/**
 * Lesson 3.4 probe bench, without UI: the scenarios (cables, wall wiring, a
 * gate motor, fuses, a switch, a resistor, a diode and an LED), a small
 * resistive solver and what a multimeter shows in the Ω, continuity and
 * diode functions, with an explanation in pt-BR for each reading.
 * Everything here is de-energized: these functions are only used with the
 * power off.
 */

export type Fn = 'ohm' | 'cont' | 'diode';

export const FUNCTIONS: { id: Fn; symbol: string; label: string }[] = [
  { id: 'ohm', symbol: 'Ω', label: 'Resistência' },
  { id: 'cont', symbol: '·)))', label: 'Continuidade' },
  { id: 'diode', symbol: '➝|', label: 'Diodo' },
];

/** Resistance of the test leads and their contacts (typical). */
export const LEADS = 0.2;
/** The continuity beeper sounds below this (typical: a few tens of ohms). */
export const BEEP_LIMIT = 30;
/** Test current of the diode function (typical). */
export const DIODE_CURRENT = 0.001;
/** Highest voltage the diode function shows; above it, OL. */
export const DIODE_MAX = 3;
/** Highest resistance shown (a 6.000-count meter on its 60 MΩ range). */
export const OHM_MAX = 60e6;
/** The continuity function uses the 600 Ω range. */
export const CONT_MAX = 600;

export interface Point {
  id: string;
  /** Full name, for the selects and the screen reader. */
  label: string;
  /** Short name drawn next to the point. */
  short: string;
  /** Position in the drawing (viewBox 360 × 220). */
  x: number;
  y: number;
  /** Where the short name goes (default: above the point). */
  lp?: 'above' | 'below' | 'left' | 'right';
  /** Side the probes come from (default: opposite the name). */
  probe?: 'above' | 'below' | 'left';
  /** Which conductor the point belongs to when the part is good. */
  wire?: string;
}

export interface Edge {
  a: string;
  b: string;
  ohms: number;
}

export interface Diode {
  anode: string;
  cathode: string;
  /** Forward voltage at the diode-test current. */
  vf: number;
  led?: boolean;
}

export interface Network {
  edges: Edge[];
  diodes?: Diode[];
}

export type Tone = 'idle' | 'ok' | 'info' | 'warn';

export type ScenarioKind =
  | 'extensao'
  | 'parede'
  | 'motor'
  | 'fusivel-vidro'
  | 'fusivel-ceramico'
  | 'interruptor'
  | 'resistor'
  | 'diodo'
  | 'led';

export interface Option {
  id: string;
  label: string;
}

interface Context {
  fn: Fn;
  red: Point;
  black: Point;
  /** Resistance between the tips, leads included (Infinity: no path). */
  ohms: number;
  options: Record<string, boolean>;
}

export interface Scenario {
  id: string;
  group: 'Cabos e fios' | 'Peças';
  kind: ScenarioKind;
  label: string;
  detail: string;
  points: Point[];
  options?: Option[];
  network: (options: Record<string, boolean>) => Network;
  /** Scenario-specific reading of the measurement (Ω and continuity). */
  explain?: (c: Context) => { tone: Tone; text: string } | undefined;
}

// Scenarios

const CORD_POINTS: Point[] = [
  {
    id: 'plug-1',
    label: 'Pino 1 do plugue',
    short: 'Pino 1',
    x: 58,
    y: 92,
    probe: 'left',
    wire: 'w1',
  },
  {
    id: 'plug-2',
    label: 'Pino 2 do plugue',
    short: 'Pino 2',
    x: 58,
    y: 128,
    lp: 'below',
    probe: 'left',
    wire: 'w2',
  },
  {
    id: 'tom-1',
    label: 'Furo 1 da tomada da extensão',
    short: 'Furo 1',
    x: 284,
    y: 110,
    wire: 'w1',
  },
  {
    id: 'tom-2',
    label: 'Furo 2 da tomada da extensão',
    short: 'Furo 2',
    x: 316,
    y: 110,
    lp: 'below',
    wire: 'w2',
  },
];

// 5 m of 1,5 mm² copper per conductor: 0,057 Ω, plus the contacts.
const CORD_WIRE = 0.11;

function explainWires(c: Context, broken: string, shorted: string, whole: string) {
  if (!c.red.wire || !c.black.wire) return undefined;
  const connected = c.ohms < BEEP_LIMIT;
  if (c.red.wire === c.black.wire) {
    return connected
      ? { tone: 'ok' as const, text: whole }
      : { tone: 'warn' as const, text: broken };
  }
  return connected
    ? { tone: 'warn' as const, text: shorted }
    : {
        tone: 'ok' as const,
        text: 'Nenhum caminho entre os dois fios: a isolação entre eles está boa. Agora meça cada fio de ponta a ponta.',
      };
}

function cord(id: string, label: string, fault: 'none' | 'broken' | 'short'): Scenario {
  return {
    id,
    group: 'Cabos e fios',
    kind: 'extensao',
    label,
    detail:
      'Extensão de dois fios com 5 m, fora da tomada. Das extensões A, B e C, uma está boa, outra tem um fio rompido por dentro e a outra tem os dois fios em curto. Meça para descobrir qual é qual.',
    points: CORD_POINTS,
    network: () => {
      const edges: Edge[] = [{ a: 'plug-1', b: 'tom-1', ohms: CORD_WIRE }];
      if (fault === 'none') edges.push({ a: 'plug-2', b: 'tom-2', ohms: CORD_WIRE });
      if (fault === 'short') {
        // The cable was crushed in the middle and the two conductors touch.
        edges.length = 0;
        edges.push(
          { a: 'plug-1', b: 'mid-1', ohms: CORD_WIRE / 2 },
          { a: 'mid-1', b: 'tom-1', ohms: CORD_WIRE / 2 },
          { a: 'plug-2', b: 'mid-2', ohms: CORD_WIRE / 2 },
          { a: 'mid-2', b: 'tom-2', ohms: CORD_WIRE / 2 },
          { a: 'mid-1', b: 'mid-2', ohms: 0.05 },
        );
      }
      return { edges };
    },
    explain: (c) =>
      explainWires(
        c,
        'Esse fio está rompido em algum ponto: não há caminho de uma ponta à outra. Numa extensão, o lugar mais comum é perto do plugue ou da tomada, onde o cabo dobra.',
        'Curto: os dois fios se encostam em algum lugar do cabo. Ligada na tomada, essa extensão desarmaria o disjuntor ou derreteria no ponto do curto. Não use.',
        'Esse fio está inteiro de ponta a ponta. A leitura soma o fio, os contatos e as próprias pontas de prova.',
      ),
  };
}

const WALL_POINTS: Point[] = [
  { id: 'f', label: 'Fio preto (fase), no quadro', short: 'Preto', x: 84, y: 84 },
  {
    id: 'n',
    label: 'Fio azul-claro (neutro), no quadro',
    short: 'Azul',
    x: 84,
    y: 144,
    lp: 'below',
  },
];

// 15 m of 2,5 mm² copper: 0,0172 × 15 ÷ 2,5 ≈ 0,103 Ω per conductor.
const WALL_WIRE = 0.103;

function wall(id: string, label: string, broken: boolean): Scenario {
  return {
    id,
    group: 'Cabos e fios',
    kind: 'parede',
    label,
    detail:
      'Dois fios de 2,5 mm² com 15 m, do quadro até uma tomada, passando dentro da parede. O disjuntor está desligado e não há nada ligado na tomada. Você está no quadro e não alcança a outra ponta.',
    points: WALL_POINTS,
    options: [{ id: 'jumper', label: 'Jumper ligando os dois fios na tomada, na outra ponta' }],
    network: (o) => {
      const edges: Edge[] = [{ a: 'f', b: 'f-far', ohms: WALL_WIRE }];
      if (!broken) edges.push({ a: 'n', b: 'n-far', ohms: WALL_WIRE });
      if (o.jumper) edges.push({ a: 'f-far', b: 'n-far', ohms: 0.01 });
      return { edges };
    },
    explain: (c) => {
      if (c.red.id === c.black.id) return undefined;
      const connected = c.ohms < BEEP_LIMIT;
      if (!c.options.jumper) {
        return connected
          ? undefined
          : {
              tone: 'info',
              text: 'Sem o jumper, OL é o esperado: os dois fios só se encontram se alguém ligar um no outro lá na tomada. Essa medida mostra que eles não estão em curto entre si, mas não diz se estão inteiros. Coloque o jumper na outra ponta.',
            };
      }
      return connected
        ? {
            tone: 'ok',
            text: 'Com o jumper, a corrente do multímetro vai por um fio e volta pelo outro: os dois estão inteiros. A leitura soma os 30 m de fio, o jumper e as pontas de prova.',
          }
        : {
            tone: 'warn',
            text: 'Mesmo com o jumper, não há caminho: um dos fios está rompido, ou solto num borne ou numa emenda dentro de alguma caixa. Para descobrir qual, faça o jumper com um terceiro fio que você sabe que está bom.',
          };
    },
  };
}

const MOTOR_WIRES: Point[] = [
  { id: 'm1', label: 'Fio 1 (preto) do motor', short: 'Fio 1', x: 296, y: 44 },
  { id: 'm2', label: 'Fio 2 (branco) do motor', short: 'Fio 2', x: 316, y: 110, lp: 'right' },
  { id: 'm3', label: 'Fio 3 (vermelho) do motor', short: 'Fio 3', x: 296, y: 176, lp: 'below' },
  {
    id: 'carcaca',
    label: 'Carcaça (o corpo de metal) do motor',
    short: 'Carcaça',
    x: 110,
    y: 150,
    lp: 'below',
  },
];

/** Example windings: the common is wire 3. */
export const MOTOR_WINDINGS = { m1: 7.8, m2: 8.0 };

const motor: Scenario = {
  id: 'motor',
  group: 'Peças',
  kind: 'motor',
  label: 'Motor do portão com 3 fios',
  detail:
    'Motor monofásico de portão, solto da central, com três fios: o comum e as pontas dos dois enrolamentos. As cores variam de fabricante para fabricante; descubra qual é o comum medindo. Os valores são de exemplo.',
  points: MOTOR_WIRES,
  network: () => ({
    edges: [
      { a: 'm3', b: 'm1', ohms: MOTOR_WINDINGS.m1 },
      { a: 'm3', b: 'm2', ohms: MOTOR_WINDINGS.m2 },
    ],
  }),
  explain: (c) => {
    if (c.red.id === c.black.id) return undefined;
    if (c.red.id === 'carcaca' || c.black.id === 'carcaca') {
      return c.ohms === Infinity
        ? {
            tone: 'ok',
            text: 'Nenhum caminho entre o enrolamento e a carcaça: nenhum fio encosta no metal do motor. O multímetro só pega defeitos grosseiros; o teste de isolação completo é feito com um megômetro, que aplica centenas de volts.',
          }
        : {
            tone: 'warn',
            text: 'Há caminho entre o enrolamento e a carcaça: a isolação do motor está danificada. Ligado na rede, ele daria choque na carcaça ou desarmaria o disjuntor.',
          };
    }
    if (c.fn === 'cont') {
      return {
        tone: 'info',
        text: 'A continuidade apita nos três pares, porque todos ficam abaixo do limite do bipe. Ela mostra que os enrolamentos não estão rompidos, mas não diz qual é o comum. Para isso, use a função Ω e compare os valores.',
      };
    }
    return {
      tone: 'info',
      text: 'Anote o valor e meça os três pares (1 e 2, 1 e 3, 2 e 3). O par de maior resistência são as pontas dos dois enrolamentos; o fio que sobra é o comum.',
    };
  },
};

const FUSE_POINTS: Point[] = [
  { id: 'f1', label: 'Tampa esquerda do fusível', short: 'Tampa 1', x: 76, y: 110 },
  { id: 'f2', label: 'Tampa direita do fusível', short: 'Tampa 2', x: 284, y: 110 },
];

const glassFuse: Scenario = {
  id: 'fusivel-vidro',
  group: 'Peças',
  kind: 'fusivel-vidro',
  label: 'Fusível de vidro (2 A)',
  detail: 'Fusível de vidro, fora do porta-fusível. Dá para ver o filamento por dentro.',
  points: FUSE_POINTS,
  network: () => ({ edges: [{ a: 'f1', b: 'f2', ohms: 0.05 }] }),
  explain: (c) =>
    c.red.id === c.black.id
      ? undefined
      : c.ohms < BEEP_LIMIT
        ? {
            tone: 'ok',
            text: 'Fusível bom: caminho de resistência quase zero entre as tampas. Mesmo no vidro, confirme com o multímetro: às vezes o filamento rompe rente à tampa, onde não se vê.',
          }
        : { tone: 'warn', text: 'Fusível rompido: nenhum caminho entre as tampas.' },
};

const ceramicFuse: Scenario = {
  id: 'fusivel-ceramico',
  group: 'Peças',
  kind: 'fusivel-ceramico',
  label: 'Fusível cerâmico (10 A)',
  detail:
    'Fusível cerâmico, fora do porta-fusível. O corpo é opaco: não dá para ver o elemento por dentro.',
  points: FUSE_POINTS,
  network: () => ({ edges: [] }),
  explain: (c) =>
    c.red.id === c.black.id
      ? undefined
      : c.ohms < BEEP_LIMIT
        ? { tone: 'ok', text: 'Fusível bom: caminho de resistência quase zero entre as tampas.' }
        : {
            tone: 'warn',
            text: 'Fusível rompido: nenhum caminho entre as tampas. Por fora ele parece perfeito; no fusível cerâmico, só a medida diz se ele está bom. Troque por outro de mesma corrente, tensão e tipo.',
          },
};

const lightSwitch: Scenario = {
  id: 'interruptor',
  group: 'Peças',
  kind: 'interruptor',
  label: 'Interruptor simples',
  detail: 'Interruptor de parede, com o disjuntor desligado e um dos fios solto do borne.',
  points: [
    { id: 's1', label: 'Borne 1 do interruptor', short: 'Borne 1', x: 150, y: 168, lp: 'below' },
    { id: 's2', label: 'Borne 2 do interruptor', short: 'Borne 2', x: 210, y: 168, lp: 'below' },
  ],
  options: [{ id: 'ligado', label: 'Tecla na posição ligada' }],
  network: (o) => ({ edges: o.ligado ? [{ a: 's1', b: 's2', ohms: 0.01 }] : [] }),
  explain: (c) => {
    if (c.red.id === c.black.id) return undefined;
    const closed = c.ohms < BEEP_LIMIT;
    if (c.options.ligado) {
      return closed
        ? {
            tone: 'ok',
            text: 'Contato fechado: com a tecla ligada, o interruptor vira um pedaço de fio. Um interruptor bom alterna entre OL e quase zero.',
          }
        : {
            tone: 'warn',
            text: 'Tecla ligada e contato aberto: o interruptor está com defeito.',
          };
    }
    return closed
      ? { tone: 'warn', text: 'Tecla desligada e contato fechado: o interruptor está grudado.' }
      : {
          tone: 'ok',
          text: 'Contato aberto: com a tecla desligada, não pode haver caminho. Agora ligue a tecla e meça de novo.',
        };
  },
};

/** Example hand-to-hand resistance of dry skin at the ohmmeter's low voltage. */
export const BODY = 150e3;

const resistor: Scenario = {
  id: 'resistor',
  group: 'Peças',
  kind: 'resistor',
  label: 'Resistor de 1 MΩ',
  detail: 'Resistor solto, com as faixas marrom, preto e verde: 1 MΩ.',
  points: [
    { id: 'r1', label: 'Terminal esquerdo do resistor', short: 'Terminal 1', x: 70, y: 110 },
    { id: 'r2', label: 'Terminal direito do resistor', short: 'Terminal 2', x: 290, y: 110 },
  ],
  options: [{ id: 'dedos', label: 'Segurando os dois terminais com os dedos' }],
  network: (o) => {
    const edges: Edge[] = [{ a: 'r1', b: 'r2', ohms: 1e6 }];
    if (o.dedos) edges.push({ a: 'r1', b: 'r2', ohms: BODY });
    return { edges };
  },
  explain: (c) =>
    c.red.id === c.black.id
      ? undefined
      : c.options.dedos
        ? {
            tone: 'warn',
            text: 'Seu corpo virou um caminho em paralelo com o resistor: no exemplo, 150 kΩ de uma mão à outra. A leitura despenca. Segure só um dos terminais, ou apoie o resistor na mesa.',
          }
        : {
            tone: 'ok',
            text: 'O multímetro mostra o valor das faixas: 1 MΩ, dentro da tolerância. Agora segure os dois terminais com os dedos e meça de novo.',
          },
};

const diode: Scenario = {
  id: 'diodo',
  group: 'Peças',
  kind: 'diodo',
  label: 'Diodo retificador (1N4007)',
  detail: 'Diodo de silício solto. A faixa cinza marca o catodo.',
  points: [
    { id: 'a', label: 'Anodo (o lado sem faixa)', short: 'Anodo', x: 70, y: 110 },
    { id: 'k', label: 'Catodo (o lado da faixa)', short: 'Catodo', x: 290, y: 110 },
  ],
  network: () => ({ edges: [], diodes: [{ anode: 'a', cathode: 'k', vf: 0.562 }] }),
};

const led: Scenario = {
  id: 'led',
  group: 'Peças',
  kind: 'led',
  label: 'LED vermelho',
  detail:
    'LED vermelho de 5 mm, solto. A perna comprida é o anodo; o lado chato da borda marca o catodo.',
  points: [
    { id: 'a', label: 'Anodo (a perna comprida)', short: 'Anodo', x: 170, y: 196, lp: 'left' },
    { id: 'k', label: 'Catodo (a perna curta)', short: 'Catodo', x: 190, y: 176, lp: 'right' },
  ],
  network: () => ({ edges: [], diodes: [{ anode: 'a', cathode: 'k', vf: 1.78, led: true }] }),
};

export const SCENARIOS: Scenario[] = [
  cord('extensao-a', 'Extensão A', 'broken'),
  cord('extensao-b', 'Extensão B', 'short'),
  cord('extensao-c', 'Extensão C', 'none'),
  wall('parede-quarto', 'Fio na parede: circuito do quarto', false),
  wall('parede-varanda', 'Fio na parede: circuito da varanda', true),
  motor,
  glassFuse,
  ceramicFuse,
  lightSwitch,
  resistor,
  diode,
  led,
];

export function scenarioById(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Cenário desconhecido: ${id}`);
  return s;
}

// Solver

/**
 * Resistance between two nodes of a resistor network (Infinity when there
 * is no path). Injects 1 A at `p`, grounds `q` and solves the node
 * equations of the part of the network connected to `p`.
 */
export function resistanceBetween(edges: Edge[], p: string, q: string): number {
  if (p === q) return 0;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), e.b]);
    adj.set(e.b, [...(adj.get(e.b) ?? []), e.a]);
  }
  const seen = new Set([p]);
  const stack = [p];
  while (stack.length) {
    for (const n of adj.get(stack.pop()!) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  if (!seen.has(q)) return Infinity;

  const nodes = [...seen].filter((n) => n !== q);
  const index = new Map(nodes.map((n, i) => [n, i]));
  const size = nodes.length;
  const g = Array.from({ length: size }, () => new Array<number>(size + 1).fill(0));
  for (const e of edges) {
    if (!seen.has(e.a)) continue;
    const c = 1 / Math.max(e.ohms, 1e-9);
    const i = index.get(e.a);
    const j = index.get(e.b);
    if (i !== undefined) g[i]![i]! += c;
    if (j !== undefined) g[j]![j]! += c;
    if (i !== undefined && j !== undefined) {
      g[i]![j]! -= c;
      g[j]![i]! -= c;
    }
  }
  g[index.get(p)!]![size] = 1;

  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let r = col + 1; r < size; r++) {
      if (Math.abs(g[r]![col]!) > Math.abs(g[pivot]![col]!)) pivot = r;
    }
    [g[col], g[pivot]] = [g[pivot]!, g[col]!];
    const d = g[col]![col]!;
    for (let r = 0; r < size; r++) {
      if (r === col) continue;
      const f = g[r]![col]! / d;
      if (f === 0) continue;
      for (let k = col; k <= size; k++) g[r]![k]! -= f * g[col]![k]!;
    }
  }
  const i = index.get(p)!;
  return g[i]![size]! / g[i]![i]!;
}

// Display

/** Ohms the way a 6.000-count autoranging meter shows them. */
export function formatOhms(r: number, max = OHM_MAX): { digits: string; unit: string } {
  if (!(r < max)) return { digits: 'OL', unit: max <= CONT_MAX ? 'Ω' : 'MΩ' };
  if (r < 600) return { digits: r.toFixed(1), unit: 'Ω' };
  if (r < 6e3) return { digits: (r / 1e3).toFixed(3), unit: 'kΩ' };
  if (r < 60e3) return { digits: (r / 1e3).toFixed(2), unit: 'kΩ' };
  if (r < 600e3) return { digits: (r / 1e3).toFixed(1), unit: 'kΩ' };
  if (r < 6e6) return { digits: (r / 1e6).toFixed(3), unit: 'MΩ' };
  return { digits: (r / 1e6).toFixed(2), unit: 'MΩ' };
}

/** The same reading written the Brazilian way, for text: "4,700 kΩ". */
export function spoken(digits: string, unit: string): string {
  return digits === 'OL' ? 'OL' : `${digits.replace('.', ',')} ${unit}`;
}

// Measurement

export interface BenchState {
  scenario: string;
  fn: Fn;
  red: string | null;
  black: string | null;
  options: Record<string, boolean>;
}

export interface BenchReading {
  digits: string;
  unit: string;
  beep: boolean;
  tone: Tone;
  message: string;
  /** The LED lights up faintly with the diode-test current. */
  glow: boolean;
  /** Resistance between the tips, leads included (Ω and continuity). */
  ohms?: number;
}

const DIODE_GENERIC =
  'Na função de diodo, o multímetro empurra uma corrente pequena, perto de 1 mA (típico), e mostra a tensão que aparece entre as pontas. Em fios e contatos ela fica perto de zero. Essa função serve para diodos e LEDs; para fios, use a continuidade.';

export function measure(state: BenchState): BenchReading {
  const scenario = scenarioById(state.scenario);
  const red = scenario.points.find((p) => p.id === state.red);
  const black = scenario.points.find((p) => p.id === state.black);
  const blank = { digits: 'OL', unit: state.fn === 'diode' ? 'V' : 'Ω', beep: false, glow: false };

  if (!red || !black) {
    return {
      ...blank,
      tone: 'idle',
      message:
        'Com as pontas no ar, não há caminho entre elas e o visor mostra OL. Encoste a ponta vermelha e a preta: clique em dois pontos do desenho, ou escolha os pontos nas listas.',
    };
  }

  const net = scenario.network(state.options);
  const diode = net.diodes?.find(
    (d) =>
      (d.anode === red.id && d.cathode === black.id) ||
      (d.anode === black.id && d.cathode === red.id),
  );
  const ohms = red.id === black.id ? LEADS : resistanceBetween(net.edges, red.id, black.id) + LEADS;

  if (state.fn === 'diode') {
    if (diode) {
      const forward = diode.anode === red.id;
      if (!forward) {
        return {
          ...blank,
          tone: 'ok',
          message:
            'OL: com a ponta vermelha no catodo, o diodo fica polarizado ao contrário e bloqueia a corrente. Um diodo bom mostra um valor num sentido e OL no outro. Em curto, mostra perto de zero nos dois; aberto, OL nos dois.',
        };
      }
      const v = diode.vf.toFixed(3);
      return {
        digits: v,
        unit: 'V',
        beep: false,
        glow: !!diode.led,
        tone: 'ok',
        message: diode.led
          ? `${v.replace('.', ',')} V, e o LED acende fraquinho: a corrente de teste é pequena. LEDs vermelhos ficam perto de 1,8 V; azuis e brancos precisam de cerca de 3 V, e muitos multímetros não conseguem medi-los nem acendê-los nessa função.`
          : `${v.replace('.', ',')} V: a queda de tensão direta de um diodo de silício, tipicamente entre 0,5 V e 0,7 V. A ponta vermelha está no anodo e a preta no catodo, o lado da faixa.`,
      };
    }
    const v = (ohms - LEADS) * DIODE_CURRENT;
    if (!(v < DIODE_MAX)) return { ...blank, tone: 'info', message: DIODE_GENERIC };
    return {
      digits: v.toFixed(3),
      unit: 'V',
      beep: false,
      glow: false,
      tone: 'info',
      message: DIODE_GENERIC,
    };
  }

  if (diode) {
    return {
      ...blank,
      tone: 'info',
      message:
        state.fn === 'cont'
          ? 'A continuidade não apita num diodo: a queda de tensão dele é alta demais para o bipe. Para testar diodos e LEDs, use a função de diodo (➝|).'
          : 'Na função Ω, muitos multímetros mostram OL nos dois sentidos, ou um valor que muda com a escala: a tensão de teste do ohmímetro pode ser baixa demais para o diodo conduzir. Para testar diodos e LEDs, use a função de diodo (➝|).',
    };
  }

  const shown = formatOhms(ohms, state.fn === 'cont' ? CONT_MAX : OHM_MAX);
  const beep = state.fn === 'cont' && ohms < BEEP_LIMIT;
  const base = { ...shown, beep, glow: false, ohms };

  if (red.id === black.id) {
    return {
      ...base,
      tone: 'info',
      message:
        'As duas pontas no mesmo ponto: o visor mostra só a resistência das próprias pontas e dos contatos, cerca de 0,2 Ω (típico). Nas medidas de fios e contatos, desconte esse valor.',
    };
  }

  const specific = scenario.explain?.({
    fn: state.fn,
    red,
    black,
    ohms,
    options: state.options,
  });
  if (specific) return { ...base, tone: specific.tone, message: specific.text };

  if (ohms === Infinity) {
    return {
      ...base,
      tone: 'info',
      message:
        'OL: nenhum caminho entre os dois pontos, ou uma resistência maior do que o multímetro alcança.',
    };
  }
  return {
    ...base,
    tone: 'info',
    message:
      ohms < BEEP_LIMIT
        ? 'Resistência quase zero: há um caminho direto entre os dois pontos.'
        : 'O visor mostra a resistência do caminho entre as pontas.',
  };
}
