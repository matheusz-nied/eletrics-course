/**
 * Lexer of the Arduino C subset: tokens with line and column, comments
 * skipped, and the preprocessor lines handled here (`#define NAME value` is
 * a plain token substitution; `#include` is ignored with a warning).
 */
import { ProgramError, type Diagnostic } from './diagnostico';

export type TokenKind = 'num' | 'str' | 'char' | 'ident' | 'kw' | 'op' | 'eof';

export interface Token {
  kind: TokenKind;
  /** Source text (for strings and chars: the decoded value). */
  value: string;
  line: number;
  col: number;
  /** Column just after the token, on its last line. */
  endCol: number;
  /** Numbers: the value. */
  num?: number;
  /** Numbers: written with a decimal point or exponent. */
  isFloat?: boolean;
  /** Numbers: integer suffix, lowercased ("u", "l", "ul"). */
  suffix?: string;
  /** Numbers: written in hex, octal or binary (they take unsigned types sooner). */
  nonDecimal?: boolean;
}

export const KEYWORDS = new Set([
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
  'const',
  'static',
  'volatile',
  'if',
  'else',
  'while',
  'for',
  'do',
  'break',
  'continue',
  'return',
  'switch',
  'case',
  'default',
  'true',
  'false',
]);

const OPERATORS = [
  '<<=',
  '>>=',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '<<',
  '>>',
  '->',
  '::',
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '<',
  '>',
  '!',
  '&',
  '|',
  '^',
  '~',
  '?',
  ':',
  ';',
  ',',
  '.',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
];

const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdent = (c: string) => /[A-Za-z0-9_]/.test(c);

export interface LexResult {
  tokens: Token[];
  warnings: Diagnostic[];
}

/** Splits the program into tokens. Throws ProgramError on the first problem. */
export function lex(source: string): LexResult {
  const warnings: Diagnostic[] = [];
  const macros = new Map<string, Token[]>();
  const out: Token[] = [];
  const raw = scan(source, 1, 1, macros, warnings, true);
  // Expand #define names (recursively, but never a name inside its own expansion).
  const expand = (tok: Token, active: Set<string>) => {
    const body = tok.kind === 'ident' ? macros.get(tok.value) : undefined;
    if (!body || active.has(tok.value)) {
      out.push(tok);
      return;
    }
    const inner = new Set(active).add(tok.value);
    for (const t of body) expand({ ...t, line: tok.line, col: tok.col, endCol: tok.endCol }, inner);
  };
  for (const tok of raw) {
    if (tok.kind === 'eof') out.push(tok);
    else expand(tok, new Set());
  }
  return { tokens: out, warnings };
}

function scan(
  src: string,
  line0: number,
  col0: number,
  macros: Map<string, Token[]>,
  warnings: Diagnostic[],
  topLevel: boolean,
): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = line0;
  let col = col0;
  /** Only whitespace so far on this line (for the preprocessor `#`). */
  let lineStart = true;

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === '\n') {
        line++;
        col = 1;
        lineStart = true;
      } else {
        col++;
      }
      i++;
    }
  };

  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      advance();
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') advance();
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const sl = line;
      const sc = col;
      advance(2);
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) advance();
      if (i >= src.length) {
        throw new ProgramError(
          `O comentário aberto com '/*' na linha ${sl} não foi fechado. Termine-o com '*/'.`,
          sl,
          sc,
        );
      }
      advance(2);
      continue;
    }

    const startLine = line;
    const startCol = col;

    if (c === '#') {
      if (!topLevel || !lineStart) {
        throw new ProgramError(
          `O '#' na linha ${line} está fora do lugar: diretivas como #define começam a linha.`,
          line,
          col,
        );
      }
      let end = i;
      while (end < src.length && src[end] !== '\n') end++;
      const text = src.slice(i, end);
      directive(text, startLine, startCol, macros, warnings);
      advance(end - i);
      continue;
    }
    lineStart = false;

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      tokens.push(number(src, i, startLine, startCol));
      advance(tokens[tokens.length - 1]!.value.length);
      tokens[tokens.length - 1]!.endCol = col;
      continue;
    }

    if (isIdentStart(c)) {
      let j = i;
      while (j < src.length && isIdent(src[j]!)) j++;
      const word = src.slice(i, j);
      advance(j - i);
      // Arduino's binary constants: B1010 (binary.h).
      if (/^B[01]{1,8}$/.test(word)) {
        tokens.push({
          kind: 'num',
          value: word,
          num: parseInt(word.slice(1), 2),
          nonDecimal: true,
          line: startLine,
          col: startCol,
          endCol: col,
        });
        continue;
      }
      tokens.push({
        kind: KEYWORDS.has(word) ? 'kw' : 'ident',
        value: word,
        line: startLine,
        col: startCol,
        endCol: col,
      });
      continue;
    }

    if (c === '"') {
      advance();
      let text = '';
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\n') break;
        if (src[i] === '\\') {
          advance();
          text += escape(src[i] ?? '', line, col);
          advance();
          continue;
        }
        text += src[i];
        advance();
      }
      if (src[i] !== '"') {
        throw new ProgramError(
          `O texto aberto com aspas na linha ${startLine} não foi fechado. Feche com '"' na mesma linha.`,
          startLine,
          startCol,
        );
      }
      advance();
      tokens.push({ kind: 'str', value: text, line: startLine, col: startCol, endCol: col });
      continue;
    }

    if (c === "'") {
      advance();
      let text = '';
      while (i < src.length && src[i] !== "'" && src[i] !== '\n') {
        if (src[i] === '\\') {
          advance();
          text += escape(src[i] ?? '', line, col);
        } else {
          text += src[i];
        }
        advance();
      }
      if (src[i] !== "'") {
        throw new ProgramError(
          `Falta fechar a aspa simples aberta na linha ${startLine}.`,
          startLine,
          startCol,
        );
      }
      advance();
      if ([...text].length !== 1) {
        throw new ProgramError(
          `Aspas simples guardam um único caractere, como 'A'. Para um texto, use aspas duplas: "${text}".`,
          startLine,
          startCol,
        );
      }
      tokens.push({
        kind: 'char',
        value: text,
        num: text.codePointAt(0)! & 0xff,
        line: startLine,
        col: startCol,
        endCol: col,
      });
      continue;
    }

    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) {
      advance(op.length);
      tokens.push({ kind: 'op', value: op, line: startLine, col: startCol, endCol: col });
      continue;
    }

    throw new ProgramError(
      `O caractere '${c}' na linha ${line} não faz parte da linguagem. Ele pode ter vindo de uma cópia de texto (aspas “curvas”, por exemplo).`,
      line,
      col,
    );
  }

  if (topLevel) tokens.push({ kind: 'eof', value: '', line, col, endCol: col });
  return tokens;
}

