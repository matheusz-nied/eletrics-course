/**
 * Sound of the passive buzzer: a quiet square wave from the Web Audio API.
 * The AudioContext is created only by `ligar()`, which the widget calls from
 * the click on the "Som" switch (browsers only allow audio after a gesture).
 */
export class SomBuzzer {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private freq = 0;

  get disponivel(): boolean {
    return typeof window !== 'undefined' && 'AudioContext' in window;
  }

  ligar(): void {
    if (!this.disponivel) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'square';
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.osc.connect(this.gain).connect(this.ctx.destination);
      this.osc.start();
    }
    void this.ctx.resume();
  }

  /** Plays `hz`, or silence with 0. */
  tocar(hz: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.osc || !this.gain || hz === this.freq) return;
    this.freq = hz;
    const now = ctx.currentTime;
    if (hz > 0) this.osc.frequency.setTargetAtTime(Math.min(hz, 8000), now, 0.003);
    this.gain.gain.setTargetAtTime(hz > 0 ? 0.04 : 0, now, 0.01);
  }

  desligar(): void {
    this.tocar(0);
    void this.ctx?.suspend();
  }

  fechar(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    this.freq = 0;
  }
}
