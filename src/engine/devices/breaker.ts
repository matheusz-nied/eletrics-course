import { bool, defineDevice, num, str, TWO_PINS } from '../device';
import { formatSI } from '../messages';
import { R_OPEN } from '../models/constants';
import { relax, RmsMeter } from '../models/filters';

/** Closed contacts of a miniature breaker (Ω). */
const R_CLOSED_BREAKER = 0.005;
/** Thermal (bimetal) element: time constant (s) and the multiple of In where it trips. */
const THERMAL_TAU = 60;
const K_THERMAL = 1.3;
/** Magnetic trip, as a multiple of In, for each curve (inside the IEC 60898 bands). */
const MAGNETIC: Record<string, number> = { B: 4, C: 7.5, D: 15 };

/**
 * Miniature circuit breaker (IEC 60898) with both trip elements: thermal
 * (bimetal heated by i², slow: never at 1,13·In, within the hour at 1,45·In,
 * seconds at 2,55·In) and magnetic (instant above 4, 7,5 or 15 × In for
 * curves B, C, D). Tripping opens the contacts and moves the lever down:
 * `closed` becomes false; setting it to true again re-arms it.
 */
export default defineDevice({
  info: {
    type: 'breaker',
    label: 'Disjuntor',
    terminals: 'two',
    pins: TWO_PINS,
    params: {
      rating: { default: 10, label: 'Corrente nominal (In)', unit: 'A', min: 0.1 },
      curve: {
        default: 'C',
        label: 'Curva de disparo',
        options: [
          { value: 'B', label: 'B (3 a 5 × In)' },
          { value: 'C', label: 'C (5 a 10 × In)' },
          { value: 'D', label: 'D (10 a 20 × In)' },
        ],
      },
      closed: { default: true, label: 'Ligado (alavanca para cima)' },
    },
    readouts: ['current', 'voltage', 'power', 'closed', 'tripped', 'heat'],
    readoutInfo: {
      current: { label: 'Corrente', unit: 'A' },
      voltage: { label: 'Tensão entre os terminais', unit: 'V' },
      power: { label: 'Potência', unit: 'W' },
      closed: { label: 'Ligado' },
      tripped: { label: 'Desarmou' },
      heat: { label: 'Aquecimento do bimetal (1 = desarma)' },
    },
  },
  create({ id, params, pins: [a, b] }) {
    const rms = new RmsMeter(0.005);
    let heat = 0;
    let tripped = false;
    let current = 0;
    const closed = () => bool(params, 'closed') && !tripped;
    const g = () => 1 / (closed() ? R_CLOSED_BREAKER : R_OPEN);
    const trip = (
      ctx: { emit: (k: 'tripped', m: string) => void; discontinuity(): void },
      why: string,
    ) => {
      tripped = true;
      params.closed = false;
      const i = formatSI(rms.value, 'A');
      const rating = formatSI(num(params, 'rating'), 'A');
      ctx.emit(
        'tripped',
        `O disjuntor ${id} desarmou por ${why}: corrente de ${i}, nominal ${rating}.`,
      );
      ctx.discontinuity();
    };
    return {
      stamp(m) {
        m.conductance(a, b, g());
      },
      stampAc(m) {
        m.admittance(a, b, g());
      },
      update(step, x, ctx) {
        current = g() * (x.v(a) - x.v(b));
        if (!ctx.commit || step.dt <= 0) return;
        const rating = num(params, 'rating');
        rms.update(current, step.dt);
        heat = relax(heat, (current / rating) ** 2, step.dt, THERMAL_TAU);
        if (!closed()) return;
        const curve = str(params, 'curve');
        if (rms.value >= (MAGNETIC[curve] ?? MAGNETIC.C) * rating) {
          trip(ctx, `curto-circuito (disparo magnético, curva ${curve})`);
        } else if (heat >= K_THERMAL ** 2) {
          trip(ctx, 'sobrecarga (disparo térmico)');
        }
      },
      pinCurrents(_x, out) {
        out[0] = current;
        out[1] = -current;
      },
      readouts(_x, out) {
        out('closed', closed());
        out('tripped', tripped);
        out('heat', heat / K_THERMAL ** 2);
      },
      paramChanged(name) {
        // Moving the lever re-arms the breaker (the bimetal keeps its heat).
        if (name === 'closed') tripped = false;
      },
      reset() {
        if (tripped) params.closed = true;
        rms.reset();
        heat = current = 0;
        tripped = false;
      },
    };
  },
});
