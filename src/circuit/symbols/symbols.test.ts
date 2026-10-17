import { describe, expect, it } from 'vitest';
import { listDevices } from '../../engine';
import { listDevices as listFakeDevices } from '../fake-engine';
import { deviceInfo, listDeviceTypes } from '../engine';
import { getSymbol, hasSymbol } from './index';

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
});
