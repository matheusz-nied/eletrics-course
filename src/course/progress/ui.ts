/**
 * Fills the progress markers rendered by the server (ProgressBar.astro,
 * LessonState.astro) from the browser's progress, and keeps them current when
 * the progress changes in this tab or in another one.
 *
 * - `[data-progress-of="id id …"]`: lessons counted by a progress bar.
 *   Inside: `[data-progress-meter]` (role=progressbar) and `[data-progress-label]`.
 * - `[data-lesson-state="id"]`: one lesson's mark (data-state = nova | iniciada | lida).
 */
import { getProgress, type ProgressStore } from './store';

export type LessonState = 'nova' | 'iniciada' | 'lida';

export function lessonState(store: ProgressStore, id: string): LessonState {
  const r = store.lesson(id);
  if (r.lida) return 'lida';
  if (r.visitada || r.quizzes) return 'iniciada';
  return 'nova';
}

const STATE_LABEL: Record<LessonState, string> = {
  nova: '',
  iniciada: 'Iniciada',
  lida: 'Concluída',
};

export function countLabel(done: number, total: number): string {
  const n = (x: number) => x.toLocaleString('pt-BR');
  if (total === 0) return 'Nenhuma aula publicada ainda';
  return `${n(done)} de ${n(total)} ${total === 1 ? 'aula concluída' : 'aulas concluídas'}`;
}

function render(store: ProgressStore) {
  document.querySelectorAll<HTMLElement>('[data-lesson-state]').forEach((el) => {
    const state = lessonState(store, el.dataset.lessonState ?? '');
    el.dataset.state = state;
    const label = el.querySelector<HTMLElement>('[data-lesson-state-label]');
    if (label) label.textContent = STATE_LABEL[state];
  });

  document.querySelectorAll<HTMLElement>('[data-progress-of]').forEach((el) => {
    const ids = (el.dataset.progressOf ?? '').split(' ').filter(Boolean);
    const done = ids.filter((id) => store.isRead(id)).length;
    const started = ids.some((id) => lessonState(store, id) !== 'nova');
    const fraction = ids.length > 0 ? done / ids.length : 0;
    el.style.setProperty('--progress', String(fraction));
    el.dataset.progressState = done === ids.length && done > 0 ? 'completo' : started ? 'iniciado' : 'vazio';
    const text = countLabel(done, ids.length);
    const meter = el.querySelector<HTMLElement>('[data-progress-meter]');
    if (meter) {
      meter.setAttribute('aria-valuenow', String(done));
      meter.setAttribute('aria-valuetext', text);
    }
    el.querySelectorAll<HTMLElement>('[data-progress-label]').forEach((label) => {
      label.textContent = text;
    });
    el.querySelectorAll<HTMLElement>('[data-progress-percent]').forEach((label) => {
      label.textContent = `${Math.round(fraction * 100)}%`;
    });
  });
}

let started = false;

/** Renders once and on every change. Safe to call from several components. */
export function startProgressUi() {
  if (started) return;
  started = true;
  const store = getProgress();
  render(store);
  store.subscribe(() => render(store));
}
