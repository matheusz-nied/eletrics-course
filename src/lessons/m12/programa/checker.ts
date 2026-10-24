/**
 * Semantic pass and the `compile()` entry point: resolves every name to a
 * slot or a constant, gives each expression its Uno type, checks calls to
 * the Arduino functions, and marks what may suspend (delay, user functions)
 * so the interpreter only builds generators where it needs them.
 */
import type {
  BlockStmt,
  DeclStmt,
  Expr,
  ExprType,
  FunctionDecl,
  ProgramAst,
  Ref,
  Stmt,
  TypeName,
  ValueType,
} from './ast';
import { ProgramError, didYouMean, type Diagnostic } from './diagnostico';
import { lex } from './lexer';
import { parse } from './parser';
import { RANGE, TYPE_LABEL, common, conv, isInteger, promote } from './tipos';

/** Arduino constants (values of the Uno core). */
export const CONSTANTS: Record<string, { value: number; type: ValueType }> = {
  HIGH: { value: 1, type: 'int' },
  LOW: { value: 0, type: 'int' },
  INPUT: { value: 0, type: 'int' },
  OUTPUT: { value: 1, type: 'int' },
  INPUT_PULLUP: { value: 2, type: 'int' },
  LED_BUILTIN: { value: 13, type: 'int' },
  A0: { value: 14, type: 'int' },
  A1: { value: 15, type: 'int' },
  A2: { value: 16, type: 'int' },
  A3: { value: 17, type: 'int' },
  A4: { value: 18, type: 'int' },
  A5: { value: 19, type: 'int' },
  DEC: { value: 10, type: 'int' },
  HEX: { value: 16, type: 'int' },
  OCT: { value: 8, type: 'int' },
  BIN: { value: 2, type: 'int' },
  PI: { value: Math.fround(Math.PI), type: 'float' },
  HALF_PI: { value: Math.fround(Math.PI / 2), type: 'float' },
  TWO_PI: { value: Math.fround(Math.PI * 2), type: 'float' },
};

type Ret = TypeName | 'arith' | 'arg0' | 'str';

interface BuiltinSpec {
  min: number;
  max: number;
  ret: Ret;
  /** How it is written, for messages. */
  usage: string;
  yields?: boolean;
}

/** The Arduino functions the simulator knows. */
export const BUILTINS: Record<string, BuiltinSpec> = {
  pinMode: { min: 2, max: 2, ret: 'void', usage: 'pinMode(pino, OUTPUT)' },
  digitalWrite: { min: 2, max: 2, ret: 'void', usage: 'digitalWrite(pino, HIGH)' },
  digitalRead: { min: 1, max: 1, ret: 'int', usage: 'digitalRead(pino)' },
  analogRead: { min: 1, max: 1, ret: 'int', usage: 'analogRead(A0)' },
  analogWrite: { min: 2, max: 2, ret: 'void', usage: 'analogWrite(pino, valor de 0 a 255)' },
  delay: { min: 1, max: 1, ret: 'void', usage: 'delay(milissegundos)', yields: true },
  delayMicroseconds: {
    min: 1,
    max: 1,
    ret: 'void',
    usage: 'delayMicroseconds(microssegundos)',
    yields: true,
  },
  millis: { min: 0, max: 0, ret: 'ulong', usage: 'millis()' },
  micros: { min: 0, max: 0, ret: 'ulong', usage: 'micros()' },
  map: { min: 5, max: 5, ret: 'long', usage: 'map(valor, deMin, deMax, paraMin, paraMax)' },
  constrain: { min: 3, max: 3, ret: 'arith', usage: 'constrain(valor, minimo, maximo)' },
  min: { min: 2, max: 2, ret: 'arith', usage: 'min(a, b)' },
  max: { min: 2, max: 2, ret: 'arith', usage: 'max(a, b)' },
  abs: { min: 1, max: 1, ret: 'arg0', usage: 'abs(valor)' },
  sq: { min: 1, max: 1, ret: 'arg0', usage: 'sq(valor)' },
  sqrt: { min: 1, max: 1, ret: 'float', usage: 'sqrt(valor)' },
  pow: { min: 2, max: 2, ret: 'float', usage: 'pow(base, expoente)' },
  random: { min: 1, max: 2, ret: 'long', usage: 'random(minimo, maximo)' },
  randomSeed: { min: 1, max: 1, ret: 'void', usage: 'randomSeed(semente)' },
  tone: { min: 2, max: 3, ret: 'void', usage: 'tone(pino, frequência, duração)' },
  noTone: { min: 1, max: 1, ret: 'void', usage: 'noTone(pino)' },
  F: { min: 1, max: 1, ret: 'str', usage: 'F("texto")' },
};

