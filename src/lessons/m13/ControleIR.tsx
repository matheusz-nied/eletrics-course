/*
 * Lesson 13.4: what a TV remote sends. The student picks a button and sees
 * the NEC message as the infrared LED blinks it and as the receiver of the
 * TV hands it to the microcontroller; a switch shows the LED as the phone
 * camera sees it. Logic in nec.ts.
 */
import { useEffect, useId, useState } from 'react';
import { formatNumber, NBSP } from '../m00/formato';
import {
  ADDRESS,
  bytesOf,
  CYCLES_PER_UNIT,
  decode,
  encode,
  hexByte,
  KEYS,
  lsbFirst,
  PART_LABELS,
  repeatCode,
  REPEAT_PERIOD,
  totalDuration,
  type Part,
  type Pulse,
} from './nec';
import '../m00/widget.css';
import './controle-ir.css';

/* Waveform (viewBox 0 -4 640 154). */
const WX0 = 10;
const WX1 = 630;
const LED_HI = 34;
const LED_LO = 64;
const RX_HI = 102;
const RX_LO = 128;

/** How long the LED shows as lit after a press (ms). */
const FLASH_MS = 1200;

interface Placed extends Pulse {
  t0: number;
}

function place(pulses: Pulse[], t0 = 0): Placed[] {
  const out: Placed[] = [];
  let t = t0;
  for (const p of pulses) {
    out.push({ ...p, t0: t });
    t += p.duration;
  }
  return out;
}

