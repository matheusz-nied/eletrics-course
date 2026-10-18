import type { DeviceInfo, ParamInfo, PinInfo } from '../contract';
import { bool, defineDevice } from '../device';
import { R_CLOSED, R_OPEN } from '../models/constants';

const MAX = 8;

const switchParams: Record<string, ParamInfo> = {};
for (let i = 1; i <= MAX; i++)
  switchParams[`s${i}`] = { default: false, label: `Chave ${i} ligada` };

function pinsFor(n: number): PinInfo[] {
  const pins: PinInfo[] = [];
  for (let i = 1; i <= n; i++) {
    pins.push({ name: `a${i}`, offset: [-2, 2 * (i - 1)], label: `chave ${i}, lado A` });
    pins.push({ name: `b${i}`, offset: [2, 2 * (i - 1)], label: `chave ${i}, lado B` });
  }
  return pins;
}

const count = (params: Record<string, unknown>) =>
  Math.max(1, Math.min(MAX, Math.round(Number(params.positions) || 1)));

const info: DeviceInfo = {
  type: 'dip-switch',
  label: 'Chave DIP',
  terminals: 'fixed',
  pins: pinsFor(2),
  params: {
    positions: { default: 2, label: 'Número de chaves', min: 1, max: MAX },
    ...switchParams,
  },
  readouts: [],
};

/**
 * DIP switch: a row of `positions` small switches; switch i connects a_i to
 * b_i when `s<i>` is on. Its pins depend on `positions` (a1, b1, a2, b2…, two
 * grid units apart), fixed when the circuit loads.
 */
export default defineDevice({
  info,
  instance: (params) => ({ ...info, pins: pinsFor(count(params)) }),
  create({ params, pins }) {
    const n = pins.length / 2;
    const g = (i: number) => 1 / (bool(params, `s${i + 1}`) ? R_CLOSED : R_OPEN);
    return {
      stamp(m) {
        for (let i = 0; i < n; i++) m.conductance(pins[2 * i], pins[2 * i + 1], g(i));
      },
      stampAc(m) {
        for (let i = 0; i < n; i++) m.admittance(pins[2 * i], pins[2 * i + 1], g(i));
      },
      pinCurrents(x, out) {
        for (let i = 0; i < n; i++) {
          const current = g(i) * (x.v(pins[2 * i]) - x.v(pins[2 * i + 1]));
          out[2 * i] = current;
          out[2 * i + 1] = -current;
        }
      },
    };
  },
});