const SERIAL_METHODS: Record<string, BuiltinSpec> = {
  begin: { min: 1, max: 2, ret: 'void', usage: 'Serial.begin(9600)' },
  print: { min: 1, max: 2, ret: 'void', usage: 'Serial.print(valor)' },
  println: { min: 0, max: 2, ret: 'void', usage: 'Serial.println(valor)' },
  end: { min: 0, max: 0, ret: 'void', usage: 'Serial.end()' },
  flush: { min: 0, max: 0, ret: 'void', usage: 'Serial.flush()' },
};

export interface StaticInit {
  slot: number;
  type: ValueType;
  value: number;
}

export interface CompiledProgram {
  ast: ProgramAst;
  globalsSize: number;
  staticInits: StaticInit[];
  setup: FunctionDecl;
  loop: FunctionDecl;
}

export type CompileResult =
  | { ok: true; program: CompiledProgram; warnings: Diagnostic[] }
  | { ok: false; error: Diagnostic; warnings: Diagnostic[] };

/** Lexes, parses and checks a program. Never throws. */
export function compile(source: string): CompileResult {
  const warnings: Diagnostic[] = [];
  try {
    const lexed = lex(source);
    warnings.push(...lexed.warnings);
    const ast = parse(lexed.tokens);
    const program = new Checker(ast, warnings).run();
    return { ok: true, program, warnings };
  } catch (e) {
    if (e instanceof ProgramError) return { ok: false, error: e.toDiagnostic(), warnings };
    throw e;
  }
}

type Sym =
  | {
      kind: 'var';
      type: ValueType;
      isConst: boolean;
      ref: Ref;
      line: number;
    }
  | { kind: 'builtin'; type: ValueType; value: number };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

class Checker {
  private scopes: Map<string, Sym>[] = [];
  private functions = new Map<string, FunctionDecl>();
  private globalLines = new Map<string, number>();
  private globalsSize = 0;
  private staticInits: StaticInit[] = [];
  private fn: FunctionDecl | null = null;
  private frameSize = 0;
  private loopDepth = 0;
  private switchDepth = 0;

  constructor(
    private readonly ast: ProgramAst,
    private readonly warnings: Diagnostic[],
  ) {}

  private err(node: { line: number; col: number }, message: string): never {
    throw new ProgramError(message, node.line, node.col);
  }

  private warn(node: { line: number; col: number }, message: string): void {
    if (this.warnings.some((w) => w.line === node.line && w.message === message)) return;
    this.warnings.push({ severity: 'aviso', message, line: node.line, col: node.col });
  }

