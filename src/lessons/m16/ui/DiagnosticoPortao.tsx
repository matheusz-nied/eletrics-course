/**
 * Diagnosis exercise of lesson 16.9: a gate with a fault, the resident's
 * complaint, the central virtual running that fault, a "Medições" panel
 * whose readings depend on the fault and on the breaker, and a list of
 * causes to check. Used as `<DiagnosticoPortao client:visible />`.
 * Cases and readings live in diagnostico-casos.ts (tested without React).
 */
import { useId, useState, useSyncExternalStore } from 'react';
import CentralVirtual from './CentralVirtual';
import type { CentralController } from './central-controller';
import {
  CASOS,
  CAUSAS,
  MEDICOES,
  contextoDe,
  criarCentral,
  medir,
  type CausaId,
  type MedicaoId,
} from './diagnostico-casos';
import './diagnostico-portao.css';

interface Resultado {
  id: MedicaoId;
  nome: string;
  texto: string;
  bloqueada: boolean;
  disjuntor: boolean;
}

interface Atual {
  indice: number;
  ctl: CentralController;
}

export default function DiagnosticoPortao() {
  const [atual, setAtual] = useState<Atual>(() => ({ indice: 0, ctl: criarCentral(CASOS[0]!) }));
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [escolha, setEscolha] = useState<CausaId | null>(null);
  const [conferida, setConferida] = useState<CausaId | null>(null);
  const [resolvidos, setResolvidos] = useState<ReadonlySet<string>>(() => new Set());
  const uid = useId();

  const { indice, ctl } = atual;
  const caso = CASOS[indice]!;
  const total = CASOS.length;
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot, ctl.getSnapshot);

  const fazerMedicao = (id: MedicaoId) => {
    const medicao = MEDICOES.find((m) => m.id === id)!;
    const leitura = medir(id, caso.central.faults ?? {}, contextoDe(snap));
    const novo: Resultado = { id, nome: medicao.nome, ...leitura, disjuntor: snap.disjuntor };
    setResultados((old) => [novo, ...old.filter((r) => r.id !== id)]);
  };

  const conferir = () => {
    if (!escolha) return;
    setConferida(escolha);
    if (escolha === caso.causa) {
      setResolvidos((old) => new Set(old).add(caso.id));
    }
  };

  const proximo = () => {
    const i = (indice + 1) % total;
    setAtual({ indice: i, ctl: criarCentral(CASOS[i]!) });
    setResultados([]);
    setEscolha(null);
    setConferida(null);
  };

  const acertou = conferida !== null && conferida === caso.causa;
  const feedback =
    conferida === null
      ? null
      : acertou
        ? caso.explicacao
        : `${caso.porQueNao[conferida] ?? ''} Escolha outra causa e confira de novo.`;

  return (
    <section className="dg breakout" aria-labelledby={`${uid}-titulo`} data-diagnostico="">
      <div className="dg-head">
        <p className="dg-kicker">Exercício de diagnóstico</p>
        <h3 id={`${uid}-titulo`} className="dg-title">
          Caso {indice + 1} de {total}
        </h3>
        <p className="dg-score">
          Resolvidos: <span className="num">{resolvidos.size}</span> de{' '}
          <span className="num">{total}</span>
          {resolvidos.has(caso.id) && <span className="dg-badge">já resolvido</span>}
        </p>
      </div>

      <figure className="dg-queixa">
        <blockquote>
          <p>{caso.queixa}</p>
        </blockquote>
        <figcaption>Quem mora na casa</figcaption>
      </figure>
      <p className="dg-tarefa">
        <strong>Reproduza o defeito.</strong> {caso.tarefa}
      </p>

      <CentralVirtual
        key={caso.id}
        controller={ctl}
        mostrar={caso.grupos}
        titulo={`Central do caso ${indice + 1}`}
      />

      <section className="dg-medicoes" aria-labelledby={`${uid}-medicoes`}>
        <div className="dg-medicoes__head">
          <h4 id={`${uid}-medicoes`} className="dg-subtitle">
            Medições
          </h4>
          <p className={`dg-disjuntor${snap.disjuntor ? ' is-on' : ''}`}>
            Disjuntor {snap.disjuntor ? 'ligado' : 'desligado'}
          </p>
        </div>
        <p className="dg-hint">
          Escolha a medição que separa as suas hipóteses. Para ligar ou desligar o disjuntor, use
          “Energia e alcance” na central.
        </p>
        <ul className="dg-lista">
          {MEDICOES.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="dg-medir"
                aria-describedby={`${uid}-${m.id}`}
                onClick={() => fazerMedicao(m.id)}
              >
                {m.nome}
              </button>
              <span id={`${uid}-${m.id}`} className="dg-como">
                {m.como}
              </span>
            </li>
          ))}
        </ul>
        <div className="dg-resultados">
          <p className="dg-resultados__title">Leituras</p>
          <ol aria-live="polite">
            {resultados.length === 0 && <li className="dg-vazio">Nenhuma medição ainda.</li>}
            {resultados.map((r) => (
              <li key={r.id} className={r.bloqueada ? 'is-blocked' : undefined}>
                <span className="dg-resultado__nome">
                  {r.nome}{' '}
                  <span className="dg-resultado__ctx">
                    (disjuntor {r.disjuntor ? 'ligado' : 'desligado'})
                  </span>
                </span>
                <span className="dg-resultado__texto">{r.texto}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <fieldset className="dg-causas">
        <legend>Qual é a causa?</legend>
        {caso.opcoes.map((c) => (
          <label key={c}>
            <input
              type="radio"
              name={`${uid}-causa`}
              value={c}
              checked={escolha === c}
              onChange={() => {
                setEscolha(c);
                setConferida(null);
              }}
            />
            <span>{CAUSAS[c]}</span>
          </label>
        ))}
        <button type="button" className="dg-conferir" disabled={!escolha} onClick={conferir}>
          Conferir
        </button>
        <div className="dg-feedback-area" role="status">
          {feedback && (
            <p className={`dg-feedback ${acertou ? 'is-right' : 'is-wrong'}`}>
              <strong>{acertou ? 'Certo. ' : 'Ainda não. '}</strong>
              {feedback}
            </p>
          )}
        </div>
      </fieldset>

      <div className="dg-nav">
        <button type="button" onClick={proximo}>
          Próximo caso
        </button>
        {resolvidos.size === total && <p className="dg-fim">Você resolveu os {total} casos.</p>}
      </div>
    </section>
  );
}
