/**
 * Joins a site base (`/eletrics-course/`) and a path. Pure, so it can be tested.
 * Keeps query strings and hashes; never produces a double slash.
 */
export function joinBase(base: string, path = ''): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path;
  const root = base.replace(/\/+$/, '');
  const rest = path.replace(/^\/+/, '');
  return `${root}/${rest}`;
}

/**
 * Internal link that respects Astro's `base` (the site runs under
 * `/eletrics-course/`). Use it for every internal href and src:
 * `withBase('m01-eletricidade-do-zero/')`.
 */
export function withBase(path = ''): string {
  return joinBase(import.meta.env.BASE_URL, path);
}

/** `/eletrics-course/m08-motores/` */
export function moduleUrl(moduleId: string): string {
  return withBase(`${moduleId}/`);
}

/** `/eletrics-course/m08-motores/04-motor-monofasico-capacitor/` (lesson ids include the module). */
export function lessonUrl(lessonId: string): string {
  return withBase(`${lessonId}/`);
}