  run(): CompiledProgram {
    const base = new Map<string, Sym>();
    for (const [name, c] of Object.entries(CONSTANTS)) {
      base.set(name, { kind: 'builtin', type: c.type, value: c.value });
    }
    this.scopes = [base, new Map()];

    for (const g of this.ast.globals) {
      for (const d of g.decls)
        if (!this.globalLines.has(d.name)) this.globalLines.set(d.name, d.line);
    }
    for (const f of this.ast.functions) {
      if (BUILTINS[f.name]) {
        this.err(
          f,
          `'${f.name}' já é uma função do Arduino. Escolha outro nome para a sua (linha ${f.line}).`,
        );
      }
      if (CONSTANTS[f.name]) {
        this.err(f, `'${f.name}' já é um nome do Arduino. Escolha outro nome (linha ${f.line}).`);
      }
      const old = this.functions.get(f.name);
      if (old) {
        if (old.body && f.body) {
          this.err(
            f,
            `A função '${f.name}' aparece duas vezes (linhas ${old.line} e ${f.line}). Cada função tem um nome único.`,
          );
        }
        if (old.params.length !== f.params.length || old.ret !== f.ret) {
          this.err(
            f,
            `A função '${f.name}' foi declarada de dois jeitos diferentes (linhas ${old.line} e ${f.line}).`,
          );
        }
        if (f.body) this.functions.set(f.name, f);
      } else {
        this.functions.set(f.name, f);
      }
    }
    this.markYielding();

    for (const item of this.ast.order) {
      if ('k' in item) this.globalDecl(item);
      else if (item.body && this.functions.get(item.name) === item) this.function(item);
    }

    const setup = this.functions.get('setup');
    const loop = this.functions.get('loop');
    const end = { line: 1, col: 1 };
    if (!setup?.body || !loop?.body) {
      const both = !setup?.body && !loop?.body;
      const missing = both
        ? 'Faltam as funções setup() e loop()'
        : !setup?.body
          ? 'Falta a função setup()'
          : 'Falta a função loop()';
      this.err(
        end,
        `${missing}. Todo programa de Arduino tem 'void setup() { }', que roda uma vez quando a placa liga, e 'void loop() { }', que repete sem parar.`,
      );
    }
    for (const f of [setup, loop]) {
      if (f.params.length > 0 || f.ret !== 'void') {
        this.err(
          f,
          `Escreva '${f.name}' como 'void ${f.name}()', sem parâmetros (linha ${f.line}).`,
        );
      }
    }
    for (const f of this.functions.values()) {
      if (!f.body) {
        this.err(
          f,
          `A função '${f.name}' foi declarada na linha ${f.line}, mas falta o corpo dela com '{ }'.`,
        );
      }
    }
    return {
      ast: this.ast,
      globalsSize: this.globalsSize,
      staticInits: this.staticInits,
      setup,
      loop,
    };
  }

  /** Which user functions may suspend: they call delay, directly or through another function. */
  private markYielding(): void {
    const calls = new Map<FunctionDecl, { direct: boolean; callees: Set<string> }>();
    for (const f of this.functions.values()) {
      const info = { direct: false, callees: new Set<string>() };
      if (f.body) {
        walkCalls(f.body, (name) => {
          if (BUILTINS[name]?.yields) info.direct = true;
          else if (!BUILTINS[name]) info.callees.add(name);
        });
      }
      calls.set(f, info);
      f.yields = info.direct;
    }
    for (let changed = true; changed;) {
      changed = false;
      for (const [f, info] of calls) {
        if (f.yields) continue;
        for (const c of info.callees) {
          if (this.functions.get(c)?.yields) {
            f.yields = true;
            changed = true;
            break;
          }
        }
      }
    }
  }

