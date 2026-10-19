/**
 * Lesson 7.5 (tomadas e plugues): what a common three-lamp outlet tester and
 * a multimeter show for each way an outlet can be wired, in a 127/220 V
 * installation (127 V between phase and neutral, 220 V between two phases).
 *
 * The outlet holes are named by what the installer meant to put there: F
 * (the hole that should have the phase, by the installer's convention), N and
 * T (the offset earth hole). The tester has one lamp for each pair of holes;
 * real testers print the lamp order, the colours and the legend on the body.
 *
 * Simplified model: a lamp lights with the full mains voltage across it and
 * stays dark with about 0 V or with a loose (floating) side. The multimeter
 * on a floating conductor shows a "phantom" reading that means nothing.
 */

/** What reaches a hole of the outlet. */
export type Feed = 'fase' | 'fase2' | 'neutro' | 'terra' | 'solto';

export type Hole = 'F' | 'N' | 'T';
export type Pair = 'F-N' | 'F-T' | 'N-T';

export const PAIRS: Pair[] = ['F-N', 'F-T', 'N-T'];

export type CaseId =
  | 'correta'
  | 'fn-trocados'
  | 'sem-terra'
  | 'fase-no-terra'
  | 'sem-neutro'
  | 'neutro-no-terra'
  | 'duas-fases';

export interface OutletCase {
  id: CaseId;
  label: string;
  feeds: Record<Hole, Feed>;
  /** What happens with an appliance with a metal case plugged in (pt-BR). */
  appliance: string;
  /** What the student should conclude from the readings (pt-BR). */
  verdict: string;
  /** Grave risk of shock: fix before using the outlet. */
  danger: boolean;
}

/** Mains voltages of a 127/220 V installation (V, RMS). */
export const V_FN = 127;
export const V_FF = 220;
/** A tester lamp lights from this voltage on (simplified threshold, V). */
export const LAMP_ON = 100;

export const CASES: OutletCase[] = [
  {
    id: 'correta',
    label: 'Ligação correta',
    feeds: { F: 'fase', N: 'neutro', T: 'terra' },
    appliance:
      'O aparelho funciona e a carcaça metálica está ligada ao terra. Se um fio interno encostar nela, a corrente de falha vai pelo fio terra e o DR (ou o disjuntor) desliga o circuito.',
    verdict: 'Fase onde o instalador quis, neutro no outro furo e o terra ligado.',
    danger: false,
  },
  {
    id: 'fn-trocados',
    label: 'Fase e neutro trocados',
    feeds: { F: 'neutro', N: 'fase', T: 'terra' },
    appliance:
      'O aparelho funciona normalmente e o terra continua protegendo. O problema é de manutenção: quem confiar na convenção da casa vai achar que o furo F é o neutro. Por isso ninguém mexe em tomada confiando em convenção: mede.',
    verdict:
      'A fase está no furo que o instalador reservou para o neutro. Não é perigoso por si só, porque o plugue brasileiro de dois pinos entra nos dois sentidos, mas vale corrigir para manter o padrão da casa.',
    danger: false,
  },
  {
    id: 'sem-terra',
    label: 'Terra ausente (fio solto ou inexistente)',
    feeds: { F: 'fase', N: 'neutro', T: 'solto' },
    appliance:
      'O aparelho funciona normalmente, e é por isso que esse defeito passa anos despercebido. Sem terra, uma falha de isolação deixa a carcaça com tensão, e a corrente só encontra caminho pelo corpo de quem encostar nela. O DR ainda desliga, mas só depois que a corrente já passa pela pessoa.',
    verdict:
      'O pino terra não está ligado a nada. A tomada parece boa, mas a proteção do terra não existe.',
    danger: true,
  },
  {
    id: 'fase-no-terra',
    label: 'Fase e terra trocados (fase no pino terra)',
    feeds: { F: 'terra', N: 'neutro', T: 'fase' },
    appliance:
      'O aparelho não funciona (os pinos de força recebem terra e neutro) e a carcaça metálica recebe a fase assim que o plugue entra. Encostar nele e numa torneira, numa parede ou no chão é levar um choque com a tensão cheia da rede. Não use a tomada: desligue o disjuntor e corrija.',
    verdict:
      'A ligação mais perigosa de todas: o pino que deveria proteger está energizado. Com DR no circuito, ele desarma quando a corrente começar a fugir pela carcaça, por um cano ou por uma pessoa.',
    danger: true,
  },
  {
    id: 'sem-neutro',
    label: 'Neutro interrompido',
    feeds: { F: 'fase', N: 'solto', T: 'terra' },
    appliance:
      'O aparelho não funciona, e a tomada parece "morta". Mas a fase continua chegando ao furo F, e com o aparelho ligado na chave o pino do neutro também fica com fase, através do próprio aparelho.',
    verdict:
      'O neutro se soltou em algum ponto (na tomada, numa emenda ou numa caixa antes dela). "Não funciona" não quer dizer "sem tensão".',
    danger: true,
  },
  {
    id: 'neutro-no-terra',
    label: 'Ponte do neutro para o terra na tomada',
    feeds: { F: 'fase', N: 'neutro', T: 'neutro' },
    appliance:
      'O aparelho funciona e o testador aprova, mas a carcaça está ligada ao neutro, não a um terra. Se o neutro se romper antes da tomada, a carcaça recebe a fase através do aparelho, sem nenhum aviso.',
    verdict:
      'Uma gambiarra comum para "fazer terra" onde não há fio terra. O testador não consegue distinguir isso de uma ligação correta. Não é aterramento, e a NBR 5410 não aceita o neutro fazendo o papel do condutor de proteção numa tomada de casa.',
    danger: true,
  },
  {
    id: 'duas-fases',
    label: 'Tomada de 220 V com duas fases',
    feeds: { F: 'fase', N: 'fase2', T: 'terra' },
    appliance:
      'Um aparelho de 220 V funciona e fica aterrado. Um aparelho só de 127 V ligado aqui recebe quase o dobro da tensão e queima. Identifique a tomada com uma etiqueta "220 V".',
    verdict:
      'Não é defeito: numa instalação 127/220 V, a tomada de 220 V recebe duas fases e nenhum neutro. Cada pino de força tem 127 V para o terra.',
    danger: false,
  },
];

