/**
 * Printed circuit board (placa de circuito impresso), generated from a layout
 * by `pcb/PrintedCircuitBoard.tsx`. The gallery shows three example layouts;
 * scenes pass their own layout to `<PrintedCircuitBoard>` directly.
 *
 * Standard board: FR-4, 1,6 mm, 35 µm copper (1 oz), solder mask and
 * silkscreen (IPC-2221 / IPC-4101 typical values).
 */
import { useMemo } from 'react';
import { OnBoard, PrintedCircuitBoard } from '../pcb/PrintedCircuitBoard';
import { FINISHES, MASK_LABELS, boardPoint, type MaskColor, type PcbLayout } from '../pcb/layout';
import { LED_BOARD, ledBoard, perfBoard, smdBoard } from '../pcb/samples';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import Led from './led';
import Resistor from './resistor';

export interface PcbProps {
  preset?: 'led' | 'ilhada' | 'smd';
  mask?: MaskColor;
  finish?: keyof typeof FINISHES;
  /** Resistor and LED mounted and soldered (preset 'led'). */
  components?: boolean;
  /** LED brightness, 0 to 1 (preset 'led' with components). */
  brightness?: number;
  /** Turned over: the solder side up. */
  flip?: boolean;
}

const PRESET_LABELS = {
  led: 'Placa do LED (dupla face)',
  ilhada: 'Placa ilhada 5 × 7 cm',
  smd: 'Placa SMD com plano de terra',
} as const;

function layoutOf(p: Required<PcbProps>): PcbLayout {
  const base =
    p.preset === 'ilhada' ? perfBoard() : p.preset === 'smd' ? smdBoard() : ledBoard(p.components);
  return { ...base, mask: p.mask, finish: p.finish };
}

const resolve = (props: PartProps) => ({ ...meta.defaults, ...props }) as Required<PcbProps>;

export const meta: PartMeta = {
  id: 'pcb',
  label: 'Placa de circuito impresso',
  category: 'placas',
  summary:
    'Placa gerada a partir de um layout: FR-4, cobre, máscara de solda, serigrafia e furos metalizados.',
  defaults: {
    preset: 'led',
    mask: 'verde',
    finish: 'hasl',
    components: true,
    brightness: 0.8,
    flip: false,
  },
  controls: {
    preset: {
      kind: 'select',
      label: 'Modelo',
      options: Object.entries(PRESET_LABELS).map(([value, label]) => ({ value, label })),
    },
    mask: {
      kind: 'select',
      label: 'Máscara de solda',
      options: Object.entries(MASK_LABELS).map(([value, label]) => ({ value, label })),
    },
    finish: {
      kind: 'select',
      label: 'Acabamento',
      options: Object.entries(FINISHES).map(([value, f]) => ({ value, label: f.label })),
    },
    components: { kind: 'toggle', label: 'Componentes soldados (placa do LED)' },
    brightness: { kind: 'number', label: 'Brilho do LED', min: 0, max: 1, step: 0.05 },
    flip: { kind: 'toggle', label: 'Virada (lado da solda)' },
  },
  annotations: (props) => {
    const p = resolve(props);
    const layout = layoutOf(p);
    const T = layout.thickness ?? 1.6;
    const at = (x: number, y: number, lift = 0.4): Vec3 => {
      const [px, py, pz] = boardPoint(layout, [x, y], p.flip ? 'bottom' : 'top');
      return p.flip ? [-px, T + lift, pz] : [px, py + lift, pz];
    };
    const layers: PartAnnotation[] = [
      { at: [0, 0, 0], anchor: 'pcb-silk', text: 'Serigrafia: nomes e polaridade', exploded: true },
      {
        at: [0, 0, 0],
        anchor: 'pcb-mask',
        text: 'Máscara de solda (isola o cobre)',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        anchor: 'pcb-copper',
        text: 'Cobre de cima: trilhas (35 µm)',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        anchor: 'pcb-substrate',
        text: 'Substrato FR-4: fibra de vidro e epóxi',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        anchor: 'pcb-copper-bottom',
        text: 'Cobre de baixo',
        exploded: true,
      },
    ];
    if (p.preset === 'ilhada')
      return [
        { at: at(13.62 + 2.54, 5.79 + 2.54), text: 'Ilha com furo metalizado', exploded: false },
        { at: at(25, 1.4), text: 'Grade de 2,54 mm (0,1")', exploded: false },
        { at: at(2, 2, 0.1), text: 'Furo de fixação', exploded: false },
        ...layers.filter((a) => a.anchor !== 'pcb-silk' || !p.flip),
      ];
    if (p.preset === 'smd')
      return [
        { at: at(22, 15, 0.2), text: 'Ilhas do CI (QFP, 0,8 mm)', exploded: false },
        { at: at(29.5, 21, 0.2), text: 'Ilhas SMD 0805', exploded: false },
        { at: at(35, 3.4, 0.1), text: 'Via: liga as duas faces', exploded: false },
        { at: at(5, 24, 0.1), text: 'Plano de terra (cobre sob a máscara)', exploded: false },
        ...layers,
      ];
    const { r1, d1 } = LED_BOARD;
    return [
      { at: at(28, 12.5, 0.2), text: 'Trilha de cobre sob a máscara', exploded: false },
      { at: at(36.5, 3.5, 0.1), text: 'Furo de fixação', exploded: false },
      { at: at(6, 9.96, 0.4), text: 'Ilha com furo metalizado', exploded: false },
      ...(p.components
        ? [
            { at: at(r1[0], r1[1], 3), text: 'Resistor R1', exploded: false },
            { at: at(d1[0], d1[1], 9), text: 'LED D1', exploded: false },
          ]
        : [{ at: at(20, 9.5, 0.1), text: 'Serigrafia', exploded: false }]),
      ...layers,
    ];
  },
  explode: true,
  cutaway: true,
  describe: (props) => {
    const p = resolve(props);
    const mask =
      p.mask === 'nenhuma' ? 'sem máscara' : `máscara ${MASK_LABELS[p.mask].toLowerCase()}`;
    const what = PRESET_LABELS[p.preset] ?? PRESET_LABELS.led;
    const parts = p.preset === 'led' && p.components ? ', com resistor e LED soldados' : '';
    return `${what}, ${mask}, acabamento ${FINISHES[p.finish].label.toLowerCase()}${parts}.`;
  },
  view: [0.45, 1.1, 0.95],
};

export default function Pcb(props: PcbProps) {
  const p = resolve(props as PartProps);
  const layout = useMemo(
    () => layoutOf(p),
    // The layout depends only on these props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.preset, p.mask, p.finish, p.components],
  );
  const T = layout.thickness ?? 1.6;
  const populated = p.preset === 'led' && p.components;
  const { r1, d1 } = LED_BOARD;

  return (
    <group rotation={p.flip ? [0, 0, Math.PI] : [0, 0, 0]} position={[0, p.flip ? T : 0, 0]}>
      <PrintedCircuitBoard layout={layout}>
        {populated && (
          <>
            {/* Lead ends 1,4 mm below the board, body 1 mm above it. */}
            <OnBoard layout={layout} at={r1} lift={-T - 1.4}>
              <Resistor ohms={470} leads="dobrados" leadDrop={1.2 + 1 + T + 1.4} />
            </OnBoard>
            <OnBoard layout={layout} at={d1} rotation={180} lift={-T - 3.5}>
              <Led color="vermelho" brightness={p.brightness} leadLength={T + 2.5} />
            </OnBoard>
          </>
        )}
      </PrintedCircuitBoard>
    </group>
  );
}
