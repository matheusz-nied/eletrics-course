/**
 * The virtual board: a Uno-like microcontroller board (5 V logic, pins 0 to
 * 13 and A0 to A5 = 14 to 19) with a fixed circuit around it:
 *
 * - D13: red LED with 220 Ω to GND (the same pin as the board's "L" LED);
 * - D9 (PWM): green LED with 220 Ω to GND;
 * - D8: passive buzzer to GND (sounds only with tone());
 * - D7: IN of a relay module (relay on with HIGH) that switches a 12 V lamp
 *   with its own supply;
 * - D2: push button to GND (no external resistor: it needs INPUT_PULLUP);
 * - A0: wiper of a 10 kΩ potentiometer between 5 V and GND;
 * - A1: LDR from 5 V to A1, 10 kΩ from A1 to GND (more light, more volts).
 *
 * Pins follow the AVR registers: DDR (output or input) and PORT (the level
 * driven, or the pull-up of an input). digitalWrite on an input turns the
 * pull-up on, exactly like the chip. Times are virtual µs.
 */
import type { WarnFn } from './diagnostico';
import { mulberry32, type BoardApi } from './interpreter';

export const PIN_COUNT = 20;
export const PWM_PINS = [3, 5, 6, 9, 10, 11];
const PWM = new Set(PWM_PINS);

export const PIN = {
  ledVermelho: 13,
  ledVerde: 9,
  buzzer: 8,
  rele: 7,
  botao: 2,
  pot: 14,
  ldr: 15,
} as const;

/** Logic supply and ADC reference (V). */
export const VCC = 5;
export const R_LED = 220;
export const VF_RED = 2.0;
export const VF_GREEN = 2.2;
/** LED current with the pin HIGH (A). */
export const I_RED = (VCC - VF_RED) / R_LED;
export const I_GREEN = (VCC - VF_GREEN) / R_LED;
/** Typical internal pull-up of the ATmega328P (Ω). */
export const R_PULLUP = 35_000;
/** LED current through the pull-up, as a fraction of the full current. */
const WEAK = (VCC - VF_RED) / (R_PULLUP + R_LED) / I_RED;
/** Uno PWM frequency on pins 5 and 6 and on the others (Hz). */
export const pwmFrequency = (pin: number) => (pin === 5 || pin === 6 ? 980 : 490);

/** LDR resistance for a light level from 0 (dark) to 1 (bright): 200 kΩ to 1 kΩ. */
export function ldrResistance(light: number): number {
  return 200_000 / Math.pow(200, Math.min(1, Math.max(0, light)));
}

/** Voltage on A1 with the LDR on top and 10 kΩ to GND (V). */
export function ldrVoltage(light: number): number {
  return (VCC * 10_000) / (10_000 + ldrResistance(light));
}

/** 10-bit ADC reading for a voltage, as the Uno: 0 to 1023. */
export function adc(volts: number): number {
  return Math.max(0, Math.min(1023, Math.floor((volts / VCC) * 1024)));
}

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** The text the program sent through Serial, as lines (capped). */
export class SerialMonitor {
  static readonly MAX_LINES = 200;
  static readonly MAX_LINE = 240;
  lines: string[] = [];
  current = '';
  /** Changes on every append or clear. */
  version = 0;
  /** Characters received since the last clear. */
  received = 0;

  append(text: string): void {
    if (!text) return;
    this.version++;
    this.received += text.length;
    const parts = text.replace(/\r/g, '').split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) this.pushLine();
      this.current += parts[i];
      while (this.current.length > SerialMonitor.MAX_LINE) {
        const head = this.current.slice(0, SerialMonitor.MAX_LINE);
        this.current = this.current.slice(SerialMonitor.MAX_LINE);
        this.lines.push(head);
      }
    }
    if (this.lines.length > SerialMonitor.MAX_LINES) {
      this.lines.splice(0, this.lines.length - SerialMonitor.MAX_LINES);
    }
  }

  private pushLine(): void {
    this.lines.push(this.current);
    this.current = '';
  }

  text(): string {
    return (this.lines.length ? this.lines.join('\n') + '\n' : '') + this.current;
  }

  clear(): void {
    this.lines = [];
    this.current = '';
    this.received = 0;
    this.version++;
  }
}

