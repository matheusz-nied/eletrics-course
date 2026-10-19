/**
 * Residential distribution board ("quadro de distribuição de embutir"),
 * two-phase 127/220 V supply (F1, F2, N and PE), as found in most Brazilian
 * houses. Sizes are typical of catalogues of flush-mounted plastic boxes for
 * 18 DIN modules (two rows of 9), rounded:
 * - box 250 × 340 × 78 mm with a 272 × 362 mm finishing frame, front cover
 *   ("espelho") with two windows for the 45 mm fronts of the devices;
 * - TS 35 × 7,5 rails (EN 60715) on stand-offs, 18 mm per module
 *   (DIN 43880 outline: 90 mm tall, shoulder 44 mm and front about 62 mm
 *   in front of the rail);
 * - top row: 2-pole main breaker (C50), three surge protectors (DPS, F1, F2
 *   and N to earth, with the status window) and a 4-pole RCD (DR) 63 A
 *   30 mA with its test button;
 * - bottom row: circuit breakers fed by a two-phase comb busbar ("pente"),
 *   1-pole for 127 V circuits and a 2-pole C40 for the 220 V shower;
 * - neutral busbar (blue insulators) and earth busbar (green insulators),
 *   brass 6 × 9 mm with clamp screws;
 * - wiring in the NBR 5410 colours: phases black (F1) and red (F2), neutral
 *   light blue, protective earth green-yellow, entering and leaving through
 *   yellow corrugated conduit.
 * Ratings and markings are typical values, not a manufacturer's datasheet.
 * Every device, busbar and wire is baked into a few merged meshes
 * (`_gate-batch.tsx`), so the whole board stays inside the draw-call budget.
 */
import { useMemo } from 'react';
import type { BufferGeometry, Texture } from 'three';
import { Anchor } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, useCanvasTexture } from '../materials/textures';
import { Wire } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import { roundedBox, screwHeadGeometry, shellGeometry } from './_em-geometry';
import { BakeLayer, BatchRoot } from './_gate-batch';
import {
  atlasPlaneGeometry,
  corrugatedConduitGeometry,
  DIN,
  dinBodyGeometry,
  dinRailGeometry,
  plateGeometry,
  type AtlasRect,
} from './_house-geometry';
import { useGeometrySet, WIRE_COLORS } from './_wiring-parts';

type Tripped = 'nenhum' | 'disjuntor' | 'dr';

export interface DistributionBoardProps {
  /** Number of circuits in the bottom row: 4 or 6. */
  circuits?: number;
  /** Device with its lever down: none, the kitchen breaker or the RCD. */
  tripped?: Tripped;
  /** Front cover ("espelho") in place. */
  cover?: boolean;
}

interface Circuit {
  /** Handwritten label on the cover strip (one or two lines). */
  label: string[];
  /** Name used in descriptions. */
  name: string;
  rating: 'C10' | 'C20' | 'C40';
  poles: 1 | 2;
  /** Conductor section (mm²). */
  section: number;
}

const ILUMINACAO: Circuit = {
  label: ['Ilumi-', 'nação'],
  name: 'iluminação',
  rating: 'C10',
  poles: 1,
  section: 1.5,
};
const SALA: Circuit = {
  label: ['Tomadas', 'sala'],
  name: 'tomadas da sala',
  rating: 'C20',
  poles: 1,
  section: 2.5,
};
const QUARTOS: Circuit = {
  label: ['Tomadas', 'quartos'],
  name: 'tomadas dos quartos',
  rating: 'C20',
  poles: 1,
  section: 2.5,
};
const COZINHA: Circuit = {
  label: ['Cozinha'],
  name: 'cozinha',
  rating: 'C20',
  poles: 1,
  section: 2.5,
};
const SERVICO: Circuit = {
  label: ['Área de', 'serviço'],
  name: 'área de serviço',
  rating: 'C20',
  poles: 1,
  section: 2.5,
};
const CHUVEIRO: Circuit = {
  label: ['Chuveiro', '220 V'],
  name: 'chuveiro (220 V, bipolar)',
  rating: 'C40',
  poles: 2,
  section: 6,
};

const CIRCUITS: Record<4 | 6, Circuit[]> = {
  4: [ILUMINACAO, SALA, COZINHA, CHUVEIRO],
  6: [ILUMINACAO, SALA, QUARTOS, COZINHA, SERVICO, CHUVEIRO],
};

const TRIPPED_LABELS: Record<Tripped, string> = {
  nenhum: 'Nenhum (tudo ligado)',
  disjuntor: 'Disjuntor da cozinha',
  dr: 'DR',
};

