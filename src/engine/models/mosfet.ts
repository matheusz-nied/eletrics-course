import { defineDevice, num, type DeviceDefinition } from '../device';
import { formatSI, reportHeating } from '../messages';
import { R_FAILED_SHORT } from './diode';
import { JunctionHeating } from './heating';
import { fetlim, Junction, limvds } from './junction';

/** Saturation current of the body diode (A). */
const BODY_IS = 1e-12;

/**
 * Enhancement MOSFET, SPICE level 1 (Shichman-Hodges): Id = kp/2·(Vgs − Vth)²·(1 + λ·Vds)
 * in saturation, the triode equation below it, plus the body diode from
 * source to drain that power MOSFETs have. The gate oxide breaks above
 * |Vgs| = 20 V (instantly); power above the rating heats the die. Either way
 * the drain ends up shorted to the source.
 *
 * `polarity` 1 is N-channel, −1 is P-channel.
 */
export function mosfetDevice(type: 'nmos' | 'pmos'): DeviceDefinition {
  const p = type === 'nmos' ? 1 : -1;
  const label = type === 'nmos' ? 'MOSFET canal N' : 'MOSFET canal P';
  // P-channel: source on top (towards the positive supply), as usually drawn.
  const [dy, sy] = p > 0 ? [-4, 4] : [4, -4];
  return defineDevice({
    info: {
      type,
      label,
      terminals: 'fixed',
      pins: [
        { name: 'g', offset: [-4, 0], label: 'gate' },
        { name: 'd', offset: [2, dy], label: 'dreno' },
        { name: 's', offset: [2, sy], label: 'fonte (source)' },
      ],
      params: {
        vth: { default: 2.5, label: 'Tensão de limiar |Vth|', unit: 'V', min: 0.1, max: 10 },
        kp: { default: 5, label: 'Transcondutância kp', unit: 'A/V²', min: 1e-6 },
        lambda: { default: 0.01, label: 'Modulação de canal λ', unit: '1/V', min: 0, max: 1 },
        vgsMax: { default: 20, label: 'Tensão máxima gate-source', unit: 'V', min: 1 },
        power: { default: 2, label: 'Potência máxima (sem dissipador)', unit: 'W', min: 0.01 },
      },
      readouts: ['id', 'vgs', 'vds', 'power', 'region', 'temperature', 'burned'],
      readoutInfo: {
        id: { label: 'Corrente de dreno', unit: 'A' },
        vgs: { label: 'Tensão gate-source', unit: 'V' },
        vds: { label: 'Tensão dreno-source', unit: 'V' },
        power: { label: 'Potência dissipada', unit: 'W' },
        region: { label: 'Região de operação (corte, triodo, saturação)' },
        temperature: { label: 'Temperatura da junção', unit: '°C' },
        burned: { label: 'Queimado (dreno em curto com a fonte)' },
      },
    },
    create({ id, params, pins: [g, d, s] }) {
      const body = new Junction({ is: BODY_IS, n: 1 });
      const heat = new JunctionHeating(() => num(params, 'power'));
      let burned = false;
      let lastVgs = 0;
      let lastVds = 0;
      let committedVgs = 0;
      let committedVds = 0;
      // Last solution, N-channel frame: channel current d → s and body diode current s → d.
      let ich = 0;
      let idiode = 0;

      /** Channel current d → s and its derivatives, for any sign of vds (N frame). */
      const channel = (vgs: number, vds: number) => {
        const forward = vds >= 0;
        const vg = forward ? vgs : vgs - vds; // gate voltage to the lower terminal
        const v = Math.abs(vds);
        const kp = num(params, 'kp');
        const lambda = num(params, 'lambda');
        const vov = vg - num(params, 'vth');
        let i = 0;
        let gm = 0;
        let gds = 0;
        if (vov > 0) {
          const beta = kp * (1 + lambda * v);
          if (vov <= v) {
            i = 0.5 * beta * vov * vov;
            gm = beta * vov;
            gds = 0.5 * lambda * kp * vov * vov;
          } else {
            i = beta * v * (vov - 0.5 * v);
            gm = beta * v;
            gds = beta * (vov - v) + lambda * kp * v * (vov - 0.5 * v);
          }
        }
        if (forward) return { i, dVgs: gm, dVds: gds };
        // Source and drain swap: I = −f(vgs − vds, −vds).
        return { i: -i, dVgs: -gm, dVds: gm + gds };
      };

      /** SPICE limiting of Vgs and Vds, relative to the previous iterate. */
      const limit = (vgs: number, vds: number) => {
        const vth = num(params, 'vth');
        let lvgs: number;
        let lvds: number;
        if (lastVds >= 0) {
          lvgs = fetlim(vgs, lastVgs, vth);
          lvds = limvds(lvgs - (vgs - vds), lastVds);
        } else {
          const vgd = fetlim(vgs - vds, lastVgs - lastVds, vth);
          lvds = -limvds(-(vgs - vgd), -lastVds);
          lvgs = vgd + lvds;
        }
        return { vgs: lvgs, vds: lvds };
      };

      return {
        nonlinear: true,
        beginSolve() {
          lastVgs = committedVgs;
          lastVds = committedVds;
          body.begin();
        },
        stamp(m, step, x) {
          if (burned) {
            m.conductance(d, s, 1 / R_FAILED_SHORT);
            return;
          }
          const nl = step.nl;
          const vgs = p * (x.v(g) - x.v(s));
          const vds = p * (x.v(d) - x.v(s));
          const l = nl.initJunctions ? { vgs, vds } : limit(vgs, vds);
          if (Math.abs(l.vgs - vgs) > 1e-9 || Math.abs(l.vds - vds) > 1e-9) nl.limited = true;
          lastVgs = l.vgs;
          lastVds = l.vds;
          const ch = channel(l.vgs, l.vds);
          m.transconductance(d, s, g, s, ch.dVgs);
          m.transconductance(d, s, d, s, ch.dVds);
          m.current(d, s, p * (ch.i - ch.dVgs * l.vgs - ch.dVds * l.vds));
          // Body diode, anode at the source (N frame).
          const bd = body.linearize(p * (x.v(s) - x.v(d)), nl);
          if (p > 0) m.linearized(s, d, bd.v, bd.i, bd.g);
          else m.linearized(d, s, bd.v, bd.i, bd.g);
        },
        stampAc(m, _ctx, op) {
          if (burned) {
            m.admittance(d, s, 1 / R_FAILED_SHORT);
            return;
          }
          const ch = channel(p * (op.v(g) - op.v(s)), p * (op.v(d) - op.v(s)));
          m.transconductance(d, s, g, s, ch.dVgs);
          m.transconductance(d, s, d, s, ch.dVds);
          m.admittance(s, d, body.at(p * (op.v(s) - op.v(d))).g);
        },
        update(step, x, ctx) {
          const vgs = p * (x.v(g) - x.v(s));
          const vds = p * (x.v(d) - x.v(s));
          if (burned) {
            ich = vds / R_FAILED_SHORT;
            idiode = 0;
            return;
          }
          ich = channel(vgs, vds).i;
          idiode = body.at(-vds).i;
          if (!ctx.commit) return;
          committedVgs = vgs;
          committedVds = vds;
          body.commit(-vds);
          const vgsMax = num(params, 'vgsMax');
          if (Math.abs(vgs) > vgsMax) {
            burned = true;
            ctx.emit(
              'damaged',
              `O MOSFET ${id} queimou: tensão gate-source de ${formatSI(Math.abs(vgs), 'V')}, máximo ${formatSI(vgsMax, 'V')}. Ficou em curto entre dreno e fonte.`,
            );
            ctx.discontinuity();
            return;
          }
          const result = heat.step((ich - idiode) * vds, step.dt);
          if (result === 'burned') burned = true;
          reportHeating(
            ctx,
            result,
            `O MOSFET ${id}`,
            heat.power,
            num(params, 'power'),
            'e entrou em curto entre dreno e fonte',
          );
        },
        pinCurrents(_x, out) {
          const idrain = p * (ich - idiode);
          out[0] = 0;
          out[1] = idrain;
          out[2] = -idrain;
        },
        readouts(x, out) {
          const vgs = p * (x.v(g) - x.v(s));
          const vds = p * (x.v(d) - x.v(s));
          const vov = vgs - num(params, 'vth');
          out('id', ich - idiode);
          out('vgs', vgs);
          out('vds', vds);
          out('power', (ich - idiode) * vds);
          out(
            'region',
            burned ? 'queimado' : vov <= 0 ? 'corte' : vov > Math.abs(vds) ? 'triodo' : 'saturação',
          );
          out('temperature', heat.temperature);
          out('burned', burned);
        },
        reset() {
          body.reset();
          heat.reset();
          burned = false;
          lastVgs = lastVds = committedVgs = committedVds = 0;
          ich = idiode = 0;
        },
      };
    },
  });
}
