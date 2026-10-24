import { describe, expect, it } from 'vitest';
import { MaquinaController, PAUSA_AULA } from './maquina-controller';
import {
  CAUSAS,
  ESTADOS,
  Rastreador,
  TRANSICOES,
  proximoEstado,
  sinalDaMensagem,
  textoRegistro,
  type Registro,
} from './maquina-estados';

/** Runs the live central in frames of 1/60 s at 5×, like the widget. */
function run(m: MaquinaController, seconds: number) {
  const frame = 5 / 60;
  for (let t = 0; t < seconds; t += frame) m.advance(frame);
}

function until(m: MaquinaController, estado: string, limit = 120) {
  const frame = 5 / 60;
  for (let t = 0; t < limit; t += frame) {
    m.advance(frame);
    if (m.getSnapshot().central.estado === estado) return;
  }
  throw new Error(`não chegou a ${estado}`);
}

const pares = (rs: readonly Registro[]) =>
  [...rs].reverse().map((r) => `${r.de}>${r.para}:${r.causa}${r.recusado ? ':recusado' : ''}`);

describe('state machine table of lesson 12.2', () => {
  it('names every state and gives every transition a cause', () => {
    for (const t of TRANSICOES) {
      expect(ESTADOS).toContain(t.de);
      expect(ESTADOS).toContain(t.para);
      expect(t.causas.length).toBeGreaterThan(0);
      for (const c of t.causas)
        expect(
          proximoEstado(t.de, c, t.de === 'PARADO' && t.para === 'FECHANDO' ? 'abrir' : 'fechar'),
        ).toBe(t.para);
    }
  });

  it('follows the firmware rules for a command', () => {
    expect(proximoEstado('FECHADO', 'comando', 'fechar')).toBe('ABRINDO');
    expect(proximoEstado('ABRINDO', 'comando', 'abrir')).toBe('PARADO');
    expect(proximoEstado('ABERTO', 'comando', 'abrir')).toBe('FECHANDO');
    expect(proximoEstado('ABERTO', 'comando', 'abrir', true)).toBe('ABERTO');
    expect(proximoEstado('FECHANDO', 'comando', 'fechar')).toBe('ABRINDO');
    expect(proximoEstado('PARADO', 'comando', 'abrir')).toBe('FECHANDO');
    expect(proximoEstado('PARADO', 'comando', 'fechar')).toBe('ABRINDO');
    expect(proximoEstado('ERRO', 'comando', 'abrir')).toBe('ABRINDO');
    expect(proximoEstado('FECHADO', 'fca', 'fechar')).toBeUndefined();
  });

  it('reads the cause from the firmware messages', () => {
    expect(sinalDaMensagem('Comando (controle): abrindo.')).toBe('comando');
    expect(sinalDaMensagem('Fim de curso de abertura: portão aberto, motor desligado.')).toBe(
      'fca',
    );
    expect(sinalDaMensagem('Pausa encerrada: fechamento automático.')).toBe('pausa');
    expect(sinalDaMensagem('Controle cadastrado (1 de 32 botões na memória).')).toBeNull();
  });

  it('writes the log line in pt-BR', () => {
    expect(textoRegistro({ t: 12.43, de: 'ABRINDO', para: 'ABERTO', causa: 'fca' })).toBe(
      't = 12,4 s: ABRINDO → ABERTO (fim de curso de abertura)',
    );
    expect(
      textoRegistro({
        t: 1.7,
        de: 'FECHADO',
        para: 'ABRINDO',
        causa: 'comando',
        origem: 'controle',
      }),
    ).toBe('t = 1,7 s: FECHADO → ABRINDO (comando do controle)');
    expect(CAUSAS.comando).toBe('comando (controle ou botoeira)');
  });
});

