import { defineCircuit } from '../../engine';
import type { ElementDoc, Vec2 } from '../../engine';

let wires = 0;
const wire = (...points: Vec2[]): ElementDoc => ({ id: `W${++wires}`, type: 'wire', points });
let grounds = 0;
const ground = (at: Vec2): ElementDoc => ({ id: `GND${++grounds}`, type: 'ground', at });

/**
 * Lesson 16.3: the whole gate operator on the simulator, the reference circuit
 * of docs/plano/05-portao.md (section 5.1) with the CD-1 firmware running on
 * the microcontroller. The microcontroller sits in the middle with its inputs
 * on the left (trimpots, radio receiver and photocell above, jumper, buttons
 * and limit switches below) and the relay drivers on the right. The power
 * loop runs from the relays to the motor, down through the current sensor to
 * the mains and back through the fuse and the TRIAC.
 */
export default defineCircuit({
  id: 'm16/portao-completo',
  title: 'A central CD-1 completa, ligada ao motor e ao portão',
  description:
    'O circuito inteiro do automatizador. No meio está o microcontrolador com o programa da CD-1. À esquerda ficam as entradas: os trimpots PAUSA e FORÇA, o receptor do controle remoto e a fotocélula, em cima; o jumper J2, os botões PROG e da botoeira e os dois reed switches de fim de curso, embaixo. À direita, transistores acionam os relés K1 e K2, e o laço de força percorre a rede de 127 V, o fusível de 10 A e o TRIAC até o comum de K1. Em repouso, K1 leva a fase a K2; acionado, ao fio ABRE do motor. K2 acionado leva a fase ao fio FECHA. O capacitor de 25 µF fica entre ABRE e FECHA, e o comum do motor volta ao neutro por um sensor de corrente. O motor move o portão de 4 m, que começa fechado, com o ímã no reed FCF. Para simplificar, o esquema usa o mesmo símbolo de terra para o terra da rede e para o GND da lógica; na placa, a fonte chaveada isola os 12 V da rede.',
  analysis: { kind: 'quasi-static', frequency: 60, dtMech: 0.01 },
  elements: [
    // Supplies: 12 V for the relays and the photocell (rail on top), 5 V for the logic.
    {
      id: 'V12',
      type: 'dc-voltage',
      a: [4, -29],
      b: [4, -23],
      params: { voltage: 12 },
    },
    ground([4, -23]),
    wire([-44, -29], [4, -29], [20, -29]),
    {
      id: 'V5',
      type: 'dc-voltage',
      a: [-39, -17],
      b: [-39, -12],
      params: { voltage: 5 },
    },
    ground([-39, -12]),
    wire([-39, -17], [-35, -17], [-25, -17], [-15, -17], [0, -17]),

    // The microcontroller with the CD-1 program.
    {
      id: 'U1',
      type: 'mcu',
      at: [0, 0],
      params: {
        firmware: 'm16/central-generica',
        pinsLeft: 'PAUSA,FORCA,RF,FOTO,LUZ,J2,PROG,BOT,FCF,FCA',
        pinsRight: 'K2,K1,TRIAC,CORRENTE,LED_PROG,TRAVA,AUX,BUZZER,J1,INV',
      },
      label: 'Microcontrolador',
    },
    wire([0, -11], [0, -17]),
    ground([0, 11]),

    // Trimpots: the cursor goes to the pin, the ends to GND and 5 V.
    {
      id: 'PAUSA',
      type: 'trimpot',
      at: [-11, -12],
      rot: 180,
      params: { position: 0 },
      label: 'PAUSA',
      control: { param: 'position', label: 'Trimpot PAUSA', kind: 'slider', min: 0, max: 1, step: 0.05 },
    },
    wire([-6, -9], [-11, -9]),
    ground([-7, -12]),
    wire([-15, -12], [-15, -17]),
    {
      id: 'FORCA',
      type: 'trimpot',
      at: [-21, -10],
      rot: 180,
      params: { position: 0.5 },
      label: 'FORÇA',
      control: { param: 'position', label: 'Trimpot FORÇA', kind: 'slider', min: 0, max: 1, step: 0.05 },
    },
    wire([-6, -7], [-21, -7]),
    ground([-17, -10]),
    wire([-25, -10], [-25, -17]),

    // Radio receiver of the remote.
    {
      id: 'RX',
      type: 'rf-receiver',
      at: [-31, -11],
      label: 'Receptor',
      control: { param: 'press', label: 'Apertar o botão do controle remoto', kind: 'momentary' },
    },
    wire([-6, -5], [-27, -5], [-27, -11], [-28, -11]),
    wire([-34, -12], [-35, -12], [-35, -17]),
    wire([-34, -10], [-36, -10]),
    ground([-36, -10]),

    // Photocell: the NC contact goes to FOTO, closed while the beam is free.
    {
      id: 'PH',
      type: 'photocell',
      at: [-39, -1],
      label: 'Fotocélula',
      control: { param: 'blocked', label: 'Obstáculo no feixe da fotocélula', kind: 'toggle' },
    },
    wire([-6, -3], [-36, -3]),
    wire([-36, -1], [-34, -1]),
    ground([-34, -1]),
    wire([-42, -2], [-44, -2], [-44, -29]),
    wire([-42, 0], [-43, 0]),
    ground([-43, 0]),

    // Jumper, buttons and limit switches: each one closes its pin to GND.
    {
      id: 'J2',
      type: 'jumper',
      a: [-31, 1],
      b: [-31, 15],
      params: { fitted: false },
      label: 'J2',
      control: { param: 'fitted', label: 'Jumper J2 AUT (fecha sozinho)', kind: 'toggle' },
    },
    wire([-6, 1], [-31, 1]),
    ground([-31, 15]),
    {
      id: 'PROG',
      type: 'push-button',
      a: [-25, 3],
      b: [-25, 15],
      label: 'PROG',
      control: { param: 'pressed', label: 'Botão PROG da central', kind: 'momentary' },
    },
    wire([-6, 3], [-25, 3]),
    ground([-25, 15]),
    {
      id: 'BOT',
      type: 'push-button',
      a: [-20, 5],
      b: [-20, 15],
      label: 'BOT',
      control: { param: 'pressed', label: 'Botoeira', kind: 'momentary' },
    },
    wire([-6, 5], [-20, 5]),
    ground([-20, 15]),
    {
      id: 'FCF',
      type: 'reed-switch',
      a: [-15, 7],
      b: [-15, 15],
      params: { gate: 'G1', magnet: 0.03 },
      label: 'FCF',
    },
    wire([-6, 7], [-15, 7]),
    ground([-15, 15]),
    {
      id: 'FCA',
      type: 'reed-switch',
      a: [-10, 9],
      b: [-10, 15],
      params: { gate: 'G1', magnet: 3.97 },
      label: 'FCA',
    },
    wire([-6, 9], [-10, 9]),
    ground([-10, 15]),

    // LED PROG.
    wire([6, -1], [8, -1]),
    { id: 'R3', type: 'resistor', a: [8, -1], b: [8, 5], params: { resistance: 330 } },
    { id: 'LD1', type: 'led', a: [8, 5], b: [8, 10], params: { color: 'red' }, label: 'LED PROG' },
    ground([8, 10]),

    // K2 driver: base resistor, transistor, flyback diode across the coil.
    wire([6, -9], [8, -9], [8, -20], [10, -20]),
    { id: 'R2', type: 'resistor', a: [10, -20], b: [14, -20], params: { resistance: 1000 } },
    { id: 'Q3', type: 'npn', at: [16, -20] },
    ground([17, -18]),
    wire([17, -22], [20, -22], [25, -22]),
    { id: 'D2', type: 'diode', a: [20, -22], b: [20, -26] },
    wire([20, -26], [25, -26]),
    wire([20, -26], [20, -29]),

    // K1 driver.
    wire([6, -7], [9, -7], [9, -10], [10, -10]),
    { id: 'R1', type: 'resistor', a: [10, -10], b: [14, -10], params: { resistance: 1000 } },
    { id: 'Q2', type: 'npn', at: [16, -10] },
    ground([17, -8]),
    wire([17, -12], [20, -12], [25, -12]),
    { id: 'D1', type: 'diode', a: [20, -12], b: [20, -16] },
    wire([20, -16], [25, -16]),
    wire([20, -16], [19, -16], [19, -26], [20, -26]),

    // Relays: K1 picks ABRE; at rest it hands the phase to K2, which picks FECHA.
    { id: 'K2', type: 'relay-spdt', at: [27, -24], label: 'K2 FECHA' },
    { id: 'K1', type: 'relay-spdt', at: [27, -14], label: 'K1 ABRE' },
    wire([28, -16], [28, -19], [29, -19], [29, -22]),

    // Motor and capacitor.
    { id: 'M1', type: 'ac-motor-1ph-cap', at: [49, -21], rot: 270, label: 'Motor' },
    wire([30, -16], [40, -16], [40, -19], [46, -19]),
    wire([30, -26], [40, -26], [40, -23], [46, -23]),
    {
      id: 'C1',
      type: 'capacitor',
      a: [40, -19],
      b: [40, -23],
      params: { capacitance: 25e-6, voltage: 250, acRated: true },
      label: 'C1',
    },

    // From the common of K1 through the TRIAC and the fuse to the mains, and
    // from the neutral through the current sensor back to the motor.
    wire([29, -12], [29, -3], [30, -3]),
    { id: 'Q1', type: 'triac', at: [32, -3], flip: true, label: 'TRIAC' },
    { id: 'F1', type: 'fuse', a: [34, -3], b: [38, -3], params: { rating: 10 } },
    wire([38, -3], [39, -3], [39, -4]),
    {
      id: 'AC',
      type: 'mains',
      at: [41, -6],
      rot: 270,
      flip: true,
      label: 'Rede',
      control: { param: 'on', label: 'Disjuntor do portão ligado', kind: 'toggle' },
    },
    ground([43, -4]),
    wire([41, -4], [41, -1], [45, -1], [45, -3], [46, -3]),
    { id: 'CS', type: 'current-sensor', at: [49, -2], flip: true, label: 'Sensor' },
    ground([48, 0]),
    wire([52, -3], [53, -3], [53, -21], [52, -21]),

    // TRIAC gate and current sensor output, under the power loop.
    wire([6, -5], [21, -5], [21, 1], [31, 1], [31, -1]),
    wire([6, -3], [19, -3], [19, 3], [50, 3], [50, 0]),

    // The gate, moved by the motor.
    {
      id: 'G1',
      type: 'gate-mechanics',
      at: [47, -28],
      params: { motor: 'M1' },
      label: 'Portão',
      control: { param: 'obstacle', label: 'Obstáculo no caminho do portão', kind: 'toggle' },
    },
  ],
  probes: [{ id: 'IM', kind: 'current', element: 'M1', label: 'Corrente do motor' }],
});