  private lookup(name: string): Sym | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const s = this.scopes[i]!.get(name);
      if (s) return s;
    }
    return undefined;
  }

  private declare(node: { line: number; col: number }, name: string, sym: Sym): void {
    if (CONSTANTS[name]) {
      this.err(
        node,
        `'${name}' já é um nome do Arduino (vale ${CONSTANTS[name]!.value}). Escolha outro nome para a variável (linha ${node.line}).`,
      );
    }
    if (BUILTINS[name] || name === 'Serial') {
      this.err(
        node,
        `'${name}' já é uma função do Arduino. Escolha outro nome para a variável (linha ${node.line}).`,
      );
    }
    const scope = this.scopes[this.scopes.length - 1]!;
    const old = scope.get(name);
    if (old && old.kind === 'var') {
      this.err(
        node,
        `'${name}' já foi declarado na linha ${old.line}. Use outro nome, ou tire o tipo para só mudar o valor: '${name} = ...;'.`,
      );
    }
    scope.set(name, sym);
  }

  private globalDecl(d: DeclStmt): void {
    for (const v of d.decls) {
      if (this.functions.has(v.name)) {
        this.err(
          v,
          `'${v.name}' já é o nome de uma função. Use outro nome para a variável (linha ${v.line}).`,
        );
      }
      if (v.init) this.assignable(this.value(v.init), d.type, v.init);
      const constant = d.isConst && v.init ? constEval(v.init) : undefined;
      if (constant !== undefined) {
        v.ref = { kind: 'const', value: conv(constant, d.type) };
      } else {
        v.ref = { kind: 'global', slot: this.globalsSize++ };
      }
      this.declare(v, v.name, {
        kind: 'var',
        type: d.type,
        isConst: d.isConst,
        ref: v.ref,
        line: v.line,
      });
    }
    d.sync = !d.decls.some((v) => v.init?.yields);
  }

  private function(f: FunctionDecl): void {
    this.fn = f;
    this.frameSize = 0;
    this.scopes.push(new Map());
    f.paramSlots = [];
    for (const p of f.params) {
      const slot = this.frameSize++;
      f.paramSlots.push(slot);
      this.declare(p, p.name, {
        kind: 'var',
        type: p.type,
        isConst: false,
        ref: { kind: 'local', slot },
        line: p.line,
      });
    }
    this.blockBody(f.body!);
    this.scopes.pop();
    f.frameSize = this.frameSize;
    this.fn = null;
  }

  private blockBody(b: BlockStmt): void {
    for (const s of b.body) this.stmt(s);
  }

  private conditionWarnings(kw: string, test: Expr): void {
    if (test.k === 'assign' && test.op === '=') {
      this.warn(
        test,
        `Linha ${test.line}: o '=' dentro do ${kw} guarda um valor em vez de comparar. Para comparar, use '=='.`,
      );
    }
  }

  private stmt(s: Stmt): void {
    switch (s.k) {
      case 'block':
        this.scopes.push(new Map());
        this.blockBody(s);
        this.scopes.pop();
        return;
      case 'decl':
        this.localDecl(s);
        return;
      case 'expr':
        this.expr(s.expr);
        s.sync = !s.expr.yields;
        return;
      case 'if':
        this.value(s.test);
        this.conditionWarnings('if', s.test);
        if (s.then.k === 'empty' && s.then.line === s.test.line) {
          this.warn(
            s.then,
            `Linha ${s.line}: o ';' logo depois do 'if (...)' encerra o if ali mesmo, e o bloco seguinte roda sempre. Tire esse ';'.`,
          );
        }
        this.scoped(s.then);
        if (s.else) this.scoped(s.else);
        return;
      case 'while':
      case 'do':
        this.value(s.test);
        this.conditionWarnings(s.k === 'while' ? 'while' : 'do...while', s.test);
        this.loopDepth++;
        this.scoped(s.body);
        this.loopDepth--;
        return;
      case 'for':
        this.scopes.push(new Map());
        if (s.init) this.stmt(s.init);
        if (s.test) {
          this.value(s.test);
          this.conditionWarnings('for', s.test);
        }
        if (s.update) this.expr(s.update);
        if (s.body.k === 'empty') {
          this.warn(
            s.body,
            `Linha ${s.line}: o ';' logo depois do 'for (...)' deixa o laço vazio, e o bloco seguinte roda uma vez só. Tire esse ';'.`,
          );
        }
        this.loopDepth++;
        this.scoped(s.body);
        this.loopDepth--;
        this.scopes.pop();
        return;
      case 'break':
        if (this.loopDepth === 0 && this.switchDepth === 0) {
          this.err(
            s,
            `'break' só funciona dentro de um laço (for, while) ou de um switch (linha ${s.line}).`,
          );
        }
        s.sync = true;
        return;
      case 'continue':
        if (this.loopDepth === 0) {
          this.err(s, `'continue' só funciona dentro de um laço (for, while) (linha ${s.line}).`);
        }
        s.sync = true;
        return;
      case 'return': {
        const f = this.fn!;
        if (s.value) {
          const t = this.expr(s.value);
          if (f.ret === 'void') {
            this.err(
              s,
              `A função '${f.name}' é void: ela não devolve valor. Use só 'return;' (linha ${s.line}).`,
            );
          }
          this.assignable(this.numeric(t, s.value), f.ret, s.value);
        } else if (f.ret !== 'void') {
          this.err(
            s,
            `A função '${f.name}' devolve ${TYPE_LABEL[f.ret]}: escreva 'return valor;' (linha ${s.line}).`,
          );
        }
        s.sync = !s.value?.yields;
        return;
      }
      case 'switch': {
        const t = this.value(s.disc);
        if (!isInteger(t))
          this.err(s.disc, `O switch (linha ${s.line}) só funciona com números inteiros.`);
        const seen = new Map<number, number>();
        let hasDefault = false;
        for (const l of s.labels) {
          if (l.value === null) {
            if (hasDefault)
              this.err({ line: l.line, col: 1 }, `O switch tem dois 'default' (linha ${l.line}).`);
            hasDefault = true;
            continue;
          }
          this.value(l.value);
          const v = constEval(l.value);
          if (v === undefined) {
            this.err(
              l.value,
              `O valor de um 'case' precisa ser fixo, como 'case 3:' ou uma constante (linha ${l.line}).`,
            );
          }
          const key = conv(v, promote(t));
          if (seen.has(key))
            this.err(
              l.value,
              `O 'case ${key}' aparece duas vezes (linhas ${seen.get(key)} e ${l.line}).`,
            );
          seen.set(key, l.line);
          l.resolved = key;
        }
        this.scopes.push(new Map());
        this.switchDepth++;
        for (const b of s.body) this.stmt(b);
        this.switchDepth--;
        this.scopes.pop();
        return;
      }
      case 'empty':
        s.sync = true;
        return;
    }
  }

  /** A statement that is not a block gets its own scope too (`if (x) int y = 1;`). */
  private scoped(s: Stmt): void {
    if (s.k === 'block') {
      this.stmt(s);
      return;
    }
    this.scopes.push(new Map());
    this.stmt(s);
    this.scopes.pop();
  }

  private localDecl(d: DeclStmt): void {
    for (const v of d.decls) {
      if (v.init) this.assignable(this.value(v.init), d.type, v.init);
      const constant = (d.isConst || d.isStatic) && v.init ? constEval(v.init) : undefined;
      if (d.isStatic) {
        if (v.init && constant === undefined) {
          this.err(
            v,
            `Uma variável static precisa de um valor inicial fixo, como 'static int contador = 0;' (linha ${v.line}).`,
          );
        }
        const slot = this.globalsSize++;
        this.staticInits.push({ slot, type: d.type, value: conv(constant ?? 0, d.type) });
        v.ref = { kind: 'global', slot };
      } else if (d.isConst && constant !== undefined) {
        v.ref = { kind: 'const', value: conv(constant, d.type) };
      } else {
        v.ref = { kind: 'local', slot: this.frameSize++ };
      }
      this.declare(v, v.name, {
        kind: 'var',
        type: d.type,
        isConst: d.isConst,
        ref: v.ref,
        line: v.line,
      });
    }
    d.sync = !d.decls.some((v) => v.init?.yields);
  }

  /** Checks an expression that must give a number (not text, not void). */
  private value(e: Expr): ValueType {
    const t = this.expr(e);
    return this.numeric(t, e);
  }

  private numeric(t: ExprType, e: Expr): ValueType {
    if (t === 'str') {
      this.err(
        e,
        `Texto entre aspas só pode ir dentro de Serial.print() ou Serial.println() (linha ${e.line}).`,
      );
    }
    if (t === 'void') {
      const name = e.k === 'call' ? `'${e.callee}'` : 'Essa função';
      this.err(
        e,
        `${name} não devolve valor (é void), então não dá para usar o resultado dela numa conta ou atribuição (linha ${e.line}).`,
      );
    }
    return t;
  }

  /** Warns when a constant clearly does not fit the destination type. */
  private assignable(from: ValueType, to: TypeName, e: Expr): void {
    if (to === 'void') return;
    const v = constEval(e);
    if (v === undefined || to === 'float' || to === 'bool') return;
    const [lo, hi] = RANGE[to];
    if (v < lo || v > hi) {
      this.warn(
        e,
        `Linha ${e.line}: o valor ${v} não cabe num ${TYPE_LABEL[to]} (vai de ${lo} a ${hi} no Uno) e vai virar ${conv(v, to)}.`,
      );
    } else if (from === 'float' && !Number.isInteger(v)) {
      this.warn(
        e,
        `Linha ${e.line}: ${v} vai virar ${conv(v, to)}, porque ${TYPE_LABEL[to]} só guarda inteiros.`,
      );
    }
  }

  private variable(e: Expr, action: string): Sym & { kind: 'var' } {
    if (e.k !== 'name') this.err(e, `Só dá para ${action} uma variável.`);
    const sym = this.resolveName(e);
    if (sym.kind !== 'var') {
      this.err(
        e,
        `'${e.name}' é uma constante do Arduino e não pode mudar de valor (linha ${e.line}).`,
      );
    }
    if (sym.isConst) {
      this.err(
        e,
        `'${e.name}' é uma constante (const) e não pode mudar de valor (linha ${e.line}). Tire o 'const' da declaração se ela precisa mudar.`,
      );
    }
    return sym;
  }

  private resolveName(e: Expr & { k: 'name' }): Sym {
    const sym = this.lookup(e.name);
    if (!sym) {
      if (this.functions.has(e.name) || BUILTINS[e.name]) {
        this.err(
          e,
          `'${e.name}' é uma função. Para chamá-la, use parênteses: '${e.name}(...)' (linha ${e.line}).`,
        );
      }
      if (e.name === 'Serial') {
        this.err(
          e,
          `Use o Serial com um ponto e uma função, como 'Serial.println(valor)' (linha ${e.line}).`,
        );
      }
      const later = this.globalLines.get(e.name);
      if (later !== undefined && later > e.line) {
        this.err(
          e,
          `'${e.name}' só é declarado na linha ${later}, depois de ser usado na linha ${e.line}. Mova a declaração para o começo do programa.`,
        );
      }
      const names = new Set<string>();
      for (const s of this.scopes) for (const k of s.keys()) names.add(k);
      this.err(
        e,
        `'${e.name}' não foi declarado (linha ${e.line}). Confira se escreveu igual na declaração (maiúsculas contam).${didYouMean(e.name, names)}`,
      );
    }
    if (sym.kind === 'builtin') {
      e.ref = { kind: 'const', value: sym.value };
    } else {
      e.ref = sym.ref;
      e.isConst = sym.isConst;
    }
    e.valueType = sym.type;
    return sym;
  }

  private expr(e: Expr): ExprType {
    const t = this.exprInner(e);
    e.type = t;
    return t;
  }

  private exprInner(e: Expr): ExprType {
    switch (e.k) {
      case 'num':
        e.yields = false;
        return e.litType;
      case 'str':
        e.yields = false;
        return 'str';
      case 'name':
        e.yields = false;
        return this.resolveName(e).type;
      case 'unary': {
        const t = this.value(e.arg);
        e.yields = e.arg.yields;
        if (e.op === '!') return 'bool';
        if (e.op === '~' && !isInteger(t))
          this.err(e, `O operador '~' só funciona com inteiros (linha ${e.line}).`);
        return promote(t);
      }
      case 'update': {
        const v = this.variable(e.target, `usar '${e.op}' em`);
        this.expr(e.target);
        e.yields = false;
        return v.type;
      }
      case 'binary': {
        const l = this.value(e.left);
        const r = this.value(e.right);
        e.yields = !!(e.left.yields || e.right.yields);
        return this.binaryType(e, e.op, l, r);
      }
      case 'logical':
        this.value(e.left);
        this.value(e.right);
        e.yields = !!(e.left.yields || e.right.yields);
        return 'bool';
      case 'assign': {
        const v = this.variable(e.target, 'guardar um valor em');
        this.expr(e.target);
        const r = this.value(e.value);
        e.yields = e.value.yields;
        if (e.op === '=') {
          this.assignable(r, v.type, e.value);
        } else {
          this.binaryType(e, e.op.slice(0, -1), v.type, r);
        }
        return v.type;
      }
      case 'cond': {
        this.value(e.test);
        const a = this.expr(e.then);
        const b = this.expr(e.else);
        e.yields = !!(e.test.yields || e.then.yields || e.else.yields);
        if (a === 'str' && b === 'str') return 'str';
        return common(this.numeric(a, e.then), this.numeric(b, e.else));
      }
      case 'cast':
        e.yields = e.arg.yields;
        this.value(e.arg);
        return e.to;
      case 'call':
        return this.call(e);
      case 'method':
        return this.method(e);
    }
  }

  /** Sets opType and returns the result type of `l op r`. */
  private binaryType(
    e: Expr & { opType?: ValueType },
    op: string,
    l: ValueType,
    r: ValueType,
  ): ValueType {
    if (op === '%' || op === '&' || op === '|' || op === '^' || op === '<<' || op === '>>') {
      if (!isInteger(l) || !isInteger(r)) {
        this.err(
          e,
          `O operador '${op}' só funciona com números inteiros, e aqui há um float (linha ${e.line}).`,
        );
      }
    }
    if (op === '<<' || op === '>>') {
      e.opType = promote(l);
      return e.opType;
    }
    e.opType = common(l, r);
    if (op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=')
      return 'bool';
    return e.opType;
  }

  private checkArgs(
    e: { line: number; col: number; args: Expr[] },
    name: string,
    spec: { min: number; max: number; usage: string },
  ): void {
    const n = e.args.length;
    if (n < spec.min || n > spec.max) {
      const wanted =
        spec.min === spec.max
          ? count(spec.min, 'valor', 'valores')
          : `de ${spec.min} a ${spec.max} valores`;
      this.err(
        e,
        `'${name}' recebe ${wanted}, mas aqui recebeu ${n} (linha ${e.line}). Uso: ${spec.usage}.`,
      );
    }
  }

  private call(e: Expr & { k: 'call' }): ExprType {
    const spec = BUILTINS[e.callee];
    if (spec) {
      this.checkArgs(e, e.callee, spec);
      e.builtin = e.callee;
      if (e.callee === 'F') {
        const a = e.args[0]!;
        if (this.expr(a) !== 'str')
          this.err(a, `F() recebe um texto entre aspas: F("olá") (linha ${e.line}).`);
        e.yields = false;
        return 'str';
      }
      const types = e.args.map((a) => this.value(a));
      e.yields = !!spec.yields || e.args.some((a) => a.yields);
      this.builtinHints(e);
      switch (spec.ret) {
        case 'arith':
          return types.reduce(common);
        case 'arg0':
          return promote(types[0]!);
        default:
          return spec.ret as TypeName;
      }
    }
    const f = this.functions.get(e.callee);
    if (!f) {
      if (this.lookup(e.callee)) {
        this.err(e, `'${e.callee}' é uma variável, não uma função (linha ${e.line}).`);
      }
      const names = [...Object.keys(BUILTINS), ...this.functions.keys()];
      this.err(
        e,
        `A função '${e.callee}' não existe (linha ${e.line}).${didYouMean(e.callee, names)} Maiúsculas e minúsculas contam.`,
      );
    }
    this.checkArgs(e, e.callee, {
      min: f.params.length,
      max: f.params.length,
      usage: `${e.callee}(${f.params.map((p) => p.name).join(', ')})`,
    });
    e.args.forEach((a, i) => this.assignable(this.value(a), f.params[i]!.type, a));
    e.fn = f;
    e.yields = true;
    return f.ret;
  }

  private builtinHints(e: Expr & { k: 'call' }): void {
    const second = e.args[1];
    const isName = (x: Expr | undefined, ...names: string[]) =>
      x?.k === 'name' && names.includes(x.name);
    if (e.callee === 'pinMode' && isName(second, 'HIGH', 'LOW')) {
      this.warn(
        e,
        `Linha ${e.line}: pinMode espera OUTPUT, INPUT ou INPUT_PULLUP, e não HIGH ou LOW.`,
      );
    }
    if (e.callee === 'digitalWrite' && isName(second, 'OUTPUT', 'INPUT', 'INPUT_PULLUP')) {
      this.warn(
        e,
        `Linha ${e.line}: digitalWrite espera HIGH ou LOW. OUTPUT e INPUT são para o pinMode.`,
      );
    }
  }

  private method(e: Expr & { k: 'method' }): ExprType {
    if (e.object !== 'Serial') {
      this.err(
        e,
        `'${e.object}' não existe neste simulador (linha ${e.line}). Dos objetos do Arduino, só o Serial está disponível.`,
      );
    }
    const spec = SERIAL_METHODS[e.method];
    if (!spec) {
      if (
        ['read', 'available', 'readString', 'parseInt', 'readStringUntil', 'peek'].includes(
          e.method,
        )
      ) {
        this.err(
          e,
          `Serial.${e.method}() serve para ler o que chega pelo monitor, e isso ainda não está disponível neste simulador (linha ${e.line}).`,
        );
      }
      this.err(
        e,
        `Serial.${e.method}() não existe neste simulador (linha ${e.line}).${didYouMean(e.method, Object.keys(SERIAL_METHODS))}`,
      );
    }
    this.checkArgs(e, `Serial.${e.method}`, spec);
    e.yields = false;
    e.args.forEach((a, i) => {
      const t = this.expr(a);
      if (i === 0 && (e.method === 'print' || e.method === 'println')) {
        if (t === 'void') this.numeric(t, a);
      } else {
        this.numeric(t, a);
      }
      if (a.yields) e.yields = true;
    });
    return 'void';
  }
}

