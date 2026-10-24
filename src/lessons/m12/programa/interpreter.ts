/**
 * Runs a compiled program (checker.ts) on a board, in virtual time.
 *
 * The interpreter walks the syntax tree. Statements that contain loops,
 * blocks or calls that may suspend run as generators; simple statements run
 * as plain functions. The machine suspends (yields) after any statement or
 * loop iteration once the virtual clock reaches the host's target or the
 * host's operation budget runs out, so `delay(1000)` only moves the clock
 * forward and `while (true) {}` never freezes the page.
 *
 * Virtual time model (µs of the simulated Uno), see COST:
 * - every executed statement, and every test of a loop condition, costs 1 µs;
 * - calling a function of the program costs 2 µs more (call and return);
 * - each Arduino function has its own cost (digitalWrite 4 µs, analogRead
 *   112 µs as the Uno's ADC, millis 2 µs…);
 * - Serial.print costs 6 µs of CPU per character and also waits while the
 *   64-byte transmit buffer is full (each character takes 10 bits at the
 *   chosen baud rate: about 1 ms at 9600);
 * - delay(ms) and delayMicroseconds(us) add exactly their time.
 * A real Uno runs simple statements faster (16 MHz), but the order of
 * magnitude is right and the model keeps loops without delay advancing.
 */
import type { CompiledProgram } from './checker';
import type { Expr, FunctionDecl, Stmt, TypeName, ValueType } from './ast';
import { ProgramError, type WarnFn } from './diagnostico';
import { RANGE, TYPE_LABEL, conv, isInteger } from './tipos';

/** Virtual cost of each operation, in µs. */
export const COST = {
  statement: 1,
  call: 2,
  loopCall: 1,
  pinMode: 3,
  digitalWrite: 4,
  digitalRead: 4,
  analogRead: 112,
  analogWrite: 6,
  millis: 2,
  micros: 2,
  map: 4,
  math: 1,
  float: 30,
  random: 10,
  tone: 10,
  noTone: 5,
  serialBegin: 20,
  serialChar: 6,
} as const;

/** Nested calls before the stack "overflows" (the Uno has 2 KB of RAM). */
export const MAX_DEPTH = 100;

/** What the program sees of the board. Times are virtual µs. */
export interface BoardApi {
  pinMode(pin: number, mode: number, t: number, line: number): void;
  digitalWrite(pin: number, level: number, t: number, line: number): void;
  digitalRead(pin: number, t: number, line: number): number;
  analogRead(pin: number, t: number, line: number): number;
  analogWrite(pin: number, value: number, t: number, line: number): void;
  tone(pin: number, freq: number, duration: number | undefined, t: number, line: number): void;
  noTone(pin: number, t: number, line: number): void;
  serialBegin(baud: number, t: number): void;
  /** Sends text; returns how long the CPU waits for the transmit buffer (µs). */
  serialWrite(text: string, t: number, line: number): number;
  /** Time until everything sent has left (µs). */
  serialFlush(t: number): number;
}

const NORMAL = 0;
const BREAK = 1;
const CONTINUE = 2;
const RETURN = 3;
type Completion = 0 | 1 | 2 | 3;
type Gen<T> = Generator<void, T, void>;

export type RunStop = 'tempo' | 'limite' | 'erro';

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const fmt = (v: number) => nf.format(v).replace('-', '−');

