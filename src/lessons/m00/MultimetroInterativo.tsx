/*
 * Lesson 0.3 (essential tools): a generic digital multimeter. Turning the
 * selector shows what each position measures, which jacks the probes go in,
 * how to connect it and the typical mistake of each position.
 */
import { useId, useState } from 'react';
import './widget.css';
import './multimetro.css';

type Jack = 'a10' | 'ma' | 'com' | 'v';

interface Mode {
  id: string;
  /** Text printed on the dial. */
  dial: string;
  name: string;
  /** What the display shows, with a dot as decimal separator like a real meter. */
  display: string;
  unit: string;
  /** The same reading written the Brazilian way. */
  reading?: string;
  jacks: Jack[];
  use: string;
  how?: string;
  warning?: string;
}

const MODES: Mode[] = [
  {
    id: 'off',
    dial: 'OFF',
    name: 'Desligado',
    display: '',
    unit: '',
    jacks: [],
    use: 'Posição de guardar. Volte sempre para OFF no fim: o multímetro não gasta bateria e a próxima pessoa não começa numa posição perigosa.',
  },
  {
    id: 'vca',
    dial: 'V~',
    name: 'Tensão alternada (CA)',
    display: '127.4',
    unit: 'V~',
    reading: '127,4 V numa tomada',
    jacks: ['com', 'v'],
    use: 'Mede a tensão da rede elétrica: tomadas, fios do quadro, a alimentação da central do portão.',
    how: 'Em paralelo: uma ponta em cada ponto, com o circuito ligado.',
    warning:
      'Na rede elétrica, segure só pela parte isolada das pontas e use um multímetro de categoria adequada (CAT III, pelo menos).',
  },
  {
    id: 'vcc',
    dial: 'V⎓',
    name: 'Tensão contínua (CC)',
    display: '1.608',
    unit: 'V⎓',
    reading: '1,608 V numa pilha AA nova',
    jacks: ['com', 'v'],
    use: 'Mede pilhas, baterias, fontes de eletrônicos e a alimentação de placas, como os 12 V ou 24 V dos acessórios de um portão.',
    how: 'Em paralelo: ponta vermelha no positivo e preta no negativo. Um sinal de menos no visor quer dizer que as pontas estão trocadas.',
  },
  {
    id: 'ohm',
    dial: 'Ω',
    name: 'Resistência',
    display: '4.70',
    unit: 'kΩ',
    reading: '4,70 kΩ num resistor de 4,7 kΩ',
    jacks: ['com', 'v'],
    use: 'Mede resistores, a resistência de um chuveiro, os enrolamentos de um motor (é assim que se descobre o fio comum do motor do portão).',
    how: 'Sempre com o circuito desligado e, de preferência, com a peça solta do circuito.',
    warning:
      'Medir resistência num circuito ligado dá leitura errada e pode danificar o multímetro.',
  },
  {
    id: 'cont',
    dial: '•)))',
    name: 'Continuidade',
    display: '0.3',
    unit: 'Ω',
    reading: '0,3 Ω e um apito: há ligação',
    jacks: ['com', 'v'],
    use: 'Apita quando existe ligação entre as pontas. Serve para achar fio rompido, testar fusível e descobrir qual ponta de um cabo comprido é qual.',
    how: 'Sempre com o circuito desligado.',
  },
  {
    id: 'ma',
    dial: 'mA',
    name: 'Corrente pequena',
    display: '20.1',
    unit: 'mA',
    reading: '20,1 mA num LED',
    jacks: ['com', 'ma'],
    use: 'Mede correntes de miliampères, como a de um LED ou de um sensor.',
    how: 'Em série: o circuito é aberto e a corrente passa por dentro do multímetro.',
    warning:
      'Nunca encoste as pontas numa tomada ou bateria nesta posição: o multímetro vira um fio e provoca um curto. Um fusível interno protege o instrumento, se estiver inteiro.',
  },
  {
    id: 'a',
    dial: '10A',
    name: 'Corrente alta (até 10 A)',
    display: '2.31',
    unit: 'A',
    reading: '2,31 A num motor pequeno',
    jacks: ['com', 'a10'],
    use: 'Mede correntes maiores, como a de uma lâmpada ou de um motor pequeno.',
    how: 'Em série, com a ponta vermelha no borne 10A. Muitos modelos só aceitam essa medição por alguns segundos de cada vez.',
    warning:
      'O mesmo perigo de curto da posição mA. Para correntes da casa, use o alicate amperímetro, que mede sem abrir o circuito.',
  },
];