export const meta: PartMeta = {
  id: 'distribution-board',
  label: 'Quadro de distribuição',
  category: 'conexoes',
  summary:
    'Quadro de distribuição de embutir de uma casa (bifásico 127/220 V): disjuntor geral, DPS, DR, disjuntores dos circuitos, barramentos de neutro e de terra e a fiação nas cores da NBR 5410.',
  defaults: { circuits: 6, tripped: 'nenhum', cover: false },
  controls: {
    circuits: {
      kind: 'select',
      label: 'Circuitos',
      options: [
        { value: 4, label: '4 circuitos' },
        { value: 6, label: '6 circuitos' },
      ],
    },
    tripped: {
      kind: 'select',
      label: 'Desarmado',
      options: (Object.keys(TRIPPED_LABELS) as Tripped[]).map((t) => ({
        value: t,
        label: TRIPPED_LABELS[t],
      })),
    },
    cover: { kind: 'toggle', label: 'Tampa (espelho) colocada' },
  },
  annotations: (p): PartAnnotation[] => {
    // With the cover on, only the device fronts show: the insides are named in the exploded view.
    const inside = p.cover ? true : undefined;
    const tripped = trippedOf(p.tripped);
    const notes: PartAnnotation[] = [
      { at: [0, 0, 0], anchor: 'qd-geral', text: 'Disjuntor geral (bipolar): desliga a casa toda' },
      { at: [0, 0, 0], anchor: 'qd-dps', text: 'DPS: desvia surtos para a terra' },
      {
        at: [0, 0, 0],
        anchor: 'qd-dr',
        text:
          tripped === 'dr'
            ? 'DR desarmado: houve fuga para a terra (30 mA)'
            : 'DR: desliga com fuga para a terra (30 mA)',
      },
      { at: [0, 0, 0], anchor: 'qd-teste', text: 'Botão de teste (T) do DR', exploded: false },
      {
        at: [0, 0, 0],
        anchor: 'qd-circuitos',
        text:
          tripped === 'disjuntor'
            ? 'Disjuntor da cozinha desarmado: alavanca para baixo'
            : 'Disjuntores dos circuitos (C10, C20, C40)',
      },
      {
        at: [0, 0, 0],
        anchor: 'qd-pente',
        text: 'Pente: alimenta os disjuntores',
        exploded: inside,
      },
      {
        at: [0, 0, 0],
        anchor: 'qd-neutro',
        text: 'Barramento de neutro (fios azul-claros)',
        exploded: inside,
      },
      {
        at: [0, 0, 0],
        anchor: 'qd-terra',
        text: 'Barramento de terra (fios verde-amarelos)',
        exploded: inside,
      },
      { at: [0, 0, 0], anchor: 'qd-trilho', text: 'Trilho DIN de 35 mm', exploded: inside },
      {
        at: [0, 0, 0],
        anchor: 'qd-entrada',
        text: 'Entrada: fases F1 e F2, neutro e terra',
        exploded: inside,
      },
    ];
    if (p.cover)
      notes.push({
        at: [0, 0, 0],
        anchor: 'qd-tampa',
        text: 'Tampa (espelho) com o nome de cada circuito',
      });
    return notes;
  },
  explode: true,
  describe: (p) => {
    const list = CIRCUITS[circuitsOf(p.circuits)];
    const names = list.map((c) => `${c.name} ${c.rating}`).join(', ');
    const tripped = trippedOf(p.tripped);
    const state =
      tripped === 'dr'
        ? 'O DR está desarmado (alavanca para baixo): todos os circuitos estão sem energia.'
        : tripped === 'disjuntor'
          ? 'O disjuntor da cozinha está desarmado (alavanca para baixo): só esse circuito está sem energia.'
          : 'Tudo ligado (alavancas para cima).';
    return `Quadro de distribuição de embutir para 18 módulos DIN, bifásico 127/220 V: disjuntor geral bipolar de 50 A, três DPS (F1, F2 e neutro para a terra), DR de 4 polos de 63 A e 30 mA e ${list.length} circuitos (${names}), alimentados por um pente. Barramento de neutro com fios azul-claros e barramento de terra com fios verde-amarelos. ${state}${p.cover ? ' Tampa colocada, com os circuitos escritos à mão.' : ' Sem a tampa, a fiação fica à vista.'}`;
  },
  view: [0.55, 0.3, 1],
};

function circuitsOf(v: unknown): 4 | 6 {
  return Number(v) === 4 ? 4 : 6;
}
function trippedOf(v: unknown): Tripped {
  return v === 'disjuntor' || v === 'dr' ? v : 'nenhum';
}

// ---------------------------------------------------------------------------
// Layout (box space: x centred, y up from the bottom of the box, z from its back).

const BOX = { W: 250, H: 340, D: 78, wall: 2.5 };
const FRAME = { W: 272, H: 362, t: 3, z: 76 };
const COVER = { W: 238, H: 328, t: 2.5, back: 76.5 };
/** Rail lips (back of the devices): the shoulders meet the back of the cover. */
const ZD = COVER.back - DIN.shoulder;
const RAIL_BACK = ZD - 7.5;
/** Wire clamps and comb slots of the devices. */
const ZW = ZD + DIN.wireZ;
const ROW1 = 258;
const ROW2 = 128;
const MODULES = 9;
const RAIL_LENGTH = MODULES * DIN.pitch + 40;
/** Centre x of module i (0 to 8) of a row. */
const mx = (i: number) => (i - (MODULES - 1) / 2) * DIN.pitch;
const top = (row: number) => row + DIN.half;
const bottom = (row: number) => row - DIN.half;
/** Wire ends sit a little inside the terminal. */
const IN = 1.5;

const BUS = { y: 42, length: 92, h: 9, t: 6, z: 15, holes: 10, pitch: 8.5 };
const NEUTRAL_X = -60;
const EARTH_X = 60;
const busHole = (cx: number, i: number) => cx + (i - (BUS.holes - 1) / 2) * BUS.pitch;
const BUS_Z = BUS.z + BUS.t / 2;

/** Conduits: one 1" in the top wall, three 3/4" in the bottom wall. */
const CONDUIT = { stub: 16, z: 38 };
const TOP_CONDUIT = { x: -58, r: 16 };
const BOTTOM_CONDUITS = [-80, 0, 80];
const BOTTOM_R = 12.5;

/** Wire radius (insulation) per section, typical 450/750 V PVC building wire. */
const WIRE_R: Record<number, number> = { 1.5: 1.5, 2.5: 1.75, 6: 2.25, 10: 2.95 };

const PHASE_COLOR = { 1: WIRE_COLORS.preto.base, 2: WIRE_COLORS.vermelho.base } as const;
const NEUTRAL_COLOR = WIRE_COLORS['azul-claro'].base;

// ---------------------------------------------------------------------------
// Printed atlas: device fronts, the cover strips and the warning sticker.

const ATLAS_W = 2048;
const ATLAS_H = 512;
/** Pixels per mm. */
const PX = 7.5;
const FRONT = { w: 16, h: 40 };
const RATINGS = ['C10', 'C20', 'C40', 'C50'] as const;
type Rating = (typeof RATINGS)[number];
const rect = (x: number, y: number, wMm: number, hMm: number): AtlasRect => ({
  x,
  y,
  w: Math.round(wMm * PX),
  h: Math.round(hMm * PX),
});
const ATLAS = {
  breaker: Object.fromEntries(
    RATINGS.map((r, i) => [r, rect(i * 120, 0, FRONT.w, FRONT.h)]),
  ) as Record<Rating, AtlasRect>,
  dps: rect(480, 0, FRONT.w, FRONT.h),
  dr: rect(600, 0, 70, FRONT.h),
  strip1: rect(0, 310, 166, 12),
  strip2: rect(0, 405, 166, 12),
  sticker: rect(1300, 310, 44, 24),
};
/** DR front: lever and test button (mm from the device centre). */
const DR_LEVER_X = -16;
const DR_TEST: [number, number] = [21, 10];

