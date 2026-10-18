import { describe, expect, it } from 'vitest';
import { GATE_PARAMS } from '../central/plant';
import type { CentralController } from '../ui/central-controller';
import {
  CASOS,
  CAUSAS,
  MEDICOES,
  contextoDe,
  criarCentral,
  medir,
  type CasoDiagnostico,
  type ContextoMedicao,
  type MedicaoId,
} from '../ui/diagnostico-casos';

/**
 * The diagnosis exercise of lesson 16.9: every case's fault really shows
 * the symptom of its complaint in the central virtual, and the "Medições"
 * panel gives the right reading with the breaker on and off.
 */

const caso = (id: string): CasoDiagnostico => {
  const c = CASOS.find((k) => k.id === id);
  if (!c) throw new Error(`caso ${id} não existe`);
  return c;
};

/** Position of the gate in metres from closed. */
const pos = (ctl: CentralController) => ctl.getSnapshot().abertura * GATE_PARAMS.imaFca;

function start(id: string): CentralController {
  const ctl = criarCentral(caso(id));
  ctl.advance(0.2);
  return ctl;
}

function remote(ctl: CentralController): boolean {
  const sent = ctl.remote();
  ctl.advance(0.1);
  return sent;
}

function botoeira(ctl: CentralController): void {
  ctl.hold('botoeira', true);
  ctl.advance(0.2);
  ctl.hold('botoeira', false);
  ctl.advance(0.1);
}

/** Advances in small steps until `done` or `limit` seconds; returns the time taken. */
function until(ctl: CentralController, done: () => boolean, limit = 60): number {
  let t = 0;
  while (t < limit) {
    ctl.advance(0.05);
    t += 0.05;
    if (done()) break;
  }
  return t;
}

const logged = (ctl: CentralController, re: RegExp) =>
  ctl.getSnapshot().eventos.some((e) => re.test(e.message));

const ON: ContextoMedicao = { disjuntor: true, energizada: true, feixeInterrompido: false };
const OFF: ContextoMedicao = { disjuntor: false, energizada: false, feixeInterrompido: false };

