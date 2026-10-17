/**
 * What each readout means for the student: name, unit and how to print it.
 * Keys are "<element>.<quantity>" ("R1.current", "L1.brightness", "Q1.current.c")
 * or a probe id.
 */
import type { CircuitDoc, DeviceInfo, ProbeDoc } from '../engine/contract';
import { deviceInfo } from './engine';
import { formatSI } from './format';

export interface QuantityMeta {
  label: string;
  unit: string;
  /** Multiplier for display (0…1 → %). */
  scale?: number;
  /** Words for boolean readouts: [true, false]. */
  words?: [string, string];
}

const QUANTITIES: Record<string, QuantityMeta> = {
  current: { label: 'Corrente', unit: 'A' },
  voltage: { label: 'Tensão', unit: 'V' },
  power: { label: 'Potência', unit: 'W' },
  brightness: { label: 'Brilho', unit: '%', scale: 100 },
  temperature: { label: 'Temperatura', unit: '°C' },
  rpm: { label: 'Rotação', unit: 'rpm' },
  torque: { label: 'Torque', unit: 'N·m' },
  position: { label: 'Posição', unit: '%', scale: 100 },
  velocity: { label: 'Velocidade', unit: 'm/s' },
  direction: { label: 'Sentido', unit: '' },
  closed: { label: 'Contato', unit: '', words: ['fechado', 'aberto'] },
  blown: { label: 'Fusível', unit: '', words: ['queimado', 'inteiro'] },
  damaged: { label: 'Estado', unit: '', words: ['danificado', 'normal'] },
  tripped: { label: 'Proteção', unit: '', words: ['desarmou', 'armada'] },
  humming: { label: 'Zumbido', unit: '', words: ['sim', 'não'] },
  sounding: { label: 'Som', unit: '', words: ['tocando', 'em silêncio'] },
  blocked: { label: 'Feixe', unit: '', words: ['interrompido', 'livre'] },
  open: { label: 'Trava', unit: '', words: ['aberta', 'fechada'] },
  output: { label: 'Saída', unit: '', words: ['alta (1)', 'baixa (0)'] },
  burned: { label: 'Estado', unit: '', words: ['queimado', 'normal'] },
  pressed: { label: 'Botão', unit: '', words: ['apertado', 'solto'] },
  actuated: { label: 'Chave', unit: '', words: ['acionada', 'em repouso'] },
  resistance: { label: 'Resistência', unit: 'Ω' },
  charge: { label: 'Carga', unit: 'C' },
  energy: { label: 'Energia armazenada', unit: 'J' },
};

/**
 * Words for readouts the engine also describes (`readoutInfo`), used only when
 * it does not: the stand-in engine has no readoutInfo.
 */
const FALLBACK: Record<string, QuantityMeta> = {
  energized: { label: 'Bobina', unit: '', words: ['energizada', 'sem corrente'] },
  welded: { label: 'Contatos colados', unit: '', words: ['sim', 'não'] },
  heat: { label: 'Aquecimento (proteção térmica)', unit: '%', scale: 100 },
  residual: { label: 'Corrente de fuga', unit: 'A' },
  speed: { label: 'Velocidade angular', unit: 'rad/s' },
  zone: { label: 'Zona (IEC 60479)', unit: '' },
  effect: { label: 'Efeito no corpo', unit: '' },
  worst: { label: 'Pior zona atingida', unit: '' },
  high: { label: 'Saída', unit: '', words: ['alta (1)', 'baixa (0)'] },
  discharging: { label: 'Descarga (DIS)', unit: '', words: ['conduzindo', 'aberta'] },
  vout: { label: 'Tensão de saída', unit: 'V' },
  a: { label: 'Entrada A', unit: '', words: ['alta (1)', 'baixa (0)'] },
  b: { label: 'Entrada B', unit: '', words: ['alta (1)', 'baixa (0)'] },
  y: { label: 'Saída Y', unit: '', words: ['alta (1)', 'baixa (0)'] },
};

/**
 * Meaning of a readout of a device ("current", "pin.c", "heat"…): the course's
 * own words for common quantities, else the engine's `readoutInfo`.
 */
export function quantityMeta(quantity: string, info?: DeviceInfo): QuantityMeta {
  if (quantity.startsWith('pin.')) {
    const name = quantity.slice(4);
    const pin = info?.pins.find((p) => p.name === name);
    return { label: `Corrente no terminal ${pin?.label ?? name.toUpperCase()}`, unit: 'A' };
  }
  const own = QUANTITIES[quantity];
  if (own) return own;
  const engine = info?.readoutInfo?.[quantity];
  const fallback = FALLBACK[quantity];
  if (engine) {
    // the engine's label; a unitless fraction is shown as % like the course does
    if (!engine.unit && fallback) return { ...fallback, label: engine.label };
    return { label: engine.label, unit: engine.unit ?? '', words: ['sim', 'não'] };
  }
  return fallback ?? { label: quantity, unit: '' };
}

/** Splits "Q1.pin.c" into element "Q1" and quantity "pin.c". */
export function splitReadout(key: string): { element: string; quantity: string } {
  const i = key.indexOf('.');
  if (i < 0) return { element: key, quantity: '' };
  return { element: key.slice(0, i), quantity: key.slice(i + 1) };
}

export function formatQuantity(
  quantity: string,
  value: number | boolean | string | undefined,
  digits = 3,
  info?: DeviceInfo,
): string {
  if (value === undefined) return '—';
  const meta = quantityMeta(quantity, info);
  if (typeof value === 'boolean')
    return meta.words ? meta.words[value ? 0 : 1] : value ? 'sim' : 'não';
  if (typeof value === 'string') return value;
  if (quantity === 'direction')
    return value > 0 ? 'horário' : value < 0 ? 'anti-horário' : 'parado';
  return formatSI(value * (meta.scale ?? 1), meta.unit, { digits });
}

export interface ProbeMeta {
  label: string;
  unit: string;
  quantity: 'voltage' | 'current' | 'power';
}

export function probeMeta(probe: ProbeDoc): ProbeMeta {
  if (probe.kind === 'voltage') {
    const minus = probe.minus === 'GND' ? 'terra' : probe.minus;
    return {
      label: probe.label ?? `Tensão ${probe.plus} → ${minus}`,
      unit: 'V',
      quantity: 'voltage',
    };
  }
  const q = QUANTITIES[probe.kind]!;
  return {
    label: probe.label ?? `${q.label} em ${probe.element}`,
    unit: q.unit,
    quantity: probe.kind,
  };
}

/** Label for any series key used in charts: a probe id or a readout key. */
export function seriesMeta(
  key: string,
  doc: CircuitDoc,
): { label: string; unit: string; scale: number } {
  const probe = doc.probes?.find((p) => p.id === key);
  if (probe) {
    const m = probeMeta(probe);
    return { label: m.label, unit: m.unit, scale: 1 };
  }
  const { element, quantity } = splitReadout(key);
  const el = doc.elements.find((e) => e.id === element);
  const meta = quantityMeta(quantity, el && deviceInfo(el.type, el.params));
  return {
    label: `${meta.label} em ${el?.label ?? element}`,
    unit: meta.unit,
    scale: meta.scale ?? 1,
  };
}