export interface BoardInputs {
  /** The D2 button is held down. */
  botao: boolean;
  /** Potentiometer position, 0 to 1. */
  pot: number;
  /** Light on the LDR, 0 (dark) to 1 (bright). */
  luz: number;
}

/** What a pin reads, for the readouts. */
export type PinReading = 'HIGH' | 'LOW' | 'flutuando';

export interface LedView {
  /** Average light over the last window, 0 to 1 (current / full current). */
  brilho: number;
  /** Lit right now (driven HIGH, or PWM above half). */
  aceso: boolean;
  /** Only the weak pull-up is lighting it. */
  fraco: boolean;
  /** Average current (A). */
  corrente: number;
  /** Hardware PWM duty, 0 to 255, or null. */
  pwm: number | null;
}

export interface BoardView {
  led13: LedView;
  led9: LedView;
  rele: boolean;
  /** Frequency on the buzzer (Hz), 0 when silent. */
  buzzerHz: number;
  /** The TX LED: the board is sending serial data. */
  tx: boolean;
  pino2: PinReading | 'saida';
  a0: { volts: number; leitura: number };
  a1: { volts: number; leitura: number };
  /** pinMode of each pin: 'OUTPUT', 'INPUT', 'INPUT_PULLUP'. */
  modos: string[];
}

export interface BoardOptions {
  warn?: WarnFn;
  seed?: number;
}

export class Board implements BoardApi {
  readonly ddr = new Uint8Array(PIN_COUNT);
  readonly port = new Uint8Array(PIN_COUNT);
  /** Hardware PWM duty (0–255) per pin, −1 when off. */
  readonly pwm = new Int16Array(PIN_COUNT).fill(-1);
  inputs: BoardInputs = { botao: false, pot: 0.5, luz: 0.7 };
  readonly monitor = new SerialMonitor();
  serialOn = false;
  baud = 9600;
  txBusyUntil = 0;
  tonePin = -1;
  toneFreq = 0;
  toneEnd = Infinity;
  warn: WarnFn;

  private readonly drive = new Float64Array(PIN_COUNT);
  private readonly acc = new Float64Array(PIN_COUNT);
  private readonly since = new Float64Array(PIN_COUNT);
  private readonly toggles = new Uint32Array(PIN_COUNT);
  private windowStart = 0;
  private rng: () => number;

  constructor(opts: BoardOptions = {}) {
    this.warn = opts.warn ?? (() => {});
    this.rng = mulberry32(opts.seed ?? 777);
  }

  /** The reset of the chip: every pin back to input, PWM, tone and serial off. */
  reset(t = 0): void {
    this.ddr.fill(0);
    this.port.fill(0);
    this.pwm.fill(-1);
    this.tonePin = -1;
    this.toneFreq = 0;
    this.toneEnd = Infinity;
    this.serialOn = false;
    this.txBusyUntil = 0;
    this.drive.fill(0);
    this.acc.fill(0);
    this.since.fill(t);
    this.toggles.fill(0);
    this.windowStart = t;
  }

  // Analog side of the pins

  private computeDrive(pin: number): number {
    if (pin === this.tonePin) return 0.5;
    if (this.ddr[pin]) return this.pwm[pin]! >= 0 ? this.pwm[pin]! / 255 : this.port[pin]!;
    return this.port[pin] ? WEAK : 0;
  }

  private update(pin: number, t: number): void {
    const d = this.computeDrive(pin);
    const old = this.drive[pin]!;
    if (d === old) return;
    this.acc[pin]! += old * (t - this.since[pin]!);
    this.since[pin] = t;
    this.drive[pin] = d;
    if (old >= 0.5 !== d >= 0.5) this.toggles[pin]!++;
  }

  private checkTone(t: number): void {
    if (this.tonePin >= 0 && t >= this.toneEnd) {
      const pin = this.tonePin;
      this.tonePin = -1;
      this.toneFreq = 0;
      this.port[pin] = 0;
      this.update(pin, this.toneEnd);
    }
  }