function drawHand(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  seed: number,
) {
  // Ballpoint handwriting: italic letters with a small wobble, fitted to the slot.
  let s = size;
  ctx.font = `italic 500 ${s}px ${FONT_SANS}`;
  while (ctx.measureText(text).width > maxW && s > 8) {
    s -= 1;
    ctx.font = `italic 500 ${s}px ${FONT_SANS}`;
  }
  const width = ctx.measureText(text).width;
  let cx = x - width / 2;
  let r = seed * 9301 + 49297;
  const rand = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280 - 0.5;
  };
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    ctx.save();
    ctx.translate(cx, y + rand() * s * 0.12 + (cx - x) * 0.012);
    ctx.rotate(rand() * 0.09);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cx += w * (1 + rand() * 0.06);
  }
}

function drawAtlas(ctx: CanvasRenderingContext2D, circuits: Circuit[]) {
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
  const ink = '#2a2b2e';
  // Breaker fronts: rating, breaking capacity box, energy class, I/O marks.
  for (const r of RATINGS) {
    const a = ATLAS.breaker[r];
    const cx = a.x + a.w / 2;
    ctx.fillStyle = ink;
    fitText(ctx, r, cx, a.y + 42, a.w * 0.84, 40, { weight: 800 });
    fitText(ctx, 'I', a.x + 12, a.y + 104, 20, 20, { weight: 700 });
    fitText(ctx, 'O', a.x + 12, a.y + 196, 20, 20, { weight: 700 });
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(a.x + 16, a.y + 222, 62, 30);
    fitText(ctx, '6000', a.x + 47, a.y + 238, 54, 22, { weight: 700 });
    ctx.strokeRect(a.x + 84, a.y + 222, 24, 30);
    fitText(ctx, '3', a.x + 96, a.y + 238, 18, 22, { weight: 700 });
    fitText(ctx, '230/400 V~', cx, a.y + 276, a.w * 0.86, 15, { weight: 600 });
  }
  // DPS cartridge (white print on dark grey) with the status window.
  {
    const a = ATLAS.dps;
    const cx = a.x + a.w / 2;
    ctx.fillStyle = '#f2f2ee';
    fitText(ctx, 'DPS', cx, a.y + 34, a.w * 0.8, 34, { weight: 800 });
    fitText(ctx, 'Classe II', cx, a.y + 66, a.w * 0.84, 17, { weight: 600 });
    ctx.fillStyle = '#1b1c1e';
    ctx.fillRect(a.x + 26, a.y + 96, 68, 46);
    ctx.fillStyle = '#26b04a';
    ctx.fillRect(a.x + 31, a.y + 101, 58, 36);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(a.x + 31, a.y + 101, 58, 8);
    ctx.fillStyle = '#f2f2ee';
    fitText(ctx, 'verde: OK', cx, a.y + 158, a.w * 0.86, 15, { weight: 600 });
    fitText(ctx, 'Uc 275 V~', cx, a.y + 196, a.w * 0.86, 17, { weight: 600 });
    fitText(ctx, 'In 20 kA', cx, a.y + 222, a.w * 0.86, 17, { weight: 600 });
    fitText(ctx, 'Imáx 40 kA', cx, a.y + 248, a.w * 0.86, 17, { weight: 600 });
  }
  // DR front: ratings, test button marking and the symbol of the residual current.
  {
    const a = ATLAS.dr;
    const cx = a.x + a.w / 2;
    const at = (mmX: number, mmY: number): [number, number] => [
      cx + mmX * PX,
      a.y + a.h / 2 - mmY * PX,
    ];
    ctx.fillStyle = ink;
    const [lx] = at(DR_LEVER_X, 0);
    fitText(ctx, 'I', lx - 70, a.y + 104, 22, 22, { weight: 700 });
    fitText(ctx, 'O', lx - 70, a.y + 196, 22, 22, { weight: 700 });
    fitText(ctx, 'DR', cx + 22, a.y + 40, 140, 40, { weight: 800 });
    fitText(ctx, '63 A', cx + 22, a.y + 84, 140, 30, { weight: 700 });
    fitText(ctx, 'IΔn 30 mA', cx + 40, a.y + 124, 200, 26, { weight: 700 });
    fitText(ctx, '4 polos  230/400 V~', a.x + a.w / 2 + 20, a.y + 252, a.w * 0.62, 18, {
      weight: 600,
    });
    const [tx, ty] = at(DR_TEST[0], DR_TEST[1]);
    fitText(ctx, 'T', tx + 42, ty, 30, 30, { weight: 800 });
    fitText(ctx, 'Teste mensal', tx, ty + 44, 150, 16, { weight: 600 });
    // Residual-current symbol: a toroid with the conductors through it.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    const sx = cx + 150;
    const sy = a.y + 196;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 26, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (const dx of [-10, 0, 10]) {
      ctx.beginPath();
      ctx.moveTo(sx + dx, sy - 26);
      ctx.lineTo(sx + dx, sy + 26);
      ctx.stroke();
    }
  }
  // Cover strips: white paper labels, written by hand with a blue ballpoint pen.
  const strip = (a: AtlasRect, slots: { from: number; to: number; lines: string[] }[]) => {
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(a.x, a.y, a.w, a.h);
    const slotPx = DIN.pitch * PX;
    const x0 = a.x + (a.w - MODULES * slotPx) / 2;
    ctx.strokeStyle = 'rgba(40,40,40,0.28)';
    ctx.lineWidth = 2;
    for (let i = 1; i < MODULES; i++) {
      ctx.beginPath();
      ctx.moveTo(x0 + i * slotPx, a.y + 4);
      ctx.lineTo(x0 + i * slotPx, a.y + a.h - 4);
      ctx.stroke();
    }
    ctx.fillStyle = '#1d3f9a';
    slots.forEach((s, k) => {
      const cx = x0 + ((s.from + s.to + 1) / 2) * slotPx;
      const w = (s.to - s.from + 1) * slotPx - 10;
      const n = s.lines.length;
      s.lines.forEach((line, j) => {
        const y = a.y + a.h / 2 + (j - (n - 1) / 2) * (a.h * 0.42);
        drawHand(ctx, line, cx, y, w, n > 1 ? 30 : 38, k * 7 + j + 3);
      });
    });
  };
  strip(ATLAS.strip1, [
    { from: 0, to: 1, lines: ['Geral'] },
    { from: 2, to: 4, lines: ['DPS'] },
    { from: 5, to: 8, lines: ['DR'] },
  ]);
  let pos = 0;
  strip(
    ATLAS.strip2,
    circuits.map((c, i) => {
      // Circuit number before the name, as electricians write it.
      const lines = [`${i + 1} ${c.label[0]}`, ...c.label.slice(1)];
      const s = { from: pos, to: pos + c.poles - 1, lines };
      pos += c.poles;
      return s;
    }),
  );
  // Warning sticker: yellow, lightning triangle and the text.
  {
    const a = ATLAS.sticker;
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 6;
    ctx.strokeRect(a.x + 6, a.y + 6, a.w - 12, a.h - 12);
    const tx = a.x + 82;
    const ty = a.y + a.h / 2 + 6;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 60);
    ctx.lineTo(tx + 62, ty + 50);
    ctx.lineTo(tx - 62, ty + 50);
    ctx.closePath();
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = '#141414';
    ctx.beginPath();
    ctx.moveTo(tx + 8, ty - 30);
    ctx.lineTo(tx - 14, ty + 10);
    ctx.lineTo(tx + 2, ty + 10);
    ctx.lineTo(tx - 8, ty + 40);
    ctx.lineTo(tx + 16, ty - 2);
    ctx.lineTo(tx, ty - 2);
    ctx.lineTo(tx + 10, ty - 30);
    ctx.closePath();
    ctx.fill();
    fitText(ctx, 'CUIDADO', a.x + 230, a.y + 62, 170, 40, { weight: 800 });
    fitText(ctx, 'Risco de', a.x + 230, a.y + 104, 170, 26, { weight: 700 });
    fitText(ctx, 'choque elétrico', a.x + 230, a.y + 134, 170, 26, { weight: 700 });
  }
}

