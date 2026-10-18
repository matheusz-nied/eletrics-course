import { useEffect, useState } from 'react';
import type { SimController } from '../runtime/controller';
import { useSim, useSimState } from './context';
import { Icon } from './icons';

/**
 * Ids of the challenges met since the simulation started. A mark stays when
 * the student moves on (the next challenge often undoes the previous one);
 * "Reiniciar" sends time back to zero and clears them.
 */
function useMetGoals(sim: SimController): ReadonlySet<string> {
  const [met, setMet] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const goals = sim.doc.goals ?? [];
    return sim.store.subscribe((s, prev) => {
      const restarted = s.t < prev.t;
      if (!restarted && s.slow === prev.slow) return;
      setMet((old) => {
        const base = restarted ? new Set<string>() : old;
        const added = goals.filter((g) => !base.has(g.id) && sim.goalMet(g, s.slow) === true);
        if (!restarted && added.length === 0) return old;
        return new Set([...base, ...added.map((g) => g.id)]);
      });
    });
  }, [sim]);
  return met;
}

export function Goals() {
  const sim = useSim();
  const frame = useSimState((s) => s.slow);
  const met = useMetGoals(sim);
  const goals = sim.doc.goals ?? [];
  if (goals.length === 0) return null;
  const results = goals.map((g) => met.has(g.id) || sim.goalMet(g, frame) === true);
  const done = results.filter(Boolean).length;
  return (
    <section className="sim-goals" aria-label="Desafios">
      <p className="sim-goals__title">
        Desafio{' '}
        <span className="num">
          {done}/{goals.length}
        </span>
      </p>
      <ul>
        {goals.map((g, i) => (
          <li key={g.id} className={results[i] ? 'is-done' : undefined}>
            <span className="sim-goals__mark" aria-hidden="true">
              {results[i] && <Icon name="check" size={14} />}
            </span>
            <span>{g.description}</span>
            <span className="sim-sr">{results[i] ? '(cumprido)' : '(pendente)'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
