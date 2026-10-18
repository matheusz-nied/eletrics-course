import { describe, expect, it, vi } from 'vitest';
import {
  EXPORT_FORMAT,
  ImportError,
  KEYS,
  MemoryStorage,
  ProgressStore,
  mergeLesson,
  mergeWorkshop,
} from './store';

const LESSON = 'm01-eletricidade-do-zero/04-lei-de-ohm';

function setup(start = '2026-10-17T12:00:00.000Z') {
  let t = new Date(start).getTime();
  const storage = new MemoryStorage();
  const store = new ProgressStore(storage, undefined, () => new Date((t += 1000)));
  return { storage, store };
}

describe('lessons', () => {
  it('starts empty', () => {
    const { store } = setup();
    expect(store.lesson(LESSON)).toEqual({});
    expect(store.isRead(LESSON)).toBe(false);
    expect(store.lastLesson()).toBeUndefined();
  });

  it('remembers the visit and the last lesson opened', () => {
    const { store } = setup();
    store.visit(LESSON);
    const first = store.lesson(LESSON).visitada;
    store.visit(LESSON);
    expect(store.lesson(LESSON).visitada).toBe(first);
    expect(store.lastLesson()?.id).toBe(LESSON);
  });

  it('marks and unmarks a lesson as read', () => {
    const { store } = setup();
    store.setRead(LESSON, true);
    expect(store.isRead(LESSON)).toBe(true);
    expect(store.lesson(LESSON).visitada).toBeDefined();
    store.setRead(LESSON, false);
    expect(store.isRead(LESSON)).toBe(false);
  });

  it('records quiz results with the best score', () => {
    const { store } = setup();
    store.recordQuiz(LESSON, 'q1', 3, 5);
    store.recordQuiz(LESSON, 'q1', 2, 5);
    store.recordQuiz(LESSON, 'q2', 1, 1);
    const q1 = store.lesson(LESSON).quizzes?.q1;
    expect(q1).toMatchObject({ acertos: 2, total: 5, melhor: 3 });
    expect(store.quizScore(LESSON)).toEqual({ acertos: 3, total: 6, melhor: 4 });
    expect(store.quizScore('m00-x/01-y')).toBeUndefined();
  });

  it('lists every lesson with progress and ignores broken entries', () => {
    const { store, storage } = setup();
    store.setRead(LESSON, true);
    storage.setItem(KEYS.lesson('m00-a/01-b'), '{not json');
    storage.setItem(KEYS.lesson('m00-a/02-c'), JSON.stringify({ lida: 42 }));
    storage.setItem('outra-coisa', 'x');
    expect([...store.lessons().keys()]).toEqual([LESSON]);
  });
});

describe('workshops', () => {
  it('marks steps and remembers the current one', () => {
    const { store } = setup();
    store.setStepDone('portao', 'desligar', true);
    store.setStepDone('portao', 'testar', true);
    store.setStepDone('portao', 'desligar', true);
    store.setCurrentStep('portao', 'testar');
    expect(store.workshop('portao')).toMatchObject({
      feitos: ['desligar', 'testar'],
      atual: 'testar',
    });
    store.setStepDone('portao', 'desligar', false);
    expect(store.workshop('portao').feitos).toEqual(['testar']);
    expect([...store.workshops().keys()]).toEqual(['portao']);
    store.resetWorkshop('portao');
    expect(store.workshop('portao')).toEqual({ feitos: [] });
  });
});

