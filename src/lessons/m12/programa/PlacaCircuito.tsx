/**
 * Drawing of the virtual board and its circuit (board.ts): the board on the
 * left with the pins in use, one row per component on the right. A
 * simplified wiring diagram, not the real pin order of the board. Colors of
 * lit parts come from the state; everything else uses the site's theme.
 */
import { useId, type PointerEvent } from 'react';
import type { BoardInputs, BoardView } from './board';

interface Props {
  view: BoardView;
  inputs: BoardInputs;
  ligada: boolean;
  label: string;
  onBotao: (down: boolean) => void;
}

const ROWS = { d13: 46, d9: 96, d8: 146, d7: 196, d2: 246, a0: 296, a1: 346 };
const PIN_X = 206;

/** Perceived brightness: the eye sees low duty cycles brighter than linear. */
const glow = (x: number) => Math.sqrt(Math.max(0, Math.min(1, x)));

function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g className="pc-gnd" aria-hidden="true">
      <path d={`M${x} ${y}h10M${x + 10} ${y - 9}v18M${x + 14} ${y - 6}v12M${x + 18} ${y - 3}v6`} />
    </g>
  );
}

function Resistor({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y - 7} width={44} height={14} rx={4} className="pc-res" />
      {/* red, red, brown: 220 Ω */}
      <rect x={x + 9} y={y - 7} width={4} height={14} fill="#c62828" />
      <rect x={x + 17} y={y - 7} width={4} height={14} fill="#c62828" />
      <rect x={x + 25} y={y - 7} width={4} height={14} fill="#6d4c2f" />
      <rect x={x + 34} y={y - 7} width={3} height={14} fill="#c9a227" />
      <text x={x + 22} y={y - 13} className="pc-small" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function Led({
  x,
  y,
  on,
  color,
  off,
  blur,
}: {
  x: number;
  y: number;
  on: number;
  color: string;
  off: string;
  blur: string;
}) {
  const g = glow(on);
  return (
    <g>
      <circle cx={x} cy={y} r={20} fill={color} opacity={g * 0.45} filter={blur} />
      <path
        d={`M${x - 11} ${y + 11}v-12a11 11 0 0 1 22 0v12z`}
        fill={off}
        stroke="rgb(0 0 0 / 0.35)"
        strokeWidth={1.5}
      />
      <path d={`M${x - 11} ${y + 11}v-12a11 11 0 0 1 22 0v12z`} fill={color} opacity={g} />
      <rect x={x - 13} y={y + 10} width={26} height={4} rx={1} fill={off} />
    </g>
  );
}

export default function PlacaCircuito({ view, inputs, ligada, label, onBotao }: Props) {
  const red = view.led13.brilho;
  const green = view.led9.brilho;
  const angle = -135 + inputs.pot * 270;
  const pressed = inputs.botao;
  const blurId = `${useId().replace(/:/g, '')}-brilho`;
  const blur = `url(#${blurId})`;
  const hold = {
    onPointerDown: (e: PointerEvent<SVGGElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      onBotao(true);
    },
    onPointerUp: () => onBotao(false),
    onPointerCancel: () => onBotao(false),
    onLostPointerCapture: () => onBotao(false),
  };

  return (
    <svg className="pc" viewBox="0 0 540 372" role="img" aria-label={label}>
      <defs>
        <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Board */}
      <rect x={4} y={50} width={30} height={46} rx={3} className="pc-usb" />
      <rect x={4} y={290} width={26} height={40} rx={4} className="pc-jack" />
      <rect x={18} y={14} width={196} height={350} rx={14} className="pc-board" />
      <text x={34} y={40} className="pc-board-text pc-strong">
        placa tipo Uno
      </text>
      <circle cx={52} cy={330} r={9} className="pc-reset" />
      <text x={66} y={334} className="pc-board-text pc-small">
        reset
      </text>
      <rect x={58} y={196} width={100} height={36} rx={3} className="pc-chip" />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <rect x={63 + i * 12} y={190} width={4} height={6} className="pc-leg" />
          <rect x={63 + i * 12} y={232} width={4} height={6} className="pc-leg" />
        </g>
      ))}
      <text x={108} y={218} className="pc-chip-text" textAnchor="middle">
        microcontrolador
      </text>

      {/* On-board LEDs: ON, L (pin 13), TX */}
      {[
        { y: 70, t: 'ON', c: '#34d058', on: ligada ? 1 : 0 },
        { y: 96, t: 'L', c: '#ffb020', on: red },
        { y: 122, t: 'TX', c: '#ffb020', on: view.tx ? 1 : 0 },
      ].map((l) => (
        <g key={l.t}>
          <rect x={60} y={l.y - 5} width={14} height={10} rx={2} fill="#2b2b2b" />
          <rect x={60} y={l.y - 5} width={14} height={10} rx={2} fill={l.c} opacity={glow(l.on)} />
          <text x={80} y={l.y + 5} className="pc-board-text pc-small">
            {l.t}
          </text>
        </g>
      ))}

      {/* Pins in use */}
      {(
        [
          ['d13', '13'],
          ['d9', '~9'],
          ['d8', '8'],
          ['d7', '7'],
          ['d2', '2'],
          ['a0', 'A0'],
          ['a1', 'A1'],
        ] as const
      ).map(([k, t]) => (
        <g key={k}>
          <text x={PIN_X - 14} y={ROWS[k] + 5} className="pc-board-text" textAnchor="end">
            {t}
          </text>
          <rect x={PIN_X - 8} y={ROWS[k] - 6} width={12} height={12} className="pc-pin" />
        </g>
      ))}

      {/* Wires from the pins */}
      <g className="pc-wire">
        <path d={`M${PIN_X} ${ROWS.d13}H250M294 ${ROWS.d13}H339M381 ${ROWS.d13}H410`} />
        <path d={`M${PIN_X} ${ROWS.d9}H250M294 ${ROWS.d9}H339M381 ${ROWS.d9}H410`} />
        <path d={`M${PIN_X} ${ROWS.d8}H300M340 ${ROWS.d8}H410`} />
        <path d={`M${PIN_X} ${ROWS.d7}H246`} />
        <path d={`M${PIN_X} ${ROWS.d2}H296M346 ${ROWS.d2}H410`} />
        <path d={`M${PIN_X} ${ROWS.a0}H300`} />
        <path d={`M${PIN_X} ${ROWS.a1}H290`} />
      </g>

      {/* D13: 220 Ω + red LED */}
      <Resistor x={250} y={ROWS.d13} label="220 Ω" />
      <Led x={360} y={ROWS.d13} on={red} color="#ff3b30" off="#6b2a2a" blur={blur} />
      <Ground x={410} y={ROWS.d13} />
      <text x={446} y={ROWS.d13 + 5} className="pc-label">
        vermelho
      </text>

      {/* D9: 220 Ω + green LED */}
      <Resistor x={250} y={ROWS.d9} label="220 Ω" />
      <Led x={360} y={ROWS.d9} on={green} color="#2ee86b" off="#245a35" blur={blur} />
      <Ground x={410} y={ROWS.d9} />
      <text x={446} y={ROWS.d9 + 5} className="pc-label">
        verde
      </text>

      {/* D8: passive buzzer */}
      <g>
        <circle cx={320} cy={ROWS.d8} r={18} fill="#1f1f1f" />
        <circle cx={320} cy={ROWS.d8} r={4} fill="#555" />
        <text x={307} y={ROWS.d8 - 6} fill="#ddd" fontSize={10}>
          +
        </text>
        {view.buzzerHz > 0 && (
          <g className="pc-waves">
            <path d={`M345 ${ROWS.d8 - 14}q8 14 0 28`} />
            <path d={`M354 ${ROWS.d8 - 20}q12 20 0 40`} />
          </g>
        )}
      </g>
      <Ground x={410} y={ROWS.d8} />
      <text x={446} y={ROWS.d8 + 5} className="pc-label">
        buzzer
      </text>

      {/* D7: relay module and a 12 V lamp */}
      <g>
        <rect x={246} y={ROWS.d7 - 18} width={70} height={36} rx={4} className="pc-relay" />
        <text x={281} y={ROWS.d7 + 5} className="pc-relay-text" textAnchor="middle">
          relé
        </text>
        <circle cx={308} cy={ROWS.d7 - 10} r={3} fill={view.rele ? '#ff3b30' : '#4a1010'} />
        <g className="pc-wire">
          <path d={`M316 ${ROWS.d7}H330`} />
          <path
            d={view.rele ? `M330 ${ROWS.d7}H352` : `M330 ${ROWS.d7}L350 ${ROWS.d7 - 10}`}
            className="pc-contact"
          />
          <path d={`M352 ${ROWS.d7}H364M396 ${ROWS.d7}H410`} />
        </g>
        <circle
          cx={380}
          cy={ROWS.d7}
          r={22}
          fill="#ffd54a"
          opacity={view.rele ? 0.5 : 0}
          filter={blur}
        />
        <circle
          cx={380}
          cy={ROWS.d7}
          r={15}
          className={view.rele ? 'pc-lamp pc-lamp--on' : 'pc-lamp'}
        />
        <path d={`M370 ${ROWS.d7 - 10}l20 20M390 ${ROWS.d7 - 10}l-20 20`} className="pc-filament" />
        <text x={412} y={ROWS.d7 - 8} className="pc-small">
          12 V
        </text>
      </g>
      <text x={446} y={ROWS.d7 + 5} className="pc-label">
        lâmpada
      </text>

      {/* D2: push button to GND */}
      <g className="pc-button" {...hold} aria-hidden="true">
        <rect x={290} y={ROWS.d2 - 26} width={62} height={40} fill="transparent" />
        <g className="pc-wire">
          <circle cx={300} cy={ROWS.d2} r={3} />
          <circle cx={342} cy={ROWS.d2} r={3} />
          <path d={pressed ? `M298 ${ROWS.d2 - 3}H344` : `M298 ${ROWS.d2 - 12}H344`} />
          <path d={pressed ? `M321 ${ROWS.d2 - 3}v-10` : `M321 ${ROWS.d2 - 12}v-10`} />
        </g>
        <rect
          x={309}
          y={pressed ? ROWS.d2 - 19 : ROWS.d2 - 28}
          width={24}
          height={7}
          rx={2}
          className="pc-cap"
        />
      </g>
      <Ground x={410} y={ROWS.d2} />
      <text x={446} y={ROWS.d2 + 5} className="pc-label">
        botão
      </text>

      {/* A0: 10 kΩ potentiometer (5 V and GND on its ends) */}
      <g>
        <circle cx={320} cy={ROWS.a0} r={18} className="pc-pot" />
        <line
          x1={320}
          y1={ROWS.a0}
          x2={320}
          y2={ROWS.a0 - 14}
          className="pc-knob"
          transform={`rotate(${angle} 320 ${ROWS.a0})`}
        />
        <text x={346} y={ROWS.a0 + 5} className="pc-small">
          10 kΩ
        </text>
      </g>
      <text x={446} y={ROWS.a0 + 5} className="pc-label">
        pot.
      </text>

      {/* A1: LDR divider (LDR to 5 V, 10 kΩ to GND), drawn as a small module */}
      <g>
        <rect x={290} y={ROWS.a1 - 18} width={120} height={36} rx={5} className="pc-module" />
        <circle cx={316} cy={ROWS.a1} r={13} className="pc-ldr" />
        <path d={`M306 ${ROWS.a1}l3 -5l3 10l3 -10l3 10l3 -10l2 5`} className="pc-ldr-line" />
        <g className="pc-light" opacity={0.25 + 0.75 * inputs.luz}>
          <path d={`M300 ${ROWS.a1 - 30}l8 9M312 ${ROWS.a1 - 33}l5 10`} />
        </g>
        <text x={372} y={ROWS.a1 + 5} className="pc-small" textAnchor="middle">
          + 10 kΩ
        </text>
      </g>
      <text x={446} y={ROWS.a1 + 5} className="pc-label">
        LDR
      </text>
    </svg>
  );
}
