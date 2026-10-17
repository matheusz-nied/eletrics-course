import type { CircuitDoc, ControlDoc, DeviceInfo, ElementDoc, ParamValue } from '../contract';
import { findDevice } from '../devices';
import { pinPoints, pointKey, wirePoints } from './geometry';
import { structuralErrors } from './schema';

export interface ValidationResult {
  /** Problems that stop the circuit from loading (pt-BR). */
  errors: string[];
  /** Probable mistakes that still load, like a pin that touches nothing (pt-BR). */
  warnings: string[];
}

export class CircuitError extends Error {
  constructor(
    readonly circuit: string,
    readonly problems: string[],
  ) {
    super(`Circuito "${circuit}" inválido:\n- ${problems.join('\n- ')}`);
    this.name = 'CircuitError';
  }
}

/** Readouts every two-terminal device has. */
const TWO_TERMINAL_READOUTS = ['current', 'voltage', 'power'];

/** Readout names an element offers, including `pin.<name>` and wire segments. */
export function elementReadouts(el: ElementDoc, info: DeviceInfo): Set<string> {
  const names = new Set(info.readouts);
  if (info.terminals === 'two' && el.type !== 'wire')
    TWO_TERMINAL_READOUTS.forEach((r) => names.add(r));
  if (el.type === 'wire') {
    const segments = Math.max(wirePoints(el).length - 1, 1);
    for (let k = 0; k < segments; k++) names.add(`current.${k}`);
  } else {
    for (const pin of info.pins) names.add(`pin.${pin.name}`);
  }
  return names;
}

/** Checks a value against a parameter description; returns a pt-BR problem or undefined. */
export function checkParam(info: DeviceInfo, name: string, value: ParamValue): string | undefined {
  const p = info.params[name];
  if (!p) {
    const known = Object.keys(info.params);
    return `parâmetro desconhecido "${name}" (${info.type} aceita: ${known.length ? known.join(', ') : 'nenhum'})`;
  }
  if (typeof value !== typeof p.default) {
    return `"${name}" deve ser ${typeName(p.default)}, recebeu ${typeName(value)}`;
  }
  if (p.options && !p.options.some((o) => o.value === value)) {
    return `"${name}" = ${JSON.stringify(value)} não é aceito (opções: ${p.options.map((o) => JSON.stringify(o.value)).join(', ')})`;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return `"${name}" deve ser um número finito`;
    if (p.min !== undefined && value < p.min)
      return `"${name}" = ${value} abaixo do mínimo ${p.min}`;
    if (p.max !== undefined && value > p.max)
      return `"${name}" = ${value} acima do máximo ${p.max}`;
  }
  return undefined;
}

function typeName(v: ParamValue): string {
  return typeof v === 'number' ? 'número' : typeof v === 'boolean' ? 'verdadeiro/falso' : 'texto';
}