// ---------------------------------------------------------------------------
// Wires.

type Conductor = 1 | 2 | 'n' | 'pe';

interface WireRun {
  points: Vec3[];
  r: number;
  /** PVC colour, or 'pe' for the green-yellow (striped) insulation. */
  color: string;
}

/** Spots inside a conduit for its wires (x, z offsets from the centre). */
function conduitSpot(k: number, r: number): [number, number] {
  if (k === 0) return [0, 0];
  const a = k * 2.4;
  const d = r * (k < 7 ? 0.48 : 0.78);
  return [Math.cos(a) * d, Math.sin(a) * d];
}

/** Every wire of the board, routed like a tidy installer would. */
function buildWires(circuits: Circuit[]): WireRun[] {
  const out: WireRun[] = [];
  const add = (conductor: Conductor, section: number, ...points: Vec3[]) =>
    out.push({
      points,
      r: WIRE_R[section]!,
      color: conductor === 'pe' ? 'pe' : conductor === 'n' ? NEUTRAL_COLOR : PHASE_COLOR[conductor],
    });
  const t1 = top(ROW1) - IN;
  const b1 = bottom(ROW1) + IN;
  const t2 = top(ROW2) - IN;
  const b2 = bottom(ROW2) + IN;
  const inY = BOX.H + CONDUIT.stub - 2;
  const tc = TOP_CONDUIT.x;

  // Supply from the meter: F1 and F2 to the main breaker, N to the neutral DPS, PE to the earth bar.
  add(1, 10, [tc - 6, inY, 40], [tc - 6, 326, 40], [mx(0), 314, ZW], [mx(0), t1, ZW]);
  add(2, 10, [tc + 2, inY, 42], [tc + 2, 326, 42], [mx(1), 314, ZW], [mx(1), t1, ZW]);
  add(
    'n',
    10,
    [tc - 2, inY, 32],
    [tc - 2, 331, 32],
    [mx(4) - 3, 331, 32],
    [mx(4) - 3, 313, ZW],
    [mx(4) - 3, t1, ZW],
  );
  add(
    'pe',
    10,
    [tc + 6, inY, 30],
    [tc + 6, 334, 30],
    [119.5, 334, 30],
    [119.5, 70, 30],
    [busHole(EARTH_X, 9), 60, BUS_Z],
    [busHole(EARTH_X, 9), BUS.y + BUS.h / 2 + 0.5, BUS_Z],
  );

  // Main breaker outputs, round the left gutter, to the DPS of each phase.
  add(
    1,
    10,
    [mx(0), b1, ZW],
    [mx(0), 204, ZW],
    [-108, 204, ZW],
    [-108, 312, ZW],
    [-108, 322, 62],
    [mx(2) - 2.5, 322, 62],
    [mx(2) - 2.5, 310, ZW],
    [mx(2) - 2.5, t1, ZW],
  );
  add(
    2,
    10,
    [mx(1), b1, ZW],
    [mx(1), 198, ZW],
    [-116, 198, ZW],
    [-116, 314, ZW],
    [-116, 327, 68],
    [mx(3) - 2.5, 327, 68],
    [mx(3) - 2.5, 312, ZW],
    [mx(3) - 2.5, t1, ZW],
  );
  // Jumpers from each DPS terminal to the RCD inputs.
  const jumper = (color: Conductor, xa: number, xb: number, h: number, z: number) =>
    add(
      color,
      10,
      [xa, t1, ZW],
      [xa, h - 5, ZW + (z - ZW) * 0.6],
      [xa, h, z],
      [xb, h, z],
      [xb, h - 5, ZW + (z - ZW) * 0.6],
      [xb, t1, ZW],
    );
  jumper(1, mx(2) + 2.5, mx(5), 311, 64);
  jumper(2, mx(3) + 2.5, mx(6), 317, 71);
  jumper('n', mx(4) + 2.5, mx(8), 309, 44);

  // DPS earth terminals to the earth bar, down the right gutter.
  [2, 3, 4].forEach((m, k) => {
    const y = 206 - k * 5;
    const gx = 104 + k * 5;
    add(
      'pe',
      6,
      [mx(m), b1, ZW],
      [mx(m), y + 4, 44],
      [mx(m) + 5, y, 36],
      [gx, y, 36],
      [gx, 72, 32 - k * 3],
      [busHole(EARTH_X, 8 - k), 62, BUS_Z],
      [busHole(EARTH_X, 8 - k), BUS.y + BUS.h / 2 + 0.5, BUS_Z],
    );
  });

  // RCD outputs: F1 and F2 to the comb ends, N to the neutral bar.
  add(1, 10, [mx(5), b1, ZW], [mx(5), 192, ZW], [mx(0), 192, ZW], [mx(0), t2, ZW]);
  add(2, 10, [mx(6), b1, ZW], [mx(6), 186, ZW], [mx(1), 186, ZW], [mx(1), t2, ZW]);
  add(
    'n',
    10,
    [mx(8), b1, ZW],
    [mx(8), 207, 44],
    [-113, 207, 44],
    [-113, 70, 24],
    [-113, BUS.y, BUS_Z],
    [NEUTRAL_X - BUS.length / 2 - 0.5, BUS.y, BUS_Z],
  );

  // Circuits: phases from the breakers, neutral and earth from the bars, out through the bottom.
  const spots = new Map<number, number>();
  const exitOf = (x: number) =>
    BOTTOM_CONDUITS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const exit = (ex: number, z0: number): Vec3 => {
    const k = spots.get(ex) ?? 0;
    spots.set(ex, k + 1);
    const [dx, dz] = conduitSpot(k, BOTTOM_R);
    return [ex + dx, -CONDUIT.stub + 2, z0 + dz];
  };
  const usedN = new Set<number>();
  // The supply earth and the DPS earths take the right-hand holes from the top.
  const usedE = new Set<number>([6, 7, 8, 9]);
  const freeHole = (cx: number, used: Set<number>, near: number) => {
    let best = -1;
    for (let i = 0; i < BUS.holes; i++) {
      if (used.has(i)) continue;
      if (best < 0 || Math.abs(busHole(cx, i) - near) < Math.abs(busHole(cx, best) - near))
        best = i;
    }
    used.add(best);
    return busHole(cx, best);
  };
  let pos = 0;
  circuits.forEach((c, i) => {
    const xs = c.poles === 2 ? [mx(pos), mx(pos + 1)] : [mx(pos)];
    const ex = exitOf((xs[0]! + xs[xs.length - 1]!) / 2);
    const lift = (i % 3) * 3;
    xs.forEach((x, k) => {
      const phase = ((pos + k) % 2) + 1;
      const end = exit(ex, CONDUIT.z);
      add(
        phase as Conductor,
        c.section,
        [x, b2, ZW],
        [x, 66 - lift, ZW],
        [end[0], 18, CONDUIT.z + 6],
        end,
      );
    });
    if (c.poles === 1) {
      const hx = freeHole(NEUTRAL_X, usedN, ex);
      const end = exit(ex, CONDUIT.z);
      add(
        'n',
        c.section,
        [hx, BUS.y - BUS.h / 2 - 0.5, BUS_Z],
        [hx, 26 - lift, BUS_Z + 2],
        [end[0], 8, CONDUIT.z - 4],
        end,
      );
    }
    const hx = freeHole(EARTH_X, usedE, ex);
    const end = exit(ex, CONDUIT.z);
    add(
      'pe',
      c.section,
      [hx, BUS.y - BUS.h / 2 - 0.5, BUS_Z],
      [hx, 24 - lift, BUS_Z + 4],
      [end[0], 8, CONDUIT.z - 2],
      end,
    );
    pos += c.poles;
  });
  return out;
}

