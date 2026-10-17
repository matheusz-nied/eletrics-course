import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  buildTrack,
  checkTracks,
  formatDuration,
  type ContentLesson,
  type ContentModule,
  type ContentTrack,
} from './catalog';
import { CURRICULUM, type PlannedModule } from './curriculum';
import { LESSON_ID, MODULE_ID } from '../lib/schemas';

const links = { module: (id: string) => `/m/${id}/`, lesson: (id: string) => `/a/${id}/` };

const plan: PlannedModule[] = [
  {
    id: 'm00-comece-aqui',
    numero: 0,
    parte: 1,
    titulo: 'Comece aqui',
    resumo: 'Plano',
    icone: 'inicio',
    aulas: [
      { id: 'm00-comece-aqui/01-como-usar', titulo: 'Como usar' },
      { id: 'm00-comece-aqui/02-seguranca', titulo: 'Segurança' },
    ],
  },
  {
    id: 'm01-eletricidade',
    numero: 1,
    parte: 1,
    titulo: 'Eletricidade',
    resumo: 'Plano',
    icone: 'raio',
    aulas: [
      { id: 'm01-eletricidade/01-carga', titulo: 'Carga' },
      { id: 'm01-eletricidade/02-corrente', titulo: 'Corrente', avancada: true },
    ],
  },
];

const module = (id: string, numero: number): ContentModule => ({
  id,
  data: { numero, parte: 1, titulo: `Título de ${id}`, resumo: 'Do YAML', icone: 'inicio' },
});

const lesson = (id: string, ordem: number, rascunho = false): ContentLesson => ({
  id,
  data: {
    modulo: id.split('/')[0]!,
    ordem,
    titulo: `Aula ${id}`,
    nivel: 'B',
    duracaoMin: 15,
    seguranca: 'nenhum',
    rascunho,
  },
});

const track = (id: string, itens: string[]): ContentTrack => ({
  id,
  data: { titulo: id, paraQuem: 'Quem', resumo: 'Resumo', ordem: 1, itens },
});

describe('buildCatalog', () => {
  it('shows planned lessons as "em breve" while a module has no published lesson', () => {
    const catalog = buildCatalog([], [], links, plan);
    expect(catalog.map((m) => m.id)).toEqual(['m00-comece-aqui', 'm01-eletricidade']);
    const m01 = catalog[1]!;
    expect(m01.published).toBe(false);
    expect(m01.href).toBeUndefined();
    expect(m01.lessons).toMatchObject([
      { id: 'm01-eletricidade/01-carga', number: '1.1', status: 'em-breve' },
      { id: 'm01-eletricidade/02-corrente', number: '1.2', status: 'em-breve', nivel: 'A' },
    ]);
    expect(m01.lessons[0]!.href).toBeUndefined();
  });

  it('uses the YAML of a module and lists its drafts next to the plan', () => {
    const catalog = buildCatalog(
      [module('m00-comece-aqui', 0)],
      [lesson('m00-comece-aqui/00-exemplo', 0, true)],
      links,
      plan,
    );
    const m00 = catalog[0]!;
    expect(m00.titulo).toBe('Título de m00-comece-aqui');
    expect(m00.href).toBe('/m/m00-comece-aqui/');
    expect(m00.published).toBe(false);
    expect(m00.lessons.map((l) => [l.id, l.status])).toEqual([
      ['m00-comece-aqui/00-exemplo', 'rascunho'],
      ['m00-comece-aqui/01-como-usar', 'em-breve'],
      ['m00-comece-aqui/02-seguranca', 'em-breve'],
    ]);
  });

  it('shows only the content lessons once the module is published', () => {
    const catalog = buildCatalog(
      [module('m01-eletricidade', 1)],
      [lesson('m01-eletricidade/01-carga', 1), lesson('m01-eletricidade/03-extra', 3)],
      links,
      plan,
    );
    const m01 = catalog.find((m) => m.id === 'm01-eletricidade')!;
    expect(m01.published).toBe(true);
    expect(m01.lessons.map((l) => [l.number, l.status, l.href])).toEqual([
      ['1.1', 'publicada', '/a/m01-eletricidade/01-carga/'],
      ['1.3', 'publicada', '/a/m01-eletricidade/03-extra/'],
    ]);
  });

  it('includes modules that exist only in the content', () => {
    const catalog = buildCatalog([module('m20-novo', 20)], [], links, plan);
    expect(catalog.at(-1)).toMatchObject({ id: 'm20-novo', lessons: [] });
  });
});

