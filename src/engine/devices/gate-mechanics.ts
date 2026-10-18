import { bool, defineDevice, num, str } from '../device';
import { formatNumber } from '../messages';
import { implicitStep, type Shaft, type Track } from '../models/mechanics';

/**
 * Force with which the worm gear brakes the gate when the motor is not
 * pushing it (N): the worm cannot be driven back by the wheel, so a gate
 * left to coast stops within a few centimetres.
 */
const WORM_BRAKE = 350;
/** Positions this close to an end count as being there (m). */
const AT_END = 0.01;
/** Slower than this the gate counts as stopped (m/s). */
const STOPPED = 0.002;

/**
 * A sliding gate on its track, driven by a motor through a worm gear and a
 * pinion on the rack (no electrical pins). It couples to the motor named in
 * `motor` and integrates the whole drive train over each mechanical step:
 * rotor and gate inertia, rolling friction (with an optional stiff stretch of
 * track), the motor torque, the end stops, an obstacle in the closing path,
 * someone holding the gate, and the manual release, with which the motor
 * spins free and the gate stays put. Reed switches couple to it to sense its
 * position.
 */
export default defineDevice({
  info: {
    type: 'gate-mechanics',
    label: 'Mecânica do portão',
    terminals: 'fixed',
    pins: [],
    params: {
      motor: { default: '', label: 'Motor que move o portão (id)' },
      length: { default: 4, label: 'Curso do portão', unit: 'm', min: 0.5, max: 20 },
      mass: { default: 300, label: 'Massa do portão', unit: 'kg', min: 10, max: 3000 },
      friction: { default: 90, label: 'Atrito de rolamento', unit: 'N', min: 0 },
      ratio: { default: 22, label: 'Redução (voltas do motor por volta do pinhão)', min: 1 },
      pinion: { default: 0.03, label: 'Raio do pinhão', unit: 'm', min: 0.005, max: 0.2 },
      efficiency: { default: 0.45, label: 'Rendimento da redução', min: 0.05, max: 1 },
      invert: { default: false, label: 'Motor montado do outro lado (abre girando ao contrário)' },
      position: { default: 0, label: 'Posição inicial (0 = fechado)', unit: 'm', min: 0 },
      released: { default: false, label: 'Destravado (desbloqueio manual aberto)' },
      obstacle: { default: false, label: 'Obstáculo no caminho do fechamento' },
      obstacleAt: { default: 1, label: 'Posição do obstáculo', unit: 'm', min: 0 },
      hold: { default: false, label: 'Alguém segura o portão na abertura' },
      holdAt: { default: 2, label: 'Onde o portão é segurado', unit: 'm', min: 0 },
      extraFriction: { default: 0, label: 'Atrito extra num trecho do trilho', unit: 'N', min: 0 },
      extraFrom: { default: 1.5, label: 'Início do trecho com atrito extra', unit: 'm', min: 0 },
      extraTo: { default: 2.5, label: 'Fim do trecho com atrito extra', unit: 'm', min: 0 },
    },
    readouts: ['position', 'distance', 'velocity', 'force', 'blocked', 'state'],
    readoutInfo: {
      position: { label: 'Posição (0 = fechado, 1 = aberto)' },
      distance: { label: 'Abertura', unit: 'm' },
      velocity: { label: 'Velocidade (+ abrindo)', unit: 'm/s' },
      force: { label: 'Força do motor na cremalheira', unit: 'N' },
      blocked: { label: 'Empurrando algo que não cede' },
      state: { label: 'Situação (fechado, abrindo, aberto, fechando, parado)' },
    },
  },
  links: { motor: ['ac-motor-1ph-cap'] },
  create({ id, params }) {
    let shaft: Shaft | undefined;
    let x = Math.min(num(params, 'position'), num(params, 'length'));
    let v = 0;
    let force = 0;
    let blocked = false;
    let warned = false;
    const track: Track = {
      get position() {
        return x;
      },
    };
    /** Motor speed (rad/s) per gate speed (m/s), with the mounting side. */
    const k = () => (num(params, 'ratio') / num(params, 'pinion')) * (bool(params, 'invert') ? -1 : 1);
    /** Force of the motor at the rack (N) at gate speed `vel`, fan losses taken. */
    const drive = (vel: number) => {
      if (!shaft) return 0;
      const w = vel * k();
      return (shaft.torqueAt(w) - shaft.viscous * w) * k() * num(params, 'efficiency');
    };
    /** Friction against the motion at the rack (N): track, stiff stretch, motor bearings. */
    const resistance = () => {
      let f = num(params, 'friction');
      const extra = num(params, 'extraFriction');
      if (extra > 0 && x >= num(params, 'extraFrom') && x <= num(params, 'extraTo')) f += extra;
      if (shaft) f += shaft.coulomb * Math.abs(k()) * num(params, 'efficiency');
      return f;
    };
    /** Where the gate must stop moving this way (m), if anything is in the way. */
    const stopAt = (direction: number): number => {
      const length = num(params, 'length');
      if (direction < 0) {
        const at = num(params, 'obstacleAt');
        return bool(params, 'obstacle') && at <= length && x >= at - 1e-9 ? at : 0;
      }
      const at = num(params, 'holdAt');
      return bool(params, 'hold') && at >= 0 && x <= at + 1e-9 ? at : length;
    };

    return {
      exposes: { track },
      couple(find) {
        const name = str(params, 'motor');
        if (!name) return undefined;
        shaft = find(name)?.exposes?.shaft;
        if (!shaft) return `"motor" = "${name}" não é um motor que possa mover o portão`;
        shaft.driven = !bool(params, 'released');
        return undefined;
      },
      paramChanged(name) {
        if (name === 'released' && shaft) shaft.driven = !bool(params, 'released');
      },
      stamp() {},
      stampAc() {},
      update(step, _x, ctx) {
        if (!ctx.commit || step.dt <= 0) {
          force = drive(v);
          return;
        }
        const dt = step.dt;
        const released = bool(params, 'released');
        const kk = k();
        const mass = num(params, 'mass') + (shaft && !released ? shaft.inertia * kk * kk : 0);
        const push = released ? () => 0 : drive;
        const fr = resistance();
        const vMax = shaft ? (2 * Math.PI * 60) / Math.abs(kk) : 1;
        let next = implicitStep(v, mass, dt, push, () => fr, vMax);
        // The worm gear does not let the gate drive the motor: when the motor
        // is not pushing it along, the gate is braked.
        if (!released && next !== 0 && push(next) * Math.sign(next) < 0.5 * fr) {
          next = implicitStep(v, mass, dt, push, () => fr + WORM_BRAKE, vMax);
        }
        v = next;
        let moved = x + v * dt;
        blocked = false;
        const pushing = released ? 0 : Math.sign(push(0));
        for (const direction of [-1, 1]) {
          const end = stopAt(direction);
          const past = direction < 0 ? moved <= end : moved >= end;
          if (!past) continue;
          moved = end;
          if (v * direction > 0) v = 0;
          if (!released && pushing === direction) blocked = true;
        }
        x = moved;
        force = push(v);
        if (shaft && !released) shaft.speed = v * kk;
        if (blocked && !warned) {
          warned = true;
          const where = x <= AT_END ? 'no batente de fechamento' : x >= num(params, 'length') - AT_END ? 'no batente de abertura' : `a ${formatNumber(x, 3)} m`;
          ctx.emit('info', `O portão ${id} está parado ${where} com o motor empurrando.`);
        } else if (!blocked) warned = false;
      },
      pinCurrents() {},
      readouts(_x, out) {
        const length = num(params, 'length');
        out('position', x / length);
        out('distance', x);
        out('velocity', v);
        out('force', force);
        out('blocked', blocked);
        out(
          'state',
          v > STOPPED
            ? 'abrindo'
            : v < -STOPPED
              ? 'fechando'
              : x <= AT_END
                ? 'fechado'
                : x >= length - AT_END
                  ? 'aberto'
                  : 'parado',
        );
      },
      reset() {
        x = Math.min(num(params, 'position'), num(params, 'length'));
        v = force = 0;
        blocked = warned = false;
        if (shaft) shaft.speed = 0;
      },
    };
  },
});