export default function ControleIR() {
  const id = useId();
  const [key, setKey] = useState(KEYS[0]!.id);
  const [held, setHeld] = useState(false);
  const [camera, setCamera] = useState(false);
  const [presses, setPresses] = useState(0);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!presses) return;
    const timer = window.setTimeout(() => setFlashing(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [presses]);

  const k = KEYS.find((x) => x.id === key)!;
  const message = encode(ADDRESS, k.command);
  const decoded = decode(message);
  const placed = place(message);
  const repeats = held ? [1, 2].flatMap((n) => place(repeatCode(), n * REPEAT_PERIOD)) : [];
  const span = held ? 2 * REPEAT_PERIOD + totalDuration(repeatCode()) : totalDuration(message);
  const x = (t: number) => WX0 + (t / span) * (WX1 - WX0);
  const all = [...placed, ...repeats];
  const parts = new Map<Part, [number, number]>();
  for (const p of placed) {
    const r = parts.get(p.part);
    parts.set(p.part, r ? [r[0], p.t0 + p.duration] : [p.t0, p.t0 + p.duration]);
  }
  const ms = formatNumber(totalDuration(message) * 1000, 1);
  const lit = flashing && camera;

  return (
    <section className="lw ir" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          O que o controle da TV pisca
        </h3>
        <p className="lw__lead">
          Escolha um botão e aperte. Em cima, o LED infravermelho; embaixo, o que o receptor da TV
          entrega ao microcontrolador.
        </p>
      </header>

      <div className="lw__body">
        <div className="ir__top">
          <svg
            className="ir__remote"
            viewBox="0 0 120 200"
            role="img"
            aria-label={
              camera
                ? lit
                  ? 'Controle visto pela câmera do celular: o LED da ponta aparece aceso, com um brilho lilás.'
                  : 'Controle visto pela câmera do celular, com o LED apagado.'
                : 'Controle visto a olho nu: o LED da ponta parece sempre apagado, mesmo transmitindo.'
            }
          >
            {lit && <circle cx={60} cy={22} r={22} className="ir__glow" />}
            <rect x={28} y={20} width={64} height={172} rx={18} className="ir__body" />
            <rect x={50} y={14} width={20} height={14} rx={5} className="ir__window" />
            <circle cx={60} cy={21} r={5} className={lit ? 'ir__led ir__led--on' : 'ir__led'} />
            <circle cx={60} cy={56} r={9} className="ir__key ir__key--power" />
            {[0, 1, 2].flatMap((r) =>
              [0, 1, 2].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={38 + c * 16}
                  y={80 + r * 18}
                  width={12}
                  height={11}
                  rx={3}
                  className="ir__key"
                />
              )),
            )}
            <rect x={38} y={140} width={20} height={32} rx={6} className="ir__key" />
            <rect x={62} y={140} width={20} height={32} rx={6} className="ir__key" />
          </svg>

          <div className="ir__controls">
            <fieldset className="lw__group">
              <legend className="lw__legend">Botão</legend>
              <div className="lw__choices">
                {KEYS.map((x) => (
                  <label key={x.id} className="lw__choice">
                    <input
                      type="radio"
                      name={`${id}-tecla`}
                      checked={key === x.id}
                      onChange={() => setKey(x.id)}
                    />
                    {x.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="lw__check">
              <input type="checkbox" checked={held} onChange={(e) => setHeld(e.target.checked)} />
              Segurar o botão apertado
            </label>
            <label className="lw__check">
              <input
                type="checkbox"
                checked={camera}
                onChange={(e) => setCamera(e.target.checked)}
              />
              Ver pela câmera do celular
            </label>
            <button
              type="button"
              className="lw__btn lw__btn--primary"
              onClick={() => {
                setPresses((n) => n + 1);
                setFlashing(true);
              }}
            >
              Apertar
            </button>
          </div>
        </div>

        <svg
          className="ir__wave"
          viewBox="0 -4 640 154"
          role="img"
          aria-label={`Mensagem do botão ${k.label}: pulso inicial de 9 ms, pausa de 4,5 ms e 32 bits, endereço ${hexByte(ADDRESS)}, o endereço invertido, comando ${hexByte(k.command)} e o comando invertido. Dura ${ms} ms.${held ? ' Com o botão seguro, seguem códigos curtos de repetição a cada 108 ms.' : ''} A saída do receptor é o mesmo desenho de cabeça para baixo, sem a portadora.`}
        >
          {!held &&
            [...parts].map(([part, [t0, t1]]) => (
              <g key={part} className={`ir__part ir__part--${part}`}>
                <rect x={x(t0)} y={18} width={x(t1) - x(t0)} height={50} className="ir__part-bg" />
                {part !== 'fim' && (
                  <text x={(x(t0) + x(t1)) / 2} y={14} className="ir__t">
                    {PART_LABELS[part]}
                  </text>
                )}
              </g>
            ))}
          <text x={WX0} y={82} className="ir__t ir__t--start">
            LED (rajadas de 38 kHz)
          </text>
          <text x={WX0} y={144} className="ir__t ir__t--start">
            saída do receptor (nível lógico)
          </text>
          <line x1={WX0} x2={WX1} y1={LED_LO} y2={LED_LO} className="ir__base" />
          {all
            .filter((p) => p.on)
            .map((p, i) => (
              <rect
                key={`l${i}`}
                x={x(p.t0)}
                y={LED_HI}
                width={Math.max(x(p.t0 + p.duration) - x(p.t0), 0.8)}
                height={LED_LO - LED_HI}
                className="ir__burst"
              />
            ))}
          <path
            className="ir__rx"
            d={
              `M${WX0} ${RX_HI}` +
              all
                .filter((p) => p.on)
                .map(
                  (p) =>
                    `H${x(p.t0).toFixed(1)}V${RX_LO}H${x(p.t0 + p.duration).toFixed(1)}V${RX_HI}`,
                )
                .join('') +
              `H${WX1}`
            }
          />
        </svg>

        <div className="ir__zoom">
          <svg
            viewBox="0 0 320 70"
            role="img"
            aria-label={`Ampliação de um pulso de 562,5 µs: dentro dele, o LED pisca ${formatNumber(CYCLES_PER_UNIT, 0)} vezes, a 38 kHz.`}
          >
            <path
              className="ir__burst-line"
              d={
                'M10 50' +
                Array.from({ length: 21 }, (_, i) => {
                  const x0 = 30 + i * 12.4;
                  return `H${x0.toFixed(1)}V16H${(x0 + 6.2).toFixed(1)}V50`;
                }).join('') +
                'H310'
              }
            />
            <text x={160} y={66} className="ir__t">
              um pulso de 562,5{NBSP}µs: 21 piscadas de 38{NBSP}kHz
            </text>
          </svg>
          <p className="lw__note">
            O LED não fica aceso durante o pulso: ele pisca 38 mil vezes por segundo. O receptor só
            responde a luz que pisca nesse ritmo, e por isso ignora a luz do sol e das lâmpadas.
          </p>
        </div>

        <div className="lw__output" aria-live="polite">
          <table className="ir__bytes">
            <thead>
              <tr>
                <th scope="col">Parte</th>
                <th scope="col">Valor</th>
                <th scope="col">Bits, na ordem em que saem</th>
              </tr>
            </thead>
            <tbody>
              {bytesOf(ADDRESS, k.command).map(([part, byte]) => (
                <tr key={part}>
                  <th scope="row">{PART_LABELS[part]}</th>
                  <td className="num">{hexByte(byte)}</td>
                  <td>
                    <code data-bits={part}>{lsbFirst(byte).join('')}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lw__note" data-decodificado>
            {decoded
              ? `A TV confere cada byte com a cópia invertida e lê: endereço ${hexByte(decoded.address)} (esta TV), comando ${hexByte(decoded.command)} (${k.label}). Mensagem de ${ms} ms.`
              : 'Mensagem com erro: a TV ignora.'}
          </p>
          {camera && !flashing && (
            <p className="lw__note">Aperte o botão e olhe o LED na ponta do controle.</p>
          )}
        </div>
      </div>
    </section>
  );
}
