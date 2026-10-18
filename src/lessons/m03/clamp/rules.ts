/**
 * What a clamp meter (alicate amperímetro) shows for each load, for what its
 * jaw surrounds and for the kind of clamp. Pure, so lesson 3.3's ClampMeter
 * can be unit-tested (rules.test.ts).
 *
 * The jaw senses the magnetic field of the current passing through it: one
 * conductor gives its current, a whole cable (going and returning current)
 * gives almost zero, and the ×10 loop of a line splitter gives ten times the
 * current. An AC-only clamp is a current transformer and cannot see DC; an
 * AC/DC clamp (Hall sensor) shows the mean in A⎓ and the RMS in A~.
 * The motor and car values are examples, marked as such in the labels.
 */
import { displayValue } from '../multimeter/rules';

export type Load = 'chuveiro' | 'ferro' | 'portao' | 'partida';
export type Jaw = 'um' | 'cabo' | 'separador' | 'vazia';
export type Clamp = 'ca' | 'cacc-ac' | 'cacc-dc';

export const LOADS: { id: Load; label: string; detail: string; amps: number; dc: boolean }[] = [
  {
    id: 'chuveiro',
    label: 'Chuveiro de 5.500 W em 220 V',
    detail: 'Corrente alternada. Pela potência: 5.500 W ÷ 220 V = 25 A.',
    amps: 25,
    dc: false,
  },
  {
    id: 'ferro',
    label: 'Ferro de passar de 1.000 W em 127 V',
    detail: 'Corrente alternada. Pela potência: 1.000 W ÷ 127 V ≈ 7,87 A.',
    amps: 1000 / 127,
    dc: false,
  },
  {
    id: 'portao',
    label: 'Motor do portão em movimento (valor de exemplo)',
    detail:
      'Corrente alternada. Um motor de portão de 127 V costuma puxar poucos ampères; aqui, 2,4 A. O valor do seu está na etiqueta do motor.',
    amps: 2.4,
    dc: false,
  },
  {
    id: 'partida',
    label: 'Cabo da bateria do carro, na partida (valor de exemplo)',
    detail:
      'Corrente contínua. O motor de partida de um carro puxa tipicamente de 100 A a 200 A por alguns segundos; aqui, 150 A.',
    amps: 150,
    dc: true,
  },
];

export const JAWS: { id: Jaw; label: string }[] = [
  { id: 'um', label: 'Um só condutor' },
  { id: 'cabo', label: 'Os dois condutores juntos (o cabo inteiro)' },
  { id: 'separador', label: 'Separador de linha, na abertura ×10' },
  { id: 'vazia', label: 'Nada (garra vazia)' },
];

export const CLAMPS: { id: Clamp; label: string; short: string }[] = [
  { id: 'ca', label: 'Alicate só CA', short: 'só CA, A~' },
  { id: 'cacc-ac', label: 'Alicate CA/CC no modo A~', short: 'CA/CC, A~' },
  { id: 'cacc-dc', label: 'Alicate CA/CC no modo A⎓', short: 'CA/CC, A⎓' },
];

/** Largest current the display shows (a typical 600 A clamp). */
export const RANGE_A = 600;

export type Status = 'ok' | 'info' | 'warn';

export interface ClampReading {
  /** Characters for the display, as in the multimeter: " 25.00", " OL". */
  digits: string;
  flags: string[];
  status: Status;
  /** What is going on, in pt-BR. */
  message: string;
  /** Turns of the measured current through the jaw (0, 1 or 10; 0 also for the cable). */
  turns: number;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function clampRead(load: Load, jaw: Jaw, clamp: Clamp): ClampReading {
  const l = LOADS.find((x) => x.id === load)!;
  const flags = clamp === 'cacc-dc' ? ['AUTO', 'DC'] : ['AUTO', 'AC'];
  const zero = (status: Status, message: string, turns: number): ClampReading => ({
    digits: displayValue(0, 'A', true).digits,
    flags,
    status,
    message,
    turns,
  });

  if (jaw === 'vazia') {
    return zero(
      'info',
      'Garra vazia: nenhuma corrente passa por dentro dela, então o visor mostra zero.',
      0,
    );
  }
  if (l.dc && clamp === 'ca') {
    return zero(
      'warn',
      `Zero, mesmo com ${brl(l.amps)} A passando. O alicate só CA funciona como um transformador: ele só sente campo magnético que varia, e a corrente contínua da bateria produz um campo parado. Para corrente contínua, use um alicate CA/CC (sensor Hall) no modo A⎓.`,
      jaw === 'separador' ? 10 : 1,
    );
  }
  if (l.dc && clamp === 'cacc-ac') {
    return zero(
      'warn',
      'Quase zero: no modo A~, o alicate mede só a parte da corrente que varia, e a corrente da bateria é contínua. Passe para o modo A⎓.',
      jaw === 'separador' ? 10 : 1,
    );
  }
  if (!l.dc && clamp === 'cacc-dc') {
    return zero(
      'warn',
      'Quase zero: no modo A⎓, o alicate mostra a média da corrente, e a média de uma corrente alternada é zero. Para aparelhos ligados na tomada, use o modo A~.',
      jaw === 'separador' ? 10 : 1,
    );
  }
  if (jaw === 'cabo') {
    return zero(
      'warn',
      `Quase zero, com o aparelho funcionando. Dentro do cabo, a mesma corrente vai por um condutor e volta pelo outro: os dois campos magnéticos têm sentidos opostos e se anulam. Abrace um condutor só.`,
      0,
    );
  }

  const turns = jaw === 'separador' ? 10 : 1;
  const value = l.amps * turns;
  const zeroNote =
    clamp === 'cacc-dc'
      ? ' Antes de medir corrente contínua, aperte o botão de zerar (ZERO ou REL) com a garra vazia: o sensor Hall sente até o campo da Terra.'
      : '';
  if (value > RANGE_A) {
    return {
      digits: ' OL',
      flags,
      status: 'warn',
      message: `OL: com a abertura ×10, o alicate veria ${brl(value)} A, acima da escala de ${RANGE_A} A. O separador serve para correntes pequenas; para esta, abrace um condutor só.`,
      turns,
    };
  }
  const digits = displayValue(value, 'A', true).digits;
  if (turns === 10) {
    return {
      digits,
      flags,
      status: 'info',
      message: `O fio passa dez vezes pela garra, e o visor mostra dez vezes a corrente. Divida por 10: ${brl(l.amps)} A. A abertura ×10 serve para ler com mais precisão correntes pequenas, como a de um carregador.${zeroNote}`,
      turns,
    };
  }
  return {
    digits,
    flags,
    status: 'ok',
    message: `Certo: ${brl(l.amps)} A. A garra abraça um condutor só e mede a corrente sem abrir o circuito e sem encostar em metal.${zeroNote}`,
    turns,
  };
}
