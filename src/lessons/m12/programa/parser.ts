/**
 * Recursive-descent parser of the Arduino C subset: tokens (lexer.ts) to the
 * syntax tree (ast.ts), with C operator precedence. Stops at the first
 * error with a pt-BR message that says what is missing and where.
 */
import type {
  BlockStmt,
  DeclStmt,
  Expr,
  FunctionDecl,
  Param,
  ProgramAst,
  Stmt,
  TypeName,
  ValueType,
} from './ast';
import { ProgramError, didYouMean } from './diagnostico';
import type { Token } from './lexer';

const TYPE_WORDS = new Set([
  'void',
  'int',
  'long',
  'short',
  'float',
  'double',
  'bool',
  'boolean',
  'byte',
  'char',
  'word',
  'unsigned',
  'signed',
]);
const QUALIFIERS = new Set(['const', 'static', 'volatile']);
/** Names students write for types that exist only in other languages or libraries. */
const TYPE_NAMES_FOR_HINTS = ['int', 'long', 'float', 'double', 'bool', 'boolean', 'byte', 'char'];

const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4,
  '&': 5,
  '==': 6,
  '!=': 6,
  '<': 7,
  '>': 7,
  '<=': 7,
  '>=': 7,
  '<<': 8,
  '>>': 8,
  '+': 9,
  '-': 9,
  '*': 10,
  '/': 10,
  '%': 10,
};

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);

interface TypeSpec {
  type: TypeName;
  isConst: boolean;
  isStatic: boolean;
  tok: Token;
}

/** How a token reads in a message: 'x', or "o fim do programa". */
function show(t: Token): string {
  if (t.kind === 'eof') return 'o fim do programa';
  if (t.kind === 'str') return `"${t.value}"`;
  return `'${t.value}'`;
}

export function parse(tokens: Token[]): ProgramAst {
  return new Parser(tokens).program();
}

class Parser {
  private i = 0;
  /** Name of the function being parsed, for messages. */
  private fn = '';

  constructor(private readonly toks: Token[]) {}

  private peek(o = 0): Token {
    return this.toks[Math.min(this.i + o, this.toks.length - 1)]!;
  }

  private prev(): Token {
    return this.toks[Math.max(0, this.i - 1)]!;
  }

  private next(): Token {
    const t = this.peek();
    if (t.kind !== 'eof') this.i++;
    return t;
  }

  private at(value: string, o = 0): boolean {
    const t = this.peek(o);
    return (t.kind === 'op' || t.kind === 'kw') && t.value === value;
  }

  private eat(value: string): boolean {
    if (this.at(value)) {
      this.i++;
      return true;
    }
    return false;
  }

  private fail(t: Token, message: string): never {
    throw new ProgramError(message, t.line, t.col);
  }

  private expectSemi(): void {
    if (this.eat(';')) return;
    const prev = this.prev();
    const cur = this.peek();
    if (cur.kind === 'eof' || cur.line !== prev.line) {
      throw new ProgramError(
        `Falta um ponto e vírgula ';' no fim da linha ${prev.line}. Em C, toda instrução termina com ';'.`,
        prev.line,
        prev.endCol,
      );
    }
    this.fail(
      cur,
      `Falta um ponto e vírgula ';' antes de ${show(cur)} na linha ${cur.line}. Em C, toda instrução termina com ';'.`,
    );
  }

  /** Expects a closing parenthesis opened at `open`. */
  private closeParen(open: Token, what: string): void {
    if (this.eat(')')) return;
    const cur = this.peek();
    const where = open.line === cur.line ? '' : ` (aberto na linha ${open.line})`;
    this.fail(
      cur,
      `Falta fechar o parêntese de ${what}${where}: esperava ')' na linha ${cur.line}, mas encontrei ${show(cur)}.`,
    );
  }

  private isTypeStart(o = 0): boolean {
    const t = this.peek(o);
    return t.kind === 'kw' && (TYPE_WORDS.has(t.value) || QUALIFIERS.has(t.value));
  }

