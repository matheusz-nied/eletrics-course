import { describe, expect, it } from 'vitest';
import gate from '../../engine/devices/gate-mechanics';
import { CV, HP, PRESETS, selfLocking, solveDrive, wormRatio } from './reducao';

describe('redutor', () => {
  it('trades speed for torque and loses the rest as heat', () => {
    const r = solveDrive({ power: 750, rpm: 1720, ratio: 30, efficiency: 0.7, pinion: 0 });
    expect(r.motorTorque).toBeCloseTo(4.164, 3);
    expect(r.outRpm).toBeCloseTo(57.33, 2);
    expect(r.outTorque).toBeCloseTo(4.164 * 30 * 0.7, 2);
    expect(r.outPower).toBeCloseTo(525, 6);
    expect(r.loss).toBeCloseTo(225, 6);
    expect(r.speed).toBeUndefined();
  });

  it('moves the gate at about 15 m/min and pushes it with about 450 N', () => {
    const r = solveDrive(PRESETS.find((p) => p.id === 'portao')!.drive);
    expect(r.speed! * 60).toBeGreaterThan(14.5);
    expect(r.speed! * 60).toBeLessThan(15.2);
    expect(r.force).toBeGreaterThan(440);
    expect(r.force).toBeLessThan(470);
    // Power at the rack is force × speed.
    expect(r.force! * r.speed!).toBeCloseTo(r.outPower, 6);
  });

  it('uses the drive train of the gate in module 16', () => {
    const p = gate.info.params;
    const drive = PRESETS.find((x) => x.id === 'portao')!.drive;
    expect(drive.ratio).toBe(p.ratio!.default);
    expect(drive.pinion).toBe(p.pinion!.default);
    expect(drive.efficiency).toBe(p.efficiency!.default);
  });

  it('knows its units and worm gears', () => {
    expect(CV).toBe(735.5);
    expect(HP / CV).toBeCloseTo(1.0139, 4);
    expect(wormRatio(30, 1)).toBe(30);
    expect(wormRatio(30, 2)).toBe(15);
    expect(selfLocking(0.45)).toBe(true);
    expect(selfLocking(0.7)).toBe(false);
  });
});