describe('casos do diagnóstico', () => {
  it('have unique ids, the right cause among the options and feedback for each wrong one', () => {
    expect(new Set(CASOS.map((c) => c.id)).size).toBe(CASOS.length);
    for (const c of CASOS) {
      expect(c.opcoes, c.id).toContain(c.causa);
      expect(new Set(c.opcoes).size, c.id).toBe(c.opcoes.length);
      expect(c.opcoes.length, c.id).toBeGreaterThanOrEqual(3);
      for (const o of c.opcoes) {
        expect(CAUSAS[o], `${c.id}: ${o}`).toBeTruthy();
        if (o !== c.causa) expect(c.porQueNao[o], `${c.id}: ${o}`).toBeTruthy();
      }
      expect(c.porQueNao[c.causa], c.id).toBeUndefined();
      // The right answer is not always the first option.
      expect(c.grupos, c.id).toEqual(expect.arrayContaining(['comandos', 'energia']));
      expect(c.queixa.length + c.tarefa.length + c.explicacao.length).toBeGreaterThan(200);
    }
    expect(CASOS.filter((c) => c.opcoes[0] === c.causa).length).toBeLessThan(CASOS.length / 2);
  });

  it('only use faults the gate model has', () => {
    const known = new Set([
      'capacitorAberto',
      'fiosInvertidos',
      'reedDefeituoso',
      'fotocelulaDesalinhada',
      'desbloqueado',
      'atritoExtra',
      'fusivelQueimado',
      'bateriaFraca',
    ]);
    for (const c of CASOS) {
      const faults = Object.keys(c.central.faults ?? {});
      expect(faults.length, c.id).toBe(1);
      for (const f of faults) expect(known.has(f), `${c.id}: ${f}`).toBe(true);
    }
  });

  it('fusível queimado: nothing works and the REDE LED is off, although the breaker is on', () => {
    const ctl = start('fusivel-queimado');
    remote(ctl);
    botoeira(ctl);
    ctl.advance(3);
    const s = ctl.getSnapshot();
    expect(s.disjuntor).toBe(true);
    expect(s.energizada).toBe(false);
    expect(s.leds.rede).toBe(false);
    expect(s.nomeEstado).toBe('Desligada');
    expect(s.k1 || s.k2).toBe(false);
    expect(pos(ctl)).toBe(0);
  });

  it('capacitor aberto: the motor hums without moving, and the central gives up at 40 s', () => {
    const ctl = start('capacitor-aberto');
    remote(ctl);
    ctl.advance(5);
    let s = ctl.getSnapshot();
    expect(s.estado).toBe('ABRINDO');
    expect(s.zumbindo).toBe(true);
    expect(s.corrente).toBeGreaterThan(3);
    expect(pos(ctl)).toBe(0);
    const took = until(ctl, () => ctl.getSnapshot().estado === 'ERRO');
    expect(took + 5.1).toBeGreaterThan(39);
    expect(took + 5.1).toBeLessThan(41);
    s = ctl.getSnapshot();
    expect(s.zumbindo).toBe(false);
    expect(pos(ctl)).toBe(0);
  });

  it('fios invertidos: the first command closes the gate, and DIP INV fixes it', () => {
    const ctl = start('fios-invertidos');
    expect(ctl.getSnapshot().estado).toBe('PARADO'); // it does not know where the gate is
    const before = pos(ctl);
    remote(ctl);
    ctl.advance(2);
    let s = ctl.getSnapshot();
    expect(s.estado).toBe('ABRINDO');
    expect(s.k1).toBe(true);
    expect(pos(ctl)).toBeLessThan(before - 0.2); // "opening" moves it towards closed
    until(ctl, () => ctl.getSnapshot().estado !== 'ABRINDO', 20);
    expect(ctl.getSnapshot().estado).toBe('PARADO');
    expect(pos(ctl)).toBeLessThan(0.1);
    expect(logged(ctl, /obstáculo/i)).toBe(true);

    ctl.setSetting('inv', true);
    remote(ctl);
    ctl.advance(1);
    expect(ctl.getSnapshot().estado).toBe('FECHADO');
    remote(ctl);
    ctl.advance(3);
    s = ctl.getSnapshot();
    expect(s.estado).toBe('ABRINDO');
    expect(s.velocidade).toBeGreaterThan(0);
  });

  it('fotocélula desalinhada: the gate opens and never closes, by itself or by the remote', () => {
    const ctl = start('fotocelula-desalinhada');
    expect(ctl.getSnapshot().leds.foto).toBe(false);
    remote(ctl);
    until(ctl, () => ctl.getSnapshot().estado === 'ABERTO', 30);
    expect(ctl.getSnapshot().estado).toBe('ABERTO');
    ctl.advance(40); // the pause is 30 s
    expect(ctl.getSnapshot().estado).toBe('ABERTO');
    remote(ctl);
    ctl.advance(2);
    expect(ctl.getSnapshot().estado).toBe('ABERTO');
    expect(logged(ctl, /Fotocélula interrompida/)).toBe(true);
  });

  it('bateria fraca: the remote only works close to the central; the push button always', () => {
    const ctl = start('bateria-fraca');
    expect(remote(ctl)).toBe(false);
    ctl.advance(1);
    expect(ctl.getSnapshot().estado).toBe('FECHADO');
    ctl.setRemoteClose(true);
    expect(remote(ctl)).toBe(true);
    ctl.advance(0.5);
    expect(ctl.getSnapshot().estado).toBe('ABRINDO');

    const other = start('bateria-fraca');
    botoeira(other);
    other.advance(0.5);
    expect(other.getSnapshot().estado).toBe('ABRINDO');
  });

  it('desbloqueio aberto: the motor turns, the gate stays, ERRO after 40 s', () => {
    const ctl = start('desbloqueio-aberto');
    remote(ctl);
    ctl.advance(5);
    const s = ctl.getSnapshot();
    expect(s.estado).toBe('ABRINDO');
    expect(s.k1).toBe(true);
    expect(s.zumbindo).toBe(false);
    expect(s.corrente).toBeGreaterThan(0.5);
    expect(s.corrente).toBeLessThan(2);
    const took = until(ctl, () => ctl.getSnapshot().estado === 'ERRO');
    expect(took + 5.1).toBeGreaterThan(39);
    expect(took + 5.1).toBeLessThan(41);
    expect(pos(ctl)).toBe(0);
  });

  it('reed com defeito: no limit-switch LED; the gate bumps the ends and will not stay closed', () => {
    const ctl = start('reed-defeituoso');
    let led = false;
    const watch = () => {
      const s = ctl.getSnapshot();
      if (s.leds.fca || s.leds.fcf) led = true;
      return false;
    };
    expect(ctl.getSnapshot().estado).toBe('PARADO'); // closed, but the central does not know
    remote(ctl);
    until(ctl, () => watch() || ctl.getSnapshot().estado === 'PARADO', 30);
    expect(ctl.getSnapshot().estado).toBe('PARADO');
    expect(pos(ctl)).toBeGreaterThan(3.9);
    expect(logged(ctl, /Obstáculo na abertura/)).toBe(true);

    remote(ctl);
    until(ctl, () => watch() || ctl.getSnapshot().estado === 'ABRINDO', 30);
    expect(ctl.getSnapshot().estado).toBe('ABRINDO'); // it hit the closed end and reversed
    expect(pos(ctl)).toBeLessThan(0.1);
    expect(logged(ctl, /Obstáculo no fechamento/)).toBe(true);
    let closed = false;
    until(
      ctl,
      () => {
        watch();
        if (ctl.getSnapshot().estado === 'FECHADO') closed = true;
        return ctl.getSnapshot().estado === 'PARADO';
      },
      30,
    );
    expect(closed).toBe(false);
    expect(led).toBe(false);
  });

  it('atrito com FORÇA baixa: the gate stops at the rough spot, and more FORÇA gets it through', () => {
    const ctl = start('atrito-forca-baixa');
    remote(ctl);
    until(ctl, () => ctl.getSnapshot().estado !== 'ABRINDO', 30);
    expect(ctl.getSnapshot().estado).toBe('PARADO');
    expect(pos(ctl)).toBeGreaterThan(1.95);
    expect(pos(ctl)).toBeLessThan(2.15);
    expect(logged(ctl, /Obstáculo na abertura/)).toBe(true);

    // Closing from there goes back home; then, with more FORÇA, it opens all the way.
    remote(ctl);
    until(ctl, () => ctl.getSnapshot().estado === 'FECHADO', 30);
    expect(ctl.getSnapshot().estado).toBe('FECHADO');
    ctl.setSetting('forca', 0.4);
    remote(ctl);
    until(ctl, () => ctl.getSnapshot().estado !== 'ABRINDO', 40);
    expect(ctl.getSnapshot().estado).toBe('ABERTO');
    remote(ctl);
    until(ctl, () => ctl.getSnapshot().estado !== 'FECHANDO', 40);
    expect(ctl.getSnapshot().estado).toBe('FECHADO');
  });

  it('atrito com FORÇA baixa: closing through the rough spot, the gate opens again by itself', () => {
    const c = caso('atrito-forca-baixa');
    const ctl = criarCentral({ ...c, central: { ...c.central, abertura: 1 } });
    ctl.advance(0.2);
    remote(ctl);
    until(ctl, () => ctl.getSnapshot().estado !== 'FECHANDO', 30);
    expect(ctl.getSnapshot().estado).toBe('ABRINDO');
    expect(pos(ctl)).toBeGreaterThan(2.8);
    until(ctl, () => ctl.getSnapshot().estado !== 'ABRINDO', 30);
    expect(ctl.getSnapshot().estado).toBe('ABERTO'); // and it opens all the way again
    expect(logged(ctl, /Obstáculo no fechamento/)).toBe(true);
  });
});

