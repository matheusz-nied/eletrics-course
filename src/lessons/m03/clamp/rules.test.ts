import { describe, expect, it } from 'vitest';
import { CLAMPS, JAWS, LOADS, clampRead } from './rules';

describe('clamp meter', () => {
  it('reads the current of one conductor', () => {
    expect(clampRead('chuveiro', 'um', 'ca').digits).toBe(' 25.00');
    expect(clampRead('ferro', 'um', 'cacc-ac').digits).toBe(' 7.874');
    expect(clampRead('chuveiro', 'um', 'ca').status).toBe('ok');
  });

  it('reads almost zero around the whole cable', () => {
    const r = clampRead('chuveiro', 'cabo', 'ca');
    expect(r.digits).toBe(' 0.000');
    expect(r.status).toBe('warn');
  });

  it('multiplies by ten in the ×10 opening of a line splitter', () => {
    expect(clampRead('portao', 'separador', 'ca').digits).toBe(' 24.00');
    expect(clampRead('chuveiro', 'separador', 'ca').digits).toBe(' 250.0');
    expect(clampRead('partida', 'separador', 'cacc-dc').digits).toBe(' OL');
  });

  it('needs a Hall clamp in A⎓ for direct current', () => {
    expect(clampRead('partida', 'um', 'ca').digits).toBe(' 0.000');
    expect(clampRead('partida', 'um', 'cacc-ac').digits).toBe(' 0.000');
    expect(clampRead('partida', 'um', 'cacc-dc').digits).toBe(' 150.0');
    expect(clampRead('chuveiro', 'um', 'cacc-dc').digits).toBe(' 0.000');
  });

  it('has a pt-BR message for every combination', () => {
    for (const l of LOADS)
      for (const j of JAWS)
        for (const c of CLAMPS) {
          expect(
            clampRead(l.id, j.id, c.id).message.length,
            `${l.id}/${j.id}/${c.id}`,
          ).toBeGreaterThan(30);
        }
  });
});
