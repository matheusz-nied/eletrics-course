import type { DeviceInfo, ParamValue, PinInfo } from '../contract';
import { defineDevice, str } from '../device';
import {
  findFirmware,
  listFirmware,
  type FirmwareDoc,
  type FirmwarePin,
  type PinValue,
  type RfFrame,
} from '../firmware';
import { formatSI } from '../messages';

/** Output stage (push-pull) resistance (Ω). */
const R_OUT = 50;
/** Internal pull-up (Ω). */
const R_PULLUP = 10_000;
/** Input leakage, and outputs while unpowered (Ω). */
const R_INPUT = 1e6;
/** Supply current of the chip at its rated voltage (A). */
const I_SUPPLY = 0.02;
/** Brown-out: the chip stops below 60 % of its rated supply and starts again above 70 %. */
const BROWN_OUT = 0.6;
const POWER_ON = 0.7;
/** Most firmware steps run in one solver step (a long DC step). */
const MAX_STEPS = 1000;
/** Pin that takes the frames of a radio receiver. */
const RF_PIN: FirmwarePin = { name: 'RF', kind: 'digital-in', label: 'Dados do receptor de rádio' };

const isInput = (p: FirmwarePin) => p.kind === 'digital-in' || p.kind === 'analog-in';

/** Firmware pins plus the RF input (unless the firmware has a pin of that name). */
function firmwarePins(fw: FirmwareDoc<unknown> | undefined): FirmwarePin[] {
  if (!fw) return [];
  return fw.pins.some((p) => p.name === RF_PIN.name) ? fw.pins : [...fw.pins, RF_PIN];
}

const names = (value: ParamValue | undefined) =>
  String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Pin layout: inputs on the left and outputs on the right in firmware order
 * (or as `pinsLeft`/`pinsRight` list them), two grid units apart, supply on
 * top and ground at the bottom.
 */
function layout(params: Record<string, ParamValue>): PinInfo[] {
  const fw = findFirmware(String(params.firmware ?? ''));
  const pins = firmwarePins(fw);
  const byName = new Map(pins.map((p) => [p.name, p]));
  const left = names(params.pinsLeft).filter((n) => byName.has(n));
  const right = names(params.pinsRight).filter((n) => byName.has(n) && !left.includes(n));
  for (const p of pins) {
    if (left.includes(p.name) || right.includes(p.name)) continue;
    (isInput(p) ? left : right).push(p.name);
  }
  const rows = Math.max(left.length, right.length, 1);
  const y = (i: number) => 2 * i - (rows - 1);
  const pin = (name: string, offset: [number, number]): PinInfo => ({
    name,
    offset,
    label: byName.get(name)?.label,
  });
  return [
    ...left.map((n, i) => pin(n, [-6, y(i)])),
    ...right.map((n, i) => pin(n, [6, y(i)])),
    { name: 'vcc', offset: [0, -rows - 1], label: 'alimentação (VCC)' },
    { name: 'gnd', offset: [0, rows + 1], label: 'terra (GND)' },
  ];
}

/** Readout names a firmware produces, from one step at power-up (firmware is a pure function). */
const readoutCache = new Map<string, string[]>();
function firmwareReadouts(fw: FirmwareDoc<unknown> | undefined): string[] {
  if (!fw) return [];
  let keys = readoutCache.get(fw.id);
  if (!keys) {
    const pins: Record<string, PinValue> = {};
    for (const p of fw.pins) if (isInput(p)) pins[p.name] = p.kind === 'digital-in' ? true : 0;
    try {
      keys = Object.keys(fw.step(fw.init(), { t: 0, dt: fw.period, pins, rf: [] }).readouts);
    } catch {
      keys = [];
    }
    readoutCache.set(fw.id, keys);
  }
  return keys;
}

const info: DeviceInfo = {
  type: 'mcu',
  label: 'Microcontrolador',
  terminals: 'fixed',
  pins: [
    { name: 'vcc', offset: [0, -2], label: 'alimentação (VCC)' },
    { name: 'gnd', offset: [0, 2], label: 'terra (GND)' },
  ],
  params: {
    firmware: { default: '', label: 'Firmware (programa gravado)' },
    pinsLeft: { default: '', label: 'Pinos à esquerda (nomes separados por vírgula)' },
    pinsRight: { default: '', label: 'Pinos à direita (nomes separados por vírgula)' },
  },
  readouts: ['powered'],
  readoutInfo: { powered: { label: 'Ligado' } },
};