  /** Voltage on an input pin (V), or null when nothing sets it (floating). */
  private voltage(pin: number): number | null {
    if (pin === PIN.botao && this.inputs.botao) return 0;
    if (pin === PIN.pot) return this.inputs.pot * VCC;
    if (pin === PIN.ldr) return ldrVoltage(this.inputs.luz);
    if (this.port[pin]) return VCC;
    return null;
  }

  /** A floating input picks up hum and noise: the reading jumps around. */
  private floatingLevel(pin: number, t: number): number {
    const hum = Math.sin(2 * Math.PI * 60 * (t / 1e6) + pin);
    return hum + (this.rng() - 0.5) * 1.6 > 0 ? 1 : 0;
  }

  private validPin(pin: number, fn: string, line: number): boolean {
    if (pin >= 0 && pin < PIN_COUNT) return true;
    this.warn(
      `pino:${line}`,
      line,
      `Linha ${line}: o Uno não tem o pino ${pin}. Os pinos vão de 0 a 13, mais A0 a A5 (14 a 19). O ${fn}() foi ignorado.`,
    );
    return false;
  }

  private serialPinWarning(pin: number, line: number): void {
    if (this.serialOn && (pin === 0 || pin === 1)) {
      this.warn(
        `serial-pino:${pin}`,
        line,
        `Linha ${line}: os pinos 0 e 1 são o RX e o TX do Serial. Usá-los junto com o Serial.begin() atrapalha os dois.`,
      );
    }
  }

  // BoardApi

  pinMode(pin: number, mode: number, t: number, line: number): void {
    this.checkTone(t);
    if (!this.validPin(pin, 'pinMode', line)) return;
    if (mode === 1) {
      this.ddr[pin] = 1;
    } else if (mode === 0 || mode === 2) {
      this.ddr[pin] = 0;
      this.port[pin] = mode === 2 ? 1 : 0;
    } else {
      this.warn(
        `modo:${line}`,
        line,
        `Linha ${line}: pinMode recebeu o modo ${mode}. Use OUTPUT, INPUT ou INPUT_PULLUP.`,
      );
      return;
    }
    this.serialPinWarning(pin, line);
    this.update(pin, t);
  }

  digitalWrite(pin: number, level: number, t: number, line: number): void {
    this.checkTone(t);
    if (!this.validPin(pin, 'digitalWrite', line)) return;
    this.pwm[pin] = -1;
    if (!this.ddr[pin] && level) {
      this.warn(
        `sem-output:${pin}`,
        line,
        `Linha ${line}: o pino ${pin} não foi configurado como saída. Num pino de entrada, digitalWrite(HIGH) só liga o resistor de pull-up interno (cerca de 35 kΩ): o que estiver ligado nele recebe uma corrente bem fraquinha. Coloque pinMode(${pin}, OUTPUT); no setup().`,
      );
    }
    this.port[pin] = level ? 1 : 0;
    if (pin === PIN.botao && this.ddr[pin] && level && this.inputs.botao) this.shortWarning(line);
    this.serialPinWarning(pin, line);
    this.update(pin, t);
  }

  private shortWarning(line: number): void {
    this.warn(
      'curto-botao',
      line,
      `Linha ${line}: o pino 2 está como saída em HIGH e o botão o liga direto ao GND. Isso é um curto: numa placa de verdade a corrente passa de 40 mA e pode queimar o pino. Botão vai em pino de entrada.`,
    );
  }

