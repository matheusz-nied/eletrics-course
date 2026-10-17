/**
 * Sounds of the simulation, synthesized with Web Audio (no files): relay and
 * switch clicks, fuse pop, crackle when a part burns, the 120 Hz hum of a
 * stalled AC motor, a motor whine that follows the rotation and the buzzer.
 * Off until the student turns it on.
 */
import type { CircuitDoc, SimEvent, SimFrame } from '../engine/contract';

const SOUND_TYPES = new Set([
  'relay-spdt',
  'fuse',
  'breaker',
  'rcd',
  'dc-motor',
  'ac-motor-1ph-cap',
  'ac-motor-3ph',
  'buzzer',
  'electric-lock',
]);

const CLICK_TYPES: Record<string, { readout: string; loud: boolean }> = {
  'relay-spdt': { readout: 'closed', loud: true },
  'electric-lock': { readout: 'open', loud: true },
  switch: { readout: 'closed', loud: false },
  'push-button': { readout: 'closed', loud: false },
  'reed-switch': { readout: 'closed', loud: false },
  'switch-spdt': { readout: 'actuated', loud: false },
};

const MOTORS = new Set(['dc-motor', 'ac-motor-1ph-cap', 'ac-motor-3ph']);

/** True when the circuit has something that makes a sound worth turning on. */
export function hasSound(doc: CircuitDoc): boolean {
  return doc.elements.some((el) => SOUND_TYPES.has(el.type));
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

export class SimAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hum: Voice | null = null;
  private motor: Voice | null = null;
  private buzzer: Voice | null = null;
  private last = new Map<string, number | boolean | string>();
  private readonly clicks: { id: string; key: string; loud: boolean }[];
  private readonly motors: string[];
  private readonly buzzers: string[];
  private readonly types: Map<string, string>;

  constructor(doc: CircuitDoc) {
    this.types = new Map(doc.elements.map((el) => [el.id, el.type]));
    this.clicks = doc.elements
      .filter((el) => CLICK_TYPES[el.type])
      .map((el) => ({
        id: el.id,
        key: `${el.id}.${CLICK_TYPES[el.type]!.readout}`,
        loud: CLICK_TYPES[el.type]!.loud,
      }));
    this.motors = doc.elements.filter((el) => MOTORS.has(el.type)).map((el) => el.id);
    this.buzzers = doc.elements.filter((el) => el.type === 'buzzer').map((el) => el.id);
  }

  /** Must run from a user gesture (the sound button). */
  start() {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.25);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.hum = this.voice('sawtooth', 120, 500);
    this.motor = this.voice('sawtooth', 60, 900);
    this.buzzer = this.voice('square', 2700, 6000);
    void ctx.resume();
  }

  private voice(type: OscillatorType, freq: number, cutoff: number): Voice {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(this.master!);
    osc.start();
    return { osc, gain };
  }

  private burst(duration: number, freq: number, q: number, level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  private thump(freq: number, duration: number, level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq / 3, t + duration);
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private event(e: SimEvent) {
    const type = this.types.get(e.element);
    if (e.kind === 'damaged') {
      if (type === 'fuse') {
        this.burst(0.08, 3000, 0.8, 0.9);
        this.thump(180, 0.12, 0.5);
      } else {
        // crackle: a few short bursts
        for (let k = 0; k < 4; k++)
          setTimeout(() => this.burst(0.03, 1800 + k * 700, 2, 0.5), k * 45);
      }
    } else if (e.kind === 'tripped') {
      this.burst(0.05, 900, 1.5, 0.9);
      this.thump(120, 0.08, 0.4);
    }
  }

  private set(v: Voice | null, gain: number, freq?: number) {
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.gain.gain.setTargetAtTime(gain, t, 0.05);
    if (freq !== undefined) v.osc.frequency.setTargetAtTime(freq, t, 0.1);
  }

  /** Follows a frame; `active` is false while paused or off screen (continuous sounds fade out). */
  update(frame: SimFrame, active: boolean) {
    if (!this.ctx) return;
    for (const e of frame.events) this.event(e);
    for (const c of this.clicks) {
      const v = frame.readouts[c.key];
      const before = this.last.get(c.key);
      if (v !== undefined && before !== undefined && v !== before) {
        if (c.loud) {
          this.burst(0.025, 2500, 3, 0.9);
          this.thump(400, 0.03, 0.3);
        } else this.burst(0.015, 4000, 3, 0.45);
      }
      if (v !== undefined) this.last.set(c.key, v);
    }
    let humming = false;
    let rpm = 0;
    for (const id of this.motors) {
      if (frame.readouts[`${id}.humming`] === true) humming = true;
      const r = frame.readouts[`${id}.rpm`];
      if (typeof r === 'number') rpm = Math.max(rpm, Math.abs(r));
    }
    const sounding = this.buzzers.some((id) => frame.readouts[`${id}.sounding`] === true);
    this.set(this.hum, active && humming ? 0.12 : 0);
    this.set(this.motor, active && rpm > 30 ? Math.min(1, rpm / 1700) * 0.07 : 0, 30 + rpm / 15);
    this.set(this.buzzer, active && sounding ? 0.025 : 0);
  }

  dispose() {
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close();
  }
}
