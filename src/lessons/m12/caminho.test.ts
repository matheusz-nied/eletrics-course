import { describe, expect, it } from 'vitest';
import {
  CASA_INICIAL,
  CONDICOES_INICIAIS,
  LATENCIA_TIPICA,
  aplicarComando,
  cortarEnergia,
  enviar,
  voltarEnergia,
  type Condicoes,
} from './caminho';

const c = (x: Partial<Condicoes> = {}): Condicoes => ({ ...CONDICOES_INICIAIS, ...x });
const nos = (r: ReturnType<typeof enviar>) => [r.caminho[0]!.de, ...r.caminho.map((t) => t.para)];

describe('path of a smart-home command (lesson 12.6)', () => {
  it('goes through the cloud and back, in about 0,5 s', () => {
    const r = enviar('app', c());
    expect(r.chegou).toBe(true);
    expect(nos(r)).toEqual([
      'celular',
      'roteador',
      'internet',
      'nuvem',
      'internet',
      'roteador',
      'rele',
      'lampada',
    ]);
    expect(r.latenciaMs).toBe(505);
    expect(r.latenciaMs).toBeGreaterThanOrEqual(LATENCIA_TIPICA.nuvem.de);
    expect(r.latenciaMs).toBeLessThanOrEqual(LATENCIA_TIPICA.nuvem.ate);
  });

  it('stays inside the house on the local network, in under 0,1 s', () => {
    const r = enviar('app', c({ modo: 'local' }));
    expect(r.chegou).toBe(true);
    expect(nos(r)).toEqual(['celular', 'roteador', 'servidor', 'roteador', 'rele', 'lampada']);
    expect(r.latenciaMs).toBe(85);
    expect(r.latenciaMs).toBeGreaterThanOrEqual(LATENCIA_TIPICA.local.de);
  });

  it('fails through the cloud without internet, works locally', () => {
    const nuvem = enviar('app', c({ internetCaiu: true }));
    expect(nuvem).toMatchObject({ chegou: false, falha: 'internet', paradaEm: 1 });
    expect(nuvem.explicacao).toContain('Sem internet, o comando pela nuvem não chega.');
    expect(nuvem.explicacao).toContain('O interruptor da parede continua funcionando');
    expect(enviar('app', c({ modo: 'local', internetCaiu: true })).chegou).toBe(true);
  });

  it('only works from outside through the cloud', () => {
    const fora = enviar('app', c({ foraDeCasa: true }));
    expect(fora.chegou).toBe(true);
    expect(fora.caminho[0]).toMatchObject({ de: 'celular', para: 'internet', meio: 'dados' });
    expect(fora.latenciaMs).toBe(570);
    const local = enviar('app', c({ modo: 'local', foraDeCasa: true }));
    expect(local).toMatchObject({ chegou: false, falha: 'sem-acesso-remoto' });
    const semNet = enviar('app', c({ modo: 'local', foraDeCasa: true, internetCaiu: true }));
    expect(semNet.falha).toBe('sem-acesso-remoto');
    const nuvemSemNet = enviar('app', c({ foraDeCasa: true, internetCaiu: true }));
    expect(nuvemSemNet).toMatchObject({ falha: 'internet', paradaEm: 3 });
  });

  it('cannot reach the relay without Wi-Fi, even when the cloud gets the command', () => {
    const r = enviar('app', c({ wifiDesligado: true }));
    expect(r).toMatchObject({ chegou: false, falha: 'wifi' });
    expect(r.caminho[r.paradaEm!]).toMatchObject({ de: 'roteador', para: 'rele' });
    expect(enviar('app', c({ modo: 'local', wifiDesligado: true })).paradaEm).toBe(0);
  });

  it('keeps the wall switch working without internet or Wi-Fi, not without power', () => {
    const sw = enviar('interruptor', c({ internetCaiu: true, wifiDesligado: true }));
    expect(sw.chegou).toBe(true);
    expect(sw.latenciaMs).toBe(25);
    expect(enviar('interruptor', c({ faltaEnergia: true }))).toMatchObject({
      chegou: false,
      falha: 'energia',
    });
    expect(enviar('app', c({ faltaEnergia: true })).falha).toBe('energia');
  });

  it('turns the lamp on and off', () => {
    const r = enviar('app', c());
    const acesa = aplicarComando(CASA_INICIAL, r, true);
    expect(acesa.lampada).toBe(true);
    const sw = enviar('interruptor', c());
    expect(aplicarComando(acesa, sw, false).lampada).toBe(false);
    const falhou = enviar('app', c({ internetCaiu: true }));
    expect(aplicarComando(acesa, falhou, false).lampada).toBe(true);
  });

  it('comes back after a power cut as configured', () => {
    const acesa = { lampada: true, antesDaFalta: false };
    const sem = cortarEnergia(acesa);
    expect(sem.lampada).toBe(false);
    expect(voltarEnergia(sem, 'anterior').lampada).toBe(true);
    expect(voltarEnergia(sem, 'desligado').lampada).toBe(false);
  });
});