  digitalRead(pin: number, t: number, line: number): number {
    this.checkTone(t);
    if (!this.validPin(pin, 'digitalRead', line)) return 0;
    if (this.ddr[pin]) {
      if (pin === PIN.botao && this.port[pin] && this.inputs.botao) this.shortWarning(line);
      return this.port[pin]!;
    }
    const v = this.voltage(pin);
    if (v === null) {
      this.warn(
        `flutuando:${pin}`,
        line,
        pin === PIN.botao
          ? `Linha ${line}: o pino 2 está "flutuando". Ele é uma entrada (INPUT), e o botão só o liga ao GND: quando o botão está solto, nada puxa o pino para 5 V, e o fio funciona como uma antena que capta ruído. A leitura fica aleatória. Use pinMode(2, INPUT_PULLUP).`
          : `Linha ${line}: o pino ${pin} é uma entrada sem nada ligado, e está "flutuando": a leitura fica aleatória, porque o fio capta ruído. Ligue algo a ele ou use INPUT_PULLUP.`,
      );
      return this.floatingLevel(pin, t);
    }
    return v > VCC / 2 ? 1 : 0;
  }

  analogRead(pin: number, t: number, line: number): number {
    this.checkTone(t);
    const p = pin <= 5 ? pin + 14 : pin;
    if (p < 14 || p >= PIN_COUNT) {
      this.warn(
        `analog-pino:${line}`,
        line,
        `Linha ${line}: analogRead só funciona nas entradas analógicas A0 a A5. O pino ${pin} é digital, e a leitura deu 0.`,
      );
      return 0;
    }
    if (this.ddr[p]) return this.port[p] ? 1023 : 0;
    const v = this.voltage(p);
    if (v === null) {
      this.warn(
        `flutuando:${p}`,
        line,
        `Linha ${line}: a entrada A${p - 14} não está ligada a nada neste circuito. A leitura fica pulando, porque o fio solto capta ruído.`,
      );
      const hum = Math.sin(2 * Math.PI * 60 * (t / 1e6) + p);
      return Math.max(0, Math.min(1023, Math.round(480 + 260 * hum + (this.rng() - 0.5) * 120)));
    }
    return adc(v);
  }

  analogWrite(pin: number, value: number, t: number, line: number): void {
    this.checkTone(t);
    if (!this.validPin(pin, 'analogWrite', line)) return;
    this.ddr[pin] = 1;
    if (value < 0 || value > 255) {
      this.warn(
        `pwm-faixa:${line}`,
        line,
        PWM.has(pin)
          ? `Linha ${line}: analogWrite vai de 0 a 255, e recebeu ${nf.format(value).replace('-', '−')}. O registrador do PWM só guarda 8 bits, então o valor virou ${value & 255}. Use map() ou constrain() para ficar na faixa.`
          : `Linha ${line}: analogWrite vai de 0 a 255, e recebeu ${nf.format(value).replace('-', '−')}.`,
      );
    }
    if (!PWM.has(pin)) {
      this.warn(
        `sem-pwm:${pin}`,
        line,
        `Linha ${line}: o pino ${pin} não tem PWM. No Uno, só os pinos 3, 5, 6, 9, 10 e 11 têm (eles vêm marcados com '~'). Num pino sem PWM, o analogWrite faz o que dá: abaixo de 128 vira LOW, e de 128 para cima vira HIGH.`,
      );
      this.pwm[pin] = -1;
      this.port[pin] = value < 128 ? 0 : 1;
    } else if (value === 0 || value === 255) {
      this.pwm[pin] = -1;
      this.port[pin] = value === 255 ? 1 : 0;
    } else {
      this.pwm[pin] = value & 255;
    }
    this.serialPinWarning(pin, line);
    this.update(pin, t);
  }

  tone(pin: number, freq: number, duration: number | undefined, t: number, line: number): void {
    this.checkTone(t);
    if (!this.validPin(pin, 'tone', line)) return;
    if (this.tonePin >= 0 && this.tonePin !== pin) {
      this.warn(
        `tone-outro:${line}`,
        line,
        `Linha ${line}: o pino ${this.tonePin} já está tocando. O tone() só toca num pino por vez; chame noTone(${this.tonePin}) antes.`,
      );
      return;
    }
    if (freq < 31) {
      this.warn(
        `tone-grave:${line}`,
        line,
        `Linha ${line}: o tone() do Uno vai de 31 Hz para cima; ${freq} Hz é grave demais.`,
      );
    }
    this.ddr[pin] = 1;
    this.pwm[pin] = -1;
    const prev = this.tonePin;
    this.tonePin = pin;
    this.toneFreq = Math.max(31, freq);
    this.toneEnd = duration && duration > 0 ? t + duration * 1000 : Infinity;
    if (prev !== pin) this.update(pin, t);
  }

