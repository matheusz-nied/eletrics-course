/**
 * Student progress, kept in the browser (docs/plano/02-arquitetura.md, section 9).
 *
 * Every key starts with `curso:v1:`, one key per item so tabs don't overwrite
 * each other:
 * - `curso:v1:aula:<lessonId>`     → LessonRecord (visited, read, quiz results)
 * - `curso:v1:oficina:<id>`        → WorkshopRecord (steps done, current step)
 * - `curso:v1:ultima-aula`         → LastLesson ("continue where you left off")
 * Other fronts may keep preferences under the same prefix (`curso:v1:tema`);
 * export/import carries them too, "apagar progresso" leaves them alone.
 */
// zod/mini keeps this module small: it loads on every lesson page.
import * as z from 'zod/mini';

export const PREFIX = 'curso:v1:';
export const KEYS = {
  lesson: (id: string) => `${PREFIX}aula:${id}`,
  workshop: (id: string) => `${PREFIX}oficina:${id}`,
  last: `${PREFIX}ultima-aula`,
} as const;

const LESSON_PREFIX = `${PREFIX}aula:`;
const WORKSHOP_PREFIX = `${PREFIX}oficina:`;
/** Event dispatched on the event target after every change made in this tab. */
export const CHANGE_EVENT = 'curso:progresso';

const isoDate = z.string().check(z.minLength(1));
const count = z.number().check(z.int(), z.minimum(0));

const quizResultSchema = z.object({
  acertos: count,
  total: z.number().check(z.int(), z.positive()),
  /** Best score so far (acertos). */
  melhor: count,
  em: isoDate,
});

const lessonSchema = z.object({
  visitada: z.optional(isoDate),
  lida: z.optional(isoDate),
  quizzes: z.optional(z.record(z.string(), quizResultSchema)),
});

const workshopSchema = z.object({
  feitos: z._default(z.array(z.string()), []),
  atual: z.optional(z.string()),
  em: z.optional(isoDate),
});

const lastSchema = z.object({ id: z.string().check(z.minLength(1)), em: isoDate });

export type QuizResult = z.infer<typeof quizResultSchema>;
export type LessonRecord = z.infer<typeof lessonSchema>;
export type WorkshopRecord = z.infer<typeof workshopSchema>;
export type LastLesson = z.infer<typeof lastSchema>;

export const EXPORT_FORMAT = 'curso-eletronica/progresso';

const exportSchema = z.object({
  formato: z.literal(EXPORT_FORMAT),
  versao: z.literal(1),
  exportadoEm: z.string(),
  dados: z.record(z.string(), z.string()),
});

export type ExportDoc = z.infer<typeof exportSchema>;

/** The part of the Web Storage API the store uses. */
export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage, for tests and for browsers that block localStorage. */
export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

export class ImportError extends Error {}