// ---------------------------------------------------------------------------

interface BoardGeometry extends Record<string, BufferGeometry | null> {
  body1: BufferGeometry;
  body4: BufferGeometry;
  rail: BufferGeometry;
  screw: BufferGeometry;
  busScrew: BufferGeometry;
  frontDps: BufferGeometry;
  frontDr: BufferGeometry;
  strip1: BufferGeometry;
  strip2: BufferGeometry;
  sticker: BufferGeometry;
  box: BufferGeometry;
  frame: BufferGeometry;
  cover: BufferGeometry;
  conduitTop: BufferGeometry;
  conduitBottom: BufferGeometry;
  lever: BufferGeometry;
  drLever: BufferGeometry;
}

/** One printed rating per rating (the breaker fronts share one atlas). */
function useBreakerFronts() {
  return useGeometrySet(
    () =>
      Object.fromEntries(
        RATINGS.map((r): [Rating, BufferGeometry] => [
          r,
          atlasPlaneGeometry(FRONT.w, FRONT.h, ATLAS.breaker[r], ATLAS_W, ATLAS_H),
        ]),
      ) as Record<Rating, BufferGeometry>,
    [],
  );
}

function useBoardGeometry(): BoardGeometry {
  return useGeometrySet<BoardGeometry>(() => {
    const box = shellGeometry(BOX.W, BOX.D, BOX.H, 6, 1.2, BOX.wall, BOX.wall);
    box.rotateX(-Math.PI / 2);
    box.translate(0, BOX.H / 2, BOX.D);
    const frame = plateGeometry(FRAME.W, FRAME.H, 9, FRAME.t, [
      { x: 0, y: 0, w: COVER.W + 2, h: COVER.H + 2, r: 4 },
    ]);
    frame.translate(0, BOX.H / 2, FRAME.z + FRAME.t / 2);
    const window = (row: number) => ({
      x: 0,
      y: row - BOX.H / 2,
      w: MODULES * DIN.pitch + 2,
      h: 2 * DIN.frontHalf + 1.2,
      r: 1,
    });
    const cover = plateGeometry(COVER.W, COVER.H, 4, COVER.t, [window(ROW1), window(ROW2)], 0.6);
    cover.translate(0, BOX.H / 2, COVER.back + COVER.t / 2);
    const lever = roundedBox(8, 13.5, 5.6, 1.2, 0.8);
    // Built along +Y: turn it to stick out along +Z from the pivot.
    lever.rotateX(Math.PI / 2);
    const drLever = roundedBox(14, 13.5, 6, 1.4, 0.8);
    drLever.rotateX(Math.PI / 2);
    return {
      body1: dinBodyGeometry(1),
      body4: dinBodyGeometry(4),
      rail: dinRailGeometry(RAIL_LENGTH),
      screw: screwHeadGeometry(2.5, 1.6, 'combinada', { slot: 0.7 }),
      busScrew: screwHeadGeometry(2.9, 2.2, 'fenda', { slot: 0.8 }),
      frontDps: atlasPlaneGeometry(FRONT.w, FRONT.h, ATLAS.dps, ATLAS_W, ATLAS_H),
      frontDr: atlasPlaneGeometry(70, FRONT.h, ATLAS.dr, ATLAS_W, ATLAS_H),
      strip1: atlasPlaneGeometry(166, 12, ATLAS.strip1, ATLAS_W, ATLAS_H),
      strip2: atlasPlaneGeometry(166, 12, ATLAS.strip2, ATLAS_W, ATLAS_H),
      sticker: atlasPlaneGeometry(44, 24, ATLAS.sticker, ATLAS_W, ATLAS_H),
      box,
      frame,
      cover,
      conduitTop: corrugatedConduitGeometry(TOP_CONDUIT.r, CONDUIT.stub + 3),
      conduitBottom: corrugatedConduitGeometry(BOTTOM_R, CONDUIT.stub + 3),
      lever,
      drLever,
    } as BoardGeometry;
  }, []);
}

