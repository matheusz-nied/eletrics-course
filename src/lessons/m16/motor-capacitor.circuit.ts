import { defineCircuit } from '../../engine';

/**
 * Lesson 16.2: why the gate motor turns one way or the other. Each winding
 * is modelled as the motor running (resistance plus inductance, see
 * MOTOR_MODEL); the direction relay picks which winding gets the phase
 * directly, and the other one is fed through the capacitor.
 */

/**
 * One winding of a 1/4 CV, 127 V motor while it runs. The 30 Ω stands for
 * the copper and for the work the rotor does; the copper alone reads a few
 * ohms on a multimeter (FONTES.md). Teaching model, chosen so the main
 * winding takes about 3,3 A, typical of these motors.
 */
export const MOTOR_MODEL = { resistance: 30, inductance: 0.066 };
export const CAPACITOR = 40e-6;

export default defineCircuit({
  id: 'm16/motor-capacitor',
  title: 'Motor do portão: enrolamentos, capacitor e relé de sentido',
  description:
    'A rede de 127 V e 60 Hz chega ao comum de um relé de sentido. Em repouso, o relé põe a fase no enrolamento de abrir; acionado, no de fechar. As pontas dos dois enrolamentos são ligadas por um capacitor de 40 µF, e o outro lado dos enrolamentos (o comum do motor) vai ao neutro. O enrolamento ligado direto na fase tem a corrente atrasada; o que recebe corrente pelo capacitor tem a corrente adiantada, quase um quarto de ciclo antes. Essa diferença cria o campo girante. Trocar a posição do relé troca qual corrente vem primeiro e inverte o sentido. Com o capacitor desligado, só um enrolamento recebe corrente e o motor apenas zumbe.',
  analysis: { kind: 'transient', dt: 5e-5, speed: 0.05 },
  elements: [
    {
      id: 'V1',
      type: 'ac-voltage',
      a: [0, 0],
      b: [0, 24],
      params: { amplitude: 179.6, frequency: 60 },
      label: 'rede 127 V',
    },
    {
      id: 'W1',
      type: 'wire',
      points: [
        [0, 0],
        [3, 0],
      ],
    },
    {
      id: 'K1',
      type: 'switch-spdt',
      at: [6, 0],
      params: { actuated: false },
      label: 'relé de sentido',
      control: { param: 'actuated', label: 'Relé de sentido acionado (fechar)', kind: 'toggle' },
    },
    {
      id: 'W2',
      type: 'wire',
      points: [
        [9, -2],
        [18, -2],
      ],
    },
    {
      id: 'L1',
      type: 'inductor',
      a: [18, -2],
      b: [34, -2],
      params: { inductance: MOTOR_MODEL.inductance, resistance: MOTOR_MODEL.resistance },
      label: 'enrolamento ABRE',
    },
    {
      id: 'C1',
      type: 'capacitor',
      a: [18, -2],
      b: [18, 5],
      params: { capacitance: CAPACITOR, voltage: 400 },
      label: 'capacitor',
      control: {
        param: 'capacitance',
        label: 'Capacitor',
        kind: 'slider',
        min: 5e-6,
        max: 60e-6,
        step: 1e-6,
        unit: 'F',
      },
    },
    {
      id: 'S1',
      type: 'switch',
      a: [18, 5],
      b: [18, 12],
      params: { closed: true },
      label: 'ligação do capacitor',
      control: { param: 'closed', label: 'Capacitor ligado', kind: 'toggle' },
    },
    {
      id: 'W3',
      type: 'wire',
      points: [
        [9, 2],
        [9, 12],
        [18, 12],
      ],
    },
    {
      id: 'L2',
      type: 'inductor',
      a: [18, 12],
      b: [34, 12],
      params: { inductance: MOTOR_MODEL.inductance, resistance: MOTOR_MODEL.resistance },
      label: 'enrolamento FECHA',
    },
    {
      id: 'W4',
      type: 'wire',
      points: [
        [34, -2],
        [34, 12],
      ],
    },
    {
      id: 'W5',
      type: 'wire',
      points: [
        [34, 12],
        [34, 24],
        [0, 24],
      ],
    },
    { id: 'G', type: 'ground', at: [0, 24] },
  ],
  probes: [
    { id: 'IA', kind: 'current', element: 'L1', label: 'Corrente no enrolamento ABRE' },
    { id: 'IF', kind: 'current', element: 'L2', label: 'Corrente no enrolamento FECHA' },
    { id: 'VC', kind: 'voltage', plus: 'C1.a', minus: 'C1.b', label: 'Tensão no capacitor' },
  ],
});
