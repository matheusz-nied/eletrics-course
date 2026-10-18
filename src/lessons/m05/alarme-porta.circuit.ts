import { defineCircuit } from '../../engine';

/**
 * 05.5: a closed (NF) alarm loop. Three reed sensors, closed while their
 * magnets are near (doors and window shut), and the loop wire in series hold
 * a relay pulled in; the relay's NF contact feeds the siren. Opening any door
 * or cutting the wire drops the relay and the siren sounds: fail-safe.
 */
export default defineCircuit({
  id: 'm05/alarme-porta',
  title: 'Laço fechado de alarme com sensores reed',
  description:
    'Uma bateria de 12 V alimenta um laço em série com três sensores magnéticos reed, o da porta da frente, o da janela da sala e o da porta da cozinha, e o fio do laço. Com as portas e a janela fechadas, os ímãs ficam perto dos sensores, os contatos ficam fechados e o laço leva cerca de 30 mA à bobina de um relé, que fica atraído. O comum do relé recebe os 12 V; o contato NA acende um LED verde de pronto e o contato NF liga a sirene, que fica em silêncio enquanto o relé está atraído. Se uma porta abre ou o fio do laço é cortado, a corrente do laço cai a zero, o relé solta, o LED apaga, o contato NF fecha e a sirene toca.',
  analysis: { kind: 'transient', dt: 2e-4, speed: 1 },
  elements: [
    {
      id: 'B1',
      type: 'battery',
      a: [0, 8],
      b: [0, 24],
      label: 'Bateria',
      params: { voltage: 12, resistance: 0.05 },
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 8],
        [0, 0],
        [2, 0],
      ],
    },
    {
      id: 'S1',
      type: 'reed-switch',
      a: [2, 0],
      b: [8, 0],
      label: 'Porta da frente',
      params: { closed: true },
      control: { param: 'closed', label: 'Porta da frente fechada (ímã perto)', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [8, 0],
        [14, 0],
      ],
    },
    {
      id: 'S2',
      type: 'reed-switch',
      a: [14, 0],
      b: [20, 0],
      label: 'Janela da sala',
      params: { closed: true },
      control: { param: 'closed', label: 'Janela da sala fechada (ímã perto)', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [20, 0],
        [26, 0],
      ],
    },
    {
      id: 'S3',
      type: 'reed-switch',
      a: [26, 0],
      b: [32, 0],
      label: 'Porta da cozinha',
      params: { closed: true },
      control: { param: 'closed', label: 'Porta da cozinha fechada (ímã perto)', kind: 'toggle' },
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [32, 0],
        [38, 0],
      ],
    },
    {
      id: 'FIO',
      type: 'switch',
      a: [38, 0],
      b: [44, 0],
      label: 'Fio do laço',
      params: { closed: true },
      control: { param: 'closed', label: 'Fio do laço inteiro', kind: 'toggle' },
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [44, 0],
        [54, 0],
        [54, 12],
        [48, 12],
        [42, 12],
      ],
    },
    {
      id: 'K1',
      type: 'relay-spdt',
      at: [40, 10],
      rot: 180,
      label: 'Relé',
      params: { coilVoltage: 12, coilResistance: 400, coilInductance: 0.15 },
    },
    {
      id: 'D1',
      type: 'diode',
      a: [48, 8],
      b: [48, 12],
      label: 'Diodo',
    },
    {
      id: 'W6',
      type: 'wire',
      points: [
        [42, 8],
        [45, 8],
        [48, 8],
      ],
    },
    { id: 'G2', type: 'ground', at: [45, 8] },
    {
      id: 'W7',
      type: 'wire',
      points: [
        [0, 8],
        [38, 8],
      ],
    },
    {
      id: 'W8',
      type: 'wire',
      points: [
        [39, 12],
        [39, 16],
      ],
    },
    {
      id: 'BZ',
      type: 'buzzer',
      a: [39, 16],
      b: [39, 24],
      label: 'Sirene',
      params: { voltage: 12, current: 0.03, frequency: 3000 },
    },
    {
      id: 'W10',
      type: 'wire',
      points: [
        [37, 12],
        [37, 14],
        [24, 14],
      ],
    },
    {
      id: 'R1',
      type: 'resistor',
      a: [24, 14],
      b: [24, 18],
      label: 'R1',
      params: { resistance: 1000 },
    },
    {
      id: 'LED1',
      type: 'led',
      a: [24, 18],
      b: [24, 22],
      label: 'Pronto',
      params: { color: 'green' },
    },
    {
      id: 'W9',
      type: 'wire',
      points: [
        [0, 24],
        [24, 24],
        [39, 24],
      ],
    },
    {
      id: 'W11',
      type: 'wire',
      points: [
        [24, 22],
        [24, 24],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 24] },
  ],
  probes: [{ id: 'IL', kind: 'current', element: 'S1', label: 'Corrente no laço' }],
  goals: [
    {
      id: 'laco',
      description: 'Aperte o play: com tudo fechado, o laço conduz cerca de 30 mA e segura o relé.',
      check: { readout: 'IL', op: 'between', value: [0.029, 0.031] },
    },
    {
      id: 'silencio',
      description: 'Com o relé atraído, o contato NF fica aberto e a sirene fica em silêncio.',
      check: { readout: 'BZ.sounding', op: '==', value: false },
    },
    {
      id: 'porta',
      description: 'Abra a porta da frente: a corrente do laço cai a zero e a sirene toca.',
      check: { readout: 'S1.voltage', op: '>', value: 11 },
      solution: { 'S1.closed': false },
    },
    {
      id: 'fio',
      description: 'Feche a porta e corte o fio do laço: a sirene toca do mesmo jeito.',
      check: { readout: 'FIO.voltage', op: '>', value: 11 },
      solution: { 'FIO.closed': false },
    },
  ],
});
