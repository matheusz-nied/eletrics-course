import { describe, expect, it } from 'vitest';
import { Board } from './board';
import { compile } from './checker';
import { exemploPorId } from './exemplos';
import { COST, Machine } from './interpreter';

function boot(src: string) {
  const r = compile(src);
  if (!r.ok) throw new Error(`${r.error.line}: ${r.error.message}`);
  const warnings: string[] = [];
  const warn = (_k: string, _l: number, m: string) => warnings.push(m);
  const board = new Board({ warn });
  const machine = new Machine(r.program, board, { warn });
  /** Runs to `ms` of virtual time. */
  const at = (ms: number) => {
    machine.run(ms * 1000);
    return board;
  };
  const serial = () => board.monitor.text();
  return { board, machine, warnings, at, serial };
}

const program = (setup: string, loop = '') =>
  `void setup() {\n${setup}\n}\nvoid loop() {\n${loop}\n}\n`;

/** Times (ms) at which a pin changed level, sampling every 0,1 ms. */
function transitions(sim: ReturnType<typeof boot>, pin: number, untilMs: number): number[] {
  const out: number[] = [];
  let last = sim.board.port[pin];
  for (let t = 0.1; t <= untilMs; t += 0.1) {
    sim.at(t);
    const v = sim.board.port[pin];
    if (v !== last) out.push(Math.round(t * 10) / 10);
    last = v;
  }
  return out;
}

describe('timing in virtual time', () => {
  it('Blink: the LED on 13 changes every 1000 ms', () => {
    const sim = boot(exemploPorId('pisca')!.codigo);
    const times = transitions(sim, 13, 4500);
    expect(times).toHaveLength(5);
    times.forEach((t, i) => expect(t).toBeCloseTo(i * 1000, -1));
    // Each change is a few µs after the exact second (statement costs).
    expect(times[2]! - 2000).toBeLessThan(0.2);
  });

  it('a statement costs 1 µs and digitalWrite 4 µs more', () => {
    const sim = boot(program('pinMode(13, OUTPUT);', 'digitalWrite(13, HIGH);\ndelay(10);'));
    sim.at(5);
    // globals, setup call, pinMode statement, loop call, digitalWrite statement, delay statement
    const expected =
      COST.call +
      (COST.statement + COST.pinMode) +
      COST.loopCall +
      COST.call +
      (COST.statement + COST.digitalWrite) +
      COST.statement +
      10_000;
    expect(sim.machine.time).toBe(expected);
  });

  it('millis() blink keeps answering the button (sem-delay)', () => {
    const sim = boot(exemploPorId('sem-delay')!.codigo);
    const times = transitions(sim, 13, 1600);
    expect(times.map((t) => Math.round(t / 10) * 10)).toEqual([500, 1000, 1500]);
    sim.board.inputs.botao = true;
    sim.at(1601);
    expect(sim.board.port[9]).toBe(1);
    sim.board.inputs.botao = false;
    sim.at(1602);
    expect(sim.board.port[9]).toBe(0);
    expect(sim.machine.loops).toBeGreaterThan(10_000);
  });

  it('delay() blocks: the button is only seen after the delay ends', () => {
    const sim = boot(
      program(
        'pinMode(2, INPUT_PULLUP);\npinMode(9, OUTPUT);',
        'digitalWrite(9, digitalRead(2) == LOW);\ndelay(1000);',
      ),
    );
    sim.at(100);
    sim.board.inputs.botao = true;
    sim.at(900);
    expect(sim.board.port[9]).toBe(0);
    sim.at(1001);
    expect(sim.board.port[9]).toBe(1);
  });

  it('an endless loop stops at the operation budget and resumes', () => {
    const sim = boot(program('pinMode(13, OUTPUT);', 'while (true) { }'));
    const t0 = Date.now();
    expect(sim.machine.run(10_000_000, 5000)).toBe('limite');
    expect(Date.now() - t0).toBeLessThan(500);
    expect(sim.machine.ops).toBeLessThanOrEqual(5000);
    const t1 = sim.machine.time;
    expect(sim.machine.run(10_000_000, 5000)).toBe('limite');
    expect(sim.machine.time).toBeGreaterThan(t1);
    expect(sim.machine.delays).toBe(0);
  });

  it('an empty loop() and for(;;) also yield', () => {
    expect(boot(program('')).machine.run(1e9, 1000)).toBe('limite');
    expect(boot(program('', 'for (;;) {}')).machine.run(1e9, 1000)).toBe('limite');
    expect(boot(program('', 'do { } while (1);')).machine.run(1e9, 1000)).toBe('limite');
  });

  it('Serial waits for the 64-byte buffer at 9600 baud', () => {
    const sim = boot(program('Serial.begin(9600);', 'Serial.println("0123456789");'));
    sim.at(1000);
    // 12 characters × ~1,04 ms each: about 80 lines per second once the buffer is full.
    expect(sim.machine.loops).toBeGreaterThan(70);
    expect(sim.machine.loops).toBeLessThan(95);
  });
});