  /** Type words with qualifiers, or null when the next token does not start a type. */
  private typeSpec(): TypeSpec | null {
    if (!this.isTypeStart()) return null;
    const tok = this.peek();
    let isConst = false;
    let isStatic = false;
    const words: string[] = [];
    while (this.isTypeStart()) {
      const w = this.next().value;
      if (w === 'const') isConst = true;
      else if (w === 'static') isStatic = true;
      else if (w !== 'volatile') words.push(w);
    }
    // `const` may also come after the type: `int const x`.
    const key = words.filter((w) => w !== 'signed' || words.length === 1).join(' ');
    const map: Record<string, TypeName> = {
      void: 'void',
      bool: 'bool',
      boolean: 'bool',
      byte: 'byte',
      char: 'char',
      'unsigned char': 'byte',
      int: 'int',
      short: 'int',
      'short int': 'int',
      signed: 'int',
      unsigned: 'uint',
      'unsigned int': 'uint',
      'unsigned short': 'uint',
      'unsigned short int': 'uint',
      word: 'uint',
      long: 'long',
      'long int': 'long',
      'long long': 'long',
      'unsigned long': 'ulong',
      'unsigned long int': 'ulong',
      'unsigned long long': 'ulong',
      'long unsigned': 'ulong',
      float: 'float',
      double: 'float',
      'long double': 'float',
    };
    const type = map[key];
    if (!type) {
      this.fail(
        tok,
        words.length === 0
          ? `Na linha ${tok.line}, depois de '${tok.value}' falta o tipo, como 'const int LED = 13;'.`
          : `O tipo '${words.join(' ')}' na linha ${tok.line} não é conhecido.`,
      );
    }
    return { type, isConst, isStatic, tok };
  }

  private nameAfterType(spec: TypeSpec): Token {
    const t = this.peek();
    if (t.kind === 'ident') return this.next();
    if (t.kind === 'kw') {
      this.fail(
        t,
        `'${t.value}' é uma palavra reservada da linguagem e não pode ser nome de variável (linha ${t.line}).`,
      );
    }
    this.fail(
      t,
      `Na linha ${t.line}, depois do tipo '${spec.tok.value}' vem o nome da variável ou da função, mas encontrei ${show(t)}.`,
    );
  }

  program(): ProgramAst {
    const ast: ProgramAst = { globals: [], functions: [], order: [] };
    while (this.peek().kind !== 'eof') {
      const t = this.peek();
      if (this.at(';')) {
        this.next();
        continue;
      }
      const spec = this.typeSpec();
      if (!spec) this.topLevelError(t);
      const name = this.nameAfterType(spec);
      if (this.at('(')) {
        const f = this.functionRest(spec, name);
        ast.functions.push(f);
        ast.order.push(f);
      } else {
        const d = this.declRest(spec, name);
        ast.globals.push(d);
        ast.order.push(d);
      }
    }
    return ast;
  }

  private topLevelError(t: Token): never {
    if (t.kind === 'op' && t.value === '}') {
      this.fail(
        t,
        `Há uma chave '}' sobrando na linha ${t.line}: ela não fecha nenhuma '{'. Confira se cada '{' tem a sua '}'.`,
      );
    }
    if (t.kind === 'ident' && this.at('(', 1)) {
      const isMain = t.value === 'setup' || t.value === 'loop';
      this.fail(
        t,
        isMain
          ? `Na linha ${t.line}, falta o tipo antes de '${t.value}': escreva 'void ${t.value}()'.`
          : `A linha ${t.line} tem uma instrução fora de qualquer função. Instruções como '${t.value}(...)' ficam dentro de setup() ou loop(), entre as chaves.`,
      );
    }
    if (t.kind === 'ident' && this.peek(1).kind === 'ident') {
      this.fail(
        t,
        t.value === 'String'
          ? `O tipo String não está disponível neste simulador (linha ${t.line}). Para mostrar texto, use Serial.print("texto").`
          : `'${t.value}' não é um tipo conhecido (linha ${t.line}).${didYouMean(t.value, TYPE_NAMES_FOR_HINTS)} Lembre que maiúsculas e minúsculas contam.`,
      );
    }
    if (t.kind === 'ident') {
      this.fail(
        t,
        `A linha ${t.line} tem uma instrução fora de qualquer função. Fora das funções só ficam declarações, como 'int led = 13;'.`,
      );
    }
    this.fail(t, `Não esperava ${show(t)} na linha ${t.line}.`);
  }

