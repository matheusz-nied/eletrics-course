/**
 * Syntax tree of the Arduino C subset. The parser fills the shape; the
 * checker (checker.ts) fills `type`, `ref`, `yields` and the slots.
 */

/**
 * Value types, sized like the Arduino Uno (AVR): int is 16 bits, long 32,
 * float and double are the same 32-bit float.
 */
export type ValueType = 'bool' | 'char' | 'byte' | 'int' | 'uint' | 'long' | 'ulong' | 'float';
export type TypeName = ValueType | 'void';
/** Text in quotes: only for Serial.print/println. */
export type ExprType = ValueType | 'void' | 'str';

interface Pos {
  line: number;
  col: number;
}

/** Where a name points, after the checker. */
export type Ref =
  | { kind: 'global'; slot: number }
  | { kind: 'local'; slot: number }
  | { kind: 'const'; value: number };

interface ExprBase extends Pos {
  /** Filled by the checker. */
  type?: ExprType;
  /** The expression may suspend (it calls delay or a user function). */
  yields?: boolean;
}

export type Expr =
  | (ExprBase & { k: 'num'; value: number; litType: ValueType })
  | (ExprBase & { k: 'str'; value: string })
  | (ExprBase & { k: 'name'; name: string; ref?: Ref; valueType?: ValueType; isConst?: boolean })
  | (ExprBase & { k: 'unary'; op: '-' | '+' | '!' | '~'; arg: Expr })
  | (ExprBase & { k: 'update'; op: '++' | '--'; prefix: boolean; target: Expr })
  | (ExprBase & { k: 'binary'; op: string; left: Expr; right: Expr; opType?: ValueType })
  | (ExprBase & { k: 'logical'; op: '&&' | '||'; left: Expr; right: Expr })
  | (ExprBase & { k: 'assign'; op: string; target: Expr; value: Expr; opType?: ValueType })
  | (ExprBase & { k: 'cond'; test: Expr; then: Expr; else: Expr })
  | (ExprBase & { k: 'call'; callee: string; args: Expr[]; fn?: FunctionDecl; builtin?: string })
  | (ExprBase & { k: 'method'; object: string; method: string; args: Expr[] })
  | (ExprBase & { k: 'cast'; to: ValueType; arg: Expr });

export interface VarDeclarator extends Pos {
  name: string;
  init?: Expr;
  /** Filled by the checker. */
  ref?: Ref;
}

interface StmtBase extends Pos {
  /** Filled by the checker: a leaf statement that never suspends. */
  sync?: boolean;
}

export interface DeclStmt extends StmtBase {
  k: 'decl';
  type: ValueType;
  isConst: boolean;
  isStatic: boolean;
  decls: VarDeclarator[];
}

export interface BlockStmt extends StmtBase {
  k: 'block';
  body: Stmt[];
}

export type Stmt =
  | BlockStmt
  | DeclStmt
  | (StmtBase & { k: 'expr'; expr: Expr })
  | (StmtBase & { k: 'if'; test: Expr; then: Stmt; else?: Stmt })
  | (StmtBase & { k: 'while'; test: Expr; body: Stmt })
  | (StmtBase & { k: 'do'; body: Stmt; test: Expr })
  | (StmtBase & { k: 'for'; init?: Stmt; test?: Expr; update?: Expr; body: Stmt })
  | (StmtBase & { k: 'break' })
  | (StmtBase & { k: 'continue' })
  | (StmtBase & { k: 'return'; value?: Expr })
  | (StmtBase & {
      k: 'switch';
      disc: Expr;
      body: Stmt[];
      /** `case` labels in order: the value (null for default) and where it starts in body. */
      labels: { value: Expr | null; index: number; line: number; resolved?: number }[];
    })
  | (StmtBase & { k: 'empty' });

export interface Param extends Pos {
  name: string;
  type: ValueType;
}

export interface FunctionDecl extends Pos {
  name: string;
  ret: TypeName;
  params: Param[];
  body?: BlockStmt;
  /** Filled by the checker. */
  frameSize?: number;
  yields?: boolean;
  /** Slots of the parameters in the frame. */
  paramSlots?: number[];
}

export interface ProgramAst {
  globals: DeclStmt[];
  functions: FunctionDecl[];
  /** Global declarations and functions in source order. */
  order: (DeclStmt | FunctionDecl)[];
}