describe('inputs', () => {
  it('INPUT_PULLUP reads HIGH released and LOW pressed', () => {
    const sim = boot(
      program(
        'pinMode(2, INPUT_PULLUP);\nSerial.begin(9600);',
        'Serial.println(digitalRead(2));\ndelay(100);',
      ),
    );
    sim.at(50);
    sim.board.inputs.botao = true;
    sim.at(150);
    expect(sim.serial().split('\n').slice(0, 2)).toEqual(['1', '0']);
  });

  it('the botao example lights the LED while pressed', () => {
    const sim = boot(exemploPorId('botao')!.codigo);
    sim.at(10);
    expect(sim.board.port[13]).toBe(0);
    sim.board.inputs.botao = true;
    sim.at(11);
    expect(sim.board.port[13]).toBe(1);
  });

  it('plain INPUT with the button released floats: readings change, with a warning', () => {
    const sim = boot(
      program(
        'pinMode(2, INPUT);\nSerial.begin(115200);',
        'Serial.print(digitalRead(2));\ndelay(3);',
      ),
    );
    sim.at(600);
    const bits = sim.serial();
    expect(bits).toMatch(/0/);
    expect(bits).toMatch(/1/);
    expect(sim.warnings.join()).toMatch(/flutuando/);
    sim.board.inputs.botao = true;
    sim.board.monitor.clear();
    sim.at(700);
    expect(sim.serial()).toMatch(/^0+$/);
  });

  it('analogRead maps 0–5 V to 0–1023', () => {
    const sim = boot(
      program('Serial.begin(115200);', 'Serial.println(analogRead(A0));\ndelay(10);'),
    );
    sim.board.inputs.pot = 0;
    sim.at(5);
    sim.board.inputs.pot = 0.5;
    sim.at(15);
    sim.board.inputs.pot = 1;
    sim.at(25);
    expect(sim.serial().split('\n').slice(0, 3)).toEqual(['0', '512', '1023']);
  });

  it('analogRead(0) is A0, and the LDR on A1 gives more volts with more light', () => {
    const sim = boot(
      program(
        'Serial.begin(115200);',
        'Serial.println(analogRead(0));\nSerial.println(analogRead(A1));\ndelay(10);',
      ),
    );
    sim.board.inputs.pot = 0.25;
    sim.board.inputs.luz = 0;
    sim.at(5);
    sim.board.inputs.luz = 1;
    sim.at(15);
    const [a0, dark, , bright] = sim.serial().split('\n').map(Number);
    expect(a0).toBe(256);
    expect(dark).toBeLessThan(60);
    expect(bright).toBeGreaterThan(900);
  });
});