  private functionRest(spec: TypeSpec, name: Token): FunctionDecl {
    const open = this.next(); // (
    const params: Param[] = [];
    if (!this.at(')')) {
      if (this.at('void') && this.at(')', 1)) {
        this.next();
      } else {
        for (;;) {
          const ps = this.typeSpec();
          if (!ps || ps.type === 'void') {
            this.fail(
              this.peek(),
              `Os parâmetros de '${name.value}' (linha ${name.line}) precisam de tipo e nome, como 'int vezes'.`,
            );
          }
          const pn = this.nameAfterType(ps);
          if (this.at('[')) this.unsupportedArray(this.peek());
          params.push({ name: pn.value, type: ps.type as ValueType, line: pn.line, col: pn.col });
          if (!this.eat(',')) break;
        }
      }
    }
    this.closeParen(open, `'${name.value}'`);
    const f: FunctionDecl = {
      name: name.value,
      ret: spec.type,
      params,
      line: name.line,
      col: name.col,
    };
    if (this.eat(';')) return f; // prototype
    if (!this.at('{')) {
      const t = this.peek();
      this.fail(
        t,
        `Depois de '${spec.tok.value} ${name.value}()' vem o corpo da função entre chaves '{ }' (linha ${t.line}).`,
      );
    }
    this.fn = name.value;
    f.body = this.block();
    this.fn = '';
    return f;
  }

  private unsupportedArray(t: Token): never {
    this.fail(
      t,
      `Vetores (arrays, com '[ ]') ainda não são aceitos neste simulador (linha ${t.line}). Use variáveis separadas.`,
    );
  }

  /** Declarators after the type and the first name, up to the ';'. */
  private declRest(spec: TypeSpec, first: Token): DeclStmt {
    if (spec.type === 'void') {
      this.fail(
        first,
        `Uma variável não pode ser 'void' (linha ${first.line}). Use int, long, float ou bool.`,
      );
    }
    const d: DeclStmt = {
      k: 'decl',
      type: spec.type,
      isConst: spec.isConst,
      isStatic: spec.isStatic,
      decls: [],
      line: spec.tok.line,
      col: spec.tok.col,
    };
    let name = first;
    for (;;) {
      if (this.at('[')) this.unsupportedArray(this.peek());
      let init: Expr | undefined;
      if (this.eat('=')) init = this.assign();
      else if (spec.isConst) {
        this.fail(
          name,
          `A constante '${name.value}' (linha ${name.line}) precisa de um valor: 'const int ${name.value} = 13;'.`,
        );
      }
      d.decls.push({ name: name.value, init, line: name.line, col: name.col });
      if (!this.eat(',')) break;
      name = this.nameAfterType(spec);
    }
    this.expectSemi();
    return d;
  }

  private block(): BlockStmt {
    const open = this.next(); // {
    const body: Stmt[] = [];
    while (!this.at('}')) {
      if (this.peek().kind === 'eof') {
        const where = this.fn ? ` (no bloco de '${this.fn}')` : '';
        throw new ProgramError(
          `Falta fechar a chave '{' aberta na linha ${open.line}${where}. Cada '{' precisa de uma '}'.`,
          open.line,
          open.col,
        );
      }
      body.push(this.statement());
    }
    this.next();
    return { k: 'block', body, line: open.line, col: open.col };
  }

  private parenCondition(keyword: Token): Expr {
    if (!this.at('(')) {
      this.fail(
        this.peek(),
        `Depois de '${keyword.value}' vem a condição entre parênteses, como '${keyword.value} (x > 5)' (linha ${keyword.line}).`,
      );
    }
    const open = this.next();
    if (this.at(')')) this.fail(this.peek(), `A condição do '${keyword.value}' está vazia.`);
    const e = this.expression();
    this.closeParen(open, `'${keyword.value}'`);
    return e;
  }

