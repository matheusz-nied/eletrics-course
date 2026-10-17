import { describe, expect, it } from 'vitest';
import { Simulator } from '../analysis/simulator';
import { ladderCircuit } from '../benchmark';

/**
 * The browser requirement is 1000 steps/s for 50 nodes on a mid-range phone
 * with a 4× slowed CPU (docs/plano/02-arquitetura.md, section 5.4; measured on
 * /dev/motor/ by the e2e test). Here we ask for far more so CI catches regressions.
 */

describe('performance', () => {
  it('steps a 50-node circuit far faster than real time needs', () => {
    const sim = new Simulator(ladderCircuit());
    sim.refresh();
    for (let i = 0; i < 200; i++) sim.step(); // warm up the JIT
    const n = 5000;
    const start = performance.now();
    for (let i = 0; i < n; i++) sim.step();
    const stepsPerSecond = n / ((performance.now() - start) / 1000);
    const frameStart = performance.now();
    for (let i = 0; i < 60; i++) sim.frame();
    const frameMs = (performance.now() - frameStart) / 60;
    console.log(
      `50 nós: ${Math.round(stepsPerSecond)} passos/s, quadro em ${frameMs.toFixed(3)} ms`,
    );
    expect(stepsPerSecond).toBeGreaterThan(10000);
    expect(frameMs).toBeLessThan(2);
  });

  it('steps a 50-node circuit with diodes and LEDs (Newton-Raphson every step)', () => {
    const sim = new Simulator(ladderCircuit(50, true));
    sim.refresh();
    for (let i = 0; i < 200; i++) sim.step();
    const n = 3000;
    const start = performance.now();
    for (let i = 0; i < n; i++) sim.step();
    const stepsPerSecond = n / ((performance.now() - start) / 1000);
    console.log(`50 nós com diodos e LEDs: ${Math.round(stepsPerSecond)} passos/s`);
    expect(stepsPerSecond).toBeGreaterThan(5000);
  });
});