function parse<T>(schema: z.ZodMiniType<T>, raw: string | null): T | undefined {
  if (raw === null) return undefined;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

const later = (a?: string, b?: string) => (!a ? b : !b ? a : a > b ? a : b);
const earlier = (a?: string, b?: string) => (!a ? b : !b ? a : a < b ? a : b);

/** Combines two records of the same lesson: nothing done is lost. */
export function mergeLesson(a: LessonRecord, b: LessonRecord): LessonRecord {
  const quizzes: Record<string, QuizResult> = { ...a.quizzes };
  for (const [key, q] of Object.entries(b.quizzes ?? {})) {
    const mine = quizzes[key];
    if (!mine) quizzes[key] = q;
    else {
      const newest = q.em > mine.em ? q : mine;
      quizzes[key] = { ...newest, melhor: Math.max(mine.melhor, q.melhor) };
    }
  }
  const merged: LessonRecord = {};
  const visitada = earlier(a.visitada, b.visitada);
  const lida = later(a.lida, b.lida);
  if (visitada) merged.visitada = visitada;
  if (lida) merged.lida = lida;
  if (Object.keys(quizzes).length > 0) merged.quizzes = quizzes;
  return merged;
}

export function mergeWorkshop(a: WorkshopRecord, b: WorkshopRecord): WorkshopRecord {
  const newest = (b.em ?? '') > (a.em ?? '') ? b : a;
  const merged: WorkshopRecord = { feitos: [...new Set([...a.feitos, ...b.feitos])] };
  if (newest.atual) merged.atual = newest.atual;
  const em = later(a.em, b.em);
  if (em) merged.em = em;
  return merged;
}

export class ProgressStore {
  private listeners = new Set<() => void>();

  constructor(
    private storage: KeyValueStorage,
    private events?: EventTarget,
    private now: () => Date = () => new Date(),
  ) {
    events?.addEventListener(CHANGE_EVENT, () => this.notify());
    // Changes made in other tabs.
    events?.addEventListener('storage', (event) => {
      const key = (event as StorageEvent).key;
      if (key === null || key.startsWith(PREFIX)) this.notify();
    });
  }

  private stamp() {
    return this.now().toISOString();
  }

  private keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    return keys;
  }

  private write(key: string, value: unknown) {
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch {
      // Full or blocked storage: the change lasts until the page closes.
    }
  }

  private changed() {
    if (this.events) this.events.dispatchEvent(new Event(CHANGE_EVENT));
    else this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  /** Called after any change in this tab or in another one. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Lessons

  lesson(id: string): LessonRecord {
    return parse(lessonSchema, this.storage.getItem(KEYS.lesson(id))) ?? {};
  }

  /** Every lesson with some progress. */
  lessons(): Map<string, LessonRecord> {
    const map = new Map<string, LessonRecord>();
    for (const key of this.keys()) {
      if (!key.startsWith(LESSON_PREFIX)) continue;
      const record = parse(lessonSchema, this.storage.getItem(key));
      if (record) map.set(key.slice(LESSON_PREFIX.length), record);
    }
    return map;
  }

  private updateLesson(id: string, change: (r: LessonRecord) => LessonRecord) {
    this.write(KEYS.lesson(id), change(this.lesson(id)));
  }

  /** The lesson was opened: remembered for "continuar de onde parou". */
  visit(id: string) {
    const em = this.stamp();
    this.updateLesson(id, (r) => (r.visitada ? r : { ...r, visitada: em }));
    this.write(KEYS.last, { id, em } satisfies LastLesson);
    this.changed();
  }

  setRead(id: string, read: boolean) {
    const em = this.stamp();
    this.updateLesson(id, (r) => {
      const next = { ...r, visitada: r.visitada ?? em };
      if (read) next.lida = em;
      else delete next.lida;
      return next;
    });
    this.changed();
  }

  isRead(id: string): boolean {
    return this.lesson(id).lida !== undefined;
  }

  recordQuiz(lessonId: string, quizKey: string, acertos: number, total: number) {
    const em = this.stamp();
    this.updateLesson(lessonId, (r) => {
      const previous = r.quizzes?.[quizKey];
      const melhor = Math.max(previous?.melhor ?? 0, acertos);
      return {
        ...r,
        visitada: r.visitada ?? em,
        quizzes: { ...r.quizzes, [quizKey]: { acertos, total, melhor, em } },
      };
    });
    this.changed();
  }

  /** Sum of the latest results of every quiz in the lesson. */
  quizScore(id: string): { acertos: number; total: number; melhor: number } | undefined {
    const quizzes = Object.values(this.lesson(id).quizzes ?? {});
    if (quizzes.length === 0) return undefined;
    return quizzes.reduce(
      (sum, q) => ({
        acertos: sum.acertos + q.acertos,
        total: sum.total + q.total,
        melhor: sum.melhor + q.melhor,
      }),
      { acertos: 0, total: 0, melhor: 0 },
    );
  }

  lastLesson(): LastLesson | undefined {
    return parse(lastSchema, this.storage.getItem(KEYS.last));
  }

  // Workshops

  workshop(id: string): WorkshopRecord {
    return parse(workshopSchema, this.storage.getItem(KEYS.workshop(id))) ?? { feitos: [] };
  }

  workshops(): Map<string, WorkshopRecord> {
    const map = new Map<string, WorkshopRecord>();
    for (const key of this.keys()) {
      if (!key.startsWith(WORKSHOP_PREFIX)) continue;
      const record = parse(workshopSchema, this.storage.getItem(key));
      if (record) map.set(key.slice(WORKSHOP_PREFIX.length), record);
    }
    return map;
  }

  setStepDone(workshopId: string, stepId: string, done: boolean) {
    const r = this.workshop(workshopId);
    const feitos = done
      ? [...new Set([...r.feitos, stepId])]
      : r.feitos.filter((s) => s !== stepId);
    this.write(KEYS.workshop(workshopId), { ...r, feitos, em: this.stamp() });
    this.changed();
  }

  setCurrentStep(workshopId: string, stepId: string) {
    const r = this.workshop(workshopId);
    if (r.atual === stepId) return;
    this.write(KEYS.workshop(workshopId), { ...r, atual: stepId, em: this.stamp() });
    this.changed();
  }

  resetWorkshop(workshopId: string) {
    this.storage.removeItem(KEYS.workshop(workshopId));
    this.changed();
  }

  // Backup

  exportData(): ExportDoc {
    const dados: Record<string, string> = {};
    for (const key of this.keys()) {
      const value = this.storage.getItem(key);
      if (value !== null) dados[key] = value;
    }
    return { formato: EXPORT_FORMAT, versao: 1, exportadoEm: this.stamp(), dados };
  }

  /**
   * Restores a file made by `exportData`. "juntar" keeps what is already in
   * this browser and adds what the file has; "substituir" erases the progress
   * first. Returns how many items were written. Throws ImportError (pt-BR).
   */
  importData(raw: unknown, mode: 'juntar' | 'substituir'): number {
    const result = exportSchema.safeParse(raw);
    if (!result.success) {
      throw new ImportError('Este arquivo não é um progresso exportado por este curso.');
    }
    const entries = Object.entries(result.data.dados).filter(([key]) => key.startsWith(PREFIX));
    if (mode === 'substituir') this.clearProgress(false);

    for (const [key, value] of entries) {
      if (mode === 'juntar' && key.startsWith(LESSON_PREFIX)) {
        const incoming = parse(lessonSchema, value);
        if (!incoming) continue;
        const current = parse(lessonSchema, this.storage.getItem(key)) ?? {};
        this.write(key, mergeLesson(current, incoming));
      } else if (mode === 'juntar' && key.startsWith(WORKSHOP_PREFIX)) {
        const incoming = parse(workshopSchema, value);
        if (!incoming) continue;
        const current = parse(workshopSchema, this.storage.getItem(key)) ?? { feitos: [] };
        this.write(key, mergeWorkshop(current, incoming));
      } else if (mode === 'juntar' && key === KEYS.last) {
        const incoming = parse(lastSchema, value);
        const current = this.lastLesson();
        if (incoming && (!current || incoming.em > current.em)) this.write(key, incoming);
      } else {
        try {
          this.storage.setItem(key, value);
        } catch {
          // Storage full: skip the item.
        }
      }
    }
    this.changed();
    return entries.length;
  }

  /** Erases lessons, quizzes and workshops; preferences (theme, sound) stay. */
  clearProgress(notify = true) {
    for (const key of this.keys()) {
      if (key.startsWith(LESSON_PREFIX) || key.startsWith(WORKSHOP_PREFIX) || key === KEYS.last) {
        this.storage.removeItem(key);
      }
    }
    if (notify) this.changed();
  }
}

let shared: ProgressStore | undefined;

function browserStorage(): KeyValueStorage {
  try {
    const storage = window.localStorage;
    const probe = `${PREFIX}teste`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return new MemoryStorage();
  }
}

/** The page's store (in-memory during server rendering). */
export function getProgress(): ProgressStore {
  if (typeof window === 'undefined') return new ProgressStore(new MemoryStorage());
  shared ??= new ProgressStore(browserStorage(), window);
  return shared;
}