  private statement(): Stmt {
    const t = this.peek();
    if (this.at('{')) return this.block();
    if (this.at(';')) {
      this.next();
      return { k: 'empty', line: t.line, col: t.col };
    }
    if (this.isTypeStart()) {
      const spec = this.typeSpec()!;
      const name = this.nameAfterType(spec);
      if (this.at('(')) {
        this.fail(
          name,
          `A função '${name.value}' (linha ${name.line}) começa dentro de outro bloco. Provavelmente falta fechar uma chave '}' antes dela.`,
        );
      }
      return this.declRest(spec, name);
    }
    if (t.kind === 'ident' && this.peek(1).kind === 'ident') {
      this.fail(
        t,
        t.value === 'String'
          ? `O tipo String não está disponível neste simulador (linha ${t.line}). Para mostrar texto, use Serial.print("texto").`
          : `'${t.value}' não é um tipo conhecido (linha ${t.line}).${didYouMean(t.value, TYPE_NAMES_FOR_HINTS)} Lembre que maiúsculas e minúsculas contam.`,
      );
    }
    if (t.kind === 'kw') {
      switch (t.value) {
        case 'if': {
          this.next();
          const test = this.parenCondition(t);
          const then = this.statement();
          const els = this.eat('else') ? this.statement() : undefined;
          return { k: 'if', test, then, else: els, line: t.line, col: t.col };
        }
        case 'else':
          return this.fail(
            t,
            `Este 'else' (linha ${t.line}) não tem um 'if' antes dele. Confira as chaves do 'if' e se não sobrou um ';' depois do ')'.`,
          );
        case 'while': {
          this.next();
          const test = this.parenCondition(t);
          const body = this.statement();
          return { k: 'while', test, body, line: t.line, col: t.col };
        }
        case 'do': {
          this.next();
          const body = this.statement();
          if (!this.at('while')) {
            this.fail(this.peek(), `Depois do bloco do 'do' (linha ${t.line}) vem 'while (...);'.`);
          }
          const w = this.next();
          const test = this.parenCondition(w);
          this.expectSemi();
          return { k: 'do', body, test, line: t.line, col: t.col };
        }
        case 'for':
          return this.forStatement(t);
        case 'break':
        case 'continue':
          this.next();
          this.expectSemi();
          return { k: t.value, line: t.line, col: t.col };
        case 'return': {
          this.next();
          const value = this.at(';') ? undefined : this.expression();
          this.expectSemi();
          return { k: 'return', value, line: t.line, col: t.col };
        }
        case 'switch':
          return this.switchStatement(t);
        case 'case':
        case 'default':
          this.fail(t, `'${t.value}' só pode aparecer dentro de um 'switch' (linha ${t.line}).`);
      }
    }
    const expr = this.expression();
    this.expectSemi();
    return { k: 'expr', expr, line: t.line, col: t.col };
  }

  private forStatement(t: Token): Stmt {
    this.next();
    if (!this.at('(')) {
      this.fail(
        this.peek(),
        `Depois de 'for' vêm parênteses com três partes: 'for (int i = 0; i < 10; i++)' (linha ${t.line}).`,
      );
    }
    const open = this.next();
    let init: Stmt | undefined;
    if (this.eat(';')) {
      init = undefined;
    } else if (this.isTypeStart()) {
      const spec = this.typeSpec()!;
      init = this.declRest(spec, this.nameAfterType(spec));
    } else {
      const e = this.expression();
      init = { k: 'expr', expr: e, line: e.line, col: e.col };
      this.forSemi(t);
    }
    const test = this.at(';') ? undefined : this.expression();
    this.forSemi(t);
    const update = this.at(')') ? undefined : this.expression();
    this.closeParen(open, `'for'`);
    const body = this.statement();
    return { k: 'for', init, test, update, body, line: t.line, col: t.col };
  }

  private forSemi(t: Token): void {
    if (this.eat(';')) return;
    this.fail(
      this.peek(),
      `As três partes do 'for' (linha ${t.line}) são separadas por ';', como 'for (int i = 0; i < 10; i++)'.`,
    );
  }

