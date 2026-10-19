import { defineCircuit } from '../../engine';

/**
 * 07.2: an insulation fault inside a washing machine, with and without the
 * protective earth (PE), in the TN and TT earthing schemes, with and without
 * a 30 mA DR. The values the lesson quotes are checked in
 * ./maquina-de-lavar.test.ts.
 *
 * The soil is the reference (ground symbols). The utility grounds the
 * neutral (RB, 10 Ω, típico) and the house has its earth rod (RA, 30 Ω,
 * típico). In TN the mains device bonds PE to the neutral at the service
 * entrance (0,05 Ω); in TT there is no bond, and the only way from PE back
 * to the neutral is through the soil, RA + RB. The person's feet are on the
 * floor, at the soil's potential (barefoot on a floor on the ground).
 *
 * The two-pole changeover switch moves the machine's phase and neutral from
 * the circuit without DR (NA contacts, actuated) to the one with DR (NF):
 * like plugging it into another outlet. The switch in the green wire only
 * stands for the wire connected or loose: a real installation never has a
 * switch, fuse or breaker in the PE.
 */

/** Fault resistance between the phase and the metal case (Ω). */
export const FAULTS = {
  nenhuma: 1e12,
  umida: 20_000,
  ruim: 2_000,
  franca: 0.01,
};

/** Resistance between PE and neutral at the service entrance, by scheme (Ω). */
export const SCHEMES = { tn: 0.05, tt: 1e6 };