describe('medições do diagnóstico', () => {
  const all = (id: MedicaoId, ctx: ContextoMedicao) =>
    CASOS.map((c) => ({ caso: c.id, ...medir(id, c.central.faults ?? {}, ctx) }));

  it('lists each measurement once', () => {
    expect(new Set(MEDICOES.map((m) => m.id)).size).toBe(MEDICOES.length);
  });

  it('measures continuity, resistance and capacitance only with the breaker off', () => {
    for (const id of ['fusivel', 'capacitor', 'enrolamentos', 'trilho'] as const) {
      for (const r of all(id, ON)) {
        expect(r.bloqueada, `${id} ${r.caso}`).toBe(true);
        expect(r.texto, `${id} ${r.caso}`).toMatch(/Desligue o disjuntor/);
      }
      for (const r of all(id, OFF)) expect(r.bloqueada, `${id} ${r.caso}`).toBe(false);
    }
  });

  it('needs the board powered to read the limit-switch LEDs and the photocell input', () => {
    for (const id of ['ima-reed', 'foto'] as const) {
      for (const r of all(id, OFF)) {
        expect(r.bloqueada).toBe(true);
        expect(r.texto).toMatch(/Ligue o disjuntor/);
      }
    }
    const noFuse = caso('fusivel-queimado').central.faults ?? {};
    const live = { disjuntor: true, energizada: false, feixeInterrompido: false };
    expect(medir('ima-reed', noFuse, live)).toMatchObject({ bloqueada: true });
    expect(medir('foto', noFuse, live).texto).toMatch(/sem alimentação/);
  });

  it('reads the mains, the fuse and the capacitor of each case', () => {
    for (const c of CASOS) {
      const f = c.central.faults ?? {};
      expect(medir('tensao-rede', f, ON).texto).toMatch(/^127 V/);
      expect(medir('tensao-rede', f, OFF).texto).toMatch(/^0 V/);
      expect(medir('fusivel', f, OFF).texto).toMatch(f.fusivelQueimado ? /^OL/ : /^Bipe/);
      expect(medir('capacitor', f, OFF).texto).toMatch(f.capacitorAberto ? /^0,0 µF/ : /^39,2 µF/);
      expect(medir('enrolamentos', f, OFF).texto).toMatch(/ABRE–FECHA 9,7 Ω/);
    }
  });

  it('reads the sensors, the remote battery, the release and the track of each case', () => {
    for (const c of CASOS) {
      const f = c.central.faults ?? {};
      expect(medir('ima-reed', f, ON).texto).toMatch(
        f.reedDefeituoso ? /^Nenhum LED/ : /LED de fim de curso acende/,
      );
      expect(medir('foto', f, ON).texto).toMatch(f.fotocelulaDesalinhada ? /^5 V/ : /^0 V/);
      expect(medir('bateria', f, ON).texto).toMatch(f.bateriaFraca ? /^8,6 V/ : /^12,2 V/);
      expect(medir('desbloqueio', f, ON).texto).toMatch(
        f.desbloqueado ? /posição aberta/ : /travada/,
      );
      expect(medir('trilho', f, OFF).texto).toMatch(
        f.atritoExtra ? /entre 2 m e 3 m fica pesado/i : /leve e por igual/,
      );
    }
    const someone = { ...ON, feixeInterrompido: true };
    expect(medir('foto', {}, someone)).toMatchObject({ bloqueada: true });
  });

  it('takes the breaker and the beam from the central snapshot', () => {
    const ctl = start('fusivel-queimado');
    const faults = caso('fusivel-queimado').central.faults ?? {};
    expect(contextoDe(ctl.getSnapshot())).toEqual({
      disjuntor: true,
      energizada: false,
      feixeInterrompido: false,
    });
    expect(medir('fusivel', faults, contextoDe(ctl.getSnapshot())).bloqueada).toBe(true);
    ctl.setBreaker(false);
    expect(medir('fusivel', faults, contextoDe(ctl.getSnapshot())).texto).toMatch(/^OL/);
    expect(medir('tensao-rede', faults, contextoDe(ctl.getSnapshot())).texto).toMatch(/^0 V/);

    const foto = start('fotocelula-desalinhada');
    expect(contextoDe(foto.getSnapshot()).energizada).toBe(true);
    foto.setBeam(true);
    expect(contextoDe(foto.getSnapshot()).feixeInterrompido).toBe(true);
  });

  it('separates each wrong cause with a reading that differs from the faulty gate', () => {
    // The measurement the feedback points to really gives the "normal" answer
    // on the faulty gate, so the student can rule the other cause out.
    const f = (id: string) => caso(id).central.faults ?? {};
    expect(medir('tensao-rede', f('fusivel-queimado'), ON).texto).toMatch(/127 V/);
    expect(medir('enrolamentos', f('capacitor-aberto'), OFF).texto).not.toMatch(/OL/);
    expect(medir('trilho', f('capacitor-aberto'), OFF).texto).toMatch(/leve/);
    expect(medir('antena', f('bateria-fraca'), ON).texto).toMatch(/inteiro/);
    expect(medir('desbloqueio', f('capacitor-aberto'), ON).texto).toMatch(/travada/);
    expect(medir('foto', f('reed-defeituoso'), ON).texto).toMatch(/^0 V/);
    expect(medir('ima-reed', f('atrito-forca-baixa'), ON).texto).toMatch(/acende/);
    expect(medir('capacitor', f('atrito-forca-baixa'), OFF).texto).toMatch(/39,2 µF/);
  });
});