  noTone(pin: number, t: number, line: number): void {
    this.checkTone(t);
    if (!this.validPin(pin, 'noTone', line)) return;
    if (this.tonePin !== pin) return;
    this.tonePin = -1;
    this.toneFreq = 0;
    this.port[pin] = 0;
    this.update(pin, t);
  }

  serialBegin(baud: number, t: number): void {
    void t;
    this.serialOn = baud > 0;
    if (baud > 0) this.baud = baud;
  }

  serialWrite(text: string, t: number, line: number): number {
    if (!this.serialOn) {
      this.warn(
        'serial-sem-begin',
        line,
        `Linha ${line}: o Serial.print() foi chamado sem Serial.begin(), e nada chega ao monitor. Coloque Serial.begin(9600); no setup().`,
      );
      return 0;
    }
    this.monitor.append(text);
    const charTime = 1e7 / this.baud;
    const start = Math.max(t, this.txBusyUntil);
    this.txBusyUntil = start + text.length * charTime;
    const backlog = this.txBusyUntil - t;
    return Math.max(0, backlog - 64 * charTime);
  }

  serialFlush(t: number): number {
    return Math.max(0, this.txBusyUntil - t);
  }

  // Readouts

  /**
   * The state of the circuit at time t, with the LED brightness averaged
   * since the previous call (so fast blinking or software PWM looks dim).
   */
  view(t: number): BoardView {
    this.checkTone(t);
    const window = t - this.windowStart;
    const avg = new Float64Array(PIN_COUNT);
    const toggles = new Uint32Array(this.toggles);
    for (let p = 0; p < PIN_COUNT; p++) {
      this.acc[p]! += this.drive[p]! * (t - this.since[p]!);
      avg[p] = window > 0 ? this.acc[p]! / window : this.drive[p]!;
      this.acc[p] = 0;
      this.since[p] = t;
    }
    this.toggles.fill(0);
    this.windowStart = t;

    const led = (pin: number, full: number): LedView => {
      const brilho = Math.min(1, Math.max(0, avg[pin]!));
      return {
        brilho,
        aceso: this.drive[pin]! >= 0.5,
        fraco: !this.ddr[pin] && this.port[pin] === 1,
        corrente: brilho * full,
        pwm: this.ddr[pin] && this.pwm[pin]! >= 0 ? this.pwm[pin]! : null,
      };
    };

    let buzzerHz = 0;
    if (this.tonePin === PIN.buzzer) buzzerHz = this.toneFreq;
    else if (this.ddr[PIN.buzzer] && window > 0) {
      const hz = toggles[PIN.buzzer]! / 2 / (window / 1e6);
      if (hz >= 20) buzzerHz = Math.round(hz);
    }

    let pino2: BoardView['pino2'];
    if (this.ddr[PIN.botao]) pino2 = 'saida';
    else {
      const v = this.voltage(PIN.botao);
      pino2 = v === null ? 'flutuando' : v > VCC / 2 ? 'HIGH' : 'LOW';
    }

    const a0v = this.inputs.pot * VCC;
    const a1v = ldrVoltage(this.inputs.luz);
    return {
      led13: led(PIN.ledVermelho, I_RED),
      led9: led(PIN.ledVerde, I_GREEN),
      rele: this.ddr[PIN.rele] === 1 && this.drive[PIN.rele]! >= 0.5,
      buzzerHz,
      tx: t < this.txBusyUntil,
      pino2,
      a0: { volts: a0v, leitura: adc(a0v) },
      a1: { volts: a1v, leitura: adc(a1v) },
      modos: Array.from({ length: PIN_COUNT }, (_, p) =>
        this.ddr[p] ? 'OUTPUT' : this.port[p] ? 'INPUT_PULLUP' : 'INPUT',
      ),
    };
  }
}