/** Full validation: structure (zod), then devices, pins, parameters, controls, probes and goals. */
export function validateCircuit(doc: unknown): ValidationResult {
  const structural = structuralErrors(doc);
  if (structural.length) return { errors: structural, warnings: [] };
  const circuit = doc as CircuitDoc;
  const errors: string[] = [];
  const warnings: string[] = [];

  const infos = new Map<string, DeviceInfo>();
  for (const el of circuit.elements) {
    const where = `elemento ${el.id}`;
    if (infos.has(el.id)) {
      errors.push(`${where}: id repetido`);
      continue;
    }
    const def = findDevice(el.type);
    if (!def) {
      errors.push(`${where}: tipo de dispositivo desconhecido "${el.type}"`);
      continue;
    }
    infos.set(el.id, def.info);
    const info = def.info;
    if (el.type === 'wire') {
      if (wirePoints(el).length < 2)
        errors.push(`${where}: fio precisa de "points" (2 ou mais) ou de "a" e "b"`);
    } else if (info.terminals === 'two') {
      if (!el.a || !el.b) errors.push(`${where}: ${info.type} precisa de "a" e "b"`);
      else if (el.a[0] === el.b[0] && el.a[1] === el.b[1])
        errors.push(`${where}: "a" e "b" no mesmo ponto`);
      else if (el.a[0] !== el.b[0] && el.a[1] !== el.b[1])
        warnings.push(`${where}: "a" e "b" não estão alinhados na horizontal nem na vertical`);
    } else if (!el.at) {
      errors.push(`${where}: ${info.type} precisa de "at"`);
    }
    for (const [name, value] of Object.entries(el.params ?? {})) {
      const problem = checkParam(info, name, value);
      if (problem) errors.push(`${where}: ${problem}`);
    }
    const controls: ControlDoc[] = el.control ? [el.control].flat() : [];
    for (const c of controls) {
      const p = info.params[c.param];
      if (!p) {
        errors.push(`${where}: controle de parâmetro desconhecido "${c.param}"`);
        continue;
      }
      const isBool = typeof p.default === 'boolean';
      if ((c.kind === 'toggle' || c.kind === 'momentary') && !isBool)
        errors.push(
          `${where}: controle "${c.kind}" precisa de um parâmetro verdadeiro/falso ("${c.param}" não é)`,
        );
      if (c.kind === 'slider' && typeof p.default !== 'number')
        errors.push(
          `${where}: controle "slider" precisa de um parâmetro numérico ("${c.param}" não é)`,
        );
      if (c.kind === 'select' && !(c.options?.length || p.options?.length))
        errors.push(`${where}: controle "select" sem opções para "${c.param}"`);
    }
  }
  if (errors.length) return { errors, warnings };

  // Readouts and pin references.
  const byId = new Map(circuit.elements.map((el) => [el.id, el]));
  const probeIds = new Set<string>();
  for (const probe of circuit.probes ?? []) {
    const where = `medidor ${probe.id}`;
    if (probe.id.includes('.')) errors.push(`${where}: o id não pode ter "."`);
    if (probeIds.has(probe.id) || byId.has(probe.id)) errors.push(`${where}: id repetido`);
    probeIds.add(probe.id);
    if (probe.kind === 'voltage') {
      for (const ref of [probe.plus, probe.minus]) {
        const problem = checkPinRef(ref, byId, infos);
        if (problem) errors.push(`${where}: ${problem}`);
      }
    } else {
      const el = byId.get(probe.element);
      const info = infos.get(probe.element);
      if (!el || !info) errors.push(`${where}: elemento "${probe.element}" não existe`);
      else if (!elementReadouts(el, info).has(probe.kind))
        errors.push(
          `${where}: ${probe.element} não tem leitura de ${probe.kind === 'current' ? 'corrente' : 'potência'}`,
        );
    }
  }
  const checkReadout = (key: string, where: string) => {
    if (probeIds.has(key)) return;
    const dot = key.indexOf('.');
    const el = dot > 0 ? byId.get(key.slice(0, dot)) : undefined;
    const info = el && infos.get(el.id);
    if (!el || !info) {
      errors.push(
        `${where}: leitura "${key}" não existe (use "Elemento.leitura" ou o id de um medidor)`,
      );
      return;
    }
    const name = key.slice(dot + 1);
    if (!elementReadouts(el, info).has(name))
      errors.push(
        `${where}: ${el.id} não tem a leitura "${name}" (tem: ${[...elementReadouts(el, info)].join(', ')})`,
      );
  };
  for (const goal of circuit.goals ?? []) {
    checkReadout(goal.check.readout, `meta ${goal.id}`);
    for (const [key, value] of Object.entries(goal.solution ?? {})) {
      const dot = key.indexOf('.');
      const info = dot > 0 ? infos.get(key.slice(0, dot)) : undefined;
      if (!info) errors.push(`meta ${goal.id}: "${key}" na solução não é "Elemento.parâmetro"`);
      else {
        const problem = checkParam(info, key.slice(dot + 1), value);
        if (problem) errors.push(`meta ${goal.id}: ${problem}`);
      }
    }
  }
  for (const [prop, key] of Object.entries(circuit.scene3d?.bindings ?? {}))
    checkReadout(key, `scene3d.bindings["${prop}"]`);
  if (circuit.analysis.kind === 'ac-sweep') {
    const { source, fStart, fStop } = circuit.analysis;
    const el = byId.get(source);
    if (!el) errors.push(`análise: fonte "${source}" não existe`);
    else if (!findDevice(el.type)?.source)
      errors.push(
        `análise: "${source}" não é uma fonte (a varredura precisa de uma fonte de sinal)`,
      );
    if (fStop <= fStart) errors.push('análise: fStop precisa ser maior que fStart');
    for (const probe of circuit.probes ?? [])
      if (probe.kind !== 'voltage')
        warnings.push(`medidor ${probe.id}: a varredura CA só traça medidores de tensão`);
  }
  if (errors.length) return { errors, warnings };

  warnings.push(...connectionWarnings(circuit, infos));
  return { errors, warnings };
}

function checkPinRef(
  ref: string,
  byId: Map<string, ElementDoc>,
  infos: Map<string, DeviceInfo>,
): string | undefined {
  if (ref === 'GND') return undefined;
  const [id, pin, extra] = ref.split('.');
  const info = infos.get(id);
  if (!byId.has(id) || !info || extra !== undefined)
    return `"${ref}" não é um pino ("R1.a") nem "GND"`;
  if (!info.pins.some((p) => p.name === pin))
    return `${id} não tem o pino "${pin}" (tem: ${info.pins.map((p) => p.name).join(', ')})`;
  return undefined;
}

/** Pins that touch nothing, and pins that sit on a wire without being on a vertex. */
function connectionWarnings(circuit: CircuitDoc, infos: Map<string, DeviceInfo>): string[] {
  const warnings: string[] = [];
  const count = new Map<string, number>();
  const bump = (k: string) => count.set(k, (count.get(k) ?? 0) + 1);
  const segments: [number, number, number, number, string][] = [];
  const pins: [string, [number, number]][] = [];
  for (const el of circuit.elements) {
    const info = infos.get(el.id)!;
    if (el.type === 'wire') {
      const pts = wirePoints(el);
      pts.forEach((p, i) => {
        bump(pointKey(p));
        if (i > 0) segments.push([pts[i - 1][0], pts[i - 1][1], p[0], p[1], el.id]);
      });
    } else {
      pinPoints(el, info).forEach((p, i) => {
        bump(pointKey(p));
        pins.push([`${el.id}.${info.pins[i].name}`, p]);
      });
    }
  }
  for (const [name, p] of pins) {
    if ((count.get(pointKey(p)) ?? 0) > 1) continue;
    const onWire = segments.find(([x1, y1, x2, y2]) => onSegment(p, x1, y1, x2, y2));
    if (onWire)
      warnings.push(
        `${name} está sobre o fio ${onWire[4]} mas fora de uma ponta ou vértice: não está ligado`,
      );
    else warnings.push(`${name} não está ligado a nada`);
  }
  return warnings;
}

function onSegment(p: [number, number], x1: number, y1: number, x2: number, y2: number): boolean {
  const [x, y] = p;
  const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
  if (cross !== 0) return false;
  return (
    Math.min(x1, x2) <= x && x <= Math.max(x1, x2) && Math.min(y1, y2) <= y && y <= Math.max(y1, y2)
  );
}