  private switchStatement(t: Token): Stmt {
    this.next();
    const disc = this.parenCondition(t);
    if (!this.at('{')) this.fail(this.peek(), `Depois do 'switch (...)' vem um bloco '{ }'.`);
    const open = this.next();
    const body: Stmt[] = [];
    const labels: { value: Expr | null; index: number; line: number }[] = [];
    while (!this.at('}')) {
      const c = this.peek();
      if (c.kind === 'eof') {
        throw new ProgramError(
          `Falta fechar a chave '{' do 'switch' aberta na linha ${open.line}.`,
          open.line,
          open.col,
        );
      }
      if (this.eat('case')) {
        const value = this.conditional();
        if (!this.eat(':'))
          this.fail(this.peek(), `Depois de 'case' vem o valor e ':' (linha ${c.line}).`);
        labels.push({ value, index: body.length, line: c.line });
        continue;
      }
      if (this.eat('default')) {
        if (!this.eat(':'))
          this.fail(this.peek(), `Depois de 'default' vem ':' (linha ${c.line}).`);
        labels.push({ value: null, index: body.length, line: c.line });
        continue;
      }
      if (labels.length === 0) {
        this.fail(
          c,
          `Dentro do 'switch', as instruções vêm depois de um 'case valor:' (linha ${c.line}).`,
        );
      }
      body.push(this.statement());
    }
    this.next();
    return { k: 'switch', disc, body, labels, line: t.line, col: t.col };
  }

  // Expressions

  expression(): Expr {
    const e = this.assign();
    if (this.at(',')) {
      this.fail(
        this.peek(),
        `A vírgula na linha ${this.peek().line} não separa nada aqui. Em C, números decimais usam ponto (2.5), e cada instrução termina com ';'.`,
      );
    }
    return e;
  }

  private assign(): Expr {
    const left = this.conditional();
    const t = this.peek();
    if (t.kind === 'op' && ASSIGN_OPS.has(t.value)) {
      if (left.k !== 'name') {
        this.fail(
          t,
          `Do lado esquerdo do '${t.value}' (linha ${t.line}) precisa vir o nome de uma variável.`,
        );
      }
      this.next();
      const value = this.assign();
      return { k: 'assign', op: t.value, target: left, value, line: t.line, col: t.col };
    }
    return left;
  }

  private conditional(): Expr {
    const test = this.binary(1);
    if (!this.at('?')) return test;
    const q = this.next();
    const then = this.assign();
    if (!this.eat(':')) {
      this.fail(
        this.peek(),
        `O operador '?' (linha ${q.line}) precisa de ':' com o valor do "senão".`,
      );
    }
    const els = this.conditional();
    return { k: 'cond', test, then, else: els, line: q.line, col: q.col };
  }

