import { describe, expect, it } from 'vitest';
import firmware, { readPins } from '../firmware/central-generica';
import { CONFIG, initialState, stepCentral, type CentralInputs } from '../central/controller';
import { GATE_PARAMS } from '../central/plant';
import { GateSystem, type SystemOptions } from '../central/system';

const OPEN = GATE_PARAMS.imaFca;
const CLOSED = 0;

/** A system that never energizes both relays and only switches them with no current. */
function watched(opts: SystemOptions = {}) {
  const sys = new GateSystem(opts);
  const problems: string[] = [];
  let prev = { k1: false, k2: false };
  let bothOffFor = 1;
  let lastDir: 'k1' | 'k2' | null = null;
  const check = (s: GateSystem) => {
    const k1 = s.pins.K1 === true;
    const k2 = s.pins.K2 === true;
    const triac = Number(s.pins.TRIAC ?? 0);
    if (k1 && k2) problems.push(`K1 e K2 juntos em t=${s.t.toFixed(2)}`);
    if ((k1 !== prev.k1 || k2 !== prev.k2) && triac > 0) {
      problems.push(`relé comutou com o TRIAC conduzindo em t=${s.t.toFixed(2)}`);
    }
    if (!k1 && !k2) bothOffFor += s.period;
    else {
      const dir = k1 ? 'k1' : 'k2';
      if (lastDir && dir !== lastDir && bothOffFor + 1e-9 < CONFIG.tempoMorto) {
        problems.push(`inverteu sem tempo morto em t=${s.t.toFixed(2)}`);
      }
      lastDir = dir;
      bothOffFor = 0;
    }
    prev = { k1, k2 };
  };
  return {
    sys,
    problems,
    run: (seconds: number) => sys.run(seconds, check),
    until: (done: (s: GateSystem) => boolean, limit?: number) => sys.runUntil(done, limit, check),
  };
}

