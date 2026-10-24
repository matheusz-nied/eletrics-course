import { describe, expect, it } from 'vitest';
import { Board } from './board';
import { compile } from './checker';
import { MicroController } from './controller';
import { EXEMPLOS } from './exemplos';
import { Machine } from './interpreter';

describe('examples', () => {
  it('have unique ids and at most 25 lines', () => {
    expect(new Set(EXEMPLOS.map((e) => e.id)).size).toBe(EXEMPLOS.length);
    for (const e of EXEMPLOS) expect(e.codigo.trimEnd().split('\n').length).toBeLessThanOrEqual(25);
    expect(EXEMPLOS.map((e) => e.id)).toEqual(
      expect.arrayContaining(['pisca', 'botao', 'potenciometro', 'sem-delay', 'alarme']),
    );
  });

  for (const e of EXEMPLOS) {
    it(`"${e.id}" compiles and runs 5 s without errors or warnings`, () => {
      const r = compile(e.codigo);
      if (!r.ok) throw new Error(r.error.message);
      expect(r.warnings).toEqual([]);
      const warnings: string[] = [];
      const warn = (_k: string, _l: number, m: string) => warnings.push(m);
      const m = new Machine(r.program, new Board({ warn }), { warn });
      // In chunks, like the widget: never more than 50.000 operations at once.
      for (let t = 0; t < 5e6; t += 16_667) m.run(t, 50_000);
      expect(m.status).toBe('rodando');
      expect(warnings).toEqual([]);
    });
  }
});

describe('MicroController', () => {
  it('uploads, runs in real time × speed, stops and restarts', () => {
    const c = new MicroController();
    expect(c.getSnapshot().estado).toBe('vazia');
    expect(c.enviar(EXEMPLOS[0]!.codigo)).toBe(true);
    expect(c.getSnapshot().estado).toBe('rodando');
    expect(c.getSnapshot().view.led13.aceso).toBe(true);
    c.advance(500);
    expect(c.getSnapshot().tempo).toBeCloseTo(500, 0);
    c.advance(600);
    expect(c.getSnapshot().view.led13.aceso).toBe(false);
    c.setVelocidade(10);
    c.advance(100);
    expect(c.getSnapshot().tempo).toBeCloseTo(2100, 0);
    c.parar();
    expect(c.getSnapshot().estado).toBe('parada');
    expect(c.getSnapshot().view.led13.aceso).toBe(false);
    c.reiniciar();
    expect(c.getSnapshot().tempo).toBe(0);
    expect(c.getSnapshot().view.led13.aceso).toBe(true);
  });

  it('a compile error keeps the old program running', () => {
    const c = new MicroController();
    c.enviar(EXEMPLOS[0]!.codigo);
    expect(c.enviar('void setup() {\n  pinMode(13 OUTPUT);\n}\nvoid loop() {}')).toBe(false);
    const s = c.getSnapshot();
    expect(s.estado).toBe('rodando');
    expect(s.erro?.tipo).toBe('compilacao');
    expect(s.erro?.line).toBe(2);
    expect(s.enviado).toBe(EXEMPLOS[0]!.codigo);
  });

  it('a run-time error stops the board with the message', () => {
    const c = new MicroController();
    c.enviar('int z = 0;\nvoid setup() {}\nvoid loop() {\n  int x = 1 / z;\n}');
    c.advance(10);
    const s = c.getSnapshot();
    expect(s.estado).toBe('erro');
    expect(s.erro?.tipo).toBe('execucao');
    expect(s.erro?.line).toBe(4);
  });

  it('an endless loop stays within the frame budget and flags it', () => {
    const c = new MicroController();
    c.enviar('void setup() {}\nvoid loop() {\n  while (true) {}\n}');
    c.setVelocidade(10);
    const t0 = performance.now();
    for (let i = 0; i < 40; i++) c.advance(16, 2);
    expect(performance.now() - t0).toBeLessThan(2000);
    const s = c.getSnapshot();
    expect(s.lento).toBe(true);
    expect(s.tempo).toBeLessThan(6400);
  });

  it('shows warnings once and the serial text', () => {
    const c = new MicroController();
    c.enviar(
      'void setup() { Serial.begin(9600); }\nvoid loop() { digitalWrite(13, HIGH); Serial.println("oi"); delay(100); }',
    );
    c.advance(350);
    const s = c.getSnapshot();
    expect(s.avisos).toHaveLength(1);
    expect(s.serial).toBe('oi\noi\noi\noi\n');
    c.limparSerial();
    expect(c.getSnapshot().serial).toBe('');
  });
});