  private binary(minPrec: number): Expr {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      const prec = t.kind === 'op' ? BINARY_PRECEDENCE[t.value] : undefined;
      if (prec === undefined || prec < minPrec) return left;
      this.next();
      const right = this.binary(prec + 1);
      left =
        t.value === '&&' || t.value === '||'
          ? { k: 'logical', op: t.value, left, right, line: t.line, col: t.col }
          : { k: 'binary', op: t.value, left, right, line: t.line, col: t.col };
    }
  }

  private unary(): Expr {
    const t = this.peek();
    if (t.kind === 'op') {
      if (t.value === '!' || t.value === '~' || t.value === '-' || t.value === '+') {
        this.next();
        const arg = this.unary();
        return { k: 'unary', op: t.value, arg, line: t.line, col: t.col };
      }
      if (t.value === '++' || t.value === '--') {
        this.next();
        const target = this.unary();
        if (target.k !== 'name') {
          this.fail(t, `O '${t.value}' (linha ${t.line}) só funciona com uma variável.`);
        }
        return { k: 'update', op: t.value, prefix: true, target, line: t.line, col: t.col };
      }
      if (t.value === '(' && this.isTypeStart(1)) {
        const open = this.next();
        const spec = this.typeSpec()!;
        this.closeParen(open, 'conversão de tipo');
        if (spec.type === 'void')
          this.fail(spec.tok, `Não dá para converter um valor para 'void'.`);
        const arg = this.unary();
        return { k: 'cast', to: spec.type as ValueType, arg, line: t.line, col: t.col };
      }
      if (t.value === '&' || t.value === '*') {
        this.fail(t, `Ponteiros ('${t.value}' antes de um nome) não são aceitos neste simulador.`);
      }
    }
    return this.postfix();
  }

  private postfix(): Expr {
    const e = this.primary();
    for (;;) {
      const t = this.peek();
      if (t.kind === 'op' && (t.value === '++' || t.value === '--')) {
        if (e.k !== 'name')
          this.fail(t, `O '${t.value}' (linha ${t.line}) só funciona com uma variável.`);
        this.next();
        return { k: 'update', op: t.value, prefix: false, target: e, line: t.line, col: t.col };
      }
      if (t.kind === 'op' && t.value === '[') this.unsupportedArray(t);
      return e;
    }
  }

  private args(open: Token, name: string): Expr[] {
    const args: Expr[] = [];
    if (this.eat(')')) return args;
    for (;;) {
      args.push(this.assign());
      if (this.eat(',')) continue;
      if (this.eat(')')) return args;
      const cur = this.peek();
      if (cur.kind === 'eof' || (cur.kind === 'op' && (cur.value === ';' || cur.value === '{'))) {
        this.fail(
          cur,
          `Falta fechar o parêntese de '${name}(' aberto na linha ${open.line}: esperava ')'.`,
        );
      }
      this.fail(
        cur,
        `Na chamada de '${name}' (linha ${cur.line}), os valores são separados por vírgula: esperava ',' ou ')', mas encontrei ${show(cur)}.`,
      );
    }
  }

  private primary(): Expr {
    const t = this.next();
    switch (t.kind) {
      case 'num': {
        let litType: ValueType;
        const v = t.num!;
        if (t.isFloat) litType = 'float';
        else if (t.suffix === 'ul' || t.suffix === 'lu') litType = 'ulong';
        else if (t.suffix === 'l') litType = v <= 0x7fffffff ? 'long' : 'ulong';
        else if (t.suffix === 'u') litType = v <= 0xffff ? 'uint' : 'ulong';
        else if (v <= 0x7fff) litType = 'int';
        else if (t.nonDecimal && v <= 0xffff) litType = 'uint';
        else if (v <= 0x7fffffff) litType = 'long';
        else litType = 'ulong';
        return { k: 'num', value: v, litType, line: t.line, col: t.col };
      }
      case 'char':
        return { k: 'num', value: t.num!, litType: 'char', line: t.line, col: t.col };
      case 'str':
        return { k: 'str', value: t.value, line: t.line, col: t.col };
      case 'ident': {
        if (this.at('.') && this.peek(1).kind === 'ident') {
          this.next();
          const m = this.next();
          if (!this.at('(')) {
            this.fail(
              this.peek(),
              `Depois de '${t.value}.${m.value}' vêm parênteses: '${t.value}.${m.value}(...)'.`,
            );
          }
          const open = this.next();
          const args = this.args(open, `${t.value}.${m.value}`);
          return { k: 'method', object: t.value, method: m.value, args, line: t.line, col: t.col };
        }
        if (this.at('(')) {
          const open = this.next();
          const args = this.args(open, t.value);
          return { k: 'call', callee: t.value, args, line: t.line, col: t.col };
        }
        return { k: 'name', name: t.value, line: t.line, col: t.col };
      }
      case 'kw': {
        if (t.value === 'true' || t.value === 'false') {
          return {
            k: 'num',
            value: t.value === 'true' ? 1 : 0,
            litType: 'bool',
            line: t.line,
            col: t.col,
          };
        }
        // Function-style conversion: int(x), float(x), byte(x).
        if (
          TYPE_WORDS.has(t.value) &&
          t.value !== 'void' &&
          t.value !== 'unsigned' &&
          this.at('(')
        ) {
          this.i--;
          const spec = this.typeSpec()!;
          const open = this.next();
          const arg = this.assign();
          this.closeParen(open, `'${t.value}(...)'`);
          return { k: 'cast', to: spec.type as ValueType, arg, line: t.line, col: t.col };
        }
        return this.fail(
          t,
          `'${t.value}' é uma palavra reservada e não pode aparecer aqui (linha ${t.line}).`,
        );
      }
      case 'op':
        if (t.value === '(') {
          const e = this.expression();
          this.closeParen(t, 'uma expressão');
          return e;
        }
        break;
      case 'eof':
        this.fail(t, 'O programa terminou no meio de uma instrução.');
    }
    this.fail(t, `Esperava um valor ou um nome na linha ${t.line}, mas encontrei ${show(t)}.`);
  }
}
