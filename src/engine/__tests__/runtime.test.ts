import { describe, expect, it } from 'vitest';
import type { SimFrame } from '../contract';
import { createSimulation } from '../index';
import { WorkerSimulation } from '../runtime/client';
import { SimHost } from '../runtime/host';
import { LocalSimulation, type Clock } from '../runtime/local';
import type { FromWorker, ToWorker } from '../runtime/protocol';
import { loop } from './utils';

/** Deterministic clock: time moves only with advance(). */
class FakeClock implements Clock {
  time = 0;
  private timers: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 1;
  now() {
    return this.time;
  }
  setTimer(fn: () => void, ms: number) {
    const id = this.nextId++;
    this.timers.push({ at: this.time + ms, fn, id });
    return id;
  }
  clearTimer(id: unknown) {
    this.timers = this.timers.filter((t) => t.id !== id);
  }
  advance(ms: number) {
    const end = this.time + ms;
    for (;;) {
      this.timers.sort((x, y) => x.at - y.at);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.time = Math.max(this.time, next.at);
      next.fn();
    }
    this.time = end;
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const lampCircuit = () =>
  loop('lampada-chave', [
    { id: 'B1', type: 'battery', params: { voltage: 12, resistance: 0 } },
    { id: 'S1', type: 'switch', control: { param: 'closed', label: 'Chave', kind: 'toggle' } },
    { id: 'L1', type: 'lamp' },
  ]);

const rcCircuit = (tStop?: number) =>
  loop(
    'rc',
    [
      { id: 'V1', type: 'dc-voltage', params: { voltage: 10 } },
      { id: 'R1', type: 'resistor', params: { resistance: 1000 } },
      { id: 'C1', type: 'capacitor', params: { capacitance: 1e-4 } },
    ],
    { kind: 'transient', dt: 1e-4, tStop },
    { probes: [{ id: 'Vc', kind: 'voltage', plus: 'C1.a', minus: 'GND' }] },
  );

describe('LocalSimulation', () => {
  it('emits a frame on load and when a parameter changes while paused', async () => {
    const sim = new LocalSimulation(new FakeClock());
    const frames: SimFrame[] = [];
    sim.subscribe((f) => frames.push(f));
    await sim.load(lampCircuit());
    expect(frames).toHaveLength(1);
    expect(frames[0].readouts['L1.current']).toBeCloseTo(0, 6);
    sim.setParam('S1', 'closed', true);
    expect(frames).toHaveLength(2);
    // Cold filament: the surge shows right away.
    expect(frames[1].readouts['L1.current'] as number).toBeGreaterThan(5);
  });

  it('runs in real time at 60 frames per second, with a speed factor', async () => {
    const clock = new FakeClock();
    const sim = new LocalSimulation(clock);
    const frames: SimFrame[] = [];
    sim.subscribe((f) => frames.push(f));
    await sim.load(rcCircuit());
    sim.play();
    clock.advance(1000);
    const last = frames.at(-1)!;
    expect(last.t).toBeGreaterThan(0.98);
    expect(last.t).toBeLessThanOrEqual(1.0001);
    expect(frames.length).toBeGreaterThan(55);
    expect(frames.length).toBeLessThan(66);
    // τ = 0,1 s: fully charged after 1 s.
    expect(last.readouts['C1.voltage']).toBeCloseTo(10, 2);
    // Samples of every step for the oscilloscope.
    const steps = frames.reduce((n, f) => n + (f.samples?.t.length ?? 0), 0);
    expect(steps).toBeGreaterThan(9800);

    sim.setSpeed(0.1);
    const t0 = last.t;
    clock.advance(1000);
    expect(frames.at(-1)!.t - t0).toBeCloseTo(0.1, 2);

    sim.pause();
    const count = frames.length;
    clock.advance(1000);
    expect(frames.length).toBe(count);
  });

  it('stops at tStop and restarts from zero when played again', async () => {
    const clock = new FakeClock();
    const sim = new LocalSimulation(clock);
    const frames: SimFrame[] = [];
    sim.subscribe((f) => frames.push(f));
    await sim.load(rcCircuit(0.25));
    sim.play();
    clock.advance(2000);
    expect(frames.at(-1)!.t).toBeCloseTo(0.25, 6);
    sim.play();
    clock.advance(100);
    expect(frames.at(-1)!.t).toBeLessThan(0.2);
  });

  it('runUntil returns sampled frames and reset goes back to zero', async () => {
    const sim = new LocalSimulation(new FakeClock());
    await sim.load(rcCircuit());
    const frames = await sim.runUntil(0.5, { maxFrames: 50 });
    expect(frames.length).toBe(50);
    expect(frames.at(-1)!.t).toBeCloseTo(0.5, 6);
    expect(frames[0].t).toBeCloseTo(0.01, 6);
    const latest: SimFrame[] = [];
    sim.subscribe((f) => latest.push(f));
    sim.reset();
    expect(latest.at(-1)!.t).toBe(0);
    expect(latest.at(-1)!.readouts['C1.voltage']).toBeCloseTo(0, 6);
  });

  it('rejects an invalid circuit with the problems in pt-BR', async () => {
    const sim = new LocalSimulation(new FakeClock());
    const doc = lampCircuit();
    doc.elements[0].type = 'pilha';
    await expect(sim.load(doc)).rejects.toThrow('tipo de dispositivo desconhecido "pilha"');
  });

  it('createSimulation runs on the calling thread when there is no Worker', async () => {
    const sim = createSimulation();
    expect(sim).toBeInstanceOf(LocalSimulation);
    await sim.load(rcCircuit());
    const frames = await sim.runUntil(0.1, { maxFrames: 1 });
    expect(frames[0].readouts['C1.voltage']).toBeCloseTo(10 * (1 - Math.exp(-1)), 2);
    sim.dispose();
  });
});

describe('worker protocol', () => {
  /** Page and worker connected by an asynchronous in-memory channel. */
  function channel(clock: Clock) {
    const toPage: ((e: { data: FromWorker }) => void)[] = [];
    const host = new SimHost((msg) => {
      const copy = structuredClone(msg);
      setTimeout(() => toPage.forEach((l) => l({ data: copy })), 0);
    }, clock);
    const port = {
      postMessage(msg: ToWorker) {
        const copy = structuredClone(msg);
        setTimeout(() => host.handle(copy), 0);
      },
      addEventListener(_type: 'message', listener: (e: { data: FromWorker }) => void) {
        toPage.push(listener);
      },
    };
    return port;
  }

  it('loads, plays, changes parameters and runs to a time through messages', async () => {
    const clock = new FakeClock();
    const port = channel(clock);
    const sim = new WorkerSimulation(port);
    const frames: SimFrame[] = [];
    sim.subscribe((f) => frames.push(f));
    await sim.load(lampCircuit());
    await flush();
    expect(frames).toHaveLength(1);

    sim.setParam('S1', 'closed', true);
    sim.play();
    await flush();
    clock.advance(500);
    await flush();
    const last = frames.at(-1)!;
    expect(last.t).toBeGreaterThan(0.45);
    expect(last.readouts['L1.brightness'] as number).toBeCloseTo(1, 1);

    sim.pause();
    const result = await sim.runUntil(1, { maxFrames: 10 });
    expect(result).toHaveLength(10);
    expect(result.at(-1)!.t).toBeCloseTo(1, 6);

    // Two simulations share the channel without mixing frames.
    const other = new WorkerSimulation(port);
    await other.load(rcCircuit());
    const otherFrames = await other.runUntil(0.1, { maxFrames: 1 });
    expect(otherFrames[0].readouts['C1.voltage']).toBeDefined();
    expect(otherFrames[0].readouts['L1.brightness']).toBeUndefined();

    sim.dispose();
    other.dispose();
    await expect(sim.runUntil(2)).rejects.toThrow('Simulação encerrada.');
  });

  it('rejects load errors across the worker boundary', async () => {
    const sim = new WorkerSimulation(channel(new FakeClock()));
    const doc = rcCircuit();
    doc.analysis = { kind: 'transient', dt: -1 };
    await expect(sim.load(doc)).rejects.toThrow('analysis.dt');
  });
});
