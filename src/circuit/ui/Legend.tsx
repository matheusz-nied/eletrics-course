import { legendGradient } from '../colors';
import { formatSI } from '../format';
import { useDarkTheme, useSim, useSimState } from './context';

export function Legend() {
  const sim = useSim();
  const view = useSimState((s) => s.view);
  const vmax = useSimState((s) => {
    const v = s.slow?.nodeVoltages;
    if (!v) return 0;
    let m = 0;
    for (const x of Object.values(v)) m = Math.max(m, Math.abs(x));
    return Math.round(m * 1000) / 1000;
  });
  const dark = useDarkTheme();
  if (sim.isSweep || (!view.voltage && !view.current)) return null;
  return (
    <div className="sim-legend" aria-hidden="true">
      {view.voltage && (
        <div className="sim-legend__scale">
          <span className="num">{formatSI(-vmax, 'V', { digits: 2 })}</span>
          <span className="sim-legend__bar" style={{ background: legendGradient(dark) }} />
          <span className="num">{formatSI(vmax, 'V', { digits: 2 })}</span>
        </div>
      )}
      {view.current && (
        <span className={`sim-legend__dots${view.electrons ? ' is-electrons' : ''}`}>
          <i />
          {view.electrons ? 'Elétrons (sentido real)' : 'Corrente (sentido convencional)'}
        </span>
      )}
    </div>
  );
}
