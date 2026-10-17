import { describe, expect, it } from 'vitest';
import {
  checkCourse,
  listedLessons,
  neighbors,
  sortLessons,
  sortModules,
  splitLessonId,
  totalMinutes,
  type LessonEntry,
  type ModuleEntry,
} from './course';

const mod = (id: string, numero: number): ModuleEntry => ({
  id,
  data: { id, numero, parte: 1, titulo: id },
});

const lesson = (
  id: string,
  ordem: number,
  opts: { rascunho?: boolean; modulo?: string; duracaoMin?: number } = {},
): LessonEntry => ({
  id,
  data: {
    modulo: opts.modulo ?? id.split('/')[0]!,
    ordem,
    titulo: id,
    rascunho: opts.rascunho ?? false,
    duracaoMin: opts.duracaoMin ?? 10,
  },
});

const modules = [mod('m02-circuitos-cc', 2), mod('m00-comece-aqui', 0), mod('m01-eletricidade', 1)];

describe('splitLessonId', () => {
  it('splits module and lesson', () => {
    expect(splitLessonId('m08-motores/04-motor-monofasico-capacitor')).toEqual({
      modulo: 'm08-motores',
      aula: '04-motor-monofasico-capacitor',
    });
  });

  it('rejects ids without exactly one slash', () => {
    expect(() => splitLessonId('m08-motores')).toThrow(/inválido/);
    expect(() => splitLessonId('a/b/c')).toThrow(/inválido/);
    expect(() => splitLessonId('m08-motores/')).toThrow(/inválido/);
  });
});

describe('ordering', () => {
  it('sorts modules by number', () => {
    expect(sortModules(modules).map((m) => m.id)).toEqual([
      'm00-comece-aqui',
      'm01-eletricidade',
      'm02-circuitos-cc',
    ]);
  });

  it('sorts lessons by module number, then by order', () => {
    const lessons = [
      lesson('m02-circuitos-cc/01-circuito', 1),
      lesson('m00-comece-aqui/02-seguranca', 2),
      lesson('m01-eletricidade/10-unidades', 10),
      lesson('m01-eletricidade/02-corrente', 2),
      lesson('m00-comece-aqui/01-como-usar', 1),
    ];
    expect(sortLessons(lessons, modules).map((l) => l.id)).toEqual([
      'm00-comece-aqui/01-como-usar',
      'm00-comece-aqui/02-seguranca',
      'm01-eletricidade/02-corrente',
      'm01-eletricidade/10-unidades',
      'm02-circuitos-cc/01-circuito',
    ]);
  });
});

describe('listedLessons', () => {
  const lessons = [
    lesson('m00-comece-aqui/00-exemplo', 0, { rascunho: true }),
    lesson('m00-comece-aqui/01-como-usar', 1),
  ];

  it('hides drafts in production', () => {
    expect(listedLessons(lessons, false).map((l) => l.id)).toEqual([
      'm00-comece-aqui/01-como-usar',
    ]);
  });

  it('shows drafts on the dev server', () => {
    expect(listedLessons(lessons, true)).toHaveLength(2);
  });
});

describe('neighbors', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('returns previous and next', () => {
    expect(neighbors(items, 'b')).toEqual({ prev: { id: 'a' }, next: { id: 'c' } });
  });

  it('has no previous at the start and no next at the end', () => {
    expect(neighbors(items, 'a').prev).toBeUndefined();
    expect(neighbors(items, 'c').next).toBeUndefined();
  });

  it('has no neighbours for an unlisted item (a draft in production)', () => {
    expect(neighbors(items, 'x')).toEqual({ prev: undefined, next: undefined });
  });
});

describe('totalMinutes', () => {
  it('adds the lesson durations', () => {
    expect(
      totalMinutes([
        lesson('m00-a/01-x', 1, { duracaoMin: 15 }),
        lesson('m00-a/02-y', 2, { duracaoMin: 20 }),
      ]),
    ).toBe(35);
  });
});

describe('checkCourse', () => {
  it('accepts a consistent course', () => {
    expect(
      checkCourse(modules, [
        lesson('m00-comece-aqui/01-como-usar', 1),
        lesson('m01-eletricidade/01-atomos', 1),
      ]),
    ).toEqual([]);
  });

  it('requires the module id field to match the file name', () => {
    const wrong: ModuleEntry = {
      id: 'm00-comece-aqui',
      data: { id: 'm00-outro', numero: 0, parte: 1, titulo: '' },
    };
    expect(checkCourse([wrong], [])).toEqual([
      expect.stringMatching(/deve ser igual ao nome do arquivo/),
    ]);
  });

  it('requires the module number to match the id prefix', () => {
    expect(checkCourse([mod('m03-medicoes', 4)], [])).toEqual([
      expect.stringMatching(/não bate com o prefixo/),
    ]);
  });

  it('rejects two modules with the same number', () => {
    expect(checkCourse([mod('m01-a', 1), mod('m01-b', 1)], [])).toEqual([
      expect.stringMatching(/mesmo número/),
    ]);
  });

  it('rejects a lesson whose folder and module disagree', () => {
    const errors = checkCourse(modules, [
      lesson('m00-comece-aqui/01-x', 1, { modulo: 'm01-eletricidade' }),
    ]);
    expect(errors).toEqual([expect.stringMatching(/está na pasta "m00-comece-aqui"/)]);
  });

  it('rejects a lesson of a module that does not exist', () => {
    const errors = checkCourse(modules, [lesson('m09-semicondutores/01-diodo', 1)]);
    expect(errors).toEqual([expect.stringMatching(/não existe em src\/content\/modulos/)]);
  });

  it('rejects two lessons with the same order in a module', () => {
    const errors = checkCourse(modules, [
      lesson('m00-comece-aqui/01-a', 1),
      lesson('m00-comece-aqui/01-b', 1),
    ]);
    expect(errors).toEqual([expect.stringMatching(/mesma ordem/)]);
  });
});