function escape(c: string, line: number, col: number): string {
  switch (c) {
    case 'n':
      return '\n';
    case 't':
      return '\t';
    case 'r':
      return '\r';
    case '0':
      return '\0';
    case '\\':
    case '"':
    case "'":
      return c;
    default:
      throw new ProgramError(`A sequência '\\${c}' não é conhecida.`, line, col);
  }
}

function number(src: string, i: number, line: number, col: number): Token {
  const rest = src.slice(i);
  let m = /^0[xX][0-9a-fA-F]+/.exec(rest);
  let value: number;
  let isFloat = false;
  let nonDecimal = false;
  let text: string;
  if (m) {
    text = m[0];
    value = parseInt(text.slice(2), 16);
    nonDecimal = true;
  } else if ((m = /^0[bB][01]+/.exec(rest))) {
    text = m[0];
    value = parseInt(text.slice(2), 2);
    nonDecimal = true;
  } else {
    m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest)!;
    text = m[0];
    isFloat = text.includes('.') || /[eE]/.test(text);
    if (!isFloat && text.length > 1 && text.startsWith('0')) {
      value = parseInt(text, 8);
      nonDecimal = true;
    } else {
      value = Number(text);
    }
  }
  let suffix = '';
  const after = src.slice(i + text.length);
  const sm = isFloat ? /^[fF]/.exec(after) : /^([uU][lL]{0,2}|[lL]{1,2}[uU]?)/.exec(after);
  if (sm) suffix = sm[0].toLowerCase();
  const next = src[i + text.length + suffix.length] ?? '';
  if (isIdent(next)) {
    throw new ProgramError(
      `O número '${text}${suffix}${next}…' na linha ${line} está mal escrito. Nomes de variáveis não podem começar com algarismo.`,
      line,
      col,
    );
  }
  return {
    kind: 'num',
    value: text + suffix,
    num: value,
    isFloat,
    suffix: suffix.replace('ll', 'l').replace('f', ''),
    nonDecimal,
    line,
    col,
    endCol: col + text.length + suffix.length,
  };
}

function directive(
  text: string,
  line: number,
  col: number,
  macros: Map<string, Token[]>,
  warnings: Diagnostic[],
): void {
  const m = /^#\s*(\w+)\s*(.*)$/.exec(text.replace(/\/\/.*$/, '').trimEnd());
  const name = m?.[1] ?? '';
  const rest = m?.[2] ?? '';
  if (name === 'include') {
    warnings.push({
      severity: 'aviso',
      message: `Linha ${line}: bibliotecas (#include) não existem neste simulador, e a linha foi ignorada. As funções básicas do Arduino já estão disponíveis sem ela.`,
      line,
      col,
    });
    return;
  }
  if (name === 'define') {
    const dm = /^([A-Za-z_]\w*)(\(?)(.*)$/.exec(rest);
    if (!dm) {
      throw new ProgramError(
        `Linha ${line}: depois de #define vem um nome e um valor, como '#define LED 13'.`,
        line,
        col,
      );
    }
    if (dm[2]) {
      throw new ProgramError(
        `Linha ${line}: #define com parâmetros (macro) não é aceito neste simulador. Escreva uma função no lugar.`,
        line,
        col,
      );
    }
    const valueCol = col + text.indexOf(dm[3]!.trim() || dm[1]!) + 0;
    const body = scan(dm[3]!, line, valueCol, macros, warnings, false);
    if (body.some((t) => t.kind === 'op' && t.value === ';')) {
      throw new ProgramError(
        `Linha ${line}: um #define não termina com ';'. Escreva '#define ${dm[1]} ${dm[3]!.replace(/;\s*$/, '').trim()}'.`,
        line,
        col,
      );
    }
    macros.set(dm[1]!, body);
    return;
  }
  throw new ProgramError(
    `Linha ${line}: a diretiva '#${name}' não é aceita neste simulador. Só #define e #include.`,
    line,
    col,
  );
}