const WHITE = { preset: 'absWhite' as const, color: '#f3f2ee', roughness: 0.42 };
const DARK = { color: '#161617', roughness: 0.9, metalness: 0 };
const ZINC = { preset: 'zinc' as const, color: '#e4e6e2', roughness: 0.5 };

/** A dark opening drawn on a face (screw recess, wire entry, lever slot). */
function Hole({
  position,
  size,
  facing = 'front',
}: {
  position: Vec3;
  size: [number, number];
  facing?: 'front' | 'up' | 'down';
}) {
  const rotation: Vec3 =
    facing === 'up' ? [-Math.PI / 2, 0, 0] : facing === 'down' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <mesh position={position} rotation={rotation} renderOrder={1}>
      <planeGeometry args={size} />
      {/* Constant offset only: a slope-scaled one pulls edge-on faces through the cover. */}
      <Material {...DARK} polygonOffset polygonOffsetFactor={0} polygonOffsetUnits={-4} />
    </mesh>
  );
}

function Print({
  geometry,
  map,
  position,
}: {
  geometry: BufferGeometry;
  map: Texture;
  position: Vec3;
}) {
  return (
    <mesh geometry={geometry} position={position} renderOrder={2}>
      <Material
        color="#ffffff"
        map={map}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
        roughness={0.5}
      />
    </mesh>
  );
}

