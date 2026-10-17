/**
 * Site search with Pagefind (built by `pnpm build` into dist/pagefind/).
 * Lessons and glossary terms are indexed; LessonProgress.astro and
 * CoursePage.astro mark them with the `tipo` filter and the `modulo` meta.
 */

export interface SearchHit {
  url: string;
  title: string;
  /** HTML with <mark> around the matched words (escaped by Pagefind). */
  excerpt: string;
  tipo?: string | undefined;
  modulo?: string | undefined;
  /** Sections of the page that match. */
  sections: { title: string; url: string; excerpt: string }[];
}

export interface SearchResult {
  total: number;
  hits: SearchHit[];
}

interface PagefindData {
  url: string;
  excerpt: string;
  meta: Record<string, string | undefined>;
  sub_results?: { title: string; url: string; excerpt: string }[];
}

interface Pagefind {
  options(opts: Record<string, unknown>): Promise<void>;
  init(): Promise<void>;
  debouncedSearch(
    query: string,
    opts?: { filters?: Record<string, string> },
    ms?: number,
  ): Promise<{ results: { data(): Promise<PagefindData> }[] } | null>;
}

let loading: Promise<Pagefind> | undefined;

/** Thrown when the index is missing (the dev server has no build). */
export class SearchUnavailable extends Error {}

function load(): Promise<Pagefind> {
  loading ??= (async () => {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    try {
      const pagefind = (await import(/* @vite-ignore */ `${base}pagefind/pagefind.js`)) as Pagefind;
      await pagefind.options({ baseUrl: base, excerptLength: 24 });
      await pagefind.init();
      return pagefind;
    } catch (error) {
      loading = undefined;
      throw new SearchUnavailable(String(error));
    }
  })();
  return loading;
}

/** Starts downloading the search code early (on focus or hover). */
export function preloadSearch() {
  load().catch(() => {});
}

/**
 * Searches the course. Returns null when a newer search replaced this one
 * while it waited (typing fast).
 */
export async function search(
  query: string,
  { tipo, limit = 12 }: { tipo?: string | undefined; limit?: number } = {},
): Promise<SearchResult | null> {
  const pagefind = await load();
  const response = await pagefind.debouncedSearch(query, tipo ? { filters: { tipo } } : {}, 180);
  if (response === null) return null;
  const data = await Promise.all(response.results.slice(0, limit).map((r) => r.data()));
  return {
    total: response.results.length,
    hits: data.map((d) => ({
      url: d.url,
      title: d.meta.title ?? d.url,
      excerpt: d.excerpt,
      tipo: d.meta.tipo,
      modulo: d.meta.modulo,
      sections: (d.sub_results ?? [])
        .filter((s) => s.url !== d.url && s.title !== d.meta.title)
        .slice(0, 2),
    })),
  };
}
