import { useSim, useSimState } from './context';
import { Icon } from './icons';

export function Goals() {
  const sim = useSim();
  const frame = useSimState((s) => s.slow);
  const goals = sim.doc.goals ?? [];
  if (goals.length === 0) return null;
  const results = goals.map((g) => sim.goalMet(g, frame) === true);
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
