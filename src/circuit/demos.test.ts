import { describe, expect, it } from 'vitest';
import { validateCircuit } from '../engine';
import { engineFor, runsOnRealEngine } from './engine';
import { listCircuitIds, loadCircuit } from './registry';
import { buildSchematicModel } from './schematic/model';
import { hasSymbol } from './symbols';

const ids = listCircuitIds();

describe('circuit registry', () => {
  it('finds the lesson circuits and the demos', () => {
    expect(ids).toContain('m00/exemplo');
    expect(ids).toContain('demo/lampada-potenciometro');
  });

  it('refuses an unknown id with a pt-BR message', async () => {
    await expect(loadCircuit('m99/nao-existe')).rejects.toThrow(/não encontrado/);
  });
});

describe.each(ids)('%s', (id) => {
  it('builds a schematic with a symbol for every part', async () => {
    const doc = await loadCircuit(id);
    const engine = engineFor(doc);
    const model = buildSchematicModel(doc.elements, engine.buildNetlist(doc), doc.view);
    for (const el of doc.elements) {
      if (el.type !== 'wire') expect(hasSymbol(el.type), el.type).toBe(true);
    }
    expect(model.elements.length).toBe(doc.elements.filter((e) => e.type !== 'wire').length);
    // Every pin lands on a node.
    for (const v of model.elements)
      for (const p of v.pins) expect(p.node, `${v.el.id}.${p.name}`).toBeGreaterThanOrEqual(0);
  });

  it('runs without NaN on its engine', async () => {
    const doc = await loadCircuit(id);
    if (runsOnRealEngine(doc)) expect(validateCircuit(doc).errors).toEqual([]);
    const sim = engineFor(doc).createSimulation({ worker: false });
    await sim.load(doc);
    const a = doc.analysis;
    const until = a.kind === 'transient' ? Math.min(a.tStop ?? 0.05, a.dt * 200) : 0.05;
    const frames = await sim.runUntil(until, { maxFrames: 20 });
    expect(frames.length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(frames.at(-1)!.readouts)) {
      if (typeof value === 'number') expect(Number.isNaN(value), key).toBe(false);
    }
    sim.dispose();
  });
});