describe('the live central of lesson 12.2', () => {
  it('opens, waits the pause and closes by itself', () => {
    const m = new MaquinaController();
    expect(m.getSnapshot().central.estado).toBe('FECHADO');
    m.remote();
    until(m, 'ABERTO');
    const aberto = m.getSnapshot().central;
    expect(aberto.fechamentoAutomatico).toBe(true);
    expect(aberto.pausaRestante).toBeGreaterThan(PAUSA_AULA - 0.5);
    until(m, 'FECHANDO', PAUSA_AULA + 1);
    until(m, 'FECHADO');
    expect(pares(m.getSnapshot().registros)).toEqual([
      'FECHADO>ABRINDO:comando',
      'ABRINDO>ABERTO:fca',
      'ABERTO>FECHANDO:pausa',
      'FECHANDO>FECHADO:fcf',
    ]);
  });

  it('takes about 16 s to open (typical 15 m/min gate)', () => {
    const m = new MaquinaController();
    m.remote();
    until(m, 'ABERTO');
    const r = m.getSnapshot().registros[0]!;
    expect(r.t).toBeGreaterThan(15);
    expect(r.t).toBeLessThan(18);
  });

  it('stops on a command while opening and then closes', () => {
    const m = new MaquinaController();
    m.remote();
    run(m, 4);
    m.remote();
    run(m, 1);
    expect(m.getSnapshot().central.estado).toBe('PARADO');
    m.remote();
    run(m, 0.5);
    expect(pares(m.getSnapshot().registros)).toEqual([
      'FECHADO>ABRINDO:comando',
      'ABRINDO>PARADO:comando',
      'PARADO>FECHANDO:comando',
    ]);
  });

  it('opens again when the beam is cut while closing, and refuses to close with it cut', () => {
    const m = new MaquinaController();
    m.setAutoClose(false);
    m.remote();
    until(m, 'ABERTO');
    m.remote();
    run(m, 2);
    m.setBeam(true);
    run(m, 0.5);
    expect(m.getSnapshot().central.estado).toBe('ABRINDO');
    until(m, 'ABERTO');
    m.remote();
    run(m, 0.5);
    expect(m.getSnapshot().central.estado).toBe('ABERTO');
    expect(pares(m.getSnapshot().registros).slice(-4)).toEqual([
      'ABERTO>FECHANDO:comando',
      'FECHANDO>ABRINDO:fotocelula',
      'ABRINDO>ABERTO:fca',
      'ABERTO>ABERTO:comando:recusado',
    ]);
  });

  it('opens again when the closing gate hits an obstacle', () => {
    const m = new MaquinaController();
    m.setAutoClose(false);
    m.remote();
    until(m, 'ABERTO');
    m.setObstacle(true);
    m.remote();
    until(m, 'ABRINDO', 30);
    expect(m.getSnapshot().registros[0]).toMatchObject({
      de: 'FECHANDO',
      para: 'ABRINDO',
      causa: 'obstaculo',
    });
  });

  it('goes to ERRO after 40 s without a limit switch (manual release open)', () => {
    const m = new MaquinaController({ cenario: 'destravado' });
    m.remote();
    until(m, 'ERRO', 45);
    const r = m.getSnapshot().registros[0]!;
    expect(r).toMatchObject({ de: 'ABRINDO', para: 'ERRO', causa: 'tempo-maximo' });
    expect(r.t).toBeGreaterThan(40);
    expect(r.t).toBeLessThan(41);
    m.remote();
    run(m, 0.5);
    expect(m.getSnapshot().registros[0]).toMatchObject({ de: 'ERRO', para: 'ABRINDO' });
  });

  it('takes a press of the push button as a command', () => {
    const m = new MaquinaController();
    m.pressBotoeira();
    expect(m.getSnapshot().botoeira).toBe(true);
    run(m, 1);
    expect(m.getSnapshot().botoeira).toBe(false);
    expect(m.getSnapshot().registros[0]).toMatchObject({
      de: 'FECHADO',
      para: 'ABRINDO',
      causa: 'comando',
      origem: 'botoeira',
    });
  });

  it('starts a new log on reset', () => {
    const m = new MaquinaController();
    m.remote();
    run(m, 1);
    expect(m.getSnapshot().registros.length).toBe(1);
    m.reset();
    expect(m.getSnapshot().registros.length).toBe(0);
    expect(m.getSnapshot().central.estado).toBe('FECHADO');
  });

  it('explains several transitions in one frame', () => {
    const r = new Rastreador();
    r.observar({ t: 0.01, estado: 'FECHADO', eventos: [] });
    const out = r.observar({
      t: 0.5,
      estado: 'PARADO',
      eventos: [
        { t: 0.4, message: 'Comando (botoeira) durante a abertura: o portão para.' },
        { t: 0.2, message: 'Comando (controle): abrindo.' },
      ],
    });
    expect(out.map((x) => `${x.de}>${x.para}`)).toEqual(['FECHADO>ABRINDO', 'ABRINDO>PARADO']);
  });
});
