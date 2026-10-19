import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getDeviceInfo } from '../../engine';
import type { SymbolCtx } from './_kit';
import { getSymbol, hasSymbol } from './index';

function draw(actuated: boolean): string {
  const def = getSymbol('switch-intermediate');
  const ctx: SymbolCtx = {
    el: { id: 'X1', type: 'switch-intermediate', at: [0, 0] },
    params: { actuated },
    live: {},
    rot: 0,
    flip: false,
    pins: def.pins!,
  };
  return renderToStaticMarkup(createElement(Fragment, null, def.draw(ctx)));
}

describe('switch-intermediate symbol', () => {
  it('is registered with the engine pins', () => {
    expect(hasSymbol('switch-intermediate')).toBe(true);
    const engine = Object.fromEntries(
      getDeviceInfo('switch-intermediate').pins.map((p) => [p.name, p.offset]),
    );
    expect(getSymbol('switch-intermediate').pins).toEqual(engine);
  });

  it('draws straight blades at rest and crossed blades when actuated', () => {
    const straight = draw(false);
    expect(straight).toContain('M-12 -20L10.5 -20M-12 20L10.5 20');
    expect(straight).toContain('direto');
    const crossed = draw(true);
    expect(crossed).toContain('M-12 -20L10.5 18.5M-12 20L10.5 -18.5');
    expect(crossed).toContain('cruzado');
  });
});