/** Terminals of one pole: openings on the top and bottom faces and the two screws. */
function Terminals({
  x,
  row,
  g,
  which = 'both',
}: {
  x: number;
  row: number;
  g: BoardGeometry;
  which?: 'both' | 'top' | 'bottom';
}) {
  const sides = which === 'both' ? [1, -1] : which === 'top' ? [1] : [-1];
  return (
    <>
      {sides.map((s) => (
        <group key={s}>
          <Hole
            position={[x, row + s * (DIN.half + 0.06), ZD + DIN.wireZ]}
            size={[8.4, 9]}
            facing={s > 0 ? 'up' : 'down'}
          />
          <Hole
            position={[x, row + s * (DIN.half + 0.06), ZD + DIN.combZ]}
            size={[9.4, 3.6]}
            facing={s > 0 ? 'up' : 'down'}
          />
          <Hole position={[x, row + s * DIN.screwY, ZD + DIN.shoulder + 0.03]} size={[7, 7]} />
          <mesh
            geometry={g.screw}
            position={[x, row + s * DIN.screwY, ZD + DIN.shoulder - 1]}
            rotation={[Math.PI / 2, s * 0.4, 0]}
          >
            <Material {...ZINC} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A one-pole breaker body, its print and its lever. */
function BreakerPole({
  x,
  row,
  rating,
  on,
  g,
  fronts,
  atlas,
}: {
  x: number;
  row: number;
  rating: Rating;
  on: boolean;
  g: BoardGeometry;
  fronts: Record<Rating, BufferGeometry>;
  atlas: Texture;
}) {
  return (
    <group>
      <mesh geometry={g.body1} position={[x, row, ZD]}>
        <Material {...WHITE} />
      </mesh>
      <Print geometry={fronts[rating]} map={atlas} position={[x, row, ZD + DIN.front + 0.03]} />
      <Hole position={[x, row, ZD + DIN.front + 0.05]} size={[10, 17]} />
      <group position={[x, row, ZD + DIN.front - 4]} rotation={[on ? -0.42 : 0.42, 0, 0]}>
        <mesh geometry={g.lever} position={[0, 0, 0]}>
          <Material preset="absBlack" roughness={0.45} />
        </mesh>
      </group>
      <Terminals x={x} row={row} g={g} />
    </group>
  );
}

/** Tie bar joining the levers of a multi-pole breaker. */
function TieBar({ x0, x1, row, on }: { x0: number; x1: number; row: number; on: boolean }) {
  const a = on ? -0.42 : 0.42;
  const reach = 11.5;
  return (
    <mesh
      position={[
        (x0 + x1) / 2,
        row - Math.sin(a) * reach,
        ZD + DIN.front - 4 + Math.cos(a) * reach,
      ]}
      rotation={[a, 0, 0]}
    >
      <boxGeometry args={[x1 - x0 + 6, 2.6, 2.6]} />
      <Material preset="absBlack" roughness={0.45} />
    </mesh>
  );
}

export default function DistributionBoard(props: DistributionBoardProps) {
  const p = { ...meta.defaults, ...props } as Required<DistributionBoardProps>;
  const count = circuitsOf(p.circuits);
  const circuits = CIRCUITS[count];
  const tripped = trippedOf(p.tripped);
  const g = useBoardGeometry();
  const fronts = useBreakerFronts();
  const atlas = useCanvasTexture((ctx) => drawAtlas(ctx, circuits), `atlas|${count}`, {
    width: ATLAS_W,
    height: ATLAS_H,
    fonts: [`800 40px ${FONT_SANS}`, `italic 500 40px ${FONT_SANS}`],
  });
  const stripe = useCanvasTexture(
    (ctx, w, h) => {
      const c = WIRE_COLORS['verde-amarelo'];
      ctx.fillStyle = c.base;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = c.stripe!;
      ctx.fillRect(0, h * 0.1, w, h * 0.22);
      ctx.fillRect(0, h * 0.6, w, h * 0.22);
    },
    'pe-stripe',
    { width: 4, height: 64, repeat: true },
  );
  const wires = useMemo(() => buildWires(circuits), [circuits]);

  // Bottom row positions.
  const placed: { c: Circuit; pos: number; index: number }[] = [];
  let pos = 0;
  circuits.forEach((c, index) => {
    placed.push({ c, pos, index });
    pos += c.poles;
  });
  const used = pos;
  const drOn = tripped !== 'dr';
  const tripIndex = circuits.indexOf(COZINHA);

  const drX = (mx(5) + mx(8)) / 2;
  const ZF = ZD + DIN.front;

  return (
    <group position={[0, CONDUIT.stub, -BOX.D / 2]}>
      <BatchRoot blocks={NO_BLOCKS}>
        {/* Box, finishing frame, conduits and the wiring (stays in the wall). */}
        <BakeLayer
          lift={[0, 0, 0]}
          extras={
            <>
              <Anchor name="qd-entrada" position={[TOP_CONDUIT.x, BOX.H - 18, 44]} />
            </>
          }
        >
          <mesh geometry={g.box}>
            <Material color="#dddcd6" roughness={0.55} preset="absWhite" />
          </mesh>
          <mesh geometry={g.frame}>
            <Material {...WHITE} color="#eeede8" roughness={0.38} />
          </mesh>
          <mesh geometry={g.conduitTop} position={[TOP_CONDUIT.x, BOX.H - 3, CONDUIT.z]}>
            <Material color="#f1c21b" roughness={0.45} />
          </mesh>
          {BOTTOM_CONDUITS.map((x) => (
            <mesh
              key={x}
              geometry={g.conduitBottom}
              position={[x, 3, CONDUIT.z]}
              rotation={[Math.PI, 0, 0]}
            >
              <Material color="#f1c21b" roughness={0.45} />
            </mesh>
          ))}
          {wires.map((w, i) => (
            <Wire
              key={i}
              points={w.points}
              radius={w.r}
              bend={Math.max(w.r * 3, 6)}
              radial={8}
              material={
                w.color === 'pe'
                  ? { preset: 'pvc', color: '#ffffff', map: stripe }
                  : { preset: 'pvc', color: w.color }
              }
            />
          ))}
        </BakeLayer>

        {/* Neutral and earth busbars. */}
        <BakeLayer
          lift={[0, 0, 60]}
          delay={0.2}
          extras={
            <>
              <Anchor name="qd-neutro" position={[NEUTRAL_X - 20, BUS.y + 5, BUS.z + BUS.t + 2]} />
              <Anchor name="qd-terra" position={[EARTH_X + 20, BUS.y + 5, BUS.z + BUS.t + 2]} />
            </>
          }
        >
          {[
            { x: NEUTRAL_X, color: '#2a62c9' },
            { x: EARTH_X, color: '#2a7a3b' },
          ].map((b) => (
            <group key={b.x}>
              <mesh position={[b.x, BUS.y, BUS.z + BUS.t / 2]}>
                <boxGeometry args={[BUS.length, BUS.h, BUS.t]} />
                <Material preset="brass" color="#e2be72" roughness={0.36} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh
                  key={s}
                  position={[b.x + s * (BUS.length / 2 - 7), BUS.y, (BOX.wall + BUS.z) / 2]}
                >
                  <boxGeometry args={[12, 16, BUS.z - BOX.wall]} />
                  <Material color={b.color} roughness={0.5} />
                </mesh>
              ))}
              {Array.from({ length: BUS.holes }, (_, i) => (
                <mesh
                  key={i}
                  geometry={g.busScrew}
                  position={[busHole(b.x, i), BUS.y, BUS.z + BUS.t]}
                  rotation={[Math.PI / 2, i * 0.7, 0]}
                >
                  <Material preset="nickel" roughness={0.3} />
                </mesh>
              ))}
            </group>
          ))}
        </BakeLayer>

        {/* DIN rails on their stand-offs. */}
        <BakeLayer
          lift={[0, 0, 105]}
          delay={0.12}
          extras={<Anchor name="qd-trilho" position={[mx(MODULES - 1) + 6, ROW2 + 14, ZD]} />}
        >
          {[ROW1, ROW2].map((row) => (
            <group key={row}>
              <mesh geometry={g.rail} position={[0, row, RAIL_BACK]}>
                <Material {...ZINC} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh
                  key={s}
                  position={[s * (RAIL_LENGTH / 2 - 12), row, (BOX.wall + RAIL_BACK) / 2]}
                >
                  <boxGeometry args={[10, 22, RAIL_BACK - BOX.wall]} />
                  <Material {...WHITE} color="#dcdbd5" roughness={0.55} />
                </mesh>
              ))}
            </group>
          ))}
        </BakeLayer>

        {/* Devices: main breaker, DPS, RCD, circuit breakers and the comb busbar. */}
        <BakeLayer
          lift={[0, 0, 175]}
          delay={0.04}
          extras={
            <>
              <Anchor name="qd-geral" position={[(mx(0) + mx(1)) / 2, ROW1 + 16, ZF + 2]} />
              <Anchor name="qd-dps" position={[mx(3), ROW1 + 19, ZF + 1]} />
              <Anchor name="qd-dr" position={[drX + 22, ROW1 - 14, ZF + 1]} />
              <Anchor name="qd-teste" position={[drX + DR_TEST[0], ROW1 + DR_TEST[1], ZF + 3]} />
              <Anchor
                name="qd-circuitos"
                position={
                  tripped === 'disjuntor'
                    ? [mx(placed[tripIndex]!.pos), ROW2 - 10, ZF + 6]
                    : [mx(2), ROW2 - 15, ZF + 1]
                }
              />
              <Anchor name="qd-pente" position={[mx(used - 1) - 4, top(ROW2) + 7, ZD + 37]} />
            </>
          }
        >
          {/* Main breaker, 2 poles C50. */}
          {[0, 1].map((m) => (
            <BreakerPole
              key={m}
              x={mx(m)}
              row={ROW1}
              rating="C50"
              on
              g={g}
              fronts={fronts}
              atlas={atlas}
            />
          ))}
          <TieBar x0={mx(0)} x1={mx(1)} row={ROW1} on />

          {/* Surge protectors: body, plug-in cartridge with the status window. */}
          {[2, 3, 4].map((m) => (
            <group key={m}>
              <mesh geometry={g.body1} position={[mx(m), ROW1, ZD]}>
                <Material {...WHITE} />
              </mesh>
              <mesh position={[mx(m), ROW1, ZD + (DIN.shoulder + 0.1 + DIN.front + 0.6) / 2]}>
                <boxGeometry args={[17, 2 * DIN.frontHalf + 0.6, DIN.front + 0.5 - DIN.shoulder]} />
                <Material color="#585c62" roughness={0.5} />
              </mesh>
              <Print
                geometry={g.frontDps}
                map={atlas}
                position={[mx(m), ROW1, ZD + DIN.front + 0.6 + 0.03]}
              />
              <Terminals x={mx(m)} row={ROW1} g={g} />
            </group>
          ))}

          {/* RCD, 4 poles: body, print, lever and test button. */}
          <mesh geometry={g.body4} position={[drX, ROW1, ZD]}>
            <Material {...WHITE} />
          </mesh>
          <Print geometry={g.frontDr} map={atlas} position={[drX, ROW1, ZF + 0.03]} />
          <Hole position={[drX + DR_LEVER_X, ROW1, ZF + 0.05]} size={[16, 17]} />
          <group position={[drX + DR_LEVER_X, ROW1, ZF - 4]} rotation={[drOn ? -0.42 : 0.42, 0, 0]}>
            <mesh geometry={g.drLever}>
              <Material color="#2456b8" roughness={0.45} />
            </mesh>
          </group>
          <mesh position={[drX + DR_TEST[0], ROW1 + DR_TEST[1], ZF + 1.2]}>
            <boxGeometry args={[6.5, 6.5, 2.4]} />
            <Material color="#f0c419" roughness={0.45} />
          </mesh>
          {[5, 6, 7, 8].map((m) => (
            <Terminals key={m} x={mx(m)} row={ROW1} g={g} />
          ))}

          {/* Circuit breakers. */}
          {placed.map(({ c, pos: at, index }) => {
            const on = !(tripped === 'disjuntor' && index === tripIndex);
            const poles = c.poles === 2 ? [at, at + 1] : [at];
            return (
              <group key={index}>
                {poles.map((m) => (
                  <BreakerPole
                    key={m}
                    x={mx(m)}
                    row={ROW2}
                    rating={c.rating}
                    on={on}
                    g={g}
                    fronts={fronts}
                    atlas={atlas}
                  />
                ))}
                {c.poles === 2 && <TieBar x0={mx(at)} x1={mx(at + 1)} row={ROW2} on={on} />}
              </group>
            );
          })}

          {/* Two-phase comb busbar over the top terminals of the bottom row. */}
          <mesh position={[(mx(0) + mx(used - 1)) / 2, top(ROW2) + 4, ZD + DIN.combZ]}>
            <boxGeometry args={[(used - 1) * DIN.pitch + 14, 8, 10]} />
            <Material color="#d5d1c7" roughness={0.5} />
          </mesh>
          {Array.from({ length: used }, (_, m) => (
            <mesh key={m} position={[mx(m), top(ROW2) + 0.3, ZD + DIN.combZ]}>
              <boxGeometry args={[5, 1.2, 1.2]} />
              <Material preset="copper" roughness={0.3} />
            </mesh>
          ))}
        </BakeLayer>

        {/* Front cover with the circuit labels, blanks and the warning sticker. */}
        {p.cover && (
          <BakeLayer
            lift={[-300, 0, 150]}
            extras={<Anchor name="qd-tampa" position={[60, ROW2 + 31, COVER.back + COVER.t + 1]} />}
          >
            <mesh geometry={g.cover}>
              <Material {...WHITE} color="#f1f0ec" roughness={0.36} />
            </mesh>
            {[
              { row: ROW1, geometry: g.strip1 },
              { row: ROW2, geometry: g.strip2 },
            ].map((s) => (
              <Print
                key={s.row}
                geometry={s.geometry}
                map={atlas}
                position={[0, s.row + DIN.frontHalf + 9.5, COVER.back + COVER.t + 0.03]}
              />
            ))}
            <Print
              geometry={g.sticker}
              map={atlas}
              position={[0, ROW2 - DIN.frontHalf - 30, COVER.back + COVER.t + 0.03]}
            />
            {Array.from({ length: MODULES - used }, (_, k) => (
              <mesh key={k} position={[mx(used + k), ROW2, COVER.back + COVER.t / 2]}>
                <boxGeometry args={[DIN.pitch - 0.3, 2 * DIN.frontHalf + 1, COVER.t - 0.4]} />
                <Material {...WHITE} color="#e9e8e2" roughness={0.4} />
              </mesh>
            ))}
            {[
              [-1, 1],
              [1, 1],
              [-1, -1],
              [1, -1],
            ].map(([sx, sy]) => (
              <mesh
                key={`${sx}${sy}`}
                geometry={g.busScrew}
                position={[
                  sx! * (COVER.W / 2 - 10),
                  BOX.H / 2 + sy! * (COVER.H / 2 - 10),
                  COVER.back + COVER.t - 0.6,
                ]}
                rotation={[Math.PI / 2, (sx! + sy!) * 0.5, 0]}
              >
                <Material preset="nickel" roughness={0.3} />
              </mesh>
            ))}
          </BakeLayer>
        )}
      </BatchRoot>
    </group>
  );
}

const NO_BLOCKS: string[] = [];
