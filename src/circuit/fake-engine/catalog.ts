/**
 * Device catalog of the stand-in engine: pins, parameters and readouts of every
 * device type in docs/plano/02-arquitetura.md (section 5.3), as proposed to the
 * Simulação front. The real engine (src/engine) is the source of truth once it
 * lands; this file only lets the schematic be built and tested before that.
 */
import type { DeviceInfo, ParamInfo, ParamValue, PinInfo, Vec2 } from '../../engine/contract';

const TWO: PinInfo[] = [
  { name: 'a', offset: [0, 0] },
  { name: 'b', offset: [0, 0] },
];

const COMMON_2 = ['current', 'voltage', 'power'];

function pins(spec: Record<string, Vec2>): PinInfo[] {
  return Object.entries(spec).map(([name, offset]) => ({ name, offset }));
}

function two(
  type: string,
  label: string,
  params: Record<string, ParamInfo>,
  readouts: string[] = [],
): DeviceInfo {
  return { type, label, terminals: 'two', pins: TWO, params, readouts: [...COMMON_2, ...readouts] };
}

function fixed(
  type: string,
  label: string,
  pinSpec: Record<string, Vec2>,
  params: Record<string, ParamInfo>,
  readouts: string[] = [],
): DeviceInfo {
  const p = pins(pinSpec);
  return {
    type,
    label,
    terminals: 'fixed',
    pins: p,
    params,
    readouts: [...p.map((pin) => `pin.${pin.name}`), ...readouts],
  };
}

const R = (def: number, label = 'Resistência'): ParamInfo => ({
  default: def,
  label,
  unit: 'Ω',
  min: 0,
});

