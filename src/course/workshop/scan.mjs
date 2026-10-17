// @ts-check
/**
 * Finds `<Workshop id="…" />` in lesson sources. Plain JavaScript because
 * astro.config.mjs also uses it (src/course/pwa/options.mjs) to keep the
 * pages with a workshop in the offline cache.
 */

const WORKSHOP = /<Workshop\s[^>]*?\bid=(?:"([^"]+)"|'([^']+)'|\{\s*["']([^"']+)["']\s*\})/g;

/**
 * Workshop ids used in an MDX source, in order, without repeats.
 * @param {string} source
 * @returns {string[]}
 */
export function findWorkshopIds(source) {
  const ids = new Set();
  for (const match of source.matchAll(WORKSHOP)) ids.add(match[1] ?? match[2] ?? match[3]);
  return [...ids];
}
