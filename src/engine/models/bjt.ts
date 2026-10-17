import { defineDevice, num, type DeviceDefinition } from '../device';
import { formatSI, reportHeating } from '../messages';
import { R_FAILED_SHORT } from './diode';
import { JunctionHeating } from './heating';
import { JUNCTION_GMIN, Junction } from './junction';

/** Smoothness of the avalanche knee at Vceo (V). */
const AVALANCHE_KNEE = 0.5;
/** Slope of the avalanche current above Vceo (Ω). */
const AVALANCHE_R = 5;

/** ln(1 + eˣ) without overflow, and its derivative (the logistic function). */
function softplus(x: number): { value: number; slope: number } {
  if (x > 30) return { value: x, slope: 1 };
  const e = Math.exp(x);
  return { value: Math.log1p(e), slope: e / (1 + e) };
}

/**
 * Bipolar transistor, Ebers-Moll transport model with the Early effect (the
 * Gummel-Poon model of SPICE without high-injection and capacitances), plus
 * avalanche between collector and emitter above Vceo, which is what clamps
 * the spike of an inductive load switched off without a diode. Power above
 * the rating heats the junction; at about twice the rating, sustained, it
 * fails with the collector shorted to the emitter.
 *
 * `polarity` 1 is NPN, −1 is PNP: voltages and currents are computed in the
 * NPN frame and the signs flipped at the pins.
 */