const DEVICES: DeviceInfo[] = [
  // Nível 1: same pins, parameters and readouts as the real engine (src/engine/devices).
  { type: 'wire', label: 'Fio', terminals: 'two', pins: TWO, params: {}, readouts: ['current'] },
  fixed('ground', 'Terra (referência)', { g: [0, 0] }, {}),
  two(
    'resistor',
    'Resistor',
    {
      resistance: R(1000),
      watts: { default: 0.25, label: 'Potência nominal', unit: 'W', min: 0.01 },
      tolerance: { default: 5, label: 'Tolerância', unit: '%', min: 0, max: 20 },
    },
    ['temperature', 'burned'],
  ),
  two('battery', 'Pilha / bateria', {
    voltage: { default: 9, label: 'Tensão (força eletromotriz)', unit: 'V' },
    resistance: R(0.1, 'Resistência interna'),
  }),
  two('dc-voltage', 'Fonte de tensão contínua', {
    voltage: { default: 5, label: 'Tensão', unit: 'V' },
  }),
  two('dc-current', 'Fonte de corrente contínua', {
    current: { default: 0.01, label: 'Corrente', unit: 'A' },
  }),
  two('ac-voltage', 'Fonte de tensão alternada', {
    amplitude: { default: 10, label: 'Amplitude (pico)', unit: 'V', min: 0 },
    frequency: { default: 60, label: 'Frequência', unit: 'Hz', min: 0 },
    phase: { default: 0, label: 'Fase', unit: '°' },
    offset: { default: 0, label: 'Nível contínuo', unit: 'V' },
  }),
  two('switch', 'Chave liga/desliga', { closed: { default: false, label: 'Fechada (ligada)' } }, [
    'closed',
  ]),
  two(
    'push-button',
    'Botão pulsador',
    {
      pressed: { default: false, label: 'Apertado' },
      normallyClosed: { default: false, label: 'Normalmente fechado (NF)' },
    },
    ['pressed', 'closed'],
  ),
  fixed(
    'switch-spdt',
    'Chave de duas posições (SPDT)',
    { com: [-3, 0], nc: [3, -2], no: [3, 2] },
    {
      actuated: { default: false, label: 'Acionada (comum no NA)' },
    },
    ['actuated'],
  ),
  fixed(
    'potentiometer',
    'Potenciômetro',
    { a: [-4, 0], w: [0, -3], b: [4, 0] },
    {
      resistance: { default: 10000, label: 'Resistência total', unit: 'Ω', min: 1 },
      position: { default: 0.5, label: 'Posição do cursor', min: 0, max: 1 },
      taper: {
        default: 'linear',
        label: 'Curva',
        options: [
          { value: 'linear', label: 'Linear (B)' },
          { value: 'log', label: 'Logarítmica (A)' },
        ],
      },
      watts: { default: 0.5, label: 'Potência nominal', unit: 'W', min: 0.01 },
    },
    ['position', 'burned'],
  ),
  two(
    'capacitor',
    'Capacitor',
    {
      capacitance: { default: 1e-6, label: 'Capacitância', unit: 'F', min: 1e-15 },
      voltage: { default: 50, label: 'Tensão nominal', unit: 'V', min: 0 },
      polarized: { default: false, label: 'Polarizado (eletrolítico)' },
      ic: { default: 0, label: 'Tensão inicial', unit: 'V' },
    },
    ['bulged'],
  ),
  two('inductor', 'Indutor (bobina)', {
    inductance: { default: 1e-3, label: 'Indutância', unit: 'H', min: 1e-12 },
    resistance: R(0, 'Resistência do enrolamento'),
    ic: { default: 0, label: 'Corrente inicial', unit: 'A' },
  }),
  two(
    'lamp',
    'Lâmpada incandescente',
    {
      voltage: { default: 12, label: 'Tensão nominal', unit: 'V', min: 0.1 },
      power: { default: 5, label: 'Potência nominal', unit: 'W', min: 0.01 },
    },
    ['brightness', 'temperature', 'burned'],
  ),
  two(
    'fuse',
    'Fusível',
    {
      rating: { default: 1, label: 'Corrente nominal', unit: 'A', min: 1e-3 },
      kind: {
        default: 'fast',
        label: 'Tipo',
        options: [
          { value: 'fast', label: 'Rápido (F)' },
          { value: 'slow', label: 'Retardado (T)' },
        ],
      },
    },
    ['blown'],
  ),

  // Nível 2: same names as the real engine's level 2 (pins, params, readouts)
  two('diode', 'Diodo', {}, ['burned']),
  two(
    'led',
    'LED',
    {
      color: {
        default: 'red',
        label: 'Cor',
        options: [
          { value: 'red', label: 'Vermelho' },
          { value: 'yellow', label: 'Amarelo' },
          { value: 'green', label: 'Verde' },
          { value: 'blue', label: 'Azul' },
          { value: 'white', label: 'Branco' },
          { value: 'infrared', label: 'Infravermelho' },
        ],
      },
      imax: { default: 0.03, label: 'Corrente máxima', unit: 'A', min: 0 },
    },
    ['brightness', 'burned'],
  ),
  two(
    'zener',
    'Diodo zener',
    {
      voltage: { default: 5.1, label: 'Tensão zener', unit: 'V', min: 0 },
    },
    ['burned'],
  ),
  fixed(
    'npn',
    'Transistor NPN',
    { b: [-2, 0], c: [1, -2], e: [1, 2] },
    {
      beta: { default: 200, label: 'Ganho (β)', min: 1 },
    },
    ['burned'],
  ),
  fixed(
    'pnp',
    'Transistor PNP',
    { b: [-2, 0], c: [1, -2], e: [1, 2] },
    {
      beta: { default: 200, label: 'Ganho (β)', min: 1 },
    },
    ['burned'],
  ),
  fixed(
    'nmos',
    'MOSFET canal N',
    { g: [-2, 0], d: [1, -2], s: [1, 2] },
    {
      vth: { default: 2.5, label: 'Tensão de limiar', unit: 'V' },
    },
    ['burned'],
  ),
  fixed(
    'pmos',
    'MOSFET canal P',
    { g: [-2, 0], d: [1, -2], s: [1, 2] },
    {
      vth: { default: 2.5, label: 'Tensão de limiar', unit: 'V' },
    },
    ['burned'],
  ),
  fixed(
    'relay-spdt',
    'Relé',
    { coil1: [-2, -2], coil2: [-2, 2], com: [2, 2], nc: [1, -2], no: [3, -2] },
    {
      coilVoltage: { default: 12, label: 'Tensão da bobina', unit: 'V', min: 0 },
      coilResistance: R(400, 'Resistência da bobina'),
      coilInductance: { default: 0.15, label: 'Indutância da bobina', unit: 'H', min: 0 },
      travelTime: { default: 0.004, label: 'Tempo de comutação', unit: 's', min: 0 },
      contactRating: { default: 10, label: 'Corrente máxima do contato', unit: 'A', min: 0 },
    },
    ['closed', 'energized', 'position', 'coilCurrent', 'coilVoltage', 'welded'],
  ),
  fixed(
    'transformer',
    'Transformador',
    { p1: [-2, -2], p2: [-2, 2], s1: [2, -2], s2: [2, 2] },
    {
      ratio: { default: 10, label: 'Relação de espiras (primário : secundário)', min: 0 },
    },
  ),
  two(
    'dc-motor',
    'Motor CC',
    {
      resistance: R(2, 'Resistência do enrolamento'),
      ke: { default: 0.01, label: 'Constante de força contraeletromotriz', unit: 'V·s/rad' },
      load: { default: 0, label: 'Carga', unit: 'N·m', min: 0 },
    },
    ['rpm', 'speed', 'torque', 'burned'],
  ),
  two('buzzer', 'Buzzer', { resistance: R(200) }, ['sounding']),
  two('ldr', 'LDR (resistor sensível à luz)', {
    lux: { default: 100, label: 'Iluminação', unit: 'lx', min: 0 },
  }),
  two('ntc', 'Termistor NTC', {
    resistance: R(10000, 'Resistência a 25 °C'),
    temperature: { default: 25, label: 'Temperatura', unit: '°C' },
  }),
  fixed(
    'opamp',
    'Amplificador operacional',
    { inn: [-3, -1], inp: [-3, 1], out: [3, 0] },
    {
      vcc: { default: 12, label: 'Alimentação positiva', unit: 'V' },
      vee: { default: -12, label: 'Alimentação negativa', unit: 'V' },
      headroom: { default: 1.5, label: 'Margem até a alimentação', unit: 'V', min: 0 },
    },
    ['vout', 'saturated'],
  ),
  fixed(
    'timer-555',
    'Temporizador 555',
    {
      reset: [-1, -5],
      vcc: [1, -5],
      dis: [-4, -2],
      thres: [-4, 0],
      trig: [-4, 2],
      gnd: [-1, 5],
      ctrl: [1, 5],
      out: [4, 0],
    },
    {},
    ['high', 'discharging', 'vout'],
  ),
  ...(['and', 'or', 'nand', 'nor', 'xor'] as const).map((g) =>
    fixed(
      g,
      `Porta ${g.toUpperCase()}`,
      { a: [-3, -1], b: [-3, 1], y: [3, 0] },
      {
        vcc: { default: 5, label: 'Nível lógico alto', unit: 'V' },
      },
      ['a', 'b', 'y'],
    ),
  ),
  fixed(
    'not',
    'Porta NOT (inversora)',
    { a: [-2, 0], y: [2, 0] },
    {
      vcc: { default: 5, label: 'Nível lógico alto', unit: 'V' },
    },
    ['a', 'y'],
  ),
  fixed('scr', 'SCR (tiristor)', { a: [-2, 0], k: [2, 0], g: [1, 2] }, {}),
  fixed('triac', 'TRIAC', { mt2: [-2, 0], mt1: [2, 0], g: [1, 2] }, {}),
  fixed('optocoupler', 'Optoacoplador', { a: [-3, -1], k: [-3, 1], c: [3, -1], e: [3, 1] }, {}),
  two(
    'breaker',
    'Disjuntor',
    {
      rating: { default: 10, label: 'Corrente nominal', unit: 'A', min: 0 },
      curve: {
        default: 'C',
        label: 'Curva',
        options: [
          { value: 'B', label: 'B (3 a 5 × In)' },
          { value: 'C', label: 'C (5 a 10 × In)' },
          { value: 'D', label: 'D (10 a 20 × In)' },
        ],
      },
      closed: { default: true, label: 'Ligado' },
    },
    ['closed', 'tripped', 'heat'],
  ),
  fixed(
    'rcd',
    'Dispositivo DR',
    { l1: [-3, -1], n1: [-3, 1], l2: [3, -1], n2: [3, 1] },
    {
      sensitivity: { default: 0.03, label: 'Sensibilidade (IΔn)', unit: 'A', min: 0 },
      closed: { default: true, label: 'Ligado' },
      test: { default: false, label: 'Botão de teste' },
    },
    ['closed', 'tripped', 'residual'],
  ),
  two(
    'human-body',
    'Corpo humano',
    {
      skin: {
        default: 'dry',
        label: 'Pele',
        options: [
          { value: 'dry', label: 'Seca' },
          { value: 'wet', label: 'Molhada' },
        ],
      },
      path: {
        default: 'hand-hand',
        label: 'Caminho da corrente',
        options: [
          { value: 'hand-hand', label: 'Mão a mão' },
          { value: 'hand-feet', label: 'Mão aos pés' },
          { value: 'hands-feet', label: 'Mãos aos pés' },
        ],
      },
    },
    ['currentRms', 'impedance', 'zone', 'effect', 'worst'],
  ),

  // Nível 3
  fixed(
    'ac-motor-1ph-cap',
    'Motor monofásico com capacitor',
    {
      w1: [-2, -3],
      w2: [2, -3],
      common: [0, 3],
    },
    {
      power: { default: 250, label: 'Potência', unit: 'W', min: 0 },
    },
    ['rpm', 'direction', 'torque', 'temperature', 'humming'],
  ),
  fixed(
    'ac-motor-3ph',
    'Motor trifásico',
    { u: [-2, -3], v: [0, -3], w: [2, -3] },
    {
      power: { default: 750, label: 'Potência', unit: 'W', min: 0 },
    },
    ['rpm', 'direction'],
  ),
  fixed(
    'mains',
    'Rede elétrica',
    { l: [2, -2], n: [2, 0], pe: [2, 2] },
    {
      voltage: { default: 127, label: 'Tensão (eficaz)', unit: 'V', min: 0 },
      frequency: { default: 60, label: 'Frequência', unit: 'Hz', min: 0 },
    },
  ),
  two(
    'reed-switch',
    'Reed switch',
    {
      closed: { default: false, label: 'Ímã perto' },
    },
    ['closed'],
  ),
  fixed(
    'photocell',
    'Fotocélula',
    { vp: [-3, -1], gnd: [-3, 1], nc: [3, -2], com: [3, 0], no: [3, 2] },
    { blocked: { default: false, label: 'Feixe interrompido' } },
    ['blocked'],
  ),
  fixed('mcu', 'Microcontrolador', {}, { firmware: { default: '', label: 'Firmware' } }),
  fixed(
    'rf-receiver',
    'Receptor de rádio 433 MHz',
    { vp: [-3, -1], gnd: [-3, 1], out: [3, 0] },
    {},
  ),
  fixed(
    'gate-mechanics',
    'Mecânica do portão',
    {},
    {
      length: { default: 4, label: 'Curso do portão', unit: 'm', min: 0 },
    },
    ['position', 'velocity'],
  ),
  two('electric-lock', 'Trava elétrica', { resistance: R(20) }, ['open']),
  two('jumper', 'Jumper', { fitted: { default: true, label: 'Colocado' } }),
  fixed(
    'dip-switch',
    'Chave DIP',
    {},
    {
      positions: { default: 2, label: 'Número de chaves', min: 1, max: 8 },
    },
  ),
  fixed(
    'trimpot',
    'Trimpot',
    { a: [-4, 0], w: [0, -3], b: [4, 0] },
    {
      resistance: R(10000, 'Resistência total'),
      position: { default: 0.5, label: 'Posição do cursor', min: 0, max: 1 },
    },
  ),
];