describe('subscribe', () => {
  it('notifies listeners of changes in this tab and in other tabs', () => {
    const events = new EventTarget();
    const store = new ProgressStore(new MemoryStorage(), events);
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.setRead(LESSON, true);
    expect(listener).toHaveBeenCalledTimes(1);

    const other = new Event('storage') as Event & { key: string };
    Object.defineProperty(other, 'key', { value: KEYS.lesson(LESSON) });
    events.dispatchEvent(other);
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    store.setRead(LESSON, false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('export and import', () => {
  it('round-trips everything under the prefix, preferences included', () => {
    const a = setup();
    a.storage.setItem('curso:v1:tema', 'escuro');
    a.storage.setItem('outro-site', 'x');
    a.store.setRead(LESSON, true);
    a.store.recordQuiz(LESSON, 'q1', 4, 5);
    a.store.setStepDone('portao', 'desligar', true);
    const file = JSON.parse(JSON.stringify(a.store.exportData()));
    expect(file.formato).toBe(EXPORT_FORMAT);
    expect(Object.keys(file.dados)).not.toContain('outro-site');

    const b = setup();
    expect(b.store.importData(file, 'juntar')).toBe(3);
    expect(b.store.isRead(LESSON)).toBe(true);
    expect(b.store.quizScore(LESSON)).toMatchObject({ acertos: 4, total: 5 });
    expect(b.store.workshop('portao').feitos).toEqual(['desligar']);
    expect(b.storage.getItem('curso:v1:tema')).toBe('escuro');
  });

  it('"juntar" keeps what this browser already has', () => {
    const a = setup();
    a.store.recordQuiz(LESSON, 'q1', 5, 5);
    a.store.setStepDone('portao', 'a', true);
    const file = a.store.exportData();

    const b = setup('2026-10-18T12:00:00.000Z');
    b.store.setRead('m00-x/01-y', true);
    b.store.recordQuiz(LESSON, 'q1', 2, 5);
    b.store.setStepDone('portao', 'b', true);
    b.store.importData(file, 'juntar');

    expect(b.store.isRead('m00-x/01-y')).toBe(true);
    // The newest attempt stays, the best score comes from the file.
    expect(b.store.lesson(LESSON).quizzes?.q1).toMatchObject({ acertos: 2, melhor: 5 });
    expect(b.store.workshop('portao').feitos.sort()).toEqual(['a', 'b']);
  });

  it('"substituir" erases the progress first', () => {
    const a = setup();
    a.store.setRead(LESSON, true);
    const file = a.store.exportData();

    const b = setup();
    b.store.setRead('m00-x/01-y', true);
    b.store.importData(file, 'substituir');
    expect(b.store.isRead('m00-x/01-y')).toBe(false);
    expect(b.store.isRead(LESSON)).toBe(true);
  });

  it('rejects files that are not a progress export', () => {
    const { store } = setup();
    expect(() => store.importData({ foo: 1 }, 'juntar')).toThrow(ImportError);
    expect(() =>
      store.importData({ formato: EXPORT_FORMAT, versao: 2, exportadoEm: '', dados: {} }, 'juntar'),
    ).toThrow(/não é um progresso/);
  });

  it('clearing the progress keeps the preferences', () => {
    const { store, storage } = setup();
    storage.setItem('curso:v1:tema', 'claro');
    store.setRead(LESSON, true);
    store.visit(LESSON);
    store.setStepDone('portao', 'a', true);
    store.clearProgress();
    expect(store.lessons().size).toBe(0);
    expect(store.workshops().size).toBe(0);
    expect(store.lastLesson()).toBeUndefined();
    expect(storage.getItem('curso:v1:tema')).toBe('claro');
  });
});

describe('merging', () => {
  it('keeps the first visit, the last reading and every quiz', () => {
    expect(
      mergeLesson(
        { visitada: '2026-01-02', quizzes: { a: { acertos: 1, total: 2, melhor: 2, em: '1' } } },
        {
          visitada: '2026-01-01',
          lida: '2026-01-03',
          quizzes: { b: { acertos: 1, total: 1, melhor: 1, em: '1' } },
        },
      ),
    ).toEqual({
      visitada: '2026-01-01',
      lida: '2026-01-03',
      quizzes: {
        a: { acertos: 1, total: 2, melhor: 2, em: '1' },
        b: { acertos: 1, total: 1, melhor: 1, em: '1' },
      },
    });
  });

  it('joins the steps done of a workshop', () => {
    expect(
      mergeWorkshop({ feitos: ['a'], atual: 'a', em: '1' }, { feitos: ['b'], atual: 'b', em: '2' }),
    ).toEqual({ feitos: ['a', 'b'], atual: 'b', em: '2' });
  });
});