export function getCase(id: CaseId): OutletCase {
  return CASES.find((c) => c.id === id)!;
}

export type Reading =
  | { kind: 'volts'; value: number; note?: string }
  | { kind: 'perto-de-zero' }
  | { kind: 'fantasma' };

/** Voltage between two feeds (V, RMS), or undefined when one is floating. */
export function voltageBetween(a: Feed, b: Feed): Reading {
  if (a === 'solto' || b === 'solto') return { kind: 'fantasma' };
  const live = (f: Feed) => f === 'fase' || f === 'fase2';
  if (live(a) && live(b))
    return a === b ? { kind: 'volts', value: 0 } : { kind: 'volts', value: V_FF };
  if (live(a) || live(b)) return { kind: 'volts', value: V_FN };
  // Neutral and earth meet at the service entrance; the neutral current makes a small difference.
  if (a !== b) return { kind: 'perto-de-zero' };
  return { kind: 'volts', value: 0, note: 'os dois estão ligados juntos' };
}

const holesOf = (pair: Pair) => pair.split('-') as [Hole, Hole];

export function reading(c: OutletCase, pair: Pair): Reading {
  const [x, y] = holesOf(pair);
  return voltageBetween(c.feeds[x], c.feeds[y]);
}

/** Whether the tester lamp across `pair` lights. */
export function lampLit(c: OutletCase, pair: Pair): boolean {
  const r = reading(c, pair);
  return r.kind === 'volts' && r.value >= LAMP_ON;
}

/** The tester pattern, as the lamps that light, in the order of PAIRS. */
export function pattern(c: OutletCase): boolean[] {
  return PAIRS.map((p) => lampLit(c, p));
}

/** "127 V", "perto de 0 V", "instável"… as the widget shows it (pt-BR). */
export function readingText(r: Reading): string {
  if (r.kind === 'fantasma') return 'instável (tensão fantasma)';
  if (r.kind === 'perto-de-zero') return 'perto de 0 V (até alguns volts)';
  return `${r.value} V`;
}

export const FEED_LABEL: Record<Feed, string> = {
  fase: 'fase',
  fase2: 'outra fase',
  neutro: 'neutro',
  terra: 'terra',
  solto: 'nada (solto)',
};

/**
 * Heat in a bad contact: an appliance of `power` watts on `voltage`, with a
 * contact of `resistance` ohms in series (P = I²·R, with I from the
 * appliance; the contact barely changes the current).
 */
export function contactHeat(power: number, voltage: number, resistance: number): number {
  const current = power / voltage;
  return current * current * resistance;
}
