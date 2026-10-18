import { defineDevice, str, TWO_PINS } from '../device';
import { formatNumber, formatSI } from '../messages';
import { RmsMeter } from '../models/filters';

/**
 * Total body impedance, hand to hand, large contact area, 50 % of the
 * population, by touch voltage (approximate values in the spirit of
 * IEC 60479-1): it falls as the voltage breaks down the skin.
 */
const VOLTS = [25, 50, 75, 100, 125, 150, 175, 200, 225, 400, 500, 700, 1000];
const DRY = [3250, 2500, 2000, 1725, 1550, 1400, 1325, 1275, 1225, 950, 850, 775, 775];
const WET = [2175, 1900, 1600, 1450, 1350, 1250, 1200, 1125, 1100, 900, 800, 750, 750];
/** Other current paths, relative to hand to hand. */
const PATH: Record<string, number> = { 'hand-hand': 1, 'hand-feet': 0.75, 'hands-feet': 0.5 };

/**
 * Time–current zones of IEC 60479-1 for 50/60 Hz (approximate curves b and
 * c1, as [duration (s), current (A)] points): below b muscles still obey,
 * above c1 ventricular fibrillation becomes possible.
 */
const CURVE_B: [number, number][] = [
  [0.01, 0.2],
  [0.1, 0.1],
  [0.5, 0.025],
  [2, 0.01],
  [10, 0.01],
];
const CURVE_C1: [number, number][] = [
  [0.01, 0.5],
  [0.1, 0.4],
  [0.3, 0.2],
  [1, 0.05],
  [3, 0.04],
  [10, 0.04],
];
const PERCEPTION = 5e-4;

const EFFECTS = {
  'AC-1': 'imperceptível',
  'AC-2': 'sente o choque, sem reação perigosa',
  'AC-3': 'contração muscular e dificuldade para respirar; pode não conseguir soltar',
  'AC-4': 'risco de parada cardíaca (fibrilação ventricular)',
} as const;
type Zone = keyof typeof EFFECTS;
const ORDER: Zone[] = ['AC-1', 'AC-2', 'AC-3', 'AC-4'];

/** Interpolation in a table (linear in x, held flat past the ends). */
function lerp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  for (let k = 1; k < xs.length; k++) {
    if (x <= xs[k])
      return ys[k - 1] + ((ys[k] - ys[k - 1]) * (x - xs[k - 1])) / (xs[k] - xs[k - 1]);
  }
  return ys[ys.length - 1];
}

/** Current of a log-log curve at a duration. */
function curve(points: [number, number][], t: number): number {
  const lt = Math.log(Math.max(t, points[0][0]));
  const xs = points.map(([x]) => Math.log(x));
  const ys = points.map(([, y]) => Math.log(y));
  return Math.exp(lerp(xs, ys, lt));
}

function zoneOf(current: number, duration: number): Zone {
  if (current < PERCEPTION) return 'AC-1';
  if (current < curve(CURVE_B, duration)) return 'AC-2';
  if (current < curve(CURVE_C1, duration)) return 'AC-3';
  return 'AC-4';
}

/**
 * Human body between two contact points (for the electric shock lesson): an
 * impedance that depends on the touch voltage, the skin and the current path,
 * and the physiological effect of the current by how long it lasts.
 */
export default defineDevice({
  info: {
    type: 'human-body',
    label: 'Corpo humano',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
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
          { value: 'hands-feet', label: 'Duas mãos aos pés' },
        ],
      },
    },
    readouts: [
      'current',
      'voltage',
      'power',
      'currentRms',
      'impedance',
      'duration',
      'zone',
      'effect',
      'worst',
    ],
    readoutInfo: {
      current: { label: 'Corrente pelo corpo', unit: 'A' },
      voltage: { label: 'Tensão de toque', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      currentRms: { label: 'Corrente eficaz pelo corpo', unit: 'A' },
      impedance: { label: 'Impedância do corpo', unit: 'Ω' },
      duration: { label: 'Duração do choque', unit: 's' },
      zone: { label: 'Zona de efeito (IEC 60479-1)' },
      effect: { label: 'Efeito no corpo' },
      worst: { label: 'Pior zona alcançada' },
    },
  },
  create({ id, params, pins: [a, b] }) {
    const vRms = new RmsMeter(0.02);
    const iRms = new RmsMeter(0.02);
    let impedance = 0;
    let duration = 0;
    let worst: Zone = 'AC-1';
    let current = 0;
    const update = () => {
      const table = str(params, 'skin') === 'wet' ? WET : DRY;
      impedance = lerp(VOLTS, table, vRms.value) * (PATH[str(params, 'path')] ?? 1);
    };
    update();
    const zone = () => zoneOf(iRms.value, duration);
    return {
      stamp(m) {
        m.conductance(a, b, 1 / impedance);
      },
      stampAc(m) {
        m.admittance(a, b, 1 / impedance);
      },
      update(step, x, ctx) {
        const v = x.v(a) - x.v(b);
        current = v / impedance;
        if (!ctx.commit || step.dt <= 0) return;
        vRms.update(v, step.dt);
        iRms.update(current, step.dt);
        // The impedance follows the touch voltage with the meters' lag (linear in each step).
        update();
        duration = iRms.value >= PERCEPTION ? duration + step.dt : 0;
        const now = zone();
        if (ORDER.indexOf(now) <= ORDER.indexOf(worst)) return;
        worst = now;
        const what = `Choque em ${id}: ${formatSI(iRms.value, 'A')} pelo corpo há ${formatNumber(duration, 2)} s (zona ${now})`;
        if (now === 'AC-3') ctx.emit('warning', `${what}: ${EFFECTS[now]}.`);
        if (now === 'AC-4') ctx.emit('damaged', `${what}: ${EFFECTS[now]}.`);
      },
      pinCurrents(_x, out) {
        out[0] = current;
        out[1] = -current;
      },
      readouts(_x, out) {
        out('currentRms', iRms.value);
        out('impedance', impedance);
        out('duration', duration);
        out('zone', zone());
        out('effect', EFFECTS[zone()]);
        out('worst', worst);
      },
      paramChanged: update,
      reset() {
        vRms.reset();
        iRms.reset();
        duration = current = 0;
        worst = 'AC-1';
        update();
      },
    };
  },
});