const JACKS: { id: Jack; label: string; x: number }[] = [
  { id: 'a10', label: '10A', x: 44 },
  { id: 'ma', label: 'mA', x: 88 },
  { id: 'com', label: 'COM', x: 132 },
  { id: 'v', label: 'VΩ', x: 176 },
];

/** Dial positions, in degrees clockwise from the top. */
const ANGLES = [-135, -90, -45, 0, 45, 90, 135];
const CX = 110;
const CY = 192;

const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)] as const;
};

export default function MultimetroInterativo() {
  const id = useId();
  const [index, setIndex] = useState(2);
  const mode = MODES[index]!;

  return (
    <section className="lw mmi" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O seletor do multímetro
        </h3>
        <p className="lw__lead">
          Escolha uma posição do seletor e veja o que ela mede, onde vão as pontas e o cuidado de
          cada uma.
        </p>
      </header>

      <div className="lw__body mmi__body">
        <svg className="mmi__svg" viewBox="0 0 220 370" width="220" height="370" aria-hidden="true">
          <rect x="4" y="4" width="212" height="362" rx="22" className="mmi__bumper" />
          <rect x="16" y="16" width="188" height="338" rx="14" className="mmi__face" />

          <rect x="32" y="30" width="156" height="68" rx="6" className="mmi__lcd" />
          <text x="170" y="78" textAnchor="end" className="mmi__digits">
            {mode.display}
          </text>
          <text x="174" y="92" textAnchor="end" className="mmi__unit">
            {mode.unit}
          </text>
          {mode.id === 'cont' && (
            <text x="40" y="48" className="mmi__unit">
              •)))
            </text>
          )}

          {MODES.map((m, i) => {
            const [x, y] = polar(ANGLES[i]!, 82);
            return (
              <g key={m.id} className="mmi__pos" onClick={() => setIndex(i)}>
                <circle cx={x} cy={y} r="15" className="mmi__hit" />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className={i === index ? 'mmi__label mmi__label--on' : 'mmi__label'}
                >
                  {m.dial}
                </text>
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r="52" className="mmi__ring" />
          <g
            className="mmi__knob"
            style={{ transform: `rotate(${ANGLES[index]}deg)`, transformOrigin: `${CX}px ${CY}px` }}
          >
            <circle cx={CX} cy={CY} r="44" className="mmi__knob-body" />
            <rect x={CX - 9} y={CY - 46} width="18" height="92" rx="9" className="mmi__grip" />
            <path d={`M${CX} ${CY - 42}v20`} className="mmi__pointer" />
          </g>

          {JACKS.map((j) => {
            const used = mode.jacks.includes(j.id);
            return (
              <g key={j.id}>
                {used && <circle cx={j.x} cy="312" r="15" className="mmi__glow" />}
                <circle
                  cx={j.x}
                  cy="312"
                  r="10"
                  className={j.id === 'com' ? 'mmi__jack mmi__jack--com' : 'mmi__jack'}
                />
                <circle cx={j.x} cy="312" r="4" className="mmi__hole" />
                <text x={j.x} y="341" textAnchor="middle" className="mmi__jack-label">
                  {j.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mmi__side">
          <fieldset className="lw__group">
            <legend className="lw__legend">Posição do seletor</legend>
            <div className="lw__choices">
              {MODES.map((m, i) => (
                <label key={m.id} className="lw__choice">
                  <input
                    type="radio"
                    name={`${id}-modo`}
                    checked={i === index}
                    onChange={() => setIndex(i)}
                  />
                  <span aria-hidden="true">{m.dial}</span>
                  <span className="lw__sr">{m.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="lw__output" aria-live="polite">
            <p className="mmi__name">{mode.name}</p>
            <p>{mode.use}</p>
            {mode.jacks.length > 0 && (
              <p>
                <strong>Pontas:</strong> preta no <strong>COM</strong>, vermelha no{' '}
                <strong>{JACKS.find((j) => j.id === mode.jacks[1])!.label}</strong>.
              </p>
            )}
            {mode.how && (
              <p>
                <strong>Como ligar:</strong> {mode.how}
              </p>
            )}
            {mode.reading && (
              <p className="lw__note">
                Exemplo de leitura: {mode.reading}. No visor, o ponto faz o papel da vírgula.
              </p>
            )}
            {mode.warning && (
              <div className="lw__status lw__status--danger">
                <span className="lw__status-dot" aria-hidden="true" />
                <p>{mode.warning}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