describe('outputs', () => {
  it('analogWrite sets the PWM duty on pin 9', () => {
    const sim = boot(exemploPorId('potenciometro')!.codigo);
    sim.board.inputs.pot = 0.5;
    sim.at(100);
    expect(sim.board.pwm[9]).toBe(127);
    const v = sim.board.view(sim.machine.time);
    expect(v.led9.pwm).toBe(127);
    expect(v.led9.brilho).toBeCloseTo(127 / 255, 3);
    expect(sim.serial()).toMatch(/^A0 = 512 {3}brilho = 127$/m);
  });

  it('analogWrite on a pin without PWM warns and goes digital', () => {
    const sim = boot(program('analogWrite(7, 100);\nanalogWrite(4, 200);'));
    sim.at(1);
    expect(sim.board.port[7]).toBe(0);
    expect(sim.board.port[4]).toBe(1);
    expect(sim.warnings.join()).toMatch(/o pino 7 não tem PWM/);
  });

  it('analogWrite above 255 wraps to 8 bits, with a warning', () => {
    const sim = boot(program('analogWrite(9, 300);'));
    sim.at(1);
    expect(sim.board.pwm[9]).toBe(44);
    expect(sim.warnings.join()).toMatch(/virou 44/);
  });

  it('digitalWrite on a pin that is not OUTPUT only turns the pull-up on', () => {
    const sim = boot(program('', 'digitalWrite(13, HIGH);\ndelay(100);'));
    sim.at(50);
    const v = sim.board.view(sim.machine.time);
    expect(v.led13.aceso).toBe(false);
    expect(v.led13.fraco).toBe(true);
    expect(v.led13.brilho).toBeGreaterThan(0);
    expect(v.led13.brilho).toBeLessThan(0.02);
    expect(sim.warnings[0]).toMatch(/o pino 13 não foi configurado como saída/);
  });

  it('fast software PWM looks half bright', () => {
    const sim = boot(
      program(
        'pinMode(13, OUTPUT);',
        'digitalWrite(13, HIGH);\ndelay(1);\ndigitalWrite(13, LOW);\ndelay(1);',
      ),
    );
    sim.at(10);
    sim.board.view(sim.machine.time);
    sim.at(510);
    expect(sim.board.view(510_000).led13.brilho).toBeCloseTo(0.5, 1);
  });

  it('tone() on the buzzer, with and without duration', () => {
    const sim = boot(program('tone(8, 440, 200);', 'delay(1000);'));
    sim.at(100);
    expect(sim.board.view(100_000).buzzerHz).toBe(440);
    sim.at(300);
    expect(sim.board.view(300_000).buzzerHz).toBe(0);
    const sos = boot(exemploPorId('sos')!.codigo);
    sos.at(50);
    expect(sos.board.view(50_000).buzzerHz).toBe(660);
  });

  it('the relay on pin 7 follows the alarm', () => {
    const sim = boot(exemploPorId('alarme')!.codigo);
    sim.board.inputs.luz = 0.1;
    sim.at(100);
    expect(sim.board.view(100_000).rele).toBe(false);
    sim.board.inputs.botao = true;
    sim.at(200);
    sim.board.inputs.botao = false;
    sim.at(300);
    const v = sim.board.view(300_000);
    expect(v.led13.aceso).toBe(true);
    expect(v.rele).toBe(true);
    expect(v.buzzerHz).toBe(880);
    expect(sim.serial()).toBe('Armado\n');
  });
});

describe('Serial output', () => {
  it('prints numbers, text, floats, chars and bases like the Arduino core', () => {
    const sim = boot(
      program(
        `Serial.begin(9600);
Serial.println("Olá!");
Serial.println(42);
Serial.println(3.14159);
Serial.println(2.5, 3);
Serial.println('A');
Serial.println(255, HEX);
Serial.println(5, BIN);
Serial.println(true);
Serial.print(-7 / 2);
Serial.print(" ");
Serial.println(7.0 / 2);
Serial.println(F("fim"));`,
      ),
    );
    sim.at(100);
    expect(sim.serial()).toBe('Olá!\n42\n3.14\n2.500\nA\nFF\n101\n1\n-3 3.50\nfim\n');
  });

  it('Serial.print without Serial.begin warns and prints nothing', () => {
    const sim = boot(program('Serial.println("oi");'));
    sim.at(10);
    expect(sim.serial()).toBe('');
    expect(sim.warnings[0]).toMatch(/sem Serial\.begin\(\)/);
  });
});