export function bjtDevice(type: 'npn' | 'pnp'): DeviceDefinition {
  const p = type === 'npn' ? 1 : -1;
  const label = type === 'npn' ? 'Transistor NPN' : 'Transistor PNP';
  // PNP: emitter on top (towards the positive supply), as usually drawn.
  const [cy, ey] = p > 0 ? [-4, 4] : [4, -4];
  return defineDevice({
    info: {
      type,
      label,
      terminals: 'fixed',
      pins: [
        { name: 'b', offset: [-4, 0], label: 'base' },
        { name: 'c', offset: [2, cy], label: 'coletor' },
        { name: 'e', offset: [2, ey], label: 'emissor (seta)' },
      ],
      params: {
        beta: { default: 200, label: 'Ganho de corrente β (hFE)', min: 1, max: 2000 },
        betaR: { default: 2, label: 'Ganho reverso βR', min: 0.01, max: 100 },
        is: { default: 1e-14, label: 'Corrente de saturação Is', unit: 'A', min: 1e-20, max: 1e-6 },
        vaf: { default: 100, label: 'Tensão de Early (0 = sem efeito Early)', unit: 'V', min: 0 },
        vceo: { default: 40, label: 'Tensão máxima coletor-emissor (Vceo)', unit: 'V', min: 1 },
        power: { default: 0.5, label: 'Potência máxima', unit: 'W', min: 0.01 },
      },
      readouts: ['ic', 'ib', 'vbe', 'vce', 'power', 'region', 'temperature', 'burned'],
      readoutInfo: {
        ic: { label: 'Corrente de coletor', unit: 'A' },
        ib: { label: 'Corrente de base', unit: 'A' },
        vbe: { label: 'Tensão base-emissor', unit: 'V' },
        vce: { label: 'Tensão coletor-emissor', unit: 'V' },
        power: { label: 'Potência dissipada', unit: 'W' },
        region: { label: 'Região de operação (corte, ativa, saturação)' },
        temperature: { label: 'Temperatura da junção', unit: '°C' },
        burned: { label: 'Queimado (coletor em curto com o emissor)' },
      },
    },
    create({ id, params, pins: [b, c, e] }) {
      const be = new Junction();
      const bc = new Junction();
      const configure = () => {
        be.configure({ is: num(params, 'is'), n: 1 });
        bc.configure({ is: num(params, 'is'), n: 1 });
      };
      configure();
      const heat = new JunctionHeating(() => num(params, 'power'));
      let burned = false;
      let avalancheWarned = false;
      // Last solution, NPN frame.
      let ic = 0;
      let ib = 0;
      let vbe = 0;
      let vbc = 0;

      /** Collector and base currents and their partial derivatives, NPN frame. */
      const evaluate = (vbe: number, vbc: number, gmin: number) => {
        const f = be.at(vbe);
        const r = bc.at(vbc);
        // Junction.at includes gmin; the transport current uses the bare diode terms.
        const cbe = f.i - JUNCTION_GMIN * vbe;
        const gbe = f.g - JUNCTION_GMIN;
        const cbc = r.i - JUNCTION_GMIN * vbc;
        const gbc = r.g - JUNCTION_GMIN;
        const bf = num(params, 'beta');
        const br = num(params, 'betaR');
        const vaf = num(params, 'vaf');
        const inv = vaf > 0 ? 1 / vaf : 0;
        const k = 1 - vbc * inv;
        const g = JUNCTION_GMIN + gmin;
        // Avalanche from collector to emitter above Vceo.
        const vce = vbe - vbc;
        const av = softplus((vce - num(params, 'vceo')) / AVALANCHE_KNEE);
        const iav = (AVALANCHE_KNEE / AVALANCHE_R) * av.value;
        const gav = av.slope / AVALANCHE_R;
        return {
          ic: (cbe - cbc) * k - cbc / br - g * vbc + iav,
          ib: cbe / bf + cbc / br + g * (vbe + vbc),
          dicVbe: gbe * k + gav,
          dicVbc: -gbc * k - (cbe - cbc) * inv - gbc / br - g - gav,
          dibVbe: gbe / bf + g,
          dibVbc: gbc / br + g,
          iav,
        };
      };

      return {
        nonlinear: true,
        beginSolve() {
          be.begin();
          bc.begin();
        },
        stamp(m, step, x) {
          if (burned) {
            m.conductance(c, e, 1 / R_FAILED_SHORT);
            return;
          }
          const nl = step.nl;
          const lbe = be.linearize(p * (x.v(b) - x.v(e)), nl).v;
          const lbc = bc.linearize(p * (x.v(b) - x.v(c)), nl).v;
          const d = evaluate(lbe, lbc, nl.gmin);
          // Pin currents p·I(p·V): the conductances keep their sign, the currents flip.
          m.transconductance(c, e, b, e, d.dicVbe);
          m.transconductance(c, e, b, c, d.dicVbc);
          m.current(c, e, p * (d.ic - d.dicVbe * lbe - d.dicVbc * lbc));
          m.transconductance(b, e, b, e, d.dibVbe);
          m.transconductance(b, e, b, c, d.dibVbc);
          m.current(b, e, p * (d.ib - d.dibVbe * lbe - d.dibVbc * lbc));
        },
        stampAc(m, _ctx, op) {
          if (burned) {
            m.admittance(c, e, 1 / R_FAILED_SHORT);
            return;
          }
          const d = evaluate(p * (op.v(b) - op.v(e)), p * (op.v(b) - op.v(c)), 0);
          m.transconductance(c, e, b, e, d.dicVbe);
          m.transconductance(c, e, b, c, d.dicVbc);
          m.transconductance(b, e, b, e, d.dibVbe);
          m.transconductance(b, e, b, c, d.dibVbc);
        },
        update(step, x, ctx) {
          if (burned) {
            ic = (p * (x.v(c) - x.v(e))) / R_FAILED_SHORT;
            ib = 0;
            return;
          }
          vbe = p * (x.v(b) - x.v(e));
          vbc = p * (x.v(b) - x.v(c));
          const d = evaluate(vbe, vbc, 0);
          ic = d.ic;
          ib = d.ib;
          if (!ctx.commit) return;
          be.commit(vbe);
          bc.commit(vbc);
          const vce = vbe - vbc;
          const vceo = num(params, 'vceo');
          if (!avalancheWarned && d.iav > 1e-3) {
            avalancheWarned = true;
            ctx.emit(
              'warning',
              `O transistor ${id} entrou em avalanche: a tensão coletor-emissor chegou a ${formatSI(vce, 'V')}, máximo ${formatSI(vceo, 'V')}. Carga indutiva sem diodo de proteção gera picos assim.`,
            );
          } else if (avalancheWarned && vce < 0.8 * vceo) {
            avalancheWarned = false;
          }
          const result = heat.step(ic * vce + ib * vbe, step.dt);
          if (result === 'burned') burned = true;
          reportHeating(
            ctx,
            result,
            `O transistor ${id}`,
            heat.power,
            num(params, 'power'),
            'e entrou em curto entre coletor e emissor',
          );
        },
        pinCurrents(_x, out) {
          out[0] = p * ib;
          out[1] = p * ic;
          out[2] = -p * (ib + ic);
        },
        readouts(x, out) {
          const vce = p * (x.v(c) - x.v(e));
          out('ic', ic);
          out('ib', ib);
          out('vbe', p * (x.v(b) - x.v(e)));
          out('vce', vce);
          out('power', ic * vce + ib * vbe);
          out(
            'region',
            burned
              ? 'queimado'
              : ic < 1e-6 && vbe < 0.5
                ? 'corte'
                : vbc > 0.4
                  ? 'saturação'
                  : 'ativa',
          );
          out('temperature', heat.temperature);
          out('burned', burned);
        },
        paramChanged: configure,
        reset() {
          be.reset();
          bc.reset();
          heat.reset();
          burned = avalancheWarned = false;
          ic = ib = vbe = vbc = 0;
        },
      };
    },
  });
}
