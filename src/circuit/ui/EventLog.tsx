import { formatTime } from '../format';
import { useSim, useSimState } from './context';
import { Icon } from './icons';

export function EventLog() {
  const sim = useSim();
  const events = useSimState((s) => s.events);
  const damaged = events.some((e) => e.kind === 'damaged' || e.kind === 'tripped');
  return (
    <div className="sim-events" aria-live="polite" aria-relevant="additions">
      {events.length > 0 && (
        <ul>
          {[...events].reverse().map((e) => (
            <li key={e.key} className={`sim-event sim-event--${e.kind}`}>
              <Icon
                name={e.kind === 'info' ? 'info' : e.kind === 'warning' ? 'warn' : 'bolt'}
                size={16}
              />
              <span>{e.message}</span>
              {!sim.isDc && !sim.isSweep && (
                <span className="sim-event__t num">{formatTime(e.t)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {damaged && (
        <p className="sim-events__hint">
          Use <strong>Reiniciar</strong> para trocar o componente danificado e começar de novo.
        </p>
      )}
    </div>
  );
}