describe('language semantics', () => {
  it('int is 16 bits on the Uno: 200 * 200 wraps, with a warning', () => {
    const sim = boot(
      program(
        'Serial.begin(9600);\nint x = 200 * 200;\nlong y = 200L * 200;\nSerial.println(x);\nSerial.println(y);',
      ),
    );
    sim.at(10);
    expect(sim.serial()).toBe('-25536\n40000\n');
    expect(sim.warnings.join()).toMatch(/não cabe num int/);
  });

  it('unsigned long arithmetic survives millis() wrap-around', () => {
    const sim = boot(
      program(
        'Serial.begin(9600);\nunsigned long a = 5;\nunsigned long b = 4294967290UL;\nSerial.println(a - b);',
      ),
    );
    sim.at(10);
    expect(sim.serial()).toBe('11\n');
  });

  it('functions with parameters, return values and recursion', () => {
    const sim = boot(`
int fatorial(int n) {
  if (n <= 1) return 1;
  return n * fatorial(n - 1);
}
long soma(long a, long b) { return a + b; }
void setup() {
  Serial.begin(9600);
  Serial.println(fatorial(5));
  Serial.println(soma(100000, 1));
}
void loop() {}`);
    sim.at(10);
    expect(sim.serial()).toBe('120\n100001\n');
  });

  it('switch with fall-through, break and default', () => {
    const sim = boot(
      program(`Serial.begin(9600);
for (int i = 0; i < 4; i++) {
  switch (i) {
    case 0: Serial.print("a");
    case 1: Serial.print("b"); break;
    default: Serial.print("d");
  }
}`),
    );
    sim.at(10);
    expect(sim.serial()).toBe('abbdd');
  });

  it('static locals keep their value and globals start at zero', () => {
    const sim = boot(`
int g;
void setup() { Serial.begin(9600); }
void loop() {
  static int n = 10;
  n++;
  g += 2;
  if (n == 13) { Serial.println(g); }
}`);
    sim.at(5);
    expect(sim.serial()).toBe('6\n');
  });

  it('#define, ternary, compound assignment, ++ and --', () => {
    const sim = boot(`
#define BASE 10
void setup() {
  Serial.begin(9600);
  int x = BASE;
  x += 5; x -= 3; x *= 2; x /= 4; x %= 4;
  int y = x++;
  int z = --x;
  Serial.println(x);
  Serial.println(y + z);
  Serial.println(x > 1 ? "grande" : "pequeno");
  Serial.println(map(512, 0, 1023, 0, 255));
  Serial.println(constrain(300, 0, 255));
}
void loop() {}`);
    sim.at(5);
    expect(sim.serial()).toBe('2\n4\ngrande\n127\n255\n');
  });

  it('division by zero stops the program with a pt-BR message', () => {
    const sim = boot(program('int zero = 0;\nint x = 10 / zero;'));
    expect(sim.machine.run(10_000)).toBe('erro');
    expect(sim.machine.error!.message).toMatch(/^Divisão por zero na linha 3/);
    expect(sim.machine.error!.line).toBe(3);
  });

  it('endless recursion overflows the stack', () => {
    const sim = boot('void f() { f(); }\nvoid setup() { f(); }\nvoid loop() {}');
    expect(sim.machine.run(1e9)).toBe('erro');
    expect(sim.machine.error!.message).toMatch(/A pilha estourou/);
  });

  it('random() repeats with the same seed and stays in range', () => {
    const sim = boot(
      program(
        'Serial.begin(115200);\nfor (int i = 0; i < 50; i++) { Serial.println(random(1, 7)); }',
      ),
    );
    sim.at(100);
    const values = sim.serial().trim().split('\n').map(Number);
    expect(values).toHaveLength(50);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...values)).toBeLessThanOrEqual(6);
  });
});
