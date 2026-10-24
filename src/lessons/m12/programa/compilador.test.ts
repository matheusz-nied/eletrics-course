import { describe, expect, it } from 'vitest';
import { compile } from './checker';

const wrap = (loop: string, extra = '') =>
  `${extra}\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n${loop}\n}\n`;

function errorOf(src: string) {
  const r = compile(src);
  if (r.ok) throw new Error('compiled');
  return r.error;
}

describe('compile: valid programs', () => {
  it('accepts the Blink', () => {
    const r = compile(
      'void setup() { pinMode(LED_BUILTIN, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000); }',
    );
    expect(r.ok).toBe(true);
  });

  it('accepts types, qualifiers, #define, comments and every statement', () => {
    const src = `
#define LED 13
/* block
   comment */
const unsigned long INTERVALO = 500UL;
unsigned long antes = 0;
long total = 0L;
float f = 1.5f;
boolean b = true;
byte x = B101;
int dobro(int v) { return v * 2; }
void setup() { Serial.begin(9600); pinMode(LED, OUTPUT); }
void loop() {
  static int conta = 0;
  int i = 0;
  do { i++; } while (i < 3);
  for (int j = 0; j < 4; j += 1) { if (j == 2) continue; total += j; }
  while (true) { break; }
  switch (conta % 3) { case 0: total++; break; case 1: case 2: total--; break; default: break; }
  int t = (i > 2) ? dobro(i) : -i;
  f = (float)t / 3;
  total = constrain(total, -10, 10) + abs(-3) + min(1, 2) + max(1, 2);
  Serial.println(F("ok"));
  Serial.print(t, HEX);
  conta++;
  digitalWrite(LED, !digitalRead(LED));
  if (millis() - antes >= INTERVALO) antes = millis();
}`;
    const r = compile(src);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.ok).toBe(true);
  });

  it('allows functions used before they are defined (Arduino prototypes)', () => {
    const r = compile('void setup() { piscar(); }\nvoid loop() {}\nvoid piscar() { delay(1); }');
    expect(r.ok).toBe(true);
  });

  it('ignores #include with a warning', () => {
    const r = compile('#include <Servo.h>\nvoid setup() {}\nvoid loop() {}');
    expect(r.ok).toBe(true);
    expect(r.warnings[0]!.message).toMatch(/#include/);
  });
});