describe('central genérica CD-1', () => {
  it('declares the pins of the board', () => {
    const names = firmware.pins.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['FCA', 'FCF', 'BOT', 'FOTO', 'PROG', 'K1', 'K2', 'TRIAC']),
    );
    expect(firmware.id).toBe('m16/central-generica');
    for (const p of firmware.pins.filter((p) => p.kind === 'digital-in')) {
      expect(p.pullUp, p.name).toBe(true);
    }
  });

  it('reads closed contacts as low pins and unconnected inputs as open', () => {
    const inputs = readPins({ FCA: false, FCF: true, FOTO: true, PAUSA: 2.5, CORRENTE: 1 });
    expect(inputs.fca).toBe(true);
    expect(inputs.fcf).toBe(false);
    expect(inputs.feixeLivre).toBe(false);
    expect(inputs.botoeira).toBe(false); // BOT missing: pull-up, not pressed
    expect(inputs.pausa).toBeCloseTo(0.5);
    expect(inputs.corrente).toBeCloseTo(2);
  });

  it('knows where the gate is at power-up', () => {
    const closed = new GateSystem({ position: CLOSED });
    closed.step();
    expect(closed.estado).toBe('FECHADO');
    const open = new GateSystem({ position: OPEN });
    open.step();
    expect(open.estado).toBe('ABERTO');
    const middle = new GateSystem({ position: 2 });
    middle.step();
    expect(middle.estado).toBe('PARADO');
  });

  it('opens on a command and stops at the opening limit switch', () => {
    const w = watched({ settings: { j2: false } });
    w.run(0.1);
    w.sys.press('botoeira');
    w.run(0.1);
    expect(w.sys.estado).toBe('ABRINDO');
    expect(w.sys.pins.TRAVA).toBe(true);
    expect(w.sys.pins.AUX).toBe(true);

    const took = w.until((s) => s.estado === 'ABERTO');
    expect(w.sys.estado).toBe('ABERTO');
    // 4 m at about 15 m/min, a little slower with FORÇA at half.
    expect(took).toBeGreaterThan(15);
    expect(took).toBeLessThan(25);
    w.run(1);
    expect(w.sys.pins.K1).toBe(false);
    expect(w.sys.pins.TRIAC).toBe(0);
    expect(w.sys.plant.speed).toBe(0);
    expect(Math.abs(w.sys.plant.position - OPEN)).toBeLessThan(GATE_PARAMS.zonaReed);
    expect(w.sys.pins.AUX).toBe(false); // DIP LUZ off: light only while moving
    expect(w.problems).toEqual([]);
  });

  it('starts the motor softly: relay first, then a TRIAC ramp', () => {
    const w = watched();
    w.run(0.1);
    w.sys.press('botoeira');
    let firstTriac: number | undefined;
    let relayBeforeTriac = false;
    w.until((s) => {
      const triac = Number(s.pins.TRIAC);
      if (s.pins.K1 && triac === 0) relayBeforeTriac = true;
      if (triac > 0 && firstTriac === undefined) firstTriac = triac;
      return triac > 0 && s.state.motor.fase === 'regime';
    }, 5);
    expect(relayBeforeTriac).toBe(true);
    expect(firstTriac).toBeLessThanOrEqual(CONFIG.nivelPartida + 0.01);
    expect(Number(w.sys.pins.TRIAC)).toBeCloseTo(0.7); // FORÇA at half: 0,4 + 0,6 × 0,5
  });

  it('closes by itself after the pause (J2 AUT) and stops at the closing limit switch', () => {
    const w = watched({ position: OPEN, settings: { j2: true, pausa: 10 / 120 } });
    w.run(0.1);
    expect(w.sys.estado).toBe('ABERTO');
    expect(w.sys.readouts.pausaRestante).toBeCloseTo(10, 0);
    const waited = w.until((s) => s.estado === 'FECHANDO', 30);
    expect(waited).toBeCloseTo(10, 0);
    w.until((s) => s.estado === 'FECHADO', 60);
    expect(w.sys.estado).toBe('FECHADO');
    expect(w.sys.plant.position).toBeLessThan(GATE_PARAMS.imaFcf + GATE_PARAMS.zonaReed);
    expect(w.problems).toEqual([]);
  });

  it('does not close by itself without J2, or with PAUSA at minimum', () => {
    for (const settings of [
      { j2: false, pausa: 0.5 },
      { j2: true, pausa: 0 },
    ]) {
      const sys = new GateSystem({ position: OPEN, settings });
      sys.run(130);
      expect(sys.estado, JSON.stringify(settings)).toBe('ABERTO');
    }
  });

  it('opens again when the beam is interrupted while closing, after the dead time', () => {
    const w = watched({ position: OPEN, settings: { j2: false } });
    w.run(0.1);
    w.sys.press('botoeira');
    w.until((s) => s.estado === 'FECHANDO' && s.plant.position < 3);
    w.sys.env.feixeInterrompido = true;
    w.run(0.02);
    expect(w.sys.estado).toBe('ABRINDO');
    expect(w.sys.log.at(-1)?.message).toMatch(/fotocélula/i);
    const startedAt = w.sys.plant.position;
    w.sys.env.feixeInterrompido = false;
    w.until((s) => s.estado === 'ABERTO', 40);
    expect(w.sys.plant.position).toBeGreaterThan(startedAt);
    expect(w.problems).toEqual([]);
  });

  it('keeps the gate open while the beam is interrupted, then counts the pause again', () => {
    const sys = new GateSystem({ position: OPEN, settings: { j2: true, pausa: 10 / 120 } });
    sys.run(5);
    sys.env.feixeInterrompido = true;
    sys.run(30);
    expect(sys.estado).toBe('ABERTO');
    sys.press('botoeira');
    sys.run(0.5);
    expect(sys.estado).toBe('ABERTO'); // a command does not close it either
    sys.env.feixeInterrompido = false;
    const waited = sys.runUntil((s) => s.estado === 'FECHANDO', 30);
    expect(waited).toBeCloseTo(10, 0);
  });

  it('treats a broken photocell wire like an interrupted beam (NC contact)', () => {
    const sys = new GateSystem({ position: OPEN, faults: { semFotocelula: true } });
    sys.run(0.1);
    sys.press('botoeira');
    sys.run(5);
    expect(sys.estado).toBe('ABERTO');
    expect(sys.readouts.fotocelula).toBe('interrompida');
  });

  it('ignores the photocell with J1 fitted, which is why it must not be used', () => {
    const sys = new GateSystem({ position: OPEN, settings: { j1: true, j2: false } });
    sys.run(0.1);
    expect(sys.readouts.fotocelula).toBe('ignorada');
    expect(sys.log.some((e) => e.kind === 'warning' && /J1/.test(e.message))).toBe(true);
    sys.env.feixeInterrompido = true;
    sys.press('botoeira');
    sys.runUntil((s) => s.estado === 'FECHADO', 60);
    expect(sys.estado).toBe('FECHADO');
  });

  it('stops on a command while opening and then goes the other way', () => {
    const w = watched({ settings: { j2: false } });
    w.run(0.1);
    w.sys.press('botoeira');
    w.run(5);
    w.sys.press('botoeira');
    w.run(0.1);
    expect(w.sys.estado).toBe('PARADO');
    w.run(1);
    expect(w.sys.plant.speed).toBe(0);
    w.sys.press('botoeira');
    w.run(0.1);
    expect(w.sys.estado).toBe('FECHANDO');
    w.run(2);
    w.sys.press('botoeira');
    w.run(0.1);
    expect(w.sys.estado).toBe('ABRINDO'); // a command while closing reverses
    w.until((s) => s.estado === 'ABERTO', 40);
    expect(w.problems).toEqual([]);
  });

  it('opens on the first command when it does not know where the gate is', () => {
    const sys = new GateSystem({ position: 2 });
    sys.run(0.1);
    sys.press('botoeira');
    sys.run(0.1);
    expect(sys.estado).toBe('ABRINDO');
  });

  it('reverses when the closing gate hits an obstacle', () => {
    const w = watched({ position: OPEN, settings: { j2: false, forca: 0.5 } });
    w.sys.env.obstaculo = 2;
    w.run(0.1);
    w.sys.press('botoeira');
    w.until((s) => s.estado !== 'FECHANDO' && s.t > 1, 40);
    expect(w.sys.estado).toBe('ABRINDO');
    expect(w.sys.log.some((e) => /obstáculo/i.test(e.message))).toBe(true);
    expect(w.sys.plant.position).toBeCloseTo(2, 1);
    expect(w.problems).toEqual([]);
  });

  it('stops and backs off when the opening gate is held', () => {
    const w = watched({ settings: { j2: false } });
    w.run(0.1);
    w.sys.press('botoeira');
    w.run(4);
    // Someone holds the gate: it cannot move further open.
    w.sys.env.obstaculoAbertura = w.sys.plant.position + 0.01;
    w.until((s) => s.estado === 'PARADO', 5);
    expect(w.sys.estado).toBe('PARADO');
    expect(w.sys.log.some((e) => /obstáculo na abertura/i.test(e.message))).toBe(true);
    const stoppedAt = w.sys.plant.position;
    w.run(3);
    // It backed off in the closing direction for about half a second, then stopped.
    const backedOff = stoppedAt - w.sys.plant.position;
    expect(backedOff).toBeGreaterThan(0.01);
    expect(backedOff).toBeLessThan(0.15);
    expect(w.sys.estado).toBe('PARADO');
    expect(w.sys.pins.K2).toBe(false);
    expect(w.problems).toEqual([]);
  });

  it('gives up after 40 s without a limit switch (ERRO), blinking PROG and beeping', () => {
    // A long gate, so the 40 s run out before the mechanical end.
    const w = watched({
      faults: { reedDefeituoso: true },
      params: { curso: 14, imaFca: 13.98 },
      settings: { j2: false },
    });
    w.run(0.1);
    w.sys.press('botoeira');
    const took = w.until((s) => s.estado === 'ERRO', 60);
    expect(took).toBeGreaterThan(CONFIG.tempoMaximo - 0.5);
    expect(took).toBeLessThan(CONFIG.tempoMaximo + 0.5);
    let blinks = 0;
    let beeped = false;
    let last = false;
    w.sys.run(3, (s) => {
      if (s.pins.LED_PROG && !last) blinks++;
      last = s.pins.LED_PROG === true;
      if (s.pins.BUZZER) beeped = true;
    });
    expect(blinks).toBeGreaterThanOrEqual(2);
    expect(beeped).toBe(true);
    expect(w.sys.pins.K1).toBe(false);
    expect(w.sys.pins.TRIAC).toBe(0);
    expect(w.problems).toEqual([]);
  });

  it('also ends in ERRO when the motor turns but the gate is released', () => {
    const sys = new GateSystem({ faults: { desbloqueado: true }, settings: { j2: false } });
    sys.run(0.1);
    sys.press('botoeira');
    const took = sys.runUntil((s) => s.estado === 'ERRO', 60);
    expect(took).toBeCloseTo(CONFIG.tempoMaximo, 0);
    expect(sys.plant.position).toBe(0); // the motor turned, the gate did not move
  });

  it('swaps K1 and K2 with DIP INV', () => {
    const normal = new GateSystem();
    const inverted = new GateSystem({ settings: { inv: true } });
    for (const sys of [normal, inverted]) {
      sys.run(0.1);
      sys.press('botoeira');
      sys.run(1);
    }
    expect(normal.pins.K1).toBe(true);
    expect(normal.pins.K2).toBe(false);
    expect(inverted.pins.K1).toBe(false);
    expect(inverted.pins.K2).toBe(true);
  });

  it('with ABRE and FECHA swapped, "opening" closes the gate until it pushes against the end', () => {
    const sys = new GateSystem({
      position: 1,
      faults: { fiosInvertidos: true },
      settings: { j2: false },
    });
    sys.run(0.1);
    sys.press('botoeira');
    sys.run(1.5);
    expect(sys.estado).toBe('ABRINDO');
    expect(sys.plant.speed).toBeLessThan(0); // the first command closes
    sys.runUntil((s) => s.estado === 'PARADO', 10);
    expect(sys.estado).toBe('PARADO');
    expect(sys.plant.position).toBeLessThan(0.05);
    // DIP INV fixes it without touching the wires.
    sys.settings.inv = true;
    sys.press('botoeira');
    sys.run(0.5);
    expect(sys.estado).toBe('FECHADO'); // "closing" from PARADO: already at the closed switch…
    sys.press('botoeira');
    sys.run(0.1);
    expect(sys.estado).toBe('ABRINDO'); // …and one more opens, now the right way
    sys.run(3);
    expect(sys.plant.speed).toBeGreaterThan(0);
  });

  it('hums and does not move without the capacitor', () => {
    const sys = new GateSystem({ faults: { capacitorAberto: true }, settings: { j2: false } });
    sys.run(0.1);
    sys.press('botoeira');
    sys.run(3);
    expect(sys.plant.humming).toBe(true);
    expect(sys.plant.position).toBe(0);
    expect(sys.plant.current).toBeGreaterThan(3);
  });

  it('with FORÇA too low, a rough spot of the track looks like an obstacle', () => {
    const rough = { de: 1, ate: 1.5, forca: 150 };
    const weak = new GateSystem({
      position: OPEN,
      faults: { atritoExtra: rough },
      settings: { j2: false, forca: 0.1 },
    });
    weak.run(0.1);
    weak.press('botoeira');
    weak.runUntil((s) => s.estado !== 'FECHANDO' && s.t > 1, 60);
    expect(weak.estado).toBe('ABRINDO');

    const right = new GateSystem({
      position: OPEN,
      faults: { atritoExtra: { ...rough } },
      settings: { j2: false, forca: 0.8 },
    });
    right.run(0.1);
    right.press('botoeira');
    right.runUntil((s) => s.estado !== 'FECHANDO' && s.t > 1, 60);
    expect(right.estado).toBe('FECHADO');
  });

  describe('remotes', () => {
    const remote = { serial: 'A1B2C3', button: 1 };

    it('ignores a remote that was not learned', () => {
      const sys = new GateSystem();
      sys.run(0.1);
      sys.sendRf(remote);
      sys.run(0.1);
      expect(sys.estado).toBe('FECHADO');
    });

    it('learns a button with a touch on PROG, then obeys it', () => {
      const sys = new GateSystem();
      sys.run(0.1);
      sys.press('prog');
      sys.run(0.3);
      expect(sys.readouts.cadastro).toBe(true);
      expect(sys.pins.LED_PROG).toBe(true);
      sys.sendRf(remote);
      sys.run(0.05);
      expect(sys.readouts.cadastro).toBe(false);
      expect(sys.readouts.controles).toBe(1);
      expect(sys.estado).toBe('FECHADO'); // learning is not a command
      let blinks = 0;
      let last = false;
      sys.run(1, (s) => {
        if (s.pins.LED_PROG && !last) blinks++;
        last = s.pins.LED_PROG === true;
      });
      expect(blinks).toBe(3);
      sys.sendRf(remote);
      sys.run(0.1);
      expect(sys.estado).toBe('ABRINDO');
      // Another button of the same remote is another channel: not learned.
      sys.sendRf({ ...remote, button: 2 });
      sys.run(0.1);
      expect(sys.estado).toBe('ABRINDO');
    });

    it('leaves learning mode after 10 s without a remote', () => {
      const sys = new GateSystem();
      sys.run(0.1);
      sys.press('prog');
      sys.run(10.5);
      expect(sys.readouts.cadastro).toBe(false);
      sys.sendRf(remote);
      sys.run(0.1);
      expect(sys.readouts.controles).toBe(0);
    });

    it('erases every remote when PROG is held for 10 s', () => {
      const sys = new GateSystem();
      sys.run(0.1);
      for (const serial of ['A', 'B']) {
        sys.press('prog');
        sys.run(0.3);
        sys.sendRf({ serial, button: 1 });
        sys.run(1);
      }
      expect(sys.readouts.controles).toBe(2);
      sys.press('prog', 11);
      sys.run(9);
      expect(sys.readouts.controles).toBe(2);
      sys.run(2);
      expect(sys.readouts.controles).toBe(0);
      expect(sys.log.at(-1)?.message).toMatch(/apagados/);
    });

    it('keeps the learned remotes through a power cut', () => {
      const sys = new GateSystem();
      sys.run(0.1);
      sys.press('prog');
      sys.run(0.3);
      sys.sendRf(remote);
      sys.run(1);
      sys.setPower(false);
      sys.run(1);
      sys.setPower(true);
      sys.run(0.1);
      expect(sys.readouts.controles).toBe(1);
      sys.sendRf(remote);
      sys.run(0.1);
      expect(sys.estado).toBe('ABRINDO');
    });

    it('refuses a copied rolling code', () => {
      const sys = new GateSystem({ settings: { j2: false } });
      sys.run(0.1);
      sys.press('prog');
      sys.run(0.3);
      sys.sendRf({ ...remote, counter: 100 });
      sys.run(1);
      sys.sendRf({ ...remote, counter: 101 });
      sys.run(0.1);
      expect(sys.estado).toBe('ABRINDO');
      sys.sendRf({ ...remote, counter: 102 });
      sys.run(0.1);
      expect(sys.estado).toBe('PARADO');
      // Someone recorded press 101 and plays it back.
      sys.sendRf({ ...remote, counter: 101 });
      sys.run(0.1);
      expect(sys.estado).toBe('PARADO');
      expect(sys.log.at(-1)?.message).toMatch(/rolling code/);
    });
  });

  describe('garage light and lock', () => {
    it('keeps the light 60 s after the movement with DIP LUZ', () => {
      const sys = new GateSystem({ settings: { luz: true, j2: false } });
      sys.run(0.1);
      sys.press('botoeira');
      sys.runUntil((s) => s.estado === 'ABERTO', 40);
      sys.run(59);
      expect(sys.pins.AUX).toBe(true);
      sys.run(1.5);
      expect(sys.pins.AUX).toBe(false);
    });

    it('pulses the lock only when it opens from closed', () => {
      const sys = new GateSystem({ settings: { j2: false } });
      sys.run(0.1);
      sys.press('botoeira');
      sys.run(0.5);
      expect(sys.pins.TRAVA).toBe(true);
      sys.run(1);
      expect(sys.pins.TRAVA).toBe(false);
    });
  });
});

describe('controller as a pure function', () => {
  const idle: CentralInputs = {
    fca: false,
    fcf: true,
    botoeira: false,
    feixeLivre: true,
    prog: false,
    j1: false,
    j2: false,
    inv: false,
    luz: false,
    pausa: 0,
    forca: 0.5,
    corrente: 0,
    rf: [],
  };

  it('gives the same result for the same state and inputs, without changing the state', () => {
    const s0 = initialState();
    const frozen = structuredClone(s0);
    const a = stepCentral(s0, idle, 0.01);
    const b = stepCentral(s0, idle, 0.01);
    expect(a).toEqual(b);
    expect(s0).toEqual(frozen);
  });
});