const BY_TYPE = new Map(DEVICES.map((d) => [d.type, d]));

/** Instance pins of devices whose pins depend on parameters (mcu, dip-switch). */
function instancePins(info: DeviceInfo, params: Record<string, ParamValue>): PinInfo[] {
  if (info.type === 'dip-switch') {
    const n = Math.max(1, Math.min(8, Math.round(Number(params.positions ?? 2))));
    const out: PinInfo[] = [];
    for (let i = 1; i <= n; i++) {
      out.push({ name: `a${i}`, offset: [-2, 2 * (i - 1)] });
      out.push({ name: `b${i}`, offset: [2, 2 * (i - 1)] });
    }
    return out;
  }
  if (info.type === 'mcu') {
    const left = String(params.pinsLeft ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const right = String(params.pinsRight ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return [
      ...left.map((name, i): PinInfo => ({ name, offset: [-4, 2 * i] })),
      ...right.map((name, i): PinInfo => ({ name, offset: [4, 2 * i] })),
    ];
  }
  return info.pins;
}

export function getDeviceInfo(type: string, params: Record<string, ParamValue> = {}): DeviceInfo {
  const info = BY_TYPE.get(type);
  if (!info) throw new Error(`Tipo de dispositivo desconhecido: "${type}"`);
  if (info.type !== 'dip-switch' && info.type !== 'mcu') return info;
  const p = instancePins(info, params);
  return { ...info, pins: p, readouts: [...p.map((pin) => `pin.${pin.name}`), ...info.readouts] };
}

export function listDevices(): DeviceInfo[] {
  return DEVICES;
}

export function hasDevice(type: string): boolean {
  return BY_TYPE.has(type);
}