/** The value of an expression known before the program runs, if any. */
export function constEval(e: Expr): number | undefined {
  switch (e.k) {
    case 'num':
      return e.value;
    case 'name':
      return e.ref?.kind === 'const' ? e.ref.value : undefined;
    case 'unary': {
      const v = constEval(e.arg);
      if (v === undefined) return undefined;
      const t = (e.type ?? 'long') as ValueType;
      if (e.op === '-') return conv(-v, t);
      if (e.op === '+') return v;
      if (e.op === '!') return v === 0 ? 1 : 0;
      return conv(~v, t);
    }
    case 'cast': {
      const v = constEval(e.arg);
      return v === undefined ? undefined : conv(v, e.to);
    }
    case 'binary': {
      const a = constEval(e.left);
      const b = constEval(e.right);
      if (a === undefined || b === undefined || !e.opType) return undefined;
      const t = e.opType;
      switch (e.op) {
        case '+':
          return conv(a + b, t);
        case '-':
          return conv(a - b, t);
        case '*':
          return conv(isInteger(t) && t !== 'int' && t !== 'uint' ? Math.imul(a, b) : a * b, t);
        case '/':
          if (b === 0) return undefined;
          return conv(isInteger(t) ? Math.trunc(a / b) : a / b, t);
        default:
          return undefined;
      }
    }
    default:
      return undefined;
  }
}

