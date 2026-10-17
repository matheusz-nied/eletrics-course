/** Accessible table with the live values of every element (alternative to hovering). */
import { formatQuantity } from '../readouts';
import { useSim, useSimState } from './context';

export function ValuesTable() {
  const sim = useSim();
  const frame = useSimState((s) => s.slow);
  const rows = sim.model.elements.filter((v) => v.two && v.el.type !== 'ground');
  if (rows.length === 0 || sim.isSweep) return null;
  return (
    <details className="sim-table">
      <summary>Tabela de valores</summary>
      <div className="sim-table__wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Componente</th>
              <th scope="col">Tensão</th>
              <th scope="col">Corrente</th>
              <th scope="col">Potência</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const r = (q: string) => frame?.readouts[`${v.el.id}.${q}`];
              const abs = (x: unknown) => (typeof x === 'number' ? Math.abs(x) : undefined);
              return (
                <tr key={v.el.id}>
                  <th scope="row">
                    {v.el.label ?? v.el.id} <span className="sim-table__type">{v.info?.label}</span>
                  </th>
                  <td className="num">{formatQuantity('voltage', abs(r('voltage')))}</td>
                  <td className="num">{formatQuantity('current', abs(r('current')))}</td>
                  <td className="num">{formatQuantity('power', abs(r('power')))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
