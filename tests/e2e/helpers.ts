import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** The example lesson: a draft, so it is not linked anywhere in production. */
export const EXAMPLE_LESSON = 'm00-comece-aqui/00-exemplo/';

/**
 * Collects console errors, uncaught exceptions and failed same-origin
 * requests while a page is used. Call `expectClean()` at the end.
 * `missing` lists paths that are expected to answer 404.
 */
export function watchErrors(page: Page, { missing = [] as string[] } = {}) {
  const problems: string[] = [];
  const isExpected = (url: string) => missing.some((path) => new URL(url).pathname.endsWith(path));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (msg.text().includes('status of 404') && isExpected(msg.location().url)) return;
    problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.hostname !== 'localhost' || response.status() < 400) return;
    if (response.status() === 404 && isExpected(response.url())) return;
    problems.push(`HTTP ${response.status()}: ${url.pathname}`);
  });
  return {
    expectClean: () => expect(problems).toEqual([]),
  };
}

/** No serious or critical accessibility violations (WCAG A/AA rules). */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  expect(serious).toEqual([]);
}

/** The page does not scroll sideways. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