/**
 * Microcontroller running a firmware from src/lessons/<module>/firmware/
 * (`firmware` = its id, see src/engine/firmware.ts). Its pins are the
 * firmware's pins, an RF input for a radio receiver, `vcc` and `gnd`.
 *
 * Electrically: inputs leak 1 MΩ, with a 10 kΩ pull-up to vcc where the
 * firmware asks; a digital input reads high above half the supply; an analog
 * input reads its voltage to gnd, 0 to the rated supply; outputs drive vcc
 * or gnd through 50 Ω; a `phase-out` pin drives high while its fraction is
 * above zero and passes the fraction to a TRIAC gate on its node. The
 * firmware steps every `period` with the pins read from the solution; its
 * readouts become `<id>.<key>` and its events messages. Below 60 % of the
 * rated supply the chip stops (outputs float, `persist` keeps its EEPROM)
 * and above 70 % it starts again from `init(memory)`.
 */
export default defineDevice({
  info,
  instance: (params) => {
    const pins = layout(params);
    const fw = findFirmware(String(params.firmware ?? ''));
    const readoutInfo = { ...info.readoutInfo };
    for (const p of firmwarePins(fw)) readoutInfo[`level.${p.name}`] = { label: p.label };
    Object.assign(readoutInfo, fw?.readouts);
    return {
      ...info,
      pins,
      readouts: [
        'powered',
        ...pins.filter((p) => p.name !== 'vcc' && p.name !== 'gnd').map((p) => `level.${p.name}`),
        ...firmwareReadouts(fw),
      ],
      readoutInfo,
    };
  },
  checkParams(params) {
    const id = str(params, 'firmware');
    if (findFirmware(id)) return [];
    const known = listFirmware()
      .map((f) => `"${f.id}"`)
      .join(', ');
    return [
      id
        ? `firmware "${id}" não existe (disponíveis: ${known || 'nenhum'})`
        : `o microcontrolador precisa de um firmware (disponíveis: ${known || 'nenhum'})`,
    ];
  },
  create({ id, params, pins: nodes, signal }) {
    const fw = findFirmware(str(params, 'firmware'))!;
    const pinInfo = layout(params);
    const nodeOf = new Map(pinInfo.map((p, i) => [p.name, nodes[i]]));
    const vcc = nodeOf.get('vcc')!;
    const gnd = nodeOf.get('gnd')!;
    const indexOf = new Map(pinInfo.map((p, k) => [p.name, k]));
    const all = firmwarePins(fw).map((p) => ({
      ...p,
      node: nodeOf.get(p.name)!,
      index: indexOf.get(p.name)!,
    }));
    const inputs = all.filter(isInput);
    const outputs = all.filter((p) => !isInput(p));
    const rf = all.find((p) => p.name === RF_PIN.name);
    const rfLine = rf && rf.node >= 0 ? signal(rf.node) : undefined;
    const phaseLines = outputs
      .filter((p) => p.kind === 'phase-out' && p.node >= 0)
      .map((p) => ({ name: p.name, line: signal(p.node) }));
    const gSupply = I_SUPPLY / fw.vcc;

    let powered = false;
    let crashed = false;
    let state: unknown;
    let memory: unknown;
    let elapsed = 0;
    let pending = 0;
    let driven: Record<string, PinValue> = {};
    let levels: Record<string, PinValue> = {};
    let readouts: Record<string, number | boolean | string> = {};

    const high = (name: string) => {
      const v = driven[name];
      return v === true || (typeof v === 'number' && v > 0);
    };
    /** Conductance of every firmware pin to vcc and to gnd, with its index in `pinInfo`. */
    const each = (fn: (node: number, toVcc: number, toGnd: number, k: number) => void) => {
      for (const p of inputs) fn(p.node, p.pullUp ? 1 / R_PULLUP : 0, 1 / R_INPUT, p.index);
      for (const p of outputs) {
        if (!powered) fn(p.node, 0, 1 / R_INPUT, p.index);
        else if (high(p.name)) fn(p.node, 1 / R_OUT, 0, p.index);
        else fn(p.node, 0, 1 / R_OUT, p.index);
      }
    };
    const setPhase = () => {
      for (const { name, line } of phaseLines) {
        const v = driven[name];
        line.phase = powered && typeof v === 'number' ? Math.min(1, Math.max(0, v)) : 0;
      }
    };
    setPhase();

    return {
      stamp(m) {
        m.conductance(vcc, gnd, gSupply);
        each((node, toVcc, toGnd) => {
          if (toVcc) m.conductance(node, vcc, toVcc);
          if (toGnd) m.conductance(node, gnd, toGnd);
        });
      },
      stampAc(m) {
        m.admittance(vcc, gnd, gSupply);
        each((node, toVcc, toGnd) => {
          if (toVcc) m.admittance(node, vcc, toVcc);
          if (toGnd) m.admittance(node, gnd, toGnd);
        });
      },
      update(step, x, ctx) {
        const supply = x.v(vcc) - x.v(gnd);
        const read = () => {
          const pins: Record<string, PinValue> = {};
          for (const p of inputs) {
            const v = x.v(p.node) - x.v(gnd);
            pins[p.name] =
              p.kind === 'digital-in' ? v > 0.5 * supply : Math.min(fw.vcc, Math.max(0, v));
          }
          return pins;
        };
        if (!ctx.commit) {
          levels = { ...read(), ...driven };
          return;
        }
        if (powered && supply < BROWN_OUT * fw.vcc) {
          powered = false;
          memory = fw.persist?.(state);
          driven = {};
          readouts = {};
          setPhase();
          ctx.emit(
            'info',
            `O microcontrolador ${id} desligou: alimentação de ${formatSI(supply, 'V')}, mínimo ${formatSI(BROWN_OUT * fw.vcc, 'V')}.`,
          );
          ctx.discontinuity();
        } else if (!powered && supply >= POWER_ON * fw.vcc) {
          powered = true;
          crashed = false;
          state = fw.init(memory);
          elapsed = pending = 0;
          driven = {};
          ctx.discontinuity();
        }
        if (!powered || crashed) {
          levels = read();
          return;
        }
        pending += step.dt;
        let steps = 0;
        const before = JSON.stringify(driven);
        while (pending >= fw.period - 1e-12 && steps < MAX_STEPS) {
          pending -= fw.period;
          elapsed += fw.period;
          steps++;
          const frames = rfLine ? (rfLine.frames.splice(0) as RfFrame[]) : [];
          try {
            const out = fw.step(state, { t: elapsed, dt: fw.period, pins: read(), rf: frames });
            state = out.state;
            driven = out.pins;
            readouts = out.readouts;
            for (const e of out.events) ctx.emit(e.kind, e.message);
          } catch (error) {
            crashed = true;
            driven = {};
            ctx.emit(
              'warning',
              `O firmware do microcontrolador ${id} travou: ${error instanceof Error ? error.message : String(error)}.`,
            );
            break;
          }
        }
        if (steps === MAX_STEPS) pending = 0;
        levels = { ...read(), ...driven };
        setPhase();
        if (JSON.stringify(driven) !== before) ctx.discontinuity();
      },
      pinCurrents(x, out) {
        const vg = x.v(gnd);
        const vv = x.v(vcc);
        const supply = gSupply * (vv - vg);
        let iVcc = supply;
        let iGnd = -supply;
        out.fill(0);
        each((node, toVcc, toGnd, k) => {
          const v = x.v(node);
          const up = toVcc * (v - vv);
          const down = toGnd * (v - vg);
          out[k] = up + down;
          iVcc -= up;
          iGnd -= down;
        });
        out[indexOf.get('vcc')!] = iVcc;
        out[indexOf.get('gnd')!] = iGnd;
      },
      readouts(_x, out) {
        out('powered', powered);
        for (const p of all) {
          const v = levels[p.name];
          if (v !== undefined) out(`level.${p.name}`, v);
        }
        for (const [key, value] of Object.entries(readouts)) out(key, value);
      },
      reset() {
        powered = crashed = false;
        state = memory = undefined;
        elapsed = pending = 0;
        driven = {};
        levels = {};
        readouts = {};
        setPhase();
      },
    };
  },
});
