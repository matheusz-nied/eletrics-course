/*
 * Behavior of <Workshop> (src/course/Workshop.astro): the checklist in the
 * lesson and the full-screen "modo oficina", with the steps saved in the
 * progress store so the student can stop and pick up later.
 */
import { getProgress } from '../progress/store';

type WakeLockSentinelLike = { release(): Promise<void> };

const TYPING = 'input, textarea, select, [contenteditable="true"], .wshop__media';

export function initWorkshops() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-workshop]')) {
    if (root.dataset.ready === undefined) setup(root);
  }
}

function setup(root: HTMLElement) {
  const id = root.dataset.workshop ?? '';
  const store = getProgress();
  const one = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector);

  const steps = [...root.querySelectorAll<HTMLElement>('.wshop__step[data-step]')];
  const total = steps.length;
  const intro = one('[data-step="inicio"]');
  const finish = one('[data-step="fim"]');
  const hasIntro = Boolean(intro?.querySelector('.callout, .wshop__lists'));
  const slides = [...(hasIntro && intro ? [intro] : []), ...steps, ...(finish ? [finish] : [])];

  const openButton = one<HTMLButtonElement>('[data-workshop-open]');
  const openLabel = one('[data-workshop-open-label]');
  const resetButton = one<HTMLButtonElement>('[data-workshop-reset]');
  const resetLabel = one('[data-workshop-reset-label]');
  const meter = one('[data-workshop-meter]');
  const count = one('[data-workshop-count]');
  const position = one('[data-workshop-position]');
  const scroller = one('[data-workshop-scroll]');
  const prevButton = one<HTMLButtonElement>('[data-workshop-prev]');
  const nextButton = one<HTMLButtonElement>('[data-workshop-next]');
  const doneButton = one<HTMLButtonElement>('[data-workshop-done]');
  const doneLabel = one('[data-workshop-done-label]');
  const closeButton = one<HTMLButtonElement>('[data-workshop-close]');
  const fullscreenButton = one<HTMLButtonElement>('[data-workshop-fullscreen]');
  const live = one('[data-workshop-live]');

  let current = 0;
  let opener: HTMLElement | null = null;
  let madeInert: HTMLElement[] = [];
  let wakeLock: WakeLockSentinelLike | null = null;
  let historyToken: string | null = null;
  let confirmTimer: number | undefined;

  const isOpen = () => root.dataset.mode === 'oficina';
  const stepNumber = (el: HTMLElement) => Number(el.dataset.number);
  const done = () => new Set(store.workshop(id).feitos);

  function announce(text: string) {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(() => (live.textContent = text), 50);
  }

  /** Where "Continuar" starts: the saved step, else the first one not done. */
  function startIndex(): number {
    const record = store.workshop(id);
    const feitos = new Set(record.feitos);
    if (feitos.size >= total) return 0;
    const saved = steps.find(
      (s) => s.dataset.step === record.atual && !feitos.has(s.dataset.step ?? ''),
    );
    const target =
      saved ?? (feitos.size > 0 ? steps.find((s) => !feitos.has(s.dataset.step ?? '')) : undefined);
    return target ? slides.indexOf(target) : 0;
  }

  function render() {
    const feitos = done();
    const finished = steps.filter((s) => feitos.has(s.dataset.step ?? '')).length;
    const record = store.workshop(id);

    for (const step of steps) {
      const isDone = feitos.has(step.dataset.step ?? '');
      step.toggleAttribute('data-done', isDone);
      const box = step.querySelector<HTMLInputElement>('[data-step-done]');
      if (box) box.checked = isDone;
    }

    root.style.setProperty('--ws-progress', String(total ? finished / total : 0));
    const summary = `${finished} de ${total} ${total === 1 ? 'passo feito' : 'passos feitos'}`;
    meter?.setAttribute('aria-valuenow', String(finished));
    meter?.setAttribute('aria-valuetext', summary);
    if (count) count.textContent = summary;

    const started = finished > 0 || record.atual !== undefined;
    if (openLabel) {
      const target = slides[startIndex()];
      openLabel.textContent =
        started && finished < total && target && target.dataset.number
          ? `Continuar do passo ${target.dataset.number}`
          : 'Abrir modo oficina';
    }
    if (resetButton) resetButton.hidden = !started;
    if (isOpen()) renderSlide();
  }

  function renderSlide() {
    const slide = slides[current];
    if (!slide) return;
    slides.forEach((s) => s.toggleAttribute('data-current', s === slide));

    const isStep = steps.includes(slide);
    if (position) {
      position.textContent = isStep
        ? `Passo ${stepNumber(slide)} de ${total}`
        : slide === finish
          ? 'Fim'
          : 'Preparação';
    }
    if (prevButton) prevButton.disabled = current === 0;
    if (nextButton) nextButton.disabled = current === slides.length - 1;

    if (doneButton && doneLabel) {
      if (isStep) {
        doneLabel.textContent = 'Feito';
        doneButton.setAttribute('aria-pressed', String(slide.hasAttribute('data-done')));
      } else {
        doneLabel.textContent = slide === finish ? 'Concluir' : 'Começar';
        doneButton.removeAttribute('aria-pressed');
      }
    }
  }

  function go(index: number, focus = true) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    const slide = slides[current];
    if (!slide) return;
    const stepId = slide.dataset.step;
    if (stepId && steps.includes(slide)) store.setCurrentStep(id, stepId);
    renderSlide();
    scroller?.scrollTo({ top: 0 });
    if (focus) {
      const heading = slide.querySelector<HTMLElement>('[data-step-title]') ?? slide;
      heading.focus({ preventScroll: true });
    }
  }

  // Modal behavior

  function setInert() {
    madeInert = [];
    let node: HTMLElement | null = root;
    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert) {
          sibling.inert = true;
          madeInert.push(sibling);
        }
      }
      node = parent;
    }
  }

  function clearInert() {
    for (const el of madeInert) el.inert = false;
    madeInert = [];
  }

  async function keepAwake() {
    const wake = (
      navigator as Navigator & {
        wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wake || wakeLock || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await wake.request('screen');
    } catch {
      wakeLock = null;
    }
  }

  function releaseAwake() {
    void wakeLock?.release().catch(() => undefined);
    wakeLock = null;
  }

  function open() {
    if (isOpen()) return;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    root.dataset.mode = 'oficina';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    document.documentElement.style.overflow = 'hidden';
    setInert();
    void keepAwake();
    historyToken = `${id}-${Date.now()}`;
    history.pushState({ ...(history.state as object | null), oficina: historyToken }, '');
    go(startIndex());
  }

  /** `fromHistory`: the browser's back button already left the entry. */
  function close(fromHistory = false) {
    if (!isOpen()) return;
    const state = history.state as { oficina?: string } | null;
    if (!fromHistory && historyToken && state?.oficina === historyToken) {
      history.back(); // popstate closes it
      return;
    }
    historyToken = null;
    if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => undefined);
    root.dataset.mode = 'lista';
    root.removeAttribute('role');
    root.removeAttribute('aria-modal');
    slides.forEach((s) => s.removeAttribute('data-current'));
    document.documentElement.style.overflow = '';
    clearInert();
    releaseAwake();
    render();
    (opener && opener.isConnected ? opener : openButton)?.focus();
    opener = null;
  }

  function toggleCurrent() {
    const slide = slides[current];
    if (!slide) return;
    if (slide === finish) return close();
    if (!steps.includes(slide)) return go(current + 1);
    const stepId = slide.dataset.step ?? '';
    const wasDone = slide.hasAttribute('data-done');
    store.setStepDone(id, stepId, !wasDone);
    if (wasDone) {
      announce(`Passo ${stepNumber(slide)} desmarcado.`);
      return;
    }
    const left = total - done().size;
    announce(
      left === 0
        ? 'Todos os passos feitos.'
        : `Passo ${stepNumber(slide)} feito. ${left === 1 ? 'Falta 1 passo.' : `Faltam ${left} passos.`}`,
    );
    go(current + 1);
  }

  // Events

  openButton?.addEventListener('click', open);
  closeButton?.addEventListener('click', () => close());
  prevButton?.addEventListener('click', () => go(current - 1));
  nextButton?.addEventListener('click', () => go(current + 1));
  doneButton?.addEventListener('click', toggleCurrent);

  root.addEventListener('keydown', (event) => {
    if (!isOpen() || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if ((event.target as HTMLElement).closest(TYPING)) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      go(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      go(current - 1);
    }
  });

  window.addEventListener('popstate', () => {
    const state = history.state as { oficina?: string } | null;
    if (isOpen() && state?.oficina !== historyToken) close(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isOpen()) {
      wakeLock = null;
      void keepAwake();
    }
  });

  for (const step of steps) {
    step
      .querySelector<HTMLInputElement>('[data-step-done]')
      ?.addEventListener('change', (event) => {
        const box = event.currentTarget as HTMLInputElement;
        store.setStepDone(id, step.dataset.step ?? '', box.checked);
        const left = total - done().size;
        announce(
          box.checked
            ? left === 0
              ? 'Todos os passos feitos.'
              : `Passo ${stepNumber(step)} feito.`
            : `Passo ${stepNumber(step)} desmarcado.`,
        );
      });
  }

  // "Recomeçar" asks once more before erasing.
  function disarmReset() {
    window.clearTimeout(confirmTimer);
    resetButton?.removeAttribute('data-confirm');
    if (resetLabel) resetLabel.textContent = 'Recomeçar';
  }
  resetButton?.addEventListener('click', () => {
    if (!resetButton.hasAttribute('data-confirm')) {
      resetButton.setAttribute('data-confirm', '');
      if (resetLabel) resetLabel.textContent = 'Apagar os passos feitos?';
      confirmTimer = window.setTimeout(disarmReset, 5000);
      return;
    }
    disarmReset();
    store.resetWorkshop(id);
    announce('Passos apagados. O procedimento começa do início.');
    openButton?.focus();
  });
  resetButton?.addEventListener('blur', disarmReset);

  if (fullscreenButton && document.fullscreenEnabled) {
    const label = fullscreenButton.querySelector('.sr-only');
    fullscreenButton.hidden = false;
    fullscreenButton.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      else void root.requestFullscreen().catch(() => undefined);
    });
    document.addEventListener('fullscreenchange', () => {
      if (label)
        label.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia';
    });
  }

  store.subscribe(render);
  if (openButton) openButton.hidden = false;
  root.dataset.ready = '';
  render();
  void markOffline(root);
}

/** Shows "Disponível sem internet" once the page is in the offline cache. */
async function markOffline(root: HTMLElement) {
  const badge = root.querySelector<HTMLElement>('[data-workshop-offline]');
  if (!badge || !('serviceWorker' in navigator) || !('caches' in window)) return;
  try {
    await navigator.serviceWorker.ready;
    for (const delay of [0, 3000]) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      if (await caches.match(location.pathname, { ignoreSearch: true })) {
        badge.hidden = false;
        return;
      }
    }
  } catch {
    // No cache access (private mode): keep the badge hidden.
  }
}