/** Deterministic PRNG (mulberry32), so tests and runs repeat. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MachineOptions {
  warn?: WarnFn;
  seed?: number;
}

export class Machine {
  /** Virtual clock (µs since the board started). */
  time = 0;
  /** Statements and calls executed. */
  ops = 0;
  /** Times loop() has started. */
  loops = 0;
  /** Calls to delay() or delayMicroseconds(). */
  delays = 0;
  /** Virtual time of the last delay() call. */
  lastDelayAt = 0;
  status: 'rodando' | 'erro' = 'rodando';
  error: ProgramError | null = null;
  /** Line of the statement being executed. */
  line = 0;

  private until = 0;
  private opLimit = 0;
  private readonly globals: number[];
  private frame: number[] = [];
  private retType: TypeName = 'void';
  private retVal = 0;
  private depth = 0;
  private rng: () => number;
  private readonly gen: Gen<void>;
  private readonly warnFn: WarnFn;

  constructor(
    private readonly program: CompiledProgram,
    private readonly board: BoardApi,
    opts: MachineOptions = {},
  ) {
    this.globals = new Array<number>(program.globalsSize).fill(0);
    this.rng = mulberry32(opts.seed ?? 12345);
    this.warnFn = opts.warn ?? (() => {});
    this.gen = this.main();
  }

  /**
   * Runs until the virtual clock reaches `untilUs` ('tempo'), the budget of
   * `maxOps` operations runs out ('limite') or the program stops with an
   * error ('erro').
   */
  run(untilUs: number, maxOps = Infinity): RunStop {
    if (this.status === 'erro') return 'erro';
    if (this.time >= untilUs) return 'tempo';
    this.until = untilUs;
    this.opLimit = this.ops + maxOps;
    try {
      this.gen.next();
    } catch (e) {
      if (!(e instanceof ProgramError)) throw e;
      this.status = 'erro';
      this.error = e;
      return 'erro';
    }
    return this.time >= untilUs ? 'tempo' : 'limite';
  }

  private get pausing(): boolean {
    return this.time >= this.until || this.ops >= this.opLimit;
  }

  private fail(line: number, message: string): never {
    throw new ProgramError(message, line, 1);
  }

  private warn(key: string, line: number, message: string): void {
    this.warnFn(key, line, message);
  }

  private *main(): Gen<void> {
    for (const s of this.program.staticInits) this.globals[s.slot] = s.value;
    for (const g of this.program.ast.globals) {
      for (const d of g.decls) {
        if (d.ref?.kind !== 'global') continue;
        let v = 0;
        if (d.init) v = d.init.yields ? yield* this.evg(d.init) : this.ev(d.init);
        this.globals[d.ref.slot] = this.store(v, g.type, d.line, d.name);
      }
    }
    yield* this.invoke(this.program.setup, []);
    for (;;) {
      this.loops++;
      this.ops++;
      this.time += COST.loopCall;
      yield* this.invoke(this.program.loop, []);
      if (this.pausing) yield;
    }
  }

  private *invoke(f: FunctionDecl, args: number[]): Gen<number> {
    if (this.depth >= MAX_DEPTH) {
      this.fail(
        this.line || f.line,
        `A pilha estourou na linha ${this.line || f.line}: as chamadas de função se acumularam mais de ${MAX_DEPTH} vezes sem voltar (a função '${f.name}' chama a si mesma sem parar?). O Uno tem só 2 KB de memória RAM; numa placa de verdade o programa travaria ou reiniciaria sozinho.`,
      );
    }
    const frame = new Array<number>(f.frameSize ?? 0).fill(0);
    f.params.forEach((p, i) => {
      frame[f.paramSlots![i]!] = this.store(args[i] ?? 0, p.type, this.line, p.name);
    });
    const savedFrame = this.frame;
    const savedRet = this.retType;
    this.frame = frame;
    this.retType = f.ret;
    this.depth++;
    this.ops++;
    this.time += COST.call;
    const c = yield* this.block(f.body!.body);
    const v = c === RETURN ? this.retVal : 0;
    this.frame = savedFrame;
    this.retType = savedRet;
    this.depth--;
    return f.ret === 'void' ? 0 : v;
  }

  // Statements

  private *block(body: Stmt[]): Gen<Completion> {
    for (let i = 0; i < body.length; i++) {
      const s = body[i]!;
      const c = s.sync ? this.leaf(s) : yield* this.stmt(s);
      if (c !== NORMAL) return c;
      if (this.pausing) yield;
    }
    return NORMAL;
  }

  private tick(line: number): void {
    this.line = line;
    this.ops++;
    this.time += COST.statement;
  }

  /** A statement without loops or suspension. */
  private leaf(s: Stmt): Completion {
    this.tick(s.line);
    switch (s.k) {
      case 'expr':
        this.ev(s.expr);
        return NORMAL;
      case 'decl':
        if (s.isStatic) return NORMAL;
        for (const d of s.decls) {
          if (d.ref?.kind !== 'local') continue;
          this.frame[d.ref.slot] = d.init ? this.store(this.ev(d.init), s.type, d.line, d.name) : 0;
        }
        return NORMAL;
      case 'return':
        this.retVal = s.value ? this.returned(this.ev(s.value), s.line) : 0;
        return RETURN;
      case 'break':
        return BREAK;
      case 'continue':
        return CONTINUE;
      default:
        return NORMAL;
    }
  }

  private returned(v: number, line: number): number {
    return this.retType === 'void' ? 0 : this.store(v, this.retType, line, 'o valor devolvido');
  }

  private *sub(s: Stmt): Gen<Completion> {
    return s.sync ? this.leaf(s) : yield* this.stmt(s);
  }

  private *stmt(s: Stmt): Gen<Completion> {
    switch (s.k) {
      case 'block':
        return yield* this.block(s.body);
      case 'expr':
        this.tick(s.line);
        if (s.expr.yields) yield* this.evg(s.expr);
        else this.ev(s.expr);
        return NORMAL;
      case 'decl':
        this.tick(s.line);
        if (s.isStatic) return NORMAL;
        for (const d of s.decls) {
          if (d.ref?.kind !== 'local') continue;
          let v = 0;
          if (d.init) v = d.init.yields ? yield* this.evg(d.init) : this.ev(d.init);
          this.frame[d.ref.slot] = this.store(v, s.type, d.line, d.name);
        }
        return NORMAL;
      case 'return': {
        this.tick(s.line);
        const v = s.value ? (s.value.yields ? yield* this.evg(s.value) : this.ev(s.value)) : 0;
        this.retVal = this.returned(v, s.line);
        return RETURN;
      }
      case 'if': {
        this.tick(s.line);
        const t = s.test.yields ? yield* this.evg(s.test) : this.ev(s.test);
        if (t !== 0) return s.then.sync ? this.leaf(s.then) : yield* this.stmt(s.then);
        if (s.else) return s.else.sync ? this.leaf(s.else) : yield* this.stmt(s.else);
        return NORMAL;
      }
      case 'while':
        for (;;) {
          this.tick(s.line);
          const t = s.test.yields ? yield* this.evg(s.test) : this.ev(s.test);
          if (t === 0) return NORMAL;
          const c = s.body.sync ? this.leaf(s.body) : yield* this.stmt(s.body);
          if (c === BREAK) return NORMAL;
          if (c === RETURN) return c;
          if (this.pausing) yield;
        }
      case 'do':
        for (;;) {
          const c = s.body.sync ? this.leaf(s.body) : yield* this.stmt(s.body);
          if (c === BREAK) return NORMAL;
          if (c === RETURN) return c;
          this.tick(s.line);
          const t = s.test.yields ? yield* this.evg(s.test) : this.ev(s.test);
          if (t === 0) return NORMAL;
          if (this.pausing) yield;
        }
      case 'for': {
        if (s.init) {
          const c = yield* this.sub(s.init);
          if (c !== NORMAL) return c;
        }
        for (;;) {
          this.tick(s.line);
          if (s.test) {
            const t = s.test.yields ? yield* this.evg(s.test) : this.ev(s.test);
            if (t === 0) return NORMAL;
          }
          const c = s.body.sync ? this.leaf(s.body) : yield* this.stmt(s.body);
          if (c === BREAK) return NORMAL;
          if (c === RETURN) return c;
          if (s.update) {
            if (s.update.yields) yield* this.evg(s.update);
            else this.ev(s.update);
          }
          if (this.pausing) yield;
        }
      }
      case 'switch': {
        this.tick(s.line);
        const v = s.disc.yields ? yield* this.evg(s.disc) : this.ev(s.disc);
        let start = -1;
        for (const l of s.labels) {
          if (l.value !== null && l.resolved === v) {
            start = l.index;
            break;
          }
        }
        if (start < 0) start = s.labels.find((l) => l.value === null)?.index ?? -1;
        if (start < 0) return NORMAL;
        for (let i = start; i < s.body.length; i++) {
          const b = s.body[i]!;
          const c = b.sync ? this.leaf(b) : yield* this.stmt(b);
          if (c === BREAK) return NORMAL;
          if (c !== NORMAL) return c;
          if (this.pausing) yield;
        }
        return NORMAL;
      }
      default:
        return this.leaf(s);
    }
  }

  // Values

  /** Converts a value to the type of the variable that receives it, warning on overflow. */
  private store(v: number, t: ValueType | TypeName, line: number, name: string): number {
    if (t === 'void') return 0;
    const r = conv(v, t);
    if (r !== v && isInteger(t) && t !== 'bool' && Number.isInteger(v)) {
      const [lo, hi] = RANGE[t];
      this.warn(
        `overflow:${line}:${name}`,
        line,
        `Linha ${line}: o valor ${fmt(v)} não cabe em '${name}' (${TYPE_LABEL[t]}, de ${fmt(lo)} a ${fmt(hi)} no Uno) e virou ${fmt(r)}. Use um tipo maior, como long ou unsigned long.`,
      );
    }
    return r;
  }

  private read(e: Expr & { k: 'name' }): number {
    const r = e.ref!;
    if (r.kind === 'local') return this.frame[r.slot]!;
    if (r.kind === 'global') return this.globals[r.slot]!;
    return r.value;
  }

  private write(e: Expr, v: number): void {
    const r = (e as Expr & { k: 'name' }).ref!;
    if (r.kind === 'local') this.frame[r.slot] = v;
    else if (r.kind === 'global') this.globals[r.slot] = v;
  }

  private ev(e: Expr): number {
    switch (e.k) {
      case 'num':
        return e.value;
      case 'name':
        return this.read(e);
      case 'unary':
        return this.unary(e, this.ev(e.arg));
      case 'update': {
        const target = e.target as Expr & { k: 'name' };
        const old = this.read(target);
        const nv = conv(e.op === '++' ? old + 1 : old - 1, target.valueType!);
        this.write(target, nv);
        return e.prefix ? nv : old;
      }
      case 'binary':
        return this.binop(e, e.op, this.ev(e.left), this.ev(e.right), e.opType!);
      case 'logical':
        if (e.op === '&&') return this.ev(e.left) !== 0 && this.ev(e.right) !== 0 ? 1 : 0;
        return this.ev(e.left) !== 0 || this.ev(e.right) !== 0 ? 1 : 0;
      case 'assign':
        return this.assign(e, this.ev(e.value));
      case 'cond':
        return conv(this.ev(e.test) !== 0 ? this.ev(e.then) : this.ev(e.else), e.type as ValueType);
      case 'cast':
        return conv(this.ev(e.arg), e.to);
      case 'call':
        return this.builtin(
          e,
          e.args.map((a) => this.ev(a)),
        );
      case 'method':
        return this.serial(
          e,
          e.args.map((a) => (a.type === 'str' ? this.str(a) : this.ev(a))),
        );
      case 'str':
        return 0;
    }
  }

  /** The text of a string expression: "texto", F("texto") or a ?: between texts. */
  private str(e: Expr): string {
    if (e.k === 'str') return e.value;
    if (e.k === 'call') return this.str(e.args[0]!);
    if (e.k === 'cond') return this.ev(e.test) !== 0 ? this.str(e.then) : this.str(e.else);
    return '';
  }

  private *evg(e: Expr): Gen<number> {
    switch (e.k) {
      case 'call': {
        const args: number[] = [];
        for (const a of e.args) args.push(a.yields ? yield* this.evg(a) : this.ev(a));
        if (e.fn) {
          this.line = e.line;
          return yield* this.invoke(e.fn, args);
        }
        if (e.builtin === 'delay' || e.builtin === 'delayMicroseconds') {
          this.wait(e, args[0]!);
          if (this.pausing) yield;
          return 0;
        }
        return this.builtin(e, args);
      }
      case 'method': {
        const args: (number | string)[] = [];
        for (const a of e.args) {
          args.push(a.type === 'str' ? this.str(a) : a.yields ? yield* this.evg(a) : this.ev(a));
        }
        return this.serial(e, args);
      }
      case 'unary':
        return this.unary(e, yield* this.evg(e.arg));
      case 'binary': {
        const a = e.left.yields ? yield* this.evg(e.left) : this.ev(e.left);
        const b = e.right.yields ? yield* this.evg(e.right) : this.ev(e.right);
        return this.binop(e, e.op, a, b, e.opType!);
      }
      case 'logical': {
        const a = e.left.yields ? yield* this.evg(e.left) : this.ev(e.left);
        if (e.op === '&&' && a === 0) return 0;
        if (e.op === '||' && a !== 0) return 1;
        const b = e.right.yields ? yield* this.evg(e.right) : this.ev(e.right);
        return b !== 0 ? 1 : 0;
      }
      case 'assign':
        return this.assign(e, yield* this.evg(e.value));
      case 'cond': {
        const t = e.test.yields ? yield* this.evg(e.test) : this.ev(e.test);
        const branch = t !== 0 ? e.then : e.else;
        const v = branch.yields ? yield* this.evg(branch) : this.ev(branch);
        return conv(v, e.type as ValueType);
      }
      case 'cast':
        return conv(yield* this.evg(e.arg), e.to);
      default:
        return this.ev(e);
    }
  }

  private wait(e: Expr & { k: 'call' }, arg: number): void {
    const micro = e.builtin === 'delayMicroseconds';
    const v = conv(arg, micro ? 'uint' : 'ulong');
    if (arg < 0) {
      this.warn(
        `delay-negativo:${e.line}`,
        e.line,
        `Linha ${e.line}: ${e.builtin}() recebeu ${fmt(arg)}. Ele não aceita negativos: o valor virou ${fmt(v)}${micro ? ' µs' : ' ms'}${micro ? '' : ' (cerca de 49 dias)'}.`,
      );
    }
    this.ops++;
    this.time += micro ? v : v * 1000;
    this.delays++;
    this.lastDelayAt = this.time;
  }

  private unary(e: Expr & { k: 'unary' }, v: number): number {
    const t = e.type as ValueType;
    switch (e.op) {
      case '-':
        return conv(-v, t);
      case '+':
        return conv(v, t);
      case '!':
        return v === 0 ? 1 : 0;
      case '~':
        return conv(~v, t);
    }
  }

  private assign(e: Expr & { k: 'assign' }, v: number): number {
    const target = e.target as Expr & { k: 'name' };
    const t = target.valueType!;
    let r = v;
    if (e.op !== '=') r = this.binop(e, e.op.slice(0, -1), this.read(target), v, e.opType!);
    const stored = this.store(r, t, e.line, target.name);
    this.write(target, stored);
    return stored;
  }

  private binop(e: Expr, op: string, a0: number, b0: number, t: ValueType): number {
    if (op === '<<' || op === '>>') {
      const a = conv(a0, t);
      const b = b0;
      if (b < 0 || b >= 32) return 0;
      return conv(op === '<<' ? a << b : t === 'ulong' || t === 'uint' ? a >>> b : a >> b, t);
    }
    const a = conv(a0, t);
    const b = conv(b0, t);
    let r: number;
    switch (op) {
      case '+':
        r = a + b;
        break;
      case '-':
        r = a - b;
        break;
      case '*':
        if (t === 'long' || t === 'ulong') {
          // Exact low 32 bits, as the chip computes them.
          const exact = a * b;
          if (t === 'long' && (exact > 2147483647 || exact < -2147483648)) {
            this.overflow(e, exact, t);
          }
          return conv(Math.imul(a, b), t);
        }
        r = a * b;
        break;
      case '/':
        if (isInteger(t)) {
          if (b === 0) this.divisionByZero(e);
          r = Math.trunc(a / b);
        } else {
          r = a / b;
        }
        break;
      case '%':
        if (b === 0) this.divisionByZero(e);
        r = a % b;
        break;
      case '&':
        r = a & b;
        break;
      case '|':
        r = a | b;
        break;
      case '^':
        r = a ^ b;
        break;
      case '==':
        return a === b ? 1 : 0;
      case '!=':
        return a !== b ? 1 : 0;
      case '<':
        return a < b ? 1 : 0;
      case '>':
        return a > b ? 1 : 0;
      case '<=':
        return a <= b ? 1 : 0;
      case '>=':
        return a >= b ? 1 : 0;
      default:
        r = 0;
    }
    const out = conv(r, t);
    if (out !== r && (t === 'int' || t === 'long') && (op === '+' || op === '-' || op === '*')) {
      this.overflow(e, r, t);
    }
    return out;
  }

  private overflow(e: Expr, r: number, t: ValueType): void {
    const [lo, hi] = RANGE[t];
    this.warn(
      `conta:${e.line}`,
      e.line,
      `Linha ${e.line}: a conta deu ${fmt(r)}, que não cabe num ${TYPE_LABEL[t]} (no Uno vai de ${fmt(lo)} a ${fmt(hi)}), e o resultado virou ${fmt(conv(r, t))}. Use long nas variáveis dessa conta, ou escreva o número como 1000L.`,
    );
  }

  private divisionByZero(e: Expr): never {
    this.fail(
      e.line,
      `Divisão por zero na linha ${e.line}: o divisor vale 0. Num Arduino de verdade o resultado seria um número sem sentido; aqui o programa para, para você ver o problema.`,
    );
  }

  private builtin(e: Expr & { k: 'call' }, a: number[]): number {
    const b = this.board;
    const line = e.line;
    this.line = line;
    this.ops++;
    const pin = () => conv(a[0]!, 'byte');
    switch (e.builtin) {
      case 'pinMode':
        this.time += COST.pinMode;
        b.pinMode(pin(), conv(a[1]!, 'byte'), this.time, line);
        return 0;
      case 'digitalWrite':
        this.time += COST.digitalWrite;
        b.digitalWrite(pin(), a[1] === 0 ? 0 : 1, this.time, line);
        return 0;
      case 'digitalRead':
        this.time += COST.digitalRead;
        return b.digitalRead(pin(), this.time, line);
      case 'analogRead':
        this.time += COST.analogRead;
        return b.analogRead(pin(), this.time, line);
      case 'analogWrite':
        this.time += COST.analogWrite;
        b.analogWrite(pin(), conv(a[1]!, 'int'), this.time, line);
        return 0;
      case 'millis':
        this.time += COST.millis;
        return conv(Math.floor(this.time / 1000), 'ulong');
      case 'micros':
        this.time += COST.micros;
        return conv(Math.floor(this.time / 4) * 4, 'ulong');
      case 'map': {
        this.time += COST.map;
        const [x, inMin, inMax, outMin, outMax] = a.map((v) => conv(v, 'long')) as [
          number,
          number,
          number,
          number,
          number,
        ];
        const span = conv(inMax - inMin, 'long');
        if (span === 0) {
          this.fail(
            line,
            `Na linha ${line}, o map() recebeu o mesmo número no começo e no fim da faixa de entrada (${fmt(inMin)}), e isso dá uma divisão por zero.`,
          );
        }
        const prod = Math.imul(conv(x - inMin, 'long'), conv(outMax - outMin, 'long'));
        return conv(Math.trunc(prod / span) + outMin, 'long');
      }
      case 'constrain': {
        this.time += COST.math;
        const t = e.type as ValueType;
        const [x, lo, hi] = a.map((v) => conv(v, t)) as [number, number, number];
        return x < lo ? lo : x > hi ? hi : x;
      }
      case 'min':
      case 'max': {
        this.time += COST.math;
        const t = e.type as ValueType;
        const x = conv(a[0]!, t);
        const y = conv(a[1]!, t);
        return e.builtin === 'min' ? (x < y ? x : y) : x > y ? x : y;
      }
      case 'abs':
        this.time += COST.math;
        return conv(Math.abs(a[0]!), e.type as ValueType);
      case 'sq':
        this.time += COST.math;
        return conv(a[0]! * a[0]!, e.type as ValueType);
      case 'sqrt':
        this.time += COST.float;
        return Math.fround(Math.sqrt(a[0]!));
      case 'pow':
        this.time += COST.float;
        return Math.fround(Math.pow(a[0]!, a[1]!));
      case 'random': {
        this.time += COST.random;
        const r = () => Math.floor(this.rng() * 0x80000000);
        if (a.length === 1) {
          const max = conv(a[0]!, 'long');
          return max <= 0 ? 0 : r() % max;
        }
        const lo = conv(a[0]!, 'long');
        const hi = conv(a[1]!, 'long');
        if (lo >= hi) return lo;
        return conv(lo + (r() % (hi - lo)), 'long');
      }
      case 'randomSeed':
        this.time += COST.random;
        if (a[0] !== 0) this.rng = mulberry32(conv(a[0]!, 'ulong'));
        return 0;
      case 'tone':
        this.time += COST.tone;
        b.tone(
          pin(),
          conv(a[1]!, 'uint'),
          a.length > 2 ? conv(a[2]!, 'ulong') : undefined,
          this.time,
          line,
        );
        return 0;
      case 'noTone':
        this.time += COST.noTone;
        b.noTone(pin(), this.time, line);
        return 0;
      default:
        return 0;
    }
  }

  private serial(e: Expr & { k: 'method' }, a: (number | string)[]): number {
    this.line = e.line;
    this.ops++;
    switch (e.method) {
      case 'begin':
        this.time += COST.serialBegin;
        this.board.serialBegin(conv(a[0] as number, 'ulong'), this.time);
        return 0;
      case 'flush':
        this.time += this.board.serialFlush(this.time);
        return 0;
      case 'end':
        this.board.serialBegin(0, this.time);
        return 0;
      default: {
        let text = a.length > 0 ? this.format(e.args[0]!, a[0]!, a[1] as number | undefined) : '';
        if (e.method === 'println') text += '\r\n';
        this.time += text.length * COST.serialChar;
        this.time += this.board.serialWrite(text, this.time, e.line);
        return 0;
      }
    }
  }

  /** What Serial.print sends for a value, as the Arduino core formats it. */
  private format(arg: Expr, v: number | string, extra: number | undefined): string {
    if (typeof v === 'string') return v;
    const t = arg.type as ValueType;
    if (t === 'float') {
      const digits = extra === undefined ? 2 : Math.max(0, Math.min(10, extra));
      if (Number.isNaN(v)) return 'nan';
      if (!Number.isFinite(v)) return 'inf';
      if (Math.abs(v) > 4294967040) return 'ovf';
      return v.toFixed(digits);
    }
    if (t === 'char' && extra === undefined) return String.fromCharCode(v & 0xff);
    const base = extra === undefined ? 10 : extra;
    if (base === 10) return String(v);
    if (base < 2 || base > 36) return String(v);
    return (v >>> 0).toString(base).toUpperCase();
  }
}
