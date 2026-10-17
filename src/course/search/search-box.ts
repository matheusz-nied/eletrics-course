import { preloadSearch, search, SearchUnavailable, type SearchHit } from './engine';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderHit(hit: SearchHit): HTMLLIElement {
  const li = document.createElement('li');
  const card = el('div', 'sres');
  const link = el('a', 'sres__main');
  link.href = hit.url;
  link.dataset.searchHit = '';
  const kicker = [hit.tipo, hit.modulo].filter(Boolean).join(' · ');
  if (kicker) link.append(el('span', 'sres__kicker', kicker), ' ');
  link.append(el('span', 'sres__title', hit.title));
  card.append(link);
  const excerpt = el('p', 'sres__excerpt');
  excerpt.innerHTML = hit.excerpt; // Pagefind escapes the text and adds <mark>.
  card.append(excerpt);
  if (hit.sections.length > 0) {
    const sections = el('div', 'sres__sections');
    for (const s of hit.sections) {
      const a = el('a', 'sres__section', `Na seção: ${s.title}`);
      a.href = s.url;
      sections.append(a);
    }
    card.append(sections);
  }
  li.append(card);
  return li;
}

function setup(box: HTMLElement) {
  const input = box.querySelector<HTMLInputElement>('[data-search-input]')!;
  const status = box.querySelector<HTMLElement>('[data-search-status]')!;
  const list = box.querySelector<HTMLOListElement>('[data-search-results]')!;
  const filters = [...box.querySelectorAll<HTMLButtonElement>('[data-search-filter]')];
  const syncUrl = box.hasAttribute('data-sync-url');
  let tipo = '';
  let run = 0;

  async function update() {
    const query = input.value.trim();
    const mine = ++run;
    if (syncUrl) {
      const url = new URL(location.href);
      if (query) url.searchParams.set('q', query);
      else url.searchParams.delete('q');
      history.replaceState(history.state, '', url);
    }
    if (query.length < 2) {
      list.replaceChildren();
      status.textContent = 'Digite pelo menos duas letras.';
      return;
    }
    status.textContent = 'Buscando…';
    try {
      const result = await search(query, { tipo: tipo || undefined });
      if (result === null || mine !== run) return;
      list.replaceChildren(...result.hits.map(renderHit));
      status.textContent =
        result.total === 0
          ? `Nada encontrado para "${query}". Tente outra palavra ou um sinônimo.`
          : `${result.total} ${result.total === 1 ? 'resultado' : 'resultados'} para "${query}"` +
            (result.total > result.hits.length ? `; mostrando os ${result.hits.length} primeiros.` : '.');
    } catch (error) {
      if (mine !== run) return;
      list.replaceChildren();
      status.textContent =
        error instanceof SearchUnavailable
          ? 'A busca ainda não está disponível aqui. Ela funciona no site publicado (o índice é criado no build).'
          : 'Não foi possível buscar agora. Tente de novo.';
    }
  }

  input.addEventListener('input', () => void update());
  input.addEventListener('focus', preloadSearch, { once: true });
  box.querySelector('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    box.querySelector<HTMLAnchorElement>('[data-search-hit]')?.focus();
  });

  // Filters behave as a radio group: arrows move, Space/Enter or click select.
  const select = (button: HTMLButtonElement, focus = false) => {
    for (const f of filters) {
      const on = f === button;
      f.setAttribute('aria-checked', String(on));
      f.tabIndex = on ? 0 : -1;
    }
    if (focus) button.focus();
    tipo = button.dataset.searchFilter ?? '';
    void update();
  };
  filters.forEach((button, i) => {
    button.addEventListener('click', () => select(button));
    button.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      select(filters[(i + step + filters.length) % filters.length]!, true);
    });
  });

  // Arrow keys move between the field and the results.
  box.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-search-filter]')) return;
    const hits = [...list.querySelectorAll<HTMLAnchorElement>('[data-search-hit]')];
    if (hits.length === 0) return;
    const at = hits.indexOf(target as HTMLAnchorElement);
    if (target === input && event.key === 'ArrowDown') hits[0]!.focus();
    else if (at === -1) return;
    else if (event.key === 'ArrowDown') hits[Math.min(at + 1, hits.length - 1)]!.focus();
    else if (at === 0) input.focus();
    else hits[at - 1]!.focus();
    event.preventDefault();
  });

  if (syncUrl) {
    const q = new URL(location.href).searchParams.get('q');
    if (q) {
      input.value = q;
      void update();
    }
  }
}

let done = false;

export function initSearchBoxes() {
  if (done) return;
  done = true;
  document.querySelectorAll<HTMLElement>('[data-search-box]').forEach(setup);
}
