import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ElementDoc } from '../../engine/contract';
import { listDevices } from '../../engine';
import { listDevices as listFakeDevices } from '../fake-engine';
import { deviceInfo, listDeviceTypes } from '../engine';
import type { SymbolCtx, SymbolDef } from './_kit';
import { unknownSymbol } from './_unknown';
import { getSymbol, hasSymbol, listSymbols } from './index';

interface TurnCase {
  type: string;
  def: SymbolDef;
  two: boolean;
  pins?: SymbolCtx['pins'];
}

/** Markup of a symbol drawn rotated 90° and mirrored (two-terminal: pointing left). */
function drawTurned({ def, two, pins }: TurnCase): { markup: string; rot: number; flip: boolean } {
  const el: ElementDoc = two
    ? { id: 'X1', type: def.type, a: [4, 0], b: [0, 0] }
    : { id: 'X1', type: def.type, at: [0, 0], rot: 90, flip: true };
  const ctx: SymbolCtx = {
    el,
    params: {},
    live: {},
    rot: two ? 180 : 90,
    flip: !two,
    pins:
      pins ??
      def.pins ??
      Object.fromEntries((deviceInfo(def.type)?.pins ?? []).map((p) => [p.name, p.offset])),
  };
  const markup = renderToStaticMarkup(createElement(Fragment, null, def.draw(ctx)));
  return { markup, rot: ctx.rot, flip: ctx.flip };
}

const TURN_CASES: TurnCase[] = [
  ...listSymbols().map((def) => ({ type: def.type, def, two: def.body !== undefined })),
  { type: 'sem símbolo (2 terminais)', def: unknownSymbol('x'), two: true },
  {
    type: 'sem símbolo (caixa)',
    def: unknownSymbol('x'),
    two: false,
    pins: { a: [-3, 0], b: [3, -1], c: [3, 1] },
  },
];

describe('symbols', () => {
  it('exist for every device type of the course', () => {
    const missing = listDeviceTypes().filter((t) => t !== 'wire' && !hasSymbol(t));
    expect(missing).toEqual([]);
  });

  // A symbol drawn for other pin positions would leave leads in the wrong place.
  it.each(
    [...listDevices(), ...listFakeDevices()].filter(
      (d) => d.terminals === 'fixed' && d.pins.length > 0,
    ),
  )('draws $type with the engine pins', (info) => {
    const def = getSymbol(info.type);
    const actual = deviceInfo(info.type)!;
    if (!def.pins) return;
    const engine = Object.fromEntries(actual.pins.map((p) => [p.name, p.offset]));
    expect(def.pins).toEqual(engine);
  });

  // Rotation and mirror apply to the whole drawing; texts drawn with Upright
  // undo them so that "NF", "NA", "+" and the values still read normally.
  it.each(TURN_CASES)('keeps the texts of $type upright when turned and mirrored', (c) => {
    const { markup, rot, flip } = drawTurned(c);
    for (const tag of markup.match(/<text[^>]*>/g) ?? []) {
      expect(tag).toMatch(
        new RegExp(
          `transform="translate\\([^)]*\\) scale\\(${flip ? -1 : 1} 1\\) rotate\\(-${rot}\\)"`,
        ),
      );
    }
  });
});