export default defineCircuit({
  id: 'm07/maquina-de-lavar',
  title: 'Falha de isolação na máquina de lavar',
  description:
    'Uma rede de 127 V alimenta uma máquina de lavar de 500 W por um disjuntor de 20 A. Uma chave de dois polos escolhe a tomada da máquina: no circuito sem DR ou no circuito com DR de 30 mA. Dentro da máquina, uma falha de isolação pode ligar a fase à carcaça de metal: sem falha, por isolação úmida (20 kΩ), por isolação ruim (2 kΩ) ou com o fio da fase encostado na carcaça. A carcaça pode estar ligada ou não ao fio terra (PE), que vai ao barramento de terra do quadro. O esquema de aterramento pode ser TN, com o terra ligado ao neutro na entrada, ou TT, com o terra só na haste da casa (30 Ω, típico); nos dois, a concessionária aterra o neutro na rua (10 Ω, típico). Uma pessoa descalça pode encostar a mão na carcaça: a corrente sai pelos pés para o chão, que está no potencial do solo. Sem terra e sem DR, com a fase na carcaça, a carcaça fica com cerca de 125 V e passam cerca de 107 mA pela pessoa, na zona de risco de fibrilação. Com terra no esquema TN, a corrente de falta passa de 200 A e o disjuntor desarma na hora. Com terra no esquema TT, a corrente de falta fica em cerca de 3 A, o disjuntor não desarma e a carcaça fica com cerca de 93 V. Com DR, o circuito desliga em poucos milésimos de segundo.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.005 },
  elements: [
    {
      id: 'REDE',
      type: 'mains',
      at: [0, 10],
      label: 'Rede 127 V',
      params: { voltage: 127, earth: SCHEMES.tn },
      control: {
        param: 'earth',
        label: 'Esquema de aterramento',
        kind: 'select',
        options: [
          { value: SCHEMES.tn, label: 'TN: terra ligado ao neutro na entrada' },
          { value: SCHEMES.tt, label: 'TT: terra só na haste da casa' },
        ],
      },
    },
    // Phase: mains → breaker → DR and the direct contact.
    {
      id: 'W1',
      type: 'wire',
      points: [
        [2, 8],
        [4, 8],
        [4, 2],
        [6, 2],
      ],
    },
    {
      id: 'DJ',
      type: 'breaker',
      a: [6, 2],
      b: [12, 2],
      label: 'Disjuntor',
      params: { rating: 20, curve: 'C' },
      control: { param: 'closed', label: 'Disjuntor ligado', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [12, 2],
        [16, 2],
        [19, 2],
      ],
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [16, 2],
        [16, 6],
        [29, 6],
      ],
    },
    {
      id: 'DR',
      type: 'rcd',
      at: [22, 3],
      label: 'DR',
      params: { sensitivity: 0.03 },
      control: { param: 'closed', label: 'DR ligado', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [25, 2],
        [29, 2],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [25, 4],
        [27, 4],
        [27, 8],
        [29, 8],
      ],
    },
    // Neutral: mains → DR and the direct contact; the utility grounds it.
    {
      id: 'W6',
      type: 'wire',
      points: [
        [2, 10],
        [8, 10],
        [8, 12],
        [14, 12],
        [29, 12],
      ],
    },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [14, 12],
        [14, 4],
        [19, 4],
      ],
    },
    {
      id: 'RB',
      type: 'resistor',
      a: [8, 12],
      b: [8, 18],
      label: 'Aterramento do neutro na rua',
      params: { resistance: 10, watts: 1e6 },
    },
    { id: 'G1', type: 'ground', at: [8, 18] },
    {
      id: 'CH',
      type: 'switch-dpdt',
      at: [32, 7],
      flip: true,
      label: 'Tomada da máquina',
      params: { actuated: true },
      control: {
        param: 'actuated',
        label: 'Tomada da máquina',
        kind: 'select',
        options: [
          { value: true, label: 'No circuito sem DR' },
          { value: false, label: 'No circuito com DR de 30 mA' },
        ],
      },
    },
    // The machine: its motor between phase and neutral, and the metal case.
    {
      id: 'W8',
      type: 'wire',
      points: [
        [35, 4],
        [40, 4],
        [46, 4],
      ],
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [35, 10],
        [40, 10],
      ],
    },
    {
      id: 'MAQ',
      type: 'resistor',
      a: [40, 4],
      b: [40, 10],
      label: 'Motor da máquina (500 W)',
      params: { resistance: 127 ** 2 / 500, watts: 1e6 },
    },
    {
      id: 'RF',
      type: 'resistor',
      a: [46, 4],
      b: [46, 12],
      label: 'Falha de isolação',
      params: { resistance: FAULTS.nenhuma, watts: 1e6 },
      control: {
        param: 'resistance',
        label: 'Falha de isolação (fase → carcaça)',
        kind: 'select',
        options: [
          { value: FAULTS.nenhuma, label: 'Sem falha' },
          { value: FAULTS.umida, label: 'Isolação úmida (20 kΩ)' },
          { value: FAULTS.ruim, label: 'Isolação ruim (2 kΩ)' },
          { value: FAULTS.franca, label: 'Fio da fase encostado na carcaça' },
        ],
      },
    },
    // Protective earth: case → green wire → earth bar of the panel → rod.
    {
      id: 'SPE',
      type: 'switch',
      a: [46, 12],
      b: [46, 17],
      label: 'Terra',
      params: { closed: false },
      control: { param: 'closed', label: 'Carcaça ligada ao terra (PE)', kind: 'toggle' },
    },
    {
      id: 'RPE',
      type: 'resistor',
      a: [46, 17],
      b: [46, 22],
      label: 'Fio terra (PE)',
      params: { resistance: 0.1, watts: 1e6 },
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [2, 12],
        [2, 22],
        [12, 22],
        [46, 22],
      ],
    },
    {
      id: 'RA',
      type: 'resistor',
      a: [12, 22],
      b: [12, 28],
      label: 'Haste de aterramento',
      params: { resistance: 30, watts: 1e6 },
    },
    { id: 'G2', type: 'ground', at: [12, 28] },
    // The person: hand on the case, bare feet on the floor.
    {
      id: 'W11',
      type: 'wire',
      points: [
        [46, 12],
        [52, 12],
      ],
    },
    {
      id: 'TOQUE',
      type: 'switch',
      a: [52, 12],
      b: [52, 17],
      label: 'Toque',
      params: { closed: false },
      control: { param: 'closed', label: 'Pessoa encosta na máquina', kind: 'toggle' },
    },
    {
      id: 'P',
      type: 'human-body',
      a: [52, 17],
      b: [52, 25],
      label: 'Pessoa descalça',
      params: { skin: 'dry', path: 'hand-feet' },
      control: {
        param: 'skin',
        label: 'Pele da mão',
        kind: 'select',
        options: [
          { value: 'dry', label: 'Seca' },
          { value: 'wet', label: 'Molhada' },
        ],
      },
    },
    { id: 'G3', type: 'ground', at: [52, 25] },
  ],
  probes: [
    { id: 'VC', kind: 'voltage', plus: 'RF.b', minus: 'GND', label: 'Carcaça × chão' },
    { id: 'IP', kind: 'current', element: 'P', label: 'Corrente pela pessoa' },
    { id: 'IDJ', kind: 'current', element: 'DJ', label: 'Corrente no disjuntor' },
    { id: 'IPE', kind: 'current', element: 'RPE', label: 'Corrente no fio terra' },
  ],
  goals: [
    {
      id: 'sem-terra',
      description:
        'Sem terra e sem DR, com a fase na carcaça, a pessoa que encosta leva um choque na zona AC-4',
      check: { readout: 'P.worst', op: '==', value: 'AC-4' },
      at: 1,
      solution: { 'RF.resistance': FAULTS.franca, 'TOQUE.closed': true },
    },
    {
      id: 'tn',
      description: 'Com a carcaça no terra, no esquema TN, o disjuntor desarma na hora',
      check: { readout: 'DJ.tripped', op: '==', value: true },
      at: 0.05,
      solution: { 'RF.resistance': FAULTS.franca, 'SPE.closed': true },
    },
    {
      id: 'tt',
      description:
        'No esquema TT, com a carcaça no terra e sem DR, o disjuntor não desarma e a carcaça fica com mais de 50 V',
      // A few amperes in the earth wire happen only in TT, with the breaker
      // still closed: then the case sits at RA × IPE, about 93 V. The case
      // voltage alone would also pass with the fault and no earth wire at all.
      check: { readout: 'IPE', op: 'between', value: [2, 5] },
      at: 1,
      solution: {
        'REDE.earth': SCHEMES.tt,
        'RF.resistance': FAULTS.franca,
        'SPE.closed': true,
      },
    },
    {
      id: 'dr',
      description: 'Ligue a máquina no circuito com DR: com a falha, o DR desarma',
      check: { readout: 'DR.tripped', op: '==', value: true },
      at: 0.05,
      solution: { 'CH.actuated': false, 'RF.resistance': FAULTS.franca, 'TOQUE.closed': true },
    },
  ],
});