/** Calls every function name called in a statement tree. */
function walkCalls(s: Stmt, fn: (name: string) => void): void {
  const ex = (e: Expr | undefined | null): void => {
    if (!e) return;
    switch (e.k) {
      case 'call':
        fn(e.callee);
        e.args.forEach(ex);
        return;
      case 'method':
        e.args.forEach(ex);
        return;
      case 'unary':
      case 'cast':
        ex(e.arg);
        return;
      case 'update':
        ex(e.target);
        return;
      case 'binary':
      case 'logical':
        ex(e.left);
        ex(e.right);
        return;
      case 'assign':
        ex(e.value);
        return;
      case 'cond':
        ex(e.test);
        ex(e.then);
        ex(e.else);
        return;
      default:
        return;
    }
  };
  const st = (x: Stmt | undefined): void => {
    if (!x) return;
    switch (x.k) {
      case 'block':
        x.body.forEach(st);
        return;
      case 'decl':
        x.decls.forEach((d) => ex(d.init));
        return;
      case 'expr':
        ex(x.expr);
        return;
      case 'if':
        ex(x.test);
        st(x.then);
        st(x.else);
        return;
      case 'while':
      case 'do':
        ex(x.test);
        st(x.body);
        return;
      case 'for':
        st(x.init);
        ex(x.test);
        ex(x.update);
        st(x.body);
        return;
      case 'return':
        ex(x.value);
        return;
      case 'switch':
        ex(x.disc);
        x.body.forEach(st);
        return;
      default:
        return;
    }
  };
  st(s);
}
