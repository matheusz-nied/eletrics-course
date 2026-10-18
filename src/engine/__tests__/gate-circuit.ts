import type { CircuitDoc } from '../contract';
import { netlist, type NetPart } from './utils';

/** Variations of the reference circuit for the tests. */
export interface Options {
  /** ABRE and FECHA wires swapped at the motor. */
  swapped?: boolean;
  /** DIP 1 INV on. */
  inv?: boolean;
  /** Where the gate starts (m, 0 = closed). */
  position?: number;
  /** FORÇA trimpot position (0 to 1). */
  forca?: number;
}

/**
 * The reference circuit of the gate operator (docs/plano/05-portao.md,
 * section 5.1): mains, fuse, TRIAC, the K1/K2 relays choosing the winding,
 * the motor with its capacitor, the microcontroller with the course firmware,
 * limit switches on the gate, photocell, push button, remote, jumpers, DIP
 * switch and trimpots, all in the quasi-static analysis.
 */
export function gateCircuit(opts: Options = {}): CircuitDoc {
  // Transistor and flyback diode for a coil on 12 V.
  const driver = (n: string, coil: string, rb = 1000, q: NetPart['params'] = {}): NetPart[] => [
    { id: `RB${n}`, type: 'resistor', nodes: [`${n}B`, `${n}Bb`], params: { resistance: rb } },
    { id: `Q${n}`, type: 'npn', nodes: { b: `${n}Bb`, c: coil, e: '0' }, params: q },
    { id: `D${n}`, type: 'diode', nodes: [coil, 'V12'] },
  ];
  const parts: NetPart[] = [
    { id: 'AC', type: 'mains', nodes: { l: 'L', n: '0', pe: '0' } },
    { id: 'F1', type: 'fuse', nodes: ['L', 'LF'], params: { rating: 10 } },
    { id: 'Q1', type: 'triac', nodes: { mt2: 'LF', mt1: 'LT', g: 'TG' } },
    {
      id: 'K1',
      type: 'relay-spdt',
      nodes: { coil1: 'V12', coil2: 'K1C', com: 'LT', nc: 'K1NC', no: 'ABRE' },
    },
    {
      id: 'K2',
      type: 'relay-spdt',
      nodes: { coil1: 'V12', coil2: 'K2C', com: 'K1NC', nc: 'K2NC', no: 'FECHA' },
    },
    {
      id: 'M1',
      type: 'ac-motor-1ph-cap',
      nodes: opts.swapped
        ? { w1: 'FECHA', w2: 'ABRE', common: 'MC' }
        : { w1: 'ABRE', w2: 'FECHA', common: 'MC' },
    },
    {
      id: 'C1',
      type: 'capacitor',
      nodes: ['ABRE', 'FECHA'],
      params: { capacitance: 25e-6, voltage: 250, acRated: true },
    },
    { id: 'CS', type: 'current-sensor', nodes: { a: 'MC', b: '0', out: 'CORR', gnd: '0' } },
    { id: 'V12', type: 'dc-voltage', nodes: ['V12', '0'], params: { voltage: 12 } },
    { id: 'V5', type: 'dc-voltage', nodes: ['V5', '0'], params: { voltage: 5 } },
    {
      id: 'U1',
      type: 'mcu',
      params: { firmware: 'm16/central-generica' },
      nodes: {
        vcc: 'V5',
        gnd: '0',
        FCA: 'FCA',
        FCF: 'FCF',
        BOT: 'BOT',
        FOTO: 'FOTO',
        PROG: 'PROG',
        J1: 'J1',
        J2: 'J2',
        INV: 'INV',
        LUZ: 'LUZ',
        PAUSA: 'PAUSA',
        FORCA: 'FORCA',
        CORRENTE: 'CORR',
        RF: 'RF',
        K1: 'K1B',
        K2: 'K2B',
        TRIAC: 'TG',
        TRAVA: 'TRB',
      },
    },
    ...driver('K1', 'K1C'),
    ...driver('K2', 'K2C'),
    // The lock takes 1 A: a medium-power transistor with more base current.
    ...driver('TR', 'LK', 220, { beta: 100, power: 1.25, vceo: 80 }),
    { id: 'LOCK', type: 'electric-lock', nodes: ['V12', 'LK'] },
    { id: 'G1', type: 'gate-mechanics', nodes: {}, params: { motor: 'M1', position: opts.position ?? 0 } },
    {
      id: 'FCA',
      type: 'reed-switch',
      nodes: ['FCA', '0'],
      params: { gate: 'G1', magnet: 3.97 },
    },
    {
      id: 'FCF',
      type: 'reed-switch',
      nodes: ['FCF', '0'],
      params: { gate: 'G1', magnet: 0.03 },
    },
    { id: 'PH', type: 'photocell', nodes: { vp: 'V12', gnd: '0', nc: 'FOTO', com: '0', no: 'PHNO' } },
    { id: 'BOT', type: 'push-button', nodes: ['BOT', '0'] },
    { id: 'PROG', type: 'push-button', nodes: ['PROG', '0'] },
    { id: 'J1', type: 'jumper', nodes: ['J1', '0'], params: { fitted: false } },
    { id: 'J2', type: 'jumper', nodes: ['J2', '0'], params: { fitted: false } },
    {
      id: 'DIP',
      type: 'dip-switch',
      nodes: { a1: 'INV', b1: '0', a2: 'LUZ', b2: '0' },
      params: { s1: opts.inv ?? false },
    },
    { id: 'PAUSA', type: 'trimpot', nodes: { a: '0', w: 'PAUSA', b: 'V5' }, params: { position: 0 } },
    {
      id: 'FORCA',
      type: 'trimpot',
      nodes: { a: '0', w: 'FORCA', b: 'V5' },
      params: { position: opts.forca ?? 0.5 },
    },
    { id: 'RX', type: 'rf-receiver', nodes: { vp: 'V5', gnd: '0', out: 'RF' } },
  ];
  return netlist('portao', parts, { kind: 'quasi-static', frequency: 60, dtMech: 0.01 });
}