describe('compile: errors in pt-BR with line numbers', () => {
  it('missing semicolon at the end of a line', () => {
    const e = errorOf(
      'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH)\n  delay(1000);\n}',
    );
    expect(e.message).toBe(
      "Falta um ponto e vírgula ';' no fim da linha 6. Em C, toda instrução termina com ';'.",
    );
    expect(e.line).toBe(6);
    expect(e.col).toBe(25);
  });

  it('missing semicolon in the middle of a line', () => {
    const e = errorOf(wrap('  int a = 1 int b = 2;'));
    expect(e.message).toMatch(/Falta um ponto e vírgula ';' antes de 'int' na linha 7/);
  });

  it('unknown identifier, with the case hint and a suggestion', () => {
    const e = errorOf(wrap('  digitalWrite(ledPin, HIGH);', 'int LedPin = 13;'));
    expect(e.message).toBe(
      "'ledPin' não foi declarado (linha 7). Confira se escreveu igual na declaração (maiúsculas contam). Você quis dizer 'LedPin'?",
    );
    expect(e.line).toBe(7);
  });

  it('unknown function with a suggestion', () => {
    const e = errorOf(wrap('  digitalwrite(13, HIGH);'));
    expect(e.message).toMatch(
      /A função 'digitalwrite' não existe \(linha 7\)\. Você quis dizer 'digitalWrite'\?/,
    );
  });

  it('unclosed brace at the end', () => {
    const e = errorOf('void setup() {\n}\nvoid loop() {\n  if (true) {\n    delay(1);\n}\n');
    expect(e.message).toMatch(/Falta fechar a chave '\{' aberta na linha 3 \(no bloco de 'loop'\)/);
  });

  it('missing brace before the next function', () => {
    const e = errorOf('void setup() {\n  pinMode(13, OUTPUT);\n\nvoid loop() {\n}\n');
    expect(e.message).toMatch(/A função 'loop' \(linha 4\) começa dentro de outro bloco/);
    expect(e.line).toBe(4);
  });

  it('extra closing brace', () => {
    const e = errorOf('void setup() {\n}\n}\nvoid loop() {}');
    expect(e.message).toMatch(/chave '\}' sobrando na linha 3/);
  });

  it('missing setup and loop', () => {
    expect(errorOf('void setup() {}').message).toMatch(/^Falta a função loop\(\)/);
    expect(errorOf('void loop() {}').message).toMatch(/^Falta a função setup\(\)/);
    expect(errorOf('int x = 1;').message).toMatch(/^Faltam as funções setup\(\) e loop\(\)/);
  });

  it('missing void before setup', () => {
    expect(errorOf('setup() {}\nvoid loop() {}').message).toMatch(/escreva 'void setup\(\)'/);
  });

  it('wrong number of arguments', () => {
    const e = errorOf(wrap('  digitalWrite(13);'));
    expect(e.message).toBe(
      "'digitalWrite' recebe 2 valores, mas aqui recebeu 1 (linha 7). Uso: digitalWrite(pino, HIGH).",
    );
  });

  it('assigning to a const', () => {
    const e = errorOf(wrap('  LED = 12;', 'const int LED = 13;'));
    expect(e.message).toMatch(/'LED' é uma constante \(const\) e não pode mudar/);
  });

  it('string outside Serial.print', () => {
    expect(errorOf(wrap('  int x = "oi";')).message).toMatch(
      /Texto entre aspas só pode ir dentro de Serial\.print/,
    );
  });

  it('single quotes around a word', () => {
    expect(errorOf(wrap("  Serial.print('ola');")).message).toMatch(
      /Aspas simples guardam um único caractere/,
    );
  });

  it('modulo with float', () => {
    expect(errorOf(wrap('  float x = 5.0 % 2;')).message).toMatch(
      /O operador '%' só funciona com números inteiros/,
    );
  });

  it('variable used before its declaration', () => {
    const e = errorOf('void setup() { x = 1; }\nvoid loop() {}\nint x;');
    expect(e.message).toMatch(/'x' só é declarado na linha 3/);
  });

  it('unclosed parenthesis', () => {
    const e = errorOf(wrap('  if (digitalRead(2) == LOW {\n  }'));
    expect(e.message).toMatch(/Falta fechar o parêntese de 'if'/);
  });

  it('an unknown type', () => {
    expect(errorOf(wrap('  Int x = 3;')).message).toMatch(
      /'Int' não é um tipo conhecido \(linha 7\)\. Você quis dizer 'int'\?/,
    );
  });

  it('break outside a loop', () => {
    expect(errorOf(wrap('  break;')).message).toMatch(/'break' só funciona dentro de um laço/);
  });

  it('returning a value from a void function', () => {
    expect(errorOf(wrap('  return 3;')).message).toMatch(/é void/);
  });

  it('arrays are reported as not supported', () => {
    expect(errorOf(wrap('', 'int leds[3];')).message).toMatch(/Vetores/);
  });

  it('unclosed comment and string', () => {
    expect(errorOf('/* oi\nvoid setup() {}').message).toMatch(
      /comentário aberto com '\/\*' na linha 1/,
    );
    expect(errorOf(wrap('  Serial.print("oi);')).message).toMatch(
      /texto aberto com aspas na linha 7/,
    );
  });
});

describe('compile: warnings', () => {
  it('= inside an if', () => {
    const r = compile(wrap('  int x = 0;\n  if (x = 5) { }'));
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.message).join()).toMatch(/Para comparar, use '=='/);
  });

  it('a constant that does not fit an int', () => {
    const r = compile(wrap('  int x = 40000;'));
    expect(r.warnings[0]!.message).toMatch(/o valor 40000 não cabe num int/);
  });
});
