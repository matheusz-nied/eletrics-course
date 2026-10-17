import { defineDevice, num, type DeviceDefinition } from '../device';

/** Output resistance of a CMOS gate (Ω). */
const R_OUT = 50;
/** Input thresholds as fractions of VCC, with hysteresis between them. */
const V_IL = 0.4;
const V_IH = 0.6;

const LABELS: Record<string, string> = {
  and: 'Porta E (AND)',
  or: 'Porta OU (OR)',
  not: 'Porta NÃO (NOT, inversora)',
  nand: 'Porta NÃO-E (NAND)',
  nor: 'Porta NÃO-OU (NOR)',
  xor: 'Porta OU exclusivo (XOR)',
};

/**
 * Logic gate, behavioural: inputs read high above 60 % of VCC and low below
 * 40 % (keeping the previous level in between) and draw no current; the
 * output is an ideal source of 0 or VCC behind 50 Ω, referred to ground
 * (VCC is a parameter, no supply pins). The output changes one step after
 * the inputs, like a real propagation delay.
 */
export function gateDevice(
  type: keyof typeof LABELS,
  logic: (inputs: boolean[]) => boolean,
): DeviceDefinition {
  const single = type === 'not';
  const inputs = single
    ? [{ name: 'a', offset: [-2, 0] as [number, number], label: 'entrada A' }]
    : [
        { name: 'a', offset: [-3, -1] as [number, number], label: 'entrada A' },
        { name: 'b', offset: [-3, 1] as [number, number], label: 'entrada B' },
      ];
  return defineDevice({
    info: {
      type,
      label: LABELS[type],
      terminals: 'fixed',
      pins: [...inputs, { name: 'y', offset: [single ? 2 : 3, 0], label: 'saída Y' }],
      params: {
        vcc: { default: 5, label: 'Tensão de alimentação (nível alto)', unit: 'V', min: 1 },
      },
      readouts: [...inputs.map((p) => p.name), 'y'],
      readoutInfo: {
        a: { label: 'Entrada A em nível alto' },
        ...(single ? {} : { b: { label: 'Entrada B em nível alto' } }),
        y: { label: 'Saída em nível alto' },
      },
    },
    create({ params, pins, branch }) {
      const inPins = pins.slice(0, -1);
      const y = pins[pins.length - 1];
      const br = branch();
      const levels = inPins.map(() => false);
      let out = logic(levels);
      let iOut = 0;
      return {
        stamp(m) {
          m.branch(br, y, -1, out ? num(params, 'vcc') : 0, R_OUT);
        },
        stampAc(m) {
          m.branch(br, y, -1, 0, 0, R_OUT);
        },
        update(_step, x, ctx) {
          iOut = x.x[br];
          if (!ctx.commit) return;
          const vcc = num(params, 'vcc');
          inPins.forEach((pin, k) => {
            const v = x.v(pin);
            if (v >= V_IH * vcc) levels[k] = true;
            else if (v <= V_IL * vcc) levels[k] = false;
          });
          const next = logic(levels);
          if (next !== out) {
            out = next;
            ctx.discontinuity();
          }
        },
        pinCurrents(_x, currents) {
          currents.fill(0);
          currents[currents.length - 1] = iOut;
        },
        readouts(_x, put) {
          inPins.forEach((_, k) => put(inputs[k].name, levels[k]));
          put('y', out);
        },
        reset() {
          levels.fill(false);
          out = logic(levels);
          iOut = 0;
        },
      };
    },
  });
}
