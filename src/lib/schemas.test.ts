import { describe, expect, it } from 'vitest';
import { lessonSchema, moduleSchema, termSchema, trackSchema } from './schemas';

// The examples of docs/plano/02-arquitetura.md, section 4.1.
const moduleExample = {
  id: 'm08-motores',
  numero: 8,
  parte: 2,
  titulo: 'Motores elétricos',
  resumo: 'Como a eletricidade vira movimento, do motor de brinquedo ao motor do portão.',
  icone: 'motor',
};

const lessonExample = {
  titulo: 'Motor monofásico com capacitor',
  modulo: 'm08-motores',
  ordem: 4,
  nivel: 'I',
  duracaoMin: 25,
  objetivos: [
    'Explicar por que o motor monofásico precisa de capacitor para partir',
    'Inverter o sentido de rotação trocando a ligação do capacitor',
    'Identificar comum e enrolamentos com o multímetro',
  ],
  prerequisitos: ['m06-corrente-alternada/03-fase-e-fasores', 'm04-passivos/03-capacitores'],
  tags: ['motor', 'capacitor', 'portão'],
  seguranca: 'rede',
  rascunho: false,
};

describe('moduleSchema', () => {
  it('accepts the example from the plan', () => {
    expect(moduleSchema.parse(moduleExample)).toEqual(moduleExample);
  });

  it('rejects an unknown icon', () => {
    expect(moduleSchema.safeParse({ ...moduleExample, icone: 'motorr' }).success).toBe(false);
  });

  it('rejects a malformed id', () => {
    expect(moduleSchema.safeParse({ ...moduleExample, id: 'motores' }).success).toBe(false);
  });

  it('accepts only parts 1 to 4', () => {
    expect(moduleSchema.safeParse({ ...moduleExample, parte: 5 }).success).toBe(false);
  });
});

describe('lessonSchema', () => {
  it('accepts the example from the plan', () => {
    expect(lessonSchema.parse(lessonExample)).toEqual(lessonExample);
  });

  it('fills the optional fields with defaults', () => {
    const minimal = {
      titulo: 'Lei de Ohm',
      modulo: 'm01-eletricidade-do-zero',
      ordem: 4,
      nivel: 'B',
      duracaoMin: 20,
      objetivos: ['Relacionar tensão, corrente e resistência'],
    };
    expect(lessonSchema.parse(minimal)).toMatchObject({
      prerequisitos: [],
      tags: [],
      seguranca: 'nenhum',
      rascunho: false,
    });
  });

  it.each([
    ['nivel', 'X'],
    ['seguranca', '220V'],
    ['duracaoMin', 0],
    ['objetivos', []],
    ['modulo', 'M08 motores'],
    ['prerequisitos', ['m04-passivos']],
  ])('rejects an invalid %s', (field, value) => {
    expect(lessonSchema.safeParse({ ...lessonExample, [field]: value }).success).toBe(false);
  });
});

describe('termSchema', () => {
  it('accepts a term with defaults', () => {
    expect(
      termSchema.parse({ termo: 'Borne', resumo: 'Conector de parafuso que prende um fio.' }),
    ).toEqual({
      termo: 'Borne',
      resumo: 'Conector de parafuso que prende um fio.',
      sinonimos: [],
      relacionados: [],
    });
  });

  it('requires a short definition', () => {
    expect(termSchema.safeParse({ termo: 'Borne' }).success).toBe(false);
  });
});

describe('trackSchema', () => {
  const track = {
    titulo: 'Portão eletrônico',
    paraQuem: 'Quem vai instalar, trocar ou consertar um automatizador',
    resumo: 'Do choque elétrico à central nova funcionando.',
    ordem: 1,
    icone: 'portao',
    itens: ['m00-comece-aqui/02-seguranca', 'm16-portao'],
  };

  it('accepts lessons and whole modules as items', () => {
    expect(trackSchema.parse(track)).toEqual(track);
  });

  it('rejects an item that is neither a module nor a lesson id', () => {
    expect(trackSchema.safeParse({ ...track, itens: ['portao'] }).success).toBe(false);
  });
});