describe('tracks', () => {
  it('resolves modules and lessons in order, without repetition', () => {
    const catalog = buildCatalog([], [], links, plan);
    const t = buildTrack(
      track('t', ['m00-comece-aqui/02-seguranca', 'm01-eletricidade', 'm01-eletricidade/01-carga']),
      catalog,
    );
    expect(t.lessons.map((l) => l.id)).toEqual([
      'm00-comece-aqui/02-seguranca',
      'm01-eletricidade/01-carga',
      'm01-eletricidade/02-corrente',
    ]);
    expect(t.steps.map((s) => [s.module.id, s.lessons.length])).toEqual([
      ['m00-comece-aqui', 1],
      ['m01-eletricidade', 2],
    ]);
    expect(t.icone).toBe('trilha');
  });

  it('accepts planned lessons of modules not published yet', () => {
    const catalog = buildCatalog([], [], links, plan);
    expect(checkTracks([track('t', ['m01-eletricidade/02-corrente'])], catalog, plan)).toEqual([]);
  });

  it('rejects unknown modules and lessons', () => {
    const catalog = buildCatalog([], [], links, plan);
    const errors = checkTracks(
      [track('t', ['m09-nada', 'm09-nada/01-x', 'm01-eletricidade/09-inventada'])],
      catalog,
      plan,
    );
    expect(errors).toHaveLength(3);
    expect(errors[2]).toMatch(/não está no plano/);
  });

  it('rejects a lesson missing from a published module', () => {
    const catalog = buildCatalog(
      [module('m01-eletricidade', 1)],
      [lesson('m01-eletricidade/01-carga', 1)],
      links,
      plan,
    );
    const errors = checkTracks([track('t', ['m01-eletricidade/02-corrente'])], catalog, plan);
    expect(errors).toEqual([expect.stringMatching(/já foi publicado/)]);
  });
});

describe('the planned curriculum', () => {
  it('has 18 modules and 113 lessons with valid, unique ids', () => {
    expect(CURRICULUM).toHaveLength(18);
    const lessons = CURRICULUM.flatMap((m) => m.aulas);
    expect(lessons).toHaveLength(113);
    expect(new Set(lessons.map((l) => l.id)).size).toBe(113);
    for (const m of CURRICULUM) {
      expect(m.id).toMatch(MODULE_ID);
      expect(m.id.startsWith(`m${String(m.numero).padStart(2, '0')}-`)).toBe(true);
      m.aulas.forEach((a, i) => {
        expect(a.id).toMatch(LESSON_ID);
        expect(a.id.startsWith(`${m.id}/${String(i + 1).padStart(2, '0')}-`)).toBe(true);
      });
    }
  });

  it('keeps the lesson slugs other documents cite', () => {
    const ids = CURRICULUM.flatMap((m) => m.aulas.map((a) => a.id));
    expect(ids).toEqual(
      expect.arrayContaining([
        'm01-eletricidade-do-zero/03-tensao',
        'm01-eletricidade-do-zero/04-lei-de-ohm',
        'm04-passivos/03-capacitores',
        'm06-corrente-alternada/03-fase-e-fasores',
        'm08-motores/04-motor-monofasico-capacitor',
      ]),
    );
  });
});

describe('formatDuration', () => {
  it('writes hours and minutes', () => {
    expect(formatDuration(40)).toBe('40 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(135)).toBe('2 h 15 min');
  });
});
