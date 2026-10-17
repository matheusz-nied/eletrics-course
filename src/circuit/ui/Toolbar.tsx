import { useEffect, useRef } from 'react';
import { formatSpeed, formatTime } from '../format';
import { useSim, useSimState } from './context';
import { Icon } from './icons';

const SPEEDS = [0.001, 0.01, 0.1, 0.25, 0.5, 1, 2, 5, 10];

export function Toolbar({ soundAvailable }: { soundAvailable: boolean }) {
  const sim = useSim();
  const playing = useSimState((s) => s.playing);
  const ready = useSimState((s) => s.ready);
  const speed = useSimState((s) => s.speed);
  const t = useSimState((s) => s.t);
  const sound = useSimState((s) => s.sound);
  const timeDomain = !sim.isDc && !sim.isSweep;

  return (
    <div className="sim-toolbar" role="toolbar" aria-label="Controles da simulação">
      <div className="sim-toolbar__group">
        {!sim.isSweep && (
          <button
            type="button"
            className="sim-btn sim-btn--primary"
            onClick={() => sim.togglePlay()}
            disabled={!ready}
            aria-label={playing ? 'Pausar simulação' : 'Iniciar simulação'}
            title={playing ? 'Pausar' : 'Iniciar'}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
        )}
        <button
          type="button"
          className="sim-btn"
          onClick={() => sim.reset()}
          disabled={!ready}
          aria-label="Reiniciar simulação"
          title="Reiniciar (restaura componentes queimados)"
        >
          <Icon name="reset" />
        </button>
        {timeDomain && (
          <label className="sim-speed">
            <span className="sim-sr">Velocidade</span>
            <select
              value={String(speed)}
              onChange={(e) => sim.setSpeed(Number(e.target.value))}
              aria-label="Velocidade da simulação"
            >
              {(SPEEDS.includes(speed) ? SPEEDS : [...SPEEDS, speed].sort((a, b) => a - b)).map(
                (s) => (
                  <option key={s} value={String(s)}>
                    {formatSpeed(s)}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
        {timeDomain && (
          <span className="sim-time num" aria-live="off" title="Tempo simulado">
            t = {formatTime(t)}
          </span>
        )}
      </div>
      <div className="sim-toolbar__group">
        <ViewMenu />
        {soundAvailable && (
          <button
            type="button"
            className="sim-btn"
            aria-pressed={sound}
            onClick={() => sim.store.setState({ sound: !sound })}
            aria-label={sound ? 'Desligar som' : 'Ligar som'}
            title={sound ? 'Som ligado' : 'Som desligado'}
          >
            <Icon name={sound ? 'sound' : 'mute'} />
          </button>
        )}
      </div>
    </div>
  );
}

function ViewMenu() {
  const sim = useSim();
  const view = useSimState((s) => s.view);
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    };
    const esc = (e: KeyboardEvent) => {
      const d = ref.current;
      if (e.key === 'Escape' && d?.open) {
        d.open = false;
        d.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const options: { key: keyof typeof view; label: string }[] = [
    { key: 'current', label: 'Corrente andando nos fios' },
    { key: 'electrons', label: 'Mostrar o sentido dos elétrons' },
    { key: 'voltage', label: 'Cores de tensão' },
    { key: 'nodeLabels', label: 'Tensão em cada ponto' },
  ];

  return (
    <details className="sim-menu" ref={ref}>
      <summary className="sim-btn" aria-label="Opções de exibição" title="Exibir">
        <Icon name="eye" />
      </summary>
      <div className="sim-menu__panel">
        <p className="sim-menu__title">Exibir</p>
        {options.map((o) => (
          <label key={o.key} className="sim-check">
            <input
              type="checkbox"
              checked={view[o.key]}
              disabled={o.key === 'electrons' && !view.current}
              onChange={(e) => sim.setView({ [o.key]: e.target.checked })}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
