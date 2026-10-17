import { expect, test, type Page } from '@playwright/test';
import {
  EXAMPLE_LESSON,
  expectAccessible,
  expectNoHorizontalOverflow,
  watchErrors,
} from './helpers';

const BASE = '/eletrics-course/';

/** Every page reachable from the home page, plus the example lesson (a draft). */
async function crawl(page: Page): Promise<string[]> {
  const seen = new Set<string>([BASE, `${BASE}${EXAMPLE_LESSON}`]);
  const queue = [...seen];
  while (queue.length > 0) {
    const path = queue.shift()!;
    await page.goto(path);
    const hrefs = await page.$$eval('a[href]', (links) =>
      links.map((a) => (a as HTMLAnchorElement).href),
    );
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== new URL(page.url()).origin || !url.pathname.startsWith(BASE)) continue;
      if (/\.[a-z0-9]+$/i.test(url.pathname)) continue;
      if (!seen.has(url.pathname)) {
        seen.add(url.pathname);
        queue.push(url.pathname);
      }
    }
  }
  return [...seen].sort();
}

test.describe('every page', () => {
  test.skip(({ isMobile }) => isMobile, 'The crawl runs once, on desktop.');

  test('opens without errors, in pt-BR, with internal links under the base path', async ({
    page,
  }) => {
    const paths = await crawl(page);
    expect(paths).toContain(BASE);

    for (const path of paths) {
      await test.step(path, async () => {
        const errors = watchErrors(page);
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page).toHaveTitle(/Curso de Eletrônica/);

        // Internal links must go through Astro's base (CLAUDE.md).
        const rootLinks = await page.$$eval('a[href^="/"]', (links) =>
          links.map((a) => a.getAttribute('href') ?? ''),
        );
        expect(rootLinks.filter((href) => !href.startsWith(BASE))).toEqual([]);
        errors.expectClean();
      });
    }
  });
});

test('home page lists the modules', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('');
  await expect(page.getByRole('heading', { level: 2, name: 'Módulos' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Comece aqui/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  errors.expectClean();
});

test('module page lists its published lessons and never the draft', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('m00-comece-aqui/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Comece aqui');
  await expect(page.getByText('Parte 1 · Fundamentos')).toBeVisible();
  // The example lesson is a draft: never linked in production.
  await expect(page.locator(`a[href$="/${EXAMPLE_LESSON}"]`)).toHaveCount(0);
  const lessons = page.getByRole('region', { name: 'Aulas' }).getByRole('listitem');
  await expect(lessons).toHaveCount(3);
  await expect(lessons.first().getByRole('link')).toHaveAttribute(
    'href',
    /\/m00-comece-aqui\/01-como-usar-este-curso\/$/,
  );
  await expectNoHorizontalOverflow(page);
  errors.expectClean();
});

test('unknown addresses show the 404 page', async ({ page }) => {
  const errors = watchErrors(page, { missing: ['/nao-existe/'] });
  const response = await page.goto('nao-existe/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página não encontrada');
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page).toHaveURL(/\/eletrics-course\/$/);
  errors.expectClean();
});

test('the theme follows the system and remembers the choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  const toggle = page.getByRole('button', { name: 'Tema escuro' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('the site search index is built', async ({ request }) => {
  const response = await request.get('pagefind/pagefind.js');
  expect(response.status()).toBe(200);
});

for (const theme of ['light', 'dark'] as const) {
  test(`pages have no serious accessibility violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    for (const path of ['', 'm00-comece-aqui/', EXAMPLE_LESSON, 'nao-existe/']) {
      await test.step(path || 'início', async () => {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          theme === 'dark' ? 'dark' : 'light',
        );
        await expectAccessible(page);
      });
    }
  });
}
